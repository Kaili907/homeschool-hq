export const ADULT_REVIEW_RECEIPT_SCHEMA_VERSION = 1

const RECEIPT_KEYS = new Set([
  'verified',
  'receiptSchemaVersion',
  'providerReceiptRef',
  'providerName',
  'route',
  'routeRef',
  'jobId',
  'attemptId',
  'proposalId',
  'householdId',
  'studentId',
  'recipientRef',
  'deliveryIdempotencyKey',
  'providerConfigVersion',
  'deliveredAt',
  'evidenceRef',
  'eventIdempotencyKey',
  'receiptSource',
  'testReceipt',
])

const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/
const DELIVERY_KEY = /^study-safety-delivery:[a-f0-9]{64}$/
const RECIPIENT_REF = /^recipient:[A-Za-z0-9._/-]{1,96}$/

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

function validTimestamp(value) {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
}

export function assertServerReceiptRuntime() {
  if (typeof window !== 'undefined' || typeof document !== 'undefined') {
    throw new Error('browser_authored_receipt_forbidden')
  }
}

/**
 * Validates the complete immutable receipt identity. No value is defaulted:
 * every field must be supplied by a server-owned verifier and must match the
 * attempt/job binding that the durable store has already established.
 */
export function validateVerifiedAdultReviewReceipt(value, binding, options = {}) {
  assertServerReceiptRuntime()
  if (!exactObject(value, RECEIPT_KEYS)) throw new Error('receipt_schema_mismatch')
  if (
    value.verified !== true ||
    value.receiptSchemaVersion !== ADULT_REVIEW_RECEIPT_SCHEMA_VERSION ||
    !validRef(value.providerReceiptRef) ||
    !validRef(value.providerName) ||
    !validRef(value.route) ||
    !validRef(value.routeRef) ||
    !validRef(value.jobId) ||
    !validRef(value.attemptId) ||
    !validRef(value.proposalId) ||
    !validRef(value.householdId) ||
    !validRef(value.studentId) ||
    !RECIPIENT_REF.test(value.recipientRef) ||
    !DELIVERY_KEY.test(value.deliveryIdempotencyKey) ||
    !validRef(value.providerConfigVersion) ||
    !validTimestamp(value.deliveredAt) ||
    !validRef(value.evidenceRef) ||
    !validRef(value.eventIdempotencyKey) ||
    value.receiptSource !== 'server-verified' ||
    typeof value.testReceipt !== 'boolean'
  ) throw new Error('receipt_schema_mismatch')

  if (options.environment === 'production' && value.testReceipt !== false) {
    throw new Error('test_receipt_forbidden_in_production')
  }

  const expected = {
    providerName: binding?.providerName,
    route: binding?.route,
    routeRef: binding?.routeRef,
    jobId: binding?.jobId,
    attemptId: binding?.attemptId,
    proposalId: binding?.proposalId,
    householdId: binding?.householdId,
    studentId: binding?.studentId,
    recipientRef: binding?.recipientRef,
    deliveryIdempotencyKey: binding?.deliveryIdempotencyKey,
    providerConfigVersion: binding?.providerConfigVersion,
  }
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (typeof expectedValue !== 'string' || value[key] !== expectedValue) {
      throw new Error(`receipt_binding_mismatch:${key}`)
    }
  }

  return Object.freeze({ ...value })
}
