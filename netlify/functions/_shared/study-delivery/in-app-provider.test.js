import { describe, expect, it, vi } from 'vitest'
import { createDurableInAppProvider } from './in-app-provider.js'

const ATTEMPT = Object.freeze({
  idempotencyKey: `study-safety-delivery:${'a'.repeat(64)}`,
  jobId: 'job:synthetic-1',
  attemptId: 'attempt:synthetic-1',
  recipientRef: 'recipient:synthetic-guardian-1',
  routeRef: 'in-app-route:synthetic-guardian-1',
  templateCode: 'study-safety-adult-review-v1',
})

const NOTIFICATION = Object.freeze({
  title: 'Study check-in needs your review',
  reasonCategory: 'immediate-safety',
  urgency: 'urgent',
  actionRef: 'adult-review:synthetic-proposal-1',
})

const RECEIPT = Object.freeze({
  verified: true,
  providerReceiptRef: 'in-app-receipt:synthetic-notification-1',
  jobId: ATTEMPT.jobId,
  attemptId: ATTEMPT.attemptId,
  deliveryIdempotencyKey: ATTEMPT.idempotencyKey,
  recipientRef: ATTEMPT.recipientRef,
  routeRef: ATTEMPT.routeRef,
  providerName: 'academy-in-app',
  providerConfigVersion: 'in-app-config-v1',
  deliveredAt: '2026-08-01T12:00:00.000Z',
  evidenceRef: 'in-app-evidence:synthetic-visibility-1',
  notification: NOTIFICATION,
})

function durablePersistence(overrides = {}) {
  return {
    isDurable: true,
    isReady: () => true,
    insertNotification: vi.fn(async () => ({
      state: 'delivered',
      providerReceiptRef: RECEIPT.providerReceiptRef,
      jobId: RECEIPT.jobId,
      attemptId: RECEIPT.attemptId,
      notification: NOTIFICATION,
    })),
    verifyNotificationReceipt: vi.fn(async () => RECEIPT),
    ...overrides,
  }
}

describe('durable in-app notification provider', () => {
  it('is production-capable only while its injected durable port is ready', () => {
    let ready = false
    const provider = createDurableInAppProvider({
      persistence: durablePersistence({ isReady: () => ready }),
    })
    expect(provider).toMatchObject({
      channel: 'in-app',
      providerVersion: 'academy-in-app:in-app-config-v1',
      isDurable: true,
      isTestProvider: false,
      supportsDurableIdempotency: true,
    })
    expect(provider.isReady()).toBe(false)
    ready = true
    expect(provider.isReady()).toBe(true)
  })

  it('refuses memory/test persistence in production', async () => {
    const persistence = durablePersistence({ isDurable: false })
    const provider = createDurableInAppProvider({ persistence })
    expect(provider.isReady()).toBe(false)
    await expect(provider.deliver(ATTEMPT)).rejects.toThrow('in_app_persistence_not_ready')
    expect(persistence.insertNotification).not.toHaveBeenCalled()
  })

  it('persists opaque bindings and verifies visibility before delivery', async () => {
    const persistence = durablePersistence()
    const provider = createDurableInAppProvider({ persistence })
    await expect(provider.deliver(ATTEMPT)).resolves.toEqual({
      state: 'delivered', verified: true,
      providerReceiptRef: RECEIPT.providerReceiptRef,
      jobId: ATTEMPT.jobId, attemptId: ATTEMPT.attemptId,
      deliveredAt: RECEIPT.deliveredAt, evidenceRef: RECEIPT.evidenceRef,
      notification: NOTIFICATION,
    })
    expect(persistence.insertNotification).toHaveBeenCalledWith({
      schemaVersion: 1,
      providerName: 'academy-in-app',
      providerConfigVersion: 'in-app-config-v1',
      deliveryIdempotencyKey: ATTEMPT.idempotencyKey,
      jobId: ATTEMPT.jobId,
      attemptId: ATTEMPT.attemptId,
      recipientRef: ATTEMPT.recipientRef,
      routeRef: ATTEMPT.routeRef,
      templateCode: ATTEMPT.templateCode,
    })
    expect(persistence.verifyNotificationReceipt).toHaveBeenCalledOnce()
    expect(JSON.stringify(persistence.insertNotification.mock.calls))
      .not.toMatch(/email|phone|destination|transcript|rawText|disclosure/i)
  })

  it('keeps an idempotent duplicate bound to the original attempt', async () => {
    const original = { ...RECEIPT, attemptId: 'attempt:original' }
    const persistence = durablePersistence({
      insertNotification: vi.fn(async () => ({
        state: 'already-delivered',
        providerReceiptRef: original.providerReceiptRef,
        jobId: original.jobId,
        attemptId: original.attemptId,
        notification: NOTIFICATION,
      })),
      verifyNotificationReceipt: vi.fn(async () => original),
    })
    await expect(createDurableInAppProvider({ persistence }).deliver({
      ...ATTEMPT, attemptId: 'attempt:retry',
    })).resolves.toMatchObject({
      state: 'already-delivered', attemptId: 'attempt:original', verified: true,
    })
  })

  it('returns revocation-before-insert without receipt lookup', async () => {
    const persistence = durablePersistence({
      insertNotification: vi.fn(async () => ({
        state: 'revoked', reasonCode: 'recipient-revoked-before-insert',
      })),
    })
    await expect(createDurableInAppProvider({ persistence }).deliver(ATTEMPT)).resolves.toEqual({
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
      insertNotification: vi.fn(async () => ({
        state: 'delivered',
        providerReceiptRef: RECEIPT.providerReceiptRef,
        jobId: RECEIPT.jobId,
        attemptId: RECEIPT.attemptId,
        notification: { ...NOTIFICATION, [field]: value },
      })),
    })
    await expect(createDurableInAppProvider({ persistence }).deliver(ATTEMPT))
      .rejects.toThrow('in_app_persistence_contract')
  })

  it('rejects raw/contact input and forged routes before persistence', async () => {
    const persistence = durablePersistence()
    const provider = createDurableInAppProvider({ persistence })
    for (const extra of [
      { rawText: 'synthetic disclosure' }, { transcript: 'synthetic transcript' },
      { email: 'guardian@example.invalid' }, { destination: 'synthetic destination' },
    ]) await expect(provider.deliver({ ...ATTEMPT, ...extra })).rejects.toThrow('invalid_in_app_delivery')
    await expect(provider.deliver({ ...ATTEMPT, routeRef: 'email-route:forged' }))
      .rejects.toThrow('invalid_in_app_delivery')
    expect(persistence.insertNotification).not.toHaveBeenCalled()
  })

  it.each([
    { ...RECEIPT, verified: false },
    { ...RECEIPT, recipientRef: 'recipient:another-guardian' },
    { ...RECEIPT, attemptId: 'attempt:another-attempt' },
    { ...RECEIPT, jobId: 'job:another-job' },
  ])('never promotes missing, replayed, or mismatched evidence', async (evidence) => {
    const persistence = durablePersistence({
      verifyNotificationReceipt: vi.fn(async () => evidence),
    })
    await expect(createDurableInAppProvider({ persistence }).deliver(ATTEMPT))
      .rejects.toThrow(/in_app_(?:persistence_contract|receipt_not_verified)/)
  })
})
