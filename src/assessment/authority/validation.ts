import {
  ASSESSMENT_AUTHORITY_SCHEMA_VERSION,
  type AssessmentBrowserRequestDTO,
  type ProtectedAssessmentResponsePayload,
  type StartAssessmentAttemptRequestDTO,
  type SubmitAssessmentAttemptRequestDTO,
} from './types'

export function isAssessmentBrowserRequestDTO(
  value: unknown,
): value is AssessmentBrowserRequestDTO {
  if (!plainRecord(value)) return false
  if (value.action === 'start') return isStartAssessmentAttemptRequestDTO(value)
  if (value.action === 'submit') return isSubmitAssessmentAttemptRequestDTO(value)
  return false
}

export function isStartAssessmentAttemptRequestDTO(
  value: unknown,
): value is StartAssessmentAttemptRequestDTO {
  if (!plainRecord(value) || !hasExactKeys(value, [
    'schemaVersion',
    'action',
    'requestId',
    'idempotencyKey',
    'assignmentRef',
    'expectedRevision',
  ])) return false
  return value.schemaVersion === ASSESSMENT_AUTHORITY_SCHEMA_VERSION &&
    value.action === 'start' &&
    identifier(value.requestId) &&
    identifier(value.idempotencyKey) &&
    identifier(value.assignmentRef) &&
    revision(value.expectedRevision)
}

export function isSubmitAssessmentAttemptRequestDTO(
  value: unknown,
): value is SubmitAssessmentAttemptRequestDTO {
  if (!plainRecord(value) || !hasExactKeys(value, [
    'schemaVersion',
    'action',
    'requestId',
    'idempotencyKey',
    'attemptRef',
    'expectedRevision',
    'response',
  ])) return false
  return value.schemaVersion === ASSESSMENT_AUTHORITY_SCHEMA_VERSION &&
    value.action === 'submit' &&
    identifier(value.requestId) &&
    identifier(value.idempotencyKey) &&
    identifier(value.attemptRef) &&
    revision(value.expectedRevision) &&
    isProtectedAssessmentResponsePayload(value.response, value.attemptRef)
}

export function isProtectedAssessmentResponsePayload(
  value: unknown,
  expectedAttemptRef?: string,
): value is ProtectedAssessmentResponsePayload {
  if (!plainRecord(value) || !hasExactKeys(value, ['schemaVersion', 'attemptRef', 'responses'])) return false
  if (
    value.schemaVersion !== ASSESSMENT_AUTHORITY_SCHEMA_VERSION ||
    !identifier(value.attemptRef) ||
    (expectedAttemptRef !== undefined && value.attemptRef !== expectedAttemptRef) ||
    !Array.isArray(value.responses) ||
    value.responses.length > 500
  ) return false
  const seen = new Set<string>()
  return value.responses.every((response) => {
    if (!plainRecord(response) || !hasExactKeys(response, ['itemRef', 'value', 'skipped', 'activeMs'])) return false
    if (
      !identifier(response.itemRef) ||
      seen.has(response.itemRef) ||
      typeof response.value !== 'string' ||
      response.value.length > 100_000 ||
      typeof response.skipped !== 'boolean' ||
      !Number.isSafeInteger(response.activeMs) ||
      Number(response.activeMs) < 0
    ) return false
    seen.add(response.itemRef)
    return true
  })
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const expectedSet = new Set(expected)
  return Object.keys(value).length === expected.length && Object.keys(value).every((key) => expectedSet.has(key))
}

function identifier(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200
}

function revision(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}
