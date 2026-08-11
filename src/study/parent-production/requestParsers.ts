import type {
  AdultPrivateCommitNoteInput,
  CalendarCreateContinuationInput,
  CalendarListInput,
  CalendarPauseInput,
  NotificationsListInput,
  NotificationsMarkReadInput,
  ParentHubListInput,
  ParentHubSettingsChanges,
  ParentHubStudentSelector,
  ReviewsDecideInput,
  ReviewsListInput,
  SafetyReviewAndClearInput,
  SafetyReviewListOpenInput,
  SettingsApplyInput,
  SettingsReadInput,
} from './contracts'

/** Existing production reference envelope used by Parent Hub response parsing. */
export const PARENT_HUB_MAX_REFERENCE_LENGTH = 128
/** Cursors are opaque transport tokens and receive a separate, explicit envelope. */
export const PARENT_HUB_MAX_CURSOR_LENGTH = 256
/** Mutation identifiers use the same bounded opaque-token envelope as references. */
export const PARENT_HUB_MAX_MUTATION_ID_LENGTH = 128
/** Adult-private notes are bounded at ingress and are never truncated or echoed. */
export const PARENT_HUB_MAX_NOTE_BODY_LENGTH = 4_000

const OPAQUE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/
const OPAQUE_CURSOR = /^[A-Za-z0-9][A-Za-z0-9._~:+/=-]*$/
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

function isBoundedToken(value: unknown, maximumLength: number, pattern: RegExp): value is string {
  return typeof value === 'string' && value.length <= maximumLength && pattern.test(value)
}

function isReference(value: unknown): value is string {
  return isBoundedToken(value, PARENT_HUB_MAX_REFERENCE_LENGTH, OPAQUE_TOKEN)
}

function isMutationId(value: unknown): value is string {
  return isBoundedToken(value, PARENT_HUB_MAX_MUTATION_ID_LENGTH, OPAQUE_TOKEN)
}

function isCursor(value: unknown): value is string {
  return isBoundedToken(value, PARENT_HUB_MAX_CURSOR_LENGTH, OPAQUE_CURSOR)
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_TIMESTAMP.test(value)) return false
  const milliseconds = Date.parse(value)
  if (!Number.isFinite(milliseconds)) return false
  const normalized = value.includes('.') ? value : value.replace('Z', '.000Z')
  return new Date(milliseconds).toISOString() === normalized
}

function isRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function isBoundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum
}

function hasStudent(value: Record<string, unknown>): boolean {
  return isReference(value.studentRef)
}

function hasMutation(value: Record<string, unknown>): boolean {
  return hasStudent(value) && isRevision(value.expectedRevision) && isMutationId(value.mutationId)
}

function parseStudentSelector(value: unknown): ParentHubStudentSelector | null {
  if (!isRecord(value) || !hasExactKeys(value, ['studentRef']) || !hasStudent(value)) return null
  return value as unknown as ParentHubStudentSelector
}

function parseListInput(value: unknown): ParentHubListInput | null {
  if (!isRecord(value) || !hasExactKeys(value, ['studentRef'], ['cursor']) || !hasStudent(value) ||
    (value.cursor !== undefined && !isCursor(value.cursor))) return null
  return value as unknown as ParentHubListInput
}

function isSettingsChanges(value: unknown): value is ParentHubSettingsChanges {
  if (!isRecord(value)) return false
  const keys = Object.keys(value)
  if (keys.length === 0 || keys.some((key) => !SETTINGS_KEYS.includes(key as typeof SETTINGS_KEYS[number]))) return false
  if (keys.includes('timerMode') && !isEnum(value.timerMode, ['visible', 'hidden', 'count-up', 'count-down'] as const)) return false
  if (keys.includes('maximumWorkMinutes') && !isBoundedInteger(value.maximumWorkMinutes, 1, 240)) return false
  if (keys.includes('breakMinimumMinutes') && !isBoundedInteger(value.breakMinimumMinutes, 0, 120)) return false
  if (keys.includes('breakMaximumMinutes') && !isBoundedInteger(value.breakMaximumMinutes, 0, 120)) return false
  if (keys.includes('breakMinimumMinutes') && keys.includes('breakMaximumMinutes') &&
    (value.breakMinimumMinutes as number) > (value.breakMaximumMinutes as number)) return false
  if (keys.includes('requiredBreaks') && !isBoundedInteger(value.requiredBreaks, 0, 20)) return false
  if (SETTINGS_KEYS.slice(5).some((key) => keys.includes(key) && typeof value[key] !== 'boolean')) return false
  return true
}

export function parseSettingsReadInput(value: unknown): SettingsReadInput | null {
  return parseStudentSelector(value)
}

export function parseSettingsApplyInput(value: unknown): SettingsApplyInput | null {
  if (!isRecord(value) || !hasExactKeys(value, ['studentRef', 'expectedRevision', 'mutationId', 'changes']) ||
    !hasMutation(value) || !isSettingsChanges(value.changes)) return null
  return value as unknown as SettingsApplyInput
}

export function parseReviewsListInput(value: unknown): ReviewsListInput | null {
  return parseListInput(value)
}

export function parseReviewsDecideInput(value: unknown): ReviewsDecideInput | null {
  if (!isRecord(value) ||
    !hasExactKeys(value, ['studentRef', 'expectedRevision', 'mutationId', 'reviewRef', 'decision']) ||
    !hasMutation(value) || !isReference(value.reviewRef) ||
    !isEnum(value.decision, ['accepted', 'rejected'] as const)) return null
  return value as unknown as ReviewsDecideInput
}

export function parseCalendarListInput(value: unknown): CalendarListInput | null {
  return parseListInput(value)
}

export function parseCalendarPauseInput(value: unknown): CalendarPauseInput | null {
  if (!isRecord(value) ||
    !hasExactKeys(value, ['studentRef', 'expectedRevision', 'mutationId', 'blockRef', 'reason']) ||
    !hasMutation(value) || !isReference(value.blockRef) ||
    !isEnum(value.reason, ['planned-break', 'requested-break', 'outside-interruption', 'technical-interruption'] as const)) return null
  return value as unknown as CalendarPauseInput
}

export function parseCalendarCreateContinuationInput(value: unknown): CalendarCreateContinuationInput | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    'studentRef', 'expectedRevision', 'mutationId', 'sourceBlockRef', 'scheduledAt', 'durationMinutes',
  ]) || !hasMutation(value) || !isReference(value.sourceBlockRef) || !isTimestamp(value.scheduledAt) ||
    !isBoundedInteger(value.durationMinutes, 1, 480)) return null
  return value as unknown as CalendarCreateContinuationInput
}

export function parseSafetyReviewListOpenInput(value: unknown): SafetyReviewListOpenInput | null {
  return parseStudentSelector(value)
}

export function parseSafetyReviewAndClearInput(value: unknown): SafetyReviewAndClearInput | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    'studentRef', 'safetyReviewRef', 'proposalRevision', 'sessionRevision', 'calendarRevision',
    'mutationId', 'decision', 'reasonCode',
  ]) || !hasStudent(value) || !isReference(value.safetyReviewRef) || !isMutationId(value.mutationId) ||
    !isRevision(value.proposalRevision) || !isRevision(value.sessionRevision) || !isRevision(value.calendarRevision)) return null
  const validResolution =
    (value.decision === 'resume-approved' && value.reasonCode === 'adult-reviewed-resume-approved') ||
    (value.decision === 'end-session' && value.reasonCode === 'adult-reviewed-end-session')
  return validResolution ? value as unknown as SafetyReviewAndClearInput : null
}

export function parseAdultPrivateCommitNoteInput(value: unknown): AdultPrivateCommitNoteInput | null {
  if (!isRecord(value) ||
    !hasExactKeys(value, ['studentRef', 'expectedRevision', 'mutationId', 'noteRef', 'category', 'body']) ||
    !hasMutation(value) || !isReference(value.noteRef) ||
    !isEnum(value.category, ['instructional', 'accommodation', 'follow-up', 'administrative'] as const) ||
    typeof value.body !== 'string' || value.body.trim().length === 0 ||
    value.body.length > PARENT_HUB_MAX_NOTE_BODY_LENGTH) return null
  return value as unknown as AdultPrivateCommitNoteInput
}

export function parseNotificationsListInput(value: unknown): NotificationsListInput | null {
  return parseListInput(value)
}

export function parseNotificationsMarkReadInput(value: unknown): NotificationsMarkReadInput | null {
  if (!isRecord(value) ||
    !hasExactKeys(value, ['studentRef', 'expectedRevision', 'mutationId', 'notificationId']) ||
    !hasMutation(value) || !isReference(value.notificationId)) return null
  return value as unknown as NotificationsMarkReadInput
}
