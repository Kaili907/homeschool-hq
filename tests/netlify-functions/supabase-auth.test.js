import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SUPABASE_AUTH_TIMEOUT_MS,
  isTransientBearerAuthFailure,
  supabaseAuthConfigured,
  verifySupabaseBearer,
} from '../../netlify/functions/_shared/supabase-auth.js'

const ACCESS_TOKEN = 'header.payload.signature'
const USER_ID = '123e4567-e89b-42d3-a456-426614174000'
const ENV = Object.freeze({
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_ANON_KEY: 'public-anon-key',
})

function event(overrides = {}) {
  return {
    httpMethod: 'GET',
    headers: { authorization: `Bearer ${ACCESS_TOKEN}` },
    ...overrides,
  }
}

function providerResponse(body, status = 200) {
  return { status, json: vi.fn(async () => body) }
}

function responseJson(result) {
  return JSON.parse(result.response.body)
}

function expectFailure(result, failure, statusCode, code) {
  expect(result).toEqual({
    ok: false,
    failure,
    response: expect.objectContaining({ statusCode }),
  })
  expect(responseJson(result)).toEqual({ error: { code } })
}

function installFakeAbortTimeout() {
  vi.useFakeTimers()
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(new DOMException('timed out', 'TimeoutError')), milliseconds)
    return controller.signal
  })
}

function hangingFetch() {
  return vi.fn(() => new Promise(() => {}))
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('verifySupabaseBearer credential decisions', () => {
  it.each([
    ['missing bearer', event({ headers: {} })],
    ['malformed bearer', event({ headers: { authorization: `Token ${ACCESS_TOKEN}` } })],
    [
      'duplicate bearer',
      event({
        headers: {
          authorization: `Bearer ${ACCESS_TOKEN}`,
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
      }),
    ],
    [
      'ambiguous multi-value bearer',
      event({ multiValueHeaders: { authorization: [`Bearer ${ACCESS_TOKEN}`, 'Bearer second'] } }),
    ],
    ['oversized bearer', event({ headers: { authorization: `Bearer ${'x'.repeat(4097)}` } })],
  ])('classifies %s as unauthenticated without an upstream request', async (_name, request) => {
    const fetchImpl = vi.fn()
    const result = await verifySupabaseBearer(request, { fetchImpl, env: ENV })

    expectFailure(result, 'unauthenticated', 401, 'unauthenticated')
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN)
  })

  it.each([400, 401, 403])('maps provider credential refusal %s to unauthenticated', async (status) => {
    const result = await verifySupabaseBearer(event(), {
      fetchImpl: vi.fn(async () => providerResponse({ message: 'refused' }, status)),
      env: ENV,
    })

    expectFailure(result, 'unauthenticated', 401, 'unauthenticated')
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN)
  })

  it('returns the exact minimal success contract for a valid bearer and UUID', async () => {
    const fetchImpl = vi.fn(async () =>
      providerResponse({
        id: USER_ID,
        email: 'dad@example.test',
        phone: '+15555555555',
        role: 'authenticated',
        identities: [{ id: 'provider-identity' }],
        user_metadata: { household: 'secret' },
      }),
    )

    const result = await verifySupabaseBearer(event(), { fetchImpl, env: ENV })

    expect(result).toEqual({ ok: true, user: { id: USER_ID }, accessToken: ACCESS_TOKEN })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://academy.supabase.co/auth/v1/user',
      expect.objectContaining({
        method: 'GET',
        redirect: 'error',
        headers: {
          apikey: 'public-anon-key',
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          accept: 'application/json',
        },
      }),
    )
  })
})

describe('verifySupabaseBearer configuration', () => {
  it.each([
    ['missing URL', { SUPABASE_ANON_KEY: 'public-anon-key' }],
    ['missing anon key', { SUPABASE_URL: 'https://academy.supabase.co' }],
    ['non-string URL', { SUPABASE_URL: 42, SUPABASE_ANON_KEY: 'public-anon-key' }],
    ['blank anon key', { SUPABASE_URL: 'https://academy.supabase.co', SUPABASE_ANON_KEY: '  ' }],
  ])('returns not-configured for %s without an upstream request', async (_name, env) => {
    const fetchImpl = vi.fn()
    const result = await verifySupabaseBearer(event(), { fetchImpl, env })

    expectFailure(result, 'not-configured', 503, 'service_unavailable')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    'http://academy.supabase.co',
    'https://user:password@academy.supabase.co',
    'https://academy.supabase.co?project=other',
    'https://academy.supabase.co#other',
    'https://academy.supabase.co/rest/v1',
    'https://academy.supabase.co//',
    'https:\\academy.supabase.co',
  ])('rejects structurally invalid Supabase URL %s without an upstream request', async (url) => {
    const fetchImpl = vi.fn()
    const env = { SUPABASE_URL: url, SUPABASE_ANON_KEY: 'public-anon-key' }
    const result = await verifySupabaseBearer(event(), { fetchImpl, env })

    expectFailure(result, 'not-configured', 503, 'service_unavailable')
    expect(supabaseAuthConfigured(env)).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns not-configured when no usable fetch implementation exists', async () => {
    const result = await verifySupabaseBearer(event(), { fetchImpl: undefined, env: ENV })
    expectFailure(result, 'not-configured', 503, 'service_unavailable')
  })

  it('accepts only an HTTPS root origin with an anon key', () => {
    expect(supabaseAuthConfigured(ENV)).toBe(true)
    expect(
      supabaseAuthConfigured({
        SUPABASE_URL: 'https://academy.supabase.co/',
        SUPABASE_ANON_KEY: 'public-anon-key',
      }),
    ).toBe(true)
  })
})

describe('verifySupabaseBearer upstream availability decisions', () => {
  it.each([201, 429, 500, 418, 302])(
    'maps non-credential provider status %s to auth-unavailable',
    async (status) => {
      const result = await verifySupabaseBearer(event(), {
        fetchImpl: vi.fn(async () => providerResponse({ error: 'provider detail' }, status)),
        env: ENV,
      })

      expectFailure(result, 'auth-unavailable', 503, 'auth_unavailable')
    },
  )

  it.each([
    ['network failure', new TypeError('getaddrinfo ENOTFOUND secret.internal')],
    ['redirect rejection', new TypeError('fetch failed because redirect mode is error')],
  ])('maps %s to auth-unavailable', async (_name, error) => {
    const result = await verifySupabaseBearer(event(), {
      fetchImpl: vi.fn(async () => {
        throw error
      }),
      env: ENV,
    })

    expectFailure(result, 'auth-unavailable', 503, 'auth_unavailable')
    expect(JSON.stringify(result)).not.toContain(error.message)
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN)
  })

  it('times out during fetch even when the fetch implementation ignores its signal', async () => {
    installFakeAbortTimeout()
    const pending = verifySupabaseBearer(event(), { fetchImpl: hangingFetch(), env: ENV })

    await vi.advanceTimersByTimeAsync(SUPABASE_AUTH_TIMEOUT_MS)
    const result = await pending

    expectFailure(result, 'upstream-timeout', 504, 'upstream_timeout')
  })

  it('uses the same absolute deadline for connection and body processing', async () => {
    installFakeAbortTimeout()
    let finishFetch
    const fetchImpl = vi.fn(
      () => new Promise((resolve) => {
        finishFetch = resolve
      }),
    )
    const pending = verifySupabaseBearer(event(), { fetchImpl, env: ENV })

    await vi.advanceTimersByTimeAsync(2_000)
    finishFetch({ status: 200, json: () => new Promise(() => {}) })
    await vi.advanceTimersByTimeAsync(2_999)
    let settled = false
    pending.finally(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    const result = await pending
    expectFailure(result, 'upstream-timeout', 504, 'upstream_timeout')
    expect(AbortSignal.timeout).toHaveBeenCalledTimes(1)
    expect(AbortSignal.timeout).toHaveBeenCalledWith(SUPABASE_AUTH_TIMEOUT_MS)
  })

  it('maps malformed provider JSON to auth-unavailable', async () => {
    const result = await verifySupabaseBearer(event(), {
      fetchImpl: vi.fn(async () => ({
        status: 200,
        json: vi.fn(async () => {
          throw new SyntaxError('bad json')
        }),
      })),
      env: ENV,
    })

    expectFailure(result, 'auth-unavailable', 503, 'auth_unavailable')
  })

  it.each([
    ['null response body', null],
    ['array response body', [{ id: USER_ID }]],
    ['missing id', { email: 'dad@example.test' }],
    ['blank id', { id: '   ' }],
    ['malformed UUID id', { id: 'household-user' }],
  ])('maps a 2xx %s to auth-unavailable, never unauthenticated', async (_name, body) => {
    const result = await verifySupabaseBearer(event(), {
      fetchImpl: vi.fn(async () => providerResponse(body)),
      env: ENV,
    })

    expectFailure(result, 'auth-unavailable', 503, 'auth_unavailable')
  })

  it('accepts a UUID matching the repository identity rule', async () => {
    const result = await verifySupabaseBearer(event(), {
      fetchImpl: vi.fn(async () => providerResponse({ id: USER_ID })),
      env: ENV,
    })

    expect(result).toEqual({ ok: true, user: { id: USER_ID }, accessToken: ACCESS_TOKEN })
  })
})

describe('verifySupabaseBearer timeout bounds', () => {
  it('honors a 3000ms caller override', async () => {
    installFakeAbortTimeout()
    const pending = verifySupabaseBearer(event(), {
      fetchImpl: hangingFetch(),
      env: ENV,
      timeoutMs: 3_000,
    })

    await vi.advanceTimersByTimeAsync(3_000)
    expectFailure(await pending, 'upstream-timeout', 504, 'upstream_timeout')
    expect(AbortSignal.timeout).toHaveBeenCalledWith(3_000)
  })

  it('caps overrides above 5000ms at the hard maximum', async () => {
    installFakeAbortTimeout()
    const pending = verifySupabaseBearer(event(), {
      fetchImpl: hangingFetch(),
      env: ENV,
      timeoutMs: 60_000,
    })

    await vi.advanceTimersByTimeAsync(SUPABASE_AUTH_TIMEOUT_MS)
    expectFailure(await pending, 'upstream-timeout', 504, 'upstream_timeout')
    expect(AbortSignal.timeout).toHaveBeenCalledWith(SUPABASE_AUTH_TIMEOUT_MS)
  })

  it.each([0, -1, 1.5, Number.NaN, 'fast', null])(
    'falls back to 5000ms for invalid timeout override %s',
    async (timeoutMs) => {
      installFakeAbortTimeout()
      const pending = verifySupabaseBearer(event(), {
        fetchImpl: hangingFetch(),
        env: ENV,
        timeoutMs,
      })

      await vi.advanceTimersByTimeAsync(SUPABASE_AUTH_TIMEOUT_MS)
      expectFailure(await pending, 'upstream-timeout', 504, 'upstream_timeout')
      expect(AbortSignal.timeout).toHaveBeenCalledWith(SUPABASE_AUTH_TIMEOUT_MS)
    },
  )
})

describe('canonical failure predicate', () => {
  it('names only retryable bearer-auth failures as transient', () => {
    expect(isTransientBearerAuthFailure({ failure: 'auth-unavailable' })).toBe(true)
    expect(isTransientBearerAuthFailure({ failure: 'upstream-timeout' })).toBe(true)
    expect(isTransientBearerAuthFailure({ failure: 'unauthenticated' })).toBe(false)
    expect(isTransientBearerAuthFailure({ failure: 'not-configured' })).toBe(false)
    expect(isTransientBearerAuthFailure({ ok: false })).toBe(false)
  })
})

describe('representative consumer compatibility', () => {
  const consumers = [
    [
      'Admin shared authorization',
      (auth) => ({ actorUserId: auth.user.id, accessToken: auth.accessToken }),
    ],
    ['Parent installation', (auth) => ({ userId: auth.user.id, accessToken: auth.accessToken })],
    ['Study', (auth) => ({ actorUserId: auth.user.id, accessToken: auth.accessToken })],
    ['Anthropic/TTS gateway', (auth) => ({ userId: auth.user.id })],
  ]

  it.each(consumers)('supplies the %s server-side authorization inputs', async (_name, project) => {
    const auth = await verifySupabaseBearer(event(), {
      fetchImpl: vi.fn(async () => providerResponse({ id: USER_ID })),
      env: ENV,
    })
    const privileged = vi.fn(async (inputs) => inputs)

    if (auth.ok) await privileged(project(auth))

    expect(privileged).toHaveBeenCalledOnce()
    expect(privileged.mock.calls[0][0]).toEqual(project(auth))
  })

  it.each(consumers)('prevents %s privileged downstream work after bearer failure', async (_name, project) => {
    const auth = await verifySupabaseBearer(event(), {
      fetchImpl: vi.fn(async () => providerResponse({ error: 'outage' }, 500)),
      env: ENV,
    })
    const privileged = vi.fn(async (inputs) => inputs)

    if (auth.ok) await privileged(project(auth))

    expectFailure(auth, 'auth-unavailable', 503, 'auth_unavailable')
    expect(privileged).not.toHaveBeenCalled()
    expect(auth.response.statusCode).not.toBe(424)
  })
})
