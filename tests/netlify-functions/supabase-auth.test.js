import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SUPABASE_AUTH_TIMEOUT_MS,
  supabaseAuthConfigured,
  verifySupabaseBearer,
} from '../../netlify/functions/_shared/supabase-auth.js'

const ENV = Object.freeze({
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_ANON_KEY: 'public-anon-key',
})
const VERIFIED_USER_ID = '00000000-0000-4000-8000-000000000001'
const BEARER_TOKEN = 'header.payload.signature'

function event(overrides = {}) {
  return {
    httpMethod: 'GET',
    headers: { authorization: `Bearer ${BEARER_TOKEN}` },
    ...overrides,
  }
}

function responseJson(result) {
  return JSON.parse(result.response.body)
}

// A fetch implementation that never settles on its own AND ignores the
// AbortSignal it receives. Used to prove the shared deadline binds even
// under a hostile upstream stub.
function foreverPendingIgnoringAbort() {
  return vi.fn(() => new Promise(() => {}))
}

// A fetch implementation whose response resolves synchronously but whose
// .json() body promise never settles and ignores the shared signal. Used to
// prove the shared deadline binds during body read too.
function successResponseWithHangingJson() {
  return vi.fn(async () => ({
    status: 200,
    json: () => new Promise(() => {}),
  }))
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('verifySupabaseBearer hard-deadline binding (fail-closed)', () => {
  it('fires the hard default deadline when no timeoutMs is passed even if fetch ignores the abort signal', async () => {
    vi.useFakeTimers()
    const fetchImpl = foreverPendingIgnoringAbort()
    const pending = verifySupabaseBearer(event(), { fetchImpl, env: ENV })
    await vi.advanceTimersByTimeAsync(SUPABASE_AUTH_TIMEOUT_MS)
    const result = await pending
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(504)
    expect(responseJson(result)).toEqual({ error: { code: 'upstream_timeout' } })
  })

  it.each([0, -1, 1.5, Number.NaN, 'fast', null])(
    'falls back to the hard default when timeoutMs is invalid (%s) even under an ignoring fetch',
    async (timeoutMs) => {
      vi.useFakeTimers()
      const fetchImpl = foreverPendingIgnoringAbort()
      const pending = verifySupabaseBearer(event(), { fetchImpl, env: ENV, timeoutMs })
      // Advancing by one tick short of the hard default must not settle.
      await vi.advanceTimersByTimeAsync(SUPABASE_AUTH_TIMEOUT_MS - 1)
      let earlyResult = null
      pending.then((value) => { earlyResult = value }, () => {})
      await Promise.resolve()
      expect(earlyResult).toBeNull()
      await vi.advanceTimersByTimeAsync(1)
      const result = await pending
      expect(result.response.statusCode).toBe(504)
    },
  )

  it('honors an explicit caller timeout override when it is stricter than the maximum', async () => {
    vi.useFakeTimers()
    const fetchImpl = foreverPendingIgnoringAbort()
    const pending = verifySupabaseBearer(event(), { fetchImpl, env: ENV, timeoutMs: 3_000 })
    let earlyResult = null
    pending.then((value) => { earlyResult = value }, () => {})
    await vi.advanceTimersByTimeAsync(2_999)
    await Promise.resolve()
    expect(earlyResult).toBeNull()
    await vi.advanceTimersByTimeAsync(1)
    const result = await pending
    expect(result.response.statusCode).toBe(504)
    expect(responseJson(result)).toEqual({ error: { code: 'upstream_timeout' } })
  })

  it('clamps caller-provided timeouts down to the hard maximum', async () => {
    vi.useFakeTimers()
    const fetchImpl = foreverPendingIgnoringAbort()
    const pending = verifySupabaseBearer(event(), {
      fetchImpl, env: ENV, timeoutMs: SUPABASE_AUTH_TIMEOUT_MS * 100,
    })
    await vi.advanceTimersByTimeAsync(SUPABASE_AUTH_TIMEOUT_MS)
    const result = await pending
    expect(result.response.statusCode).toBe(504)
  })

  it('binds the deadline during response body read even when .json() ignores the signal', async () => {
    vi.useFakeTimers()
    const fetchImpl = successResponseWithHangingJson()
    const pending = verifySupabaseBearer(event(), { fetchImpl, env: ENV })
    await vi.advanceTimersByTimeAsync(SUPABASE_AUTH_TIMEOUT_MS)
    const result = await pending
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(504)
    expect(responseJson(result)).toEqual({ error: { code: 'upstream_timeout' } })
  })

  it('clears the pending deadline timer on the fast-success path (no open handle leak)', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: VERIFIED_USER_ID }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    const result = await verifySupabaseBearer(event(), { fetchImpl, env: ENV })
    expect(result.ok).toBe(true)
    // After the awaited verifier resolves, no scheduled deadline should remain.
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears the pending deadline timer on any fail-closed synchronous branch', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: 'bad' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    }))
    const result = await verifySupabaseBearer(event(), { fetchImpl, env: ENV })
    expect(result.response.statusCode).toBe(401)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('verifySupabaseBearer identity contract (fail-closed)', () => {
  function jsonResponse(body, status = 200) {
    return vi.fn(async () => new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }))
  }

  it('returns the verified bearer token and minimized identity for same-session RLS calls', async () => {
    const fetchImpl = jsonResponse({ id: VERIFIED_USER_ID, email: 'leak@example', role: 'authenticated' })
    const result = await verifySupabaseBearer(event(), { fetchImpl, env: ENV })
    expect(result.ok).toBe(true)
    expect(result.user).toEqual({ id: VERIFIED_USER_ID })
    expect(Object.keys(result.user)).toEqual(['id'])
    expect(result.accessToken).toBe(BEARER_TOKEN)
  })

  it.each([400, 401, 403])('maps upstream credential rejection (%s) to unauthenticated', async (status) => {
    const fetchImpl = jsonResponse({ error: 'invalid' }, status)
    const result = await verifySupabaseBearer(event(), { fetchImpl, env: ENV })
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(401)
    expect(responseJson(result)).toEqual({ error: { code: 'unauthenticated' } })
  })

  it.each([204, 301, 302, 418, 429, 500, 502, 503, 504])(
    'fails closed as auth_unavailable on any non-200 upstream status (%s)',
    async (status) => {
      const fetchImpl = jsonResponse({ id: VERIFIED_USER_ID }, status)
      const result = await verifySupabaseBearer(event(), { fetchImpl, env: ENV })
      expect(result.ok).toBe(false)
      expect(result.response.statusCode).toBe(503)
      expect(responseJson(result)).toEqual({ error: { code: 'auth_unavailable' } })
    },
  )

  it.each([
    ['null', null],
    ['empty object', {}],
    ['non-string id', { id: 42 }],
    ['empty id', { id: '' }],
    ['whitespace id', { id: '   ' }],
    ['unbranded string', { id: 'household-user' }],
    ['truncated UUID', { id: '00000000-0000-4000-8000-00000000000' }],
    ['non-hex UUID character', { id: '00000000-0000-4000-8000-00000000000g' }],
    ['array body', [{ id: VERIFIED_USER_ID }]],
  ])('fails closed as auth_unavailable when upstream body is %s', async (_label, body) => {
    const fetchImpl = jsonResponse(body)
    const result = await verifySupabaseBearer(event(), { fetchImpl, env: ENV })
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(503)
    expect(responseJson(result)).toEqual({ error: { code: 'auth_unavailable' } })
  })

  it('fails closed as auth_unavailable when the response body is not JSON', async () => {
    const fetchImpl = vi.fn(async () => new Response('not-json', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    const result = await verifySupabaseBearer(event(), { fetchImpl, env: ENV })
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(503)
    expect(responseJson(result)).toEqual({ error: { code: 'auth_unavailable' } })
  })

  it('fails closed as auth_unavailable when the response object has no json method', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 200 }))
    const result = await verifySupabaseBearer(event(), { fetchImpl, env: ENV })
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(503)
    expect(responseJson(result)).toEqual({ error: { code: 'auth_unavailable' } })
  })

  it('fails closed as auth_unavailable when the fetch implementation throws synchronously', async () => {
    const fetchImpl = vi.fn(() => { throw new Error('boom') })
    const result = await verifySupabaseBearer(event(), { fetchImpl, env: ENV })
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(503)
    expect(responseJson(result)).toEqual({ error: { code: 'auth_unavailable' } })
  })

  it('never logs the bearer token, upstream body, or configuration', async () => {
    const fetchImpl = jsonResponse({ id: VERIFIED_USER_ID })
    const logSpies = ['log', 'info', 'warn', 'error', 'debug', 'trace'].map(
      (method) => vi.spyOn(console, method).mockImplementation(() => {}),
    )
    await verifySupabaseBearer(event(), { fetchImpl, env: ENV })
    for (const spy of logSpies) {
      for (const call of spy.mock.calls) {
        const line = JSON.stringify(call)
        expect(line).not.toContain(BEARER_TOKEN)
        expect(line).not.toContain(ENV.SUPABASE_ANON_KEY)
        expect(line).not.toContain(VERIFIED_USER_ID)
      }
    }
  })
})

describe('verifySupabaseBearer strict Bearer parsing', () => {
  it.each([
    ['missing header', {}],
    ['non-Bearer scheme', { authorization: 'Basic abcdef' }],
    ['empty token', { authorization: 'Bearer ' }],
    ['token with space', { authorization: 'Bearer part one' }],
    ['comma in token', { authorization: 'Bearer one,two' }],
  ])('rejects %s without contacting Auth', async (_label, headers) => {
    const fetchImpl = vi.fn()
    const result = await verifySupabaseBearer({ httpMethod: 'GET', headers }, { fetchImpl, env: ENV })
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(401)
    expect(responseJson(result)).toEqual({ error: { code: 'unauthenticated' } })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('accepts a case-mixed but syntactically valid Bearer scheme', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: VERIFIED_USER_ID }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    const result = await verifySupabaseBearer(
      { httpMethod: 'GET', headers: { authorization: `bearer ${BEARER_TOKEN}` } },
      { fetchImpl, env: ENV },
    )
    expect(result.ok).toBe(true)
    expect(result.accessToken).toBe(BEARER_TOKEN)
  })

  it('rejects an overlong Bearer token without contacting Auth', async () => {
    const fetchImpl = vi.fn()
    const overlong = 'a'.repeat(4_097)
    const result = await verifySupabaseBearer(
      { httpMethod: 'GET', headers: { authorization: `Bearer ${overlong}` } },
      { fetchImpl, env: ENV },
    )
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(401)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('fails closed as service_unavailable when Auth configuration is missing', async () => {
    const fetchImpl = vi.fn()
    const result = await verifySupabaseBearer(event(), { fetchImpl, env: {} })
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(503)
    expect(responseJson(result)).toEqual({ error: { code: 'service_unavailable' } })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('fails closed as service_unavailable when the fetch implementation is not a function', async () => {
    const result = await verifySupabaseBearer(event(), { fetchImpl: null, env: ENV })
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(503)
    expect(responseJson(result)).toEqual({ error: { code: 'service_unavailable' } })
  })
})

describe('supabaseAuthConfigured / authConfig fail-closed contract', () => {
  it('is true when https URL and anon key are present', () => {
    expect(supabaseAuthConfigured(ENV)).toBe(true)
  })

  it('is true when the configured URL has a single trailing slash and canonicalizes to the origin', () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: VERIFIED_USER_ID }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    return verifySupabaseBearer(event(), {
      fetchImpl,
      env: { SUPABASE_URL: 'https://academy.supabase.co/', SUPABASE_ANON_KEY: 'k' },
    }).then((result) => {
      expect(result.ok).toBe(true)
      // The outgoing request URL is composed from the canonical origin, never
      // the raw trailing-slash spelling.
      expect(fetchImpl).toHaveBeenCalledWith(
        'https://academy.supabase.co/auth/v1/user',
        expect.any(Object),
      )
    })
  })

  it.each([
    ['fully empty env', {}],
    ['missing anon key', { SUPABASE_URL: 'https://academy.supabase.co' }],
    ['missing URL', { SUPABASE_ANON_KEY: 'k' }],
    ['non-string URL', { SUPABASE_URL: 42, SUPABASE_ANON_KEY: 'k' }],
    ['non-string anon key', { SUPABASE_URL: 'https://academy.supabase.co', SUPABASE_ANON_KEY: 42 }],
    ['whitespace-only anon key', { SUPABASE_URL: 'https://academy.supabase.co', SUPABASE_ANON_KEY: '   ' }],
    ['http scheme', { SUPABASE_URL: 'http://academy.supabase.co', SUPABASE_ANON_KEY: 'k' }],
    ['ws scheme', { SUPABASE_URL: 'ws://academy.supabase.co', SUPABASE_ANON_KEY: 'k' }],
    ['userinfo in URL', { SUPABASE_URL: 'https://user@academy.supabase.co', SUPABASE_ANON_KEY: 'k' }],
    ['user:password in URL', { SUPABASE_URL: 'https://u:p@academy.supabase.co', SUPABASE_ANON_KEY: 'k' }],
    ['URL with path', { SUPABASE_URL: 'https://academy.supabase.co/auth', SUPABASE_ANON_KEY: 'k' }],
    ['URL with deep path', { SUPABASE_URL: 'https://academy.supabase.co/auth/v1', SUPABASE_ANON_KEY: 'k' }],
    ['URL with query', { SUPABASE_URL: 'https://academy.supabase.co?x=1', SUPABASE_ANON_KEY: 'k' }],
    ['URL with fragment', { SUPABASE_URL: 'https://academy.supabase.co#x', SUPABASE_ANON_KEY: 'k' }],
    ['URL with backslash', { SUPABASE_URL: 'https://academy.supabase.co\\evil', SUPABASE_ANON_KEY: 'k' }],
    ['URL with double slashes after host', { SUPABASE_URL: 'https://academy.supabase.co//', SUPABASE_ANON_KEY: 'k' }],
    ['bare host without scheme', { SUPABASE_URL: 'academy.supabase.co', SUPABASE_ANON_KEY: 'k' }],
    ['boolean URL', { SUPABASE_URL: true, SUPABASE_ANON_KEY: 'k' }],
    ['array URL', { SUPABASE_URL: ['https://academy.supabase.co'], SUPABASE_ANON_KEY: 'k' }],
  ])('is false for %s', (_label, env) => {
    expect(supabaseAuthConfigured(env)).toBe(false)
  })

  it.each([
    ['URL with path', { SUPABASE_URL: 'https://academy.supabase.co/auth', SUPABASE_ANON_KEY: 'k' }],
    ['URL with query', { SUPABASE_URL: 'https://academy.supabase.co?x=1', SUPABASE_ANON_KEY: 'k' }],
    ['URL with fragment', { SUPABASE_URL: 'https://academy.supabase.co#x', SUPABASE_ANON_KEY: 'k' }],
    ['URL with backslash', { SUPABASE_URL: 'https://academy.supabase.co\\evil', SUPABASE_ANON_KEY: 'k' }],
    ['non-string URL', { SUPABASE_URL: 42, SUPABASE_ANON_KEY: 'k' }],
  ])('fails closed as service_unavailable and does not contact Auth for %s', async (_label, env) => {
    const fetchImpl = vi.fn()
    const result = await verifySupabaseBearer(event(), { fetchImpl, env })
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(503)
    expect(responseJson(result)).toEqual({ error: { code: 'service_unavailable' } })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
