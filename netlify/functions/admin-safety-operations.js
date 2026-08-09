import { createAdminAuthorization } from './_shared/admin-authorization.js'
import { createAdminSafetyReader, decodeSafetyCursor } from './_shared/admin-safety-reader.js'
import { errorResponse, isRecord, jsonResponse } from './_shared/http.js'

const PATHS = new Set([
  '/api/admin/v1/safety-operations',
  '/.netlify/functions/admin-safety-operations',
])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED_QUERY = new Set(['limit', 'cursor', 'household', 'learner'])

function readQuery(event) {
  const query = isRecord(event?.queryStringParameters) ? event.queryStringParameters : {}
  const multi = isRecord(event?.multiValueQueryStringParameters) ? event.multiValueQueryStringParameters : {}
  if (
    Object.keys(query).some((key) => !ALLOWED_QUERY.has(key))
    || Object.keys(multi).some((key) => !ALLOWED_QUERY.has(key))
    || Object.values(multi).some((values) => !Array.isArray(values) || values.length !== 1)
  ) return null

  const rawLimit = query.limit ?? '50'
  if (typeof rawLimit !== 'string' || !/^[1-9]\d{0,2}$/.test(rawLimit)) return null
  const limit = Number(rawLimit)
  if (!Number.isSafeInteger(limit) || limit > 100) return null

  const householdRef = query.household
  const learnerRef = query.learner
  if (
    (householdRef !== undefined && (typeof householdRef !== 'string' || !UUID.test(householdRef)))
    || (learnerRef !== undefined && (typeof learnerRef !== 'string' || !UUID.test(learnerRef)))
    || (learnerRef !== undefined && householdRef === undefined)
  ) return null

  const cursor = query.cursor === undefined ? null : decodeSafetyCursor(query.cursor)
  if (query.cursor !== undefined && cursor === null) return null
  return { limit, cursor, householdRef, learnerRef }
}

export function createAdminSafetyOperationsHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
  const authorization = overrides.authorization ?? createAdminAuthorization({
    env,
    fetchImpl,
    client: overrides.authorizationClient,
    authVerifier: overrides.authVerifier,
  })
  const reader = overrides.reader ?? createAdminSafetyReader({
    env,
    fetchImpl,
    client: overrides.safetyClient,
  })

  return async (event) => {
    if (event?.httpMethod !== 'GET') return errorResponse(405, 'method_not_allowed', { allow: 'GET' })
    if (!PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')

    const authorized = await authorization.require(event, 'safety:read')
    if (!authorized.ok) return authorized.response

    const query = readQuery(event)
    if (!query) return errorResponse(400, 'invalid_request')
    try {
      return jsonResponse(200, await reader.read(query))
    } catch {
      return errorResponse(503, 'safety_source_unavailable')
    }
  }
}

export const handler = createAdminSafetyOperationsHandler()
