/**
 * A6-3: the default server composition of the Study safety gateway must require
 * a verified durable Study session before any privileged operation, and must be
 * functional — not merely closed — once that session verifies.
 */

import { describe, expect, it, vi } from 'vitest'
import { createTestStudySafetyHandler } from '../../netlify/functions/study-safety-classify.js'
import { evaluateStudySafetyReadiness } from '../../netlify/functions/_shared/study-safety/readiness.js'
import { createVerifiedStudySessionAuthorizationPort } from '../../netlify/functions/_shared/study-safety/session-authorization.js'

const IDS = Object.freeze({
  actor: '11111111-1111-4111-8111-111111111111',
  request: '22222222-2222-4222-8222-222222222222',
  household: '33333333-3333-4333-8333-333333333333',
  student: '44444444-4444-4444-8444-444444444444',
  callerSession: '55555555-5555-4555-8555-555555555555',
  grant: '66666666-6666-4666-8666-666666666666',
  learnerSession: '77777777-7777-4777-8777-777777777777',
  otherActor: '88888888-8888-4888-8888-888888888888',
})
const SESSION_REFERENCE = `aca_stu_v1_${'A'.repeat(43)}`
const FORGED_REFERENCE = `aca_stu_v1_${'B'.repeat(43)}`
const SERVICE_KEY = 'service-role-test-key'
const ENV = Object.freeze({
  ACADEMY_STUDY_ENABLED: 'true',
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_ANON_KEY: 'public-test-key',
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  STUDY_SAFETY_RATE_LIMIT_HMAC_KEY: 'test-rate-limit-correlation-key',
})

function verifiedGrant() {
  return {
    schemaVersion: 1,
    status: 'verified',
    grantId: IDS.grant,
    householdId: IDS.household,
    studentId: IDS.student,
    learnerSessionId: IDS.learnerSession,
    sessionEpoch: IDS.learnerSession,
    sessionVersion: 1,
    authorizationRevision: 4,
    issuedAt: '2026-08-05T11:50:00.000Z',
    expiresAt: '2026-08-05T12:05:00.000Z',
    contractVersion: 1,
    issuerVersion: 'academy-student-session-issuer.v1',
    scope: ['student:assignments:read', 'student:attempts:create', 'student:progress:read'],
  }
}

/** Exercises the real default authorization composition through fetch only. */
function harness(options = {}) {
  const proposals = new Map()
  const store = Object.freeze({
    isDurable: true,
    isReady: () => true,
    async createProposal({ proposal }) {
      const previous = proposals.get(proposal.idempotencyKey)
      if (previous) return { created: false, duplicateProposalId: previous.proposalId }
      proposals.set(proposal.idempotencyKey, structuredClone(proposal))
      return { created: true }
    },
    async claim() { return [] },
    async recordRecipientResolutionAndEnqueue() { return [] },
  })
  const classifier = {
    classifierVersion: 'test-session-authorization-v1',
    isConfigured: () => true,
    circuitState: () => 'closed',
    async classify(request) {
      const outcome = request.deterministicAssessment.outcome
      return {
        classificationVersion: 1,
        classifierVersion: 'test-session-authorization-v1',
        outcome,
        categories: request.deterministicAssessment.categories,
        reasonCodes: [`safety-provider-${outcome}-v1`],
      }
    },
  }
  const rpcCalls = []
  const fetchImpl = options.fetchImpl ?? (async (url, init) => {
    rpcCalls.push({ url, init })
    return new Response(JSON.stringify(options.rpcBody ?? verifiedGrant()), {
      status: options.rpcStatus ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  const handler = createTestStudySafetyHandler({
    env: options.env ?? ENV,
    fetchImpl,
    classifier,
    proposalPersistence: options.proposalPersistenceReady === false
      ? { ...store, isReady: () => false }
      : store,
    outbox: store,
    recipientResolver: {
      isDurable: true,
      isReady: () => true,
      resolve: async () => ({ state: 'unavailable' }),
      reauthorizeForDelivery: async () => ({ status: 'denied' }),
    },
    rateLimiter: {
      isDurable: true,
      isReady: () => true,
      reserve: async () => ({ allowed: options.rateLimitAllowed !== false, retryAfterSeconds: 30 }),
    },
    monitoring: { isDurable: true, isReady: () => true, record: async () => {} },
    deliveryProviders: [{
      channel: 'in-app', isDurable: true, isReady: () => true,
      supportsDurableIdempotency: true, deliver: async () => ({ state: 'indeterminate' }),
    }],
    receiptValidators: [{
      channel: 'in-app', isDurable: true, isReady: () => true,
      verifyReceipt: async () => ({ verified: false }),
    }],
    learnerAuthorization: options.learnerAuthorization,
    authVerifier: async () => ({
      ok: true,
      user: { id: options.actorUserId ?? IDS.actor },
      accessToken: 'adult.access.token',
    }),
    now: () => Date.parse('2026-08-05T12:00:00.000Z'),
  })
  return { handler, proposals, classifier, rpcCalls }
}

function event(headers = {}, text = 'I am going to hurt myself.') {
  return {
    httpMethod: 'POST',
    path: '/api/study/safety/classify',
    headers: {
      authorization: 'Bearer adult.access.token',
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      schemaVersion: 1,
      requestId: IDS.request,
      studentRef: { kind: 'academy-student-id', value: IDS.student },
      sessionId: IDS.callerSession,
      transientText: text,
    }),
  }
}

describe('A6-3 durable Study-session authorization in the default composition', () => {
  it('recognizes only the concrete verifier capability, not a declared Boolean', () => {
    const port = createVerifiedStudySessionAuthorizationPort({ env: ENV, fetchImpl: async () => new Response('{}') })
    expect(port.isDurable).toBe(true)
    expect(port.isReady()).toBe(true)

    const readiness = evaluateStudySafetyReadiness({
      classifier: { isConfigured: () => true, circuitState: () => 'closed' },
      learnerAuthorization: port,
      rateLimiter: { isDurable: true, isReady: () => true, reserve: async () => ({ allowed: true }) },
      monitoring: { isDurable: true, isReady: () => true, record: async () => {} },
      proposalPersistence: { isDurable: true, isReady: () => true, createProposal: async () => ({ created: true }) },
      outbox: {
        isDurable: true, isReady: () => true,
        claim: async () => [], recordRecipientResolutionAndEnqueue: async () => [],
      },
      recipientResolver: {
        isDurable: true, isReady: () => true,
        resolve: async () => ({}), reauthorizeForDelivery: async () => ({}),
      },
      deliveryProviders: [{
        channel: 'in-app', isDurable: true, isReady: () => true,
        supportsDurableIdempotency: true, deliver: async () => ({}),
      }],
      receiptValidators: [{
        channel: 'in-app', isDurable: true, isReady: () => true, verifyReceipt: async () => ({ verified: false }),
      }],
    }, ENV)
    expect(readiness.missing).not.toContain('learner-session-authorization')
    expect(readiness.status).toBe('ready')

    const forgedReadiness = evaluateStudySafetyReadiness({
      classifier: { isConfigured: () => true, circuitState: () => 'closed' },
      learnerAuthorization: { isDurable: true, isReady: () => true, verifiesSession: true, resolve: async () => ({}) },
      rateLimiter: { isDurable: true, isReady: () => true, reserve: async () => ({ allowed: true }) },
      monitoring: { isDurable: true, isReady: () => true, record: async () => {} },
      proposalPersistence: { isDurable: true, isReady: () => true, createProposal: async () => ({ created: true }) },
      outbox: { isDurable: true, isReady: () => true, claim: async () => [], recordRecipientResolutionAndEnqueue: async () => [] },
      recipientResolver: { isDurable: true, isReady: () => true, resolve: async () => ({}), reauthorizeForDelivery: async () => ({}) },
      deliveryProviders: [{ channel: 'in-app', isDurable: true, isReady: () => true, supportsDurableIdempotency: true, deliver: async () => ({}) }],
      receiptValidators: [{ channel: 'in-app', isDurable: true, isReady: () => true, verifyReceipt: async () => ({ verified: false }) }],
    }, ENV)
    expect(forgedReadiness.status).toBe('not-ready')
    expect(forgedReadiness.missing).toContain('learner-session-authorization')
  })

  it('permits an injected authorization seam only through the test composition', async () => {
    const { handler } = harness({
      learnerAuthorization: {
        isDurable: true,
        isReady: () => true,
        async resolve() {
          return {
            status: 'authorized',
            context: {
              actorUserId: IDS.actor,
              householdId: IDS.household,
              studentId: IDS.student,
              sessionId: IDS.learnerSession,
            },
          }
        },
      },
    })
    expect((await handler(event())).statusCode).toBe(200)
  })

  it('executes the privileged operation for a verified session and binds it to server-derived identity', async () => {
    const { handler, proposals, rpcCalls } = harness()
    const result = await handler(event({ 'x-study-session': SESSION_REFERENCE }))

    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body).classification).toBe('urgent')
    expect(proposals.size).toBe(1)
    const [proposal] = [...proposals.values()]
    expect(proposal).toMatchObject({
      householdId: IDS.household,
      studentId: IDS.student,
      // Server-derived from the verified grant, not the caller's session claim.
      sessionId: IDS.learnerSession,
      classification: 'urgent',
      deliveryState: 'proposed-not-delivered',
    })
    expect(proposal.sessionId).not.toBe(IDS.callerSession)

    const verifyCall = rpcCalls.find(({ url }) => url.endsWith('/rpc/academy_study_verify_session_v1'))
    expect(verifyCall).toBeDefined()
    const parameters = JSON.parse(verifyCall.init.body)
    expect(parameters.p_required_capability).toBe('student:attempts:create')
    expect(parameters.p_token_digest).toMatch(/^[0-9a-f]{64}$/)
    expect(parameters.p_actor_user_id).toBe(IDS.actor)
    // The opaque reference itself never leaves this process.
    expect(JSON.stringify(verifyCall.init)).not.toContain(SESSION_REFERENCE)
  })

  it.each([
    ['a missing session reference', {}],
    ['a malformed session reference', { 'x-study-session': 'not-a-study-session' }],
    ['a duplicated session reference', { 'x-study-session': `${SESSION_REFERENCE}, ${FORGED_REFERENCE}` }],
  ])('refuses %s before any privileged operation', async (_label, headers) => {
    const { handler, proposals, classifier, rpcCalls } = harness()
    const spy = vi.spyOn(classifier, 'classify')
    const result = await handler(event(headers))

    expect(result.statusCode).toBe(403)
    expect(JSON.parse(result.body)).toEqual({ error: { code: 'learner_not_authorized' } })
    expect(spy).not.toHaveBeenCalled()
    expect(proposals.size).toBe(0)
    expect(rpcCalls).toHaveLength(0)
  })

  it('refuses a well-formed but forged session reference the store does not verify', async () => {
    const { handler, proposals, classifier } = harness({
      rpcBody: { schemaVersion: 1, status: 'denied', code: 'student-session-invalid' },
    })
    const spy = vi.spyOn(classifier, 'classify')
    const result = await handler(event({ 'x-study-session': FORGED_REFERENCE }))

    expect(result.statusCode).toBe(403)
    expect(spy).not.toHaveBeenCalled()
    expect(proposals.size).toBe(0)
  })

  it('refuses a verified session whose learner contradicts the caller-supplied reference', async () => {
    const port = createVerifiedStudySessionAuthorizationPort({
      env: ENV,
      fetchImpl: async () => new Response(JSON.stringify(verifiedGrant()), {
        headers: { 'content-type': 'application/json' },
      }),
    })
    const denied = await port.resolve({
      actorUserId: IDS.actor,
      sessionReference: SESSION_REFERENCE,
      studentRef: { kind: 'academy-student-id', value: '88888888-8888-4888-8888-888888888888' },
    })
    expect(denied).toEqual({ status: 'denied', code: 'learner-not-authorized' })

    const authorized = await port.resolve({
      actorUserId: IDS.actor,
      sessionReference: SESSION_REFERENCE,
      studentRef: { kind: 'academy-student-id', value: IDS.student.toUpperCase() },
    })
    expect(authorized.status).toBe('authorized')
    expect(authorized.context.sessionId).toBe(IDS.learnerSession)
  })

  it('denies a copied valid bearer under a different authenticated actor with the same opaque 403', async () => {
    const bindToGrantOwner = async (_url, init) => {
      const parameters = JSON.parse(init.body)
      const body = parameters.p_actor_user_id === IDS.actor
        ? verifiedGrant()
        : { schemaVersion: 1, status: 'denied', code: 'student-session-invalid' }
      return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
    }
    const copied = harness({
      fetchImpl: bindToGrantOwner,
      actorUserId: IDS.otherActor,
    })
    const forged = harness({
      rpcBody: { schemaVersion: 1, status: 'denied', code: 'student-session-invalid' },
    })

    const copiedResult = await copied.handler(event({ 'x-study-session': SESSION_REFERENCE }))
    const forgedResult = await forged.handler(event({ 'x-study-session': FORGED_REFERENCE }))
    expect(copiedResult.statusCode).toBe(403)
    expect(copiedResult.body).toBe(forgedResult.body)
    expect(copied.proposals.size).toBe(0)
  })

  it('authorizes a valid bearer presented by the grant owner', async () => {
    const { handler, proposals } = harness()
    const result = await handler(event({ 'x-study-session': SESSION_REFERENCE }))
    expect(result.statusCode).toBe(200)
    expect(proposals.size).toBe(1)
  })

  it.each([
    ['an unreachable verification store', { fetchImpl: async () => { throw new Error('network') } }],
    ['a failing verification store', { rpcStatus: 503, rpcBody: {} }],
    ['a malformed verification result', { rpcBody: { schemaVersion: 1, status: 'verified' } }],
  ])('fails closed for %s with no privileged effect and no secret exposure', async (_label, options) => {
    const { handler, proposals, classifier } = harness(options)
    const spy = vi.spyOn(classifier, 'classify')
    const result = await handler(event({ 'x-study-session': SESSION_REFERENCE }))

    // STUDY-A1-AUTH-INFRA-BOUNDARY-C — 424 Failed Dependency, not 503. The
    // verifier is a dependency of this request that could not be reached, and it
    // runs strictly before the classifier, so nothing about this learner was
    // evaluated. 503 was indistinguishable from a safety-service outage and the
    // host recorded it as a learner safety incident. The response is otherwise
    // byte-identical: same code, same absence of secrets, same fail-closed.
    expect(result.statusCode).toBe(424)
    expect(JSON.parse(result.body)).toEqual({ error: { code: 'authorization_unavailable' } })
    expect(spy).not.toHaveBeenCalled()
    expect(proposals.size).toBe(0)
    for (const secret of [
      SERVICE_KEY, SESSION_REFERENCE, IDS.household, IDS.student, IDS.learnerSession, 'hurt myself',
    ]) expect(result.body).not.toContain(secret)
  })

  // STUDY-A1-AUTH-INFRA-BOUNDARY-C — 424 is for the unreachable verifier and
  // nothing else. Everything below still answers on its existing status, so the
  // new category cannot be reached by a broad server failure.
  it('keeps a denied learner on 403, not on the infrastructure status', async () => {
    const { handler, proposals } = harness({
      rpcBody: { schemaVersion: 1, status: 'denied', code: 'student-session-invalid' },
    })
    const result = await handler(event({ 'x-study-session': SESSION_REFERENCE }))

    expect(result.statusCode).toBe(403)
    expect(JSON.parse(result.body)).toEqual({ error: { code: 'learner_not_authorized' } })
    expect(proposals.size).toBe(0)
  })

  it('keeps a not-ready safety service on 503', async () => {
    const { handler } = harness({
      // A safety dependency that is present but not ready is a safety-service
      // outage, which is exactly what 503 has always meant here.
      proposalPersistenceReady: false,
    })
    const result = await handler(event({ 'x-study-session': SESSION_REFERENCE }))

    expect(result.statusCode).toBe(503)
    expect(JSON.parse(result.body)).toEqual({ error: { code: 'service_not_ready' } })
  })

  it('keeps the disabled feature flag on 503 gateway_disabled', async () => {
    const { handler } = harness({ env: { ...ENV, ACADEMY_STUDY_ENABLED: 'false' } })
    const result = await handler(event({ 'x-study-session': SESSION_REFERENCE }))

    expect(result.statusCode).toBe(503)
    expect(JSON.parse(result.body)).toEqual({ error: { code: 'gateway_disabled' } })
  })

  it('keeps a rate-limited request on 429', async () => {
    const { handler } = harness({ rateLimitAllowed: false })
    const result = await handler(event({ 'x-study-session': SESSION_REFERENCE }))

    expect(result.statusCode).toBe(429)
    expect(JSON.parse(result.body).error.code).toBe('rate_limited')
  })
})
