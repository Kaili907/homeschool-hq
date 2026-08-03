/** Trusted verification, readiness, and self-revocation for Study sessions. */

import {
  assertExactObject,
  envFlagEnabled,
  errorResponse,
  hasQuery,
  jsonResponse,
  readJsonBody,
  responseForError,
} from './_shared/http.js'
import {
  isVerifiedGrant,
  readStudySessionBearer,
  validCapability,
  verifiedGrantEnvelope,
} from './_shared/study-identity/contracts.js'
import { createTrustedStudySessionVerifier } from './_shared/study-identity/supabase.js'

const VERIFY_PATHS = new Set([
  '/api/study/session/verify',
  '/.netlify/functions/study-session-verify',
])
const REVOKE_PATH = '/api/study/session/revoke'
const READINESS_PATH = '/api/study/session/readiness'

export function createStudySessionVerifyHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
  const verifier = overrides.verifier ?? createTrustedStudySessionVerifier({ env, fetchImpl })

  return async (event) => {
    if (!envFlagEnabled(env, 'ACADEMY_STUDY_ENABLED')) return errorResponse(503, 'gateway_disabled')
    try {
      if (event?.httpMethod === 'GET' && event?.path === READINESS_PATH && !hasQuery(event)) {
        if (verifier?.isDurable !== true || verifier?.isReady?.() !== true) {
          return jsonResponse(503, { status: 'not-ready' })
        }
        const readiness = await verifier.readiness()
        const status = readiness?.status === 'ready' ? 'ready' : 'not-ready'
        return jsonResponse(status === 'ready' ? 200 : 503, { status })
      }

      const isVerify = event?.httpMethod === 'POST' && VERIFY_PATHS.has(event?.path ?? '')
      const isRevoke = event?.httpMethod === 'DELETE' && (
        event?.path === REVOKE_PATH ||
        event?.path === '/.netlify/functions/study-session-verify'
      )
      if (!isVerify && !isRevoke) {
        if (!VERIFY_PATHS.has(event?.path ?? '') && event?.path !== REVOKE_PATH) {
          return errorResponse(404, 'not_found')
        }
        return errorResponse(405, 'method_not_allowed', {
          allow: event?.path === REVOKE_PATH ? 'DELETE' : 'POST',
        })
      }
      if (hasQuery(event)) return errorResponse(400, 'invalid_request')
      if (verifier?.isDurable !== true || verifier?.isReady?.() !== true) {
        return errorResponse(503, 'service_not_ready')
      }

      const sessionReference = readStudySessionBearer(event)
      if (!sessionReference) return errorResponse(401, 'student_session_invalid')

      if (isRevoke) {
        const result = await verifier.revoke({ sessionReference })
        return result?.status === 'revoked'
          ? jsonResponse(200, { schemaVersion: 1, status: 'revoked' })
          : errorResponse(503, 'service_not_ready')
      }

      const body = assertExactObject(readJsonBody(event, 256), [
        'schemaVersion',
        'requiredCapability',
      ])
      if (body.schemaVersion !== 1 || !validCapability(body.requiredCapability)) {
        return errorResponse(400, 'invalid_request')
      }
      const result = await verifier.verify({
        sessionReference,
        requiredCapability: body.requiredCapability,
      })
      if (result?.status === 'denied') return errorResponse(401, 'student_session_invalid')
      if (!isVerifiedGrant(result)) return errorResponse(503, 'service_not_ready')
      return jsonResponse(200, verifiedGrantEnvelope(result))
    } catch (error) {
      return responseForError(error)
    }
  }
}

export const handler = createStudySessionVerifyHandler()
