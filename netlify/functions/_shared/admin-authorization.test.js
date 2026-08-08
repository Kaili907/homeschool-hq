import { describe, expect, it, vi } from 'vitest'
import {
  ADMIN_OPERATIONAL_CAPABILITIES,
  ADMIN_OWNER_CAPABILITIES,
  ADMIN_READ_CAPABILITIES,
  ADMIN_ROLE_CAPABILITIES,
} from '../../../src/admin/contracts.ts'
import { createAdminAuthorization } from './admin-authorization.js'

const VERIFIED_USER_ID = '00000000-0000-4000-8000-000000000001'
const ACCESS_TOKEN = 'verified.access.token'

function event(overrides = {}) {
  return {
    httpMethod: 'POST',
    headers: {
      authorization: `Bearer ${ACCESS_TOKEN}`,
      'x-admin-role': 'owner',
    },
    body: JSON.stringify({
      role: 'owner',
      capabilities: ADMIN_ROLE_CAPABILITIES.owner,
    }),
    ...overrides,
  }
}

function roleClient(result) {
  const builder = { abortSignal: vi.fn(async () => result) }
  return { client: { rpc: vi.fn(() => builder) }, builder }
}

function verifiedAuthorization(result) {
  const { client, builder } = roleClient(result)
  return {
    authorization: createAdminAuthorization({
      client,
      authVerifier: async () => ({
        ok: true,
        user: { id: VERIFIED_USER_ID },
        accessToken: ACCESS_TOKEN,
      }),
    }),
    client,
    builder,
  }
}

function responseJson(result) {
  return JSON.parse(result.response.body)
}

describe('ADMIN-0 v2 server-derived authorization', () => {
  it('rejects a normal authenticated user without an admin assignment', async () => {
    const { authorization } = verifiedAuthorization({ data: [], error: null })
    const result = await authorization.require(event(), 'overview:read')
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(403)
    expect(responseJson(result)).toEqual({ error: { code: 'admin_access_denied' } })
  })

  it('gives viewer every canonical read capability and no operational or owner capability', async () => {
    const { authorization, client } = verifiedAuthorization({
      data: [{ role: 'viewer' }],
      error: null,
    })
    for (const capability of ADMIN_READ_CAPABILITIES) {
      await expect(authorization.require(event(), capability)).resolves.toMatchObject({ ok: true })
    }
    for (const capability of [...ADMIN_OPERATIONAL_CAPABILITIES, ...ADMIN_OWNER_CAPABILITIES]) {
      const result = await authorization.require(event(), capability)
      expect(result.ok, capability).toBe(false)
      expect(result.response.statusCode, capability).toBe(403)
    }
    expect(client.rpc).toHaveBeenCalledWith('academy_admin_authorization_v2')
  })

  it('gives admin every read and operational capability but no owner capability', async () => {
    const { authorization } = verifiedAuthorization({
      data: [{ role: 'admin' }],
      error: null,
    })
    for (const capability of [...ADMIN_READ_CAPABILITIES, ...ADMIN_OPERATIONAL_CAPABILITIES]) {
      await expect(authorization.require(event(), capability)).resolves.toMatchObject({ ok: true })
    }
    for (const capability of ADMIN_OWNER_CAPABILITIES) {
      const result = await authorization.require(event(), capability)
      expect(result.ok, capability).toBe(false)
      expect(result.response.statusCode, capability).toBe(403)
    }
  })

  it('gives owner the complete canonical capability matrix', async () => {
    const { authorization } = verifiedAuthorization({
      data: [{ role: 'owner' }],
      error: null,
    })
    for (const capability of ADMIN_ROLE_CAPABILITIES.owner) {
      await expect(authorization.require(event(), capability)).resolves.toMatchObject({ ok: true })
    }
  })

  it('never treats a forged browser role or capability array as authority', async () => {
    const { authorization } = verifiedAuthorization({
      data: [{ role: 'viewer' }],
      error: null,
    })
    const result = await authorization.require(event({
      queryStringParameters: { role: 'owner', capability: 'admin_roles:manage' },
    }), 'admin_roles:manage')
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(403)
  })

  it.each(['revoked', 'expired'])('denies a %s assignment returned as no current row', async () => {
    const { authorization } = verifiedAuthorization({ data: [], error: null })
    const result = await authorization.require(event(), 'overview:read')
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(403)
  })

  it('fails closed for lookup errors, malformed rows, and ambiguous rows', async () => {
    for (const databaseResult of [
      { data: null, error: { message: 'database unavailable' } },
      { data: [{ role: 'superuser' }], error: null },
      { data: [{ role: 'viewer', capabilities: ['admin_roles:manage'] }], error: null },
      { data: [{ role: 'viewer' }, { role: 'owner' }], error: null },
    ]) {
      const { authorization } = verifiedAuthorization(databaseResult)
      const result = await authorization.require(event(), 'overview:read')
      expect(result.ok).toBe(false)
      expect(result.response.statusCode).toBe(503)
      expect(responseJson(result)).toEqual({ error: { code: 'authorization_unavailable' } })
    }
  })

  it('fails closed without the exact pinned verified bearer', async () => {
    const { client } = roleClient({ data: [{ role: 'owner' }], error: null })
    const authorization = createAdminAuthorization({
      client,
      authVerifier: async () => ({ ok: true, user: { id: VERIFIED_USER_ID } }),
    })
    const result = await authorization.require(event(), 'overview:read')
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(503)
  })

  it('pins the verified token into the authenticated RPC client', async () => {
    const { client } = roleClient({ data: [{ role: 'viewer' }], error: null })
    const clientFactory = vi.fn(() => client)
    const authorization = createAdminAuthorization({
      clientFactory,
      authVerifier: async () => ({
        ok: true,
        user: { id: VERIFIED_USER_ID },
        accessToken: ACCESS_TOKEN,
      }),
    })
    await expect(authorization.require(event(), 'overview:read')).resolves.toMatchObject({ ok: true })
    expect(clientFactory).toHaveBeenCalledWith(ACCESS_TOKEN)
  })

  it('fails closed when public Supabase RPC configuration is absent', async () => {
    const authorization = createAdminAuthorization({
      env: {},
      authVerifier: async () => ({
        ok: true,
        user: { id: VERIFIED_USER_ID },
        accessToken: ACCESS_TOKEN,
      }),
    })
    const result = await authorization.require(event(), 'overview:read')
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(503)
  })

  it('rejects unknown and removed generic capability aliases', async () => {
    const { authorization } = verifiedAuthorization({ data: [{ role: 'owner' }], error: null })
    for (const capability of ['admin:read', 'admin:operate', 'admin:roles:manage']) {
      const result = await authorization.require(event(), capability)
      expect(result.ok, capability).toBe(false)
      expect(result.response.statusCode, capability).toBe(403)
    }
  })
})
