import {
  ADULT_MUTATION_FAILURE_CODES,
  ADULT_READ_FAILURE_CODES,
  PARENT_HUB_REQUEST_LIMITS,
  type AdultPrivateCommitNoteInput,
  type AdultPrivateCommitNoteResult,
  type AdultProductionFailure,
  type AdultProductionFailureCode,
  type CalendarCreateContinuationInput,
  type CalendarCreateContinuationResult,
  type CalendarListInput,
  type CalendarListResult,
  type CalendarPauseInput,
  type CalendarPauseResult,
  type NotificationsListInput,
  type NotificationsListResult,
  type NotificationsMarkReadInput,
  type NotificationsMarkReadResult,
  type ParentHubCalendarSummary,
  type ParentHubNotificationSummary,
  type ParentHubReviewSummary,
  type ParentHubSafetyReviewSummary,
  type ParentHubSettings,
  type ParentHubSettingsChanges,
  type ReviewsDecideInput,
  type ReviewsDecideResult,
  type ReviewsListInput,
  type ReviewsListResult,
  type SafetyReviewAndClearInput,
  type SafetyReviewAndClearResult,
  type SafetyReviewListOpenInput,
  type SafetyReviewListOpenResult,
  type SettingsApplyInput,
  type SettingsApplyResult,
  type SettingsReadInput,
  type SettingsReadResult,
} from './contracts'
import {
  snapshotExactRecord,
  type ExactRecordShape,
  type ExactRecordSnapshot,
} from './exactRecord'

const OPAQUE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/
const OPAQUE_CURSOR = /^[A-Za-z0-9][A-Za-z0-9._~:/+=-]*$/
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/
const SETTINGS_KEYS = [
  'timerMode', 'maximumWorkMinutes', 'breakMinimumMinutes', 'breakMaximumMinutes',
  'requiredBreaks', 'reducedMotion', 'noAudio', 'largeText', 'readAloud', 'speechInputAllowed',
] as const
const MUTATION_KEYS = ['studentRef', 'expectedRevision', 'mutationId'] as const
const FAILURE_SHAPES = [
  { required: ['status', 'code'] },
  { required: ['status', 'code', 'retryAfterSeconds'] },
] as const satisfies readonly ExactRecordShape[]

function exactRecord(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): ExactRecordSnapshot | null {
  return snapshotExactRecord(value, [{ required, optional }])
}

function isEnum<const Values extends readonly string[]>(value: unknown, values: Values): value is Values[number] {
  return typeof value === 'string' && values.includes(value)
}

function isOpaqueReference(value: unknown): value is string {
  return typeof value === 'string' && value.length <= PARENT_HUB_REQUEST_LIMITS.referenceLength &&
    OPAQUE_REFERENCE.test(value)
}

function isMutationId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= PARENT_HUB_REQUEST_LIMITS.mutationIdLength &&
    OPAQUE_REFERENCE.test(value)
}

function isCursor(value: unknown): value is string {
  return typeof value === 'string' && value.length <= PARENT_HUB_REQUEST_LIMITS.cursorLength &&
    OPAQUE_CURSOR.test(value)
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_TIMESTAMP.test(value)) return false
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.valueOf())) return false
  const canonicalInput = value.includes('.') ? value : value.replace(/Z$/, '.000Z')
  return parsed.toISOString() === canonicalInput
}

function isRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function isBoundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum
}

function parseFailureSnapshot<const Codes extends readonly AdultProductionFailureCode[]>(
  value: ExactRecordSnapshot,
  allowedCodes: Codes,
): AdultProductionFailure<Codes[number]> | null {
  if (value.status !== 'failed' || !isEnum(value.code, allowedCodes) ||
    (value.retryAfterSeconds !== undefined &&
      (value.code !== 'rate-limited' || !isBoundedInteger(value.retryAfterSeconds, 1, 86_400)))) return null
  return value as unknown as AdultProductionFailure<Codes[number]>
}

function parseResult<Success, const Codes extends readonly AdultProductionFailureCode[]>(
  value: unknown,
  successShapes: readonly ExactRecordShape[],
  parseSuccess: (candidate: ExactRecordSnapshot) => Success | null,
  allowedFailureCodes: Codes,
): Success | AdultProductionFailure<Codes[number]> | null {
  const candidate = snapshotExactRecord(value, [...successShapes, ...FAILURE_SHAPES])
  if (!candidate) return null
  return parseSuccess(candidate) ?? parseFailureSnapshot(candidate, allowedFailureCodes)
}

function snapshotArray<Parsed>(
  value: unknown,
  maximumLength: number,
  parseItem: (item: unknown) => Parsed | null,
): readonly Parsed[] | null {
  try {
    if (!Array.isArray(value) || Reflect.getPrototypeOf(value) !== Array.prototype) return null
    const keys = Reflect.ownKeys(value)
    const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length')
    if (!lengthDescriptor || lengthDescriptor.enumerable || !Object.hasOwn(lengthDescriptor, 'value') ||
      !isBoundedInteger(lengthDescriptor.value, 0, maximumLength)) return null

    const length = lengthDescriptor.value as number
    if (keys.length !== length + 1 || !keys.includes('length') ||
      keys.some((key) => typeof key !== 'string' ||
        (key !== 'length' && (!/^\d+$/.test(key) || Number(key) >= length)))) return null

    const snapshot: Parsed[] = []
    for (let index = 0; index < length; index += 1) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index))
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) return null
      const parsed = parseItem(descriptor.value)
      if (parsed === null) return null
      snapshot.push(parsed)
    }
    return Object.freeze(snapshot)
  } catch {
    return null
  }
}

function hasPlausibleSettingsRelationships(value: ExactRecordSnapshot): boolean {
  if (typeof value.breakMinimumMinutes === 'number' && typeof value.breakMaximumMinutes === 'number' &&
    value.breakMinimumMinutes > value.breakMaximumMinutes) return false
  if (typeof value.maximumWorkMinutes === 'number' && typeof value.breakMaximumMinutes === 'number' &&
    value.breakMaximumMinutes > value.maximumWorkMinutes) return false
  return true
}

function isValidSettingValue(key: typeof SETTINGS_KEYS[number], value: unknown): boolean {
  if (key === 'timerMode') return isEnum(value, ['visible', 'hidden', 'count-up', 'count-down'] as const)
  if (key === 'maximumWorkMinutes') return isBoundedInteger(value, 5, 240)
  if (key === 'breakMinimumMinutes') return isBoundedInteger(value, 1, 60)
  if (key === 'breakMaximumMinutes') return isBoundedInteger(value, 1, 120)
  if (key === 'requiredBreaks') return isBoundedInteger(value, 0, 12)
  return typeof value === 'boolean'
}

function hasValidSettingsValues(value: ExactRecordSnapshot): boolean {
  return Object.keys(value).every((key) =>
    SETTINGS_KEYS.includes(key as typeof SETTINGS_KEYS[number]) &&
    isValidSettingValue(key as typeof SETTINGS_KEYS[number], value[key])) &&
    hasPlausibleSettingsRelationships(value)
}

function parseSettings(value: unknown): ParentHubSettings | null {
  const candidate = exactRecord(value, SETTINGS_KEYS)
  if (!candidate || !hasValidSettingsValues(candidate)) return null
  return candidate as unknown as ParentHubSettings
}

function parseSettingsChanges(value: unknown): ParentHubSettingsChanges | null {
  const candidate = exactRecord(value, [], SETTINGS_KEYS)
  if (!candidate || Object.keys(candidate).length === 0 || !hasValidSettingsValues(candidate)) return null
  return candidate as ParentHubSettingsChanges
}

function parseStudentSelector(value: unknown): SettingsReadInput | SafetyReviewListOpenInput | null {
  const candidate = exactRecord(value, ['studentRef'])
  if (!candidate || !isOpaqueReference(candidate.studentRef)) return null
  return candidate as unknown as SettingsReadInput
}

function parseListInput(value: unknown): CalendarListInput | NotificationsListInput | ReviewsListInput | null {
  const candidate = exactRecord(value, ['studentRef'], ['cursor', 'limit'])
  if (!candidate || !isOpaqueReference(candidate.studentRef) ||
    (candidate.cursor !== undefined && !isCursor(candidate.cursor)) ||
    (candidate.limit !== undefined &&
      !isBoundedInteger(candidate.limit, 1, PARENT_HUB_REQUEST_LIMITS.listLimit))) return null
  return candidate as unknown as ReviewsListInput
}

function hasValidMutationBase(value: ExactRecordSnapshot): boolean {
  return isOpaqueReference(value.studentRef) && isRevision(value.expectedRevision) && isMutationId(value.mutationId)
}

export function parseSettingsReadInput(value: unknown): SettingsReadInput | null {
  return parseStudentSelector(value) as SettingsReadInput | null
}

export function parseSettingsApplyInput(value: unknown): SettingsApplyInput | null {
  const candidate = exactRecord(value, [...MUTATION_KEYS, 'changes'])
  if (!candidate || !hasValidMutationBase(candidate)) return null
  const changes = parseSettingsChanges(candidate.changes)
  if (!changes) return null
  return Object.freeze({ ...candidate, changes }) as unknown as SettingsApplyInput
}

export function parseReviewsListInput(value: unknown): ReviewsListInput | null {
  return parseListInput(value) as ReviewsListInput | null
}

export function parseReviewsDecideInput(value: unknown): ReviewsDecideInput | null {
  const candidate = exactRecord(value, [...MUTATION_KEYS, 'reviewRef', 'decision'])
  if (!candidate || !hasValidMutationBase(candidate) || !isOpaqueReference(candidate.reviewRef) ||
    !isEnum(candidate.decision, ['accepted', 'rejected'] as const)) return null
  return candidate as unknown as ReviewsDecideInput
}

export function parseCalendarListInput(value: unknown): CalendarListInput | null {
  return parseListInput(value) as CalendarListInput | null
}

export function parseCalendarPauseInput(value: unknown): CalendarPauseInput | null {
  const candidate = exactRecord(value, [...MUTATION_KEYS, 'blockRef', 'reason'])
  if (!candidate || !hasValidMutationBase(candidate) || !isOpaqueReference(candidate.blockRef) ||
    !isEnum(candidate.reason, [
      'planned-break', 'requested-break', 'outside-interruption', 'technical-interruption',
    ] as const)) return null
  return candidate as unknown as CalendarPauseInput
}

export function parseCalendarCreateContinuationInput(value: unknown): CalendarCreateContinuationInput | null {
  const candidate = exactRecord(value, [
    ...MUTATION_KEYS, 'sourceBlockRef', 'requestedScheduledAt', 'durationMinutes',
  ])
  if (!candidate || !hasValidMutationBase(candidate) || !isOpaqueReference(candidate.sourceBlockRef) ||
    !isTimestamp(candidate.requestedScheduledAt) ||
    !isBoundedInteger(
      candidate.durationMinutes, 1, PARENT_HUB_REQUEST_LIMITS.continuationDurationMinutes,
    )) return null
  return candidate as unknown as CalendarCreateContinuationInput
}

export function parseSafetyReviewListOpenInput(value: unknown): SafetyReviewListOpenInput | null {
  return parseStudentSelector(value) as SafetyReviewListOpenInput | null
}

export function parseSafetyReviewAndClearInput(value: unknown): SafetyReviewAndClearInput | null {
  const candidate = exactRecord(value, [
    'studentRef', 'safetyReviewRef', 'sessionRef', 'blockRef', 'decision', 'reasonCode',
    'expectedSafetyRevision', 'expectedSessionRevision', 'expectedCalendarRevision', 'mutationId',
  ])
  if (!candidate || !isOpaqueReference(candidate.studentRef) ||
    !isOpaqueReference(candidate.safetyReviewRef) || !isOpaqueReference(candidate.sessionRef) ||
    !isOpaqueReference(candidate.blockRef) ||
    !isEnum(candidate.decision, ['resume-approved', 'end-session'] as const) ||
    candidate.reasonCode !== 'adult-safety-review-completed' ||
    !isRevision(candidate.expectedSafetyRevision) || !isRevision(candidate.expectedSessionRevision) ||
    !isRevision(candidate.expectedCalendarRevision) || !isMutationId(candidate.mutationId)) return null
  return candidate as unknown as SafetyReviewAndClearInput
}

export function parseAdultPrivateCommitNoteInput(value: unknown): AdultPrivateCommitNoteInput | null {
  const candidate = exactRecord(value, [...MUTATION_KEYS, 'noteRef', 'category', 'body'])
  if (!candidate || !hasValidMutationBase(candidate) || !isOpaqueReference(candidate.noteRef) ||
    !isEnum(candidate.category, ['instructional', 'accommodation', 'follow-up', 'administrative'] as const) ||
    typeof candidate.body !== 'string' || candidate.body.length > PARENT_HUB_REQUEST_LIMITS.noteBodyLength ||
    candidate.body.trim().length === 0 || candidate.body.includes('\0')) return null
  return candidate as unknown as AdultPrivateCommitNoteInput
}

export function parseNotificationsListInput(value: unknown): NotificationsListInput | null {
  return parseListInput(value) as NotificationsListInput | null
}

export function parseNotificationsMarkReadInput(value: unknown): NotificationsMarkReadInput | null {
  const candidate = exactRecord(value, [...MUTATION_KEYS, 'notificationId'])
  if (!candidate || !hasValidMutationBase(candidate) || !isOpaqueReference(candidate.notificationId)) return null
  return candidate as unknown as NotificationsMarkReadInput
}

export function parseSettingsReadResult(value: unknown): SettingsReadResult | null {
  return parseResult(value, [{ required: ['status', 'settings', 'revision', 'updatedAt'] }], (candidate) => {
    if (candidate.status !== 'settings' || !isRevision(candidate.revision) ||
      !isTimestamp(candidate.updatedAt)) return null
    const parsedSettings = parseSettings(candidate.settings)
    if (!parsedSettings) return null
    return Object.freeze({ ...candidate, settings: parsedSettings }) as unknown as SettingsReadResult
  }, ADULT_READ_FAILURE_CODES)
}

export function parseSettingsApplyResult(value: unknown): SettingsApplyResult | null {
  return parseResult(value, [
    { required: ['status', 'revision', 'appliedAt'] },
    { required: ['status', 'revision'] },
    { required: ['status', 'currentRevision'] },
  ], (candidate) => {
    if (candidate.status === 'applied' && isRevision(candidate.revision) && isTimestamp(candidate.appliedAt)) {
      return candidate as unknown as SettingsApplyResult
    }
    if (candidate.status === 'duplicate-replay' && isRevision(candidate.revision)) {
      return candidate as unknown as SettingsApplyResult
    }
    if (candidate.status === 'stale-revision' && isRevision(candidate.currentRevision)) {
      return candidate as unknown as SettingsApplyResult
    }
    return null
  }, ADULT_MUTATION_FAILURE_CODES)
}

function parseReview(value: unknown): ParentHubReviewSummary | null {
  const candidate = exactRecord(value, [
    'reviewRef', 'studentRef', 'kind', 'dueAt', 'priority', 'state', 'revision',
  ])
  if (!candidate || !isOpaqueReference(candidate.reviewRef) || !isOpaqueReference(candidate.studentRef) ||
    !isEnum(candidate.kind, ['spaced', 'reteach', 'prerequisite', 'manual'] as const) ||
    !isTimestamp(candidate.dueAt) || !isBoundedInteger(candidate.priority, 0, 100) ||
    !isEnum(candidate.state, ['pending', 'decided'] as const) || !isRevision(candidate.revision)) return null
  return candidate as unknown as ParentHubReviewSummary
}

export function parseReviewsListResult(value: unknown): ReviewsListResult | null {
  return parseResult(value, [{ required: ['status', 'reviews'], optional: ['nextCursor'] }], (candidate) => {
    if (candidate.status !== 'listed' ||
      (candidate.nextCursor !== undefined && !isCursor(candidate.nextCursor))) return null
    const reviews = snapshotArray(candidate.reviews, PARENT_HUB_REQUEST_LIMITS.listLimit, parseReview)
    if (!reviews) return null
    return Object.freeze({ ...candidate, reviews }) as unknown as ReviewsListResult
  }, ADULT_READ_FAILURE_CODES)
}

export function parseReviewsDecideResult(value: unknown): ReviewsDecideResult | null {
  return parseResult(value, [
    { required: ['status', 'decision', 'revision', 'decidedAt'] },
    { required: ['status', 'revision'] },
    { required: ['status', 'decision', 'revision'] },
    { required: ['status', 'currentRevision'] },
  ], (candidate) => {
    if (candidate.status === 'decided' && isEnum(candidate.decision, ['accepted', 'rejected'] as const) &&
      isRevision(candidate.revision) && isTimestamp(candidate.decidedAt)) {
      return candidate as unknown as ReviewsDecideResult
    }
    if (candidate.status === 'duplicate-replay' && isRevision(candidate.revision)) {
      return candidate as unknown as ReviewsDecideResult
    }
    if (candidate.status === 'already-decided' &&
      isEnum(candidate.decision, ['accepted', 'rejected'] as const) && isRevision(candidate.revision)) {
      return candidate as unknown as ReviewsDecideResult
    }
    if (candidate.status === 'stale-revision' && isRevision(candidate.currentRevision)) {
      return candidate as unknown as ReviewsDecideResult
    }
    return null
  }, ADULT_MUTATION_FAILURE_CODES)
}

function parseCalendarBlock(value: unknown): ParentHubCalendarSummary | null {
  const candidate = exactRecord(value, [
    'blockRef', 'studentRef', 'category', 'scheduledAt', 'durationMinutes', 'state', 'revision',
  ])
  if (!candidate || !isOpaqueReference(candidate.blockRef) || !isOpaqueReference(candidate.studentRef) ||
    !isEnum(candidate.category, ['lesson', 'review', 'resume', 'break', 'assessment'] as const) ||
    !isTimestamp(candidate.scheduledAt) ||
    !isBoundedInteger(candidate.durationMinutes, 1, PARENT_HUB_REQUEST_LIMITS.continuationDurationMinutes) ||
    !isEnum(candidate.state, [
      'scheduled', 'available', 'in-progress', 'paused', 'completed', 'cancelled',
    ] as const) || !isRevision(candidate.revision)) return null
  return candidate as unknown as ParentHubCalendarSummary
}

export function parseCalendarListResult(value: unknown): CalendarListResult | null {
  return parseResult(value, [{ required: ['status', 'blocks'], optional: ['nextCursor'] }], (candidate) => {
    if (candidate.status !== 'listed' ||
      (candidate.nextCursor !== undefined && !isCursor(candidate.nextCursor))) return null
    const blocks = snapshotArray(candidate.blocks, PARENT_HUB_REQUEST_LIMITS.listLimit, parseCalendarBlock)
    if (!blocks) return null
    return Object.freeze({ ...candidate, blocks }) as unknown as CalendarListResult
  }, ADULT_READ_FAILURE_CODES)
}

function parseCalendarMutationResult(
  value: unknown,
  success: 'paused' | 'continuation-created',
): CalendarPauseResult | CalendarCreateContinuationResult | null {
  const successShape = success === 'paused'
    ? { required: ['status', 'revision', 'pausedAt'] }
    : { required: ['status', 'blockRef', 'revision', 'createdAt'] }
  return parseResult(value, [
    successShape,
    { required: ['status', 'revision'] },
    { required: ['status', 'currentState', 'revision'] },
    { required: ['status', 'currentRevision'] },
  ], (candidate) => {
    if (success === 'paused' && candidate.status === 'paused' &&
      isRevision(candidate.revision) && isTimestamp(candidate.pausedAt)) {
      return candidate as unknown as CalendarPauseResult
    }
    if (success === 'continuation-created' && candidate.status === 'continuation-created' &&
      isOpaqueReference(candidate.blockRef) && isRevision(candidate.revision) && isTimestamp(candidate.createdAt)) {
      return candidate as unknown as CalendarCreateContinuationResult
    }
    if (candidate.status === 'duplicate-replay' && isRevision(candidate.revision)) {
      return candidate as unknown as CalendarPauseResult
    }
    if (candidate.status === 'calendar-state-changed' &&
      isEnum(candidate.currentState, [
        'scheduled', 'available', 'in-progress', 'paused', 'completed', 'cancelled',
      ] as const) && isRevision(candidate.revision)) return candidate as unknown as CalendarPauseResult
    if (candidate.status === 'stale-revision' && isRevision(candidate.currentRevision)) {
      return candidate as unknown as CalendarPauseResult
    }
    return null
  }, ADULT_MUTATION_FAILURE_CODES)
}

export function parseCalendarPauseResult(value: unknown): CalendarPauseResult | null {
  return parseCalendarMutationResult(value, 'paused') as CalendarPauseResult | null
}

export function parseCalendarCreateContinuationResult(value: unknown): CalendarCreateContinuationResult | null {
  return parseCalendarMutationResult(value, 'continuation-created') as CalendarCreateContinuationResult | null
}

function parseSafetyReview(value: unknown): ParentHubSafetyReviewSummary | null {
  const candidate = exactRecord(value, [
    'safetyReviewRef', 'studentRef', 'sessionRef', 'blockRef', 'category', 'urgency', 'heldAt',
    'safetyRevision', 'sessionRevision', 'calendarRevision',
  ])
  if (!candidate || !isOpaqueReference(candidate.safetyReviewRef) ||
    !isOpaqueReference(candidate.studentRef) || !isOpaqueReference(candidate.sessionRef) ||
    !isOpaqueReference(candidate.blockRef) ||
    !isEnum(candidate.category, ['urgent-safety', 'wellbeing'] as const) ||
    !isEnum(candidate.urgency, ['urgent', 'high'] as const) || !isTimestamp(candidate.heldAt) ||
    !isRevision(candidate.safetyRevision) || !isRevision(candidate.sessionRevision) ||
    !isRevision(candidate.calendarRevision)) return null
  return candidate as unknown as ParentHubSafetyReviewSummary
}

export function parseSafetyReviewListOpenResult(value: unknown): SafetyReviewListOpenResult | null {
  return parseResult(value, [{ required: ['status', 'reviews'] }], (candidate) => {
    if (candidate.status !== 'listed') return null
    const reviews = snapshotArray(candidate.reviews, PARENT_HUB_REQUEST_LIMITS.listLimit, parseSafetyReview)
    if (!reviews) return null
    return Object.freeze({ ...candidate, reviews }) as unknown as SafetyReviewListOpenResult
  }, ADULT_READ_FAILURE_CODES)
}

export function parseSafetyReviewAndClearResult(value: unknown): SafetyReviewAndClearResult | null {
  return parseResult(value, [
    {
      required: [
        'status', 'decision', 'safetyRevision', 'sessionRevision', 'calendarRevision', 'reviewedAt', 'clearedAt',
      ],
    },
    { required: ['status', 'safetyRevision', 'sessionRevision', 'calendarRevision'] },
    {
      required: [
        'status', 'currentSafetyRevision', 'currentSessionRevision', 'currentCalendarRevision',
      ],
    },
  ], (candidate) => {
    if (candidate.status === 'cleared' &&
      isEnum(candidate.decision, ['resume-approved', 'end-session'] as const) &&
      isRevision(candidate.safetyRevision) && isRevision(candidate.sessionRevision) &&
      isRevision(candidate.calendarRevision) && isTimestamp(candidate.reviewedAt) &&
      isTimestamp(candidate.clearedAt)) return candidate as unknown as SafetyReviewAndClearResult
    if ((candidate.status === 'duplicate-replay' || candidate.status === 'safety-state-changed') &&
      isRevision(candidate.safetyRevision) && isRevision(candidate.sessionRevision) &&
      isRevision(candidate.calendarRevision)) return candidate as unknown as SafetyReviewAndClearResult
    if (candidate.status === 'stale-revision' && isRevision(candidate.currentSafetyRevision) &&
      isRevision(candidate.currentSessionRevision) && isRevision(candidate.currentCalendarRevision)) {
      return candidate as unknown as SafetyReviewAndClearResult
    }
    return null
  }, ADULT_MUTATION_FAILURE_CODES)
}

export function parseAdultPrivateCommitNoteResult(value: unknown): AdultPrivateCommitNoteResult | null {
  return parseResult(value, [
    { required: ['status', 'noteRef', 'revision', 'committedAt'] },
    { required: ['status', 'revision'] },
    { required: ['status', 'currentRevision'] },
  ], (candidate) => {
    if (candidate.status === 'committed' && isOpaqueReference(candidate.noteRef) &&
      isRevision(candidate.revision) && isTimestamp(candidate.committedAt)) {
      return candidate as unknown as AdultPrivateCommitNoteResult
    }
    if (candidate.status === 'duplicate-replay' && isRevision(candidate.revision)) {
      return candidate as unknown as AdultPrivateCommitNoteResult
    }
    if (candidate.status === 'stale-revision' && isRevision(candidate.currentRevision)) {
      return candidate as unknown as AdultPrivateCommitNoteResult
    }
    return null
  }, ADULT_MUTATION_FAILURE_CODES)
}

function parseNotification(value: unknown): ParentHubNotificationSummary | null {
  const candidate = exactRecord(value, [
    'notificationId', 'studentRef', 'title', 'category', 'urgency', 'createdAt', 'readAt', 'safeActionRef',
  ])
  if (!candidate || !isOpaqueReference(candidate.notificationId) || !isOpaqueReference(candidate.studentRef) ||
    !isEnum(candidate.title, [
      'Review ready', 'Schedule changed', 'Safety review required', 'Settings updated',
    ] as const) || !isEnum(candidate.category, ['review', 'calendar', 'safety', 'settings'] as const) ||
    !isEnum(candidate.urgency, ['routine', 'important', 'urgent'] as const) ||
    !isTimestamp(candidate.createdAt) || (candidate.readAt !== null && !isTimestamp(candidate.readAt)) ||
    (candidate.safeActionRef !== null && !isOpaqueReference(candidate.safeActionRef))) return null
  return candidate as unknown as ParentHubNotificationSummary
}

export function parseNotificationsListResult(value: unknown): NotificationsListResult | null {
  return parseResult(value, [{ required: ['status', 'notifications'], optional: ['nextCursor'] }], (candidate) => {
    if (candidate.status !== 'listed' ||
      (candidate.nextCursor !== undefined && !isCursor(candidate.nextCursor))) return null
    const notifications = snapshotArray(
      candidate.notifications, PARENT_HUB_REQUEST_LIMITS.listLimit, parseNotification,
    )
    if (!notifications) return null
    return Object.freeze({ ...candidate, notifications }) as unknown as NotificationsListResult
  }, ADULT_READ_FAILURE_CODES)
}

export function parseNotificationsMarkReadResult(value: unknown): NotificationsMarkReadResult | null {
  return parseResult(value, [
    { required: ['status', 'revision', 'readAt'] },
    { required: ['status', 'revision'] },
    { required: ['status', 'currentRevision'] },
  ], (candidate) => {
    if (candidate.status === 'marked-read' && isRevision(candidate.revision) && isTimestamp(candidate.readAt)) {
      return candidate as unknown as NotificationsMarkReadResult
    }
    if (candidate.status === 'duplicate-replay' && isRevision(candidate.revision)) {
      return candidate as unknown as NotificationsMarkReadResult
    }
    if (candidate.status === 'stale-revision' && isRevision(candidate.currentRevision)) {
      return candidate as unknown as NotificationsMarkReadResult
    }
    return null
  }, ADULT_MUTATION_FAILURE_CODES)
}
