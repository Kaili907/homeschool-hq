import { describe, expect, it, vi } from 'vitest'
import { createStudyAdultReviewHandler } from '../../netlify/functions/study-adult-review.js'
import { createStudyParentNotificationsHandler } from '../../netlify/functions/study-parent-notifications.js'
import { createStudyProductionReadinessHandler } from '../../netlify/functions/study-production-readiness.js'
import { createProductionStudySafetyHandler } from '../../netlify/functions/study-safety-classify.js'
import { createStudySessionIssueHandler } from '../../netlify/functions/study-session-issue.js'

const ACCESS_TOKEN = 'guardian.header.payload'
const USER_ID = '123e4567-e89b-42d3-a456-426614174000'
const STUDENT_ID = '22222222-2222-4222-8222-222222222222'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const REQUEST_ID = '44444444-4444-4444-8444-444444444444'
const SESSION_REFERENCE = `aca_stu_v1_${'A'.repeat(43)}`
const ENV = Object.freeze({
  ACADEMY_STUDY_ENABLED: 'true',
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_ANON_KEY: 'public-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'server-service-key',
  STUDY_SAFETY_RATE_LIMIT_HMAC_KEY: 'test-rate-limit-key',
})

function authFetch(body = { id: USER_ID }, status = 200) {
  return vi.fn(async (url) => {
    expect(url).toBe('https://academy.supabase.co/auth/v1/user')
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  })
}

function authAndStudyRpcFetch() {
  return vi.fn(async (url) => {
    if (url === 'https://academy.supabase.co/auth/v1/user') {
      return new Response(JSON.stringify({ id: USER_ID }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (url === 'https://academy.supabase.co/rest/v1/rpc/academy_study_verify_session_v1') {
      return new Response(JSON.stringify({ schemaVersion: 1, status: 'denied' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    throw new Error(`unexpected URL: ${url}`)
  })
}

function bearerEvent({ method = 'POST', path, body, headers = {} }) {
  return {
    httpMethod: method,
    path,
    headers: {
      authorization: `Bearer ${ACCESS_TOKEN}`,
      'content-type': 'application/json',
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }
}

function readyPort(methods) {
  return { isDurable: true, isReady: () => true, ...methods }
}

function studySafetyHarness(fetchImpl) {
  const classifier = {
    mode: 'production',
    classifierVersion: 'production-contract-test-v1',
    isConfigured: () => true,
    circuitState: () => 'closed',
    classify: vi.fn(),
  }
  const proposalPersistence = readyPort({ createProposal: vi.fn() })
  const outbox = readyPort({
    claim: vi.fn(),
    recordRecipientResolutionAndEnqueue: vi.fn(),
  })
  const recipientResolver = readyPort({
    resolve: vi.fn(),
    reauthorizeForDelivery: vi.fn(),
  })
  const rateLimiter = readyPort({ reserve: vi.fn(async () => ({ allowed: true })) })
  const monitoring = readyPort({ record: vi.fn(async () => undefined) })
  const deliveryProvider = readyPort({
    channel: 'in-app',
    supportsDurableIdempotency: true,
    deliver: vi.fn(),
  })
  const receiptValidator = readyPort({
    channel: 'in-app',
    verifyReceipt: vi.fn(),
  })
  const productionPorts = {
    proposalPersistence,
    outbox,
    recipientResolver,
    rateLimiter,
    monitoring,
    refreshReadiness: vi.fn(async () => true),
  }
  const handler = createProductionStudySafetyHandler({
    env: ENV,
    fetchImpl,
    classifier,
    productionPorts,
    monitoring,
    deliveryProviders: [deliveryProvider],
    receiptValidators: [receiptValidator],
    logBoot: vi.fn(),
  })
  return { handler, classifier, rateLimiter, productionPorts }
}

describe('ACTUAL PRODUCTION CONSUMER TEST: Study bearer boundaries', () => {
  it('requires guardian authorization after a valid bearer and passes only the exact token to issuance', async () => {
    const issue = vi.fn(async () => ({ status: 'denied' }))
    const fetchImpl = authFetch()
    const handler = createStudySessionIssueHandler({
      env: ENV,
      fetchImpl,
      issuer: readyPort({ issue }),
    })

    const response = await handler(bearerEvent({
      path: '/api/study/session/issue',
      body: {
        schemaVersion: 1,
        selectedStudentRef: { kind: 'academy-student-id', value: STUDENT_ID },
      },
    }))

    expect(response.statusCode).toBe(403)
    expect(issue).toHaveBeenCalledWith({
      accessToken: ACCESS_TOKEN,
      selectedStudentRef: { kind: 'academy-student-id', value: STUDENT_ID },
    })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('blocks Study issuance after bearer failure', async () => {
    const issue = vi.fn()
    const handler = createStudySessionIssueHandler({
      env: ENV,
      fetchImpl: authFetch({ error: 'outage' }, 500),
      issuer: readyPort({ issue }),
    })

    const response = await handler(bearerEvent({
      path: '/api/study/session/issue',
      body: {
        schemaVersion: 1,
        selectedStudentRef: { kind: 'academy-student-id', value: STUDENT_ID },
      },
    }))

    expect(response.statusCode).toBe(503)
    expect(JSON.parse(response.body)).toEqual({ error: { code: 'auth_unavailable' } })
    expect(issue).not.toHaveBeenCalled()
  })

  it('passes the exact verified identity to Study authorization without forwarding the bearer', async () => {
    const fetchImpl = authAndStudyRpcFetch()
    const { handler, classifier } = studySafetyHarness(fetchImpl)

    const response = await handler(bearerEvent({
      path: '/api/study/safety/classify',
      headers: { 'x-study-session': SESSION_REFERENCE },
      body: {
        schemaVersion: 1,
        requestId: REQUEST_ID,
        studentRef: { kind: 'academy-student-id', value: STUDENT_ID },
        sessionId: SESSION_ID,
        transientText: 'ordinary synthetic lesson answer',
      },
    }))

    expect(response.statusCode).toBe(403)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const [rpcUrl, rpcInit] = fetchImpl.mock.calls[1]
    expect(rpcUrl).toBe('https://academy.supabase.co/rest/v1/rpc/academy_study_verify_session_v1')
    expect(JSON.parse(rpcInit.body)).toMatchObject({
      p_actor_user_id: USER_ID,
      p_required_capability: 'student:attempts:create',
    })
    expect(rpcInit.headers.Authorization).toBe('Bearer server-service-key')
    expect(JSON.stringify(fetchImpl.mock.calls[1])).not.toContain(ACCESS_TOKEN)
    expect(classifier.classify).not.toHaveBeenCalled()
  })

  it('blocks Study learner authorization and classification after bearer failure', async () => {
    const fetchImpl = authFetch({ message: 'expired' }, 401)
    const { handler, classifier, rateLimiter, productionPorts } = studySafetyHarness(fetchImpl)

    const response = await handler(bearerEvent({
      path: '/api/study/safety/classify',
      headers: { 'x-study-session': SESSION_REFERENCE },
      body: {
        schemaVersion: 1,
        requestId: REQUEST_ID,
        studentRef: { kind: 'academy-student-id', value: STUDENT_ID },
        sessionId: SESSION_ID,
        transientText: 'ordinary synthetic lesson answer',
      },
    }))

    expect(response.statusCode).toBe(401)
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(productionPorts.refreshReadiness).not.toHaveBeenCalled()
    expect(rateLimiter.reserve).not.toHaveBeenCalled()
    expect(classifier.classify).not.toHaveBeenCalled()
  })

  it('passes the exact bearer to the guardian notification adapter and hashes the actor rate-limit key', async () => {
    const list = vi.fn(async () => ({ notifications: [] }))
    const reserve = vi.fn(async () => ({ allowed: true }))
    const handler = createStudyParentNotificationsHandler({
      env: ENV,
      fetchImpl: authFetch(),
      notifications: readyPort({ list, markRead: vi.fn() }),
      rateLimiter: readyPort({ reserve }),
    })

    const response = await handler(bearerEvent({
      method: 'GET',
      path: '/api/study/parent-notifications',
    }))

    expect(response.statusCode).toBe(200)
    expect(list).toHaveBeenCalledWith({ accessToken: ACCESS_TOKEN, limit: 50 })
    expect(reserve.mock.calls[0][0].actorRef).toMatch(/^actor:[a-f0-9]{64}$/)
    expect(JSON.stringify(reserve.mock.calls)).not.toContain(USER_ID)
  })

  it('blocks guardian notification access after bearer failure', async () => {
    const list = vi.fn()
    const reserve = vi.fn()
    const handler = createStudyParentNotificationsHandler({
      env: ENV,
      fetchImpl: authFetch({ error: 'outage' }, 500),
      notifications: readyPort({ list, markRead: vi.fn() }),
      rateLimiter: readyPort({ reserve }),
    })

    const response = await handler(bearerEvent({
      method: 'GET',
      path: '/api/study/parent-notifications',
    }))

    expect(response.statusCode).toBe(503)
    expect(reserve).not.toHaveBeenCalled()
    expect(list).not.toHaveBeenCalled()
  })

  it('passes the exact identity and token to adult-review authorization before worker execution', async () => {
    const authorize = vi.fn(async () => true)
    const process = vi.fn(async () => undefined)
    const handler = createStudyAdultReviewHandler({
      env: ENV,
      fetchImpl: authFetch(),
      workerAuthorization: readyPort({ authorize }),
      worker: readyPort({ process }),
    })

    const response = await handler(bearerEvent({
      path: '/api/study/adult-review/process',
      body: { schemaVersion: 1, action: 'process-pending' },
    }))

    expect(response.statusCode).toBe(200)
    expect(authorize).toHaveBeenCalledWith({ actorUserId: USER_ID, accessToken: ACCESS_TOKEN })
    expect(process).toHaveBeenCalledOnce()
  })

  it('blocks adult-review authorization and worker execution after bearer failure', async () => {
    const authorize = vi.fn()
    const process = vi.fn()
    const handler = createStudyAdultReviewHandler({
      env: ENV,
      fetchImpl: authFetch({ message: 'refused' }, 403),
      workerAuthorization: readyPort({ authorize }),
      worker: readyPort({ process }),
    })

    const response = await handler(bearerEvent({
      path: '/api/study/adult-review/process',
      body: { schemaVersion: 1, action: 'process-pending' },
    }))

    expect(response.statusCode).toBe(401)
    expect(authorize).not.toHaveBeenCalled()
    expect(process).not.toHaveBeenCalled()
  })

  it('gates production readiness probes on the real bearer verifier', async () => {
    const check = vi.fn(async () => ({
      status: 'ready',
      expiresAtMs: Date.parse('2026-08-10T20:00:05.000Z'),
    }))
    const handler = createStudyProductionReadinessHandler({
      env: ENV,
      fetchImpl: authFetch(),
      readiness: { check },
    })

    const response = await handler(bearerEvent({
      method: 'GET',
      path: '/api/study/production/readiness',
    }))

    expect(response.statusCode).toBe(200)
    expect(check).toHaveBeenCalledOnce()
  })

  it('blocks production readiness probes after bearer failure', async () => {
    const check = vi.fn()
    const handler = createStudyProductionReadinessHandler({
      env: ENV,
      fetchImpl: authFetch({ error: 'outage' }, 500),
      readiness: { check },
    })

    const response = await handler(bearerEvent({
      method: 'GET',
      path: '/api/study/production/readiness',
    }))

    expect(response.statusCode).toBe(503)
    expect(check).not.toHaveBeenCalled()
  })
})
