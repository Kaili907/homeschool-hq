import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  ADMIN_CONTRACT_VERSION,
  ADMIN_ROLE_CAPABILITIES,
  type AdminRole,
} from './contracts'
import {
  type AdminAuthorizationState,
  hasAdminAuthorizationCapability,
  readAdminAuthorization,
} from './authorization'

function response(status: number, body: unknown) {
  return { status, json: async () => body }
}

function wire(role: AdminRole): AdminAuthorizationState {
  return {
    contractVersion: ADMIN_CONTRACT_VERSION,
    status: 'authorized',
    role,
    capabilities: ADMIN_ROLE_CAPABILITIES[role],
  }
}

describe('ADMIN-0 v2 route authorization state', () => {
  it('fails closed without an authenticated Supabase access token', async () => {
    const fetchImpl = vi.fn()
    await expect(readAdminAuthorization({
      getAccessToken: async () => null,
      fetchImpl,
    })).resolves.toEqual({ status: 'unauthenticated' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('bounds an expired-session refresh that never settles before the Admin request begins', async () => {
    const fetchImpl = vi.fn()
    await expect(readAdminAuthorization({
      getAccessToken: () => new Promise(() => {}),
      fetchImpl,
      timeoutMs: 5,
    })).resolves.toEqual({ status: 'unavailable' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('does not begin token lookup or a request for an already-aborted authorization read', async () => {
    const controller = new AbortController()
    const getAccessToken = vi.fn(() => new Promise<string | null>(() => {}))
    const fetchImpl = vi.fn()
    controller.abort()

    await expect(readAdminAuthorization({
      getAccessToken,
      fetchImpl,
      signal: controller.signal,
    })).resolves.toEqual({ status: 'unavailable' })
    expect(getAccessToken).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each(['viewer', 'admin', 'owner'] as const)(
    'accepts the exact canonical v2 %s state',
    async (role) => {
      const state = await readAdminAuthorization({
        getAccessToken: async () => 'verified.access.token',
        fetchImpl: async (_url, init) => {
          expect(init.method).toBe('GET')
          expect(init.headers).toEqual({ Authorization: 'Bearer verified.access.token' })
          expect(init.credentials).toBe('omit')
          return response(200, wire(role))
        },
      })
      expect(state).toEqual(wire(role))
    },
  )

  it('rejects browser attempts to add, remove, reorder, or elevate capabilities', async () => {
    const invalidContracts = [
      { ...wire('viewer'), capabilities: ['overview:read', 'admin_roles:manage'] },
      { ...wire('owner'), capabilities: ['overview:read'] },
      { ...wire('viewer'), capabilities: [...ADMIN_ROLE_CAPABILITIES.viewer].reverse() },
      { ...wire('viewer'), role: 'owner' },
      { ...wire('viewer'), serviceRoleKey: 'secret' },
      { ...wire('viewer'), contractVersion: 1 },
      { ...wire('viewer'), status: 'elevated' },
    ]
    for (const contract of invalidContracts) {
      await expect(readAdminAuthorization({
        getAccessToken: async () => 'verified.access.token',
        fetchImpl: async () => response(200, contract),
      })).resolves.toEqual({ status: 'unavailable' })
    }
  })

  it('maps denial and lookup failures to fail-closed client states', async () => {
    for (const [status, expected] of [
      [401, 'unauthenticated'],
      [403, 'forbidden'],
      [500, 'unavailable'],
      [503, 'unavailable'],
    ] as const) {
      await expect(readAdminAuthorization({
        getAccessToken: async () => 'verified.access.token',
        fetchImpl: async () => response(status, {}),
      })).resolves.toEqual({ status: expected })
    }
  })

  it('fails closed when the credential dependency never settles', async () => {
    vi.useFakeTimers()
    try {
      const read = readAdminAuthorization({
        timeoutMs: 25,
        getAccessToken: () => new Promise(() => {}),
      })
      await vi.advanceTimersByTimeAsync(26)
      await expect(read).resolves.toEqual({ status: 'unavailable' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('fails closed when an authorization response body never settles', async () => {
    vi.useFakeTimers()
    try {
      const fetchImpl = vi.fn(async () => ({
        status: 200,
        json: () => new Promise<never>(() => {}),
      }))
      const read = readAdminAuthorization({
        timeoutMs: 25,
        getAccessToken: async () => 'verified.access.token',
        fetchImpl,
      })
      await vi.advanceTimersByTimeAsync(26)
      await expect(read).resolves.toEqual({ status: 'unavailable' })
      expect(fetchImpl).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('gives ADMIN-5 an advisory canonical overview:read seam', () => {
    const viewer = wire('viewer')
    expect(hasAdminAuthorizationCapability(viewer, 'overview:read')).toBe(true)
    expect(hasAdminAuthorizationCapability(viewer, 'engines:operate')).toBe(false)
    expect(hasAdminAuthorizationCapability({ status: 'forbidden' }, 'overview:read')).toBe(false)
  })

  it('never references server credentials from the browser authorization module', async () => {
    const source = await readFile(new URL('./authorization.ts', import.meta.url), 'utf8')
    expect(source).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(source).not.toContain('service_role')
  })
})
