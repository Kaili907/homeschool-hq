import { createHash } from 'node:crypto'

export const STUDY_IDENTITY_SCHEMA_VERSION = 1
export const STUDY_SESSION_ISSUER_VERSION = 'academy-student-session-issuer.v1'
export const STUDY_SESSION_REFERENCE = /^aca_stu_v1_[A-Za-z0-9_-]{43}$/
export const STUDY_SESSION_HEADER = 'x-study-session'
export const STUDY_SESSION_CAPABILITIES = Object.freeze([
  'student:assignments:read',
  'student:attempts:create',
  'student:progress:read',
])

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const NON_PRODUCTION_ID = /(?:^|[._:/-])(sentinel|demo|preview|fixture|synthetic|test|local-release-candidate)(?:$|[._:/-])/i
const CAPABILITIES = new Set(STUDY_SESSION_CAPABILITIES)
const MAX_AUTHORIZATION_LENGTH = 128
const ISSUED_KEYS = new Set([
  'schemaVersion', 'status', 'sessionReference', 'grantId', 'studentId',
  'learnerSessionId', 'sessionEpoch', 'authorizationRevision', 'issuedAt',
  'expiresAt', 'contractVersion', 'issuerVersion', 'scope',
])
const VERIFIED_KEYS = new Set([
  'schemaVersion', 'status', 'grantId', 'householdId', 'studentId',
  'learnerSessionId', 'sessionEpoch', 'sessionVersion',
  'authorizationRevision', 'issuedAt', 'expiresAt', 'contractVersion',
  'issuerVersion', 'scope',
])
const ISSUED_ENVELOPE_KEYS = new Set([
  'schemaVersion', 'status', 'sessionReference', 'expiresAt',
])

function hasExactKeys(value, expected) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === expected.size &&
    Object.keys(value).every((key) => expected.has(key))
}

export function validUuid(value) {
  return typeof value === 'string' && UUID.test(value)
}

export function validOpaqueId(value) {
  return typeof value === 'string' && OPAQUE_ID.test(value)
}

export function validProductionSelectorValue(value) {
  return validOpaqueId(value) && !NON_PRODUCTION_ID.test(value)
}

export function validCapability(value) {
  return typeof value === 'string' && CAPABILITIES.has(value)
}

function singleHeaderValue(event, name) {
  const headerEntries = event?.headers && typeof event.headers === 'object'
    ? Object.entries(event.headers).filter(([key]) => key.toLowerCase() === name)
    : []
  if (headerEntries.length !== 1 || typeof headerEntries[0][1] !== 'string') return null

  let value = headerEntries[0][1]
  const multiEntries = event?.multiValueHeaders && typeof event.multiValueHeaders === 'object'
    ? Object.entries(event.multiValueHeaders).filter(([key]) => key.toLowerCase() === name)
    : []
  if (multiEntries.length > 1) return null
  if (multiEntries.length === 1) {
    const values = multiEntries[0][1]
    if (!Array.isArray(values) || values.length !== 1 || values[0] !== value) return null
    value = values[0]
  }

  return value.length > MAX_AUTHORIZATION_LENGTH ? null : value
}

export function readStudySessionBearer(event) {
  const authorization = singleHeaderValue(event, 'authorization')
  if (authorization === null) return null
  const match = /^Bearer ([^\s,]+)$/i.exec(authorization)
  return match && STUDY_SESSION_REFERENCE.test(match[1]) ? match[1] : null
}

/**
 * Routes that already carry an adult bearer in `authorization` receive the
 * learner's opaque Study-session reference in its own header instead.
 */
export function readStudySessionReferenceHeader(event) {
  const value = singleHeaderValue(event, STUDY_SESSION_HEADER)
  return value !== null && STUDY_SESSION_REFERENCE.test(value) ? value : null
}

export function digestStudySessionReference(sessionReference) {
  if (!STUDY_SESSION_REFERENCE.test(sessionReference)) return null
  return createHash('sha256').update(sessionReference, 'ascii').digest('hex')
}

export function isIssuedGrant(value) {
  return hasExactKeys(value, ISSUED_KEYS) &&
    value?.schemaVersion === STUDY_IDENTITY_SCHEMA_VERSION &&
    value?.status === 'issued' &&
    STUDY_SESSION_REFERENCE.test(value?.sessionReference ?? '') &&
    validUuid(value?.grantId) &&
    validUuid(value?.studentId) &&
    validUuid(value?.learnerSessionId) &&
    value?.learnerSessionId === value?.sessionEpoch &&
    Number.isSafeInteger(value?.authorizationRevision) &&
    value.authorizationRevision > 0 &&
    Number.isFinite(Date.parse(value?.issuedAt)) &&
    Number.isFinite(Date.parse(value?.expiresAt)) &&
    Date.parse(value.expiresAt) > Date.parse(value.issuedAt) &&
    value?.contractVersion === 1 &&
    value?.issuerVersion === STUDY_SESSION_ISSUER_VERSION &&
    Array.isArray(value?.scope) &&
    value.scope.length === STUDY_SESSION_CAPABILITIES.length &&
    STUDY_SESSION_CAPABILITIES.every((capability) => value.scope.includes(capability))
}

export function isVerifiedGrant(value) {
  return hasExactKeys(value, VERIFIED_KEYS) &&
    value?.schemaVersion === STUDY_IDENTITY_SCHEMA_VERSION &&
    value?.status === 'verified' &&
    validUuid(value?.grantId) &&
    validUuid(value?.householdId) &&
    validUuid(value?.studentId) &&
    validUuid(value?.learnerSessionId) &&
    value?.learnerSessionId === value?.sessionEpoch &&
    Number.isSafeInteger(value?.sessionVersion) &&
    value.sessionVersion > 0 &&
    Number.isSafeInteger(value?.authorizationRevision) &&
    value.authorizationRevision > 0 &&
    Number.isFinite(Date.parse(value?.issuedAt)) &&
    Number.isFinite(Date.parse(value?.expiresAt)) &&
    Date.parse(value.expiresAt) > Date.parse(value.issuedAt) &&
    value?.contractVersion === 1 &&
    value?.issuerVersion === STUDY_SESSION_ISSUER_VERSION &&
    Array.isArray(value?.scope) &&
    value.scope.length > 0 &&
    new Set(value.scope).size === value.scope.length &&
    value.scope.every(validCapability)
}

export function isIssuedGrantEnvelope(value) {
  return hasExactKeys(value, ISSUED_ENVELOPE_KEYS) &&
    value?.schemaVersion === STUDY_IDENTITY_SCHEMA_VERSION &&
    value?.status === 'issued' &&
    STUDY_SESSION_REFERENCE.test(value?.sessionReference ?? '') &&
    Number.isFinite(Date.parse(value?.expiresAt))
}

/** Browser projection: no household, learner, grant, scope, revision, or epoch authority. */
export function issuedGrantEnvelope(value) {
  if (!isIssuedGrant(value)) return null
  return Object.freeze({
    schemaVersion: STUDY_IDENTITY_SCHEMA_VERSION,
    status: 'issued',
    sessionReference: value.sessionReference,
    expiresAt: value.expiresAt,
  })
}

/** Browser verification proves only that the opaque closure may continue. */
export function verifiedGrantEnvelope(value) {
  if (!isVerifiedGrant(value)) return null
  return Object.freeze({
    schemaVersion: STUDY_IDENTITY_SCHEMA_VERSION,
    status: 'verified',
    expiresAt: value.expiresAt,
  })
}
