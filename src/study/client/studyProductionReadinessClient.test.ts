import { describe, expect, it, vi } from 'vitest'
import {
  createStudyProductionReadinessClient,
  STUDY_PRODUCTION_READINESS_ENDPOINT,
} from './studyProductionReadinessClient'

describe('Study production browser readiness adapter', () => {
  it('uses authenticated same-origin requests and accepts minimized 503 not-ready responses', async () => {
    let now = Date.parse('2026-08-01T16:00:00.000Z')
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => ({
      status: 503,
      json: async () => ({ schemaVersion: 1, status: 'not-ready', expiresAt: '2026-08-01T16:00:05.000Z' }),
    }))
    const client = createStudyProductionReadinessClient({
      now: () => now,
      getAccessToken: async () => 'synthetic.access.token',
      fetchImpl,
    })

    expect(await client.read()).toEqual({
      schemaVersion: 1,
      status: 'not-ready',
      expiresAt: '2026-08-01T16:00:05.000Z',
    })
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe(STUDY_PRODUCTION_READINESS_ENDPOINT)
    expect(init).toMatchObject({
      method: 'GET',
      headers: { Authorization: 'Bearer synthetic.access.token' },
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
    expect(init).not.toHaveProperty('body')
    now += 1
  })

  it('caches only until expiry, then performs runtime revalidation', async () => {
    let now = Date.parse('2026-08-01T16:00:00.000Z')
    let status: 'ready' | 'not-ready' = 'ready'
    const fetchImpl = vi.fn(async () => ({
      status: status === 'ready' ? 200 : 503,
      json: async () => ({
        schemaVersion: 1,
        status,
        expiresAt: new Date(now + 2_000).toISOString(),
      }),
    }))
    const client = createStudyProductionReadinessClient({
      now: () => now,
      getAccessToken: async () => 'synthetic.access.token',
      fetchImpl,
    })

    expect((await client.read()).status).toBe('ready')
    status = 'not-ready'
    now += 1_999
    expect((await client.read()).status).toBe('ready')
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    now += 2
    expect((await client.read()).status).toBe('not-ready')
    expect(fetchImpl).toHaveBeenCalledTimes(2)

    expect((await client.revalidate()).status).toBe('not-ready')
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('fails closed for missing auth, cancellation, malformed detail, and network errors', async () => {
    const now = Date.parse('2026-08-01T16:00:00.000Z')
    const noAuthFetch = vi.fn()
    const noAuth = createStudyProductionReadinessClient({
      now: () => now,
      getAccessToken: async () => null,
      fetchImpl: noAuthFetch,
    })
    expect((await noAuth.read()).status).toBe('not-ready')
    expect(noAuthFetch).not.toHaveBeenCalled()

    const aborted = new AbortController()
    aborted.abort('learner-switch')
    expect((await noAuth.revalidate(aborted.signal)).status).toBe('not-ready')

    for (const body of [
      { schemaVersion: 1, status: 'ready', expiresAt: '2026-08-01T16:00:05.000Z', dependency: 'secret' },
      { schemaVersion: 1, status: 'unknown', expiresAt: '2026-08-01T16:00:05.000Z' },
      { schemaVersion: 1, status: 'ready', expiresAt: '2026-08-01T18:00:00.000Z' },
    ]) {
      const malformed = createStudyProductionReadinessClient({
        now: () => now,
        getAccessToken: async () => 'synthetic.access.token',
        fetchImpl: async () => ({ status: 200, json: async () => body }),
      })
      expect((await malformed.read()).status).toBe('not-ready')
    }

    const network = createStudyProductionReadinessClient({
      now: () => now,
      getAccessToken: async () => 'synthetic.access.token',
      fetchImpl: async () => { throw new Error('private infrastructure detail') },
    })
    expect(await network.read()).toEqual({
      schemaVersion: 1,
      status: 'not-ready',
      expiresAt: '2026-08-01T16:00:01.000Z',
    })
  })
})
