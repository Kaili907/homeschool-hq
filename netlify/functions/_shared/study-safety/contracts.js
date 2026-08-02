import { assertExactObject, boundedString, reject } from '../http.js'

export const STUDY_SAFETY_SCHEMA_VERSION = 1
export const STUDY_SAFETY_REQUEST_LIMIT_BYTES = 8 * 1024
export const STUDY_SAFETY_TEXT_LIMIT = 4_000
export const STUDY_SAFETY_CLASSIFICATIONS = Object.freeze(['urgent', 'uncertain', 'clear', 'invalid'])
export const STUDY_SAFETY_CATEGORIES = Object.freeze([
  'self-harm-or-immediate-danger',
  'abuse-or-neglect-disclosure',
])
export const STUDY_SAFETY_REASON_CODES = Object.freeze([
  'safety-urgent-self-harm-current-v1',
  'safety-urgent-suicide-intent-current-v1',
  'safety-urgent-suicide-intent-future-v1',
  'safety-urgent-overdose-ingestion-v1',
  'safety-urgent-physical-abuse-v1',
  'safety-urgent-sexual-abuse-v1',
  'safety-urgent-neglect-v1',
  'safety-urgent-food-withholding-v1',
  'safety-urgent-fear-returning-home-v1',
  'safety-urgent-immediate-danger-v1',
  'safety-personal-signal-outranks-context-v1',
  'safety-multiple-categories-v1',
  'safety-uncertain-self-harm-v1',
  'safety-uncertain-danger-v1',
  'safety-uncertain-abuse-neglect-v1',
  'safety-uncertain-unattributed-quotation-v1',
  'safety-uncertain-third-party-disclosure-v1',
  'safety-uncertain-ambiguous-personal-context-v1',
  'safety-clear-academic-context-v1',
  'safety-clear-fiction-context-v1',
  'safety-clear-historical-context-v1',
  'safety-clear-attributed-quotation-v1',
  'safety-clear-third-person-hypothetical-v1',
  'safety-clear-idiom-v1',
  'safety-clear-technical-context-v1',
  'safety-clear-idiom-technical-context-v1',
  'safety-clear-explicit-negation-v1',
  'safety-clear-prompt-injection-only-v1',
  'safety-clear-no-signal-v1',
  'safety-provider-urgent-v1',
  'safety-provider-uncertain-v1',
  'safety-provider-clear-v1',
  'safety-invalid-input-v1',
  'safety-invalid-provider-output-v1',
  'safety-invalid-provider-unavailable-v1',
  'safety-invalid-provider-timeout-v1',
  'safety-invalid-provider-circuit-open-v1',
])
const REASON_CODE_SET = new Set(STUDY_SAFETY_REASON_CODES)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const CODE = /^[a-z0-9][a-z0-9._:-]{0,127}$/

export function validUuid(value) {
  return typeof value === 'string' && UUID.test(value)
}

export function validOpaqueId(value) {
  return typeof value === 'string' && OPAQUE_ID.test(value)
}

export function validCode(value) {
  return typeof value === 'string' && CODE.test(value)
}

export function validateStudySafetyRequest(value) {
  const request = assertExactObject(value, [
    'schemaVersion',
    'requestId',
    'studentRef',
    'sessionId',
    'transientText',
  ])
  if (request.schemaVersion !== STUDY_SAFETY_SCHEMA_VERSION || !validUuid(request.requestId)) {
    reject(400, 'invalid_request')
  }
  const studentRef = assertExactObject(request.studentRef, ['kind', 'value'])
  if (studentRef.kind !== 'academy-student-id' && studentRef.kind !== 'legacy-profile-id') {
    reject(400, 'invalid_request')
  }
  const studentValue = boundedString(studentRef.value, { max: 128, singleLine: true })
  if (studentRef.kind === 'academy-student-id' ? !validUuid(studentValue) : !validOpaqueId(studentValue)) {
    reject(400, 'invalid_request')
  }
  const sessionId = boundedString(request.sessionId, { max: 36, singleLine: true })
  if (!validUuid(sessionId)) reject(400, 'invalid_request')
  // Empty and normalization/length-invalid text reaches the safety service so
  // it can fail closed and create an authenticated minimized review proposal.
  if (typeof request.transientText !== 'string' || request.transientText.length > 6_000) reject(400, 'invalid_request')
  return {
    schemaVersion: STUDY_SAFETY_SCHEMA_VERSION,
    requestId: request.requestId.toLowerCase(),
    studentRef: { kind: studentRef.kind, value: studentValue },
    sessionId,
    transientText: request.transientText,
  }
}

export function validProviderClassification(value, expectedVersion) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value)
  if (keys.length !== 5 || keys.some((key) => ![
    'classificationVersion', 'classifierVersion', 'outcome', 'categories', 'reasonCodes',
  ].includes(key))) return false
  if (
    value.classificationVersion !== 1 ||
    value.classifierVersion !== expectedVersion ||
    !STUDY_SAFETY_CLASSIFICATIONS.includes(value.outcome)
  ) return false
  if (
    !Array.isArray(value.categories) ||
    value.categories.length > 2 ||
    new Set(value.categories).size !== value.categories.length ||
    value.categories.some((item) => !STUDY_SAFETY_CATEGORIES.includes(item))
  ) return false
  if (
    !Array.isArray(value.reasonCodes) ||
    value.reasonCodes.length < 1 ||
    value.reasonCodes.length > 16 ||
    new Set(value.reasonCodes).size !== value.reasonCodes.length ||
    value.reasonCodes.some((item) => !validCode(item) || !REASON_CODE_SET.has(item))
  ) return false
  return value.outcome === 'urgent' || value.outcome === 'uncertain'
    ? value.categories.length > 0
    : value.categories.length === 0
}

export function sanitizeInternalDecision(value) {
  if (!validProviderClassification(value, value?.classifierVersion)) return null
  return Object.freeze({
    classificationVersion: 1,
    classifierVersion: value.classifierVersion,
    outcome: value.outcome,
    categories: Object.freeze([...value.categories]),
    reasonCodes: Object.freeze([...value.reasonCodes]),
  })
}
