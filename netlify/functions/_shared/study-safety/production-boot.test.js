import { describe, expect, it, vi } from 'vitest'
import {
  createProductionStudySafetyHandler,
  handler as exportedProductionHandler,
} from '../../study-safety-classify.js'
import { createAnthropicSafetyClassifier } from './provider.js'

const IDS = Object.freeze({
  actor: '11111111-1111-4111-8111-111111111111',
  request: '22222222-2222-4222-8222-222222222222',
  household: '33333333-3333-4333-8333-333333333333',
  student: '44444444-4444-4444-8444-444444444444',
  session: '55555555-5555-4555-8555-555555555555',
})

const ENV = Object.freeze({
  ACADEMY_STUDY_ENABLED: 'true',
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_ANON_KEY: 'public-test-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key',
  ANTHROPIC_API_KEY: 'provider-test-key',
  ACADEMY_APP_VERSION: 'study-safety-test-build',
  STUDY_SAFETY_RATE_LIMIT_HMAC_KEY: 'test-rate-limit-correlation-key',
})
const SESSION_REFERENCE = `aca_stu_v1_${'A'.repeat(43)}`

function verifiedGrant() {
  return {
    schemaVersion: 1,
    status: 'verified',
    grantId: '66666666-6666-4666-8666-666666666666',
    householdId: IDS.household,
    studentId: IDS.student,
    learnerSessionId: '77777777-7777-4777-8777-777777777777',
    sessionEpoch: '77777777-7777-4777-8777-777777777777',
    sessionVersion: 1,
    authorizationRevision: 1,
    issuedAt: '2026-08-04T11:50:00.000Z',
    expiresAt: '2026-08-04T12:05:00.000Z',
    contractVersion: 1,
    issuerVersion: 'academy-student-session-issuer.v1',
    scope: ['student:assignments:read', 'student:attempts:create', 'student:progress:read'],
  }
}

function event(text = 'ordinary answer') {
  return {
    httpMethod: 'POST',
    path: '/api/study/safety/classify',
    headers: {
      authorization: 'Bearer test.access.token',
      'content-type': 'application/json',
      'x-study-session': SESSION_REFERENCE,
    },
    body: JSON.stringify({
      schemaVersion: 1,
      requestId: IDS.request,
      studentRef: { kind: 'academy-student-id', value: IDS.student },
      sessionId: IDS.session,
      transientText: text,
    }),
  }
}

function readyProductionHarness(classifier, logBoot = vi.fn()) {
  const proposals = []
  const durable = { isDurable: true, isReady: () => true }
  const store = {
    ...durable,
    async createProposal({ proposal }) {
      proposals.push(proposal)
      return { created: true }
    },
    async claim() { return [] },
    async recordRecipientResolutionAndEnqueue() { return [] },
  }
  const handler = createProductionStudySafetyHandler({
    env: ENV,
    classifier,
    logBoot,
    authVerifier: async () => ({
      ok: true,
      user: { id: IDS.actor },
      accessToken: 'test.access.token',
    }),
    fetchImpl: async (url) => new Response(JSON.stringify(
      url.endsWith('/rpc/academy_study_authorize_guardian_session_v1')
        ? { schemaVersion: 1, status: 'authorized' }
        : verifiedGrant(),
    ), { headers: { 'content-type': 'application/json' } }),
    proposalPersistence: store,
    outbox: store,
    recipientResolver: {
      ...durable,
      async resolve() { return {} },
      async reauthorizeForDelivery() { return {} },
    },
    rateLimiter: {
      ...durable,
      async reserve() { return { allowed: true } },
    },
    monitoring: {
      ...durable,
      async record() {},
    },
    deliveryProviders: [{
      ...durable,
      channel: 'in-app',
      supportsDurableIdempotency: true,
      async deliver() { return { state: 'indeterminate' } },
    }],
    receiptValidators: [{
      ...durable,
      channel: 'in-app',
      async verifyReceipt() { return { verified: false } },
    }],
    now: () => Date.parse('2026-08-04T12:00:00.000Z'),
  })
  return { handler, proposals, logBoot }
}

function validResult(classifierVersion, outcome = 'clear') {
  return {
    classificationVersion: 1,
    classifierVersion,
    outcome,
    categories: outcome === 'clear' ? [] : ['self-harm-or-immediate-danger'],
    reasonCodes: [`safety-provider-${outcome}-v1`],
  }
}

function providerAccountingOptions() {
  let sequence = 0
  return {
    gatewayAccess: { recordProviderUsage: vi.fn(async () => undefined) },
    providerAttemptJournal: {
      reserve: vi.fn(async () => ({
        status: 'created',
        attemptId: `90000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
        state: 'reserved',
      })),
      transition: vi.fn(async (input) => ({
        status: 'created', attemptId: input.attemptId, state: input.toState,
      })),
      linkLedger: vi.fn(async (input) => ({
        status: 'created', attemptId: input.attemptId, state: 'gap_pending',
      })),
    },
  }
}

describe('production Study safety boot gate', () => {
  it('refuses to boot unmistakably when the injected classifier is not production mode', () => {
    expect(() => createProductionStudySafetyHandler({
      env: ENV,
      classifier: {
        mode: 'local-demo',
        classifierVersion: 'local-demo-classifier-v1',
        isConfigured: () => true,
        classify: async () => validResult('local-demo-classifier-v1'),
      },
      logBoot: vi.fn(),
    })).toThrow(/STARTUP ABORTED.*mode "production"/i)
  })

  it('rejects a learner-authorization override outside the test composition', () => {
    expect(() => createProductionStudySafetyHandler({
      env: ENV,
      learnerAuthorization: { isReady: () => true, isDurable: true, resolve: async () => ({}) },
    })).toThrow(/learner authorization overrides are test-only/i)
  })

  it('injects and reaches the classifier through a production-mode handler', async () => {
    const classify = vi.fn(async () => validResult('production-test-classifier-v1'))
    const { handler } = readyProductionHarness({
      mode: 'production',
      classifierVersion: 'production-test-classifier-v1',
      isConfigured: () => true,
      circuitState: () => 'closed',
      classify,
    })

    const response = await handler(event())

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toMatchObject({
      classification: 'clear',
      continueToTutorCore: true,
    })
    expect(classify).toHaveBeenCalledTimes(1)
    expect(exportedProductionHandler).toBeTypeOf('function')
  })

  it('logs the production classifierVersion once at boot', () => {
    const logBoot = vi.fn()
    readyProductionHarness({
      mode: 'production',
      classifierVersion: 'production-boot-log-v1',
      isConfigured: () => true,
      circuitState: () => 'closed',
      classify: async () => validResult('production-boot-log-v1'),
    }, logBoot)

    expect(logBoot).toHaveBeenCalledOnce()
    expect(logBoot).toHaveBeenCalledWith({
      event: 'study_safety.classifier_boot',
      mode: 'production',
      classifierVersion: 'production-boot-log-v1',
    })
  })

  it.each([
    ['API error', () => createAnthropicSafetyClassifier({
      env: ENV,
      ...providerAccountingOptions(),
      fetchImpl: vi.fn(async () => { throw new Error('synthetic provider outage') }),
      delay: async () => {},
      maxAttempts: 1,
    })],
    ['timeout', () => createAnthropicSafetyClassifier({
      env: ENV,
      ...providerAccountingOptions(),
      fetchImpl: vi.fn(async (_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')), { once: true })
      })),
      timeoutMs: 1,
      maxAttempts: 2,
      delay: async () => {},
    })],
  ])('fails closed on classifier %s: no unclassified content reaches the student surface', async (_label, makeClassifier) => {
    const { handler, proposals } = readyProductionHarness(makeClassifier())
    const tutorCore = vi.fn(() => 'UNCLASSIFIED MODEL OUTPUT')

    const response = await handler(event('Can you help me with fractions?'))
    const result = JSON.parse(response.body)
    const studentSurface = result.continueToTutorCore
      ? tutorCore()
      : result.learner.message

    expect(response.statusCode).toBe(200)
    expect(result).toMatchObject({
      classification: 'invalid',
      continueToTutorCore: false,
      learner: {
        mayContinue: false,
        // Invalid classifier results stop the child but never claim that adult
        // help was confirmed; the durable proposal below is the adult signal.
        adultHelpState: 'not-confirmed',
      },
    })
    expect(tutorCore).not.toHaveBeenCalled()
    expect(studentSurface).not.toContain('UNCLASSIFIED MODEL OUTPUT')
    expect(studentSurface).toMatch(/lesson is paused/i)
    expect(proposals).toHaveLength(1)
    expect(proposals[0]).toMatchObject({
      classification: 'invalid',
      deliveryState: 'proposed-not-delivered',
    })
  })
})
