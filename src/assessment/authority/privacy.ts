import {
  ASSESSMENT_AUTHORITY_SCHEMA_VERSION,
  type AssessmentAttemptRecord,
  type AssessmentAttemptStatus,
  type AssessmentOutcomeCategory,
  type AssessmentScoreBand,
} from './types'

export type AssessmentDurationClass =
  | 'not-available'
  | 'under-15-minutes'
  | '15-to-44-minutes'
  | '45-minutes-or-more'

/** PRIVACY-MINIMIZED OPERATIONAL OUTCOME DTO — contains no response content. */
export interface AssessmentOperationalOutcomeDTO {
  readonly schemaVersion: typeof ASSESSMENT_AUTHORITY_SCHEMA_VERSION
  readonly attemptRef: string
  readonly status: AssessmentAttemptStatus
  readonly retake: boolean
  readonly durationClass: AssessmentDurationClass
  readonly scoreBand: AssessmentScoreBand | null
  readonly outcomeCategory: AssessmentOutcomeCategory | null
}

export function toAssessmentOperationalOutcome(
  attempt: AssessmentAttemptRecord,
): AssessmentOperationalOutcomeDTO {
  return Object.freeze({
    schemaVersion: ASSESSMENT_AUTHORITY_SCHEMA_VERSION,
    attemptRef: attempt.attemptRef,
    status: attempt.status,
    retake: attempt.lineage.attemptOrdinal > 1,
    durationClass: durationClass(attempt),
    scoreBand: attempt.result?.score?.approvedBand ?? null,
    outcomeCategory: attempt.result?.outcomeCategory ?? null,
  })
}

export function isAssessmentOperationalOutcomeDTO(
  value: unknown,
): value is AssessmentOperationalOutcomeDTO {
  if (!plainRecord(value) || !hasExactKeys(value, [
    'schemaVersion',
    'attemptRef',
    'status',
    'retake',
    'durationClass',
    'scoreBand',
    'outcomeCategory',
  ])) return false
  return value.schemaVersion === ASSESSMENT_AUTHORITY_SCHEMA_VERSION &&
    identifier(value.attemptRef) &&
    ['assigned', 'started', 'submitted', 'scoring_pending', 'completed'].includes(String(value.status)) &&
    typeof value.retake === 'boolean' &&
    ['not-available', 'under-15-minutes', '15-to-44-minutes', '45-minutes-or-more'].includes(String(value.durationClass)) &&
    (value.scoreBand === null || [
      'below-expectations',
      'approaching-expectations',
      'meets-expectations',
      'exceeds-expectations',
    ].includes(String(value.scoreBand))) &&
    (value.outcomeCategory === null || [
      'graded',
      'ungraded',
      'needs-follow-up',
      'incomplete',
    ].includes(String(value.outcomeCategory)))
}

function durationClass(attempt: AssessmentAttemptRecord): AssessmentDurationClass {
  if (attempt.startedAt === null || attempt.submittedAt === null) return 'not-available'
  const elapsed = Date.parse(attempt.submittedAt) - Date.parse(attempt.startedAt)
  if (!Number.isFinite(elapsed) || elapsed < 0) return 'not-available'
  if (elapsed < 15 * 60_000) return 'under-15-minutes'
  if (elapsed < 45 * 60_000) return '15-to-44-minutes'
  return '45-minutes-or-more'
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index])
}

function identifier(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200
}
