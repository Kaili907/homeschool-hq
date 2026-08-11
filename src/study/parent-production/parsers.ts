import {
  ADULT_PRODUCTION_FAILURE_CODES,
  type AdultPrivateCommitNoteResult,
  type AdultProductionFailure,
  type CalendarCreateContinuationResult,
  type CalendarListResult,
  type CalendarPauseResult,
  type NotificationsListResult,
  type NotificationsMarkReadResult,
  type ParentHubCalendarSummary,
  type ParentHubNotificationSummary,
  type ParentHubReviewSummary,
  type ParentHubSafetyReviewSummary,
  type ParentHubSettings,
  type ReviewsDecideResult,
  type ReviewsListResult,
  type SafetyReviewAndClearResult,
  type SafetyReviewListOpenResult,
  type SettingsApplyResult,
  type SettingsReadResult,
} from './contracts'

const OPAQUE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/
const MAX_LIST_ITEMS = 100

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
  return typeof value === 'string' && OPAQUE_REFERENCE.test(value)
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && ISO_TIMESTAMP.test(value) && Number.isFinite(Date.parse(value))
}

function isRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function isBoundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum
}

function parseFailure(value: unknown, excludedCodes: readonly string[] = []): AdultProductionFailure | null {
  if (!isRecord(value) || value.status !== 'failed' ||
    !hasExactKeys(value, ['status', 'code'], ['retryAfterSeconds']) ||
    !isEnum(value.code, ADULT_PRODUCTION_FAILURE_CODES) || excludedCodes.includes(value.code) ||
    (value.retryAfterSeconds !== undefined && !isBoundedInteger(value.retryAfterSeconds, 1, 86_400))) return null
  return value as unknown as AdultProductionFailure
}

function parseOrFailure<Success>(
  value: unknown,
  parseSuccess: (candidate: unknown) => Success | null,
  excludedFailureCodes: readonly string[] = [],
): Success | AdultProductionFailure | null {
  return parseSuccess(value) ?? parseFailure(value, excludedFailureCodes)
}

function parseSettings(value: unknown): ParentHubSettings | null {
  const keys = [
    'timerMode', 'maximumWorkMinutes', 'breakMinimumMinutes', 'breakMaximumMinutes',
    'requiredBreaks', 'reducedMotion', 'noAudio', 'largeText', 'readAloud', 'speechInputAllowed',
  ] as const
  if (!isRecord(value) || !hasExactKeys(value, keys) ||
    !isEnum(value.timerMode, ['visible', 'hidden', 'count-up', 'count-down'] as const) ||
    !isBoundedInteger(value.maximumWorkMinutes, 1, 240) ||
    !isBoundedInteger(value.breakMinimumMinutes, 0, 120) ||
    !isBoundedInteger(value.breakMaximumMinutes, 0, 120) ||
    !isBoundedInteger(value.requiredBreaks, 0, 20) ||
    keys.slice(5).some((key) => typeof value[key] !== 'boolean')) return null
  return value as unknown as ParentHubSettings
}

export function parseSettingsReadResult(value: unknown): SettingsReadResult | null {
  return parseOrFailure(value, (candidate) => {
    if (!isRecord(candidate) || candidate.status !== 'settings' ||
      !hasExactKeys(candidate, ['status', 'settings', 'revision', 'updatedAt']) ||
      !parseSettings(candidate.settings) || !isRevision(candidate.revision) || !isTimestamp(candidate.updatedAt)) return null
    return candidate as unknown as SettingsReadResult
  })
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
  }, ['stale-revision']) as SettingsApplyResult | null
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
      candidate.reviews.length > MAX_LIST_ITEMS || candidate.reviews.some((review) => !parseReview(review)) ||
      (candidate.nextCursor !== undefined && !isOpaqueReference(candidate.nextCursor))) return null
    return candidate as unknown as ReviewsListResult
  })
}

export function parseReviewsDecideResult(value: unknown): ReviewsDecideResult | null {
  return parseOrFailure(value, (candidate) => {
    if (!isRecord(candidate) || typeof candidate.status !== 'string') return null
    if (candidate.status === 'decided' && hasExactKeys(candidate, ['status', 'decision', 'revision', 'decidedAt']) &&
      isEnum(candidate.decision, ['accepted', 'rejected'] as const) && isRevision(candidate.revision) &&
      isTimestamp(candidate.decidedAt)) return candidate as unknown as ReviewsDecideResult
    if (candidate.status === 'duplicate-replay' && hasExactKeys(candidate, ['status', 'revision']) && isRevision(candidate.revision)) return candidate as unknown as ReviewsDecideResult
    if (candidate.status === 'already-decided' && hasExactKeys(candidate, ['status', 'decision', 'revision']) &&
      isEnum(candidate.decision, ['accepted', 'rejected'] as const) && isRevision(candidate.revision)) return candidate as unknown as ReviewsDecideResult
    if (candidate.status === 'stale-revision' && hasExactKeys(candidate, ['status', 'currentRevision']) && isRevision(candidate.currentRevision)) return candidate as unknown as ReviewsDecideResult
    return null
  }, ['already-decided', 'stale-revision']) as ReviewsDecideResult | null
}

function parseCalendarBlock(value: unknown): ParentHubCalendarSummary | null {
  if (!isRecord(value) || !hasExactKeys(value, ['blockRef', 'studentRef', 'category', 'scheduledAt', 'durationMinutes', 'state', 'revision']) ||
    !isOpaqueReference(value.blockRef) || !isOpaqueReference(value.studentRef) ||
    !isEnum(value.category, ['lesson', 'review', 'resume', 'break', 'assessment'] as const) || !isTimestamp(value.scheduledAt) ||
    !isBoundedInteger(value.durationMinutes, 1, 480) ||
    !isEnum(value.state, ['scheduled', 'available', 'in-progress', 'paused', 'completed', 'cancelled'] as const) ||
    !isRevision(value.revision)) return null
  return value as unknown as ParentHubCalendarSummary
}

export function parseCalendarListResult(value: unknown): CalendarListResult | null {
  return parseOrFailure(value, (candidate) => {
    if (!isRecord(candidate) || candidate.status !== 'listed' ||
      !hasExactKeys(candidate, ['status', 'blocks'], ['nextCursor']) || !Array.isArray(candidate.blocks) ||
      candidate.blocks.length > MAX_LIST_ITEMS || candidate.blocks.some((block) => !parseCalendarBlock(block)) ||
      (candidate.nextCursor !== undefined && !isOpaqueReference(candidate.nextCursor))) return null
    return candidate as unknown as CalendarListResult
  })
}

function parseCalendarConflict(value: unknown): CalendarPauseResult | CalendarCreateContinuationResult | null {
  return parseOrFailure(value, (candidate) => {
    if (!isRecord(candidate) || typeof candidate.status !== 'string') return null
    if (candidate.status === 'duplicate-replay' && hasExactKeys(candidate, ['status', 'revision']) && isRevision(candidate.revision)) return candidate as unknown as CalendarPauseResult
    if (candidate.status === 'calendar-state-changed' && hasExactKeys(candidate, ['status', 'currentState', 'revision']) &&
      isEnum(candidate.currentState, ['scheduled', 'available', 'in-progress', 'paused', 'completed', 'cancelled'] as const) &&
      isRevision(candidate.revision)) return candidate as unknown as CalendarPauseResult
    if (candidate.status === 'stale-revision' && hasExactKeys(candidate, ['status', 'currentRevision']) && isRevision(candidate.currentRevision)) return candidate as unknown as CalendarPauseResult
    return null
  }, ['stale-revision']) as CalendarPauseResult | CalendarCreateContinuationResult | null
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
  if (!isRecord(value) || !hasExactKeys(value, ['safetyReviewRef', 'studentRef', 'category', 'urgency', 'heldAt', 'revision']) ||
    !isOpaqueReference(value.safetyReviewRef) || !isOpaqueReference(value.studentRef) ||
    !isEnum(value.category, ['urgent-safety', 'wellbeing'] as const) || !isEnum(value.urgency, ['urgent', 'high'] as const) ||
    !isTimestamp(value.heldAt) || !isRevision(value.revision)) return null
  return value as unknown as ParentHubSafetyReviewSummary
}

export function parseSafetyReviewListOpenResult(value: unknown): SafetyReviewListOpenResult | null {
  return parseOrFailure(value, (candidate) => {
    if (!isRecord(candidate) || candidate.status !== 'listed' || !hasExactKeys(candidate, ['status', 'reviews']) ||
      !Array.isArray(candidate.reviews) || candidate.reviews.length > MAX_LIST_ITEMS ||
      candidate.reviews.some((review) => !parseSafetyReview(review))) return null
    return candidate as unknown as SafetyReviewListOpenResult
  })
}

export function parseSafetyReviewAndClearResult(value: unknown): SafetyReviewAndClearResult | null {
  return parseOrFailure(value, (candidate) => {
    if (!isRecord(candidate) || typeof candidate.status !== 'string') return null
    if (candidate.status === 'cleared' && hasExactKeys(candidate, ['status', 'revision', 'clearedAt']) &&
      isRevision(candidate.revision) && isTimestamp(candidate.clearedAt)) return candidate as unknown as SafetyReviewAndClearResult
    if ((candidate.status === 'duplicate-replay' || candidate.status === 'safety-state-changed') &&
      hasExactKeys(candidate, ['status', 'revision']) && isRevision(candidate.revision)) return candidate as unknown as SafetyReviewAndClearResult
    if (candidate.status === 'stale-revision' && hasExactKeys(candidate, ['status', 'currentRevision']) && isRevision(candidate.currentRevision)) return candidate as unknown as SafetyReviewAndClearResult
    return null
  }, ['safety-state-changed', 'stale-revision']) as SafetyReviewAndClearResult | null
}

export function parseAdultPrivateCommitNoteResult(value: unknown): AdultPrivateCommitNoteResult | null {
  return parseOrFailure(value, (candidate) => {
    if (!isRecord(candidate) || typeof candidate.status !== 'string') return null
    if (candidate.status === 'committed' && hasExactKeys(candidate, ['status', 'noteRef', 'revision', 'committedAt']) &&
      isOpaqueReference(candidate.noteRef) && isRevision(candidate.revision) && isTimestamp(candidate.committedAt)) return candidate as unknown as AdultPrivateCommitNoteResult
    if (candidate.status === 'duplicate-replay' && hasExactKeys(candidate, ['status', 'revision']) && isRevision(candidate.revision)) return candidate as unknown as AdultPrivateCommitNoteResult
    if (candidate.status === 'stale-revision' && hasExactKeys(candidate, ['status', 'currentRevision']) && isRevision(candidate.currentRevision)) return candidate as unknown as AdultPrivateCommitNoteResult
    return null
  }, ['stale-revision']) as AdultPrivateCommitNoteResult | null
}

function parseNotification(value: unknown): ParentHubNotificationSummary | null {
  if (!isRecord(value) || !hasExactKeys(value, ['notificationId', 'studentRef', 'title', 'category', 'urgency', 'createdAt', 'readAt', 'safeActionRef']) ||
    !isOpaqueReference(value.notificationId) || !isOpaqueReference(value.studentRef) ||
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
      candidate.notifications.length > MAX_LIST_ITEMS || candidate.notifications.some((item) => !parseNotification(item)) ||
      (candidate.nextCursor !== undefined && !isOpaqueReference(candidate.nextCursor))) return null
    return candidate as unknown as NotificationsListResult
  })
}

export function parseNotificationsMarkReadResult(value: unknown): NotificationsMarkReadResult | null {
  return parseOrFailure(value, (candidate) => {
    if (!isRecord(candidate) || typeof candidate.status !== 'string') return null
    if (candidate.status === 'marked-read' && hasExactKeys(candidate, ['status', 'revision', 'readAt']) &&
      isRevision(candidate.revision) && isTimestamp(candidate.readAt)) return candidate as unknown as NotificationsMarkReadResult
    if (candidate.status === 'duplicate-replay' && hasExactKeys(candidate, ['status', 'revision']) && isRevision(candidate.revision)) return candidate as unknown as NotificationsMarkReadResult
    if (candidate.status === 'stale-revision' && hasExactKeys(candidate, ['status', 'currentRevision']) && isRevision(candidate.currentRevision)) return candidate as unknown as NotificationsMarkReadResult
    return null
  }, ['stale-revision']) as NotificationsMarkReadResult | null
}
