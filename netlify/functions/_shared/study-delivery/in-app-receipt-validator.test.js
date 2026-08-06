import { describe, expect, it } from 'vitest'
import {
  IN_APP_DELIVERY_RPC_KEYS,
  IN_APP_VERIFY_RPC_KEYS,
  assertExactInAppDeliveryPayload,
  assertExactInAppVerifyBinding,
  validateInAppNotificationReceipt,
} from './in-app-receipt-validator.js'

const IDEMPOTENCY_KEY = `study-safety-delivery:${'a'.repeat(64)}`

const DELIVERY_PAYLOAD = Object.freeze({
  schemaVersion: 2,
  jobId: 'job:synthetic',
  leaseToken: 'lease:synthetic',
  expectedRevision: 7,
  attemptId: 'attempt:synthetic',
  deliveryIdempotencyKey: IDEMPOTENCY_KEY,
  recipientRef: 'recipient:synthetic',
  routeRef: 'in-app-route:synthetic',
  proposalId: 'proposal:synthetic',
  householdId: 'household:synthetic',
  studentId: 'student:synthetic',
  providerName: 'academy-in-app',
  providerConfigVersion: 'in-app-config-v1',
})

const BINDING = Object.freeze({
  providerReceiptRef: 'in-app-receipt:synthetic-notification-1',
  providerName: 'academy-in-app',
  route: 'in-app',
  routeRef: 'in-app-route:synthetic',
  jobId: 'job:synthetic',
  attemptId: 'attempt:synthetic',
  proposalId: 'proposal:synthetic',
  householdId: 'household:synthetic',
  studentId: 'student:synthetic',
  recipientRef: 'recipient:synthetic',
  deliveryIdempotencyKey: IDEMPOTENCY_KEY,
  providerConfigVersion: 'in-app-config-v1',
})

const RECEIPT = Object.freeze({
  ...BINDING,
  verified: true,
  receiptSchemaVersion: 1,
  deliveredAt: '2026-08-01T12:00:00.000Z',
  evidenceRef: 'in-app-evidence:synthetic-visibility-1',
  eventIdempotencyKey: 'receipt-event:synthetic-notification-1',
  receiptSource: 'server-verified',
  testReceipt: false,
})

describe('in-app v2 payload contracts', () => {
  it('matches the exact key sets the v2 RPCs accept', () => {
    expect([...IN_APP_DELIVERY_RPC_KEYS].sort()).toEqual([
      'attemptId', 'deliveryIdempotencyKey', 'expectedRevision', 'householdId',
      'jobId', 'leaseToken', 'proposalId', 'providerConfigVersion',
      'providerName', 'recipientRef', 'routeRef', 'schemaVersion', 'studentId',
    ])
    expect([...IN_APP_VERIFY_RPC_KEYS].sort()).toEqual([
      'attemptId', 'deliveryIdempotencyKey', 'householdId', 'jobId',
      'proposalId', 'providerConfigVersion', 'providerName',
      'providerReceiptRef', 'recipientRef', 'route', 'routeRef', 'studentId',
    ])
    expect(assertExactInAppDeliveryPayload({ ...DELIVERY_PAYLOAD })).toEqual(DELIVERY_PAYLOAD)
    expect(assertExactInAppVerifyBinding({ ...BINDING })).toEqual(BINDING)
  })

  it.each([
    ['worker context', { workerContext: { workerIdentity: 'worker:synthetic' } }],
    ['template code', { templateCode: 'study-safety-adult-review-v1' }],
    ['message body', { messageBody: 'synthetic body' }],
    ['destination', { destination: 'guardian@example.invalid' }],
  ])('refuses a delivery payload carrying an unknown %s field', (_label, extra) => {
    expect(() => assertExactInAppDeliveryPayload({ ...DELIVERY_PAYLOAD, ...extra }))
      .toThrow('in_app_delivery_payload_contract')
  })

  it.each(IN_APP_DELIVERY_RPC_KEYS)('refuses a delivery payload missing %s', (key) => {
    const { [key]: _dropped, ...incomplete } = DELIVERY_PAYLOAD
    expect(() => assertExactInAppDeliveryPayload(incomplete))
      .toThrow('in_app_delivery_payload_contract')
  })

  it.each(IN_APP_VERIFY_RPC_KEYS)('refuses a verification binding missing %s', (key) => {
    const { [key]: _dropped, ...incomplete } = BINDING
    expect(() => assertExactInAppVerifyBinding(incomplete))
      .toThrow('in_app_receipt_binding_contract')
  })

  it.each([
    ['null', null],
    ['array', [DELIVERY_PAYLOAD]],
    ['string', JSON.stringify(DELIVERY_PAYLOAD)],
  ])('refuses a %s payload', (_label, value) => {
    expect(() => assertExactInAppDeliveryPayload(value))
      .toThrow('in_app_delivery_payload_contract')
    expect(() => assertExactInAppVerifyBinding(value))
      .toThrow('in_app_receipt_binding_contract')
  })
})

describe('in-app notification receipt validator', () => {
  it('accepts the receipt for the exact notification that was inserted', () => {
    expect(validateInAppNotificationReceipt({ ...RECEIPT }, BINDING, { environment: 'production' }))
      .toEqual(RECEIPT)
  })

  it('rejects a replayed receipt naming another notification receipt ref', () => {
    expect(() => validateInAppNotificationReceipt(
      { ...RECEIPT, providerReceiptRef: 'in-app-receipt:another-notification' },
      BINDING,
      { environment: 'production' },
    )).toThrow('receipt_binding_mismatch:providerReceiptRef')
  })

  it('rejects a binding with no receipt ref to compare against', () => {
    const { providerReceiptRef: _dropped, ...unbound } = BINDING
    expect(() => validateInAppNotificationReceipt({ ...RECEIPT }, unbound, { environment: 'production' }))
      .toThrow('receipt_binding_mismatch:providerReceiptRef')
  })

  it.each([
    ['proposal', 'proposalId'],
    ['household', 'householdId'],
    ['student', 'studentId'],
    ['job', 'jobId'],
    ['attempt', 'attemptId'],
    ['recipient', 'recipientRef'],
    ['route', 'routeRef'],
    ['delivery idempotency key', 'deliveryIdempotencyKey'],
  ])('rejects a receipt bound to the wrong %s', (_label, key) => {
    const value = key === 'deliveryIdempotencyKey'
      ? `study-safety-delivery:${'b'.repeat(64)}`
      : `${RECEIPT[key]}-other`
    expect(() => validateInAppNotificationReceipt({ ...RECEIPT, [key]: value }, BINDING))
      .toThrow(`receipt_binding_mismatch:${key}`)
  })

  it.each([
    ['unknown result field', { ...RECEIPT, extraField: 'synthetic' }],
    ['missing result field', (({ evidenceRef: _dropped, ...rest }) => rest)(RECEIPT)],
    ['unverified result', { ...RECEIPT, verified: false }],
    ['browser-authored source', { ...RECEIPT, receiptSource: 'browser' }],
  ])('rejects a %s', (_label, value) => {
    expect(() => validateInAppNotificationReceipt(value, BINDING))
      .toThrow('receipt_schema_mismatch')
  })

  it('rejects a test receipt in production', () => {
    expect(() => validateInAppNotificationReceipt(
      { ...RECEIPT, testReceipt: true },
      BINDING,
      { environment: 'production' },
    )).toThrow('test_receipt_forbidden_in_production')
  })
})
