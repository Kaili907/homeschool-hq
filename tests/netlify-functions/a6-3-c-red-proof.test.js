import { describe, expect, it } from 'vitest'
import { createVerifiedStudySessionAuthorizationPort } from '../../netlify/functions/_shared/study-safety/session-authorization.js'
import { evaluateStudySafetyReadiness } from '../../netlify/functions/_shared/study-safety/readiness.js'

const IDS = Object.freeze({
  actor: '11111111-1111-4111-8111-111111111111',
  otherActor: '88888888-8888-4888-8888-888888888888',
  household: '33333333-3333-4333-8333-333333333333',
  student: '44444444-4444-4444-8444-444444444444',
  grant: '66666666-6666-4666-8666-666666666666',
  learnerSession: '77777777-7777-4777-8777-777777777777',
})
const ENV = Object.freeze({
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_ANON_KEY: 'public-test-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key',
  STUDY_SAFETY_RATE_LIMIT_HMAC_KEY: 'test-rate-limit-key',
})
const REFERENCE = `aca_stu_v1_${'A'.repeat(43)}`

function verifiedGrant() {
  return {
    schemaVersion: 1, status: 'verified', grantId: IDS.grant,
    householdId: IDS.household, studentId: IDS.student,
    learnerSessionId: IDS.learnerSession, sessionEpoch: IDS.learnerSession,
    sessionVersion: 1, authorizationRevision: 1,
    issuedAt: '2026-08-05T11:50:00.000Z', expiresAt: '2026-08-05T12:05:00.000Z',
    contractVersion: 1, issuerVersion: 'academy-student-session-issuer.v1',
    scope: ['student:assignments:read', 'student:attempts:create', 'student:progress:read'],
  }
}

function readyDependencies(learnerAuthorization) {
  const durable = { isDurable: true, isReady: () => true }
  return {
    classifier: { isConfigured: () => true, circuitState: () => 'closed' },
    learnerAuthorization,
    rateLimiter: { ...durable, reserve: async () => ({ allowed: true }) },
    monitoring: { ...durable, record: async () => {} },
    proposalPersistence: { ...durable, createProposal: async () => ({ created: true }) },
    outbox: { ...durable, claim: async () => [], recordRecipientResolutionAndEnqueue: async () => [] },
    recipientResolver: { ...durable, resolve: async () => ({}), reauthorizeForDelivery: async () => ({}) },
    deliveryProviders: [{ ...durable, supportsDurableIdempotency: true, deliver: async () => ({}) }],
    receiptValidators: [{ ...durable, verifyReceipt: async () => ({}) }],
  }
}

describe('A6-3-C red proof', () => {
  it('rejects an object literal that merely declares session verification', () => {
    const literal = { isDurable: true, isReady: () => true, verifiesSession: true, resolve: async () => ({}) }
    expect(evaluateStudySafetyReadiness(readyDependencies(literal), ENV).status).toBe('not-ready')
  })

  it('denies a valid reference presented by a different authenticated actor', async () => {
    const port = createVerifiedStudySessionAuthorizationPort({
      env: ENV,
      fetchImpl: async (_url, init) => {
        const parameters = JSON.parse(init.body)
        const body = Object.hasOwn(parameters, 'p_actor_user_id') && parameters.p_actor_user_id !== IDS.actor
          ? { schemaVersion: 1, status: 'denied', code: 'student-session-invalid' }
          : verifiedGrant()
        return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
      },
    })
    expect((await port.resolve({
      actorUserId: IDS.otherActor,
      studentRef: { kind: 'academy-student-id', value: IDS.student },
      sessionReference: REFERENCE,
    })).status).toBe('denied')
  })
})
