import { describe, expect, it, vi } from 'vitest'
import type { StudySafetyClassificationRequestV1 } from '../contracts/safety'
import { classifyStudySafety, STUDY_SAFETY_ENDPOINT } from './client'
import { learnerSafeResult } from './learnerSafe'

const request: StudySafetyClassificationRequestV1 = {
  schemaVersion: 1,
  requestId: '22222222-2222-4222-8222-222222222222',
  studentRef: { kind: 'academy-student-id', value: '44444444-4444-4444-8444-444444444444' },
  sessionId: '55555555-5555-4555-8555-555555555555',
  transientText: 'synthetic learner text',
}

describe('narrow Study safety browser adapter', () => {
  it('sends one same-origin transient request with host auth, no cookies, no referrer, and no retry', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      json: async () => ({
        schemaVersion: 1,
        classification: 'clear',
        learner: learnerSafeResult('clear'),
        continueToTutorCore: true,
      }),
    }))
    const result = await classifyStudySafety(request, {
      getAccessToken: async () => 'test.access.token',
      fetchImpl,
    })
    expect(result.classification).toBe('clear')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe(STUDY_SAFETY_ENDPOINT)
    expect(init.credentials).toBe('omit')
    expect(init.referrerPolicy).toBe('no-referrer')
    expect(init.cache).toBe('no-store')
    expect(init.headers).toEqual({ Authorization: 'Bearer test.access.token', 'content-type': 'application/json' })
    expect(init.body).toBe(JSON.stringify(request))
    expect(init.body).not.toContain('provider')
  })

  it('fails closed for missing auth, network failure, timeout, and malformed responses', async () => {
    const missing = await classifyStudySafety(request, { getAccessToken: async () => null })
    expect(missing).toMatchObject({ classification: 'invalid', continueToTutorCore: false })

    const networkFetch = vi.fn(async () => { throw new Error('network and provider internals') })
    const network = await classifyStudySafety(request, {
      getAccessToken: async () => 'test.access.token',
      fetchImpl: networkFetch,
    })
    expect(network).toMatchObject({ classification: 'invalid', continueToTutorCore: false })
    expect(JSON.stringify(network)).not.toContain('provider internals')
    expect(networkFetch).toHaveBeenCalledTimes(1)

    const malformed = await classifyStudySafety(request, {
      getAccessToken: async () => 'test.access.token',
      fetchImpl: async () => ({ ok: true, json: async () => ({ classification: 'clear', recipient: 'hidden' }) }),
    })
    expect(malformed).toMatchObject({ classification: 'invalid', continueToTutorCore: false })
  })

  it('rejects extra adult/provider details and arbitrary learner messages', async () => {
    for (const extra of [
      { recipientRef: 'recipient:hidden' },
      { classifierVersion: 'provider-model' },
      { reasonCodes: ['hidden'] },
      { adultReviewProposalId: 'hidden' },
    ]) {
      const result = await classifyStudySafety(request, {
        getAccessToken: async () => 'test.access.token',
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({
            schemaVersion: 1,
            classification: 'clear',
            learner: learnerSafeResult('clear'),
            continueToTutorCore: true,
            ...extra,
          }),
        }),
      })
      expect(result.classification).toBe('invalid')
    }

    const arbitraryMessage = await classifyStudySafety(request, {
      getAccessToken: async () => 'test.access.token',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          schemaVersion: 1,
          classification: 'urgent',
          learner: { ...learnerSafeResult('urgent'), message: 'A provider says a message was delivered.' },
          continueToTutorCore: false,
        }),
      }),
    })
    expect(arbitraryMessage.classification).toBe('invalid')
  })
})
