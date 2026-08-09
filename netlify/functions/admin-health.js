import { createAdminAuthorization } from './_shared/admin-authorization.js'
import {
  createAdminHealthSource,
  disabledHealthEngines,
} from './_shared/admin-health-source.js'
import { errorResponse, jsonResponse } from './_shared/http.js'
import {
  SYSTEM_HEALTH_WINDOWS,
  buildSystemHealthProjection,
} from '../../src/admin/systemHealth.ts'

const ADMIN_HEALTH_PATHS = new Set([
  '/api/admin/v1/health',
  '/.netlify/functions/admin-health',
])

function selectedWindow(event) {
  const query = event?.queryStringParameters
  if (query === null || query === undefined) return '1h'
  if (!query || typeof query !== 'object' || Array.isArray(query)) return null
  if (Object.keys(query).some((key) => key !== 'window')) return null
  const value = query.window ?? '1h'
  return SYSTEM_HEALTH_WINDOWS.includes(value) ? value : null
}

export function createAdminHealthHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const authorization = overrides.authorization ?? createAdminAuthorization({
    env,
    fetchImpl: overrides.fetchImpl ?? globalThis.fetch,
    client: overrides.authorizationClient,
    authVerifier: overrides.authVerifier,
  })
  const source = overrides.source ?? createAdminHealthSource({
    env,
    fetchImpl: overrides.fetchImpl ?? globalThis.fetch,
    client: overrides.telemetryClient,
  })
  const now = overrides.now ?? (() => new Date())

  return async (event) => {
    if (event?.httpMethod !== 'GET') return errorResponse(405, 'method_not_allowed', { allow: 'GET' })
    if (!ADMIN_HEALTH_PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    const window = selectedWindow(event)
    if (window === null) return errorResponse(400, 'invalid_request')

    let authorized
    try {
      authorized = await authorization.require(event, 'health:read')
    } catch {
      return errorResponse(503, 'authorization_unavailable')
    }
    if (!authorized.ok) return authorized.response

    try {
      const evidence = await source.list()
      const projection = buildSystemHealthProjection(evidence.events, {
        now: now(),
        selectedWindow: window,
        disabledEngines: overrides.disabledEngines ?? disabledHealthEngines(env),
        sourceTruncated: evidence.sourceTruncated,
        rejectedRows: evidence.rejectedRows,
      })
      return jsonResponse(200, projection)
    } catch {
      return errorResponse(503, 'health_source_unavailable')
    }
  }
}

export const handler = createAdminHealthHandler()
