import { describe, expect, it, vi } from 'vitest'
import { createSupabaseServiceRpc, createSupabaseStudySafetyPorts } from './supabase-ports.js'

describe('durable Supabase safety/adult-review ports', () => {
  it('adds worker authority only for explicitly credential-bound calls', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ recorded: true }) }))
    const workerCredential = 'synthetic-worker-credential-0123456789abcdef'
    const rpc = createSupabaseServiceRpc({
      env: {
        SUPABASE_URL: 'https://synthetic.invalid',
        SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role',
        ACADEMY_STUDY_ADULT_REVIEW_WORKER_ID: 'worker:adult-review',
        ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL: workerCredential,
        ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_VERSION: 'credential-v2',
        ACADEMY_STUDY_ADULT_REVIEW_WORKER_CONFIGURATION_VERSION: 'configuration-v3',
      },
      fetchImpl,
    })

    await rpc.call('ordinary_rpc')
    expect(fetchImpl.mock.calls[0][1].headers).not.toHaveProperty('x-academy-study-worker-credential')

    await rpc.call('worker_rpc', {}, {
      requireWorkerCredential: true,
      workerContext: {
        workerIdentity: 'worker:adult-review',
        credentialVersion: 'credential-v2',
      },
    })
    expect(fetchImpl.mock.calls[1][1].headers).toMatchObject({
      'x-academy-study-worker-credential': workerCredential,
      'x-academy-study-worker-credential-version': 'credential-v2',
      'x-academy-study-worker-configuration-version': 'configuration-v3',
    })

    await expect(rpc.call('worker_rpc', {}, {
      requireWorkerCredential: true,
      workerContext: { workerIdentity: 'worker:forged', credentialVersion: 'credential-v2' },
    })).rejects.toThrow('worker_credential_not_configured')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('stays not-ready until the installed reconciliation schema proves readiness', async () => {
    const call = vi.fn(async (name) => {
      if (name === 'academy_study_safety_durable_readiness_v1') return { status: 'ready', schemaVersion: 1 }
      throw new Error('unexpected_rpc')
    })
    const ports = createSupabaseStudySafetyPorts({ rpc: { isConfigured: () => true, call } })
    expect(ports.proposalPersistence.isDurable).toBe(true)
    expect(ports.proposalPersistence.isReady()).toBe(false)
    expect(await ports.refreshReadiness()).toBe(true)
    expect(ports.proposalPersistence.isReady()).toBe(true)
    expect(call).toHaveBeenCalledWith('academy_study_safety_durable_readiness_v1')
  })

  it('fails closed on missing or malformed readiness evidence', async () => {
    const rpc = { isConfigured: () => true, call: vi.fn(async () => ({ status: 'ready', schemaVersion: 2 })) }
    const ports = createSupabaseStudySafetyPorts({ rpc })
    expect(await ports.refreshReadiness()).toBe(false)
    expect(ports.outbox.isReady()).toBe(false)
    rpc.call.mockRejectedValueOnce(new Error('schema unavailable'))
    expect(await ports.refreshReadiness()).toBe(false)
  })

  it('maps only the service-only v1 RPC surface and preserves opaque scoped reservations', async () => {
    const calls = []
    const rpc = {
      isConfigured: () => true,
      async call(name, parameters) {
        calls.push({ name, parameters })
        if (name === 'academy_study_safety_durable_readiness_v1') return { status: 'ready', schemaVersion: 1 }
        if (name === 'academy_study_create_adult_review_proposal_v1') return { created: true }
        if (name === 'academy_study_reserve_safety_rate_limit_v1') return { allowed: true }
        if (name === 'academy_study_record_safety_monitoring_event_v1') return { recorded: true }
        throw new Error('unexpected_rpc')
      },
    }
    const ports = createSupabaseStudySafetyPorts({ rpc })
    await ports.refreshReadiness()
    const proposal = {
      schemaVersion: 1,
      proposalId: 'safety-proposal-opaque',
      householdId: 'opaque-household',
      studentId: 'opaque-student',
      sessionId: 'opaque-session',
      category: 'student-support',
      classification: 'urgent',
      urgency: 'urgent',
      reasonCodes: ['safety-provider-urgent-v1'],
      classifierVersion: 'opaque-classifier',
      occurredAt: '2026-08-01T12:00:00.000Z',
      idempotencyKey: 'opaque-idempotency',
      deliveryState: 'proposed-not-delivered',
      authorizedRecipientResolutionState: 'pending',
    }
    expect(await ports.proposalPersistence.createProposal({ proposal })).toEqual({ created: true })
    await ports.rateLimiter.reserve({
      actorRef: 'actor:opaque', householdRef: 'household:opaque', learnerRef: 'learner:opaque',
      routeRef: 'route:opaque', scope: 'study-safety-classify-subject-route', now: 1,
    })
    await ports.monitoring.record({ schemaVersion: 1, eventId: 'opaque-event' })
    expect(calls.map((entry) => entry.name)).toEqual([
      'academy_study_safety_durable_readiness_v1',
      'academy_study_create_adult_review_proposal_v1',
      'academy_study_reserve_safety_rate_limit_v1',
      'academy_study_record_safety_monitoring_event_v1',
    ])
    expect(JSON.stringify(calls)).not.toContain('transientText')
    expect(JSON.stringify(calls)).not.toContain('destination')
  })
})
