import { readFileSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStudyAdultReviewScheduledWorkerHandler } from '../../study-adult-review-worker-scheduled.js'
import { createStudyAdultReviewWorkerHandler } from '../../study-adult-review-worker.js'
import { createMonitoringService, createStructuredServerLog } from '../study-monitoring/monitoring.js'
import { createNetlifyScheduledWorkerAuthorization } from '../study-worker/credential.js'
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

function scheduledHandlerFor(estate, env = ENV) {
  return createStudyAdultReviewScheduledWorkerHandler({
    env,
    compose: (options) => createProductionAdultReviewWorkerComposition({
      ...options,
      fetchImpl: estate.fetchImpl,
    }),
  })
}

// Hands the pending job out exactly once, the way the durable claim RPC does:
// a second claim over an already-claimed job returns nothing.
function pendingOnce(estate, jobs) {
  let handed = false
  estate.override('academy_study_claim_delivery_jobs_v2', () => {
    if (handed) return { jobs: [], serverTime: FAR_FUTURE }
    handed = true
    return { jobs, serverTime: FAR_FUTURE }
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

  it('treats a forged schedule header as inert data on an otherwise valid manual call', async () => {
    // This entrypoint is manual-only now. `x-nf-event` is ordinary
    // caller-supplied data on a public request, so forging it neither grants
    // anything nor takes anything away: the call is judged purely on the
    // server-held invocation secret and the body, and succeeds AS MANUAL.
    const estate = createDurableEstate()
    const response = await handlerFor(estate)(manualEvent({ 'x-nf-event': 'schedule' }))
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      status: 'processed', claimed: 1, delivered: 1, indeterminate: 0, failed: 0,
    })
    // The 200 is itself the proof that the run went through as MANUAL: the
    // manual factory refuses every trigger but `manual`, so a run that had
    // been classified as scheduled could only have ended in 403.
  })

  it('gates a malformed body before any durable denial write, forged header or not', async () => {
    // The old schedule branch skipped body validation entirely, so a bodyless
    // public POST carrying a forged `x-nf-event` reached the authorization
    // check and bought a durable monitoring write for the cost of one empty
    // request. Body validation is unconditional now, so the request dies at
    // the content-type gate and writes nothing.
    const estate = createDurableEstate()
    const response = await handlerFor(estate)({
      httpMethod: 'POST',
      path: '/api/study/adult-review/worker',
      headers: { 'x-nf-event': 'schedule' },
    })
    expect(response.statusCode).toBe(415)
    expect(JSON.parse(response.body)).toEqual({ error: { code: 'unsupported_content_type' } })
    expect(estate.countOf('academy_study_record_adult_review_monitoring_v2')).toBe(0)
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

describe('D1 scheduled entrypoint: platform path exclusivity', () => {
  it('runs a delivery with no request of any kind, not even an event argument', async () => {
    const estate = createDurableEstate()
    // The handler takes no parameter. Calling it with nothing is exactly what
    // a Netlify schedule does, and a 200 proves the run was authorized AS
    // SCHEDULED: the scheduled factory refuses every other trigger.
    const response = await scheduledHandlerFor(estate)()

    expect(response.statusCode).toBe(200)
    expect(estate.countOf('academy_study_deliver_in_app_notification_v2')).toBe(1)
    const states = estate.callsTo('academy_study_record_attempt_event_v2')
      .map((call) => call.parameters.p_event.state)
    expect(states).toEqual(['created', 'submitted'])
  })

  it('has no path, method, query, body, or header gate to satisfy or to fool', async () => {
    const estate = createDurableEstate()
    const handler = scheduledHandlerFor(estate)
    // Every one of these would be refused by the manual entrypoint -- wrong
    // path, wrong method, a query string, an unparseable body, a forged
    // schedule marker, a stolen invocation secret. None of them changes
    // anything here, because none of them is read.
    for (const event of [
      undefined,
      {},
      { httpMethod: 'GET', path: '/nope', rawQuery: 'limit=999' },
      {
        httpMethod: 'DELETE',
        path: '/.netlify/functions/study-adult-review-worker-scheduled',
        body: 'not json',
        headers: {
          'x-nf-event': 'schedule',
          'x-academy-study-worker-invocation': INVOCATION_SECRET,
          'content-type': 'text/plain',
        },
      },
    ]) {
      const response = await handler(event)
      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body)).toEqual({ status: 'processed' })
    }
  })

  it('reveals no worker internals in its response', async () => {
    const estate = createDurableEstate()
    const response = await scheduledHandlerFor(estate)()
    // Deliberately not the manual entrypoint's counts: no operator reads a
    // scheduled response, so claimed/delivered/failed would be worker
    // internals published to an HTTP surface for no reader.
    expect(JSON.parse(response.body)).toEqual({ status: 'processed' })
    for (const forbidden of [
      WORKER_CREDENTIAL, INVOCATION_SECRET, 'household', 'student', 'recipient:',
      'claimed', 'delivered', 'workerIdentity',
    ]) expect(response.body).not.toContain(forbidden)
  })

  it('fails closed on the containment flag and on an unready graph', async () => {
    const estate = createDurableEstate()
    const disabled = { ...ENV }
    delete disabled.ACADEMY_STUDY_ENABLED
    expect(await scheduledHandlerFor(estate, disabled)()).toMatchObject({ statusCode: 503 })
    expect(JSON.parse((await scheduledHandlerFor(estate, disabled)()).body))
      .toEqual({ error: { code: 'gateway_disabled' } })
    expect(estate.calls).toHaveLength(0)

    const unconfigured = { ...ENV }
    delete unconfigured.ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL
    const response = await scheduledHandlerFor(estate, unconfigured)()
    expect(response.statusCode).toBe(503)
    expect(JSON.parse(response.body)).toEqual({ error: { code: 'service_not_ready' } })
    expect(estate.names()).not.toContain('academy_study_claim_delivery_jobs_v2')
  })

})

/**
 * H2 -- the automatic worker does not depend on the optional manual secret.
 *
 * The manual invocation secret exists so a human operator can prove a manual
 * call. Guardian delivery is automatic and has no operator, so making the
 * schedule depend on that secret pointed the dependency the wrong way: an
 * absent, short, or rotated operator convenience silently stopped safety
 * delivery for every household, forever, with a 503 nobody reads.
 */
describe('D1 H2: scheduled delivery is decoupled from the manual secret', () => {
  const NO_SECRET = (() => {
    const env = { ...ENV }
    delete env.ACADEMY_STUDY_ADULT_REVIEW_WORKER_INVOCATION_SECRET
    return Object.freeze(env)
  })()

  it('composes and DELIVERS with the manual invocation secret absent', async () => {
    const estate = createDurableEstate()
    const response = await scheduledHandlerFor(estate, NO_SECRET)()

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({ status: 'processed' })
    // The whole point: a real guardian delivery completed, end to end, through
    // the durable boundary, with no manual secret configured anywhere.
    expect(estate.countOf('academy_study_deliver_in_app_notification_v2')).toBe(1)
    // Two receipt reads per delivery, both read-only: the provider reads the
    // receipt it was handed, and `commitReceipt()` reads it again to commit.
    expect(estate.countOf('academy_study_verify_in_app_notification_v2')).toBe(2)
    expect(estate.callsTo('academy_study_record_attempt_event_v2')
      .map((call) => call.parameters.p_event.state)).toEqual(['created', 'submitted'])
  })

  it.each([
    ['absent', undefined],
    ['empty', ''],
    ['short', 'too-short'],
    ['junk', '  not-a-secret'],
    ['over-long', 'x'.repeat(513)],
    ['valid', INVOCATION_SECRET],
  ])('is unaffected by a %s manual secret', async (_name, secret) => {
    const estate = createDurableEstate()
    const env = { ...NO_SECRET }
    if (secret !== undefined) env.ACADEMY_STUDY_ADULT_REVIEW_WORKER_INVOCATION_SECRET = secret
    const response = await scheduledHandlerFor(estate, env)()
    expect(response.statusCode).toBe(200)
    expect(estate.countOf('academy_study_deliver_in_app_notification_v2')).toBe(1)
  })

  it('never reads the manual secret from the environment on the scheduled path', async () => {
    // A dependency read spy, not a source scan: every property access on the
    // environment is recorded, so an indirect read through any module in the
    // graph is caught. The scheduled composition must never touch this key.
    const reads = []
    const watched = new Proxy({ ...NO_SECRET }, {
      get(target, key) {
        if (typeof key === 'string') reads.push(key)
        return target[key]
      },
      has(target, key) {
        if (typeof key === 'string') reads.push(key)
        return key in target
      },
    })
    const estate = createDurableEstate()
    const response = await scheduledHandlerFor(estate, watched)()

    expect(response.statusCode).toBe(200)
    expect(estate.countOf('academy_study_deliver_in_app_notification_v2')).toBe(1)
    // The spy is only meaningful if it actually observed the reads it was
    // watching for, so prove it caught the keys the scheduled path DOES need.
    expect(reads).toContain('ACADEMY_STUDY_ENABLED')
    expect(reads).toContain('ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL')
    expect(reads).not.toContain('ACADEMY_STUDY_ADULT_REVIEW_WORKER_INVOCATION_SECRET')
  })

  it('keeps the manual entrypoint fail-closed in the very same environment', async () => {
    // Decoupling must be one-directional. In an environment with no manual
    // secret the scheduled worker delivers (above) and the manual worker is
    // unavailable -- it never becomes an unauthenticated public path.
    const estate = createDurableEstate()
    const response = await handlerFor(estate, NO_SECRET)(manualEvent())
    expect(response.statusCode).toBe(503)
    expect(JSON.parse(response.body)).toEqual({ error: { code: 'service_not_ready' } })
    expect(estate.names()).not.toContain('academy_study_claim_delivery_jobs_v2')
  })

  it('still requires every ACTUAL durable prerequisite of the scheduled run', async () => {
    // Removing the manual coupling must not have removed anything real.
    const CASES = [
      ['study disabled', { ACADEMY_STUDY_ENABLED: undefined }],
      ['missing SUPABASE_URL', { SUPABASE_URL: undefined }],
      ['missing service role key', { SUPABASE_SERVICE_ROLE_KEY: undefined }],
      ['missing worker credential', { ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL: undefined }],
      ['short worker credential', { ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL: 'too-short' }],
      ['missing worker identity', { ACADEMY_STUDY_ADULT_REVIEW_WORKER_ID: undefined }],
      ['missing credential id', { ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_ID: undefined }],
      ['bad credential version', { ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_VERSION: 'bad version!' }],
      ['missing configuration version', { ACADEMY_STUDY_ADULT_REVIEW_WORKER_CONFIGURATION_VERSION: undefined }],
    ]
    for (const [name, patch] of CASES) {
      const estate = createDurableEstate()
      const env = { ...NO_SECRET, ...patch }
      for (const [key, value] of Object.entries(patch)) if (value === undefined) delete env[key]
      const response = await scheduledHandlerFor(estate, env)()
      expect(response.statusCode, name).toBe(503)
      expect(estate.names(), name).not.toContain('academy_study_deliver_in_app_notification_v2')
    }
  })

  it.each([
    ['unready durable readiness', 'academy_study_safety_durable_readiness_v1',
      () => ({ status: 'not-ready', schemaVersion: 1 })],
    ['unready adult-review policy', 'academy_study_adult_review_readiness_v2',
      () => ({ state: 'not-ready', adultReviewInAppDeliveryPolicy: 'approved' })],
    ['unapproved in-app policy', 'academy_study_adult_review_readiness_v2',
      () => ({ state: 'ready', adultReviewInAppDeliveryPolicy: 'not-approved' })],
    ['unavailable policy RPC', 'academy_study_adult_review_readiness_v2', () => undefined],
  ])('still refuses to compose the schedule for %s', async (_name, rpcName, handler) => {
    const estate = createDurableEstate()
    estate.override(rpcName, handler)
    const response = await scheduledHandlerFor(estate, NO_SECRET)()
    expect(response.statusCode).toBe(503)
    expect(JSON.parse(response.body)).toEqual({ error: { code: 'service_not_ready' } })
    expect(estate.names()).not.toContain('academy_study_claim_delivery_jobs_v2')
  })
})

describe('D1 H2: the invocation authority is selected, never supplied by a caller', () => {
  it.each([
    ['a look-alike object', {
      isDurable: true,
      isReady: () => true,
      credentialForEvent: async () => ({ authorized: true, workerCredential: WORKER_CREDENTIAL }),
    }],
    ['an always-authorizing function', () => Object.freeze({
      isDurable: true,
      isReady: () => true,
      credentialForEvent: async () => ({ authorized: true, workerCredential: WORKER_CREDENTIAL }),
    })],
    ['a string naming the scheduled strategy', 'scheduled'],
    ['a plain object', {}],
  ])('refuses %s as an invocation authority, before any durable work', async (_name, authority) => {
    const estate = createDurableEstate()
    const error = await createProductionAdultReviewWorkerComposition({
      env: ENV, fetchImpl: estate.fetchImpl, invocationAuthority: authority,
    }).catch((caught) => caught)

    expect(error).toBeInstanceOf(AdultReviewCompositionError)
    expect(error.reason).toBe('unknown_invocation_authority')
    // Refused before the first round trip: a wiring mistake must not be able to
    // buy durable work on its way to being rejected.
    expect(estate.calls).toHaveLength(0)
  })

  it('cannot be steered by anything a public caller sends to the manual entrypoint', async () => {
    // The manual entrypoint names no authority, so it takes the fail-closed
    // manual default. A body or header that tries to name the scheduled
    // strategy is ordinary caller data and changes nothing: without the secret
    // the call is still 403.
    const estate = createDurableEstate()
    const response = await handlerFor(estate)(workerEvent({
      headers: { 'x-nf-event': 'schedule', 'x-academy-study-invocation-authority': 'scheduled' },
      body: JSON.stringify({
        schemaVersion: 2, action: 'process-pending', invocationAuthority: 'scheduled',
      }),
    }))
    // The exact-object body gate rejects the smuggled key outright.
    expect(response.statusCode).toBe(400)
    expect(estate.names()).not.toContain('academy_study_claim_delivery_jobs_v2')
  })

  it('defaults to the MANUAL authority, which fails closed without a secret', async () => {
    // An entrypoint that forgets to name its authority must get the one that
    // demands a presented secret, never the one whose proof is the platform
    // path. Stating no authority in an environment with no manual secret must
    // therefore fail.
    const estate = createDurableEstate()
    const env = { ...ENV }
    delete env.ACADEMY_STUDY_ADULT_REVIEW_WORKER_INVOCATION_SECRET
    const error = await createProductionAdultReviewWorkerComposition({
      env, fetchImpl: estate.fetchImpl,
    }).catch((caught) => caught)
    expect(error.reason).toBe('worker_invocation_authority_not_configured')
  })
})

describe('D1 H2: one composition graph, one operations instance', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  // Executable lines only. A comment may name a factory to explain it; only a
  // real call site counts as a construction.
  const source = readFileSync(resolvePath(here, './composition.js'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim()
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*')
    })
    .join('\n')
  const constructions = (name) => source.split(`${name}(`).length - 1

  it.each([
    'createSupabaseAdultReviewOperations',
    'createSupabaseInAppPersistence',
    'createDurableInAppProvider',
    'createAdultReviewWorker',
    'createSupabaseServiceRpc',
  ])('constructs %s exactly once in the whole module', (name) => {
    // The durable graph is NOT duplicated per trigger. Two full compositions
    // would mean two operations adapters, and a delivery under the second
    // would fail `lease_context_unknown_job` because the claim lives in the
    // first. One call site each, for both entrypoints.
    expect(constructions(name)).toBe(1)
  })

  it('builds the identical durable graph for both authorities', async () => {
    const estate = createDurableEstate()
    const manual = await createProductionAdultReviewWorkerComposition({
      env: ENV, fetchImpl: estate.fetchImpl,
    })
    const scheduled = await createProductionAdultReviewWorkerComposition({
      env: ENV,
      fetchImpl: estate.fetchImpl,
      invocationAuthority: createNetlifyScheduledWorkerAuthorization,
    })

    // Same shape, same route, same provider, same durable policy.
    expect(Object.keys(scheduled).sort()).toEqual(Object.keys(manual).sort())
    expect(scheduled.adultReviewInAppDeliveryPolicy).toBe(manual.adultReviewInAppDeliveryPolicy)
    expect(scheduled.schema.route).toBe(manual.schema.route)
    // The one-instance invariant holds for BOTH selections, not just manual.
    expect(scheduled.inAppLeaseContext).toBe(scheduled.operations.leaseContext)
    expect(manual.inAppLeaseContext).toBe(manual.operations.leaseContext)

    // The ONLY difference is who may start a run.
    expect(manual.workerAuthorization.scheduledInvocationAuthority).toBe('refused')
    expect(scheduled.workerAuthorization.scheduledInvocationAuthority)
      .toBe('platform-path-exclusivity')
  })

  it('does the identical durable work on both paths for the same job', async () => {
    // Behavioural identity: one graph means one delivery sequence. If the two
    // entrypoints had been given separate compositions, this would drift.
    const manualEstate = createDurableEstate()
    await handlerFor(manualEstate)(manualEvent())
    const scheduledEstate = createDurableEstate()
    await scheduledHandlerFor(scheduledEstate)()

    expect(scheduledEstate.names()).toEqual(manualEstate.names())
    expect(scheduledEstate.names()).toContain('academy_study_deliver_in_app_notification_v2')
  })
})

describe('D1 H2: a failed composition is never cached', () => {
  it('re-composes and succeeds on the NEXT scheduled run, with no redeploy', async () => {
    const estate = createDurableEstate()
    // One handler, created once, exactly as the deployed module does it. The
    // handler is NOT rebuilt between the two invocations -- that is the whole
    // point: a cached failure would wedge the schedule until the next deploy.
    const handler = scheduledHandlerFor(estate)

    estate.override('academy_study_safety_durable_readiness_v1', () => undefined)
    const first = await handler()
    expect(first.statusCode).toBe(503)
    expect(JSON.parse(first.body)).toEqual({ error: { code: 'service_not_ready' } })
    expect(estate.names()).not.toContain('academy_study_deliver_in_app_notification_v2')

    // The transient durable outage clears. Same handler, same module.
    estate.override('academy_study_safety_durable_readiness_v1', () => ({
      status: 'ready', schemaVersion: 1,
    }))
    const second = await handler()
    expect(second.statusCode).toBe(200)
    expect(JSON.parse(second.body)).toEqual({ status: 'processed' })
    expect(estate.countOf('academy_study_deliver_in_app_notification_v2')).toBe(1)
    expect(estate.countOf('academy_study_verify_in_app_notification_v2')).toBe(2)
  })

  it('recovers from a transient failure at each composition stage in turn', async () => {
    for (const [rpcName, healthy] of [
      ['academy_study_safety_durable_readiness_v1', () => ({ status: 'ready', schemaVersion: 1 })],
      ['academy_study_adult_review_readiness_v2',
        () => ({ state: 'ready', adultReviewInAppDeliveryPolicy: 'approved' })],
    ]) {
      const estate = createDurableEstate()
      const handler = scheduledHandlerFor(estate)
      estate.override(rpcName, () => undefined)
      expect((await handler()).statusCode, rpcName).toBe(503)
      estate.override(rpcName, healthy)
      expect((await handler()).statusCode, rpcName).toBe(200)
      expect(estate.countOf('academy_study_deliver_in_app_notification_v2'), rpcName).toBe(1)
    }
  })

  it('keeps a warm successful composition warm across runs', async () => {
    // The flip side of not caching failure: success IS reused, so the schedule
    // does not re-read readiness and policy on every single run.
    const estate = createDurableEstate()
    const handler = scheduledHandlerFor(estate)
    await handler()
    await handler()
    expect(estate.countOf('academy_study_adult_review_readiness_v2')).toBe(1)
    expect(estate.countOf('academy_study_claim_delivery_jobs_v2')).toBe(2)
  })
})

describe('D1 H2: durable policy stays live after the graph is warm', () => {
  it('CONTROL: a policy that closes after composition still stops delivery at SQL', async () => {
    // The warm graph memoizes the composition-time policy read, so liveness
    // cannot come from it. It comes from SQL: the durable delivery transaction
    // re-checks on every single delivery. This is the control that proves the
    // memoized 'approved' does NOT grant anything by itself.
    const estate = createDurableEstate()
    const handler = scheduledHandlerFor(estate)
    expect((await handler()).statusCode).toBe(200)
    expect(estate.countOf('academy_study_verify_in_app_notification_v2')).toBe(2)

    // Durable policy closes. The composition is never rebuilt, and still holds
    // `adultReviewInAppDeliveryPolicy: 'approved'` from before.
    estate.override('academy_study_deliver_in_app_notification_v2', () => undefined)
    expect((await handler()).statusCode).toBe(200)

    // The attempt reached SQL and SQL refused it. No second delivery was
    // verified, so nothing was delivered on the memoized policy.
    expect(estate.countOf('academy_study_deliver_in_app_notification_v2')).toBe(2)
    expect(estate.countOf('academy_study_verify_in_app_notification_v2')).toBe(2)
    // Repeated claim/attempt work on a closed policy is delivery noise, not
    // authorization: the job is never delivered while SQL refuses.
  })
})

/**
 * The whole point of the split, in one table: which prerequisites are shared
 * and which belong to one path only.
 *
 * `manual` and `scheduled` are the outcomes each entrypoint must reach in that
 * environment -- 'delivers', or the HTTP status it must fail with. The manual
 * column always uses a correctly-secreted request where a secret exists, so a
 * 403 in this table means the AUTHORITY refused, not that the test forged
 * something.
 */
describe('D1 H2: security matrix across both entrypoints', () => {
  const patched = (patch) => {
    const env = { ...ENV, ...patch }
    for (const [key, value] of Object.entries(patch)) if (value === undefined) delete env[key]
    return env
  }
  const SECRET_KEY = 'ACADEMY_STUDY_ADULT_REVIEW_WORKER_INVOCATION_SECRET'

  it.each([
    // The optional operator secret gates ONLY the manual path.
    ['manual secret absent', { [SECRET_KEY]: undefined }, 503, 'delivers'],
    ['manual secret malformed', { [SECRET_KEY]: 'short' }, 503, 'delivers'],
    ['manual secret rotated', { [SECRET_KEY]: `${INVOCATION_SECRET}-rotated` }, 403, 'delivers'],
    // Real durable prerequisites are shared: BOTH paths close.
    ['worker credential absent', { ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL: undefined }, 503, 503],
    ['worker identity absent', { ACADEMY_STUDY_ADULT_REVIEW_WORKER_ID: undefined }, 503, 503],
    ['durable service key absent', { SUPABASE_SERVICE_ROLE_KEY: undefined }, 503, 503],
    ['study disabled', { ACADEMY_STUDY_ENABLED: undefined }, 503, 503],
    ['study explicitly off', { ACADEMY_STUDY_ENABLED: 'false' }, 503, 503],
  ])('%s -> manual %s, scheduled %s', async (_name, patch, manualOutcome, scheduledOutcome) => {
    const env = patched(patch)

    const manualEstate = createDurableEstate()
    // A correctly-secreted manual request whenever a secret exists at all.
    const secret = env[SECRET_KEY]
    const manual = await handlerFor(manualEstate, env)(workerEvent({
      headers: secret ? { 'x-academy-study-worker-invocation': INVOCATION_SECRET } : {},
    }))
    expect(manual.statusCode).toBe(manualOutcome)
    expect(manualEstate.names()).not.toContain('academy_study_deliver_in_app_notification_v2')

    const scheduledEstate = createDurableEstate()
    const scheduled = await scheduledHandlerFor(scheduledEstate, env)()
    if (scheduledOutcome === 'delivers') {
      expect(scheduled.statusCode).toBe(200)
      expect(scheduledEstate.countOf('academy_study_deliver_in_app_notification_v2')).toBe(1)
    } else {
      expect(scheduled.statusCode).toBe(scheduledOutcome)
      expect(scheduledEstate.names()).not.toContain('academy_study_deliver_in_app_notification_v2')
    }
  })

  it('closes BOTH paths when the durable in-app policy is not approved', async () => {
    // Policy is durable, not an env flag, so it is patched at the RPC.
    for (const build of [
      (estate) => handlerFor(estate)(manualEvent()),
      (estate) => scheduledHandlerFor(estate)(),
    ]) {
      const estate = createDurableEstate()
      estate.override('academy_study_adult_review_readiness_v2', () => ({
        state: 'ready', adultReviewInAppDeliveryPolicy: 'not-approved',
      }))
      const response = await build(estate)
      expect(response.statusCode).toBe(503)
      expect(estate.names()).not.toContain('academy_study_deliver_in_app_notification_v2')
    }
  })
})

describe('D1 H2: concurrency across the split is unchanged', () => {
  it('delivers once when a manual and a scheduled run overlap on one job', async () => {
    const estate = createDurableEstate()
    pendingOnce(estate, [claimJob()])
    const [manual, scheduled] = await Promise.all([
      handlerFor(estate)(manualEvent()),
      scheduledHandlerFor(estate)(),
    ])
    expect([manual.statusCode, scheduled.statusCode]).toEqual([200, 200])
    // Two independent compositions, two claim calls, one durable lease holder.
    expect(estate.countOf('academy_study_claim_delivery_jobs_v2')).toBe(2)
    expect(estate.countOf('academy_study_deliver_in_app_notification_v2')).toBe(1)
    expect(estate.countOf('academy_study_verify_in_app_notification_v2')).toBe(2)
  })
})

describe('D1 scheduled entrypoint: batch limit', () => {
  it('claims exactly four jobs per scheduled run', async () => {
    // Netlify caps a scheduled invocation at 30 seconds and one in-app
    // delivery costs several sequential durable round trips, so the batch is
    // sized to finish inside that ceiling; the next run is five minutes away.
    const estate = createDurableEstate()
    await scheduledHandlerFor(estate)()
    expect(estate.callsTo('academy_study_claim_delivery_jobs_v2')[0].parameters.p_batch_size)
      .toBe(4)
  })

  it('leaves the manual default batch at ten', async () => {
    const estate = createDurableEstate()
    await handlerFor(estate)(manualEvent())
    expect(estate.callsTo('academy_study_claim_delivery_jobs_v2')[0].parameters.p_batch_size)
      .toBe(10)
  })

  it('still honours an explicit manual limit, and never lets one reach the schedule', async () => {
    const estate = createDurableEstate()
    await handlerFor(estate)(workerEvent({
      headers: { 'x-academy-study-worker-invocation': INVOCATION_SECRET },
      body: JSON.stringify({ schemaVersion: 2, action: 'process-pending', limit: 37 }),
    }))
    expect(estate.callsTo('academy_study_claim_delivery_jobs_v2')[0].parameters.p_batch_size)
      .toBe(37)

    // The scheduled entrypoint parses no body, so no caller-supplied limit
    // exists on that path to override the four.
    const scheduled = createDurableEstate()
    await scheduledHandlerFor(scheduled)({
      body: JSON.stringify({ schemaVersion: 2, action: 'process-pending', limit: 50 }),
      headers: { 'content-type': 'application/json' },
    })
    expect(scheduled.callsTo('academy_study_claim_delivery_jobs_v2')[0].parameters.p_batch_size)
      .toBe(4)
  })
})

describe('D1 scheduled entrypoint: replay and idempotency', () => {
  // Idempotency is NOT authentication. Nothing below authorizes anything: it
  // shows that repeating an already-authorized run does not repeat a delivery.
  // The authorization argument is platform path exclusivity plus the two
  // trigger-exclusive factories, and it is made elsewhere.
  it('delivers once across two sequential scheduled runs over one pending job', async () => {
    const estate = createDurableEstate()
    pendingOnce(estate, [claimJob()])
    const handler = scheduledHandlerFor(estate)

    expect((await handler()).statusCode).toBe(200)
    expect((await handler()).statusCode).toBe(200)

    expect(estate.countOf('academy_study_claim_delivery_jobs_v2')).toBe(2)
    expect(estate.countOf('academy_study_deliver_in_app_notification_v2')).toBe(1)
    expect(estate.callsTo('academy_study_record_attempt_event_v2')
      .map((call) => call.parameters.p_event.state)).toEqual(['created', 'submitted'])
  })

  it('lets only the lease holder proceed when two runs overlap', async () => {
    const estate = createDurableEstate()
    pendingOnce(estate, [claimJob()])
    const [first, second] = await Promise.all([
      scheduledHandlerFor(estate)(),
      scheduledHandlerFor(estate)(),
    ])
    expect([first.statusCode, second.statusCode]).toEqual([200, 200])
    // Two independent runs, two claim calls, one durable lease: the loser gets
    // an empty batch and reaches no provider at all.
    expect(estate.countOf('academy_study_claim_delivery_jobs_v2')).toBe(2)
    expect(estate.countOf('academy_study_deliver_in_app_notification_v2')).toBe(1)
  })

  it('quarantines a submitted-but-unverified job instead of releasing it', async () => {
    const estate = createDurableEstate()
    let proofs = 0
    estate.override('academy_study_prove_current_attempt_v2', (parameters) => {
      proofs += 1
      // The third proof is the post-submit one, after the provider boundary.
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
    const response = await scheduledHandlerFor(estate)()
    expect(response.statusCode).toBe(200)
    // Releasing the lease would return an already-submitted delivery to
    // 'pending', and the next scheduled run five minutes later would deliver
    // it a second time. The C2 adapter quarantines instead.
    expect(estate.names()).not.toContain('academy_study_release_delivery_lease_v2')
  })
})

describe('D1 scheduled entrypoint: privacy', () => {
  it('puts no secret, destination, or learner text on the durable wire', async () => {
    const estate = createDurableEstate()
    const response = await scheduledHandlerFor(estate)()
    expect(response.statusCode).toBe(200)

    const bodies = JSON.stringify(estate.calls.map((call) => call.parameters))
    for (const forbidden of [
      WORKER_CREDENTIAL, INVOCATION_SECRET, ENV.SUPABASE_SERVICE_ROLE_KEY,
      '@', 'Bearer', 'rawText', 'transcript', 'disclosure', 'messageBody',
      'emailAddress', 'phoneNumber', 'destination',
    ]) expect(bodies).not.toContain(forbidden)

    expect(response.body).not.toContain(WORKER_CREDENTIAL)
    expect(logSpy.mock.calls.flat().join('\n')).not.toContain(WORKER_CREDENTIAL)
  })

  it('adds no monitoring dimension the manual path does not already emit', async () => {
    // Same failing job on both paths, so the comparison is over identical
    // work: the trigger split must not widen what is recorded.
    function brokenEstate() {
      const estate = createDurableEstate({ jobs: [claimJob({ route: 'email' })] })
      return estate
    }
    const shape = (estate) => estate.callsTo('academy_study_record_adult_review_monitoring_v2')
      .map((call) => `${call.parameters.p_event.eventName}:${Object.keys(call.parameters.p_event.dimensions ?? {}).sort().join(',')}`)
      .sort()

    const manual = brokenEstate()
    await handlerFor(manual)(manualEvent())
    const scheduled = brokenEstate()
    await scheduledHandlerFor(scheduled)()

    expect(shape(scheduled)).toEqual(shape(manual))
    expect(shape(scheduled).length).toBeGreaterThan(0)
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
