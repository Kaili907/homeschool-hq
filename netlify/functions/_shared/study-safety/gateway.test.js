import { describe, expect, it, vi } from 'vitest'
import { createInMemoryAdultReviewStore } from '../study-adult-review/memory-store.js'
import { createTestRecipientResolver } from '../study-adult-review/recipients.js'
import { createStudySafetyHandler } from '../../study-safety-classify.js'
import { errorResponse } from '../http.js'

const IDS = Object.freeze({
  actor: '11111111-1111-4111-8111-111111111111',
  request: '22222222-2222-4222-8222-222222222222',
  household: '33333333-3333-4333-8333-333333333333',
  student: '44444444-4444-4444-8444-444444444444',
  session: '55555555-5555-4555-8555-555555555555',
})
const ENV = Object.freeze({
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_ANON_KEY: 'public-test-key',
  ANTHROPIC_API_KEY: 'provider-test-key',
  STUDY_SAFETY_RATE_LIMIT_HMAC_KEY: 'test-rate-limit-correlation-key',
})

function event(text = 'ordinary answer', bodyOverrides = {}, eventOverrides = {}) {
  return {
    httpMethod: 'POST',
    path: '/api/study/safety/classify',
    headers: { authorization: 'Bearer test.access.token', 'content-type': 'application/json' },
    body: JSON.stringify({
      schemaVersion: 1,
      requestId: IDS.request,
      studentRef: { kind: 'academy-student-id', value: IDS.student },
      sessionId: IDS.session,
      transientText: text,
      ...bodyOverrides,
    }),
    ...eventOverrides,
  }
}

function responseJson(result) {
  return JSON.parse(result.body)
}

function readyHarness(options = {}) {
  const rawStore = createInMemoryAdultReviewStore()
  const store = Object.freeze({ ...rawStore, isDurable: true })
  const monitoringEvents = []
  const monitoring = {
    isDurable: true,
    isReady: () => true,
    record: async (value) => monitoringEvents.push(value),
  }
  const classifier = options.classifier ?? {
    classifierVersion: 'test-safety-classifier-v1',
    isConfigured: () => true,
    circuitState: () => 'closed',
    async classify(request) {
      const outcome = request.deterministicAssessment.outcome
      return {
        classificationVersion: 1,
        classifierVersion: 'test-safety-classifier-v1',
        outcome,
        categories: request.deterministicAssessment.categories,
        reasonCodes: [`safety-provider-${outcome}-v1`],
      }
    },
  }
  const recipientResolver = Object.freeze({
    ...createTestRecipientResolver({
      proposalRef: 'safety-proposal-placeholder',
      recipients: [{
        recipientRef: 'recipient:test-guardian',
        membershipRef: 'membership:test-guardian',
        learnerRelationshipRef: 'relationship:test-student',
        notificationPermissionRef: 'notification-permission:test-safety',
        relationship: 'guardian',
        routes: [{ channel: 'in-app', routeRef: 'in-app-route:test-guardian' }],
      }],
    }),
    isDurable: true,
  })
  const authVerifier = options.authVerifier ?? (async () => ({ ok: true, user: { id: IDS.actor }, accessToken: 'test.access.token' }))
  const learnerAuthorization = options.learnerAuthorization ?? {
    isDurable: true,
    verifiesSession: true,
    isReady: () => true,
    resolve: async ({ sessionId }) => ({
      status: 'authorized',
      context: { actorUserId: IDS.actor, householdId: IDS.household, studentId: IDS.student, sessionId },
    }),
  }
  const rateLimiter = options.rateLimiter ?? {
    isDurable: true,
    isReady: () => true,
    reserve: async () => ({ allowed: true }),
  }
  const handler = createStudySafetyHandler({
    env: options.env ?? ENV,
    classifier,
    learnerAuthorization,
    proposalPersistence: store,
    outbox: store,
    recipientResolver,
    rateLimiter,
    authVerifier,
    monitoring,
    now: () => Date.parse('2026-08-01T12:00:00.000Z'),
  })
  return { handler, store, monitoringEvents, classifier, rateLimiter }
}

describe('Study safety gateway security and privacy', () => {
  it('reports only sanitized readiness and uses 503 while not ready', async () => {
    const handler = createStudySafetyHandler({ env: {} })
    const result = await handler({ httpMethod: 'GET', path: '/api/study/safety/readiness', headers: {} })
    expect(result.statusCode).toBe(503)
    expect(responseJson(result)).toEqual({ status: 'not-ready' })
  })

  it('requires auth before classification and sanitizes invalid or expired sessions', async () => {
    const { handler, classifier } = readyHarness({
      authVerifier: async () => ({ ok: false, response: errorResponse(401, 'unauthenticated') }),
    })
    const spy = vi.spyOn(classifier, 'classify')
    const result = await handler(event('I want to die'))
    expect(result.statusCode).toBe(401)
    expect(responseJson(result)).toEqual({ error: { code: 'unauthenticated' } })
    expect(spy).not.toHaveBeenCalled()
  })

  it('rejects forged authority and recipient/contact fields by exact schema', async () => {
    const { handler, classifier } = readyHarness()
    const spy = vi.spyOn(classifier, 'classify')
    for (const extra of [
      { householdId: IDS.household }, { email: 'spoof@example.test' }, { phone: '+15555550100' },
      { role: 'guardian' }, { adultNotificationPermission: true }, { recipientRef: 'recipient:forged' },
    ]) {
      const result = await handler(event('ordinary answer', extra))
      expect(result.statusCode).toBe(400)
    }
    expect(spy).not.toHaveBeenCalled()
  })

  it.each(['denied', 'unavailable'])('fails closed for %s learner/session authorization', async (status) => {
    const { handler, classifier } = readyHarness({
      learnerAuthorization: {
        isDurable: true,
        verifiesSession: true,
        isReady: () => true,
        resolve: async () => ({ status, code: status === 'denied' ? 'learner-not-authorized' : 'unavailable' }),
      },
    })
    const spy = vi.spyOn(classifier, 'classify')
    const result = await handler(event())
    expect(result.statusCode).toBe(status === 'denied' ? 403 : 503)
    expect(spy).not.toHaveBeenCalled()
  })

  it('enforces a server-derived durable rate limit before reading learner text', async () => {
    const reserve = vi.fn(async () => ({ allowed: false, retryAfterSeconds: 17 }))
    const { handler, classifier } = readyHarness({
      rateLimiter: { isDurable: true, isReady: () => true, reserve },
    })
    const spy = vi.spyOn(classifier, 'classify')
    const result = await handler(event('private synthetic sentinel'))
    expect(result.statusCode).toBe(429)
    expect(result.headers['retry-after']).toBe('17')
    expect(reserve.mock.calls[0][0].actorRef).toMatch(/^actor:[a-f0-9]{64}$/)
    expect(JSON.stringify(reserve.mock.calls)).not.toContain(IDS.actor)
    expect(spy).not.toHaveBeenCalled()
  })

  it('enforces request byte limits without provider use', async () => {
    const { handler, classifier } = readyHarness()
    const spy = vi.spyOn(classifier, 'classify')
    const result = await handler(event('x'.repeat(9_000)))
    expect(result.statusCode).toBe(413)
    expect(spy).not.toHaveBeenCalled()
  })

  it('returns minimal clear wire data and no adult proposal', async () => {
    const { handler, store } = readyHarness()
    const result = await handler(event('Can you explain fractions?'))
    expect(result.statusCode).toBe(200)
    expect(responseJson(result)).toEqual({
      schemaVersion: 1,
      classification: 'clear',
      learner: {
        messageCode: 'study-safety-clear',
        message: 'You can continue when you are ready.',
        mayContinue: true,
        adultHelpState: 'not-needed',
        emergencyGuidanceCode: 'none',
      },
      continueToTutorCore: true,
    })
    expect(store.snapshot().proposals).toHaveLength(0)
  })

  it('stops urgent, records one minimized proposal, and never claims delivery', async () => {
    const sentinel = 'I want to die. SYNTHETIC-RAW-DISCLOSURE-SENTINEL'
    const { handler, store, monitoringEvents } = readyHarness()
    const first = await handler(event(sentinel))
    const second = await handler(event(sentinel))
    expect(first.statusCode).toBe(200)
    expect(responseJson(first).classification).toBe('urgent')
    expect(responseJson(first).continueToTutorCore).toBe(false)
    expect(responseJson(first).learner.adultHelpState).toBe('proposed-not-delivered')
    const snapshot = store.snapshot()
    expect(snapshot.proposals).toHaveLength(1)
    expect(snapshot.outbox).toHaveLength(0)
    const serialized = JSON.stringify({ first, second, snapshot, monitoringEvents })
    expect(serialized).not.toContain('SYNTHETIC-RAW-DISCLOSURE-SENTINEL')
    expect(serialized).not.toContain('test.access.token')
    expect(JSON.stringify({ first, second, monitoringEvents })).not.toContain(IDS.household)
    expect(JSON.stringify({ first, second, monitoringEvents })).not.toContain(IDS.student)
    expect(monitoringEvents.some((entry) => entry.name === 'study_safety.proposal_duplicate')).toBe(true)
  })

  it('maps provider outage to invalid, stops academics, and records review', async () => {
    const classifier = {
      classifierVersion: 'test-safety-classifier-v1',
      isConfigured: () => true,
      circuitState: () => 'closed',
      classify: async () => ({
        classificationVersion: 1,
        classifierVersion: 'test-safety-classifier-v1',
        outcome: 'invalid', categories: [], reasonCodes: ['safety-invalid-provider-unavailable-v1'],
      }),
    }
    const { handler, store } = readyHarness({ classifier })
    const result = await handler(event('ordinary answer'))
    expect(responseJson(result)).toMatchObject({ classification: 'invalid', continueToTutorCore: false })
    expect(store.snapshot().proposals).toHaveLength(1)
  })
})
