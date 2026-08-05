import { describe, expect, it } from 'vitest'
import { createStudySafetyHandler } from '../netlify/functions/study-safety-classify.js'

const IDS = Object.freeze({
  actor: '11111111-1111-4111-8111-111111111111',
  request: '22222222-2222-4222-8222-222222222222',
  household: '33333333-3333-4333-8333-333333333333',
  student: '44444444-4444-4444-8444-444444444444',
  session: '55555555-5555-4555-8555-555555555555',
})

function event() {
  return {
    httpMethod: 'POST',
    path: '/api/study/safety/classify',
    headers: { authorization: 'Bearer test.access.token', 'content-type': 'application/json' },
    body: JSON.stringify({
      schemaVersion: 1,
      requestId: IDS.request,
      studentRef: { kind: 'academy-student-id', value: IDS.student },
      sessionId: IDS.session,
      transientText: 'I am going to hurt myself.',
    }),
  }
}

describe('mounted safety durable capture', () => {
  it('keeps a minimized flagged proposal across a simulated handler process restart', async () => {
    // The Map stands in only for the external database. Handler instances are
    // discarded and recreated; no browser/local Study service owns this state.
    const durableDatabase = new Map()
    const durableStore = Object.freeze({
      isDurable: true,
      isReady: () => true,
      async createProposal({ proposal }) {
        const previous = durableDatabase.get(proposal.idempotencyKey)
        if (previous) return { created: false, duplicateProposalId: previous.proposalId }
        durableDatabase.set(proposal.idempotencyKey, structuredClone(proposal))
        return { created: true }
      },
      async claim() { return [] },
      async recordRecipientResolutionAndEnqueue() { return [] },
    })
    const classifier = Object.freeze({
      mode: 'production',
      classifierVersion: 'test-mounted-durable-v1',
      isConfigured: () => true,
      circuitState: () => 'closed',
      async classify(request) {
        return {
          classificationVersion: 1,
          classifierVersion: 'test-mounted-durable-v1',
          outcome: request.deterministicAssessment.outcome,
          categories: request.deterministicAssessment.categories,
          reasonCodes: [`safety-provider-${request.deterministicAssessment.outcome}-v1`],
        }
      },
    })
    const common = {
      env: {
        ACADEMY_STUDY_ENABLED: 'true',
        SUPABASE_URL: 'https://academy.invalid',
        SUPABASE_ANON_KEY: 'public-test-key',
        STUDY_SAFETY_RATE_LIMIT_HMAC_KEY: 'test-rate-limit-key',
      },
      classifier,
      learnerAuthorization: {
        isDurable: true,
        verifiesSession: true,
        isReady: () => true,
        resolve: async ({ sessionId }) => ({
          status: 'authorized',
          context: {
            actorUserId: IDS.actor,
            householdId: IDS.household,
            studentId: IDS.student,
            sessionId,
          },
        }),
      },
      proposalPersistence: durableStore,
      outbox: durableStore,
      recipientResolver: {
        isDurable: true,
        isReady: () => true,
        resolve: async () => ({ state: 'unavailable' }),
        reauthorizeForDelivery: async () => ({ status: 'denied' }),
      },
      rateLimiter: {
        isDurable: true,
        isReady: () => true,
        reserve: async () => ({ allowed: true }),
      },
      deliveryProviders: [{
        channel: 'in-app',
        isDurable: true,
        isReady: () => true,
        supportsDurableIdempotency: true,
        deliver: async () => ({ state: 'indeterminate' }),
      }],
      receiptValidators: [{
        channel: 'in-app',
        isDurable: true,
        isReady: () => true,
        verifyReceipt: async () => ({ verified: false }),
      }],
      authVerifier: async () => ({
        ok: true,
        user: { id: IDS.actor },
        accessToken: 'test.access.token',
      }),
      monitoring: { isDurable: true, isReady: () => true, record: async () => {} },
      now: () => Date.parse('2026-08-04T12:00:00.000Z'),
    }

    const firstProcess = createStudySafetyHandler(common)
    const first = await firstProcess(event())
    expect(first.statusCode).toBe(200)
    expect(JSON.parse(first.body)).toMatchObject({
      classification: 'urgent',
      learner: { adultHelpState: 'proposed-not-delivered' },
      continueToTutorCore: false,
    })
    expect(durableDatabase.size).toBe(1)

    const storedBeforeRestart = structuredClone([...durableDatabase.values()][0])
    const secondProcess = createStudySafetyHandler(common)
    const replay = await secondProcess(event())
    expect(replay.statusCode).toBe(200)
    expect(durableDatabase.size).toBe(1)
    expect([...durableDatabase.values()][0]).toEqual(storedBeforeRestart)
    expect(JSON.stringify(storedBeforeRestart)).not.toContain('I am going to hurt myself')
    expect(storedBeforeRestart).toMatchObject({
      classification: 'urgent',
      deliveryState: 'proposed-not-delivered',
      authorizedRecipientResolutionState: 'pending',
    })
  })
})
