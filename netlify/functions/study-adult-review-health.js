import { envFlagEnabled, errorResponse, hasQuery, jsonResponse } from './_shared/http.js'
import { createAdminAuthorization } from './_shared/admin-authorization.js'

const PATHS = new Set([
  '/api/study/adult-review/health',
  '/.netlify/functions/study-adult-review-health',
])

export function createStudyAdultReviewHealthHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
  const authorization = overrides.authorization ?? createAdminAuthorization({
    env,
    fetchImpl,
    client: overrides.authorizationClient,
    authVerifier: overrides.authVerifier,
  })
  const readiness = overrides.readiness
  return async (event) => {
    if (!envFlagEnabled(env, 'ACADEMY_STUDY_ENABLED')) return errorResponse(503, 'gateway_disabled')
    if (!PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (event?.httpMethod !== 'GET') return errorResponse(405, 'method_not_allowed', { allow: 'GET' })
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')
    let authorized
    try {
      authorized = await authorization.require(event, 'health:read')
    } catch {
      return errorResponse(503, 'authorization_unavailable')
    }
    if (!authorized.ok) return authorized.response
    if (readiness?.isDurable !== true || readiness?.isReady?.() !== true) {
      return jsonResponse(503, { state: 'not-ready', schemaVersion: 2 })
    }
    try {
      const result = await readiness.evaluate()
      const state = ['ready', 'not-ready', 'degraded'].includes(result?.state)
        ? result.state : 'not-ready'
      return jsonResponse(state === 'ready' ? 200 : 503, { state, schemaVersion: 2 })
    } catch {
      return jsonResponse(503, { state: 'not-ready', schemaVersion: 2 })
    }
  }
}

export const handler = createStudyAdultReviewHealthHandler()
