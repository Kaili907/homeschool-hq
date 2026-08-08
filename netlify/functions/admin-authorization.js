import {
  adminAuthorizationWire,
  createAdminAuthorization,
} from './_shared/admin-authorization.js'
import { errorResponse, hasQuery, jsonResponse } from './_shared/http.js'

const ADMIN_AUTHORIZATION_PATHS = new Set([
  '/api/admin/v1/authorization',
  '/.netlify/functions/admin-authorization',
])

export function createAdminAuthorizationHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
  const authorization = overrides.authorization ?? createAdminAuthorization({
    env,
    fetchImpl,
    client: overrides.client,
    authVerifier: overrides.authVerifier,
  })

  return async (event) => {
    if (event?.httpMethod !== 'GET') {
      return errorResponse(405, 'method_not_allowed', { allow: 'GET' })
    }
    if (!ADMIN_AUTHORIZATION_PATHS.has(event?.path ?? '')) {
      return errorResponse(404, 'not_found')
    }
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')

    const result = await authorization.require(event, 'admin:read')
    if (!result.ok) return result.response
    return jsonResponse(200, adminAuthorizationWire(result.principal))
  }
}

export const handler = createAdminAuthorizationHandler()
