import { describe, expect, it, vi } from 'vitest'
import { emptyProfile } from '../migration'
import {
  ADMIN_LEARNERS_ENDPOINT,
  createAdminLearnerAnalyticsHttpSource,
} from './learnerAnalyticsHttpSource'
import { buildLearnerAnalyticsSnapshot, hasOnlyLearnerOperationsFields } from './learnerAnalyticsModel'

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

  it('accepts the complete current allowlisted projection contract', async () => {
    const profile = emptyProfile('p1', 'Ada', '5')
    profile.missions['2026-09-09'] = { items: [{ id: 'math', label: 'Math', done: true }] }
    const fullSnapshot = buildLearnerAnalyticsSnapshot({
      profiles: [profile], today: '2026-09-09', observedAt: '2026-09-09T18:00:00.000Z',
    })
    const source = createAdminLearnerAnalyticsHttpSource({
      getAccessToken: async () => 'token',
      fetchImpl: async () => ({ status: 200, json: async () => fullSnapshot }),
    })
    await expect(source.read({ capability: 'learners:read', today: '2026-09-09' })).resolves.toBe(fullSnapshot)
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
      { ...snapshot, details: { p1: { ...snapshot.details.p1, moodLabel: 'unexpected even without a prohibited key' } } },
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

  it('uses an allowlist rather than relying only on known prohibited field names', () => {
    expect(hasOnlyLearnerOperationsFields(snapshot)).toBe(true)
    expect(hasOnlyLearnerOperationsFields({ ...snapshot, diagnostics: { harmlessLooking: true } })).toBe(false)
    expect(hasOnlyLearnerOperationsFields({ ...snapshot, details: { p1: { ...snapshot.details.p1, provider: 'hidden' } } })).toBe(false)
  })

  it('maps arbitrary backend errors to the existing safe ADMIN-6 error state', async () => {
    const source = createAdminLearnerAnalyticsHttpSource({
      getAccessToken: async () => 'token',
      fetchImpl: async () => { throw new Error('private SQL body') },
    })
    await expect(source.read({ capability: 'learners:read', today: '2026-09-09' })).rejects.toThrow('learner source unavailable')
  })

  it('bounds a learner dependency timeout and forwards an abort signal to the read', async () => {
    vi.useFakeTimers()
    try {
      const source = createAdminLearnerAnalyticsHttpSource({
        timeoutMs: 25,
        getAccessToken: async () => 'token',
        fetchImpl: vi.fn((_input, init) => new Promise<never>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('private learner timeout')), { once: true })
        })),
      })
      const read = source.read({ capability: 'learners:read', today: '2026-09-09' })
      const rejected = expect(read).rejects.toThrow('learner source unavailable')
      await vi.advanceTimersByTimeAsync(26)
      await rejected
    } finally {
      vi.useRealTimers()
    }
  })
})
