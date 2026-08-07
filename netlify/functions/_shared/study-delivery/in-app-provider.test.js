import { describe, expect, it, vi } from 'vitest'
import { createDurableInAppProvider } from './in-app-provider.js'

const DELIVERY_KEY = `delivery:${'a'.repeat(64)}`
const ROUTE_REF = `route:${'b'.repeat(64)}`

const ATTEMPT = Object.freeze({
  idempotencyKey: DELIVERY_KEY,
  jobId: 'job:synthetic-1',
  attemptId: 'attempt:synthetic-1',
  proposalId: 'proposal:synthetic-1',
  householdId: 'household:synthetic-1',
  studentId: 'student:synthetic-1',
  recipientRef: 'recipient:synthetic-guardian-1',
  routeRef: ROUTE_REF,
  templateCode: 'study-safety-adult-review-v1',
})
const WORKER_CONTEXT = Object.freeze({
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

const NOTIFICATION = Object.freeze({
  title: 'Study check-in needs your review',
  reasonCategory: 'immediate-safety',
  urgency: 'urgent',
  actionRef: 'adult-review:synthetic-proposal-1',
})

const RECEIPT = Object.freeze({
  verified: true,
  receiptSchemaVersion: 1,
  providerReceiptRef: 'in-app-receipt:synthetic-notification-1',
  providerName: 'academy-in-app',
  route: 'in-app',
  routeRef: ATTEMPT.routeRef,
  jobId: ATTEMPT.jobId,
  attemptId: ATTEMPT.attemptId,
  proposalId: ATTEMPT.proposalId,
  householdId: ATTEMPT.householdId,
  studentId: ATTEMPT.studentId,
  recipientRef: ATTEMPT.recipientRef,
  deliveryIdempotencyKey: ATTEMPT.idempotencyKey,
  providerConfigVersion: 'in-app-config-v1',
  deliveredAt: '2026-08-01T12:00:00.000Z',
  evidenceRef: 'in-app-evidence:synthetic-visibility-1',
  eventIdempotencyKey: 'receipt-event:synthetic-notification-1',
  receiptSource: 'server-verified',
  testReceipt: false,
})

function request(delivery = ATTEMPT, overrides = {}) {
  return {
    delivery,
    recipient: { recipientRef: delivery.recipientRef },
    workerContext: WORKER_CONTEXT,
    trigger: 'scheduled',
    onAttemptSubmitted: vi.fn(async () => undefined),
    ...overrides,
  }
}

function insertResult(overrides = {}) {
  return {
    state: 'delivered',
    providerReceiptRef: RECEIPT.providerReceiptRef,
    jobId: RECEIPT.jobId,
    attemptId: RECEIPT.attemptId,
    proposalId: RECEIPT.proposalId,
    householdId: RECEIPT.householdId,
    studentId: RECEIPT.studentId,
    deliveryIdempotencyKey: RECEIPT.deliveryIdempotencyKey,
    recipientRef: RECEIPT.recipientRef,
    routeRef: RECEIPT.routeRef,
    providerName: RECEIPT.providerName,
    providerConfigVersion: RECEIPT.providerConfigVersion,
    notification: NOTIFICATION,
    ...overrides,
  }
}

function durablePersistence(overrides = {}) {
  return {
    isDurable: true,
    isReady: () => true,
    insertNotification: vi.fn(async () => insertResult()),
    verifyNotificationReceipt: vi.fn(async () => RECEIPT),
    ...overrides,
  }
}

function provider(persistence, overrides = {}) {
  return createDurableInAppProvider({
    persistence,
    adultReviewInAppDeliveryPolicy: 'approved',
    environment: 'production',
    ...overrides,
  })
}

describe('durable in-app notification provider', () => {
  it('is production-capable only with explicit policy approval and a ready durable port', () => {
    let ready = false
    const persistence = durablePersistence({ isReady: () => ready })
    const configured = provider(persistence)
    expect(configured).toMatchObject({
      channel: 'in-app',
      providerVersion: 'academy-in-app:in-app-config-v1',
      isDurable: true,
      isTestProvider: false,
      supportsDurableIdempotency: true,
      adultReviewInAppDeliveryPolicy: 'approved',
    })
    expect(configured.isReady()).toBe(false)
    ready = true
    expect(configured.isReady()).toBe(true)

    const notApproved = createDurableInAppProvider({ persistence })
    expect(notApproved.isReady()).toBe(false)
    expect(notApproved.adultReviewInAppDeliveryPolicy).toBe('not-approved')
  })

  it('does not send or claim delivery when policy is absent or not approved', async () => {
    const persistence = durablePersistence()
    for (const policy of [undefined, 'not-approved', 'APPROVED']) {
      const configured = createDurableInAppProvider({
        persistence,
        adultReviewInAppDeliveryPolicy: policy,
        environment: 'production',
      })
      await expect(configured.deliver(request()))
        .rejects.toThrow('adult_review_in_app_delivery_policy_not_approved')
    }
    expect(persistence.insertNotification).not.toHaveBeenCalled()
    expect(persistence.verifyNotificationReceipt).not.toHaveBeenCalled()
  })

  it('refuses memory/test persistence in production', async () => {
    const persistence = durablePersistence({ isDurable: false })
    const configured = provider(persistence)
    expect(configured.isReady()).toBe(false)
    await expect(configured.deliver(request())).rejects.toThrow('in_app_persistence_not_ready')
    expect(persistence.insertNotification).not.toHaveBeenCalled()
  })

  it('persists exact opaque bindings and verifies a full receipt before delivery', async () => {
    const persistence = durablePersistence()
    const configured = provider(persistence)
    const delivery = request()
    await expect(configured.deliver(delivery)).resolves.toMatchObject({
      state: 'delivered',
      submitted: true,
      verified: true,
      providerReceiptRef: RECEIPT.providerReceiptRef,
      jobId: ATTEMPT.jobId,
      attemptId: ATTEMPT.attemptId,
      deliveredAt: RECEIPT.deliveredAt,
      evidenceRef: RECEIPT.evidenceRef,
      notification: NOTIFICATION,
      receipt: RECEIPT,
    })
    expect(delivery.onAttemptSubmitted).toHaveBeenCalledWith({ attemptId: ATTEMPT.attemptId })
    expect(persistence.insertNotification).toHaveBeenCalledWith({
      schemaVersion: 1,
      workerContext: WORKER_CONTEXT,
      providerName: 'academy-in-app',
      providerConfigVersion: 'in-app-config-v1',
      deliveryIdempotencyKey: ATTEMPT.idempotencyKey,
      jobId: ATTEMPT.jobId,
      attemptId: ATTEMPT.attemptId,
      proposalId: ATTEMPT.proposalId,
      householdId: ATTEMPT.householdId,
      studentId: ATTEMPT.studentId,
      recipientRef: ATTEMPT.recipientRef,
      routeRef: ATTEMPT.routeRef,
      templateCode: ATTEMPT.templateCode,
    })
    expect(persistence.verifyNotificationReceipt).toHaveBeenCalledOnce()
    expect(JSON.stringify(persistence.insertNotification.mock.calls))
      .not.toMatch(/email|phone|destination|transcript|rawText|disclosure/i)
  })

  it('rejects an idempotent receipt bound to an earlier attempt', async () => {
    const persistence = durablePersistence({
      insertNotification: vi.fn(async () => insertResult({
        state: 'already-delivered',
        attemptId: 'attempt:original',
      })),
    })
    await expect(provider(persistence).deliver(request()))
      .rejects.toThrow('in_app_persistence_contract')
    expect(persistence.verifyNotificationReceipt).not.toHaveBeenCalled()
  })

  it('returns revocation-before-insert without receipt lookup or false delivery claim', async () => {
    const persistence = durablePersistence({
      insertNotification: vi.fn(async () => ({
        state: 'revoked', reasonCode: 'recipient-revoked-before-insert',
      })),
    })
    await expect(provider(persistence).deliver(request())).resolves.toEqual({
      state: 'revoked', reasonCode: 'recipient-revoked-before-insert',
    })
    expect(persistence.verifyNotificationReceipt).not.toHaveBeenCalled()
  })

  it.each([
    ['title', 'Safety disclosure'],
    ['reasonCategory', 'raw-disclosure'],
    ['urgency', 'review-required'],
    ['actionRef', 'https://example.invalid/review'],
  ])('rejects non-canonical notification field %s', async (field, value) => {
    const persistence = durablePersistence({
      insertNotification: vi.fn(async () => insertResult({
        notification: { ...NOTIFICATION, [field]: value },
      })),
    })
    await expect(provider(persistence).deliver(request()))
      .rejects.toThrow('in_app_persistence_contract')
  })

  it.each([
    ['raw learner text', { rawLearnerText: 'synthetic learner disclosure' }],
    ['raw tutor text', { rawTutorText: 'synthetic tutor reply' }],
    ['transcript', { transcript: 'synthetic transcript' }],
    ['prompt', { prompt: 'synthetic prompt' }],
    ['response', { response: 'synthetic response' }],
    ['disclosure body', { disclosureBody: 'synthetic disclosure' }],
    ['email', { email: 'guardian@example.invalid' }],
    ['phone', { phone: '+15555550123' }],
    ['postal address', { postalAddress: '1 Synthetic Way' }],
    ['destination string', { destination: 'synthetic destination' }],
    ['message body', { messageBody: 'synthetic message body' }],
  ])('rejects caller-supplied %s before persistence', async (_label, extra) => {
    const persistence = durablePersistence()
    await expect(provider(persistence).deliver(request({ ...ATTEMPT, ...extra })))
      .rejects.toThrow('invalid_in_app_delivery_request')
    await expect(provider(persistence).deliver(request(ATTEMPT, {
      recipient: { recipientRef: ATTEMPT.recipientRef, ...extra },
    }))).rejects.toThrow('invalid_in_app_delivery_request')
    expect(persistence.insertNotification).not.toHaveBeenCalled()
  })

  it('rejects forged recipients and non-in-app routes before persistence', async () => {
    const persistence = durablePersistence()
    const configured = provider(persistence)
    for (const routeRef of [
      'email-route:forged',
      'sms-route:forged',
      'route:',
      `in-app-route:${'b'.repeat(64)}`,
    ])  {
      await expect(configured.deliver(request({ ...ATTEMPT, routeRef })))
        .rejects.toThrow('invalid_in_app_delivery')
    }
    await expect(configured.deliver(request(ATTEMPT, {
      recipient: { recipientRef: 'recipient:forged' },
    }))).rejects.toThrow('invalid_in_app_delivery_request')
    await expect(configured.deliver(request({ ...ATTEMPT, templateCode: 'study-external-email-v1' })))
      .rejects.toThrow('invalid_in_app_delivery')
    expect(persistence.insertNotification).not.toHaveBeenCalled()
  })

  it.each([
    ['unverified', { verified: false }],
    ['wrong recipient', { recipientRef: 'recipient:another-guardian' }],
    ['wrong attempt', { attemptId: 'attempt:another-attempt' }],
    ['wrong job', { jobId: 'job:another-job' }],
    ['wrong proposal', { proposalId: 'proposal:another-proposal' }],
    ['wrong route', { routeRef: `route:${'c'.repeat(64)}` }],
    ['wrong household', { householdId: 'household:another' }],
    ['wrong student', { studentId: 'student:another' }],
    ['wrong provider version', { providerConfigVersion: 'in-app-config-v0' }],
    ['browser-authored', { receiptSource: 'browser' }],
    ['test receipt', { testReceipt: true }],
  ])('never promotes %s receipt evidence', async (_label, patch) => {
    const persistence = durablePersistence({
      verifyNotificationReceipt: vi.fn(async () => ({ ...RECEIPT, ...patch })),
    })
    await expect(provider(persistence).deliver(request()))
      .rejects.toThrow(/(?:in_app_persistence_contract|receipt_binding_mismatch)/)
  })

  it('rejects a receipt bound to another notification receipt ref', async () => {
    const persistence = durablePersistence({
      verifyNotificationReceipt: vi.fn(async () => ({
        ...RECEIPT,
        providerReceiptRef: 'in-app-receipt:another-notification',
      })),
    })
    await expect(provider(persistence).deliver(request()))
      .rejects.toThrow('receipt_binding_mismatch:providerReceiptRef')
  })

  it('treats an already-delivered retry as idempotent without a second notification', async () => {
    const persistence = durablePersistence({
      insertNotification: vi.fn(async () => insertResult({ state: 'already-delivered' })),
    })
    const configured = provider(persistence)
    const first = await configured.deliver(request())
    const retry = await configured.deliver(request())

    expect(retry).toEqual(first)
    expect(retry).toMatchObject({
      state: 'already-delivered',
      verified: true,
      providerReceiptRef: RECEIPT.providerReceiptRef,
      attemptId: ATTEMPT.attemptId,
    })
    expect(persistence.insertNotification).toHaveBeenCalledTimes(2)
    expect(persistence.insertNotification.mock.calls[0]).toEqual(
      persistence.insertNotification.mock.calls[1],
    )
  })

  it.each([
    ['malformed receipt reference', { providerReceiptRef: 'notification:synthetic-1' }],
    ['unknown result field', { extraField: 'synthetic' }],
    ['unknown insert state', { state: 'submitted' }],
  ])('rejects an insert result with a %s', async (_label, patch) => {
    const persistence = durablePersistence({
      insertNotification: vi.fn(async () => insertResult(patch)),
    })
    await expect(provider(persistence).deliver(request()))
      .rejects.toThrow('in_app_persistence_contract')
    expect(persistence.verifyNotificationReceipt).not.toHaveBeenCalled()
  })

  it.each([
    'providerReceiptRef', 'jobId', 'attemptId', 'proposalId', 'householdId',
    'studentId', 'deliveryIdempotencyKey', 'recipientRef', 'routeRef',
    'providerName', 'providerConfigVersion', 'notification',
  ])('rejects an insert result missing %s', async (key) => {
    const { [key]: _dropped, ...incomplete } = insertResult()
    const persistence = durablePersistence({
      insertNotification: vi.fn(async () => incomplete),
    })
    await expect(provider(persistence).deliver(request()))
      .rejects.toThrow('in_app_persistence_contract')
    expect(persistence.verifyNotificationReceipt).not.toHaveBeenCalled()
  })

  it('rejects a malformed evidence reference on an otherwise valid receipt', async () => {
    const persistence = durablePersistence({
      verifyNotificationReceipt: vi.fn(async () => ({
        ...RECEIPT, evidenceRef: 'https://example.invalid/evidence',
      })),
    })
    await expect(provider(persistence).deliver(request()))
      .rejects.toThrow('in_app_persistence_contract')
  })

  it('leaks no lease token, idempotency key, or credential in thrown errors', async () => {
    const leaseToken = 'lease:synthetic-secret-token'
    const secrets = [leaseToken, ATTEMPT.idempotencyKey, WORKER_CONTEXT.credentialId]

    const rejected = await provider(durablePersistence())
      .deliver(request(ATTEMPT, { leaseToken }))
      .catch((thrown) => thrown)
    expect(rejected.message).toBe('invalid_in_app_delivery_request')

    const failed = await provider(durablePersistence({
      insertNotification: vi.fn(async () => { throw new Error('in_app_lease_context_invalid') }),
    })).deliver(request()).catch((thrown) => thrown)
    expect(failed.message).toBe('in_app_lease_context_invalid')

    for (const error of [rejected, failed]) {
      for (const secret of secrets) {
        expect(`${error.message}${error.stack}`).not.toContain(secret)
      }
    }
  })

  it('rejects revoked, expired, wrong-scope, or forged-version worker contexts', async () => {
    const persistence = durablePersistence()
    const configured = provider(persistence)
    for (const patch of [
      { revoked: true },
      { expiresAt: '2020-01-01T00:00:00.000Z' },
      { scope: 'study:adult-review:read' },
      { credentialVersion: '' },
    ]) {
      await expect(configured.deliver(request(ATTEMPT, {
        workerContext: { ...WORKER_CONTEXT, ...patch },
      }))).rejects.toThrow('worker_credential_verification_failed')
    }
    expect(persistence.insertNotification).not.toHaveBeenCalled()
  })
})
