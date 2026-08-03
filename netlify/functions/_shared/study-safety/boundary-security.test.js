import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseLearnerAuthorizationPort } from './authorization.js'
import { evaluateStudySafetyReadiness } from './readiness.js'

const ENV = Object.freeze({
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_ANON_KEY: 'public-test-key',
  ANTHROPIC_API_KEY: 'provider-test-key',
  STUDY_SAFETY_RATE_LIMIT_HMAC_KEY: 'test-rate-limit-key',
})

describe('browser/server and authorization boundaries', () => {
  it('keeps provider credentials, endpoints, storage, and adult details out of Study browser code', async () => {
    const client = await readFile('src/study/safety/client.ts', 'utf8')
    const browserContracts = await readFile('src/study/contracts/safety/index.ts', 'utf8')
    const combined = `${client}\n${browserContracts}`
    for (const forbidden of [
      'ANTHROPIC_API_KEY', 'x-api-key', 'api.anthropic.com', 'SUPABASE_ANON_KEY',
      'localStorage', 'sessionStorage', 'recipientRef', 'providerReceiptRef', 'adultReviewProposalId',
    ]) expect(combined).not.toContain(forbidden)
    expect(client).toContain("import { getGatewayAccessToken }")
    expect(client).toContain("credentials: 'omit'")
    expect(client).toContain("referrerPolicy: 'no-referrer'")
  })

  it('places fixed Study redirects before the SPA fallback', async () => {
    const config = await readFile('netlify.toml', 'utf8')
    expect(config.indexOf('/api/study/safety/*')).toBeGreaterThan(-1)
    expect(config.indexOf('/api/study/adult-review/*')).toBeGreaterThan(-1)
    expect(config.indexOf('/api/study/safety/*')).toBeLessThan(config.indexOf('from = "/*"'))
  })

  it('uses the exact verified bearer for RLS learner resolution and rejects inactive or ambiguous rows', async () => {
    const activeRow = {
      id: '44444444-4444-4444-8444-444444444444',
      household_id: '33333333-3333-4333-8333-333333333333',
      lifecycle_status: 'active',
    }
    const fetchImpl = vi.fn(async (_url, init) => new Response(JSON.stringify([activeRow]), { status: 200, headers: { 'content-type': 'application/json' } }))
    const port = createSupabaseLearnerAuthorizationPort({ env: ENV, fetchImpl })
    const input = {
      actorUserId: '11111111-1111-4111-8111-111111111111',
      accessToken: 'same.verified.bearer',
      studentRef: { kind: 'academy-student-id', value: '44444444-4444-4444-8444-444444444444' },
      sessionId: '55555555-5555-4555-8555-555555555555',
    }
    const result = await port.resolve(input)
    expect(result.status).toBe('authorized')
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toContain('/rest/v1/academy_students?')
    expect(url).toContain('id=eq.')
    expect(init.headers.Authorization).toBe('Bearer same.verified.bearer')
    expect(JSON.stringify(init)).not.toContain('service_role')
    expect(port.verifiesSession).toBe(false)

    const inactive = createSupabaseLearnerAuthorizationPort({
      env: ENV,
      fetchImpl: async () => new Response(JSON.stringify([{ ...activeRow, lifecycle_status: 'paused' }]), { status: 200 }),
    })
    expect((await inactive.resolve(input)).status).toBe('denied')
  })

  it('keeps production readiness not-ready for every test/in-memory or unverified-session seam', () => {
    const fake = { isDurable: true, isReady: () => true }
    const readiness = evaluateStudySafetyReadiness({
      classifier: { isConfigured: () => true, circuitState: () => 'closed' },
      learnerAuthorization: { ...fake, verifiesSession: false, resolve: async () => ({}) },
      rateLimiter: { ...fake, reserve: async () => ({ allowed: true }) },
      monitoring: { ...fake, record: async () => {} },
      proposalPersistence: { ...fake, createProposal: async () => ({ created: true }) },
      outbox: { ...fake, claim: async () => [], recordRecipientResolutionAndEnqueue: async () => [] },
      recipientResolver: { ...fake, resolve: async () => ({}), reauthorizeForDelivery: async () => ({}) },
      deliveryProviders: [{ ...fake, channel: 'email', supportsDurableIdempotency: true, deliver: async () => ({}) }],
      receiptValidators: [{ ...fake, channel: 'email', verifyReceipt: async () => ({ verified: false }) }],
    }, ENV)
    expect(readiness.status).toBe('not-ready')
    expect(readiness.missing).toContain('learner-session-authorization')
  })
})
