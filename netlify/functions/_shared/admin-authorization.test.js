import { describe, expect, it, vi } from 'vitest'
import {
  ADMIN_ROLE_CAPABILITIES,
  createAdminAuthorization,
} from './admin-authorization.js'

const VERIFIED_USER_ID = '00000000-0000-4000-8000-000000000001'

function event(overrides = {}) {
  return {
    httpMethod: 'POST',
    headers: { authorization: 'Bearer verified.access.token' },
    body: JSON.stringify({ role: 'owner', capability: 'admin:roles:manage' }),
    ...overrides,
  }
}

function roleClient(result) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    abortSignal: vi.fn(async () => result),
  }
  return { client: { from: vi.fn(() => builder) }, builder }
}

function verifiedAuthorization(result) {
  const { client, builder } = roleClient(result)
  return {
    authorization: createAdminAuthorization({
      client,
      authVerifier: async () => ({ ok: true, user: { id: VERIFIED_USER_ID } }),
    }),
    client,
    builder,
  }
}

function responseJson(result) {
  return JSON.parse(result.response.body)
}

describe('server-derived Admin Console authorization', () => {
  it('rejects a normal authenticated user without an admin assignment', async () => {
    const { authorization } = verifiedAuthorization({ data: [], error: null })
    const result = await authorization.require(event(), 'admin:read')
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(403)
    expect(responseJson(result)).toEqual({ error: { code: 'admin_access_denied' } })
  })

  it('allows viewer reads and rejects viewer mutations', async () => {
    const role = { role: 'viewer', status: 'active', revoked_at: null }
    const readable = verifiedAuthorization({ data: [role], error: null })
    const read = await readable.authorization.require(event(), 'admin:read')
    expect(read.ok).toBe(true)
    expect(read.principal).toEqual({
      userId: VERIFIED_USER_ID,
      role: 'viewer',
      capabilities: ['admin:read'],
    })

    const mutable = verifiedAuthorization({ data: [role], error: null })
    const mutation = await mutable.authorization.require(event(), 'admin:operate')
    expect(mutation.ok).toBe(false)
    expect(mutation.response.statusCode).toBe(403)
  })

  it('gives admin only the read and operational capabilities', async () => {
    const { authorization } = verifiedAuthorization({
      data: [{ role: 'admin', status: 'active', revoked_at: null }],
      error: null,
    })
    const result = await authorization.require(event(), 'admin:operate')
    expect(result.ok).toBe(true)
    expect(result.principal.capabilities).toEqual(['admin:read', 'admin:operate'])
    expect(result.principal.capabilities).not.toContain('admin:roles:manage')
  })

  it('gives owner the complete owner capability set', async () => {
    const { authorization } = verifiedAuthorization({
      data: [{ role: 'owner', status: 'active', revoked_at: null }],
      error: null,
    })
    const result = await authorization.require(event(), 'admin:releases:manage')
    expect(result.ok).toBe(true)
    expect(result.principal.capabilities).toEqual(ADMIN_ROLE_CAPABILITIES.owner)
  })

  it('never treats a forged browser role or capability as authority', async () => {
    const { authorization, builder } = verifiedAuthorization({
      data: [{ role: 'viewer', status: 'active', revoked_at: null }],
      error: null,
    })
    const result = await authorization.require(event({
      headers: {
        authorization: 'Bearer verified.access.token',
        'x-admin-role': 'owner',
      },
      queryStringParameters: { role: 'owner' },
    }), 'admin:roles:manage')
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(403)
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'user_id', VERIFIED_USER_ID)
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'status', 'active')
    expect(builder.is).toHaveBeenCalledWith('revoked_at', null)
  })

  it('denies a revoked assignment immediately on the next lookup', async () => {
    const active = verifiedAuthorization({
      data: [{ role: 'admin', status: 'active', revoked_at: null }],
      error: null,
    })
    await expect(active.authorization.require(event(), 'admin:read')).resolves.toMatchObject({
      ok: true,
    })

    const revoked = verifiedAuthorization({ data: [], error: null })
    const result = await revoked.authorization.require(event(), 'admin:read')
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(403)
  })

  it('fails closed for lookup errors, malformed rows, and duplicate active rows', async () => {
    for (const databaseResult of [
      { data: null, error: { message: 'database unavailable' } },
      { data: [{ role: 'superuser', status: 'active', revoked_at: null }], error: null },
      {
        data: [
          { role: 'viewer', status: 'active', revoked_at: null },
          { role: 'owner', status: 'active', revoked_at: null },
        ],
        error: null,
      },
    ]) {
      const { authorization } = verifiedAuthorization(databaseResult)
      const result = await authorization.require(event(), 'admin:read')
      expect(result.ok).toBe(false)
      expect(result.response.statusCode).toBe(503)
      expect(responseJson(result)).toEqual({ error: { code: 'authorization_unavailable' } })
    }
  })

  it('fails closed when server-only database configuration is absent', async () => {
    const authorization = createAdminAuthorization({
      env: {},
      authVerifier: async () => ({ ok: true, user: { id: VERIFIED_USER_ID } }),
    })
    const result = await authorization.require(event(), 'admin:read')
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(503)
  })
})
