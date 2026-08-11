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

const OPAQUE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/
const OPAQUE_CURSOR = /^[A-Za-z0-9][A-Za-z0-9._~:/+=-]*$/
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/
const SETTINGS_KEYS = [
  'timerMode', 'maximumWorkMinutes', 'breakMinimumMinutes', 'breakMaximumMinutes',
  'requiredBreaks', 'reducedMotion', 'noAudio', 'largeText', 'readAloud', 'speechInputAllowed',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const keys = Object.keys(value)
  return required.every((key) => Object.hasOwn(value, key)) &&
    keys.every((key) => required.includes(key) || optional.includes(key))
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

function parseFailure<const Codes extends readonly AdultProductionFailureCode[]>(
  value: unknown,
  allowedCodes: Codes,
): AdultProductionFailure<Codes[number]> | null {
  if (!isRecord(value) || value.status !== 'failed' ||
    !hasExactKeys(value, ['status', 'code'], ['retryAfterSeconds']) ||
    !isEnum(value.code, allowedCodes) ||
    (value.retryAfterSeconds !== undefined &&
      (value.code !== 'rate-limited' || !isBoundedInteger(value.retryAfterSeconds, 1, 86_400)))) return null
  return value as unknown as AdultProductionFailure<Codes[number]>
}

function parseOrFailure<Success, const Codes extends readonly AdultProductionFailureCode[]>(
  value: unknown,
  parseSuccess: (candidate: unknown) => Success | null,
  allowedFailureCodes: Codes,
): Success | AdultProductionFailure<Codes[number]> | null {
  return parseSuccess(value) ?? parseFailure(value, allowedFailureCodes)
}

function hasPlausibleSettingsRelationships(value: Record<string, unknown>): boolean {
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

function hasValidSettingsValues(value: Record<string, unknown>): boolean {
  return Object.keys(value).every((key) =>
    SETTINGS_KEYS.includes(key as typeof SETTINGS_KEYS[number]) &&
    isValidSettingValue(key as typeof SETTINGS_KEYS[number], value[key])) &&
    hasPlausibleSettingsRelationships(value)
}

function parseSettings(value: unknown): ParentHubSettings | null {
  if (!isRecord(value) || !hasExactKeys(value, SETTINGS_KEYS) || !hasValidSettingsValues(value)) return null
  return value as unknown as ParentHubSettings
}

function parseSettingsChanges(value: unknown): ParentHubSettingsChanges | null {
  if (!isRecord(value) || Object.keys(value).length === 0 || !hasValidSettingsValues(value)) return null
  return value as ParentHubSettingsChanges
}

function parseStudentSelector(value: unknown): SettingsReadInput | SafetyReviewListOpenInput | null {
  if (!isRecord(value) || !hasExactKeys(value, ['studentRef']) || !isOpaqueReference(value.studentRef)) return null
  return value as unknown as SettingsReadInput
}

function parseListInput(value: unknown): CalendarListInput | NotificationsListInput | ReviewsListInput | null {
  if (!isRecord(value) || !hasExactKeys(value, ['studentRef'], ['cursor', 'limit']) ||
    !isOpaqueReference(value.studentRef) || (value.cursor !== undefined && !isCursor(value.cursor)) ||
    (value.limit !== undefined && !isBoundedInteger(value.limit, 1, PARENT_HUB_REQUEST_LIMITS.listLimit))) return null
  return value as unknown as ReviewsListInput
}

function hasValidMutationBase(value: Record<string, unknown>): boolean {
  return isOpaqueReference(value.studentRef) && isRevision(value.expectedRevision) && isMutationId(value.mutationId)
}

export function parseSettingsReadInput(value: unknown): SettingsReadInput | null {
  return parseStudentSelector(value) as SettingsReadInput | null
}

export function parseSettingsApplyInput(value: unknown): SettingsApplyInput | null {
  if (!isRecord(value) || !hasExactKeys(value, ['studentRef', 'expectedRevision', 'mutationId', 'changes']) ||
    !hasValidMutationBase(value) || !parseSettingsChanges(value.changes)) return null
  return value as unknown as SettingsApplyInput
}

export function parseReviewsListInput(value: unknown): ReviewsListInput | null {
  return parseListInput(value) as ReviewsListInput | null
}

export function parseReviewsDecideInput(value: unknown): ReviewsDecideInput | null {
  if (!isRecord(value) || !hasExactKeys(value, ['studentRef', 'expectedRevision', 'mutationId', 'reviewRef', 'decision']) ||
    !hasValidMutationBase(value) || !isOpaqueReference(value.reviewRef) ||
    !isEnum(value.decision, ['accepted', 'rejected'] as const)) return null
  return value as unknown as ReviewsDecideInput
}

export function parseCalendarListInput(value: unknown): CalendarListInput | null {
  return parseListInput(value) as CalendarListInput | null
}

export function parseCalendarPauseInput(value: unknown): CalendarPauseInput | null {
  if (!isRecord(value) ||
    !hasExactKeys(value, ['studentRef', 'expectedRevision', 'mutationId', 'blockRef', 'reason']) ||
    !hasValidMutationBase(value) || !isOpaqueReference(value.blockRef) ||
    !isEnum(value.reason, ['planned-break', 'requested-break', 'outside-interruption', 'technical-interruption'] as const)) return null
  return value as unknown as CalendarPauseInput
}

export function parseCalendarCreateContinuationInput(value: unknown): CalendarCreateContinuationInput | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    'studentRef', 'expectedRevision', 'mutationId', 'sourceBlockRef', 'requestedScheduledAt', 'durationMinutes',
  ]) || !hasValidMutationBase(value) || !isOpaqueReference(value.sourceBlockRef) ||
    !isTimestamp(value.requestedScheduledAt) ||
    !isBoundedInteger(value.durationMinutes, 1, PARENT_HUB_REQUEST_LIMITS.continuationDurationMinutes)) return null
  return value as unknown as CalendarCreateContinuationInput
}

export function parseSafetyReviewListOpenInput(value: unknown): SafetyReviewListOpenInput | null {
  return parseStudentSelector(value) as SafetyReviewListOpenInput | null
}

export function parseSafetyReviewAndClearInput(value: unknown): SafetyReviewAndClearInput | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    'studentRef', 'safetyReviewRef', 'sessionRef', 'blockRef', 'decision', 'reasonCode',
    'expectedSafetyRevision', 'expectedSessionRevision', 'expectedCalendarRevision', 'mutationId',
  ]) || !isOpaqueReference(value.studentRef) || !isOpaqueReference(value.safetyReviewRef) ||
    !isOpaqueReference(value.sessionRef) || !isOpaqueReference(value.blockRef) ||
    !isEnum(value.decision, ['resume-approved', 'end-session'] as const) ||
    value.reasonCode !== 'adult-safety-review-completed' ||
    !isRevision(value.expectedSafetyRevision) || !isRevision(value.expectedSessionRevision) ||
    !isRevision(value.expectedCalendarRevision) || !isMutationId(value.mutationId)) return null
  return value as unknown as SafetyReviewAndClearInput
}

export function parseAdultPrivateCommitNoteInput(value: unknown): AdultPrivateCommitNoteInput | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    'studentRef', 'expectedRevision', 'mutationId', 'noteRef', 'category', 'body',
  ]) || !hasValidMutationBase(value) || !isOpaqueReference(value.noteRef) ||
    !isEnum(value.category, ['instructional', 'accommodation', 'follow-up', 'administrative'] as const) ||
    typeof value.body !== 'string' || value.body.length > PARENT_HUB_REQUEST_LIMITS.noteBodyLength ||
    value.body.trim().length === 0 || value.body.includes('\0')) return null
  return value as unknown as AdultPrivateCommitNoteInput
}

export function parseNotificationsListInput(value: unknown): NotificationsListInput | null {
  return parseListInput(value) as NotificationsListInput | null
}

export function parseNotificationsMarkReadInput(value: unknown): NotificationsMarkReadInput | null {
  if (!isRecord(value) ||
    !hasExactKeys(value, ['studentRef', 'expectedRevision', 'mutationId', 'notificationId']) ||
    !hasValidMutationBase(value) || !isOpaqueReference(value.notificationId)) return null
  return value as unknown as NotificationsMarkReadInput
}

export function parseSettingsReadResult(value: unknown): SettingsReadResult | null {
  return parseOrFailure(value, (candidate) => {
    if (!isRecord(candidate) || candidate.status !== 'settings' ||
      !hasExactKeys(candidate, ['status', 'settings', 'revision', 'updatedAt']) ||
      !parseSettings(candidate.settings) || !isRevision(candidate.revision) || !isTimestamp(candidate.updatedAt)) return null
    return candidate as unknown as SettingsReadResult
  }, ADULT_READ_FAILURE_CODES)
}

export function parseSettingsApplyResult(value: unknown): SettingsApplyResult | null {
  return parseOrFailure(value, (candidate) => {
    if (!isRecord(candidate) || typeof candidate.status !== 'string') return null
    if (candidate.status === 'applied' && hasExactKeys(candidate, ['status', 'revision', 'appliedAt']) &&
      isRevision(candidate.revision) && isTimestamp(candidate.appliedAt)) return candidate as unknown as SettingsApplyResult
    if (candidate.status === 'duplicate-replay' && hasExactKeys(candidate, ['status', 'revision']) &&
      isRevision(candidate.revision)) return candidate as unknown as SettingsApplyResult
    if (candidate.status === 'stale-revision' && hasExactKeys(candidate, ['status', 'currentRevision']) &&
      isRevision(candidate.currentRevision)) return candidate as unknown as SettingsApplyResult
    return null
  }, ADULT_MUTATION_FAILURE_CODES)
}

function parseReview(value: unknown): ParentHubReviewSummary | null {
  if (!isRecord(value) || !hasExactKeys(value, ['reviewRef', 'studentRef', 'kind', 'dueAt', 'priority', 'state', 'revision']) ||
    !isOpaqueReference(value.reviewRef) || !isOpaqueReference(value.studentRef) ||
    !isEnum(value.kind, ['spaced', 'reteach', 'prerequisite', 'manual'] as const) || !isTimestamp(value.dueAt) ||
    !isBoundedInteger(value.priority, 0, 100) || !isEnum(value.state, ['pending', 'decided'] as const) ||
    !isRevision(value.revision)) return null
  return value as unknown as ParentHubReviewSummary
}

export function parseReviewsListResult(value: unknown): ReviewsListResult | null {
  return parseOrFailure(value, (candidate) => {
    if (!isRecord(candidate) || candidate.status !== 'listed' ||
      !hasExactKeys(candidate, ['status', 'reviews'], ['nextCursor']) || !Array.isArray(candidate.reviews) ||
      candidate.reviews.length > PARENT_HUB_REQUEST_LIMITS.listLimit || candidate.reviews.some((review) => !parseReview(review)) ||
      (candidate.nextCursor !== undefined && !isCursor(candidate.nextCursor))) return null
    return candidate as unknown as ReviewsListResult
  }, ADULT_READ_FAILURE_CODES)
}

export function parseReviewsDecideResult(value: unknown): ReviewsDecideResult | null {
  return parseOrFailure(value, (candidate) => {
    if (!isRecord(candidate) || typeof candidate.status !== 'string') return null
    if (candidate.status === 'decided' && hasExactKeys(candidate, ['status', 'decision', 'revision', 'decidedAt']) &&
      isEnum(candidate.decision, ['accepted', 'rejected'] as const) && isRevision(candidate.revision) &&
      isTimestamp(candidate.decidedAt)) return candidate as unknown as ReviewsDecideResult
    if (candidate.status === 'duplicate-replay' && hasExactKeys(candidate, ['status', 'revision']) &&
      isRevision(candidate.revision)) return candidate as unknown as ReviewsDecideResult
    if (candidate.status === 'already-decided' && hasExactKeys(candidate, ['status', 'decision', 'revision']) &&
      isEnum(candidate.decision, ['accepted', 'rejected'] as const) && isRevision(candidate.revision)) return candidate as unknown as ReviewsDecideResult
    if (candidate.status === 'stale-revision' && hasExactKeys(candidate, ['status', 'currentRevision']) &&
      isRevision(candidate.currentRevision)) return candidate as unknown as ReviewsDecideResult
    return null
  }, ADULT_MUTATION_FAILURE_CODES)
}

function parseCalendarBlock(value: unknown): ParentHubCalendarSummary | null {
  if (!isRecord(value) || !hasExactKeys(value, ['blockRef', 'studentRef', 'category', 'scheduledAt', 'durationMinutes', 'state', 'revision']) ||
    !isOpaqueReference(value.blockRef) || !isOpaqueReference(value.studentRef) ||
    !isEnum(value.category, ['lesson', 'review', 'resume', 'break', 'assessment'] as const) || !isTimestamp(value.scheduledAt) ||
    !isBoundedInteger(value.durationMinutes, 1, PARENT_HUB_REQUEST_LIMITS.continuationDurationMinutes) ||
    !isEnum(value.state, ['scheduled', 'available', 'in-progress', 'paused', 'completed', 'cancelled'] as const) ||
    !isRevision(value.revision)) return null
  return value as unknown as ParentHubCalendarSummary
}

export function parseCalendarListResult(value: unknown): CalendarListResult | null {
  return parseOrFailure(value, (candidate) => {
    if (!isRecord(candidate) || candidate.status !== 'listed' ||
      !hasExactKeys(candidate, ['status', 'blocks'], ['nextCursor']) || !Array.isArray(candidate.blocks) ||
      candidate.blocks.length > PARENT_HUB_REQUEST_LIMITS.listLimit || candidate.blocks.some((block) => !parseCalendarBlock(block)) ||
      (candidate.nextCursor !== undefined && !isCursor(candidate.nextCursor))) return null
    return candidate as unknown as CalendarListResult
  }, ADULT_READ_FAILURE_CODES)
}

function parseCalendarConflict(value: unknown): CalendarPauseResult | CalendarCreateContinuationResult | null {
  return parseOrFailure(value, (candidate) => {
    if (!isRecord(candidate) || typeof candidate.status !== 'string') return null
    if (candidate.status === 'duplicate-replay' && hasExactKeys(candidate, ['status', 'revision']) &&
      isRevision(candidate.revision)) return candidate as unknown as CalendarPauseResult
    if (candidate.status === 'calendar-state-changed' && hasExactKeys(candidate, ['status', 'currentState', 'revision']) &&
      isEnum(candidate.currentState, ['scheduled', 'available', 'in-progress', 'paused', 'completed', 'cancelled'] as const) &&
      isRevision(candidate.revision)) return candidate as unknown as CalendarPauseResult
    if (candidate.status === 'stale-revision' && hasExactKeys(candidate, ['status', 'currentRevision']) &&
      isRevision(candidate.currentRevision)) return candidate as unknown as CalendarPauseResult
    return null
  }, ADULT_MUTATION_FAILURE_CODES)
}

export function parseCalendarPauseResult(value: unknown): CalendarPauseResult | null {
  if (isRecord(value) && value.status === 'paused' && hasExactKeys(value, ['status', 'revision', 'pausedAt']) &&
    isRevision(value.revision) && isTimestamp(value.pausedAt)) return value as unknown as CalendarPauseResult
  return parseCalendarConflict(value) as CalendarPauseResult | null
}

export function parseCalendarCreateContinuationResult(value: unknown): CalendarCreateContinuationResult | null {
  if (isRecord(value) && value.status === 'continuation-created' &&
    hasExactKeys(value, ['status', 'blockRef', 'revision', 'createdAt']) && isOpaqueReference(value.blockRef) &&
    isRevision(value.revision) && isTimestamp(value.createdAt)) return value as unknown as CalendarCreateContinuationResult
  return parseCalendarConflict(value) as CalendarCreateContinuationResult | null
}

function parseSafetyReview(value: unknown): ParentHubSafetyReviewSummary | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    'safetyReviewRef', 'studentRef', 'sessionRef', 'blockRef', 'category', 'urgency', 'heldAt',
    'safetyRevision', 'sessionRevision', 'calendarRevision',
  ]) || !isOpaqueReference(value.safetyReviewRef) || !isOpaqueReference(value.studentRef) ||
    !isOpaqueReference(value.sessionRef) || !isOpaqueReference(value.blockRef) ||
    !isEnum(value.category, ['urgent-safety', 'wellbeing'] as const) || !isEnum(value.urgency, ['urgent', 'high'] as const) ||
    !isTimestamp(value.heldAt) || !isRevision(value.safetyRevision) || !isRevision(value.sessionRevision) ||
    !isRevision(value.calendarRevision)) return null
  return value as unknown as ParentHubSafetyReviewSummary
}

export function parseSafetyReviewListOpenResult(value: unknown): SafetyReviewListOpenResult | null {
  return parseOrFailure(value, (candidate) => {
    if (!isRecord(candidate) || candidate.status !== 'listed' || !hasExactKeys(candidate, ['status', 'reviews']) ||
      !Array.isArray(candidate.reviews) || candidate.reviews.length > PARENT_HUB_REQUEST_LIMITS.listLimit ||
      candidate.reviews.some((review) => !parseSafetyReview(review))) return null
    return candidate as unknown as SafetyReviewListOpenResult
  }, ADULT_READ_FAILURE_CODES)
}

export function parseSafetyReviewAndClearResult(value: unknown): SafetyReviewAndClearResult | null {
  return parseOrFailure(value, (candidate) => {
    if (!isRecord(candidate) || typeof candidate.status !== 'string') return null
    if (candidate.status === 'cleared' && hasExactKeys(candidate, [
      'status', 'decision', 'safetyRevision', 'sessionRevision', 'calendarRevision', 'reviewedAt', 'clearedAt',
    ]) && isEnum(candidate.decision, ['resume-approved', 'end-session'] as const) &&
      isRevision(candidate.safetyRevision) && isRevision(candidate.sessionRevision) && isRevision(candidate.calendarRevision) &&
      isTimestamp(candidate.reviewedAt) && isTimestamp(candidate.clearedAt)) return candidate as unknown as SafetyReviewAndClearResult
    if ((candidate.status === 'duplicate-replay' || candidate.status === 'safety-state-changed') &&
      hasExactKeys(candidate, ['status', 'safetyRevision', 'sessionRevision', 'calendarRevision']) &&
      isRevision(candidate.safetyRevision) && isRevision(candidate.sessionRevision) &&
      isRevision(candidate.calendarRevision)) return candidate as unknown as SafetyReviewAndClearResult
    if (candidate.status === 'stale-revision' && hasExactKeys(candidate, [
      'status', 'currentSafetyRevision', 'currentSessionRevision', 'currentCalendarRevision',
    ]) && isRevision(candidate.currentSafetyRevision) && isRevision(candidate.currentSessionRevision) &&
      isRevision(candidate.currentCalendarRevision)) return candidate as unknown as SafetyReviewAndClearResult
    return null
  }, ADULT_MUTATION_FAILURE_CODES)
}

export function parseAdultPrivateCommitNoteResult(value: unknown): AdultPrivateCommitNoteResult | null {
  return parseOrFailure(value, (candidate) => {
    if (!isRecord(candidate) || typeof candidate.status !== 'string') return null
    if (candidate.status === 'committed' && hasExactKeys(candidate, ['status', 'noteRef', 'revision', 'committedAt']) &&
      isOpaqueReference(candidate.noteRef) && isRevision(candidate.revision) &&
      isTimestamp(candidate.committedAt)) return candidate as unknown as AdultPrivateCommitNoteResult
    if (candidate.status === 'duplicate-replay' && hasExactKeys(candidate, ['status', 'revision']) &&
      isRevision(candidate.revision)) return candidate as unknown as AdultPrivateCommitNoteResult
    if (candidate.status === 'stale-revision' && hasExactKeys(candidate, ['status', 'currentRevision']) &&
      isRevision(candidate.currentRevision)) return candidate as unknown as AdultPrivateCommitNoteResult
    return null
  }, ADULT_MUTATION_FAILURE_CODES)
}

function parseNotification(value: unknown): ParentHubNotificationSummary | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    'notificationId', 'studentRef', 'title', 'category', 'urgency', 'createdAt', 'readAt', 'safeActionRef',
  ]) || !isOpaqueReference(value.notificationId) || !isOpaqueReference(value.studentRef) ||
    !isEnum(value.title, ['Review ready', 'Schedule changed', 'Safety review required', 'Settings updated'] as const) ||
    !isEnum(value.category, ['review', 'calendar', 'safety', 'settings'] as const) ||
    !isEnum(value.urgency, ['routine', 'important', 'urgent'] as const) || !isTimestamp(value.createdAt) ||
    (value.readAt !== null && !isTimestamp(value.readAt)) ||
    (value.safeActionRef !== null && !isOpaqueReference(value.safeActionRef))) return null
  return value as unknown as ParentHubNotificationSummary
}

export function parseNotificationsListResult(value: unknown): NotificationsListResult | null {
  return parseOrFailure(value, (candidate) => {
    if (!isRecord(candidate) || candidate.status !== 'listed' ||
      !hasExactKeys(candidate, ['status', 'notifications'], ['nextCursor']) || !Array.isArray(candidate.notifications) ||
      candidate.notifications.length > PARENT_HUB_REQUEST_LIMITS.listLimit ||
      candidate.notifications.some((item) => !parseNotification(item)) ||
      (candidate.nextCursor !== undefined && !isCursor(candidate.nextCursor))) return null
    return candidate as unknown as NotificationsListResult
  }, ADULT_READ_FAILURE_CODES)
}

export function parseNotificationsMarkReadResult(value: unknown): NotificationsMarkReadResult | null {
  return parseOrFailure(value, (candidate) => {
    if (!isRecord(candidate) || typeof candidate.status !== 'string') return null
    if (candidate.status === 'marked-read' && hasExactKeys(candidate, ['status', 'revision', 'readAt']) &&
      isRevision(candidate.revision) && isTimestamp(candidate.readAt)) return candidate as unknown as NotificationsMarkReadResult
    if (candidate.status === 'duplicate-replay' && hasExactKeys(candidate, ['status', 'revision']) &&
      isRevision(candidate.revision)) return candidate as unknown as NotificationsMarkReadResult
    if (candidate.status === 'stale-revision' && hasExactKeys(candidate, ['status', 'currentRevision']) &&
      isRevision(candidate.currentRevision)) return candidate as unknown as NotificationsMarkReadResult
    return null
  }, ADULT_MUTATION_FAILURE_CODES)
}
