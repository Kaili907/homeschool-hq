import {
  assertServerReceiptRuntime,
  validateVerifiedAdultReviewReceipt,
} from './receipt-contract.js'
import { validateVerifiedWorkerContext } from '../study-worker/context.js'

const PROVIDER_NAME = 'academy-in-app'
const PROVIDER_CONFIG_VERSION = 'in-app-config-v1'
const PROVIDER_VERSION = `${PROVIDER_NAME}:${PROVIDER_CONFIG_VERSION}`
const TEMPLATE_CODE = 'study-safety-adult-review-v1'
const LEARNER_SAFE_TITLE = 'Study check-in needs your review'

const DELIVERY_INPUT_KEYS = new Set([
  'idempotencyKey', 'jobId', 'attemptId', 'proposalId', 'householdId', 'studentId',
  'recipientRef', 'routeRef', 'templateCode',
])
const DELIVERY_REQUEST_KEYS = new Set([
  'delivery', 'recipient', 'workerContext', 'trigger', 'onAttemptSubmitted',
])
const FORBIDDEN_DELIVERY_KEYS = new Set([
  'rawText', 'transcript', 'disclosure', 'email', 'phone', 'destination', 'messageBody',
])
const INSERT_KEYS = new Set([
  'state', 'providerReceiptRef', 'jobId', 'attemptId', 'proposalId', 'householdId',
  'studentId', 'deliveryIdempotencyKey', 'recipientRef', 'routeRef', 'providerName',
  'providerConfigVersion', 'notification',
])
const REVOKED_KEYS = new Set(['state', 'reasonCode'])
const NOTIFICATION_KEYS = new Set(['title', 'reasonCategory', 'urgency', 'actionRef'])
const VERIFY_REQUEST_KEYS = new Set([
  'providerReceiptRef', 'providerName', 'route', 'routeRef', 'jobId', 'attemptId',
  'proposalId', 'householdId', 'studentId', 'recipientRef', 'deliveryIdempotencyKey',
  'providerConfigVersion', 'workerContext',
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

function validateDelivery(value) {
  if (
    !exactObject(value, DELIVERY_INPUT_KEYS) ||
    !IDEMPOTENCY_KEY.test(value.idempotencyKey) ||
    !validRef(value.jobId) ||
    !validRef(value.attemptId) ||
    !validRef(value.proposalId) ||
    !validRef(value.householdId) ||
    !validRef(value.studentId) ||
    !RECIPIENT_REF.test(value.recipientRef) ||
    !ROUTE_REF.test(value.routeRef) ||
    value.templateCode !== TEMPLATE_CODE
  ) throw new TypeError('invalid_in_app_delivery')

  return Object.freeze({ ...value })
}

function validateDeliveryRequest(value) {
  if (
    !exactObject(value, DELIVERY_REQUEST_KEYS) ||
    !value.delivery ||
    !value.recipient ||
    !RECIPIENT_REF.test(value.recipient.recipientRef) ||
    !['scheduled', 'manual'].includes(value.trigger) ||
    typeof value.onAttemptSubmitted !== 'function' ||
    Object.keys(value.delivery).some((key) => FORBIDDEN_DELIVERY_KEYS.has(key))
  ) throw new TypeError('invalid_in_app_delivery_request')
  const workerContext = validateVerifiedWorkerContext(value.workerContext)
  const delivery = validateDelivery({
    idempotencyKey: value.delivery.idempotencyKey ?? value.delivery.deliveryIdempotencyKey,
    jobId: value.delivery.jobId ?? value.delivery.deliveryId,
    attemptId: value.delivery.attemptId,
    proposalId: value.delivery.proposalId,
    householdId: value.delivery.householdId,
    studentId: value.delivery.studentId,
    recipientRef: value.recipient.recipientRef,
    routeRef: value.delivery.routeRef,
    templateCode: value.delivery.templateCode,
  })
  if (value.delivery.recipientRef !== undefined && value.delivery.recipientRef !== delivery.recipientRef) {
    throw new TypeError('invalid_in_app_delivery_request')
  }
  return Object.freeze({
    delivery,
    workerContext,
    trigger: value.trigger,
    onAttemptSubmitted: value.onAttemptSubmitted,
  })
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
    value.proposalId !== input.proposalId ||
    value.householdId !== input.householdId ||
    value.studentId !== input.studentId ||
    value.deliveryIdempotencyKey !== input.idempotencyKey ||
    value.recipientRef !== input.recipientRef ||
    value.routeRef !== input.routeRef ||
    value.providerName !== PROVIDER_NAME ||
    value.providerConfigVersion !== PROVIDER_CONFIG_VERSION ||
    value.attemptId !== input.attemptId
  ) throw new Error('in_app_persistence_contract')

  return Object.freeze({
    ...value,
    notification: validateNotification(value.notification),
  })
}

function validateVerifyRequest(value) {
  if (
    !exactObject(value, VERIFY_REQUEST_KEYS) ||
    value.providerName !== PROVIDER_NAME ||
    value.route !== 'in-app' ||
    value.providerConfigVersion !== PROVIDER_CONFIG_VERSION ||
    !validRef(value.jobId) ||
    !validRef(value.attemptId) ||
    !validRef(value.proposalId) ||
    !validRef(value.householdId) ||
    !validRef(value.studentId) ||
    !IDEMPOTENCY_KEY.test(value.deliveryIdempotencyKey) ||
    !RECIPIENT_REF.test(value.recipientRef) ||
    !ROUTE_REF.test(value.routeRef) ||
    !RECEIPT_REF.test(value.providerReceiptRef)
  ) throw new TypeError('invalid_in_app_receipt_request')

  const workerContext = validateVerifiedWorkerContext(value.workerContext)
  const { workerContext: _ignored, ...binding } = value
  return Object.freeze({ binding: Object.freeze(binding), workerContext })
}

function validateReceipt(value, binding, environment) {
  if (exactObject(value, UNVERIFIED_RECEIPT_KEYS) && value.verified === false) {
    return Object.freeze({ verified: false })
  }
  if (!EVIDENCE_REF.test(value?.evidenceRef) || !RECEIPT_REF.test(value?.providerReceiptRef)) {
    throw new Error('in_app_persistence_contract')
  }
  try {
    return validateVerifiedAdultReviewReceipt(value, binding, { environment })
  } catch (error) {
    if (String(error?.message).startsWith('receipt_binding_mismatch:')) throw error
    throw new Error('in_app_persistence_contract')
  }
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
export function createDurableInAppProvider({
  persistence,
  adultReviewInAppDeliveryPolicy = 'not-approved',
  environment = process.env.NODE_ENV,
} = {}) {
  if (
    !persistence ||
    typeof persistence.insertNotification !== 'function' ||
    typeof persistence.verifyNotificationReceipt !== 'function'
  ) throw new TypeError('durable_in_app_persistence_required')

  const isDurable = persistence.isDurable === true
  const policyApproved = adultReviewInAppDeliveryPolicy === 'approved'

  function requirePolicy() {
    if (!policyApproved) throw new Error('adult_review_in_app_delivery_policy_not_approved')
  }

  async function verifyReceipt(untrusted) {
    assertServerReceiptRuntime()
    requirePolicy()
    requireReady(persistence)
    const request = validateVerifyRequest(untrusted)
    const result = await persistence.verifyNotificationReceipt({
      ...request.binding,
      workerContext: request.workerContext,
    })
    return validateReceipt(result, request.binding, environment)
  }

  async function deliver(untrusted) {
    assertServerReceiptRuntime()
    requirePolicy()
    requireReady(persistence)
    const request = validateDeliveryRequest(untrusted)
    const input = request.delivery
    await request.onAttemptSubmitted({ attemptId: input.attemptId })
    const insert = validateInsertResult(await persistence.insertNotification(Object.freeze({
      schemaVersion: 1,
      workerContext: request.workerContext,
      providerName: PROVIDER_NAME,
      providerConfigVersion: PROVIDER_CONFIG_VERSION,
      deliveryIdempotencyKey: input.idempotencyKey,
      jobId: input.jobId,
      attemptId: input.attemptId,
      proposalId: input.proposalId,
      householdId: input.householdId,
      studentId: input.studentId,
      recipientRef: input.recipientRef,
      routeRef: input.routeRef,
      templateCode: input.templateCode,
    })), input)

    if (insert.state === 'revoked') return insert

    const receipt = await verifyReceipt({
      providerReceiptRef: insert.providerReceiptRef,
      providerName: PROVIDER_NAME,
      route: 'in-app',
      routeRef: input.routeRef,
      jobId: input.jobId,
      attemptId: input.attemptId,
      proposalId: input.proposalId,
      householdId: input.householdId,
      studentId: input.studentId,
      recipientRef: input.recipientRef,
      deliveryIdempotencyKey: input.idempotencyKey,
      providerConfigVersion: PROVIDER_CONFIG_VERSION,
      workerContext: request.workerContext,
    })
    if (
      receipt.verified !== true ||
      receipt.jobId !== insert.jobId ||
      receipt.attemptId !== insert.attemptId
    ) throw new Error('in_app_receipt_not_verified')

    return Object.freeze({
      state: insert.state,
      submitted: true,
      verified: true,
      providerReceiptRef: receipt.providerReceiptRef,
      jobId: receipt.jobId,
      attemptId: receipt.attemptId,
      deliveredAt: receipt.deliveredAt,
      evidenceRef: receipt.evidenceRef,
      notification: insert.notification,
      receipt,
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
    adultReviewInAppDeliveryPolicy: policyApproved ? 'approved' : 'not-approved',
    isReady: () => policyApproved && isDurable && persistence.isReady?.() === true,
    deliver,
    verifyReceipt,
  })
}
