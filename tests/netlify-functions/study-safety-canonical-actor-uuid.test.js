/**
 * Study Safety must not re-reject an actor identity the shared Bearer Auth
 * verifier has already authenticated.
 *
 * The shared verifier uses the canonical Study identity UUID predicate
 * (netlify/functions/_shared/study-identity/contracts.js), which is canonical
 * PostgreSQL `uuid` syntax: 8-4-4-4-12 hex, case-insensitive, with no RFC-4122
 * version or variant nibble constraint. Study Safety's own request contract
 * keeps a stricter RFC-shaped predicate for CALLER-SUPPLIED ids, and that must
 * stay strict — so this file pins both halves:
 *
 *   1. a verified actor id must reach the authorization RPC boundary whenever it
 *      is canonically valid, and
 *   2. caller-supplied body ids must still be refused when they are not
 *      RFC-shaped.
 *
 * Every assertion drives the real production modules. There is deliberately no
 * regex literal in this file: both predicates are imported from the two real
 * contract modules so a fixture can never drift away from the code it pins.
 */

import { describe, expect, it, vi } from 'vitest'
import { createProductionStudySafetyHandler } from '../../netlify/functions/study-safety-classify.js'
import { createSupabaseLearnerAuthorizationPort } from '../../netlify/functions/_shared/study-safety/authorization.js'
import { createVerifiedStudySessionAuthorizationPort } from '../../netlify/functions/_shared/study-safety/session-authorization.js'
import { evaluateStudySafetyReadiness } from '../../netlify/functions/_shared/study-safety/readiness.js'
import { validUuid as validCanonicalUuid } from '../../netlify/functions/_shared/study-identity/contracts.js'
import { validUuid as validStrictRequestUuid } from '../../netlify/functions/_shared/study-safety/contracts.js'

const AUTH_URL = 'https://academy.supabase.co/auth/v1/user'
const RPC_URL = 'https://academy.supabase.co/rest/v1/rpc/academy_study_verify_session_v1'
const ACCESS_TOKEN = 'guardian.header.payload'
const SERVICE_KEY = 'server-service-key'
const SESSION_REFERENCE = `aca_stu_v1_${'A'.repeat(43)}`

/** Caller-supplied ids. These stay RFC-shaped; the request contract still requires it. */
const CALLER = Object.freeze({
  request: '22222222-2222-4222-8222-222222222222',
  student: '44444444-4444-4444-8444-444444444444',
  session: '55555555-5555-4555-8555-555555555555',
})
/** Server-derived grant ids, returned by the verification RPC. */
const GRANT = Object.freeze({
  household: '33333333-3333-4333-8333-333333333333',
  student: CALLER.student,
  learnerSession: '77777777-7777-4777-8777-777777777777',
  grant: '66666666-6666-4666-8666-666666666666',
})

/**
 * Actor ids the shared verifier authenticates. CONTROL rows already pass Study
 * Safety today (both predicates carry the `i` flag, so case was never the
 * discriminator); DISCRIMINATING rows are the ones the RFC-shaped predicate
 * refuses. Only the discriminating rows are evidence of this fix.
 */
const CONTROL_ACTORS = Object.freeze([
  ['lowercase canonical UUID', 'a1b2c3d4-e5f6-4789-8bcd-0123456789ab'],
  ['uppercase hexadecimal UUID', 'A1B2C3D4-E5F6-4789-8BCD-0123456789AB'],
])
const DISCRIMINATING_ACTORS = Object.freeze([
  ['non-RFC version nibble', 'a1b2c3d4-e5f6-f789-8bcd-0123456789ab'],
  ['non-RFC variant nibble', 'a1b2c3d4-e5f6-4789-7bcd-0123456789ab'],
  ['all-zero canonical UUID', '00000000-0000-0000-0000-000000000000'],
])
const ACCEPTED_ACTORS = Object.freeze([...CONTROL_ACTORS, ...DISCRIMINATING_ACTORS])

/** Shapes that are not canonical PostgreSQL uuids and must never reach the RPC. */
const REJECTED_ACTORS = Object.freeze([
  ['malformed length (short)', 'a1b2c3d4-e5f6-4789-8bcd-0123456789a'],
  ['malformed length (long)', 'a1b2c3d4-e5f6-4789-8bcd-0123456789abc'],
  ['missing hyphens', 'a1b2c3d4e5f647898bcd0123456789ab'],
  ['non-hex character', 'a1b2c3d4-e5f6-4789-8bcd-0123456789ag'],
  ['leading whitespace', ' a1b2c3d4-e5f6-4789-8bcd-0123456789ab'],
  ['trailing whitespace', 'a1b2c3d4-e5f6-4789-8bcd-0123456789ab '],
  ['trailing newline', 'a1b2c3d4-e5f6-4789-8bcd-0123456789ab\n'],
  ['brace-wrapped', '{a1b2c3d4-e5f6-4789-8bcd-0123456789ab}'],
  ['arbitrary string', 'household-user'],
  ['empty string', ''],
  ['null', null],
  ['number', 42],
  ['object', { id: 'a1b2c3d4-e5f6-4789-8bcd-0123456789ab' }],
  ['array', ['a1b2c3d4-e5f6-4789-8bcd-0123456789ab']],
])

const ENV = Object.freeze({
  ACADEMY_STUDY_ENABLED: 'true',
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_ANON_KEY: 'public-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  STUDY_SAFETY_RATE_LIMIT_HMAC_KEY: 'test-rate-limit-key',
})

function verifiedGrant() {
  return {
    schemaVersion: 1,
    status: 'verified',
    grantId: GRANT.grant,
    householdId: GRANT.household,
    studentId: GRANT.student,
    learnerSessionId: GRANT.learnerSession,
    sessionEpoch: GRANT.learnerSession,
    sessionVersion: 1,
    authorizationRevision: 4,
    issuedAt: '2026-08-05T11:50:00.000Z',
    expiresAt: '2026-08-05T12:05:00.000Z',
    contractVersion: 1,
    issuerVersion: 'academy-student-session-issuer.v1',
    scope: ['student:assignments:read', 'student:attempts:create', 'student:progress:read'],
  }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/**
 * One spy for the only network seam. The real bearer verifier and the real
 * service RPC both receive it, so bearer verification is never stubbed out.
 */
function routedFetch({ actorUserId, rpcBody, rpcThrows = false }) {
  return vi.fn(async (url) => {
    if (url === AUTH_URL) return jsonResponse({ id: actorUserId })
    if (url === RPC_URL) {
      if (rpcThrows) throw new Error('network')
      return jsonResponse(rpcBody ?? { schemaVersion: 1, status: 'denied' })
    }
    throw new Error(`unexpected URL: ${url}`)
  })
}

const callsTo = (fetchImpl, target) => fetchImpl.mock.calls.filter(([url]) => url === target)
const rpcCalls = (fetchImpl) => callsTo(fetchImpl, RPC_URL)
const authCalls = (fetchImpl) => callsTo(fetchImpl, AUTH_URL)

function readyPort(methods) {
  return { isDurable: true, isReady: () => true, ...methods }
}

/**
 * The production factory, not the test factory. It throws on a
 * `learnerAuthorization` override, so the authorization port exercised here is
 * necessarily the real `createVerifiedStudySessionAuthorizationPort`.
 */
function harness(fetchImpl) {
  const proposals = []
  const classifier = {
    mode: 'production',
    classifierVersion: 'canonical-actor-uuid-test-v1',
    isConfigured: () => true,
    circuitState: () => 'closed',
    classify: vi.fn(async (request) => {
      const outcome = request.deterministicAssessment.outcome
      return {
        classificationVersion: 1,
        classifierVersion: 'canonical-actor-uuid-test-v1',
        outcome,
        categories: request.deterministicAssessment.categories,
        reasonCodes: [`safety-provider-${outcome}-v1`],
      }
    }),
  }
  const proposalPersistence = readyPort({
    createProposal: vi.fn(async ({ proposal }) => {
      proposals.push(structuredClone(proposal))
      return { created: true }
    }),
  })
  const productionPorts = {
    proposalPersistence,
    outbox: readyPort({ claim: vi.fn(async () => []), recordRecipientResolutionAndEnqueue: vi.fn(async () => []) }),
    recipientResolver: readyPort({
      resolve: vi.fn(async () => ({ state: 'unavailable' })),
      reauthorizeForDelivery: vi.fn(async () => ({ status: 'denied' })),
    }),
    rateLimiter: readyPort({ reserve: vi.fn(async () => ({ allowed: true })) }),
    monitoring: readyPort({ record: vi.fn(async () => undefined) }),
    refreshReadiness: vi.fn(async () => true),
  }
  const handler = createProductionStudySafetyHandler({
    env: ENV,
    fetchImpl,
    classifier,
    productionPorts,
    monitoring: productionPorts.monitoring,
    deliveryProviders: [readyPort({ channel: 'in-app', supportsDurableIdempotency: true, deliver: vi.fn() })],
    receiptValidators: [readyPort({ channel: 'in-app', verifyReceipt: vi.fn() })],
    logBoot: vi.fn(),
    now: () => Date.parse('2026-08-05T12:00:00.000Z'),
  })
  return { handler, classifier, proposals, productionPorts }
}

function classifyEvent(bodyOverrides = {}, headerOverrides = {}) {
  return {
    httpMethod: 'POST',
    path: '/api/study/safety/classify',
    headers: {
      authorization: `Bearer ${ACCESS_TOKEN}`,
      'content-type': 'application/json',
      'x-study-session': SESSION_REFERENCE,
      ...headerOverrides,
    },
    body: JSON.stringify({
      schemaVersion: 1,
      requestId: CALLER.request,
      studentRef: { kind: 'academy-student-id', value: CALLER.student },
      sessionId: CALLER.session,
      transientText: 'I am going to hurt myself.',
      ...bodyOverrides,
    }),
  }
}

describe('Study Safety actor ids follow the canonical Study identity contract', () => {
  // ---------------------------------------------------------------------------
  // Fixture integrity. Without this block a fixture could silently stop
  // discriminating (the strict predicate admits version nibbles 1-8, so a
  // "non-RFC" fixture using 6, 7 or 8 would prove nothing).
  // ---------------------------------------------------------------------------
  describe('fixture integrity', () => {
    it.each(ACCEPTED_ACTORS)('%s is a canonical Study identity UUID', (_label, actor) => {
      expect(validCanonicalUuid(actor)).toBe(true)
    })

    it.each(DISCRIMINATING_ACTORS)('%s is refused by the strict request predicate', (_label, actor) => {
      expect(validStrictRequestUuid(actor)).toBe(false)
    })

    it.each(CONTROL_ACTORS)('%s is a control, not evidence: both predicates accept it', (_label, actor) => {
      expect(validStrictRequestUuid(actor)).toBe(true)
      expect(validCanonicalUuid(actor)).toBe(true)
    })

    it.each(REJECTED_ACTORS)('%s is refused by both predicates', (_label, actor) => {
      expect(validCanonicalUuid(actor)).toBe(false)
      expect(validStrictRequestUuid(actor)).toBe(false)
    })

    // Tripwire against a future "dedupe the predicate" refactor: the request
    // contract's predicate must remain a distinct, stricter function.
    it('keeps the request predicate distinct from the identity predicate', () => {
      expect(validStrictRequestUuid).not.toBe(validCanonicalUuid)
      const [, nonRfc] = DISCRIMINATING_ACTORS[0]
      expect(validCanonicalUuid(nonRfc)).toBe(true)
      expect(validStrictRequestUuid(nonRfc)).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Accepted matrix. The load-bearing assertion is that the RPC boundary is
  // REACHED. The HTTP status is identical whether or not it was reached, so a
  // status assertion would be vacuous here.
  // ---------------------------------------------------------------------------
  describe('a verified actor id reaches the authorization RPC boundary', () => {
    it.each(ACCEPTED_ACTORS)('%s reaches the RPC and is passed through unchanged', async (_label, actor) => {
      const fetchImpl = routedFetch({ actorUserId: actor })
      const { handler, classifier } = harness(fetchImpl)

      const response = await handler(classifyEvent())

      // Shared Bearer Auth ran against the real verifier and succeeded.
      expect(authCalls(fetchImpl)).toHaveLength(1)
      // Local canonical validation passed and the authorization RPC was called.
      expect(rpcCalls(fetchImpl).length).toBeGreaterThanOrEqual(1)

      const [, rpcInit] = rpcCalls(fetchImpl)[0]
      // toEqual, not toMatchObject: a fourth key would smuggle a caller claim.
      expect(JSON.parse(rpcInit.body)).toEqual({
        p_token_digest: expect.stringMatching(/^[0-9a-f]{64}$/),
        p_required_capability: 'student:attempts:create',
        p_actor_user_id: actor,
      })
      expect(rpcInit.headers.Authorization).toBe(`Bearer ${SERVICE_KEY}`)
      // The adult access token is never forwarded to the service-role RPC.
      expect(JSON.stringify(rpcCalls(fetchImpl)[0])).not.toContain(ACCESS_TOKEN)
      // Reaching the boundary is not authorization: this grant was refused.
      expect(response.statusCode).toBe(403)
      expect(response.statusCode).not.toBe(424)
      expect(classifier.classify).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // Rejected matrix, driven at the port. Driving these through the handler
  // would be vacuous: the shared verifier refuses them first, so zero RPC calls
  // would hold even if Study Safety validated nothing at all.
  // ---------------------------------------------------------------------------
  describe('a malformed actor id is refused locally with zero RPC calls', () => {
    it.each(REJECTED_ACTORS)('%s is denied before any RPC call', async (_label, actor) => {
      const fetchImpl = routedFetch({ actorUserId: actor })
      const port = createVerifiedStudySessionAuthorizationPort({ env: ENV, fetchImpl })

      const result = await port.resolve({
        actorUserId: actor,
        // Valid on purpose. `resolve` short-circuits on `!validUuid || !digest`,
        // so a bad reference would satisfy the assertion for the wrong reason.
        sessionReference: SESSION_REFERENCE,
        studentRef: { kind: 'academy-student-id', value: CALLER.student },
      })

      expect(result).toEqual({ status: 'denied', code: 'student-session-invalid' })
      expect(rpcCalls(fetchImpl)).toHaveLength(0)
    })

    // Defeats the short-circuit confound above: with the same valid reference, a
    // canonical actor DOES reach the RPC, so the actor clause is the only cause.
    it.each(ACCEPTED_ACTORS)('paired control: %s with the same reference reaches the RPC', async (_label, actor) => {
      const fetchImpl = routedFetch({ actorUserId: actor })
      const port = createVerifiedStudySessionAuthorizationPort({ env: ENV, fetchImpl })

      await port.resolve({
        actorUserId: actor,
        sessionReference: SESSION_REFERENCE,
        studentRef: { kind: 'academy-student-id', value: CALLER.student },
      })

      expect(rpcCalls(fetchImpl)).toHaveLength(1)
      expect(JSON.parse(rpcCalls(fetchImpl)[0][1].body).p_actor_user_id).toBe(actor)
    })
  })

  // ---------------------------------------------------------------------------
  // Bearer success alone creates no learner authority.
  // ---------------------------------------------------------------------------
  describe('reaching the boundary creates no learner authority', () => {
    it.each(DISCRIMINATING_ACTORS)('%s derives all authority from the grant, never from the actor', async (_label, actor) => {
      const fetchImpl = routedFetch({ actorUserId: actor, rpcBody: verifiedGrant() })
      const { handler, proposals } = harness(fetchImpl)

      const response = await handler(classifyEvent())

      expect(response.statusCode).toBe(200)
      expect(proposals).toHaveLength(1)
      const [proposal] = proposals
      // Household, learner and session are server-derived from the grant.
      expect(proposal.householdId).toBe(GRANT.household)
      expect(proposal.studentId).toBe(GRANT.student)
      expect(proposal.sessionId).toBe(GRANT.learnerSession)
      // The caller's own session claim was not honoured.
      expect(proposal.sessionId).not.toBe(CALLER.session)
      // Nothing was synthesised from the actor id.
      expect(proposal.householdId).not.toBe(actor)
      expect(proposal.studentId).not.toBe(actor)
      expect(proposal.sessionId).not.toBe(actor)
      expect(response.body).not.toContain(actor)
    })

    it('projects exactly the four authority fields, frozen, from the grant', async () => {
      const [, actor] = DISCRIMINATING_ACTORS[0]
      const fetchImpl = routedFetch({ actorUserId: actor, rpcBody: verifiedGrant() })
      const port = createVerifiedStudySessionAuthorizationPort({ env: ENV, fetchImpl })

      const result = await port.resolve({
        actorUserId: actor,
        sessionReference: SESSION_REFERENCE,
        studentRef: { kind: 'academy-student-id', value: CALLER.student },
      })

      expect(result.status).toBe('authorized')
      expect(Object.keys(result.context)).toEqual(['actorUserId', 'householdId', 'studentId', 'sessionId'])
      expect(Object.isFrozen(result.context)).toBe(true)
      expect(result.context).toEqual({
        actorUserId: actor,
        householdId: GRANT.household,
        studentId: GRANT.student,
        sessionId: GRANT.learnerSession,
      })
    })

    it('still refuses a canonical actor the hosted verifier denies', async () => {
      const [, actor] = DISCRIMINATING_ACTORS[2]
      const fetchImpl = routedFetch({
        actorUserId: actor,
        rpcBody: { schemaVersion: 1, status: 'denied', code: 'student-session-invalid' },
      })
      const { handler, proposals, classifier } = harness(fetchImpl)

      const response = await handler(classifyEvent())

      expect(rpcCalls(fetchImpl)).toHaveLength(1)
      expect(response.statusCode).toBe(403)
      expect(JSON.parse(response.body)).toEqual({ error: { code: 'learner_not_authorized' } })
      expect(proposals).toHaveLength(0)
      expect(classifier.classify).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // Authentication and infrastructure failure must stay a refusal.
  // ---------------------------------------------------------------------------
  describe('auth and infrastructure failure create no safety event', () => {
    it('creates nothing when bearer verification fails', async () => {
      const fetchImpl = vi.fn(async (url) => {
        if (url === AUTH_URL) return jsonResponse({ error: 'invalid' }, 401)
        throw new Error(`unexpected URL: ${url}`)
      })
      const { handler, classifier, proposals, productionPorts } = harness(fetchImpl)

      const response = await handler(classifyEvent())

      expect(response.statusCode).toBe(401)
      expect(response.statusCode).not.toBe(424)
      expect(rpcCalls(fetchImpl)).toHaveLength(0)
      expect(proposals).toHaveLength(0)
      expect(classifier.classify).not.toHaveBeenCalled()
      expect(productionPorts.proposalPersistence.createProposal).not.toHaveBeenCalled()
      expect(productionPorts.rateLimiter.reserve).not.toHaveBeenCalled()
      expect(productionPorts.refreshReadiness).not.toHaveBeenCalled()
    })

    it.each(DISCRIMINATING_ACTORS)('creates nothing when the authorization RPC is unreachable for %s', async (_label, actor) => {
      const fetchImpl = routedFetch({ actorUserId: actor, rpcThrows: true })
      const { handler, classifier, proposals } = harness(fetchImpl)

      const response = await handler(classifyEvent())

      // The boundary was reached; the infrastructure behind it failed.
      expect(rpcCalls(fetchImpl)).toHaveLength(1)
      expect(response.statusCode).toBe(503)
      expect(response.statusCode).not.toBe(424)
      expect(JSON.parse(response.body)).toEqual({ error: { code: 'authorization_unavailable' } })
      expect(proposals).toHaveLength(0)
      expect(classifier.classify).not.toHaveBeenCalled()
      expect(response.body).not.toContain(SERVICE_KEY)
      expect(response.body).not.toContain(SESSION_REFERENCE)
    })
  })

  // ---------------------------------------------------------------------------
  // Blast radius. The request contract's predicate is shared by three
  // caller-supplied fields. Widening it there would relax untrusted input, so
  // this block fails loudly if anyone edits the regex instead of the import.
  // ---------------------------------------------------------------------------
  describe('caller-supplied request ids stay strictly RFC-shaped', () => {
    const [, canonicalActor] = CONTROL_ACTORS[0]
    const widened = DISCRIMINATING_ACTORS.map(([label, value]) => [label, value])
    const fields = [
      ['requestId', (value) => ({ requestId: value })],
      ['studentRef.value', (value) => ({ studentRef: { kind: 'academy-student-id', value } })],
      ['sessionId', (value) => ({ sessionId: value })],
    ]

    for (const [fieldName, build] of fields) {
      it.each(widened)(`refuses ${fieldName} with a %s`, async (_label, value) => {
        const fetchImpl = routedFetch({ actorUserId: canonicalActor })
        const { handler, classifier, proposals } = harness(fetchImpl)

        const response = await handler(classifyEvent(build(value)))

        expect(response.statusCode).toBe(400)
        expect(JSON.parse(response.body)).toEqual({ error: { code: 'invalid_request' } })
        // Refused by the request contract, before any authorization call.
        expect(rpcCalls(fetchImpl)).toHaveLength(0)
        expect(proposals).toHaveLength(0)
        expect(classifier.classify).not.toHaveBeenCalled()
      })
    }

    it('accepts the same fields when they are RFC-shaped', async () => {
      const fetchImpl = routedFetch({ actorUserId: canonicalActor, rpcBody: verifiedGrant() })
      const { handler } = harness(fetchImpl)

      expect((await handler(classifyEvent())).statusCode).toBe(200)
    })
  })

  // ---------------------------------------------------------------------------
  // The non-routable predecessor authorizer carries the same strict re-check.
  // It is left unchanged; this pins that it cannot become the production
  // authorizer without failing readiness closed.
  // ---------------------------------------------------------------------------
  describe('the predecessor learner authorization port stays non-routable', () => {
    it('cannot satisfy Study Safety readiness', () => {
      const port = createSupabaseLearnerAuthorizationPort({
        env: ENV,
        fetchImpl: async () => jsonResponse([]),
      })
      expect(port.isReady()).toBe(true)
      expect(port.verifiesSession).toBe(false)

      const readiness = evaluateStudySafetyReadiness({
        classifier: { isConfigured: () => true, circuitState: () => 'closed' },
        learnerAuthorization: port,
        rateLimiter: readyPort({ reserve: async () => ({ allowed: true }) }),
        monitoring: readyPort({ record: async () => {} }),
        proposalPersistence: readyPort({ createProposal: async () => ({ created: true }) }),
        outbox: readyPort({ claim: async () => [], recordRecipientResolutionAndEnqueue: async () => [] }),
        recipientResolver: readyPort({ resolve: async () => ({}), reauthorizeForDelivery: async () => ({}) }),
        deliveryProviders: [readyPort({ channel: 'in-app', supportsDurableIdempotency: true, deliver: async () => ({}) })],
        receiptValidators: [readyPort({ channel: 'in-app', verifyReceipt: async () => ({ verified: false }) })],
      }, ENV)

      expect(readiness.status).toBe('not-ready')
      expect(readiness.missing).toContain('learner-session-authorization')
    })
  })
})
