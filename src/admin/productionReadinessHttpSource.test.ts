import { describe, expect, it, vi } from 'vitest'
import { AdminProductionReadinessError, readAdminProductionReadiness } from './productionReadinessHttpSource'

describe('Admin Production Readiness HTTP source', () => {
  it('uses authenticated no-store GET and rejects malformed evidence', async () => {
    const fetchImpl = vi.fn(async (_input: string, init: RequestInit) => {
      expect(init).toMatchObject({ method: 'GET', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' })
      expect(init.headers).toEqual({ Accept: 'application/json', Authorization: 'Bearer verified-token' })
      return { status: 200, json: async () => ({ schemaVersion: 1, secret: 'raw' }) }
    })
    await expect(readAdminProductionReadiness({
      fetchImpl,
      getAccessToken: async () => 'verified-token',
    })).rejects.toEqual(expect.objectContaining<Partial<AdminProductionReadinessError>>({ code: 'malformed' }))
  })

  it('fails closed before fetch without a verified access token', async () => {
    const fetchImpl = vi.fn()
    await expect(readAdminProductionReadiness({
      fetchImpl,
      getAccessToken: async () => null,
    })).rejects.toEqual(expect.objectContaining<Partial<AdminProductionReadinessError>>({ code: 'unauthorized' }))
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('distinguishes a timed-out dependency from permission denial', async () => {
    vi.useFakeTimers()
    try {
      const read = readAdminProductionReadiness({
        timeoutMs: 25,
        getAccessToken: async () => 'token',
        fetchImpl: vi.fn((_input, init) => new Promise<never>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('private readiness timeout')), { once: true })
        })),
      })
      const rejected = expect(read).rejects.toMatchObject({ code: 'timeout' })
      await vi.advanceTimersByTimeAsync(26)
      await rejected
    } finally {
      vi.useRealTimers()
    }
  })
})
