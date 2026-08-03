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

function event(overrides = {}) {
  return {
    httpMethod: 'GET',
    headers: { authorization: 'Bearer header.payload.signature' },
    ...overrides,
  }
}

function responseJson(result) {
  return JSON.parse(result.response.body)
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
  return vi.fn(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
      }),
  )
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('verifySupabaseBearer timeout default (fail-closed)', () => {
  it('applies the hard default timeout when no timeoutMs is passed', async () => {
    installFakeAbortTimeout()
    const fetchImpl = hangingFetch()
    const pending = verifySupabaseBearer(event(), { fetchImpl, env: ENV })
    await vi.advanceTimersByTimeAsync(SUPABASE_AUTH_TIMEOUT_MS)
    const result = await pending
    expect(AbortSignal.timeout).toHaveBeenCalledWith(SUPABASE_AUTH_TIMEOUT_MS)
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(504)
    expect(responseJson(result)).toEqual({ error: { code: 'upstream_timeout' } })
  })

  it.each([0, -1, 1.5, Number.NaN, 'fast', null])(
    'falls back to the hard default when timeoutMs is invalid (%s)',
    async (timeoutMs) => {
      installFakeAbortTimeout()
      const fetchImpl = hangingFetch()
      const pending = verifySupabaseBearer(event(), { fetchImpl, env: ENV, timeoutMs })
      await vi.advanceTimersByTimeAsync(SUPABASE_AUTH_TIMEOUT_MS)
      const result = await pending
      expect(AbortSignal.timeout).toHaveBeenCalledWith(SUPABASE_AUTH_TIMEOUT_MS)
      expect(result.response.statusCode).toBe(504)
    },
  )

  it('honors an explicit caller timeout override', async () => {
    installFakeAbortTimeout()
    const fetchImpl = hangingFetch()
    const pending = verifySupabaseBearer(event(), { fetchImpl, env: ENV, timeoutMs: 3_000 })
    await vi.advanceTimersByTimeAsync(3_000)
    const result = await pending
    expect(AbortSignal.timeout).toHaveBeenCalledWith(3_000)
    expect(result.response.statusCode).toBe(504)
    expect(responseJson(result)).toEqual({ error: { code: 'upstream_timeout' } })
  })
})

describe('verifySupabaseBearer accessToken passthrough', () => {
  it('returns the verified bearer token for same-session RLS calls', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: 'household-user' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    )
    const result = await verifySupabaseBearer(event(), { fetchImpl, env: ENV })
    expect(result.ok).toBe(true)
    expect(result.user).toEqual({ id: 'household-user' })
    expect(result.accessToken).toBe('header.payload.signature')
  })
})

describe('supabaseAuthConfigured', () => {
  it('is true when https URL and anon key are present', () => {
    expect(supabaseAuthConfigured(ENV)).toBe(true)
  })

  it('is false for missing or non-https configuration', () => {
    expect(supabaseAuthConfigured({})).toBe(false)
    expect(
      supabaseAuthConfigured({ SUPABASE_URL: 'http://academy.supabase.co', SUPABASE_ANON_KEY: 'k' }),
    ).toBe(false)
    expect(supabaseAuthConfigured({ SUPABASE_URL: 'https://academy.supabase.co' })).toBe(false)
  })
})
