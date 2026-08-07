import { describe, expect, it, vi } from 'vitest'
import { createDurableInAppProvider } from './in-app-provider.js'
import { validateVerifiedAdultReviewReceipt } from './receipt-contract.js'
import { createAdultReviewWorker } from '../study-adult-review-operations/worker.js'

/**
 * The durable SQL estate is authoritative for Study delivery identifiers.
 *
 * `academy_study_adult_review_delivery_jobs.delivery_idempotency_key` is built
 * as `'delivery:' || academy_private.study_sha256_json(...)` and
 * `study_adult_notification_routes.route_ref` is constrained to
 * `^route:[0-9a-f]{64}$`. Every server boundary that reads a claim, delivers it,
 * or validates its receipt must accept exactly those forms — nothing wider, and
 * no legacy synthetic namespace.
 */

const DIGEST = 'a'.repeat(64)
const OTHER_DIGEST = 'b'.repeat(64)
const DELIVERY_KEY = `delivery:${DIGEST}`
const ROUTE_REF = `route:${OTHER_DIGEST}`
const NOW = new Date('2026-08-01T12:00:00.000Z')

const AUTHORITY = Object.freeze({
  verified: true,
  schemaVersion: 1,
  workerIdentity: 'worker:synthetic',
  credentialId: 'worker-credential:synthetic',
  credentialVersion: 'worker-credential-v2',
  scope: 'study:adult-review:delivery',
  expiresAt: '2099-08-01T12:05:00.000Z',
  revoked: false,
  verifierVersion: 'worker-verifier-v1',
  verificationRef: 'worker-verification:synthetic',
})

const CLAIM = Object.freeze({
  claimId: 'claim:1',
  jobId: 'job:1',
  proposalId: 'proposal:1',
  householdId: 'household:1',
  studentId: 'student:1',
  recipientRef: 'recipient:1',
  routeRef: ROUTE_REF,
  idempotencyKey: DELIVERY_KEY,
  templateCode: 'study-safety-adult-review-v1',
  attemptId: 'attempt:1',
  leaseToken: 'lease:1',
  leaseRevision: 3,
  leaseExpiresAt: '2026-08-01T12:01:00.000Z',
})

const BINDING = Object.freeze({
  providerReceiptRef: 'in-app-receipt:1',
  providerName: 'academy-in-app',
  route: 'in-app',
  routeRef: ROUTE_REF,
  jobId: CLAIM.jobId,
  attemptId: CLAIM.attemptId,
  proposalId: CLAIM.proposalId,
  householdId: CLAIM.householdId,
  studentId: CLAIM.studentId,
  recipientRef: CLAIM.recipientRef,
  deliveryIdempotencyKey: DELIVERY_KEY,
  providerConfigVersion: 'in-app-config-v1',
})

const RECEIPT = Object.freeze({
  ...BINDING,
  verified: true,
  receiptSchemaVersion: 1,
  deliveredAt: '2026-08-01T12:00:10.000Z',
  evidenceRef: 'in-app-evidence:1',
  eventIdempotencyKey: 'receipt-event:1',
  receiptSource: 'server-verified',
  testReceipt: false,
})

/**
 * Identifier shapes that must never be accepted for a durable delivery key or
 * route ref. `hostile object` and `array` exist because `RegExp#test` coerces
 * its argument, so a pattern check alone would admit a non-string carrier.
 */
function rejectedForms(prefix) {
  const canonical = `${prefix}:${DIGEST}`
  return [
    ['legacy synthetic namespace', prefix === 'delivery'
      ? `study-safety-delivery:${DIGEST}`
      : `in-app-route:${DIGEST}`],
    ['wrong prefix', `notdelivery:${DIGEST}`],
    ['prefix substring', `x${canonical}`],
    ['no prefix', DIGEST],
    ['empty digest', `${prefix}:`],
    ['uppercase digest', `${prefix}:${'A'.repeat(64)}`],
    ['mixed-case digest', `${prefix}:${'A' + DIGEST.slice(1)}`],
    ['short digest', `${prefix}:${'a'.repeat(63)}`],
    ['long digest', `${prefix}:${'a'.repeat(65)}`],
    ['non-hex digest', `${prefix}:${'g'.repeat(64)}`],
    ['extra suffix', `${canonical}:extra`],
    ['trailing newline', `${canonical}\n`],
    ['leading whitespace', ` ${canonical}`],
    ['hostile object', { toString: () => canonical }],
    ['hostile valueOf', { valueOf: () => canonical, toString: () => canonical }],
    ['array carrier', [canonical]],
    ['null', null],
    ['undefined', undefined],
    ['number', 1],
  ]
}

function readyPort(extra = {}) {
  return { isReady: () => true, ...extra }
}

function leaseProof(overrides = {}) {
  return {
    active: true,
    claimId: CLAIM.claimId,
    jobId: CLAIM.jobId,
    leaseToken: CLAIM.leaseToken,
    leaseRevision: CLAIM.leaseRevision,
    leaseExpiresAt: CLAIM.leaseExpiresAt,
    ...overrides,
  }
}

function attemptProof(overrides = {}) {
  return {
    current: true,
    attemptId: CLAIM.attemptId,
    jobId: CLAIM.jobId,
    leaseToken: CLAIM.leaseToken,
    deliveryIdempotencyKey: DELIVERY_KEY,
    providerName: 'academy-in-app',
    providerConfigVersion: 'in-app-config-v1',
    ...overrides,
  }
}

function workerFixture() {
  const persistence = readyPort({
    claim: vi.fn(async () => [CLAIM]),
    cancel: vi.fn(async () => undefined),
    validateLease: vi.fn(async () => leaseProof()),
    renewLease: vi.fn(async () => leaseProof()),
    releaseLease: vi.fn(async () => undefined),
    recordAttemptSubmitted: vi.fn(async () => attemptProof()),
    validateCurrentAttempt: vi.fn(async () => attemptProof()),
    commitReceipt: vi.fn(async () => ({
      committed: true,
      replayed: false,
      receiptId: RECEIPT.providerReceiptRef,
      eventIdempotencyKey: RECEIPT.eventIdempotencyKey,
      attemptId: RECEIPT.attemptId,
      jobId: RECEIPT.jobId,
    })),
    markIndeterminate: vi.fn(async () => undefined),
  })
  const provider = readyPort({
    channel: 'in-app',
    providerName: 'academy-in-app',
    providerConfigVersion: 'in-app-config-v1',
    adultReviewInAppDeliveryPolicy: 'approved',
    isDurable: true,
    isTestProvider: false,
    deliver: vi.fn(async ({ onAttemptSubmitted }) => {
      await onAttemptSubmitted({ attemptId: CLAIM.attemptId })
      return { submitted: true, attemptId: CLAIM.attemptId, receipt: RECEIPT }
    }),
  })
  const worker = createAdultReviewWorker({
    persistence,
    resolver: readyPort({
      resolve: vi.fn(async () => ({ recipient: { recipientRef: CLAIM.recipientRef } })),
    }),
    provider,
    monitor: readyPort({ record: vi.fn(async () => undefined) }),
    schema: readyPort({ safeParse: (value) => ({ success: true, data: value }) }),
    workerCredentialVerifier: readyPort({ isDurable: true, verify: vi.fn(async () => AUTHORITY) }),
    workerCredentialVersion: AUTHORITY.credentialVersion,
    now: () => new Date(NOW),
    environment: 'production',
  })
  return { worker, persistence, provider }
}

function processClaim(worker, patch = {}) {
  return worker.processClaim({ ...CLAIM, ...patch }, { trigger: 'scheduled' }, AUTHORITY)
}

const PROVIDER_DELIVERY = Object.freeze({
  idempotencyKey: DELIVERY_KEY,
  jobId: CLAIM.jobId,
  attemptId: CLAIM.attemptId,
  proposalId: CLAIM.proposalId,
  householdId: CLAIM.householdId,
  studentId: CLAIM.studentId,
  recipientRef: CLAIM.recipientRef,
  routeRef: ROUTE_REF,
  templateCode: 'study-safety-adult-review-v1',
})

function insertResult(overrides = {}) {
  return {
    state: 'delivered',
    providerReceiptRef: RECEIPT.providerReceiptRef,
    jobId: PROVIDER_DELIVERY.jobId,
    attemptId: PROVIDER_DELIVERY.attemptId,
    proposalId: PROVIDER_DELIVERY.proposalId,
    householdId: PROVIDER_DELIVERY.householdId,
    studentId: PROVIDER_DELIVERY.studentId,
    deliveryIdempotencyKey: PROVIDER_DELIVERY.idempotencyKey,
    recipientRef: PROVIDER_DELIVERY.recipientRef,
    routeRef: PROVIDER_DELIVERY.routeRef,
    providerName: 'academy-in-app',
    providerConfigVersion: 'in-app-config-v1',
    notification: {
      title: 'Study check-in needs your review',
      reasonCategory: 'immediate-safety',
      urgency: 'urgent',
      actionRef: 'adult-review:proposal-1',
    },
    ...overrides,
  }
}

function inAppProvider(overrides = {}) {
  const persistence = {
    isDurable: true,
    isReady: () => true,
    insertNotification: vi.fn(async () => insertResult()),
    verifyNotificationReceipt: vi.fn(async () => RECEIPT),
    ...overrides,
  }
  return {
    persistence,
    configured: createDurableInAppProvider({
      persistence,
      adultReviewInAppDeliveryPolicy: 'approved',
      environment: 'production',
    }),
  }
}

function deliveryRequest(patch = {}) {
  const delivery = { ...PROVIDER_DELIVERY, ...patch }
  return {
    delivery,
    recipient: { recipientRef: PROVIDER_DELIVERY.recipientRef },
    workerContext: AUTHORITY,
    trigger: 'scheduled',
    onAttemptSubmitted: vi.fn(async () => undefined),
  }
}

describe('durable delivery idempotency key at the worker claim boundary', () => {
  it('accepts a claim carrying the durable delivery:<sha256> key', async () => {
    const { worker, persistence } = workerFixture()
    await expect(processClaim(worker)).resolves.toEqual({
      deliveryId: CLAIM.jobId,
      status: 'delivered',
    })
    expect(persistence.commitReceipt).toHaveBeenCalledOnce()
  })

  it.each(rejectedForms('delivery'))(
    'rejects a claim whose delivery key is a %s',
    async (_label, idempotencyKey) => {
      const { worker, persistence, provider } = workerFixture()
      await expect(processClaim(worker, { idempotencyKey }))
        .rejects.toThrow('delivery_binding_incomplete')
      expect(provider.deliver).not.toHaveBeenCalled()
      expect(persistence.recordAttemptSubmitted).not.toHaveBeenCalled()
      expect(persistence.commitReceipt).not.toHaveBeenCalled()
    },
  )

  it('does not coerce a non-string delivery key carrier into the durable binding', async () => {
    const { worker } = workerFixture()
    const carrier = { toString: () => DELIVERY_KEY }
    await expect(processClaim(worker, { idempotencyKey: carrier }))
      .rejects.toThrow('delivery_binding_incomplete')
    expect(`${carrier}`).toBe(DELIVERY_KEY)
  })
})

describe('durable identifiers at the in-app provider boundary', () => {
  it('accepts a delivery carrying the durable delivery:<sha256> key and route:<sha256> ref', async () => {
    const { configured, persistence } = inAppProvider()
    await expect(configured.deliver(deliveryRequest())).resolves.toMatchObject({
      state: 'delivered',
      verified: true,
      jobId: PROVIDER_DELIVERY.jobId,
      attemptId: PROVIDER_DELIVERY.attemptId,
    })
    expect(persistence.insertNotification).toHaveBeenCalledWith(expect.objectContaining({
      deliveryIdempotencyKey: DELIVERY_KEY,
      routeRef: ROUTE_REF,
    }))
  })

  it('rejects a durable delivery key paired with a legacy route ref', async () => {
    const { configured, persistence } = inAppProvider()
    await expect(configured.deliver(deliveryRequest({
      idempotencyKey: DELIVERY_KEY,
      routeRef: `in-app-route:${DIGEST}`,
    }))).rejects.toThrow('invalid_in_app_delivery')
    expect(persistence.insertNotification).not.toHaveBeenCalled()
  })

  it('rejects a durable route ref paired with a legacy delivery key', async () => {
    const { configured, persistence } = inAppProvider()
    await expect(configured.deliver(deliveryRequest({
      idempotencyKey: `study-safety-delivery:${DIGEST}`,
      routeRef: ROUTE_REF,
    }))).rejects.toThrow('invalid_in_app_delivery')
    expect(persistence.insertNotification).not.toHaveBeenCalled()
  })

  it.each(rejectedForms('delivery'))(
    'rejects a delivery whose idempotency key is a %s',
    async (_label, idempotencyKey) => {
      const { configured, persistence } = inAppProvider()
      await expect(configured.deliver(deliveryRequest({ idempotencyKey })))
        .rejects.toThrow('invalid_in_app_delivery')
      expect(persistence.insertNotification).not.toHaveBeenCalled()
    },
  )

  it.each(rejectedForms('route'))(
    'rejects a delivery whose route ref is a %s',
    async (_label, routeRef) => {
      const { configured, persistence } = inAppProvider()
      await expect(configured.deliver(deliveryRequest({ routeRef })))
        .rejects.toThrow('invalid_in_app_delivery')
      expect(persistence.insertNotification).not.toHaveBeenCalled()
    },
  )

  it('rejects a raw destination, contact value, or message body as a route ref', async () => {
    const { configured, persistence } = inAppProvider()
    for (const routeRef of [
      'guardian@example.invalid',
      '+15555550123',
      'https://example.invalid/notify',
      '1 Synthetic Way',
      'synthetic message body',
    ]) {
      await expect(configured.deliver(deliveryRequest({ routeRef })))
        .rejects.toThrow('invalid_in_app_delivery')
    }
    expect(persistence.insertNotification).not.toHaveBeenCalled()
  })

  it('rejects a verification binding whose durable identifiers are not canonical', async () => {
    const { configured } = inAppProvider()
    const binding = {
      providerReceiptRef: RECEIPT.providerReceiptRef,
      providerName: 'academy-in-app',
      route: 'in-app',
      routeRef: ROUTE_REF,
      jobId: CLAIM.jobId,
      attemptId: CLAIM.attemptId,
      proposalId: CLAIM.proposalId,
      householdId: CLAIM.householdId,
      studentId: CLAIM.studentId,
      recipientRef: CLAIM.recipientRef,
      deliveryIdempotencyKey: DELIVERY_KEY,
      providerConfigVersion: 'in-app-config-v1',
      workerContext: AUTHORITY,
    }
    await expect(configured.verifyReceipt(binding)).resolves.toMatchObject({ verified: true })
    for (const patch of [
      { deliveryIdempotencyKey: `study-safety-delivery:${DIGEST}` },
      { deliveryIdempotencyKey: { toString: () => DELIVERY_KEY } },
      { routeRef: `in-app-route:${DIGEST}` },
      { routeRef: { toString: () => ROUTE_REF } },
    ]) {
      await expect(configured.verifyReceipt({ ...binding, ...patch }))
        .rejects.toThrow('invalid_in_app_receipt_request')
    }
  })
})

describe('durable delivery key in the adult-review receipt contract', () => {
  it('accepts a receipt carrying the durable delivery:<sha256> key', () => {
    expect(validateVerifiedAdultReviewReceipt({ ...RECEIPT }, BINDING, { environment: 'production' }))
      .toEqual(RECEIPT)
  })

  it.each(rejectedForms('delivery'))(
    'rejects a receipt whose delivery key is a %s',
    (_label, deliveryIdempotencyKey) => {
      expect(() => validateVerifiedAdultReviewReceipt(
        { ...RECEIPT, deliveryIdempotencyKey },
        { ...BINDING, deliveryIdempotencyKey },
        { environment: 'production' },
      )).toThrow('receipt_schema_mismatch')
    },
  )

  it.each([
    ['job', 'jobId', 'job:other'],
    ['attempt', 'attemptId', 'attempt:other'],
    ['proposal', 'proposalId', 'proposal:other'],
    ['household', 'householdId', 'household:other'],
    ['student', 'studentId', 'student:other'],
    ['recipient', 'recipientRef', 'recipient:other'],
    ['route', 'routeRef', `route:${'c'.repeat(64)}`],
    ['delivery key', 'deliveryIdempotencyKey', `delivery:${'c'.repeat(64)}`],
    ['provider', 'providerName', 'academy-external'],
    ['provider config version', 'providerConfigVersion', 'in-app-config-v0'],
  ])('rejects a receipt that substitutes another %s', (_label, key, value) => {
    expect(() => validateVerifiedAdultReviewReceipt(
      { ...RECEIPT, [key]: value },
      BINDING,
      { environment: 'production' },
    )).toThrow(`receipt_binding_mismatch:${key}`)
  })
})
