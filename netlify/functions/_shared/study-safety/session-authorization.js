/**
 * Durable, session-verifying learner authorization for the Study safety
 * gateway. Household, student, and learner-session identity are derived from
 * the trusted-server verification RPC; a caller never supplies them and a
 * caller-supplied learner reference can only contradict the verified session,
 * never widen it. Every failure mode is a refusal.
 */

import { createSupabaseServiceRpc } from '../study-adult-review/supabase-ports.js'
import {
  digestStudySessionReference,
  isVerifiedGrant,
  STUDY_IDENTITY_SCHEMA_VERSION,
} from '../study-identity/contracts.js'
import { validUuid } from './contracts.js'

/**
 * Classifying learner or tutor text belongs to an in-progress attempt, so the
 * session must still hold the attempt capability, not merely a read scope.
 */
const REQUIRED_CAPABILITY = 'student:attempts:create'
const ACTOR_AUTHORIZATION_RPC = 'academy_study_authorize_guardian_session_v1'
const ACTOR_AUTHORIZATION_TIMEOUT_MS = 3_000

const DENIED = Object.freeze({ status: 'denied', code: 'student-session-invalid' })
const UNAVAILABLE = Object.freeze({ status: 'unavailable', code: 'learner-authorization-unavailable' })
// This capability is intentionally not an object property. Only this module
// can add a concrete verifier to the set, so a shape-compatible object literal
// cannot claim that it verifies durable Study sessions.
const VERIFIED_SESSION_AUTHORIZATION_PORTS = new WeakSet()
const TEST_SESSION_AUTHORIZATION_PORTS = new WeakSet()

function actorAuthorizationConfig(env) {
  const rawUrl = (env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || '').trim()
  const anonKey = (env?.SUPABASE_ANON_KEY || env?.VITE_SUPABASE_ANON_KEY || '').trim()
  try {
    const url = new URL(rawUrl)
    if (
      url.protocol !== 'https:' || url.username || url.password ||
      url.search || url.hash || !anonKey
    ) return null
    return { url: url.toString().replace(/\/+$/, ''), anonKey }
  } catch {
    return null
  }
}

async function authorizeActorSession({ config, fetchImpl, accessToken, tokenDigest }) {
  if (!config || typeof fetchImpl !== 'function' || typeof accessToken !== 'string' || accessToken === '') {
    return UNAVAILABLE
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ACTOR_AUTHORIZATION_TIMEOUT_MS)
  let response
  try {
    response = await fetchImpl(`${config.url}/rest/v1/rpc/${ACTOR_AUTHORIZATION_RPC}`, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        p_token_digest: tokenDigest,
        p_required_capability: REQUIRED_CAPABILITY,
      }),
    })
  } catch {
    return UNAVAILABLE
  } finally {
    clearTimeout(timer)
  }
  if ([401, 403].includes(response.status)) return DENIED
  if (!response.ok) return UNAVAILABLE
  let result
  try {
    result = await response.json()
  } catch {
    return UNAVAILABLE
  }
  if (
    result?.schemaVersion === STUDY_IDENTITY_SCHEMA_VERSION &&
    result?.status === 'authorized' &&
    Object.keys(result).length === 2
  ) return result
  if (
    result?.schemaVersion === STUDY_IDENTITY_SCHEMA_VERSION &&
    result?.status === 'denied'
  ) return DENIED
  return UNAVAILABLE
}

export function isVerifiedStudySessionAuthorizationPort(port) {
  return Boolean(port && VERIFIED_SESSION_AUTHORIZATION_PORTS.has(port))
}

export function isStudySessionAuthorizationPort(port) {
  return isVerifiedStudySessionAuthorizationPort(port) ||
    Boolean(port && TEST_SESSION_AUTHORIZATION_PORTS.has(port))
}

/** Test composition only; production never calls this factory. */
export function createTestStudySessionAuthorizationPort(port) {
  if (!port || typeof port !== 'object') throw new TypeError('test_authorization_port_required')
  TEST_SESSION_AUTHORIZATION_PORTS.add(port)
  return port
}

export function createVerifiedStudySessionAuthorizationPort(options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const actorConfig = actorAuthorizationConfig(env)
  const rpc = createSupabaseServiceRpc(options)

  const port = Object.freeze({
    isReady: () => actorConfig !== null && typeof fetchImpl === 'function' && rpc?.isConfigured?.() === true,
    isDurable: true,
    async resolve({ actorUserId, accessToken, sessionReference, studentRef }) {
      const tokenDigest = digestStudySessionReference(sessionReference)
      if (!validUuid(actorUserId) || typeof accessToken !== 'string' || accessToken === '' || !tokenDigest) {
        return DENIED
      }

      // The adult bearer is presented only to the actor-authorized RPC. That
      // RPC derives auth.uid() from Supabase Auth and proves the current
      // guardian owns this exact Study grant and action capability. The
      // service-role verifier below cannot stand in for this actor check.
      const actorAuthorization = await authorizeActorSession({
        config: actorConfig,
        fetchImpl,
        accessToken,
        tokenDigest,
      })
      if (actorAuthorization?.status !== 'authorized') return actorAuthorization

      let result
      try {
        // Only the digest crosses this boundary; the opaque reference does not.
        result = await rpc.call('academy_study_verify_session_v1', {
          p_token_digest: tokenDigest,
          p_required_capability: REQUIRED_CAPABILITY,
        })
      } catch {
        return UNAVAILABLE
      }
      if (result?.status === 'denied' && result?.schemaVersion === STUDY_IDENTITY_SCHEMA_VERSION) {
        return DENIED
      }
      if (!isVerifiedGrant(result)) return UNAVAILABLE
      if (
        studentRef?.kind === 'academy-student-id' &&
        String(studentRef.value).toLowerCase() !== result.studentId.toLowerCase()
      ) {
        return { status: 'denied', code: 'learner-not-authorized' }
      }

      return {
        status: 'authorized',
        context: Object.freeze({
          actorUserId,
          householdId: result.householdId,
          studentId: result.studentId,
          sessionId: result.learnerSessionId,
        }),
      }
    },
  })
  VERIFIED_SESSION_AUTHORIZATION_PORTS.add(port)
  return port
}
