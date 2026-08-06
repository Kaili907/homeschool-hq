import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseInAppPersistence } from './supabase-in-app.js'
import {
  IN_APP_DELIVERY_RPC_KEYS,
  IN_APP_VERIFY_RPC_KEYS,
} from './in-app-receipt-validator.js'

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

const IDEMPOTENCY_KEY = `study-safety-delivery:${'a'.repeat(64)}`
const LEASE_TOKEN = 'lease:synthetic-secret-token'
const SERVICE_KEY = 'service-role-key:synthetic-secret'

const INSERT_INPUT = Object.freeze({
  workerContext: WORKER_CONTEXT,
  schemaVersion: 1,
  providerName: 'academy-in-app',
  providerConfigVersion: 'in-app-config-v1',
  deliveryIdempotencyKey: IDEMPOTENCY_KEY,
  jobId: 'job:synthetic',
  attemptId: 'attempt:synthetic',
  proposalId: 'proposal:synthetic',
  householdId: 'household:synthetic',
  studentId: 'student:synthetic',
  recipientRef: 'recipient:synthetic',
  routeRef: 'in-app-route:synthetic',
  templateCode: 'study-safety-adult-review-v1',
})

const VERIFY_BINDING = Object.freeze({
  workerContext: WORKER_CONTEXT,
  providerReceiptRef: 'in-app-receipt:synthetic',
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

const WORKER_ENV = Object.freeze({
  SUPABASE_URL: 'https://synthetic.supabase.invalid',
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  ACADEMY_STUDY_ADULT_REVIEW_WORKER_ID: WORKER_CONTEXT.workerIdentity,
  ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL: 'worker-credential:'.padEnd(64, 'z'),
  ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_VERSION: WORKER_CONTEXT.credentialVersion,
  ACADEMY_STUDY_ADULT_REVIEW_WORKER_CONFIGURATION_VERSION: 'worker-config-v1',
})

function lease(overrides = {}) {
  return {
    active: true,
    currentAttempt: true,
    leaseToken: LEASE_TOKEN,
    expectedRevision: 7,
    ...overrides,
  }
}

function persistence(overrides = {}) {
  const call = overrides.call ?? vi.fn(async (name) =>
    name.includes('verify') ? { verified: true } : { state: 'delivered' })
  const forAttempt = overrides.forAttempt ?? vi.fn(async () => lease())
  return {
    call,
    forAttempt,
    port: createSupabaseInAppPersistence({
      rpc: { isConfigured: () => true, call },
      leaseContext: { forAttempt },
    }),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Supabase in-app persistence', () => {
  it('binds delivery and receipt RPCs to the verified worker credential context', async () => {
    const { call, port } = persistence()

    await port.insertNotification(INSERT_INPUT)
    await port.verifyNotificationReceipt(VERIFY_BINDING)

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

  it('sends only the exact key sets the v2 RPCs accept', async () => {
    const { call, port } = persistence()

    await port.insertNotification(INSERT_INPUT)
    await port.verifyNotificationReceipt(VERIFY_BINDING)

    expect(Object.keys(call.mock.calls[0][1].p_delivery).sort())
      .toEqual([...IN_APP_DELIVERY_RPC_KEYS].sort())
    expect(Object.keys(call.mock.calls[1][1].p_binding).sort())
      .toEqual([...IN_APP_VERIFY_RPC_KEYS].sort())
  })

  it('forwards the exact proposal, household, student, job, attempt and lease binding', async () => {
    const { call, port } = persistence()

    await port.insertNotification(INSERT_INPUT)

    expect(call.mock.calls[0][1]).toEqual({
      p_worker_id: WORKER_CONTEXT.workerIdentity,
      p_delivery: {
        schemaVersion: 2,
        jobId: INSERT_INPUT.jobId,
        leaseToken: LEASE_TOKEN,
        expectedRevision: 7,
        attemptId: INSERT_INPUT.attemptId,
        deliveryIdempotencyKey: IDEMPOTENCY_KEY,
        recipientRef: INSERT_INPUT.recipientRef,
        routeRef: INSERT_INPUT.routeRef,
        proposalId: INSERT_INPUT.proposalId,
        householdId: INSERT_INPUT.householdId,
        studentId: INSERT_INPUT.studentId,
        providerName: 'academy-in-app',
        providerConfigVersion: 'in-app-config-v1',
      },
    })
  })

  it('never forwards the template code or any non-binding delivery field', async () => {
    const { call, port } = persistence()

    await port.insertNotification({ ...INSERT_INPUT, messageBody: 'synthetic body' })

    expect(JSON.stringify(call.mock.calls[0][1]))
      .not.toMatch(/messageBody|templateCode|synthetic body/)
  })

  it('forwards the lease revision verbatim so the durable CAS rejects a stale revision', async () => {
    const { call, port } = persistence({ forAttempt: vi.fn(async () => lease({ expectedRevision: 3 })) })

    await port.insertNotification(INSERT_INPUT)

    expect(call.mock.calls[0][1].p_delivery.expectedRevision).toBe(3)
  })

  it.each([
    ['missing revision', { expectedRevision: undefined }],
    ['non-integer revision', { expectedRevision: 7.5 }],
    ['stale lease', { active: false }],
    ['superseded attempt', { currentAttempt: false }],
    ['missing lease token', { leaseToken: undefined }],
  ])('refuses to attempt delivery on a %s', async (_label, patch) => {
    const { call, port } = persistence({ forAttempt: vi.fn(async () => lease(patch)) })

    await expect(port.insertNotification(INSERT_INPUT))
      .rejects.toThrow('in_app_lease_context_invalid')
    expect(call).not.toHaveBeenCalled()
  })

  it('refuses an unverified, revoked, expired or wrong-scope worker context', async () => {
    const { call, port } = persistence()
    for (const patch of [
      { verified: false },
      { revoked: true },
      { expiresAt: '2020-01-01T00:00:00.000Z' },
      { scope: 'study:adult-review:read' },
    ]) {
      const workerContext = { ...WORKER_CONTEXT, ...patch }
      await expect(port.insertNotification({ ...INSERT_INPUT, workerContext }))
        .rejects.toThrow('worker_credential_verification_failed')
      await expect(port.verifyNotificationReceipt({ ...VERIFY_BINDING, workerContext }))
        .rejects.toThrow('worker_credential_verification_failed')
    }
    expect(call).not.toHaveBeenCalled()
  })

  it('is not ready and refuses both operations without an rpc and lease context', async () => {
    const unconfigured = createSupabaseInAppPersistence({
      rpc: { isConfigured: () => false, call: vi.fn() },
      leaseContext: { forAttempt: vi.fn() },
    })
    expect(unconfigured.isReady()).toBe(false)
    await expect(unconfigured.insertNotification(INSERT_INPUT))
      .rejects.toThrow('in_app_persistence_not_ready')
    await expect(unconfigured.verifyNotificationReceipt(VERIFY_BINDING))
      .rejects.toThrow('in_app_persistence_not_ready')

    const noLease = createSupabaseInAppPersistence({
      rpc: { isConfigured: () => true, call: vi.fn() },
    })
    expect(noLease.isReady()).toBe(false)
  })

  it('refuses a receipt binding that is not the exact verification contract', async () => {
    const { call, port } = persistence()
    for (const binding of [
      { ...VERIFY_BINDING, extraField: 'synthetic' },
      (({ providerReceiptRef: _dropped, ...rest }) => rest)(VERIFY_BINDING),
    ]) {
      await expect(port.verifyNotificationReceipt(binding))
        .rejects.toThrow('in_app_receipt_binding_contract')
    }
    expect(call).not.toHaveBeenCalled()
  })

  it('uses only the injected fetch and leaks no credential or lease token on failure', async () => {
    const hostedFetch = vi.fn(async () => { throw new Error('hosted traffic is forbidden') })
    vi.stubGlobal('fetch', hostedFetch)
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ state: 'delivered' }) }))
    const port = createSupabaseInAppPersistence({
      env: WORKER_ENV,
      fetchImpl,
      leaseContext: { forAttempt: vi.fn(async () => lease()) },
    })

    await port.insertNotification(INSERT_INPUT)

    expect(hostedFetch).not.toHaveBeenCalled()
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(fetchImpl.mock.calls[0][0]).toBe(
      `${WORKER_ENV.SUPABASE_URL}/rest/v1/rpc/academy_study_deliver_in_app_notification_v2`,
    )

    const failing = createSupabaseInAppPersistence({
      env: WORKER_ENV,
      fetchImpl: vi.fn(async () => ({ ok: false, json: async () => ({}) })),
      leaseContext: { forAttempt: vi.fn(async () => lease()) },
    })
    const error = await failing.insertNotification(INSERT_INPUT).catch((thrown) => thrown)
    expect(error.message).toBe('durable_port_unavailable')
    expect(`${error.message}${error.stack}`).not.toContain(LEASE_TOKEN)
    expect(`${error.message}${error.stack}`).not.toContain(SERVICE_KEY)
    expect(`${error.message}${error.stack}`)
      .not.toContain(WORKER_ENV.ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL)
    expect(hostedFetch).not.toHaveBeenCalled()
  })
})
