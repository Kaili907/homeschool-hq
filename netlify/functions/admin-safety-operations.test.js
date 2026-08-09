import { describe, expect, it, vi } from 'vitest'
import { errorResponse } from './_shared/http.js'
import { createAdminSafetyOperationsHandler } from './admin-safety-operations.js'

function event(overrides = {}) {
  return {
    httpMethod: 'GET',
    path: '/api/admin/v1/safety-operations',
    headers: { authorization: 'Bearer verified.access.token' },
    queryStringParameters: { limit: '50' },
    ...overrides,
  }
}

function authorizedHandler(reader = { read: vi.fn(async () => ({ schemaVersion: 1 })) }) {
  const require = vi.fn(async () => ({ ok: true, principal: { role: 'viewer' } }))
  return { handler: createAdminSafetyOperationsHandler({ authorization: { require }, reader }), require, reader }
}

describe('ADMIN-10B Safety Operations endpoint', () => {
  it('independently requires safety:read before reading evidence', async () => {
    const { handler, require, reader } = authorizedHandler()
    const response = await handler(event())
    expect(require).toHaveBeenCalledWith(expect.anything(), 'safety:read')
    expect(reader.read).toHaveBeenCalledWith({
      limit: 50, cursor: null, householdRef: undefined, learnerRef: undefined,
    })
    expect(response.statusCode).toBe(200)
  })

  it.each([
    ['unauthenticated', 401, 'unauthenticated'],
    ['student bearer', 401, 'unauthenticated'],
    ['ordinary guardian', 403, 'admin_access_denied'],
    ['revoked Admin', 403, 'admin_access_denied'],
    ['expired Admin', 403, 'admin_access_denied'],
    ['authorization outage', 503, 'authorization_unavailable'],
  ])('denies %s without touching the safety source', async (_case, statusCode, code) => {
    const reader = { read: vi.fn() }
    const handler = createAdminSafetyOperationsHandler({
      authorization: { require: vi.fn(async () => ({ ok: false, response: errorResponse(statusCode, code) })) },
      reader,
    })
    const response = await handler(event())
    expect(response.statusCode).toBe(statusCode)
    expect(JSON.parse(response.body)).toEqual({ error: { code } })
    expect(reader.read).not.toHaveBeenCalled()
  })

  it('accepts deterministic cursor and learner-within-household filters', async () => {
    const { handler, reader } = authorizedHandler()
    const cursor = Buffer.from(JSON.stringify({
      at: '2026-08-08T12:00:00.000Z', ref: 'operational:event-1',
    })).toString('base64url')
    const response = await handler(event({ queryStringParameters: {
      limit: '100', cursor,
      household: '10000000-0000-4000-8000-000000000001',
      learner: '20000000-0000-4000-8000-000000000001',
    } }))
    expect(response.statusCode).toBe(200)
    expect(reader.read).toHaveBeenCalledWith({
      limit: 100,
      cursor: { occurredAt: '2026-08-08T12:00:00.000Z', eventRef: 'operational:event-1' },
      householdRef: '10000000-0000-4000-8000-000000000001',
      learnerRef: '20000000-0000-4000-8000-000000000001',
    })
  })

  it.each([
    { limit: '0' }, { limit: '101' }, { limit: 'lots' },
    { limit: '50', unknown: 'value' },
    { limit: '50', cursor: 'not-json' },
    { limit: '50', learner: '20000000-0000-4000-8000-000000000001' },
    { limit: '50', household: 'not-a-uuid' },
  ])('rejects malformed or excessive queries: %j', async (queryStringParameters) => {
    const { handler, reader } = authorizedHandler()
    const response = await handler(event({ queryStringParameters }))
    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.body)).toEqual({ error: { code: 'invalid_request' } })
    expect(reader.read).not.toHaveBeenCalled()
  })

  it('returns only a stable source error when the projection fails', async () => {
    const sentinel = 'SQL private learner body and SUPABASE_SERVICE_ROLE_KEY'
    const { handler } = authorizedHandler({ read: vi.fn(async () => { throw new Error(sentinel) }) })
    const response = await handler(event())
    expect(response.statusCode).toBe(503)
    expect(JSON.parse(response.body)).toEqual({ error: { code: 'safety_source_unavailable' } })
    expect(response.body).not.toContain(sentinel)
  })

  it('has no safety mutation method or route', async () => {
    const { handler, reader } = authorizedHandler()
    expect((await handler(event({ httpMethod: 'POST' }))).statusCode).toBe(405)
    expect((await handler(event({ httpMethod: 'PATCH' }))).statusCode).toBe(405)
    expect((await handler(event({ path: '/api/admin/v1/safety-operations/resolve' }))).statusCode).toBe(404)
    expect(reader.read).not.toHaveBeenCalled()
  })
})
