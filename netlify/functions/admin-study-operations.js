import { decodeStudyOperationsProjection } from '../../src/admin/studyOperationsModel.ts'
import { createAdminAuthorization } from './_shared/admin-authorization.js'
import { createAdminStudyOperationsSource } from './_shared/admin-study-operations-source.js'
import { errorResponse, hasQuery, jsonResponse } from './_shared/http.js'

const PATHS = new Set([
  '/api/admin/v1/study-operations',
  '/.netlify/functions/admin-study-operations',
])

export function createAdminStudyOperationsHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
  const authorization = overrides.authorization ?? createAdminAuthorization({
    env,
    fetchImpl,
    client: overrides.authorizationClient,
    authVerifier: overrides.authVerifier,
  })
  const source = overrides.source ?? createAdminStudyOperationsSource({
    env,
    fetchImpl,
    now: overrides.now,
    readinessService: overrides.readinessService,
    telemetrySource: overrides.telemetrySource,
    telemetryClient: overrides.telemetryClient,
    evidence: overrides.evidence,
  })

  return async (event) => {
    if (event?.httpMethod !== 'GET') return errorResponse(405, 'method_not_allowed', { allow: 'GET' })
    if (!PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')

    let authorized
    try {
      authorized = await authorization.require(event, 'health:read')
    } catch {
      return errorResponse(503, 'authorization_unavailable')
    }
    if (!authorized.ok) return authorized.response

    try {
      const projection = decodeStudyOperationsProjection(await source.read())
      return projection
        ? jsonResponse(200, projection)
        : errorResponse(503, 'study_operations_source_unavailable')
    } catch {
      return errorResponse(503, 'study_operations_source_unavailable')
    }
  }
}

export const handler = createAdminStudyOperationsHandler()
