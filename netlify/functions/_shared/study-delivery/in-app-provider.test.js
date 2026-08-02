import { describe, expect, it, vi } from 'vitest'
import { createDurableInAppProvider } from './in-app-provider.js'

const ATTEMPT = Object.freeze({
  idempotencyKey: `study-safety-delivery:${'a'.repeat(64)}`,
  jobId: 'job:synthetic-1',
  attemptId: 'attempt:synthetic-1',
  proposalId: 'proposal:synthetic-1',
  householdId: 'household:synthetic-1',
  studentId: 'student:synthetic-1',
  recipientRef: 'recipient:synthetic-guardian-1',
  routeRef: 'in-app-route:synthetic-guardian-1',
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

  it('rejects raw/contact input, forged recipient, and forged routes before persistence', async () => {
    const persistence = durablePersistence()
    const configured = provider(persistence)
    for (const extra of [
      { rawText: 'synthetic disclosure' },
      { transcript: 'synthetic transcript' },
      { email: 'guardian@example.invalid' },
      { destination: 'synthetic destination' },
    ]) {
      await expect(configured.deliver(request({ ...ATTEMPT, ...extra })))
        .rejects.toThrow('invalid_in_app_delivery_request')
    }
    await expect(configured.deliver(request({ ...ATTEMPT, routeRef: 'email-route:forged' })))
      .rejects.toThrow('invalid_in_app_delivery')
    await expect(configured.deliver(request(ATTEMPT, {
      recipient: { recipientRef: 'recipient:forged' },
    }))).rejects.toThrow('invalid_in_app_delivery_request')
    expect(persistence.insertNotification).not.toHaveBeenCalled()
  })

  it.each([
    ['unverified', { verified: false }],
    ['wrong recipient', { recipientRef: 'recipient:another-guardian' }],
    ['wrong attempt', { attemptId: 'attempt:another-attempt' }],
    ['wrong job', { jobId: 'job:another-job' }],
    ['wrong route', { routeRef: 'in-app-route:another' }],
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
