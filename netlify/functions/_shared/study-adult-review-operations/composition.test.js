import { readFileSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStudyAdultReviewWorkerHandler } from '../../study-adult-review-worker.js'
import { createMonitoringService, createStructuredServerLog } from '../study-monitoring/monitoring.js'
import { createSupabaseAdultReviewOperations } from './supabase-operations.js'
import {
  ADULT_REVIEW_CLAIM_KEYS,
  AdultReviewCompositionError,
  createAdultReviewWorkerMonitorAdapter,
  createInAppAdultReviewClaimSchema,
  createInAppRecipientProjection,
  createProductionAdultReviewWorkerComposition,
} from './composition.js'

const HEX = (character) => character.repeat(64)
const RECIPIENT_REF = `recipient:${HEX('a')}`
const ROUTE_REF = `route:${HEX('b')}`
const DELIVERY_KEY = `delivery:${HEX('c')}`
const FAR_FUTURE = '2099-01-01T00:00:00.000Z'
// The M1 claim and the renew RPC project a raw timestamptz; M2 emits
// normalized UTC milliseconds. Both shapes are exercised deliberately.
const FAR_FUTURE_RAW = '2099-01-01 00:00:00.123456+00'

const WORKER_CREDENTIAL = 'opaque-adult-review-worker-credential-000001'
const INVOCATION_SECRET = 'opaque-adult-review-invocation-secret-000001'

const ENV = Object.freeze({
  ACADEMY_STUDY_ENABLED: 'true',
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-0000000000000000000000',
  ACADEMY_STUDY_ADULT_REVIEW_WORKER_ID: 'worker:adult-review:1',
  ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_ID: 'credential:adult-review:1',
  ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL: WORKER_CREDENTIAL,
  ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_VERSION: 'v1',
  ACADEMY_STUDY_ADULT_REVIEW_WORKER_CONFIGURATION_VERSION: 'cfg-v1',
  ACADEMY_STUDY_ADULT_REVIEW_WORKER_INVOCATION_SECRET: INVOCATION_SECRET,
})

function claimJob(overrides = {}) {
  return {
    claimId: 'claim:0001',
    jobId: 'job:0001',
    proposalId: 'proposal:0001',
    householdId: 'household:0001',
    studentId: 'student:0001',
    templateCode: 'study-safety-adult-review-v1',
    recipientRef: RECIPIENT_REF,
    routeRef: ROUTE_REF,
    route: 'in-app',
    idempotencyKey: DELIVERY_KEY,
    leaseToken: 'lease:0001',
    leaseExpiresAt: FAR_FUTURE_RAW,
    leaseGeneration: 7,
    revision: 1,
    ...overrides,
  }
}

/**
 * A fetch implementation that speaks the accepted C2 v2 SQL contract. The
 * whole graph runs through the real `createSupabaseServiceRpc`, so the durable
 * credential headers, the exact-key envelopes, and the timestamp shapes are
 * all exercised rather than stubbed away.
 */
function createDurableEstate({ jobs = [claimJob()] } = {}) {
  const calls = []
  const revisions = new Map(jobs.map((job) => [job.jobId, job.revision]))
  const attemptOf = (jobId) => {
    const job = jobs.find((candidate) => candidate.jobId === jobId)
    return `attempt:${jobId}:${job?.leaseGeneration ?? 0}`
  }

  function leaseProof(jobId) {
    const job = jobs.find((candidate) => candidate.jobId === jobId)
    return {
      active: true,
      jobId,
      leaseToken: job?.leaseToken ?? 'lease:unknown',
      leaseRevision: revisions.get(jobId) ?? 1,
      leaseExpiresAt: FAR_FUTURE,
    }
  }

  function attemptProof(jobId) {
    const job = jobs.find((candidate) => candidate.jobId === jobId)
    return {
      current: true,
      attemptId: attemptOf(jobId),
      jobId,
      leaseToken: job?.leaseToken ?? 'lease:unknown',
      deliveryIdempotencyKey: job?.idempotencyKey ?? DELIVERY_KEY,
      providerName: 'academy-in-app',
      providerConfigVersion: 'in-app-config-v1',
    }
  }

  function receiptFor(jobId) {
    const job = jobs.find((candidate) => candidate.jobId === jobId)
    return {
      verified: true,
      receiptSchemaVersion: 1,
      providerReceiptRef: `in-app-receipt:${jobId.replace(':', '-')}`,
      providerName: 'academy-in-app',
      route: 'in-app',
      routeRef: job.routeRef,
      jobId,
      attemptId: attemptOf(jobId),
      proposalId: job.proposalId,
      householdId: job.householdId,
      studentId: job.studentId,
      recipientRef: job.recipientRef,
      deliveryIdempotencyKey: job.idempotencyKey,
      providerConfigVersion: 'in-app-config-v1',
      deliveredAt: '2026-08-07T00:00:00.000Z',
      evidenceRef: `in-app-evidence:${jobId.replace(':', '-')}`,
      eventIdempotencyKey: `event:${jobId.replace(':', '-')}`,
      receiptSource: 'server-verified',
      testReceipt: false,
    }
  }

  const handlers = {
    academy_study_safety_durable_readiness_v1: () => ({ status: 'ready', schemaVersion: 1 }),
    academy_study_adult_review_readiness_v2: () => ({
      state: 'ready', adultReviewInAppDeliveryPolicy: 'approved',
    }),
    academy_study_claim_delivery_jobs_v2: () => ({ jobs, serverTime: FAR_FUTURE }),
    academy_study_prove_delivery_lease_v2: (parameters) => leaseProof(parameters.p_job_id),
    academy_study_renew_delivery_lease_v2: (parameters) => {
      const next = (revisions.get(parameters.p_job_id) ?? 1) + 1
      revisions.set(parameters.p_job_id, next)
      return { renewed: true, revision: next, leaseExpiresAt: FAR_FUTURE_RAW }
    },
    academy_study_create_delivery_attempt_v2: (parameters) => {
      const jobId = parameters.p_attempt.jobId
      const next = (revisions.get(jobId) ?? 1) + 1
      revisions.set(jobId, next)
      return { created: true, attemptId: parameters.p_attempt.attemptId, revision: next }
    },
    academy_study_record_attempt_event_v2: (parameters) => ({
      recorded: true, state: parameters.p_event.state,
    }),
    academy_study_prove_current_attempt_v2: (parameters) => attemptProof(parameters.p_job_id),
    academy_study_deliver_in_app_notification_v2: (parameters) => {
      const jobId = parameters.p_delivery.jobId
      const job = jobs.find((candidate) => candidate.jobId === jobId)
      return {
        state: 'delivered',
        providerReceiptRef: receiptFor(jobId).providerReceiptRef,
        jobId,
        attemptId: attemptOf(jobId),
        proposalId: job.proposalId,
        householdId: job.householdId,
        studentId: job.studentId,
        deliveryIdempotencyKey: job.idempotencyKey,
        recipientRef: job.recipientRef,
        routeRef: job.routeRef,
        providerName: 'academy-in-app',
        providerConfigVersion: 'in-app-config-v1',
        notification: {
          title: 'Study check-in needs your review',
          reasonCategory: 'review-required',
          urgency: 'review-required',
          actionRef: `adult-review:${jobId.replace(':', '-')}`,
        },
      }
    },
    academy_study_verify_in_app_notification_v2: (parameters) => receiptFor(parameters.p_binding.jobId),
    academy_study_cancel_delivery_job_v2: (parameters) => ({
      cancelled: true,
      replay: false,
      state: 'cancelled',
      jobId: parameters.p_job_id,
      reasonCode: parameters.p_reason_code,
      revision: (revisions.get(parameters.p_job_id) ?? 1) + 1,
    }),
    academy_study_release_delivery_lease_v2: () => ({ released: true }),
    academy_study_record_adult_review_monitoring_v2: () => ({ recorded: true }),
  }

  const overrides = new Map()

  const fetchImpl = async (url, init) => {
    const name = String(url).split('/rpc/')[1]
    const parameters = JSON.parse(init.body)
    calls.push({ name, parameters, headers: init.headers })
    const handler = overrides.get(name) ?? handlers[name]
    if (!handler) return { ok: false, status: 404, json: async () => ({}) }
    const body = handler(parameters)
    if (body === undefined) return { ok: false, status: 500, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => body }
  }

  return {
    fetchImpl,
    calls,
    names: () => calls.map((call) => call.name),
    countOf: (name) => calls.filter((call) => call.name === name).length,
    callsTo: (name) => calls.filter((call) => call.name === name),
    override: (name, handler) => overrides.set(name, handler),
  }
}

function workerEvent({ headers = {}, body } = {}) {
  return {
    httpMethod: 'POST',
    path: '/api/study/adult-review/worker',
    headers: { 'content-type': 'application/json', ...headers },
    body: body ?? JSON.stringify({ schemaVersion: 2, action: 'process-pending' }),
  }
}

function manualEvent(extra = {}) {
  return workerEvent({
    headers: { 'x-academy-study-worker-invocation': INVOCATION_SECRET, ...extra },
  })
}

function handlerFor(estate, env = ENV) {
  return createStudyAdultReviewWorkerHandler({
    env,
    compose: (options) => createProductionAdultReviewWorkerComposition({
      ...options,
      fetchImpl: estate.fetchImpl,
    }),
  })
}

let logSpy

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  logSpy.mockRestore()
})

describe('D1 composition: one operations instance', () => {
  it('gives the in-app persistence the same operations instance lease context', async () => {
    const estate = createDurableEstate()
    const graph = await createProductionAdultReviewWorkerComposition({
      env: ENV, fetchImpl: estate.fetchImpl,
    })
    expect(graph.inAppLeaseContext).toBe(graph.operations.leaseContext)
  })

  it('proves the shared instance is load-bearing: a second adapter holds no claim', async () => {
    const estate = createDurableEstate()
    const graph = await createProductionAdultReviewWorkerComposition({
      env: ENV, fetchImpl: estate.fetchImpl,
    })
    const response = await handlerFor(estate)(manualEvent())
    expect(JSON.parse(response.body).delivered).toBe(1)

    // The lease context only knows a job because the very same operations
    // instance claimed it. An independently constructed adapter -- the exact
    // mistake this composition forbids -- has an empty claim map, so every
    // delivery under it would fail before the provider is reached.
    const second = createSupabaseAdultReviewOperations({ env: ENV, fetchImpl: estate.fetchImpl })
    expect(second.leaseContext).not.toBe(graph.operations.leaseContext)
    await expect(second.leaseContext.forAttempt({
      jobId: 'job:0001',
      attemptId: 'attempt:job:0001:7',
      workerContext: {
        schemaVersion: 1,
        workerIdentity: ENV.ACADEMY_STUDY_ADULT_REVIEW_WORKER_ID,
        credentialId: ENV.ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_ID,
        credentialVersion: 'v1',
        scope: 'study:adult-review:delivery',
        expiresAt: FAR_FUTURE,
        verifierVersion: 'netlify-adult-review-worker-verifier-v1',
        verificationRef: `verification:${HEX('d')}`,
      },
    })).rejects.toThrow('lease_context_unknown_job')
  })
})

describe('D1 composition: monitoring shape defect', () => {
  const workerShape = {
    occurredAt: '2026-08-07T00:00:00.000Z',
    occurrences: 1,
    value: 1,
    workerIdentity: 'worker:adult-review:1',
    workerCredentialVersion: 'v1',
    workerVerificationRef: `verification:${HEX('d')}`,
  }

  function realMonitoring(written) {
    return createMonitoringService({
      durableSink: Object.freeze({
        durable: true,
        name: 'test-sink',
        isReady: () => true,
        write: async (event) => { written.push(event) },
      }),
      serverLog: createStructuredServerLog(() => {}, 'test_log'),
      environment: 'production',
    })
  }

  it('RED: the raw worker event shape is rejected by the real monitoring schema', async () => {
    const monitoring = realMonitoring([])
    await expect(
      monitoring.record('study.adult_review.delivery_permanent_failure', workerShape),
    ).rejects.toThrow('monitoring_schema_field_not_allowed')
  })

  it('GREEN: the adapter forwards only allowed fields and safe constant dimensions', async () => {
    const written = []
    const monitor = createAdultReviewWorkerMonitorAdapter(realMonitoring(written))
    await monitor.record('study.adult_review.delivery_permanent_failure', workerShape)
    await monitor.record('study.adult_review.recipient_resolution_failure', workerShape)
    await monitor.record('study.adult_review.indeterminate_job', workerShape)

    expect(written).toHaveLength(3)
    for (const event of written) {
      expect(JSON.stringify(event)).not.toContain('workerIdentity')
      expect(JSON.stringify(event)).not.toContain('verification:')
      expect(event.dimensions.environment).toBe('production')
      expect(event.measurement.value).toBe(1)
    }
    // `recipient_resolution_failure` does not permit a `provider` dimension,
    // so the adapter narrows the constant set per event rather than forcing a
    // field the schema would reject.
    expect(written[0].dimensions).toEqual({
      environment: 'production', route: 'in-app', provider: 'academy-in-app',
    })
    expect(written[1].dimensions).toEqual({ environment: 'production', route: 'in-app' })
    expect(written[2].dimensions).toEqual({
      environment: 'production', route: 'in-app', provider: 'academy-in-app',
    })
  })
})

describe('D1 composition: in-app claim schema gate', () => {
  const schema = createInAppAdultReviewClaimSchema()
  const validClaim = Object.freeze({
    claimId: 'claim:0001',
    jobId: 'job:0001',
    proposalId: 'proposal:0001',
    householdId: 'household:0001',
    studentId: 'student:0001',
    templateCode: 'study-safety-adult-review-v1',
    recipientRef: RECIPIENT_REF,
    routeRef: ROUTE_REF,
    route: 'in-app',
    idempotencyKey: DELIVERY_KEY,
    attemptId: 'attempt:job:0001:7',
    leaseToken: 'lease:0001',
    leaseGeneration: 7,
    leaseRevision: 1,
    leaseExpiresAt: FAR_FUTURE,
  })

  it('accepts the exact C2 claim projection unchanged', () => {
    expect(Object.keys(validClaim).sort()).toEqual([...ADULT_REVIEW_CLAIM_KEYS].sort())
    expect(schema.safeParse(validClaim)).toEqual({ success: true, data: validClaim })
  })

  it.each(['email', 'sms', 'webhook', 'IN-APP', '', null, 1])(
    'rejects route %p as invalid_delivery',
    (route) => {
      expect(schema.safeParse({ ...validClaim, route })).toEqual({
        success: false, error: 'invalid_delivery',
      })
    },
  )

  it('is a closed object: extra or missing keys are rejected', () => {
    expect(schema.safeParse({ ...validClaim, extra: 1 }).success).toBe(false)
    const { attemptId: _dropped, ...missing } = validClaim
    expect(schema.safeParse(missing).success).toBe(false)
  })

  it.each([
    ['recipientRef', 'recipient:not-hex'],
    ['routeRef', `recipient:${HEX('b')}`],
    ['idempotencyKey', `delivery:${HEX('C')}`],
    ['templateCode', 'study-safety-other-v1'],
    ['leaseRevision', '1'],
    ['leaseExpiresAt', '2099-01-01T00:00:00Z'],
  ])('rejects a malformed %s', (key, value) => {
    expect(schema.safeParse({ ...validClaim, [key]: value }).success).toBe(false)
  })
})

describe('D1 composition: recipient resolver is a pure projection', () => {
  const resolver = createInAppRecipientProjection()

  it('returns exactly the durable recipientRef with no lookup', async () => {
    expect(await resolver.resolve({ delivery: { recipientRef: RECIPIENT_REF } }))
      .toEqual({ recipientRef: RECIPIENT_REF })
  })

  it.each([
    `recipient:${'A'.repeat(64)}`,
    `recipient:${'a'.repeat(63)}`,
    'guardian@example.com',
    '+15555550100',
    undefined,
  ])('refuses %p as an unresolved recipient', async (recipientRef) => {
    const result = await resolver.resolve({ delivery: { recipientRef } })
    expect(result.valid).toBe(false)
  })
})

describe('D1 composition: end-to-end worker run', () => {
  it('delivers one in-app job through the real durable RPC boundary', async () => {
    const estate = createDurableEstate()
    const response = await handlerFor(estate)(manualEvent())

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      status: 'processed', claimed: 1, delivered: 1, indeterminate: 0, failed: 0,
    })

    // PHASE 14 -- delivery authority. JS authors only `created` and
    // `submitted`; the durable transaction owns provider-accepted, the
    // notification insert, the receipt and the delivered state.
    const states = estate.callsTo('academy_study_record_attempt_event_v2')
      .map((call) => call.parameters.p_event.state)
    expect(states).toEqual(['created', 'submitted'])
    expect(states).not.toContain('provider-accepted')
    expect(estate.countOf('academy_study_deliver_in_app_notification_v2')).toBe(1)
    expect(estate.names()).not.toContain('academy_study_record_delivery_receipt_v1')

    // Every durable call that requires worker authority carried the
    // credential headers the SQL registry re-checks.
    const authorized = estate.callsTo('academy_study_claim_delivery_jobs_v2')[0]
    expect(authorized.headers['x-academy-study-worker-credential']).toBe(WORKER_CREDENTIAL)
    expect(authorized.headers['x-academy-study-worker-credential-version']).toBe('v1')
  })

  it('reports 200 processed with claimed=0 when nothing is due', async () => {
    const estate = createDurableEstate({ jobs: [] })
    const response = await handlerFor(estate)(manualEvent())
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      status: 'processed', claimed: 0, delivered: 0, indeterminate: 0, failed: 0,
    })
    expect(estate.names()).not.toContain('academy_study_deliver_in_app_notification_v2')
  })

  it.each(['email', 'sms', 'carrier-pigeon'])(
    'cancels a %s claim as invalid_delivery before any provider work',
    async (route) => {
      const estate = createDurableEstate({ jobs: [claimJob({ route })] })
      const response = await handlerFor(estate)(manualEvent())

      expect(JSON.parse(response.body)).toMatchObject({ claimed: 1, delivered: 0, failed: 0 })
      const cancel = estate.callsTo('academy_study_cancel_delivery_job_v2')
      expect(cancel).toHaveLength(1)
      expect(cancel[0].parameters.p_reason_code).toBe('invalid_delivery')
      for (const forbidden of [
        'academy_study_create_delivery_attempt_v2',
        'academy_study_record_attempt_event_v2',
        'academy_study_deliver_in_app_notification_v2',
        'academy_study_verify_in_app_notification_v2',
      ]) expect(estate.names()).not.toContain(forbidden)
    },
  )

  it('cancels an invalid recipient reference before the provider boundary', async () => {
    const estate = createDurableEstate({
      jobs: [claimJob({ recipientRef: `recipient:${'z'.repeat(64)}` })],
    })
    const response = await handlerFor(estate)(manualEvent())
    expect(JSON.parse(response.body)).toMatchObject({ claimed: 1, delivered: 0 })
    const cancel = estate.callsTo('academy_study_cancel_delivery_job_v2')
    expect(cancel).toHaveLength(1)
    // The schema gate owns the opaque recipient shape, so this job never even
    // reaches recipient resolution.
    expect(cancel[0].parameters.p_reason_code).toBe('invalid_delivery')
    expect(estate.names()).not.toContain('academy_study_deliver_in_app_notification_v2')
  })

  it('resolves to invalid_recipient when only resolution rejects the recipient', async () => {
    const estate = createDurableEstate()
    const graph = await createProductionAdultReviewWorkerComposition({
      env: ENV, fetchImpl: estate.fetchImpl,
    })
    // Probing the resolver directly is the only way to see the branch: the
    // schema legitimately owns the same shape one step earlier.
    expect(await graph.resolver.resolve({ delivery: { recipientRef: 'recipient:short' } }))
      .toMatchObject({ valid: false })
  })

  it('isolates one bad claim and still delivers its good siblings', async () => {
    const estate = createDurableEstate({
      jobs: [
        claimJob({ claimId: 'claim:0001', jobId: 'job:0001', route: 'email' }),
        claimJob({ claimId: 'claim:0002', jobId: 'job:0002', leaseToken: 'lease:0002' }),
      ],
    })
    const response = await handlerFor(estate)(manualEvent())
    expect(JSON.parse(response.body)).toEqual({
      status: 'processed', claimed: 2, delivered: 1, indeterminate: 0, failed: 0,
    })
    const delivered = estate.callsTo('academy_study_deliver_in_app_notification_v2')
    expect(delivered).toHaveLength(1)
    expect(delivered[0].parameters.p_delivery.jobId).toBe('job:0002')
    expect(estate.callsTo('academy_study_cancel_delivery_job_v2')[0].parameters.p_job_id)
      .toBe('job:0001')
  })

  it('does not release a lease once the provider boundary has been crossed', async () => {
    const estate = createDurableEstate()
    // Fail the post-submit attempt proof, leaving the outcome uncertain.
    let proofs = 0
    estate.override('academy_study_prove_current_attempt_v2', (parameters) => {
      proofs += 1
      // Calls 1 and 2 are attempt creation and the provider's lease context.
      // Call 3 is the post-submit proof, after the provider boundary.
      if (proofs > 2) return undefined
      return {
        current: true,
        attemptId: `attempt:${parameters.p_job_id}:7`,
        jobId: parameters.p_job_id,
        leaseToken: 'lease:0001',
        deliveryIdempotencyKey: DELIVERY_KEY,
        providerName: 'academy-in-app',
        providerConfigVersion: 'in-app-config-v1',
      }
    })
    const response = await handlerFor(estate)(manualEvent())
    expect(JSON.parse(response.body)).toMatchObject({ claimed: 1, delivered: 0, failed: 1 })
    // The C2 adapter quarantines rather than releasing: returning the job to
    // 'pending' would make an already-submitted delivery eligible again.
    expect(estate.names()).not.toContain('academy_study_release_delivery_lease_v2')
  })
})

describe('D1 composition: invocation authorization', () => {
  it('refuses a public request that forges the Netlify schedule header', async () => {
    const estate = createDurableEstate()
    const response = await handlerFor(estate)(workerEvent({
      headers: { 'x-nf-event': 'schedule' },
    }))
    expect(response.statusCode).toBe(403)
    expect(JSON.parse(response.body)).toEqual({ error: { code: 'worker_not_authorized' } })
    expect(estate.names()).not.toContain('academy_study_claim_delivery_jobs_v2')
    expect(estate.countOf('academy_study_record_adult_review_monitoring_v2')).toBe(1)
  })

  it('refuses a forged schedule header even when the invocation secret is presented', async () => {
    const estate = createDurableEstate()
    const response = await handlerFor(estate)(manualEvent({ 'x-nf-event': 'schedule' }))
    expect(response.statusCode).toBe(403)
    expect(estate.names()).not.toContain('academy_study_claim_delivery_jobs_v2')
  })

  it('refuses a manual invocation with a missing, short, or wrong secret', async () => {
    for (const secret of [undefined, 'short', `${INVOCATION_SECRET}x`, WORKER_CREDENTIAL]) {
      const estate = createDurableEstate()
      const headers = secret === undefined ? {} : { 'x-academy-study-worker-invocation': secret }
      const response = await handlerFor(estate)(workerEvent({ headers }))
      expect(response.statusCode).toBe(403)
      expect(estate.names()).not.toContain('academy_study_claim_delivery_jobs_v2')
    }
  })

  it('records only a minimized denial event carrying no secret material', async () => {
    const estate = createDurableEstate()
    await handlerFor(estate)(workerEvent({ headers: { 'x-nf-event': 'schedule' } }))
    const denial = estate.callsTo('academy_study_record_adult_review_monitoring_v2')[0]
    expect(denial.parameters.p_event.eventName).toBe('study.adult_review.unauthorized_worker')
    expect(denial.parameters.p_event.dimensions).toEqual({
      environment: 'production', source: 'netlify-function', reason_code: 'worker-auth-failed',
    })
    const serialized = JSON.stringify(denial.parameters)
    expect(serialized).not.toContain(WORKER_CREDENTIAL)
    expect(serialized).not.toContain(INVOCATION_SECRET)
  })
})

describe('D1 composition: lazy fail-closed readiness', () => {
  const CASES = [
    ['missing SUPABASE_URL', { SUPABASE_URL: undefined }],
    ['invalid SUPABASE_URL', { SUPABASE_URL: 'http://academy.supabase.co' }],
    ['missing service role key', { SUPABASE_SERVICE_ROLE_KEY: undefined }],
    ['missing worker credential', { ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL: undefined }],
    ['short worker credential', { ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL: 'too-short' }],
    ['missing credential id', { ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_ID: undefined }],
    ['bad credential version', { ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_VERSION: 'bad version!' }],
    ['missing configuration version', { ACADEMY_STUDY_ADULT_REVIEW_WORKER_CONFIGURATION_VERSION: undefined }],
    ['missing invocation secret', { ACADEMY_STUDY_ADULT_REVIEW_WORKER_INVOCATION_SECRET: undefined }],
    ['missing worker identity', { ACADEMY_STUDY_ADULT_REVIEW_WORKER_ID: undefined }],
  ]

  it.each(CASES)('returns 503 service_not_ready for %s', async (_name, patch) => {
    const estate = createDurableEstate()
    const env = { ...ENV, ...patch }
    for (const [key, value] of Object.entries(patch)) if (value === undefined) delete env[key]
    const response = await handlerFor(estate, env)(manualEvent())
    expect(response.statusCode).toBe(503)
    expect(JSON.parse(response.body)).toEqual({ error: { code: 'service_not_ready' } })
  })

  it.each([
    ['unready durable readiness', 'academy_study_safety_durable_readiness_v1',
      () => ({ status: 'not-ready', schemaVersion: 1 })],
    ['unready adult-review policy', 'academy_study_adult_review_readiness_v2',
      () => ({ state: 'not-ready', adultReviewInAppDeliveryPolicy: 'approved' })],
    ['unapproved in-app policy', 'academy_study_adult_review_readiness_v2',
      () => ({ state: 'ready', adultReviewInAppDeliveryPolicy: 'not-approved' })],
    ['unavailable policy RPC', 'academy_study_adult_review_readiness_v2', () => undefined],
  ])('returns 503 service_not_ready for %s', async (_name, rpcName, handler) => {
    const estate = createDurableEstate()
    estate.override(rpcName, handler)
    const response = await handlerFor(estate)(manualEvent())
    expect(response.statusCode).toBe(503)
    expect(JSON.parse(response.body)).toEqual({ error: { code: 'service_not_ready' } })
    expect(estate.names()).not.toContain('academy_study_claim_delivery_jobs_v2')
  })

  it('never constructs at module import time and never throws a module-load 500', async () => {
    const estate = createDurableEstate()
    estate.override('academy_study_adult_review_readiness_v2', () => ({
      state: 'ready', adultReviewInAppDeliveryPolicy: 'not-approved',
    }))
    // Building the handler must not throw even with a policy that makes the
    // whole graph impossible; the failure surfaces per request as 503.
    const handler = handlerFor(estate)
    expect(estate.calls).toHaveLength(0)
    await expect(createProductionAdultReviewWorkerComposition({
      env: ENV, fetchImpl: estate.fetchImpl,
    })).rejects.toThrow(AdultReviewCompositionError)
    expect((await handler(manualEvent())).statusCode).toBe(503)
  })

  it('recovers once a transient durable failure clears, without a redeploy', async () => {
    const estate = createDurableEstate()
    estate.override('academy_study_safety_durable_readiness_v1', () => undefined)
    expect((await handlerFor(estate)(manualEvent())).statusCode).toBe(503)

    const handler = handlerFor(estate)
    estate.override('academy_study_safety_durable_readiness_v1', () => ({
      status: 'not-ready', schemaVersion: 1,
    }))
    expect((await handler(manualEvent())).statusCode).toBe(503)
    estate.override('academy_study_safety_durable_readiness_v1', () => ({
      status: 'ready', schemaVersion: 1,
    }))
    expect((await handler(manualEvent())).statusCode).toBe(200)
  })
})

describe('D1 composition: external channel closure', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const entrypoint = resolvePath(here, '../../study-adult-review-worker.js')

  function importClosure(entry) {
    const seen = new Set()
    const queue = [entry]
    while (queue.length > 0) {
      const file = queue.pop()
      if (seen.has(file)) continue
      seen.add(file)
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/from\s+'(\.[^']+)'/g)) {
        queue.push(resolvePath(dirname(file), match[1]))
      }
    }
    return seen
  }

  it('reaches no external, email, or SMS provider from the worker entrypoint', () => {
    const closure = [...importClosure(entrypoint)].map((file) => file.replace(/\\/g, '/'))
    expect(closure.length).toBeGreaterThan(5)
    expect(closure.some((file) => file.endsWith('/study-adult-review-operations/composition.js')))
      .toBe(true)
    for (const forbidden of ['external-provider.js', 'guardian-notifications.js', 'outbox-worker.js']) {
      expect(closure.filter((file) => file.endsWith(`/${forbidden}`))).toEqual([])
    }
    const sources = closure.map((file) => readFileSync(file, 'utf8')).join('\n')
    expect(sources).not.toMatch(/external-provider/)
    expect(sources).not.toMatch(/createExternalAdultReviewProvider/)
  })
})

describe('D1 composition: privacy across a full run', () => {
  it('never puts a secret, destination, or learner text on the durable wire', async () => {
    const estate = createDurableEstate()
    const response = await handlerFor(estate)(manualEvent())
    expect(response.statusCode).toBe(200)

    const bodies = JSON.stringify(estate.calls.map((call) => call.parameters))
    for (const forbidden of [
      WORKER_CREDENTIAL, INVOCATION_SECRET, ENV.SUPABASE_SERVICE_ROLE_KEY,
      '@', 'Bearer', 'rawText', 'transcript', 'disclosure', 'messageBody',
      'emailAddress', 'phoneNumber', 'destination',
    ]) expect(bodies).not.toContain(forbidden)

    // Credential material travels only in the dedicated durable headers, never
    // in an RPC argument, a monitoring event, or a response body.
    expect(JSON.stringify(estate.calls.map((call) => call.headers)))
      .toContain(WORKER_CREDENTIAL)
    expect(response.body).not.toContain(WORKER_CREDENTIAL)
    expect(logSpy.mock.calls.flat().join('\n')).not.toContain(WORKER_CREDENTIAL)
  })
})
