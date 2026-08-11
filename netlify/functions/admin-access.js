import { ADMIN_ROLES } from '../../src/admin/contracts.ts'
import { ADMIN_ACCESS_REASON_CODES } from '../../src/admin/accessModel.ts'
import { createAdminAuthorization } from './_shared/admin-authorization.js'
import {
  AdminAccessSourceError,
  createAdminAccessSource,
} from './_shared/admin-access-source.js'
import {
  assertExactObject,
  errorResponse,
  hasBody,
  hasQuery,
  jsonResponse,
  readJsonBody,
  reject,
  responseForError,
} from './_shared/http.js'

const READ_PATHS = new Set([
  '/api/admin/v1/access',
  '/.netlify/functions/admin-access',
])
const CHANGE_ROLE_PATH = '/api/admin/v1/access/change-role'
const REVOKE_PATH = '/api/admin/v1/access/revoke'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const REVISION = /^[1-9]\d{0,18}$/
const MAX_BIGINT = 9_223_372_036_854_775_807n
const ROLES = new Set(ADMIN_ROLES)
const REASONS = new Set(ADMIN_ACCESS_REASON_CODES)

function parseRevision(value) {
  if (typeof value !== 'string' || !REVISION.test(value) || BigInt(value) > MAX_BIGINT) {
    reject(400, 'invalid_request')
  }
  return value
}

function parseBase(body, optionalKeys = []) {
  assertExactObject(
    body,
    ['assignmentRef', 'expectedRevision', 'reasonCode', 'requestId'],
    optionalKeys,
  )
  if (typeof body.assignmentRef !== 'string' || !UUID.test(body.assignmentRef)
    || typeof body.requestId !== 'string' || !UUID.test(body.requestId)
    || typeof body.reasonCode !== 'string' || !REASONS.has(body.reasonCode)) {
    reject(400, 'invalid_request')
  }
  return {
    assignmentRef: body.assignmentRef.toLowerCase(),
    expectedRevision: parseRevision(body.expectedRevision),
    reasonCode: body.reasonCode,
    requestId: body.requestId.toLowerCase(),
  }
}

export function parseAccessMutationRequest(event, action) {
  const body = readJsonBody(event, 2_048)
  const base = parseBase(body, action === 'change-role' ? ['newRole'] : [])
  if (action === 'change-role') {
    if (typeof body.newRole !== 'string' || !ROLES.has(body.newRole)) {
      reject(400, 'invalid_request')
    }
    return Object.freeze({ ...base, newRole: body.newRole })
  }
  return Object.freeze(base)
}

function errorForSource(error) {
  if (!(error instanceof AdminAccessSourceError)) return responseForError(error)
  if (error.code === 'source_timeout') return errorResponse(504, 'access_source_timeout')
  if (error.code === 'manage_required' || error.code === 'read_required') {
    return errorResponse(403, 'admin_access_denied')
  }
  if (error.code === 'sole_owner_protected') return errorResponse(409, 'sole_owner_protected')
  if (error.code === 'idempotency_conflict') return errorResponse(409, 'idempotency_conflict')
  if (error.code === 'revision_conflict') return errorResponse(409, 'revision_conflict')
  if (error.code === 'invalid_request') return errorResponse(400, 'invalid_request')
  return errorResponse(503, 'access_source_unavailable')
}

export function createAdminAccessHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
  const authorization = overrides.authorization ?? createAdminAuthorization({
    env,
    fetchImpl,
    client: overrides.authorizationClient,
    authVerifier: overrides.authVerifier,
  })
  const source = overrides.source ?? createAdminAccessSource({
    env,
    fetchImpl,
    clientFactory: overrides.clientFactory,
  })

  return async (event) => {
    const path = event?.path ?? ''
    const isRead = event?.httpMethod === 'GET' && READ_PATHS.has(path)
    const isChange = event?.httpMethod === 'POST' && path === CHANGE_ROLE_PATH
    const isRevoke = event?.httpMethod === 'POST' && path === REVOKE_PATH
    if (!isRead && !isChange && !isRevoke) {
      if (READ_PATHS.has(path)) return errorResponse(405, 'method_not_allowed', { allow: 'GET' })
      if (path === CHANGE_ROLE_PATH || path === REVOKE_PATH) {
        return errorResponse(405, 'method_not_allowed', { allow: 'POST' })
      }
      return errorResponse(404, 'not_found')
    }
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')
    if (isRead && hasBody(event)) return errorResponse(400, 'invalid_request')

    const requiredCapability = isRead ? 'overview:read' : 'admin_roles:manage'
    const authorized = await authorization.require(event, requiredCapability)
    if (!authorized.ok) return authorized.response
    try {
      if (isRead) return jsonResponse(200, await source.read(authorized.accessToken))
      const request = parseAccessMutationRequest(event, isChange ? 'change-role' : 'revoke')
      return jsonResponse(200, await source.mutate(authorized.accessToken, request))
    } catch (error) {
      return errorForSource(error)
    }
  }
}

export const handler = createAdminAccessHandler()
