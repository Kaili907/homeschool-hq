import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  ADMIN_ROLE_CAPABILITIES,
  hasAdminCapability,
  readAdminAuthorization,
} from './authorization'

function response(status: number, body: unknown) {
  return { status, json: async () => body }
}

describe('Admin route authorization state', () => {
  it('fails closed without an authenticated Supabase access token', async () => {
    const fetchImpl = vi.fn()
    await expect(readAdminAuthorization({
      getAccessToken: async () => null,
      fetchImpl,
    })).resolves.toEqual({ status: 'unauthenticated' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each(['viewer', 'admin', 'owner'] as const)(
    'accepts the exact versioned %s contract',
    async (role) => {
      const state = await readAdminAuthorization({
        getAccessToken: async () => 'verified.access.token',
        fetchImpl: async (_url, init) => {
          expect(init.method).toBe('GET')
          expect(init.headers).toEqual({ Authorization: 'Bearer verified.access.token' })
          expect(init.credentials).toBe('omit')
          return response(200, {
            schemaVersion: 1,
            role,
            capabilities: ADMIN_ROLE_CAPABILITIES[role],
          })
        },
      })
      expect(state).toEqual({
        status: 'authorized',
        role,
        capabilities: ADMIN_ROLE_CAPABILITIES[role],
      })
    },
  )

  it('rejects malformed, expanded, or mismatched server contracts', async () => {
    const invalidContracts = [
      { schemaVersion: 1, role: 'owner', capabilities: ['admin:read'] },
      { schemaVersion: 1, role: 'superuser', capabilities: ['admin:read'] },
      {
        schemaVersion: 1,
        role: 'viewer',
        capabilities: ['admin:read'],
        serviceRoleKey: 'secret',
      },
      { schemaVersion: 2, role: 'viewer', capabilities: ['admin:read'] },
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

  it('keeps capability checks advisory and exact', () => {
    const viewer = {
      status: 'authorized' as const,
      role: 'viewer' as const,
      capabilities: ADMIN_ROLE_CAPABILITIES.viewer,
    }
    expect(hasAdminCapability(viewer, 'admin:read')).toBe(true)
    expect(hasAdminCapability(viewer, 'admin:operate')).toBe(false)
    expect(hasAdminCapability({ status: 'forbidden' }, 'admin:read')).toBe(false)
  })

  it('never references server credentials from the browser authorization module', async () => {
    const source = await readFile(new URL('./authorization.ts', import.meta.url), 'utf8')
    expect(source).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(source).not.toContain('service_role')
  })
})
