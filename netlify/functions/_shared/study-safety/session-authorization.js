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

const DENIED = Object.freeze({ status: 'denied', code: 'student-session-invalid' })
const UNAVAILABLE = Object.freeze({ status: 'unavailable', code: 'learner-authorization-unavailable' })

export function createVerifiedStudySessionAuthorizationPort(options = {}) {
  const rpc = options.rpc ?? createSupabaseServiceRpc(options)

  return Object.freeze({
    isReady: () => rpc?.isConfigured?.() === true,
    isDurable: true,
    verifiesSession: true,
    async resolve({ actorUserId, sessionReference, studentRef }) {
      const tokenDigest = digestStudySessionReference(sessionReference)
      if (!validUuid(actorUserId) || !tokenDigest) return DENIED

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
}
