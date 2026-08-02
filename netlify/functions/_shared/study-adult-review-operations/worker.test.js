import { describe, expect, it, vi } from 'vitest'
import {
  ADULT_REVIEW_WORKER_SCOPE,
  AdultReviewWorkerAuthorizationError,
  AdultReviewWorkerConfigurationError,
  createAdultReviewWorker,
} from './worker.js'
import { createStudyAdultReviewWorkerHandler } from '../../study-adult-review-worker.js'
import { createStudyAdultReviewHealthHandler } from '../../study-adult-review-health.js'
import { createStudyParentNotificationsHandler } from '../../study-parent-notifications.js'

const NOW = new Date('2026-08-01T12:00:00.000Z')
const DELIVERY_KEY = `study-safety-delivery:${'a'.repeat(64)}`
const CLAIM = Object.freeze({
  claimId: 'claim:1',
  deliveryId: 'job:1',
  jobId: 'job:1',
  proposalId: 'proposal:1',
  householdId: 'household:1',
  studentId: 'student:1',
  recipientRef: 'recipient:1',
  routeRef: 'in-app-route:1',
  idempotencyKey: DELIVERY_KEY,
  templateCode: 'study-safety-adult-review-v1',
  attemptId: 'attempt:1',
  leaseToken: 'lease:1',
  leaseRevision: 3,
  leaseExpiresAt: '2026-08-01T12:01:00.000Z',
})

const AUTHORITY = Object.freeze({
  verified: true,
  schemaVersion: 1,
  workerIdentity: 'worker:synthetic',
  credentialId: 'worker-credential:synthetic',
  credentialVersion: 'worker-credential-v2',
  scope: ADULT_REVIEW_WORKER_SCOPE,
  expiresAt: '2026-08-01T12:05:00.000Z',
  revoked: false,
  verifierVersion: 'worker-verifier-v1',
  verificationRef: 'worker-verification:synthetic',
})

const RECEIPT = Object.freeze({
  verified: true,
  receiptSchemaVersion: 1,
  providerReceiptRef: 'in-app-receipt:1',
  providerName: 'academy-in-app',
  route: 'in-app',
  routeRef: CLAIM.routeRef,
  jobId: CLAIM.jobId,
  attemptId: CLAIM.attemptId,
  proposalId: CLAIM.proposalId,
  householdId: CLAIM.householdId,
  studentId: CLAIM.studentId,
  recipientRef: CLAIM.recipientRef,
  deliveryIdempotencyKey: DELIVERY_KEY,
  providerConfigVersion: 'in-app-config-v1',
  deliveredAt: '2026-08-01T12:00:10.000Z',
  evidenceRef: 'in-app-evidence:1',
  eventIdempotencyKey: 'receipt-event:1',
  receiptSource: 'server-verified',
  testReceipt: false,
})

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

function commitProof(overrides = {}) {
  return {
    committed: true,
    replayed: false,
    receiptId: RECEIPT.providerReceiptRef,
    eventIdempotencyKey: RECEIPT.eventIdempotencyKey,
    attemptId: RECEIPT.attemptId,
    jobId: RECEIPT.jobId,
    ...overrides,
  }
}

function workerFixture(overrides = {}) {
  const persistence = readyPort({
    claim: vi.fn(async () => [CLAIM]),
    cancel: vi.fn(async () => undefined),
    validateLease: vi.fn(async () => leaseProof()),
    renewLease: vi.fn(async () => leaseProof()),
    releaseLease: vi.fn(async () => undefined),
    recordAttemptSubmitted: vi.fn(async () => attemptProof()),
    validateCurrentAttempt: vi.fn(async () => attemptProof()),
    commitReceipt: vi.fn(async () => commitProof()),
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
  const monitor = readyPort({ record: vi.fn(async () => undefined) })
  const verifier = readyPort({
    isDurable: true,
    verify: vi.fn(async () => AUTHORITY),
  })
  const worker = createAdultReviewWorker({
    persistence,
    resolver: readyPort({
      resolve: vi.fn(async () => ({ recipient: { recipientRef: CLAIM.recipientRef } })),
    }),
    provider,
    monitor,
    schema: readyPort({ safeParse: (value) => ({ success: true, data: value }) }),
    workerCredentialVerifier: verifier,
    workerCredentialVersion: AUTHORITY.credentialVersion,
    now: () => new Date(NOW),
    environment: 'production',
    ...overrides,
  })
  return { worker, persistence, provider, monitor, verifier }
}

async function run(worker, context = {}) {
  return worker.run({
    trigger: 'scheduled',
    workerCredential: 'opaque-worker-credential',
    ...context,
  })
}

describe('credential-bound adult-review worker', () => {
  it('derives authority from the verifier and commits only a current attempt-bound receipt', async () => {
    const { worker, persistence, verifier } = workerFixture()
    const result = await run(worker)
    expect(result).toMatchObject({
      workerIdentity: AUTHORITY.workerIdentity,
      workerCredentialVersion: AUTHORITY.credentialVersion,
      claimed: 1,
      delivered: 1,
      indeterminate: 0,
      failed: 0,
    })
    expect(verifier.verify).toHaveBeenCalledWith({
      workerCredential: 'opaque-worker-credential',
      trigger: 'scheduled',
      requiredScope: ADULT_REVIEW_WORKER_SCOPE,
      requiredCredentialVersion: AUTHORITY.credentialVersion,
      requiredSchemaVersion: 1,
      checkedAt: NOW.toISOString(),
    })
    expect(persistence.validateLease).toHaveBeenCalledTimes(2)
    expect(persistence.validateCurrentAttempt).toHaveBeenCalledOnce()
    expect(persistence.commitReceipt).toHaveBeenCalledOnce()
    expect(persistence.releaseLease).not.toHaveBeenCalled()
    expect(JSON.stringify(persistence.claim.mock.calls)).not.toContain('opaque-worker-credential')
  })

  it.each([
    ['revoked credential', { revoked: true }],
    ['wrong scope', { scope: 'study:adult-review:read' }],
    ['expired credential', { expiresAt: NOW.toISOString() }],
    ['missing credential version', { credentialVersion: '' }],
    ['rotated credential version', { credentialVersion: 'worker-credential-v1' }],
    ['wrong authority schema', { schemaVersion: 2 }],
  ])('rejects %s before claiming work', async (_label, authorityPatch) => {
    const verifier = readyPort({
      isDurable: true,
      verify: vi.fn(async () => ({ ...AUTHORITY, ...authorityPatch })),
    })
    const { worker, persistence } = workerFixture({ workerCredentialVerifier: verifier })
    await expect(run(worker)).rejects.toBeInstanceOf(AdultReviewWorkerAuthorizationError)
    expect(persistence.claim).not.toHaveBeenCalled()
  })

  it('rejects caller-authored worker identity and legacy authenticated booleans', async () => {
    const { worker, verifier } = workerFixture()
    await expect(run(worker, { workerIdentity: 'worker:forged' }))
      .rejects.toBeInstanceOf(AdultReviewWorkerAuthorizationError)
    await expect(run(worker, { authenticated: true }))
      .rejects.toBeInstanceOf(AdultReviewWorkerAuthorizationError)
    expect(verifier.verify).not.toHaveBeenCalled()
  })

  it('requires an exact active lease before provider submission', async () => {
    const persistence = readyPort({
      claim: vi.fn(async () => [CLAIM]),
      cancel: vi.fn(),
      validateLease: vi.fn(async () => leaseProof({ active: false })),
      renewLease: vi.fn(),
      releaseLease: vi.fn(async () => undefined),
      recordAttemptSubmitted: vi.fn(),
      validateCurrentAttempt: vi.fn(),
      commitReceipt: vi.fn(),
      markIndeterminate: vi.fn(),
    })
    const { worker, provider } = workerFixture({ persistence })
    await expect(run(worker)).resolves.toMatchObject({ delivered: 0, failed: 1 })
    expect(provider.deliver).not.toHaveBeenCalled()
    expect(persistence.commitReceipt).not.toHaveBeenCalled()
  })

  it('requires the submitted attempt to remain current before receipt commit', async () => {
    const { worker, persistence } = workerFixture()
    persistence.validateCurrentAttempt.mockResolvedValue(attemptProof({ current: false }))
    await expect(run(worker)).resolves.toMatchObject({ delivered: 0, failed: 1 })
    expect(persistence.commitReceipt).not.toHaveBeenCalled()
    expect(persistence.releaseLease).toHaveBeenCalledOnce()
  })

  it.each([
    ['wrong job', { jobId: 'job:other' }],
    ['wrong attempt', { attemptId: 'attempt:other' }],
    ['wrong route', { routeRef: 'in-app-route:other' }],
    ['wrong recipient', { recipientRef: 'recipient:other' }],
    ['wrong household', { householdId: 'household:other' }],
    ['wrong student', { studentId: 'student:other' }],
    ['wrong provider version', { providerConfigVersion: 'in-app-config-v0' }],
    ['browser-authored receipt', { receiptSource: 'browser' }],
    ['test receipt in production', { testReceipt: true }],
  ])('rejects %s receipt evidence', async (_label, receiptPatch) => {
    const provider = readyPort({
      channel: 'in-app',
      providerName: 'academy-in-app',
      providerConfigVersion: 'in-app-config-v1',
      adultReviewInAppDeliveryPolicy: 'approved',
      isDurable: true,
      isTestProvider: false,
      deliver: vi.fn(async ({ onAttemptSubmitted }) => {
        await onAttemptSubmitted({ attemptId: CLAIM.attemptId })
        return {
          submitted: true,
          attemptId: CLAIM.attemptId,
          receipt: { ...RECEIPT, ...receiptPatch },
        }
      }),
    })
    const { worker, persistence } = workerFixture({ provider })
    await expect(run(worker)).resolves.toMatchObject({ delivered: 0, failed: 1 })
    expect(persistence.commitReceipt).not.toHaveBeenCalled()
  })

  it('rejects replayed receipt events and never claims delivery', async () => {
    const { worker, persistence } = workerFixture()
    persistence.commitReceipt.mockResolvedValue(commitProof({ committed: false, replayed: true }))
    await expect(run(worker)).resolves.toMatchObject({ delivered: 0, failed: 1 })
    expect(persistence.releaseLease).toHaveBeenCalledOnce()
  })

  it('refuses test, non-durable, or policy-unapproved in-app providers in production', () => {
    expect(() => workerFixture({
      provider: readyPort({ isDurable: true, isTestProvider: true, deliver: vi.fn() }),
    })).toThrow(AdultReviewWorkerConfigurationError)
    expect(() => workerFixture({
      provider: readyPort({ isDurable: false, isTestProvider: false, deliver: vi.fn() }),
    })).toThrow(AdultReviewWorkerConfigurationError)
    expect(() => workerFixture({
      provider: readyPort({
        channel: 'in-app', isDurable: true, isTestProvider: false,
        adultReviewInAppDeliveryPolicy: 'not-approved', deliver: vi.fn(),
      }),
    })).toThrow(AdultReviewWorkerConfigurationError)
  })
})

describe('adult-review HTTP boundaries', () => {
  it('supports authenticated scheduled invocation and minimized health', async () => {
    const runWorker = vi.fn(async () => ({ claimed: 2, delivered: 1, indeterminate: 1, failed: 0 }))
    const handler = createStudyAdultReviewWorkerHandler({
      worker: { ready: async () => ({ ready: true }), run: runWorker },
      workerAuthorization: readyPort({
        isDurable: true,
        credentialForEvent: async () => ({
          authorized: true,
          workerCredential: 'opaque-worker-credential-0000000000000001',
        }),
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
    expect(runWorker).toHaveBeenCalledWith({
      trigger: 'scheduled',
      workerCredential: 'opaque-worker-credential-0000000000000001',
      limit: 10,
    }, { limit: 10 })
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
    const runWorker = vi.fn()
    const handler = createStudyAdultReviewWorkerHandler({
      worker: { ready: async () => ({ ready: true }), run: runWorker },
      workerAuthorization: readyPort({
        isDurable: true,
        credentialForEvent: async () => ({ authorized: false }),
        recordDenied,
      }),
    })
    const response = await handler({
      httpMethod: 'POST',
      path: '/.netlify/functions/study-adult-review-worker',
      headers: { 'x-nf-event': 'schedule' },
    })
    expect(response.statusCode).toBe(403)
    expect(runWorker).not.toHaveBeenCalled()
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
