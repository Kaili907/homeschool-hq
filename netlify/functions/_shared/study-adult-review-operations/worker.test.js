import { describe, expect, it, vi } from 'vitest'
import {
  AdultReviewWorkerAuthorizationError,
  AdultReviewWorkerConfigurationError,
  createAdultReviewWorker,
} from './worker.js'
import { createStudyAdultReviewWorkerHandler } from '../../study-adult-review-worker.js'
import { createStudyAdultReviewHealthHandler } from '../../study-adult-review-health.js'
import { createStudyParentNotificationsHandler } from '../../study-parent-notifications.js'

function readyPort(extra = {}) {
  return { isReady: () => true, ...extra }
}

function workerFixture(overrides = {}) {
  const persistence = readyPort({
    claim: vi.fn(async () => [{ claimId: 'claim:1', deliveryId: 'delivery:1' }]),
    cancel: vi.fn(async () => undefined),
    renewLease: vi.fn(async () => ({ renewed: true })),
    releaseLease: vi.fn(async () => undefined),
    recordAttemptSubmitted: vi.fn(async () => undefined),
    commitReceipt: vi.fn(async () => undefined),
    markIndeterminate: vi.fn(async () => undefined),
  })
  const provider = readyPort({
    isDurable: true,
    isTestProvider: false,
    deliver: vi.fn(async ({ onAttemptSubmitted }) => {
      await onAttemptSubmitted({ attemptId: 'attempt:1' })
      return {
        attemptId: 'attempt:1',
        receipt: {
          verified: true,
          attemptId: 'attempt:1',
          providerReceiptRef: 'receipt:1',
          evidenceRef: 'evidence:1',
          deliveredAt: '2026-08-01T12:00:00.000Z',
        },
      }
    }),
  })
  const monitor = readyPort({ record: vi.fn(async () => undefined) })
  const worker = createAdultReviewWorker({
    persistence,
    resolver: readyPort({ resolve: vi.fn(async () => ({ recipient: { recipientRef: 'recipient:1' } })) }),
    provider,
    monitor,
    schema: readyPort({ safeParse: (value) => ({ success: true, data: value }) }),
    workerIdentity: 'worker:synthetic',
    environment: 'production',
    ...overrides,
  })
  return { worker, persistence, provider, monitor }
}

describe('authorized adult-review worker', () => {
  it('records submission before atomically committing verified receipt evidence', async () => {
    const { worker, persistence } = workerFixture()
    const result = await worker.run({
      authenticated: true,
      trigger: 'scheduled',
      workerIdentity: 'worker:synthetic',
    })
    expect(result).toMatchObject({ claimed: 1, delivered: 1, indeterminate: 0, failed: 0 })
    expect(persistence.recordAttemptSubmitted).toHaveBeenCalledOnce()
    expect(persistence.commitReceipt).toHaveBeenCalledOnce()
    expect(persistence.releaseLease).not.toHaveBeenCalled()
  })

  it('refuses unauthenticated or mismatched worker contexts', async () => {
    const { worker } = workerFixture()
    await expect(worker.run({ trigger: 'manual' })).rejects.toBeInstanceOf(
      AdultReviewWorkerAuthorizationError,
    )
    await expect(worker.run({
      authenticated: true, trigger: 'manual', workerIdentity: 'worker:forged',
    })).rejects.toBeInstanceOf(AdultReviewWorkerAuthorizationError)
  })

  it('refuses test providers in production', () => {
    expect(() => workerFixture({
      provider: readyPort({
        isTestProvider: true,
        deliver: async () => ({ state: 'delivered' }),
      }),
    })).toThrow(AdultReviewWorkerConfigurationError)
  })

  it('supports authenticated scheduled invocation and minimized health', async () => {
    const run = vi.fn(async () => ({ claimed: 2, delivered: 1, indeterminate: 1, failed: 0 }))
    const handler = createStudyAdultReviewWorkerHandler({
      worker: { ready: async () => ({ ready: true }), run },
      workerAuthorization: readyPort({
        isDurable: true,
        authorize: async () => ({ authorized: true, workerIdentity: 'worker:synthetic' }),
      }),
    })
    const response = await handler({
      httpMethod: 'POST',
      path: '/.netlify/functions/study-adult-review-worker',
      headers: { 'x-nf-event': 'schedule' },
    })
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      status: 'processed', claimed: 2, delivered: 1, indeterminate: 1, failed: 0,
    })
    const health = createStudyAdultReviewHealthHandler({
      readiness: readyPort({
        isDurable: true,
        evaluate: async () => ({ state: 'degraded', secret: 'not-returned' }),
      }),
    })
    const healthResponse = await health({
      httpMethod: 'GET', path: '/api/study/adult-review/health', headers: {},
    })
    expect(JSON.parse(healthResponse.body)).toEqual({ state: 'degraded', schemaVersion: 2 })
  })

  it('refuses an unauthorized worker and records only a minimized denial event', async () => {
    const recordDenied = vi.fn(async () => undefined)
    const run = vi.fn()
    const handler = createStudyAdultReviewWorkerHandler({
      worker: { ready: async () => ({ ready: true }), run },
      workerAuthorization: readyPort({
        isDurable: true,
        authorize: async () => ({ authorized: false }),
        recordDenied,
      }),
    })
    const response = await handler({
      httpMethod: 'POST',
      path: '/.netlify/functions/study-adult-review-worker',
      headers: { 'x-nf-event': 'schedule' },
    })
    expect(response.statusCode).toBe(403)
    expect(run).not.toHaveBeenCalled()
    expect(recordDenied).toHaveBeenCalledWith({
      eventName: 'study.adult_review.unauthorized_worker',
      reasonCode: 'worker-auth-failed',
    })
  })

  it('requires durable parent-read limiting before guardian projection access', async () => {
    const notifications = readyPort({
      isDurable: true,
      list: vi.fn(async () => ({ notifications: [] })),
      markRead: vi.fn(),
    })
    const handler = createStudyParentNotificationsHandler({
      authVerifier: async () => ({
        ok: true, user: { id: 'synthetic-user' }, accessToken: 'synthetic-token',
      }),
      notifications,
      rateLimiter: readyPort({ isDurable: false, reserve: vi.fn() }),
    })
    const response = await handler({
      httpMethod: 'GET', path: '/api/study/parent-notifications', headers: {},
    })
    expect(response.statusCode).toBe(503)
    expect(notifications.list).not.toHaveBeenCalled()
  })
})
