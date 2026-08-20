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
  if (!anonKey) return null
  // Pre-filter the raw string: canonical `https://host` (optionally with a
  // single trailing slash) only. Rejects paths, query, fragment, backslash,
  // and non-https before the URL parser gets a chance to normalize anything.
  if (!/^https:\/\/[^/?#\\]+\/?$/.test(rawUrl)) return null
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
 * Race an operation against an AbortSignal. The returned promise settles as
 * soon as EITHER the operation settles OR the signal aborts, whichever comes
 * first. This makes the deadline binding even when the underlying operation
 * ignores the signal (e.g., a misbehaving fetch implementation or a
 * response.json body that never settles).
 */
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
 * The auth call always runs under a hard deadline enforced by a Promise race,
 * so it cannot be defeated by a fetch implementation or a response body that
 * ignores the AbortSignal. Callers may override the duration via timeoutMs;
 * anything absent or invalid falls back to SUPABASE_AUTH_TIMEOUT_MS and any
 * value larger than that is clamped down. There is no way to opt out of the
 * bounded timeout.
 */
export async function verifySupabaseBearer(event, { fetchImpl, env, timeoutMs }) {
  const token = bearerToken(event)
  if (!token) return { ok: false, response: errorResponse(401, 'unauthenticated') }

  const config = authConfig(env)
  if (!config || typeof fetchImpl !== 'function') {
    return { ok: false, response: errorResponse(503, 'service_unavailable') }
  }

  // Positive integer overrides are honored only up to the hard maximum; larger
  // values are capped and every other value falls back to that maximum.
  const effectiveTimeoutMs =
    Number.isInteger(timeoutMs) && timeoutMs > 0
      ? Math.min(timeoutMs, SUPABASE_AUTH_TIMEOUT_MS)
      : SUPABASE_AUTH_TIMEOUT_MS
  const controller = new AbortController()
  const signal = controller.signal
  const deadline = setTimeout(
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
      return { ok: false, response: errorResponse(401, 'unauthenticated') }
    }
    // Any non-200 response — including 2xx variants like 204 or upstream 5xx —
    // is treated as a malformed identity answer and fails closed.
    if (response?.status !== 200) {
      return { ok: false, response: errorResponse(503, 'auth_unavailable') }
    }
    if (typeof response.json !== 'function') throw new TypeError('invalid_auth_response')
    const user = await withDeadline(() => response.json(), signal)
    // Real Supabase Auth always returns a UUID id. A missing, non-string, or
    // non-UUID id is a malformed upstream answer — never a client credential
    // problem — so we fail closed as unavailable rather than unauthenticated.
    if (!user || typeof user !== 'object' || Array.isArray(user) || !validUuid(user.id)) {
      return { ok: false, response: errorResponse(503, 'auth_unavailable') }
    }
    return {
      ok: true,
      user: { id: user.id },
      // Internal-only credential for same-session RLS authorization calls.
      accessToken: token,
    }
  } catch (error) {
    if (isTimeoutError(error, signal)) {
      return { ok: false, response: errorResponse(504, 'upstream_timeout') }
    }
    return { ok: false, response: errorResponse(503, 'auth_unavailable') }
  } finally {
    // Always cancel the pending timer, whether the operation completed
    // normally, threw, or was aborted. Prevents open-handle leaks on fast
    // successes and idempotent no-ops when the timer has already fired.
    clearTimeout(deadline)
  }
}
