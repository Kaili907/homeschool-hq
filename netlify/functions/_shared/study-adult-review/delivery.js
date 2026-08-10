import { createHash } from 'node:crypto'

const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const ATTEMPT_KEYS = new Set([
  'idempotencyKey', 'attemptId', 'recipientRef', 'routeRef', 'templateCode',
])

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')
}

function validateAttempt(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('invalid_delivery_attempt')
  if (Object.keys(input).length !== ATTEMPT_KEYS.size || Object.keys(input).some((key) => !ATTEMPT_KEYS.has(key))) {
    throw new TypeError('invalid_delivery_attempt')
  }
  if (
    // The durable estate keys delivery jobs `'delivery:' || study_sha256_json(...)`.
    !/^delivery:[a-f0-9]{64}$/.test(input.idempotencyKey) ||
    !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(input.attemptId) ||
    !/^recipient:[A-Za-z0-9._/-]{1,96}$/.test(input.recipientRef) ||
    !/^(?:email|in-app|sms)-route:[A-Za-z0-9._/-]{1,96}$/.test(input.routeRef) ||
    input.templateCode !== 'study-safety-adult-review-v1'
  ) throw new TypeError('invalid_delivery_attempt')
  return Object.freeze({ ...input })
}

/** Network-incapable provider used only by tests and local validation. */
export function createTestDeliveryProvider(channel, options = {}) {
  if (!['email', 'in-app'].includes(channel)) throw new TypeError('unsupported_test_channel')
  const deliveries = new Map()
  const receiptRegistry = new Map()
  let calls = 0
  let uniqueDeliveries = 0
  const providerVersion = `test-${channel}-provider-v1`
  const scripted = [...(options.script ?? [])]

  return Object.freeze({
    channel,
    providerVersion,
    isDurable: false,
    isTestProvider: true,
    supportsDurableIdempotency: true,
    isReady: () => true,
    async deliver(untrusted) {
      calls += 1
      const input = validateAttempt(untrusted)
      const payloadDigest = digest({
        idempotencyKey: input.idempotencyKey,
        recipientRef: input.recipientRef,
        routeRef: input.routeRef,
        templateCode: input.templateCode,
      })
      const prior = deliveries.get(input.idempotencyKey)
      if (prior) {
        if (prior.payloadDigest !== payloadDigest) throw new Error('delivery_idempotency_conflict')
        return { state: 'delivered', verified: true, providerReceiptRef: prior.receiptRef }
      }
      const next = scripted.shift() ?? { state: 'delivered' }
      if (next.state === 'temporary-failure') {
        return { state: 'temporary-failure', failureCode: 'provider-temporary-failure', retryAt: next.retryAt ?? new Date(0).toISOString() }
      }
      if (next.state === 'permanent-failure') {
        return { state: 'permanent-failure', failureCode: 'provider-permanent-failure' }
      }
      if (next.state === 'accepted-awaiting-receipt') {
        return { state: 'accepted-awaiting-receipt', providerAcceptanceRef: next.providerAcceptanceRef ?? 'test-acceptance-ref' }
      }
      if (next.state === 'indeterminate') {
        return { state: 'indeterminate', failureCode: 'provider-indeterminate' }
      }
      const receiptRef = `${providerVersion}:receipt:${digest(input).slice(0, 32)}`
      deliveries.set(input.idempotencyKey, { payloadDigest, receiptRef, attemptId: input.attemptId })
      receiptRegistry.set(receiptRef, {
        idempotencyKey: input.idempotencyKey,
        attemptId: input.attemptId,
        recipientRef: input.recipientRef,
        routeRef: input.routeRef,
      })
      uniqueDeliveries += 1
      if (next.state === 'delivered-then-throw') throw new Error('test_response_lost_after_delivery')
      return { state: 'delivered', verified: true, providerReceiptRef: receiptRef }
    },
    async verifyReceipt({ deliveryIdempotencyKey, recipientRef, routeRef, providerReceiptRef }) {
      const evidence = receiptRegistry.get(providerReceiptRef)
      if (
        !evidence ||
        evidence.idempotencyKey !== deliveryIdempotencyKey ||
        evidence.recipientRef !== recipientRef ||
        evidence.routeRef !== routeRef
      ) return { verified: false }
      return {
        verified: true,
        attemptId: evidence.attemptId,
        evidenceRef: `test-evidence:${digest(evidence).slice(0, 32)}`,
      }
    },
    stats: () => ({ calls, uniqueDeliveries }),
  })
}

export const createTestEmailProvider = (options) => createTestDeliveryProvider('email', options)
export const createTestInAppProvider = (options) => createTestDeliveryProvider('in-app', options)
