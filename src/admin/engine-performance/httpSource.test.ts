import { describe, expect, it, vi } from 'vitest'
import { buildEnginePerformanceProjection } from '../enginePerformanceModel'
import { readAdminEnginePerformance } from './httpSource'

const model = buildEnginePerformanceProjection([], {
  generatedAt: '2026-08-31T12:00:00.000Z',
  filters: {
    start: '2026-08-01T12:00:00.000Z', end: '2026-08-31T12:00:00.000Z',
    engine: 'tutor', engineVersion: null, courseRef: null, unitRef: null,
  },
})

describe('authorized engine performance HTTP source', () => {
  it('sends only bounded filters and bearer authorization to the GET-only projection', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ status: 200, json: async () => model })
    await expect(readAdminEnginePerformance({
      window: '30d', engine: 'tutor', engineVersion: 'v2', courseRef: 'course-1', unitRef: 'unit-1',
      fetchImpl, getAccessToken: async () => 'access-token',
    })).resolves.toEqual({ status: 'ready', model })
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/admin/v1/engine-performance?window=30d&engine=tutor&engineVersion=v2&course=course-1&unit=unit-1',
      expect.objectContaining({
        method: 'GET', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
        headers: { Accept: 'application/json', Authorization: 'Bearer access-token' },
      }),
    )
  })

  it('fails closed without a token, on denial, and for malformed or raw-row responses', async () => {
    const fetchImpl = vi.fn()
    await expect(readAdminEnginePerformance({ window: '7d', engine: 'study', fetchImpl, getAccessToken: async () => null })).resolves.toEqual({ status: 'unauthorized' })
    expect(fetchImpl).not.toHaveBeenCalled()
    await expect(readAdminEnginePerformance({
      window: '7d', engine: 'study', getAccessToken: async () => 'token',
      fetchImpl: vi.fn().mockResolvedValue({ status: 403, json: async () => ({}) }),
    })).resolves.toEqual({ status: 'unauthorized' })
    await expect(readAdminEnginePerformance({
      window: '7d', engine: 'study', getAccessToken: async () => 'token',
      fetchImpl: vi.fn().mockResolvedValue({ status: 200, json: async () => ({ ...model, rows: [{ conversation: 'private' }] }) }),
    })).resolves.toEqual({ status: 'error', code: 'invalid_response' })
  })

  it('distinguishes malformed, group-incomplete, and unavailable aggregate failures', async () => {
    const common = { window: '7d' as const, engine: 'study' as const, getAccessToken: async () => 'token' }
    await expect(readAdminEnginePerformance({
      ...common,
      fetchImpl: vi.fn().mockResolvedValue({ status: 502, json: async () => ({ error: { code: 'engine_performance_malformed' } }) }),
    })).resolves.toEqual({ status: 'error', code: 'malformed' })
    await expect(readAdminEnginePerformance({
      ...common,
      fetchImpl: vi.fn().mockResolvedValue({ status: 503, json: async () => ({ error: { code: 'engine_performance_incomplete' } }) }),
    })).resolves.toEqual({ status: 'error', code: 'incomplete' })
    await expect(readAdminEnginePerformance({
      ...common,
      fetchImpl: vi.fn().mockResolvedValue({ status: 503, json: async () => ({ error: { code: 'engine_performance_unavailable' } }) }),
    })).resolves.toEqual({ status: 'error', code: 'unavailable' })
  })

  it('bounds a dependency that never settles and exposes a retryable timeout state', async () => {
    vi.useFakeTimers()
    try {
      const read = readAdminEnginePerformance({
        window: '7d', engine: 'study', timeoutMs: 25,
        getAccessToken: async () => 'token',
        fetchImpl: vi.fn((_input, init) => new Promise<never>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('private timeout body')), { once: true })
        })),
      })
      await vi.advanceTimersByTimeAsync(26)
      await expect(read).resolves.toEqual({ status: 'error', code: 'timeout' })
    } finally {
      vi.useRealTimers()
    }
  })
})
