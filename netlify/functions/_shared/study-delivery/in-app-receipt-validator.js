import { validateVerifiedAdultReviewReceipt } from './receipt-contract.js'

/**
 * Narrow validators for the durable Parent Hub in-app route.
 *
 * `academy_study_deliver_in_app_notification_v2` and
 * `academy_study_verify_in_app_notification_v2` reject any payload whose key
 * set is not exactly the contract below, so the adapter fails closed in-process
 * instead of discovering the mismatch as an opaque hosted error.
 *
 * The receipt validator additionally binds `providerReceiptRef` to the receipt
 * the durable insert produced. The shared receipt contract deliberately leaves
 * that field unbound, so without this check a verifier could return another
 * notification's receipt and it would be promoted as the delivered evidence.
 */

export const IN_APP_DELIVERY_RPC_KEYS = Object.freeze([
  'schemaVersion', 'jobId', 'leaseToken', 'expectedRevision', 'attemptId',
  'deliveryIdempotencyKey', 'recipientRef', 'routeRef', 'proposalId',
  'householdId', 'studentId', 'providerName', 'providerConfigVersion',
])

export const IN_APP_VERIFY_RPC_KEYS = Object.freeze([
  'providerReceiptRef', 'providerName', 'route', 'routeRef', 'jobId',
  'attemptId', 'proposalId', 'householdId', 'studentId', 'recipientRef',
  'deliveryIdempotencyKey', 'providerConfigVersion',
])

function assertExactKeys(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code)
  const actual = Object.keys(value)
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    throw new Error(code)
  }
  return value
}

export function assertExactInAppDeliveryPayload(payload) {
  return assertExactKeys(payload, IN_APP_DELIVERY_RPC_KEYS, 'in_app_delivery_payload_contract')
}

export function assertExactInAppVerifyBinding(binding) {
  return assertExactKeys(binding, IN_APP_VERIFY_RPC_KEYS, 'in_app_receipt_binding_contract')
}

export function validateInAppNotificationReceipt(value, binding, options = {}) {
  const receipt = validateVerifiedAdultReviewReceipt(value, binding, options)
  if (
    typeof binding?.providerReceiptRef !== 'string' ||
    receipt.providerReceiptRef !== binding.providerReceiptRef
  ) throw new Error('receipt_binding_mismatch:providerReceiptRef')

  return receipt
}
