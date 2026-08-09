import { describe, expect, it, vi } from 'vitest'
import {
  ADMIN_LEARNERS_ENDPOINT,
  createAdminLearnerAnalyticsHttpSource,
} from './learnerAnalyticsHttpSource'

const snapshot = {
  observedAt: '2026-09-09T18:00:00.000Z',
  learners: [{ learnerRef: 'p1', displayName: 'Ada' }],
  details: { p1: { learnerRef: 'p1', displayName: 'Ada', assessments: [], recentEvidence: [] } },
}

describe('ADMIN-6B browser learner source', () => {
  it('sends only the bearer to the authorized endpoint and accepts a bounded projection', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 200, json: async () => snapshot }))
    const source = createAdminLearnerAnalyticsHttpSource({
      fetchImpl,
      getAccessToken: async () => 'verified.access.token',
    })
    await expect(source.read({ capability: 'learners:read', today: '2026-09-09' })).resolves.toBe(snapshot)
    expect(fetchImpl).toHaveBeenCalledWith(`${ADMIN_LEARNERS_ENDPOINT}?today=2026-09-09`, expect.objectContaining({
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: 'Bearer verified.access.token' },
      credentials: 'omit',
    }))
    const request = fetchImpl.mock.calls[0]
    expect(JSON.stringify(request)).not.toMatch(/household|role|capabilities|service.role/i)
  })

  it('fails closed without a bearer or for malformed/private server payloads', async () => {
    const noTokenFetch = vi.fn()
    await expect(createAdminLearnerAnalyticsHttpSource({
      fetchImpl: noTokenFetch,
      getAccessToken: async () => null,
    }).read({ capability: 'learners:read', today: '2026-09-09' })).rejects.toThrow('learner source unavailable')
    expect(noTokenFetch).not.toHaveBeenCalled()

    for (const value of [
      { ...snapshot, private: { transcript: 'secret' } },
      { ...snapshot, details: { p1: { ...snapshot.details.p1, answers: { one: 'secret' } } } },
      { ...snapshot, details: {} },
      { ...snapshot, learners: [...snapshot.learners, ...Array.from({ length: 5 }, () => snapshot.learners[0])] },
    ]) {
      const source = createAdminLearnerAnalyticsHttpSource({
        getAccessToken: async () => 'token',
        fetchImpl: async () => ({ status: 200, json: async () => value }),
      })
      await expect(source.read({ capability: 'learners:read', today: '2026-09-09' })).rejects.toThrow('learner source unavailable')
    }
  })

  it('maps arbitrary backend errors to the existing safe ADMIN-6 error state', async () => {
    const source = createAdminLearnerAnalyticsHttpSource({
      getAccessToken: async () => 'token',
      fetchImpl: async () => { throw new Error('private SQL body') },
    })
    await expect(source.read({ capability: 'learners:read', today: '2026-09-09' })).rejects.toThrow('learner source unavailable')
  })
})
