import { describe, expect, it, vi } from 'vitest'
import { createSupabaseInAppPersistence } from './supabase-in-app.js'

const WORKER_CONTEXT = Object.freeze({
  verified: true,
  schemaVersion: 1,
  workerIdentity: 'worker:adult-review',
  credentialId: 'credential:adult-review',
  credentialVersion: 'credential-v2',
  scope: 'study:adult-review:delivery',
  expiresAt: '2099-08-02T13:00:00.000Z',
  revoked: false,
  verifierVersion: 'verifier-v1',
  verificationRef: 'verification:synthetic',
})

describe('Supabase in-app persistence', () => {
  it('binds delivery and receipt RPCs to the verified worker credential context', async () => {
    const call = vi.fn(async (name) => name.includes('verify') ? { verified: true } : { inserted: true })
    const persistence = createSupabaseInAppPersistence({
      rpc: { isConfigured: () => true, call },
      leaseContext: {
        forAttempt: vi.fn(async () => ({
          active: true,
          currentAttempt: true,
          leaseToken: 'lease:synthetic',
          expectedRevision: 7,
        })),
      },
    })

    await persistence.insertNotification({
      workerContext: WORKER_CONTEXT,
      jobId: 'job:synthetic',
      attemptId: 'attempt:synthetic',
      deliveryIdempotencyKey: `study-safety-delivery:${'a'.repeat(64)}`,
      recipientRef: 'recipient:synthetic',
      routeRef: 'route:synthetic',
      proposalId: 'proposal:synthetic',
      householdId: 'household:synthetic',
      studentId: 'student:synthetic',
      providerName: 'academy-in-app',
      providerConfigVersion: 'provider-v1',
    })
    await persistence.verifyNotificationReceipt({
      workerContext: WORKER_CONTEXT,
      jobId: 'job:synthetic',
      attemptId: 'attempt:synthetic',
    })

    const sanitizedContext = expect.objectContaining({
      workerIdentity: WORKER_CONTEXT.workerIdentity,
      credentialVersion: WORKER_CONTEXT.credentialVersion,
    })
    expect(call).toHaveBeenNthCalledWith(
      1,
      'academy_study_deliver_in_app_notification_v2',
      expect.any(Object),
      { requireWorkerCredential: true, workerContext: sanitizedContext },
    )
    expect(call).toHaveBeenNthCalledWith(
      2,
      'academy_study_verify_in_app_notification_v2',
      expect.any(Object),
      { requireWorkerCredential: true, workerContext: sanitizedContext },
    )
  })
})
