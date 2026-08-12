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

function installFakeTimers() {
  vi.useFakeTimers()
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

  it('rejects a present-but-empty Authorization header beside a valid multi-value header', async () => {
    const fetchImpl = vi.fn()
    const result = await verifySupabaseBearer(
      event({
        headers: { authorization: '' },
        multiValueHeaders: { authorization: [`Bearer ${ACCESS_TOKEN}`] },
      }),
      { fetchImpl, env: ENV },
    )

    expectFailure(result, 'unauthenticated', 401, 'unauthenticated')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects a valid Authorization header beside an empty multi-value header', async () => {
    const fetchImpl = vi.fn()
    const result = await verifySupabaseBearer(
      event({
        headers: { authorization: `Bearer ${ACCESS_TOKEN}` },
        multiValueHeaders: { authorization: [''] },
      }),
      { fetchImpl, env: ENV },
    )

    expectFailure(result, 'unauthenticated', 401, 'unauthenticated')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('accepts a multi-value Authorization header when no single-value header is present', async () => {
    const fetchImpl = vi.fn(async () => providerResponse({ id: USER_ID }))
    const result = await verifySupabaseBearer(
      event({ headers: {}, multiValueHeaders: { authorization: [`Bearer ${ACCESS_TOKEN}`] } }),
      { fetchImpl, env: ENV },
    )

    expect(result).toEqual({ ok: true, user: { id: USER_ID }, accessToken: ACCESS_TOKEN })
    expect(fetchImpl).toHaveBeenCalledOnce()
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

  it.each([201, 202, 203, 299])(
    'accepts a canonical UUID identity returned on successful status %s',
    async (status) => {
      const fetchImpl = vi.fn(async () => providerResponse({ id: USER_ID }, status))
      const result = await verifySupabaseBearer(event(), { fetchImpl, env: ENV })

      expect(result).toEqual({ ok: true, user: { id: USER_ID }, accessToken: ACCESS_TOKEN })
      expect(fetchImpl).toHaveBeenCalledOnce()
    },
  )

  it.each([
    ['204 with no parsable body', 204, () => Promise.reject(new SyntaxError('Unexpected end of JSON input'))],
    ['204 with a null body', 204, async () => null],
    ['205 with no parsable body', 205, () => Promise.reject(new SyntaxError('Unexpected end of JSON input'))],
  ])('maps %s to auth-unavailable, never unauthenticated', async (_name, status, json) => {
    const result = await verifySupabaseBearer(event(), {
      fetchImpl: vi.fn(async () => ({ status, json: vi.fn(json) })),
      env: ENV,
    })

    expectFailure(result, 'auth-unavailable', 503, 'auth_unavailable')
  })

  it('holds a non-200 2xx body read to the same absolute deadline', async () => {
    installFakeTimers()
    const fetchImpl = vi.fn(async () => ({ status: 201, json: () => new Promise(() => {}) }))
    const pending = verifySupabaseBearer(event(), { fetchImpl, env: ENV })

    await vi.advanceTimersByTimeAsync(SUPABASE_AUTH_TIMEOUT_MS)

    expectFailure(await pending, 'upstream-timeout', 504, 'upstream_timeout')
    expect(vi.getTimerCount()).toBe(0)
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it.each([199, 300, 301, 302, 399])(
    'refuses to treat status %s as success even with a canonical UUID body',
    async (status) => {
      const result = await verifySupabaseBearer(event(), {
        fetchImpl: vi.fn(async () => providerResponse({ id: USER_ID }, status)),
        env: ENV,
      })

      expectFailure(result, 'auth-unavailable', 503, 'auth_unavailable')
    },
  )

  it.each([400, 401, 403])(
    'keeps status %s unauthenticated even when the body carries a canonical UUID',
    async (status) => {
      const result = await verifySupabaseBearer(event(), {
        fetchImpl: vi.fn(async () => providerResponse({ id: USER_ID }, status)),
        env: ENV,
      })

      expectFailure(result, 'unauthenticated', 401, 'unauthenticated')
    },
  )

  it.each([
    ['absent', {}],
    ['numeric string', { status: '200' }],
    ['fractional', { status: 200.5 }],
  ])('refuses a %s status as success', async (_name, statusPart) => {
    const result = await verifySupabaseBearer(event(), {
      fetchImpl: vi.fn(async () => ({ ...statusPart, json: vi.fn(async () => ({ id: USER_ID })) })),
      env: ENV,
    })

    expectFailure(result, 'auth-unavailable', 503, 'auth_unavailable')
  })

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
    installFakeTimers()
    const pending = verifySupabaseBearer(event(), { fetchImpl: hangingFetch(), env: ENV })

    await vi.advanceTimersByTimeAsync(SUPABASE_AUTH_TIMEOUT_MS)
    const result = await pending

    expectFailure(result, 'upstream-timeout', 504, 'upstream_timeout')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('uses the same absolute deadline for connection and body processing', async () => {
    installFakeTimers()
    let finishFetch
    let authSignal
    const fetchImpl = vi.fn(
      (_url, init) => new Promise((resolve) => {
        authSignal = init.signal
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
    expect(vi.getTimerCount()).toBe(0)
    expect(String(authSignal.reason)).not.toContain(ACCESS_TOKEN)
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
    ['malformed length', { id: '123e4567-e89b-42d3-a456-42661417400' }],
    ['missing hyphens', { id: '123e4567e89b42d3a456426614174000' }],
    ['nonhex', { id: 'g23e4567-e89b-42d3-a456-426614174000' }],
    ['leading whitespace', { id: ` ${USER_ID}` }],
    ['trailing whitespace', { id: `${USER_ID} ` }],
    ['braces', { id: `{${USER_ID}}` }],
    ['arbitrary text', { id: 'household-user' }],
    ['null id', { id: null }],
    ['non-string id', { id: 42 }],
  ])('maps a 2xx %s to auth-unavailable, never unauthenticated', async (_name, body) => {
    const result = await verifySupabaseBearer(event(), {
      fetchImpl: vi.fn(async () => providerResponse(body)),
      env: ENV,
    })

    expectFailure(result, 'auth-unavailable', 503, 'auth_unavailable')
  })

  it.each([
    ['repository-standard lowercase UUID', USER_ID],
    ['uppercase hexadecimal UUID', USER_ID.toUpperCase()],
    ['shape-valid UUID with non-RFC version and variant nibbles', '123e4567-e89b-f2d3-7456-426614174000'],
    ['all-zero shape-valid UUID', '00000000-0000-0000-0000-000000000000'],
  ])('accepts %s', async (_name, userId) => {
    const result = await verifySupabaseBearer(event(), {
      fetchImpl: vi.fn(async () => providerResponse({ id: userId })),
      env: ENV,
    })

    expect(result).toEqual({ ok: true, user: { id: userId }, accessToken: ACCESS_TOKEN })
  })
})

describe('verifySupabaseBearer timeout bounds', () => {
  it('clears the deadline after successful body processing with no late abort', async () => {
    installFakeTimers()
    let authSignal
    const fetchImpl = vi.fn(async (_url, init) => {
      authSignal = init.signal
      return providerResponse({ id: USER_ID })
    })

    const result = await verifySupabaseBearer(event(), { fetchImpl, env: ENV })

    expect(result).toEqual({ ok: true, user: { id: USER_ID }, accessToken: ACCESS_TOKEN })
    expect(authSignal.aborted).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(SUPABASE_AUTH_TIMEOUT_MS)
    expect(authSignal.aborted).toBe(false)
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('clears the deadline when the provider refuses credentials before timeout', async () => {
    installFakeTimers()
    let authSignal
    const result = await verifySupabaseBearer(event(), {
      fetchImpl: vi.fn(async (_url, init) => {
        authSignal = init.signal
        return providerResponse({ message: 'refused' }, 401)
      }),
      env: ENV,
    })

    expectFailure(result, 'unauthenticated', 401, 'unauthenticated')
    expect(authSignal.aborted).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears the deadline when the network rejects immediately', async () => {
    installFakeTimers()
    const result = await verifySupabaseBearer(event(), {
      fetchImpl: vi.fn(async () => {
        throw new TypeError('network unavailable')
      }),
      env: ENV,
    })

    expectFailure(result, 'auth-unavailable', 503, 'auth_unavailable')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears the deadline after local response parsing rejects', async () => {
    installFakeTimers()
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
    expect(vi.getTimerCount()).toBe(0)
  })

  it('honors a 3000ms caller override', async () => {
    installFakeTimers()
    const pending = verifySupabaseBearer(event(), {
      fetchImpl: hangingFetch(),
      env: ENV,
      timeoutMs: 3_000,
    })

    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(3_000)
    expectFailure(await pending, 'upstream-timeout', 504, 'upstream_timeout')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('honors an explicit 5000ms maximum', async () => {
    installFakeTimers()
    const pending = verifySupabaseBearer(event(), {
      fetchImpl: hangingFetch(),
      env: ENV,
      timeoutMs: SUPABASE_AUTH_TIMEOUT_MS,
    })

    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(SUPABASE_AUTH_TIMEOUT_MS)
    expectFailure(await pending, 'upstream-timeout', 504, 'upstream_timeout')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('caps overrides above 5000ms at the hard maximum', async () => {
    installFakeTimers()
    const pending = verifySupabaseBearer(event(), {
      fetchImpl: hangingFetch(),
      env: ENV,
      timeoutMs: 60_000,
    })

    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(SUPABASE_AUTH_TIMEOUT_MS)
    expectFailure(await pending, 'upstream-timeout', 504, 'upstream_timeout')
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([0, -1, 1.5, Number.NaN, 'fast', null, undefined])(
    'falls back to 5000ms for invalid timeout override %s',
    async (timeoutMs) => {
      installFakeTimers()
      const pending = verifySupabaseBearer(event(), {
        fetchImpl: hangingFetch(),
        env: ENV,
        timeoutMs,
      })

      expect(vi.getTimerCount()).toBe(1)
      await vi.advanceTimersByTimeAsync(SUPABASE_AUTH_TIMEOUT_MS)
      expectFailure(await pending, 'upstream-timeout', 504, 'upstream_timeout')
      expect(vi.getTimerCount()).toBe(0)
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
