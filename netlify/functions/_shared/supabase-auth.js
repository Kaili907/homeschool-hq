import { errorResponse, isTimeoutError } from './http.js'

const MAX_BEARER_LENGTH = 4096
export const SUPABASE_AUTH_TIMEOUT_MS = 5_000

function authConfig(env) {
  const rawUrl = (env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || '').trim()
  const anonKey = (env?.SUPABASE_ANON_KEY || env?.VITE_SUPABASE_ANON_KEY || '').trim()
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return anonKey ? { url: url.toString().replace(/\/+$/, ''), anonKey } : null
  } catch {
    return null
  }
}

function bearerToken(event) {
  const headerEntries =
    event?.headers && typeof event.headers === 'object'
      ? Object.entries(event.headers).filter(([key]) => key.toLowerCase() === 'authorization')
      : []
  if (headerEntries.length > 1 || (headerEntries.length === 1 && typeof headerEntries[0][1] !== 'string')) {
    return null
  }

  let authorization = headerEntries.length === 1 ? headerEntries[0][1] : ''
  const multiEntries =
    event?.multiValueHeaders && typeof event.multiValueHeaders === 'object'
      ? Object.entries(event.multiValueHeaders).filter(([key]) => key.toLowerCase() === 'authorization')
      : []
  if (multiEntries.length > 1) return null
  if (multiEntries.length === 1) {
    const values = multiEntries[0][1]
    if (!Array.isArray(values) || values.length !== 1 || typeof values[0] !== 'string') {
      return null
    }
    if (authorization && authorization !== values[0]) return null
    authorization = values[0]
  }
  const match = /^Bearer ([^\s,]+)$/i.exec(authorization)
  if (!match || match[1].length > MAX_BEARER_LENGTH) return null
  return match[1]
}

/** Sanitized readiness predicate; it never returns or logs configuration values. */
export function supabaseAuthConfigured(env) {
  return authConfig(env) !== null
}

/**
 * STUDY-A1-AUTH-INFRA-BOUNDARY-H2 — did this refusal mean "the adult bearer is
 * not valid" or "this verifier could not answer at all"?
 *
 * Every `{ ok: false }` result below carries a `failure` naming which state it
 * came from, so a caller never has to read the response body or infer it from a
 * status that several unrelated conditions share. Only the two transient
 * infrastructure states are named here: `unauthenticated` is a real identity
 * failure and `not-configured` is a deploy fault that retrying cannot fix.
 *
 * This is a predicate over a result from THIS verifier, so a caller acting on it
 * already knows the failure came from adult-bearer verification and from nothing
 * else. Anything that does not carry a `failure` — a caller's own stub, an older
 * shape — is not infrastructure, which keeps the fail direction unchanged.
 */
export function isAuthorizationInfrastructureFailure(auth) {
  return auth?.failure === 'auth-unavailable' || auth?.failure === 'upstream-timeout'
}

/**
 * Validate a Supabase access token with the project's Auth server. The returned
 * user id is the same value used by the current profiles RLS policy as the
 * household boundary. No client-provided user or household identifier is read.
 *
 * The auth call always runs under a hard timeout. Callers may override the
 * duration via timeoutMs; anything absent or invalid falls back to
 * SUPABASE_AUTH_TIMEOUT_MS. There is no way to opt out of the timeout.
 */
export async function verifySupabaseBearer(event, { fetchImpl, env, timeoutMs }) {
  const token = bearerToken(event)
  if (!token) return { ok: false, failure: 'unauthenticated', response: errorResponse(401, 'unauthenticated') }

  const config = authConfig(env)
  if (!config) return { ok: false, failure: 'not-configured', response: errorResponse(503, 'service_unavailable') }

  let response
  const effectiveTimeoutMs =
    Number.isInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : SUPABASE_AUTH_TIMEOUT_MS
  const signal = AbortSignal.timeout(effectiveTimeoutMs)
  try {
    response = await fetchImpl(`${config.url}/auth/v1/user`, {
      method: 'GET',
      redirect: 'error',
      signal,
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${token}`,
        accept: 'application/json',
      },
    })
  } catch (error) {
    if (isTimeoutError(error, signal)) {
      return { ok: false, failure: 'upstream-timeout', response: errorResponse(504, 'upstream_timeout') }
    }
    return { ok: false, failure: 'auth-unavailable', response: errorResponse(503, 'auth_unavailable') }
  }

  if ([400, 401, 403].includes(response.status)) {
    return { ok: false, failure: 'unauthenticated', response: errorResponse(401, 'unauthenticated') }
  }
  if (!response.ok) return { ok: false, failure: 'auth-unavailable', response: errorResponse(503, 'auth_unavailable') }

  let user
  try {
    user = await response.json()
  } catch (error) {
    if (isTimeoutError(error, signal)) {
      return { ok: false, failure: 'upstream-timeout', response: errorResponse(504, 'upstream_timeout') }
    }
    return { ok: false, failure: 'auth-unavailable', response: errorResponse(503, 'auth_unavailable') }
  }
  if (signal.aborted) {
    return { ok: false, failure: 'upstream-timeout', response: errorResponse(504, 'upstream_timeout') }
  }
  // A reachable auth server that answered with something other than a user is
  // an invalid identity, not an outage: it keeps 401 and its own recovery.
  if (!user || typeof user !== 'object' || typeof user.id !== 'string' || user.id.trim() === '') {
    return { ok: false, failure: 'unauthenticated', response: errorResponse(401, 'unauthenticated') }
  }

  return {
    ok: true,
    user: { id: user.id },
    // Internal-only credential for same-session RLS authorization calls.
    accessToken: token,
  }
}
