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
  if (!token) return { ok: false, response: errorResponse(401, 'unauthenticated') }

  const config = authConfig(env)
  if (!config) return { ok: false, response: errorResponse(503, 'service_unavailable') }

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
      return { ok: false, response: errorResponse(504, 'upstream_timeout') }
    }
    return { ok: false, response: errorResponse(503, 'auth_unavailable') }
  }

  if ([400, 401, 403].includes(response.status)) {
    return { ok: false, response: errorResponse(401, 'unauthenticated') }
  }
  if (!response.ok) return { ok: false, response: errorResponse(503, 'auth_unavailable') }

  let user
  try {
    user = await response.json()
  } catch (error) {
    if (isTimeoutError(error, signal)) {
      return { ok: false, response: errorResponse(504, 'upstream_timeout') }
    }
    return { ok: false, response: errorResponse(503, 'auth_unavailable') }
  }
  if (signal.aborted) {
    return { ok: false, response: errorResponse(504, 'upstream_timeout') }
  }
  if (!user || typeof user !== 'object' || typeof user.id !== 'string' || user.id.trim() === '') {
    return { ok: false, response: errorResponse(401, 'unauthenticated') }
  }

  return {
    ok: true,
    user: { id: user.id },
    // Internal-only credential for same-session RLS authorization calls.
    accessToken: token,
  }
}
