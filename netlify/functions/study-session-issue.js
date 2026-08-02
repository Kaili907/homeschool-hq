/** Verified guardian launch boundary for a short-lived Study learner session. */

import {
  assertExactObject,
  boundedString,
  errorResponse,
  hasQuery,
  jsonResponse,
  readJsonBody,
  responseForError,
} from './_shared/http.js'
import { verifySupabaseBearer } from './_shared/supabase-auth.js'
import {
  isIssuedGrant,
  validOpaqueId,
  validUuid,
} from './_shared/study-identity/contracts.js'
import { createGuardianStudySessionIssuer } from './_shared/study-identity/supabase.js'

const ISSUE_PATHS = new Set([
  '/api/study/session/issue',
  '/.netlify/functions/study-session-issue',
])

export function createStudySessionIssueHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
  const authVerifier = overrides.authVerifier ?? verifySupabaseBearer
  const issuer = overrides.issuer ?? createGuardianStudySessionIssuer({ env, fetchImpl })

  return async (event) => {
    if (event?.httpMethod !== 'POST') return errorResponse(405, 'method_not_allowed', { allow: 'POST' })
    if (!ISSUE_PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')

    try {
      const auth = await authVerifier(event, { fetchImpl, env, timeoutMs: 3_000 })
      if (!auth.ok) return auth.response
      if (issuer?.isDurable !== true || issuer?.isReady?.() !== true) {
        return errorResponse(503, 'service_not_ready')
      }

      const body = assertExactObject(readJsonBody(event, 512), [
        'schemaVersion',
        'selectedStudentRef',
      ])
      const selector = assertExactObject(body.selectedStudentRef, ['kind', 'value'])
      const selectorValue = boundedString(selector.value, { max: 128, singleLine: true })
      if (
        body.schemaVersion !== 1 ||
        !(
          (selector.kind === 'academy-student-id' && validUuid(selectorValue)) ||
          (selector.kind === 'legacy-profile-id' && validOpaqueId(selectorValue))
        )
      ) return errorResponse(400, 'invalid_request')

      const result = await issuer.issue({
        accessToken: auth.accessToken,
        selectedStudentRef: { kind: selector.kind, value: selectorValue },
      })
      if (result?.status === 'denied') return errorResponse(403, 'learner_unavailable')
      if (!isIssuedGrant(result)) return errorResponse(503, 'service_not_ready')

      // The raw opaque reference is returned once. The client contract keeps it
      // in memory and never copies it into localStorage or sessionStorage.
      return jsonResponse(201, result)
    } catch (error) {
      return responseForError(error)
    }
  }
}

export const handler = createStudySessionIssueHandler()
