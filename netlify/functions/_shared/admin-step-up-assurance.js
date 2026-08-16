import {
  ADMIN_STEP_UP_ASSURANCE_VERSION,
  ADMIN_STEP_UP_MAX_AGE_SECONDS,
} from '../../../src/admin/stepUpAssurance.ts'
import { verifySupabaseBearer } from './supabase-auth.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_JWT_PAYLOAD_BYTES = 16 * 1024
const MFA_METHODS = new Set(['totp', 'mfa/totp', 'mfa/phone', 'mfa/webauthn'])

// Authority is module-private. A shape-compatible object, browser boolean, or
// serialized copy can never become a consumable assurance.
const ISSUED_BINDINGS = new WeakMap()
const CONSUMED_ASSURANCES = new WeakSet()

const REQUIRED_AAL = Object.freeze({ status: 'required', reason: 'aal2_required' })
const FRESH_AUTH_REQUIRED = Object.freeze({
  status: 'required',
  reason: 'fresh_authentication_required',
})
const UNAUTHENTICATED = Object.freeze({ status: 'unauthenticated' })
const UNAVAILABLE = Object.freeze({ status: 'unavailable' })

function epochSeconds(now) {
  try {
    const value = now()
    if (!(value instanceof Date)) return null
    const milliseconds = value.getTime()
    return Number.isFinite(milliseconds) ? Math.floor(milliseconds / 1_000) : null
  } catch {
    return null
  }
}

function decodePayload(accessToken) {
  if (typeof accessToken !== 'string' || accessToken.length === 0) return null
  const parts = accessToken.split('.')
  if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null
  try {
    const bytes = Buffer.from(parts[1], 'base64url')
    if (bytes.length === 0 || bytes.length > MAX_JWT_PAYLOAD_BYTES) return null
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

function exactAmrEntry(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const keys = Object.keys(value).sort()
  const exact = keys.length === 2 && keys[0] === 'method' && keys[1] === 'timestamp'
  const withProvider = keys.length === 3
    && keys[0] === 'method' && keys[1] === 'provider' && keys[2] === 'timestamp'
    && typeof value.provider === 'string'
  if ((!exact && !withProvider)
    || typeof value.method !== 'string'
    || value.method.length === 0
    || value.method.length > 64
    || !Number.isSafeInteger(value.timestamp)
    || value.timestamp <= 0) return null
  return { method: value.method, timestamp: value.timestamp }
}

function parseEvidence(accessToken, verifiedUserId, nowSeconds) {
  const claims = decodePayload(accessToken)
  if (!claims
    || typeof verifiedUserId !== 'string'
    || !UUID.test(verifiedUserId)
    || claims.sub !== verifiedUserId
    || !UUID.test(claims.sub)
    || typeof claims.session_id !== 'string'
    || !UUID.test(claims.session_id)
    || !Number.isSafeInteger(claims.iat)
    || !Number.isSafeInteger(claims.exp)
    || claims.iat <= 0
    || claims.iat > nowSeconds
    || claims.exp <= nowSeconds
    || claims.exp <= claims.iat
    || !['aal1', 'aal2'].includes(claims.aal)
    || !Array.isArray(claims.amr)
    || claims.amr.length === 0
    || claims.amr.length > 16) return null

  const amr = claims.amr.map(exactAmrEntry)
  if (amr.some((entry) => entry === null
    || entry.timestamp > claims.iat
    || entry.timestamp > nowSeconds)) return null
  return {
    aal: claims.aal,
    actorUserId: claims.sub.toLowerCase(),
    sessionId: claims.session_id.toLowerCase(),
    tokenExpiresAt: claims.exp,
    amr,
  }
}

function freshMfaEvent(evidence, nowSeconds) {
  const candidates = evidence.amr
    .filter((entry) => MFA_METHODS.has(entry.method))
    .sort((left, right) => right.timestamp - left.timestamp)
  const event = candidates[0]
  if (!event
    || nowSeconds >= event.timestamp + ADMIN_STEP_UP_MAX_AGE_SECONDS) return null
  return event
}

function iso(epoch) {
  return new Date(epoch * 1_000).toISOString()
}

/**
 * Server-only Admin fresh-identity primitive.
 *
 * `check` first asks Supabase Auth to validate the exact bearer, then reads the
 * AAL/AMR/session claims from that same provider-signed token. `consume` is
 * request-local and one-shot: it accepts only the original object, actor, and
 * exact bearer from which the assurance was issued.
 */
export function createAdminStepUpAssurance({ env, fetchImpl, authVerifier, clock } = {}) {
  const verify = authVerifier ?? verifySupabaseBearer
  const now = clock ?? (() => new Date())

  return Object.freeze({
    async check(event) {
      let auth
      try {
        auth = await verify(event, { env, fetchImpl })
      } catch {
        return UNAVAILABLE
      }
      if (!auth?.ok) {
        return auth?.response?.statusCode === 401 ? UNAUTHENTICATED : UNAVAILABLE
      }
      const nowSeconds = epochSeconds(now)
      if (nowSeconds === null) return UNAVAILABLE
      const evidence = parseEvidence(auth.accessToken, auth.user?.id, nowSeconds)
      if (!evidence) return UNAVAILABLE
      if (evidence.aal !== 'aal2') return REQUIRED_AAL
      const mfaEvent = freshMfaEvent(evidence, nowSeconds)
      if (!mfaEvent) return FRESH_AUTH_REQUIRED

      const expiresAt = Math.min(
        evidence.tokenExpiresAt,
        mfaEvent.timestamp + ADMIN_STEP_UP_MAX_AGE_SECONDS,
      )
      if (expiresAt <= nowSeconds) return FRESH_AUTH_REQUIRED
      const assurance = Object.freeze({
        version: ADMIN_STEP_UP_ASSURANCE_VERSION,
        kind: 'admin-step-up',
        actorUserId: evidence.actorUserId,
        sessionId: evidence.sessionId,
        authenticationMethod: mfaEvent.method,
        authenticatedAt: iso(mfaEvent.timestamp),
        expiresAt: iso(expiresAt),
      })
      ISSUED_BINDINGS.set(assurance, Object.freeze({
        accessToken: auth.accessToken,
        actorUserId: evidence.actorUserId,
        expiresAt,
      }))
      return { status: 'assured', assurance }
    },

    consume(assurance, { actorUserId, accessToken } = {}) {
      if (!assurance || typeof assurance !== 'object') return { ok: false, reason: 'invalid' }
      if (CONSUMED_ASSURANCES.has(assurance)) return { ok: false, reason: 'replayed' }
      const binding = ISSUED_BINDINGS.get(assurance)
      if (!binding) return { ok: false, reason: 'invalid' }

      // Every attempt is terminal, including a mismatched or expired attempt.
      CONSUMED_ASSURANCES.add(assurance)
      const nowSeconds = epochSeconds(now)
      if (nowSeconds === null || nowSeconds >= binding.expiresAt) {
        return { ok: false, reason: 'expired' }
      }
      if (typeof actorUserId !== 'string'
        || actorUserId.toLowerCase() !== binding.actorUserId) {
        return { ok: false, reason: 'actor_mismatch' }
      }
      if (accessToken !== binding.accessToken) {
        return { ok: false, reason: 'session_mismatch' }
      }
      return { ok: true, assurance }
    },
  })
}
