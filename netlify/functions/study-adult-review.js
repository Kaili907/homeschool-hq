/** Authenticated adult-review worker boundary. No production worker is wired in Session 14. */

import { assertExactObject, envFlagEnabled, errorResponse, hasQuery, jsonResponse, readJsonBody, responseForError } from './_shared/http.js'
import { createAdminAuthorization } from './_shared/admin-authorization.js'

const PROCESS_PATHS = new Set(['/api/study/adult-review/process', '/.netlify/functions/study-adult-review'])
const READINESS_PATH = '/api/study/adult-review/readiness'

export function createStudyAdultReviewHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
  const authorization = overrides.authorization ?? createAdminAuthorization({
    env,
    fetchImpl,
    client: overrides.authorizationClient,
    authVerifier: overrides.authVerifier,
  })
  const workerAuthorization = overrides.workerAuthorization
  const worker = overrides.worker
  const ready = () => Boolean(
    workerAuthorization?.isReady?.() &&
    workerAuthorization?.isDurable === true &&
    typeof workerAuthorization.authorize === 'function' &&
    worker?.isReady?.() &&
    worker?.isDurable === true &&
    typeof worker.process === 'function',
  )

  return async (event) => {
    if (!envFlagEnabled(env, 'ACADEMY_STUDY_ENABLED')) return errorResponse(503, 'gateway_disabled')
    if (event?.httpMethod === 'GET' && event?.path === READINESS_PATH && !hasQuery(event)) {
      let authorized
      try {
        authorized = await authorization.require(event, 'health:read')
      } catch {
        return errorResponse(503, 'authorization_unavailable')
      }
      if (!authorized.ok) return authorized.response
      const isReady = ready()
      return jsonResponse(isReady ? 200 : 503, { status: isReady ? 'ready' : 'not-ready' })
    }
    if (event?.httpMethod !== 'POST') return errorResponse(405, 'method_not_allowed', { allow: 'POST' })
    if (!PROCESS_PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')
    try {
      const authorizedStaff = await authorization.require(event, 'engines:operate')
      if (!authorizedStaff.ok) return authorizedStaff.response
      if (!ready()) return errorResponse(503, 'service_not_ready')
      const body = assertExactObject(readJsonBody(event, 1024), ['schemaVersion', 'action'])
      if (body.schemaVersion !== 1 || body.action !== 'process-pending') return errorResponse(400, 'invalid_request')
      const authorized = await workerAuthorization.authorize({
        actorUserId: authorizedStaff.principal.userId,
        accessToken: authorizedStaff.accessToken,
      })
      if (!authorized) return errorResponse(403, 'not_authorized')
      await worker.process()
      return jsonResponse(200, { status: 'processed' })
    } catch (error) {
      return responseForError(error)
    }
  }
}

export const handler = createStudyAdultReviewHandler()
