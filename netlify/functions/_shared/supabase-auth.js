import { errorResponse, isTimeoutError } from './http.js'
import { validUuid } from './study-identity/contracts.js'

const MAX_BEARER_LENGTH = 4096
export const SUPABASE_AUTH_TIMEOUT_MS = 5_000

function authConfig(env) {
  const urlValue = env?.SUPABASE_URL || env?.VITE_SUPABASE_URL
  const keyValue = env?.SUPABASE_ANON_KEY || env?.VITE_SUPABASE_ANON_KEY
  if (typeof urlValue !== 'string' || typeof keyValue !== 'string') return null

  const rawUrl = urlValue.trim()
  const anonKey = keyValue.trim()
  if (!/^https:\/\/[^/?#\\]+\/?$/.test(rawUrl) || !anonKey) return null
  try {
    const url = new URL(rawUrl)
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) return null
    return { url: url.origin, anonKey }
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
    if (headerEntries.length === 1 && authorization !== values[0]) return null
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

/** True only when bearer verification failed for a retryable upstream reason. */
export function isTransientBearerAuthFailure(auth) {
  return auth?.failure === 'auth-unavailable' || auth?.failure === 'upstream-timeout'
}

function withDeadline(operation, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }

    const onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    Promise.resolve()
      .then(operation)
      .then(
        (value) => {
          signal.removeEventListener('abort', onAbort)
          resolve(value)
        },
        (error) => {
          signal.removeEventListener('abort', onAbort)
          reject(error)
        },
      )
  })
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
  if (!token) {
    return {
      ok: false,
      failure: 'unauthenticated',
      response: errorResponse(401, 'unauthenticated'),
    }
  }

  const config = authConfig(env)
  if (!config || typeof fetchImpl !== 'function') {
    return { ok: false, failure: 'not-configured', response: errorResponse(503, 'service_unavailable') }
  }

  // Positive integer overrides are honored up to the absolute maximum; larger
  // values are capped and every other value falls back to that maximum.
  const effectiveTimeoutMs =
    Number.isInteger(timeoutMs) && timeoutMs > 0
      ? Math.min(timeoutMs, SUPABASE_AUTH_TIMEOUT_MS)
      : SUPABASE_AUTH_TIMEOUT_MS
  const controller = new AbortController()
  const signal = controller.signal
  const timeout = setTimeout(
    () => controller.abort(new DOMException('Supabase Auth deadline exceeded', 'TimeoutError')),
    effectiveTimeoutMs,
  )

  try {
    const response = await withDeadline(
      () =>
        fetchImpl(`${config.url}/auth/v1/user`, {
          method: 'GET',
          redirect: 'error',
          signal,
          headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${token}`,
            accept: 'application/json',
          },
        }),
      signal,
    )
    if ([400, 401, 403].includes(response?.status)) {
      return { ok: false, failure: 'unauthenticated', response: errorResponse(401, 'unauthenticated') }
    }
    // Every 2xx is a candidate success; the identity itself is decided by the body below.
    const status = response?.status
    if (!Number.isInteger(status) || status < 200 || status > 299) {
      return { ok: false, failure: 'auth-unavailable', response: errorResponse(503, 'auth_unavailable') }
    }
    if (typeof response.json !== 'function') throw new TypeError('Invalid auth response')
    const user = await withDeadline(() => response.json(), signal)
    if (!user || typeof user !== 'object' || Array.isArray(user) || !validUuid(user.id)) {
      return { ok: false, failure: 'auth-unavailable', response: errorResponse(503, 'auth_unavailable') }
    }

    return {
      ok: true,
      user: { id: user.id },
      // Internal-only credential for same-session RLS authorization calls.
      accessToken: token,
    }
  } catch (error) {
    if (isTimeoutError(error, signal)) {
      return { ok: false, failure: 'upstream-timeout', response: errorResponse(504, 'upstream_timeout') }
    }
    return { ok: false, failure: 'auth-unavailable', response: errorResponse(503, 'auth_unavailable') }
  } finally {
    clearTimeout(timeout)
  }
}
