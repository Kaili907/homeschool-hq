import { describe, expect, it, vi } from 'vitest'
import { createStudyGuardianAuthorization } from './study-guardian-authorization.js'

const ENV = Object.freeze({
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_ANON_KEY: 'public-anon-key',
})
const USER_ID = '11111111-1111-4111-8111-111111111111'

function event(body = undefined) {
  return {
    httpMethod: 'GET',
    path: '/api/study/production/readiness',
    headers: { authorization: 'Bearer verified.adult.token' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }
}

describe('Study guardian action authorization', () => {
  it('derives actor authority from the verified bearer and sends only the exact capability', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      schemaVersion: 1,
      status: 'authorized',
    }), { headers: { 'content-type': 'application/json' } }))
    const authorization = createStudyGuardianAuthorization({
      env: ENV,
      fetchImpl,
      authVerifier: async () => ({
        ok: true,
        user: { id: USER_ID },
        accessToken: 'verified.adult.token',
      }),
    })

    await expect(authorization.require(event({
      userId: 'forged-user',
      householdId: 'forged-household',
      role: 'owner',
      capabilities: ['study:production-readiness:read'],
    }), 'study:production-readiness:read')).resolves.toMatchObject({
      ok: true,
      principal: { userId: USER_ID },
    })

    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(
      'https://academy.supabase.co/rest/v1/rpc/academy_study_authorize_guardian_action_v1',
    )
    expect(init.headers.Authorization).toBe('Bearer verified.adult.token')
    expect(JSON.parse(init.body)).toEqual({
      p_required_capability: 'study:production-readiness:read',
    })
    expect(init.body).not.toMatch(/forged|household|role|owner|userId/)
  })

  it('stops before the actor RPC when bearer verification fails', async () => {
    const fetchImpl = vi.fn()
    const authorization = createStudyGuardianAuthorization({
      env: ENV,
      fetchImpl,
      authVerifier: async () => ({
        ok: false,
        response: { statusCode: 401, body: '{"error":{"code":"unauthenticated"}}' },
      }),
    })
    const result = await authorization.require(event(), 'study:production-readiness:read')
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(401)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects unknown capabilities before auth or downstream work', async () => {
    const authVerifier = vi.fn()
    const fetchImpl = vi.fn()
    const authorization = createStudyGuardianAuthorization({ env: ENV, fetchImpl, authVerifier })
    const result = await authorization.require(event(), 'study:production-readiness:write')
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(403)
    expect(authVerifier).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    ['a denied guardian relationship', 200, { schemaVersion: 1, status: 'denied' }, 403],
    ['an unavailable actor store', 503, {}, 503],
    ['a malformed actor result', 200, { schemaVersion: 1, status: 'authorized', role: 'owner' }, 503],
  ])('fails closed for %s', async (_label, status, body, expectedStatus) => {
    const authorization = createStudyGuardianAuthorization({
      env: ENV,
      fetchImpl: async () => new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
      authVerifier: async () => ({
        ok: true,
        user: { id: USER_ID },
        accessToken: 'verified.adult.token',
      }),
    })
    const result = await authorization.require(event(), 'study:production-readiness:read')
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(expectedStatus)
  })
})
