import { describe, expect, it, vi } from 'vitest'
import { createStudyProductionReadinessHandler } from '../../study-production-readiness.js'
import { ACADEMIC_SESSION_13_DEPENDENCIES } from './academic-readiness.js'
import {
  createStudyProductionReadinessService,
  readinessWireResult,
  STUDY_PRODUCTION_DEPENDENCIES,
  STUDY_PRODUCTION_READINESS_STATES,
} from './readiness.js'

const ALL_ACADEMIC_READY = Object.freeze(Object.fromEntries(
  ACADEMIC_SESSION_13_DEPENDENCIES.map((dependency) => [dependency, 'ready']),
))

function readyDependencies(overrides = {}) {
  return {
    identityVerifier: {
      isDurable: true,
      isReady: () => true,
      readiness: vi.fn(async () => ({ status: 'ready' })),
    },
    durablePorts: {
      refreshReadiness: vi.fn(async () => true),
      readAdultReviewReadiness: vi.fn(async () => ({
        state: 'ready',
        adultReviewInAppDeliveryPolicy: 'approved',
      })),
    },
    academicReadiness: vi.fn(async () => ({ ...ALL_ACADEMIC_READY })),
    classifier: {
      isConfigured: () => true,
      circuitState: () => 'closed',
    },
    session17: {
      authorizedRecipientResolver: vi.fn(async () => 'ready'),
      rateLimiter: vi.fn(async () => 'ready'),
      monitoringSink: vi.fn(async () => 'ready'),
      workerCredentialVerifier: vi.fn(async () => 'ready'),
      workerScheduler: vi.fn(async () => 'ready'),
      leaseOperations: vi.fn(async () => 'ready'),
      attemptStore: vi.fn(async () => 'ready'),
      operationalReadiness: vi.fn(async () => 'ready'),
      deliveryProvider: vi.fn(async () => 'ready'),
      receiptValidator: vi.fn(async () => 'ready'),
    },
    ...overrides,
  }
}

describe('Study production readiness assembly', () => {
  it('keeps unimplemented Session 17 ports explicitly not-ready', async () => {
    const dependencies = readyDependencies({ session17: undefined })
    const service = createStudyProductionReadinessService(dependencies)
    const snapshot = await service.check()

    expect(snapshot.status).toBe('not-ready')
    expect(snapshot.registrations).toContainEqual({ dependency: 'delivery-provider', status: 'not-ready' })
    expect(snapshot.registrations).toContainEqual({ dependency: 'receipt-validator', status: 'not-ready' })
    expect(snapshot.registrations).toHaveLength(17)
  })

  it('does not use the safety reconciliation probe as academic health', async () => {
    // Every safety/durable probe is ready; the academic probe answers not-ready.
    const dependencies = readyDependencies({
      academicReadiness: async () => Object.fromEntries(
        ACADEMIC_SESSION_13_DEPENDENCIES.map((dependency) => [dependency, 'not-ready']),
      ),
    })
    const snapshot = await createStudyProductionReadinessService(dependencies).check()
    expect(snapshot.registrations).toContainEqual({
      dependency: 'study-session-adapter',
      status: 'not-ready',
    })
    expect(snapshot.registrations).toContainEqual({ dependency: 'rate-limiter', status: 'ready' })
  })

  it('uses live identity and durable probes, caches only through TTL, and then revalidates', async () => {
    let currentTime = 10_000
    const dependencies = readyDependencies({ now: () => currentTime, ttlMs: 2_000 })
    const service = createStudyProductionReadinessService(dependencies)

    const first = await service.check()
    const cached = await service.check()
    expect(cached).toBe(first)
    expect(dependencies.identityVerifier.readiness).toHaveBeenCalledTimes(1)
    expect(dependencies.durablePorts.refreshReadiness).toHaveBeenCalledTimes(1)
    expect(dependencies.durablePorts.readAdultReviewReadiness).toHaveBeenCalledTimes(1)

    currentTime = 12_001
    const refreshed = await service.check()
    expect(refreshed).not.toBe(first)
    expect(dependencies.identityVerifier.readiness).toHaveBeenCalledTimes(2)
    expect(dependencies.durablePorts.refreshReadiness).toHaveBeenCalledTimes(2)
    expect(dependencies.durablePorts.readAdultReviewReadiness).toHaveBeenCalledTimes(2)
  })

  it('allows ready only with every real dependency and degrades on live classifier health', async () => {
    const ready = await createStudyProductionReadinessService(readyDependencies()).check()
    expect(ready.status).toBe('ready')

    const degraded = await createStudyProductionReadinessService(readyDependencies({
      classifier: { isConfigured: () => true, circuitState: () => 'open' },
    })).check()
    expect(degraded.status).toBe('degraded')
    expect(degraded.registrations).toContainEqual({
      dependency: 'production-classifier',
      status: 'degraded',
    })
  })

  it('requires explicit server-side approval for durable in-app delivery', async () => {
    const missing = await createStudyProductionReadinessService(readyDependencies({
      durablePorts: { refreshReadiness: vi.fn(async () => true) },
    })).check()
    expect(missing.status).toBe('not-ready')
    expect(missing.adultReviewInAppDeliveryPolicy).toBe('not-approved')

    const deniedDependencies = readyDependencies()
    deniedDependencies.durablePorts.readAdultReviewReadiness = vi.fn(async () => ({
      state: 'not-ready',
      adultReviewInAppDeliveryPolicy: 'not-approved',
    }))
    const denied = await createStudyProductionReadinessService(deniedDependencies).check()
    expect(denied.status).toBe('not-ready')
    expect(denied.registrations).toContainEqual({
      dependency: 'delivery-provider',
      status: 'not-ready',
    })
  })

  it('blocks readiness when any internal Session 17 operation is absent', async () => {
    const session17 = readyDependencies().session17
    const snapshot = await createStudyProductionReadinessService(readyDependencies({
      session17: { ...session17, workerCredentialVerifier: undefined },
    })).check()
    expect(snapshot.status).toBe('not-ready')
    expect(snapshot.registrations).toContainEqual({
      dependency: 'outbox-store',
      status: 'not-ready',
    })
  })

  it('projects only schema, state, and expiry to the client', async () => {
    const snapshot = await createStudyProductionReadinessService(readyDependencies()).check()
    const wire = readinessWireResult(snapshot)
    expect(Object.keys(wire)).toEqual(['schemaVersion', 'status', 'expiresAt'])
    expect(JSON.stringify(wire)).not.toMatch(/dependency|provider|recipient|secret|key/i)
  })
})

describe('Study production academic wire', () => {
  // Permanent RED for STUDY-A1-READINESS-WIRE. Every non-academic dependency is
  // ready and the server academic runtime transport is validly configured, so
  // the only reason the Session 13 statuses could be not-ready is the missing
  // academic probe in the production default composition.
  it('wires the real server academic runtime into the production default', async () => {
    const dependencies = readyDependencies()
    delete dependencies.academicReadiness
    const snapshot = await createStudyProductionReadinessService({
      ...dependencies,
      env: {
        SUPABASE_URL: 'https://study.example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'x'.repeat(48),
      },
      fetchImpl: async () => { throw new Error('readiness must not contact hosted systems') },
    }).check()

    expect(snapshot.registrations).toContainEqual({
      dependency: 'study-session-adapter',
      status: 'ready',
    })
    expect(snapshot.registrations).toContainEqual({
      dependency: 'checkpoint-adapter',
      status: 'ready',
    })
  })
})

const CONFIGURED_ENV = Object.freeze({
  SUPABASE_URL: 'https://study.example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'x'.repeat(48),
})

/** Every RPC a readiness GET is permitted to reach; all three are read-only. */
const READ_ONLY_READINESS_RPCS = Object.freeze([
  'academy_study_verified_identity_readiness_v1',
  'academy_study_safety_durable_readiness_v1',
  'academy_study_adult_review_readiness_v2',
])

const MUTATION_RPCS = Object.freeze([
  'academy_study_issue_guardian_launch_v1',
  'academy_study_execute_verified_runtime_v1',
  'academy_study_create_session',
  'academy_study_transition_session',
  'academy_study_compare_and_swap_checkpoint',
  'academy_study_append_event',
  'academy_study_create_adult_review_proposal_v1',
  'academy_study_claim_adult_review_proposals_v2',
  'academy_study_claim_delivery_jobs_v2',
  'academy_study_deliver_in_app_notification_v2',
  'academy_study_record_delivery_receipt_v1',
  'academy_study_reserve_rate_limit_v2',
])

/** Records every RPC the composition reaches and answers each one ready. */
function recordingRpcFetch(policy = 'approved') {
  const calls = []
  const bodyFor = (name) => {
    if (name === 'academy_study_verified_identity_readiness_v1') {
      return { schemaVersion: 1, status: 'ready' }
    }
    if (name === 'academy_study_safety_durable_readiness_v1') {
      return { schemaVersion: 1, status: 'ready' }
    }
    return { schemaVersion: 1, state: 'ready', adultReviewInAppDeliveryPolicy: policy }
  }
  const fetchImpl = vi.fn(async (url) => {
    const name = String(url).split('/rest/v1/rpc/')[1]
    calls.push(name)
    return { ok: true, json: async () => bodyFor(name) }
  })
  return { calls, fetchImpl }
}

describe('Study production full aggregate', () => {
  it('keeps the aggregate blocked when adult-review policy is not approved', async () => {
    // Phase 5: every academic dependency ready must not unblock the aggregate.
    const dependencies = readyDependencies()
    dependencies.durablePorts.readAdultReviewReadiness = vi.fn(async () => ({
      state: 'not-ready',
      adultReviewInAppDeliveryPolicy: 'not-approved',
    }))
    const snapshot = await createStudyProductionReadinessService(dependencies).check()

    for (const dependency of ACADEMIC_SESSION_13_DEPENDENCIES) {
      expect(snapshot.registrations).toContainEqual({ dependency, status: 'ready' })
    }
    expect(snapshot.adultReviewInAppDeliveryPolicy).toBe('not-approved')
    expect(snapshot.status).toBe('not-ready')
  })

  it('keeps the aggregate blocked when a Session 17 dependency is absent', async () => {
    const session17 = readyDependencies().session17
    const snapshot = await createStudyProductionReadinessService(readyDependencies({
      session17: { ...session17, receiptValidator: undefined },
    })).check()
    for (const dependency of ACADEMIC_SESSION_13_DEPENDENCIES) {
      expect(snapshot.registrations).toContainEqual({ dependency, status: 'ready' })
    }
    expect(snapshot.status).toBe('not-ready')
  })

  it('never reports the D1 worker scheduler ready while it is unwired', async () => {
    // Phase 6: manual-only D1 composition is not automatic-worker readiness.
    // Every other Session 17 operation is ready, so the scheduler alone decides.
    const session17 = readyDependencies().session17
    const blocked = await createStudyProductionReadinessService(readyDependencies({
      session17: { ...session17, workerScheduler: undefined },
    })).check()
    expect(blocked.registrations).toContainEqual({ dependency: 'outbox-store', status: 'not-ready' })
    expect(blocked.registrations).toContainEqual({
      dependency: 'delivery-provider', status: 'not-ready',
    })
    expect(blocked.status).toBe('not-ready')

    // The production composition supplies no Session 17 operation at all.
    const { fetchImpl } = recordingRpcFetch()
    const production = await createStudyProductionReadinessService({
      env: CONFIGURED_ENV,
      fetchImpl,
    }).check()
    expect(production.registrations).toContainEqual({
      dependency: 'outbox-store', status: 'not-ready',
    })
    expect(production.status).toBe('not-ready')
  })

  it('never approves production policy without a durable approved record', async () => {
    // Phase 7: approval is read, never assumed and never synthesized.
    for (const evidence of [
      { state: 'ready', adultReviewInAppDeliveryPolicy: 'not-approved' },
      { state: 'not-ready', adultReviewInAppDeliveryPolicy: 'approved' },
      { state: 'ready', adultReviewInAppDeliveryPolicy: 'APPROVED' },
      { state: 'ready' },
      null,
    ]) {
      const dependencies = readyDependencies()
      dependencies.durablePorts.readAdultReviewReadiness = vi.fn(async () => evidence)
      const snapshot = await createStudyProductionReadinessService(dependencies).check()
      expect(snapshot.status).toBe('not-ready')
      expect(snapshot.registrations).toContainEqual({
        dependency: 'delivery-provider', status: 'not-ready',
      })
    }

    const approved = await createStudyProductionReadinessService(readyDependencies()).check()
    expect(approved.adultReviewInAppDeliveryPolicy).toBe('approved')
  })
})

describe('Study production readiness side effects and privacy', () => {
  it('reaches only read-only readiness RPCs across a full production GET', async () => {
    // Phase 8: no grant, session, checkpoint, notification, or claim RPC.
    const { calls, fetchImpl } = recordingRpcFetch()
    const handler = createStudyProductionReadinessHandler({
      env: { ...CONFIGURED_ENV, ACADEMY_STUDY_ENABLED: 'true' },
      fetchImpl,
      authVerifier: vi.fn(async () => ({ ok: true })),
    })
    const response = await handler({
      httpMethod: 'GET',
      path: '/api/study/production/readiness',
      headers: { authorization: 'Bearer synthetic-token' },
    })

    expect(response.statusCode).toBe(503)
    // Non-vacuous: the whole composition ran and reached exactly these three.
    expect([...new Set(calls)].sort()).toEqual([...READ_ONLY_READINESS_RPCS].sort())
    for (const mutation of MUTATION_RPCS) expect(calls).not.toContain(mutation)
  })

  it('publishes only canonical dependency keys and closed-vocabulary states', async () => {
    // Phase 9: the academic wire adds no learner-identifying field.
    const snapshot = await createStudyProductionReadinessService(readyDependencies()).check()
    expect(Object.keys(snapshot)).toEqual([
      'schemaVersion', 'status', 'checkedAtMs', 'expiresAtMs',
      'registrations', 'adultReviewInAppDeliveryPolicy',
    ])
    expect(snapshot.registrations.map(({ dependency }) => dependency))
      .toEqual([...STUDY_PRODUCTION_DEPENDENCIES])
    for (const registration of snapshot.registrations) {
      // Only the sanitized operational pair; no probe evidence rides along.
      expect(Object.keys(registration)).toEqual(['dependency', 'status'])
      expect(STUDY_PRODUCTION_READINESS_STATES).toContain(registration.status)
    }
    // No identifier, opaque reference, or credential-shaped value anywhere.
    expect(JSON.stringify(snapshot)).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}|aca_stu_|[0-9a-f]{32}|Bearer|eyJ/i,
    )
  })
})

describe('Study production academic fail-closed aggregation', () => {
  it('treats a throwing, malformed, or partial academic probe as not-ready', async () => {
    const academicIsNotReady = async (probe) => {
      const snapshot = await createStudyProductionReadinessService(
        readyDependencies({ academicReadiness: probe }),
      ).check()
      for (const dependency of ACADEMIC_SESSION_13_DEPENDENCIES) {
        expect(snapshot.registrations).toContainEqual({ dependency, status: 'not-ready' })
      }
      expect(snapshot.status).toBe('not-ready')
    }

    await academicIsNotReady(async () => { throw new Error('academic probe unavailable') })
    await academicIsNotReady(() => { throw new Error('academic probe unavailable') })
    await academicIsNotReady(async () => 'ready')
    await academicIsNotReady(async () => null)
    await academicIsNotReady(async () => [])
    await academicIsNotReady(async () => ({}))
    await academicIsNotReady(async () => Object.create(ALL_ACADEMIC_READY))
    await academicIsNotReady(async () => Object.fromEntries(
      ACADEMIC_SESSION_13_DEPENDENCIES.map((dependency) => [dependency, 'READY']),
    ))
    await academicIsNotReady('not-a-function')

    // A throwing accessor must not leave earlier keys reported ready.
    await academicIsNotReady(async () => ({
      ...ALL_ACADEMIC_READY,
      get 'event-ledger'() { throw new Error('academic probe hostile') },
    }))
  })

  it('reports each academic dependency independently', async () => {
    const snapshot = await createStudyProductionReadinessService(readyDependencies({
      academicReadiness: async () => ({ ...ALL_ACADEMIC_READY, 'review-queue': 'degraded' }),
    })).check()
    expect(snapshot.registrations).toContainEqual({ dependency: 'review-queue', status: 'degraded' })
    expect(snapshot.registrations).toContainEqual({
      dependency: 'study-session-adapter', status: 'ready',
    })
    expect(snapshot.status).toBe('degraded')
  })
})

describe('Study production readiness endpoint', () => {
  it('authenticates, returns minimized 503 readiness, and rejects unsupported requests', async () => {
    const check = vi.fn(async () => ({
      status: 'not-ready',
      expiresAtMs: Date.parse('2026-08-01T16:00:05.000Z'),
      registrations: [{ dependency: 'delivery-provider', status: 'not-ready', secret: 'hidden' }],
    }))
    const authVerifier = vi.fn(async () => ({ ok: true, user: { id: 'synthetic-user' } }))
    const handler = createStudyProductionReadinessHandler({
      readiness: { check },
      authVerifier,
    })

    const response = await handler({
      httpMethod: 'GET',
      path: '/api/study/production/readiness',
      headers: { authorization: 'Bearer synthetic-token' },
    })
    expect(response.statusCode).toBe(503)
    expect(JSON.parse(response.body)).toEqual({
      schemaVersion: 1,
      status: 'not-ready',
      expiresAt: '2026-08-01T16:00:05.000Z',
    })
    expect(response.body).not.toMatch(/dependency|provider|recipient|secret|hidden/i)
    expect(authVerifier).toHaveBeenCalledTimes(1)
    expect(check).toHaveBeenCalledTimes(1)

    expect((await handler({ httpMethod: 'POST', path: '/api/study/production/readiness' })).statusCode).toBe(405)
    expect((await handler({
      httpMethod: 'GET', path: '/api/study/production/readiness', rawQuery: 'details=true',
    })).statusCode).toBe(400)
  })

  it('does not run dependency probes for an unauthenticated request', async () => {
    const check = vi.fn()
    const handler = createStudyProductionReadinessHandler({
      readiness: { check },
      authVerifier: async () => ({ ok: false, response: { statusCode: 401, body: '{}' } }),
    })
    const response = await handler({ httpMethod: 'GET', path: '/api/study/production/readiness' })
    expect(response.statusCode).toBe(401)
    expect(check).not.toHaveBeenCalled()
  })
})
