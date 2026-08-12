/**
 * H3: a canonical Study student identity must survive the whole learner path.
 *
 * study-session-issue accepts canonical Postgres-storable student UUIDs, so the
 * Study Safety classify boundary must accept the same identity and then let the
 * trusted server verification decide authority. The selector may only narrow or
 * confirm that verified authority; it may never widen it, and it may never
 * nominate a household, guardian, actor, or session.
 */

import { describe, expect, it, vi } from 'vitest'
import { createStudySessionIssueHandler } from '../../netlify/functions/study-session-issue.js'
import { createTestStudySafetyHandler } from '../../netlify/functions/study-safety-classify.js'
import { createVerifiedStudySessionAuthorizationPort } from '../../netlify/functions/_shared/study-safety/session-authorization.js'

/**
 * Canonical Postgres UUIDs whose version nibble is outside [1-8] and whose
 * variant nibble is outside [89ab]: legitimate stored Study identities that an
 * RFC-strict predicate refuses.
 */
const IDS = Object.freeze({
  actor: '11111111-1111-4111-8111-111111111111',
  request: '22222222-2222-4222-8222-222222222222',
  callerSession: '55555555-5555-4555-8555-555555555555',
  grant: '66666666-6666-4666-8666-666666666666',
  // The seeded Study fixture graph: canonical academy_students.id values whose
  // version and variant nibbles fall outside the RFC-strict ranges.
  household: '00000000-0000-0000-0000-000000000011',
  student: '00000000-0000-0000-0000-000000000101',
  otherStudent: '00000000-0000-0000-0000-000000000201',
  learnerSession: '00000000-0000-0000-0000-000000009101',
})
const SESSION_REFERENCE = `aca_stu_v1_${'A'.repeat(43)}`
const SERVICE_KEY = 'service-role-test-key'
const ENV = Object.freeze({
  ACADEMY_STUDY_ENABLED: 'true',
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_ANON_KEY: 'public-test-key',
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  STUDY_SAFETY_RATE_LIMIT_HMAC_KEY: 'test-rate-limit-correlation-key',
})

function verifiedGrant(overrides = {}) {
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
    ...overrides,
  }
}

/** Exercises the real default classify composition through fetch only. */
function classifyHarness(options = {}) {
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
    classifierVersion: 'test-studentref-identity-v1',
    isConfigured: () => true,
    circuitState: () => 'closed',
    async classify(request) {
      const outcome = request.deterministicAssessment.outcome
      return {
        classificationVersion: 1,
        classifierVersion: 'test-studentref-identity-v1',
        outcome,
        categories: request.deterministicAssessment.categories,
        reasonCodes: [`safety-provider-${outcome}-v1`],
      }
    },
  }
  const rpcCalls = []
  const fetchImpl = async (url, init) => {
    rpcCalls.push({ url, init })
    return new Response(JSON.stringify(options.rpcBody ?? verifiedGrant()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  const handler = createTestStudySafetyHandler({
    env: ENV,
    fetchImpl,
    classifier,
    proposalPersistence: store,
    outbox: store,
    recipientResolver: {
      isDurable: true,
      isReady: () => true,
      resolve: async () => ({ state: 'unavailable' }),
      reauthorizeForDelivery: async () => ({ status: 'denied' }),
    },
    rateLimiter: { isDurable: true, isReady: () => true, reserve: async () => ({ allowed: true }) },
    monitoring: { isDurable: true, isReady: () => true, record: async () => {} },
    deliveryProviders: [{
      channel: 'in-app', isDurable: true, isReady: () => true,
      supportsDurableIdempotency: true, deliver: async () => ({ state: 'indeterminate' }),
    }],
    receiptValidators: [{
      channel: 'in-app', isDurable: true, isReady: () => true,
      verifyReceipt: async () => ({ verified: false }),
    }],
    authVerifier: async () => ({
      ok: true,
      user: { id: options.actorUserId ?? IDS.actor },
      accessToken: 'adult.access.token',
    }),
    now: () => Date.parse('2026-08-05T12:00:00.000Z'),
  })
  return { handler, proposals, classifier, rpcCalls }
}

function classifyEvent(bodyOverrides = {}, text = 'I am going to hurt myself.') {
  return {
    httpMethod: 'POST',
    path: '/api/study/safety/classify',
    headers: {
      authorization: 'Bearer adult.access.token',
      'x-study-session': SESSION_REFERENCE,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      schemaVersion: 1,
      requestId: IDS.request,
      studentRef: { kind: 'academy-student-id', value: IDS.student },
      sessionId: IDS.callerSession,
      transientText: text,
      ...bodyOverrides,
    }),
  }
}

function issueHarness() {
  const issued = []
  const handler = createStudySessionIssueHandler({
    env: ENV,
    authVerifier: async () => ({ ok: true, user: { id: IDS.actor }, accessToken: 'adult.access.token' }),
    issuer: {
      isDurable: true,
      isReady: () => true,
      async issue(input) {
        issued.push(input)
        return {
          schemaVersion: 1,
          status: 'issued',
          sessionReference: SESSION_REFERENCE,
          expiresAt: '2026-08-05T12:05:00.000Z',
        }
      },
    },
  })
  return { handler, issued }
}

function issueEvent(value) {
  return {
    httpMethod: 'POST',
    path: '/api/study/session/issue',
    headers: { authorization: 'Bearer adult.access.token', 'content-type': 'application/json' },
    body: JSON.stringify({
      schemaVersion: 1,
      selectedStudentRef: { kind: 'academy-student-id', value },
    }),
  }
}

describe('H3 canonical studentRef identity across session issue and safety classify', () => {
  it('issues a session for a canonical Study student identity', async () => {
    const { handler, issued } = issueHarness()
    const result = await handler(issueEvent(IDS.student))

    expect(result.statusCode).toBe(201)
    expect(JSON.parse(result.body)).toEqual({
      schemaVersion: 1,
      status: 'issued',
      sessionReference: SESSION_REFERENCE,
      expiresAt: '2026-08-05T12:05:00.000Z',
    })
    expect(issued).toHaveLength(1)
    expect(issued[0].selectedStudentRef).toEqual({ kind: 'academy-student-id', value: IDS.student })
  })

  it('accepts the same canonical studentRef at classify and binds the effect to server-derived identity', async () => {
    const { handler, proposals, rpcCalls } = classifyHarness()
    const result = await handler(classifyEvent())

    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body).classification).toBe('urgent')
    expect(proposals.size).toBe(1)

    const [proposal] = [...proposals.values()]
    expect(proposal).toMatchObject({
      householdId: IDS.household,
      studentId: IDS.student,
      // Server-derived from the verified grant, never the caller's claim.
      sessionId: IDS.learnerSession,
      classification: 'urgent',
      deliveryState: 'proposed-not-delivered',
    })
    expect(proposal.sessionId).not.toBe(IDS.callerSession)

    const verifyCall = rpcCalls.find(({ url }) => url.endsWith('/rpc/academy_study_verify_session_v1'))
    expect(verifyCall).toBeDefined()
    const parameters = JSON.parse(verifyCall.init.body)
    expect(parameters.p_actor_user_id).toBe(IDS.actor)
    expect(parameters.p_required_capability).toBe('student:attempts:create')
    // The caller-supplied selector is never forwarded as an authority claim.
    expect(Object.keys(parameters)).toEqual(['p_token_digest', 'p_required_capability', 'p_actor_user_id'])
    expect(JSON.stringify(verifyCall.init)).not.toContain(SESSION_REFERENCE)
  })

  it('compares the canonical selector to the verified grant owner case-insensitively', async () => {
    const port = createVerifiedStudySessionAuthorizationPort({
      env: ENV,
      fetchImpl: async () => new Response(JSON.stringify(verifiedGrant()), {
        headers: { 'content-type': 'application/json' },
      }),
    })

    const confirmed = await port.resolve({
      actorUserId: IDS.actor,
      sessionReference: SESSION_REFERENCE,
      studentRef: { kind: 'academy-student-id', value: IDS.student.toUpperCase() },
    })
    expect(confirmed.status).toBe('authorized')
    expect(confirmed.context).toEqual({
      actorUserId: IDS.actor,
      householdId: IDS.household,
      studentId: IDS.student,
      sessionId: IDS.learnerSession,
    })

    // A selector for a different canonical learner narrows to a refusal.
    expect(await port.resolve({
      actorUserId: IDS.actor,
      sessionReference: SESSION_REFERENCE,
      studentRef: { kind: 'academy-student-id', value: IDS.otherStudent },
    })).toEqual({ status: 'denied', code: 'learner-not-authorized' })
  })

  it('denies a canonical studentRef that contradicts the verified session, with no privileged effect', async () => {
    const { handler, proposals, classifier } = classifyHarness()
    const spy = vi.spyOn(classifier, 'classify')
    const result = await handler(classifyEvent({
      studentRef: { kind: 'academy-student-id', value: IDS.otherStudent },
    }))

    expect(result.statusCode).toBe(403)
    expect(JSON.parse(result.body)).toEqual({ error: { code: 'learner_not_authorized' } })
    expect(spy).not.toHaveBeenCalled()
    expect(proposals.size).toBe(0)
  })

  it.each([
    ['a non-UUID selector', 'not-a-student-id'],
    ['an empty selector', ''],
    ['a hyphenless selector', '00000000000000000000000000000101'],
    ['a non-hexadecimal selector', 'g0000000-0000-0000-0000-000000000101'],
    ['a braced selector', '{00000000-0000-0000-0000-000000000101}'],
    ['a null selector', null],
  ])('keeps %s fail-closed at 400 before any verification or classification', async (_label, value) => {
    const { handler, proposals, classifier, rpcCalls } = classifyHarness()
    const spy = vi.spyOn(classifier, 'classify')
    const result = await handler(classifyEvent({ studentRef: { kind: 'academy-student-id', value } }))

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({ error: { code: 'invalid_request' } })
    expect(spy).not.toHaveBeenCalled()
    expect(proposals.size).toBe(0)
    expect(rpcCalls).toHaveLength(0)

    // The same malformed selector is refused by the issuer too.
    const issue = issueHarness()
    expect((await issue.handler(issueEvent(value))).statusCode).toBe(400)
    expect(issue.issued).toHaveLength(0)
  })

  it.each([
    ['a household', 'householdId'],
    ['a guardian', 'guardianId'],
    ['an actor', 'actorUserId'],
    ['an authority', 'authority'],
    ['a learner session', 'learnerSessionId'],
  ])('refuses a browser attempt to nominate %s alongside the canonical selector', async (_label, key) => {
    const { handler, proposals, rpcCalls } = classifyHarness()
    const result = await handler(classifyEvent({ [key]: IDS.household }))

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({ error: { code: 'invalid_request' } })
    expect(proposals.size).toBe(0)
    expect(rpcCalls).toHaveLength(0)
  })

  it('cannot substitute identity through the untouched legacy-profile-id branch', async () => {
    // This branch keeps its opaque rule. It carries no narrowing comparison, so
    // the proof it must satisfy is that it cannot widen either: every privileged
    // value still comes from the verified grant, not the selector.
    const { handler, proposals } = classifyHarness()
    const result = await handler(classifyEvent({
      studentRef: { kind: 'legacy-profile-id', value: 'legacy-profile:not-this-learner' },
    }))

    expect(result.statusCode).toBe(200)
    expect(proposals.size).toBe(1)
    const [proposal] = [...proposals.values()]
    expect(proposal.studentId).toBe(IDS.student)
    expect(proposal.householdId).toBe(IDS.household)
    expect(proposal.sessionId).toBe(IDS.learnerSession)
    expect(JSON.stringify(proposal)).not.toContain('legacy-profile:not-this-learner')
  })

  it('lets the selector only confirm, never widen, the verified grant', async () => {
    // The grant names a different learner than the harness default. The caller
    // cannot reach that learner by asking for it, and cannot reach its own
    // claimed learner either, because authority comes from the grant alone.
    const { handler, proposals } = classifyHarness({
      rpcBody: verifiedGrant({ studentId: IDS.otherStudent }),
    })
    expect((await handler(classifyEvent())).statusCode).toBe(403)
    expect(proposals.size).toBe(0)

    const matching = classifyHarness({ rpcBody: verifiedGrant({ studentId: IDS.otherStudent }) })
    const result = await matching.handler(classifyEvent({
      studentRef: { kind: 'academy-student-id', value: IDS.otherStudent },
    }))
    expect(result.statusCode).toBe(200)
    const [proposal] = [...matching.proposals.values()]
    expect(proposal.studentId).toBe(IDS.otherStudent)
  })
})
