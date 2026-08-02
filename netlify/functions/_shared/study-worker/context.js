export const ADULT_REVIEW_WORKER_SCOPE = 'study:adult-review:delivery'
export const ADULT_REVIEW_WORKER_AUTHORITY_SCHEMA_VERSION = 1

const WORKER_AUTHORITY_KEYS = new Set([
  'verified', 'schemaVersion', 'workerIdentity', 'credentialId', 'credentialVersion',
  'scope', 'expiresAt', 'revoked', 'verifierVersion', 'verificationRef',
])
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/

function validTimestamp(value) {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
}
function exactObject(value, keys) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.size &&
    Object.keys(value).every((key) => keys.has(key)),
  )
}

function validRef(value) {
  return typeof value === 'string' && REF.test(value)
}

export function validateVerifiedWorkerContext(value, options = {}) {
  const at = options.at ?? new Date()
  if (
    !exactObject(value, WORKER_AUTHORITY_KEYS) ||
    value.verified !== true ||
    value.schemaVersion !== ADULT_REVIEW_WORKER_AUTHORITY_SCHEMA_VERSION ||
    !validRef(value.workerIdentity) ||
    !validRef(value.credentialId) ||
    !validRef(value.credentialVersion) ||
    value.scope !== ADULT_REVIEW_WORKER_SCOPE ||
    !validTimestamp(value.expiresAt) ||
    Date.parse(value.expiresAt) <= at.getTime() ||
    value.revoked !== false ||
    !validRef(value.verifierVersion) ||
    !validRef(value.verificationRef)
  ) throw new Error('worker_credential_verification_failed')

  return Object.freeze({ ...value })
}

export function workerContextForRpc(value, options = {}) {
  const verified = validateVerifiedWorkerContext(value, options)
  return Object.freeze({
    schemaVersion: verified.schemaVersion,
    workerIdentity: verified.workerIdentity,
    credentialId: verified.credentialId,
    credentialVersion: verified.credentialVersion,
    scope: verified.scope,
    expiresAt: verified.expiresAt,
    verifierVersion: verified.verifierVersion,
    verificationRef: verified.verificationRef,
  })
}
