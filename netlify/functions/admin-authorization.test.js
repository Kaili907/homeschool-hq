import { describe, expect, it, vi } from 'vitest'
import { ADMIN_ROLE_CAPABILITIES } from '../../src/admin/contracts.ts'
import { errorResponse } from './_shared/http.js'
import { createAdminAuthorizationHandler } from './admin-authorization.js'

function event(overrides = {}) {
  return {
    httpMethod: 'GET',
    path: '/api/admin/v1/authorization',
    headers: { authorization: 'Bearer verified.access.token' },
    ...overrides,
  }
}

describe('Admin authorization read endpoint', () => {
  it('rejects unauthenticated access', async () => {
    const handler = createAdminAuthorizationHandler({
      authorization: {
        require: vi.fn(async () => ({
          ok: false,
          response: errorResponse(401, 'unauthenticated'),
        })),
      },
    })
    const response = await handler(event({ headers: {} }))
    expect(response.statusCode).toBe(401)
  })

  it('rejects a student session bearer as unauthenticated', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 401 }))
    const handler = createAdminAuthorizationHandler({
      env: {
        SUPABASE_URL: 'https://academy.supabase.co',
        SUPABASE_ANON_KEY: 'public-anon-key',
      },
      fetchImpl,
    })
    const response = await handler(event({
      headers: { authorization: `Bearer aca_stu_v1_${'a'.repeat(43)}` },
    }))
    expect(response.statusCode).toBe(401)
  })

  it('returns only the canonical v2 browser-safe state', async () => {
    const require = vi.fn(async () => ({
      ok: true,
      principal: {
        userId: 'private-user-id',
        role: 'viewer',
        capabilities: ADMIN_ROLE_CAPABILITIES.viewer,
        accessToken: 'must-not-leak',
      },
    }))
    const handler = createAdminAuthorizationHandler({ authorization: { require } })
    const response = await handler(event())
    expect(require).toHaveBeenCalledWith(expect.anything(), 'overview:read')
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      contractVersion: 2,
      status: 'authorized',
      role: 'viewer',
      capabilities: ADMIN_ROLE_CAPABILITIES.viewer,
    })
    expect(response.body).not.toContain('private-user-id')
    expect(response.body).not.toContain('must-not-leak')
  })

  it('rejects mutation methods, unknown paths, and query parameters', async () => {
    const require = vi.fn()
    const handler = createAdminAuthorizationHandler({ authorization: { require } })
    expect((await handler(event({ httpMethod: 'POST' }))).statusCode).toBe(405)
    expect((await handler(event({ path: '/api/admin/v1/roles' }))).statusCode).toBe(404)
    expect((await handler(event({ queryStringParameters: { role: 'owner' } }))).statusCode).toBe(400)
    expect(require).not.toHaveBeenCalled()
  })
})
