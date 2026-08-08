import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SUPABASE_AUTH_TIMEOUT_MS,
  isAuthorizationInfrastructureFailure,
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

// ── STUDY-A1-AUTH-INFRA-BOUNDARY-H3 ─────────────────────────────────────────
// A reachable auth server that answers 2xx with something that is not a user is
// an *invalid identity*, not an outage.
//
// H2 gave every refusal a typed `failure`, and study-safety-classify turns the
// two transient ones — auth-unavailable, upstream-timeout — into the 424 whose
// learner copy is "wait a moment, then try again". If a malformed success body
// ever joined them, a sign-in that is permanently broken would be dressed as a
// passing blip: the learner would be told to wait for something that will never
// arrive, and the App would never clear the identity that is the actual fault.
//
// H2 shipped that distinction correctly and never pinned it — a mutation moving
// these bodies onto `auth-unavailable` survived all 2605 tests in the suite.
// This block is the pin, and it is written against the discriminator rather than
// truthiness: `ok: false` alone cannot tell the two categories apart.

/** A reachable, healthy auth server that answered `body` with a 2xx. */
function respondsWith(body) {
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => body }))
}

// Every rejected shape here is derived from a clause of the verifier's own
// validator, so loosening any single clause fails at least one row:
//   !user | typeof user !== 'object' | typeof user.id !== 'string' | trim === ''
const INVALID_SUCCESS_BODIES = [
  ['null', null],
  ['undefined', undefined],
  ['false', false],
  ['the number zero', 0],
  ['an empty string', ''],
  ['a bare number', 42],
  ['a bare string', 'household-user'],
  ['true', true],
  ['an empty object', {}],
  ['an empty array', []],
  ['an array wrapping an otherwise valid user', [{ id: 'household-user' }]],
  ['a numeric id', { id: 42 }],
  ['a null id', { id: null }],
  ['a boolean id', { id: true }],
  ['an array id', { id: ['household-user'] }],
  ['an object id', { id: { value: 'household-user' } }],
  ['an empty-string id', { id: '' }],
  ['a whitespace-only id', { id: '   ' }],
  ['a tab-and-newline-only id', { id: '\t\n' }],
  ['an email but no id', { email: 'x@example.com' }],
  ['a capitalised Id', { Id: 'household-user' }],
  ['a user nested one level down', { user: { id: 'household-user' } }],
]

describe('verifySupabaseBearer invalid identity from a reachable auth server', () => {
  it.each(INVALID_SUCCESS_BODIES)(
    'is an identity failure and never infrastructure for %s',
    async (_label, body) => {
      const fetchImpl = respondsWith(body)
      const result = await verifySupabaseBearer(event(), { fetchImpl, env: ENV })

      // The server really was reached and really did answer: whatever this is,
      // it is not an outage that a later attempt could clear.
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      expect(result.ok).toBe(false)
      expect(result.user).toBeUndefined()
      expect(result.accessToken).toBeUndefined()
      // The discriminator itself, by identity — not by truthiness.
      expect(result.failure).toBe('unauthenticated')
      expect(result.failure).not.toBe('auth-unavailable')
      expect(result.failure).not.toBe('upstream-timeout')
      expect(isAuthorizationInfrastructureFailure(result)).toBe(false)
      // And the wire contract the browser actually reads.
      expect(result.response.statusCode).toBe(401)
      expect(responseJson(result)).toEqual({ error: { code: 'unauthenticated' } })
    },
  )

  // The other half. Without it, a mutation that answered `unauthenticated` for
  // every 2xx — valid users included — would satisfy every row above.
  it.each([
    ['a plain id', { id: 'household-user' }, 'household-user'],
    ['a single-character id', { id: 'x' }, 'x'],
    ['an id padded with whitespace', { id: ' household-user ' }, ' household-user '],
    ['extra fields beside the id', { id: 'household-user', email: 'x@example.com', role: 'authenticated' }, 'household-user'],
  ])('accepts %s and returns that id and nothing else', async (_label, body, expectedId) => {
    const result = await verifySupabaseBearer(event(), { fetchImpl: respondsWith(body), env: ENV })
    expect(result.ok).toBe(true)
    expect(result.failure).toBeUndefined()
    expect(result.response).toBeUndefined()
    expect(result.user).toEqual({ id: expectedId })
    expect(result.accessToken).toBe('header.payload.signature')
  })

  // The infrastructure control: the states that genuinely ARE transient, so the
  // pins above cannot be satisfied by collapsing every failure onto identity.
  it('calls a failed transport infrastructure', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('supabase auth unreachable') })
    const result = await verifySupabaseBearer(event(), { fetchImpl, env: ENV })
    expect(result.failure).toBe('auth-unavailable')
    expect(isAuthorizationInfrastructureFailure(result)).toBe(true)
    expect(result.response.statusCode).toBe(503)
    expect(responseJson(result)).toEqual({ error: { code: 'auth_unavailable' } })
  })

  it('calls a hard timeout infrastructure', async () => {
    installFakeAbortTimeout()
    const pending = verifySupabaseBearer(event(), { fetchImpl: hangingFetch(), env: ENV })
    await vi.advanceTimersByTimeAsync(SUPABASE_AUTH_TIMEOUT_MS)
    const result = await pending
    expect(result.failure).toBe('upstream-timeout')
    expect(isAuthorizationInfrastructureFailure(result)).toBe(true)
    expect(result.response.statusCode).toBe(504)
  })

  it('calls a 2xx whose body never arrived infrastructure', async () => {
    // Reached is not the same as answered. This is the one 2xx that IS an
    // outage, and it is the closest neighbour of every row in the first block.
    const timeout = new Error('The operation was aborted due to timeout')
    timeout.name = 'TimeoutError'
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => { throw timeout },
    }))
    const result = await verifySupabaseBearer(event(), { fetchImpl, env: ENV })
    expect(result.failure).toBe('upstream-timeout')
    expect(isAuthorizationInfrastructureFailure(result)).toBe(true)
    expect(result.response.statusCode).toBe(504)
  })

  it.each([400, 401, 403])('keeps a genuine refusal (%i) on identity', async (status) => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status, json: async () => ({ error: 'invalid token' }) }))
    const result = await verifySupabaseBearer(event(), { fetchImpl, env: ENV })
    expect(result.failure).toBe('unauthenticated')
    expect(isAuthorizationInfrastructureFailure(result)).toBe(false)
    expect(result.response.statusCode).toBe(401)
  })

  it('keeps a missing bearer on identity, without reaching the auth server', async () => {
    const fetchImpl = vi.fn()
    const result = await verifySupabaseBearer({ httpMethod: 'GET', headers: {} }, { fetchImpl, env: ENV })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result.failure).toBe('unauthenticated')
    expect(isAuthorizationInfrastructureFailure(result)).toBe(false)
    expect(result.response.statusCode).toBe(401)
  })

  it('keeps a misconfigured deployment off the infrastructure category', async () => {
    // A deploy fault is not transient: retrying in a moment cannot fix it, so it
    // must not borrow the retry copy either.
    const fetchImpl = vi.fn()
    const result = await verifySupabaseBearer(event(), { fetchImpl, env: {} })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result.failure).toBe('not-configured')
    expect(isAuthorizationInfrastructureFailure(result)).toBe(false)
    expect(result.response.statusCode).toBe(503)
    expect(responseJson(result)).toEqual({ error: { code: 'service_unavailable' } })
  })

  it('treats exactly two failures as authorization infrastructure and no others', async () => {
    // The predicate the gateway branches on, pinned as a set rather than as a
    // pair of examples: a new failure name is not infrastructure by default.
    for (const failure of ['auth-unavailable', 'upstream-timeout']) {
      expect(isAuthorizationInfrastructureFailure({ ok: false, failure })).toBe(true)
    }
    for (const failure of ['unauthenticated', 'not-configured', 'unavailable', 'auth_unavailable', 'upstream_timeout', '', null, undefined]) {
      expect(isAuthorizationInfrastructureFailure({ ok: false, failure })).toBe(false)
    }
    // An older shape, or a caller's own stub, carries no failure at all.
    expect(isAuthorizationInfrastructureFailure({ ok: false })).toBe(false)
    expect(isAuthorizationInfrastructureFailure(undefined)).toBe(false)
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
