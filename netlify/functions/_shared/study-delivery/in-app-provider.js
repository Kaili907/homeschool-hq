const PROVIDER_NAME = 'academy-in-app'
const PROVIDER_CONFIG_VERSION = 'in-app-config-v1'
const PROVIDER_VERSION = `${PROVIDER_NAME}:${PROVIDER_CONFIG_VERSION}`
const TEMPLATE_CODE = 'study-safety-adult-review-v1'
const LEARNER_SAFE_TITLE = 'Study check-in needs your review'

const DELIVERY_KEYS = new Set([
  'idempotencyKey', 'jobId', 'attemptId', 'recipientRef', 'routeRef', 'templateCode',
])
const INSERT_KEYS = new Set(['state', 'providerReceiptRef', 'jobId', 'attemptId', 'notification'])
const REVOKED_KEYS = new Set(['state', 'reasonCode'])
const NOTIFICATION_KEYS = new Set(['title', 'reasonCategory', 'urgency', 'actionRef'])
const VERIFY_REQUEST_KEYS = new Set([
  'deliveryIdempotencyKey', 'recipientRef', 'routeRef', 'providerReceiptRef',
])
const VERIFIED_RECEIPT_KEYS = new Set([
  'verified', 'providerReceiptRef', 'jobId', 'attemptId', 'deliveryIdempotencyKey',
  'recipientRef', 'routeRef', 'providerName', 'providerConfigVersion', 'deliveredAt',
  'evidenceRef', 'notification',
])
const UNVERIFIED_RECEIPT_KEYS = new Set(['verified'])
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const IDEMPOTENCY_KEY = /^study-safety-delivery:[a-f0-9]{64}$/
const RECIPIENT_REF = /^recipient:[A-Za-z0-9._/-]{1,96}$/
const ROUTE_REF = /^in-app-route:[A-Za-z0-9._/-]{1,96}$/
const RECEIPT_REF = /^in-app-receipt:[A-Za-z0-9._/-]{1,96}$/
const EVIDENCE_REF = /^in-app-evidence:[A-Za-z0-9._/-]{1,96}$/
const ACTION_REF = /^adult-review:[A-Za-z0-9._/-]{1,96}$/
const REASON_URGENCY = new Map([
  ['immediate-safety', 'urgent'],
  ['possible-safety', 'uncertain'],
  ['review-required', 'review-required'],
])

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

function validateDelivery(value) {
  if (
    !exactObject(value, DELIVERY_KEYS) ||
    !IDEMPOTENCY_KEY.test(value.idempotencyKey) ||
    !validRef(value.jobId) ||
    !validRef(value.attemptId) ||
    !RECIPIENT_REF.test(value.recipientRef) ||
    !ROUTE_REF.test(value.routeRef) ||
    value.templateCode !== TEMPLATE_CODE
  ) throw new TypeError('invalid_in_app_delivery')

  return Object.freeze({ ...value })
}

function validateNotification(value) {
  if (
    !exactObject(value, NOTIFICATION_KEYS) ||
    value.title !== LEARNER_SAFE_TITLE ||
    REASON_URGENCY.get(value.reasonCategory) !== value.urgency ||
    !ACTION_REF.test(value.actionRef)
  ) throw new Error('in_app_persistence_contract')

  return Object.freeze({ ...value })
}

function validateInsertResult(value, input) {
  if (exactObject(value, REVOKED_KEYS)) {
    if (value.state !== 'revoked' || value.reasonCode !== 'recipient-revoked-before-insert') {
      throw new Error('in_app_persistence_contract')
    }
    return Object.freeze({ ...value })
  }

  if (
    !exactObject(value, INSERT_KEYS) ||
    !['delivered', 'already-delivered'].includes(value.state) ||
    !RECEIPT_REF.test(value.providerReceiptRef) ||
    value.jobId !== input.jobId ||
    !validRef(value.attemptId) ||
    (value.state === 'delivered' && value.attemptId !== input.attemptId)
  ) throw new Error('in_app_persistence_contract')

  return Object.freeze({
    ...value,
    notification: validateNotification(value.notification),
  })
}

function validateVerifyRequest(value) {
  if (
    !exactObject(value, VERIFY_REQUEST_KEYS) ||
    !IDEMPOTENCY_KEY.test(value.deliveryIdempotencyKey) ||
    !RECIPIENT_REF.test(value.recipientRef) ||
    !ROUTE_REF.test(value.routeRef) ||
    !RECEIPT_REF.test(value.providerReceiptRef)
  ) throw new TypeError('invalid_in_app_receipt_request')

  return Object.freeze({ ...value })
}

function validateReceipt(value, binding) {
  if (exactObject(value, UNVERIFIED_RECEIPT_KEYS) && value.verified === false) {
    return Object.freeze({ verified: false })
  }

  if (
    !exactObject(value, VERIFIED_RECEIPT_KEYS) ||
    value.verified !== true ||
    value.providerReceiptRef !== binding.providerReceiptRef ||
    value.deliveryIdempotencyKey !== binding.deliveryIdempotencyKey ||
    value.recipientRef !== binding.recipientRef ||
    value.routeRef !== binding.routeRef ||
    value.providerName !== PROVIDER_NAME ||
    value.providerConfigVersion !== PROVIDER_CONFIG_VERSION ||
    !validRef(value.jobId) ||
    !validRef(value.attemptId) ||
    !validTimestamp(value.deliveredAt) ||
    !EVIDENCE_REF.test(value.evidenceRef)
  ) throw new Error('in_app_persistence_contract')

  return Object.freeze({
    ...value,
    notification: validateNotification(value.notification),
  })
}

function requireReady(persistence) {
  if (persistence.isDurable !== true || persistence.isReady?.() !== true) {
    throw new Error('in_app_persistence_not_ready')
  }
}

/**
 * Production server-side adapter for the durable guardian in-app route.
 *
 * The persistence port owns the transaction that reauthorizes the opaque
 * recipient/route, derives the minimized notification from stored proposal
 * metadata, inserts it with a unique idempotency key, and records its audit
 * evidence. It must not accept a destination, contact value, or message body.
 */
export function createDurableInAppProvider({ persistence } = {}) {
  if (
    !persistence ||
    typeof persistence.insertNotification !== 'function' ||
    typeof persistence.verifyNotificationReceipt !== 'function'
  ) throw new TypeError('durable_in_app_persistence_required')

  const isDurable = persistence.isDurable === true

  async function verifyReceipt(untrusted) {
    requireReady(persistence)
    const binding = validateVerifyRequest(untrusted)
    const result = await persistence.verifyNotificationReceipt(binding)
    return validateReceipt(result, binding)
  }

  async function deliver(untrusted) {
    requireReady(persistence)
    const input = validateDelivery(untrusted)
    const insert = validateInsertResult(await persistence.insertNotification(Object.freeze({
      schemaVersion: 1,
      providerName: PROVIDER_NAME,
      providerConfigVersion: PROVIDER_CONFIG_VERSION,
      deliveryIdempotencyKey: input.idempotencyKey,
      jobId: input.jobId,
      attemptId: input.attemptId,
      recipientRef: input.recipientRef,
      routeRef: input.routeRef,
      templateCode: input.templateCode,
    })), input)

    if (insert.state === 'revoked') return insert

    const receipt = await verifyReceipt({
      deliveryIdempotencyKey: input.idempotencyKey,
      recipientRef: input.recipientRef,
      routeRef: input.routeRef,
      providerReceiptRef: insert.providerReceiptRef,
    })
    if (
      receipt.verified !== true ||
      receipt.jobId !== insert.jobId ||
      receipt.attemptId !== insert.attemptId ||
      JSON.stringify(receipt.notification) !== JSON.stringify(insert.notification)
    ) throw new Error('in_app_receipt_not_verified')

    return Object.freeze({
      state: insert.state,
      verified: true,
      providerReceiptRef: receipt.providerReceiptRef,
      jobId: receipt.jobId,
      attemptId: receipt.attemptId,
      deliveredAt: receipt.deliveredAt,
      evidenceRef: receipt.evidenceRef,
      notification: receipt.notification,
    })
  }

  return Object.freeze({
    channel: 'in-app',
    providerName: PROVIDER_NAME,
    providerConfigVersion: PROVIDER_CONFIG_VERSION,
    providerVersion: PROVIDER_VERSION,
    isDurable,
    isTestProvider: false,
    supportsDurableIdempotency: true,
    isReady: () => isDurable && persistence.isReady?.() === true,
    deliver,
    verifyReceipt,
  })
}
