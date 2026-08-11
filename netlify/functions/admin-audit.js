import {
  ADMIN_AUDIT_ACTIONS,
  ADMIN_AUDIT_RESOURCE_TYPES,
  ADMIN_CONTRACT_VERSION,
  ADMIN_ROLES,
} from '../../src/admin/contracts.ts'
import { createAdminAuthorization } from './_shared/admin-authorization.js'
import { AdminAuditReadError, createAdminAuditReader } from './_shared/admin-audit-reader.js'
import { errorResponse, hasBody, jsonResponse, readQueryEntries, reject, responseForError } from './_shared/http.js'

const PATHS = new Set(['/api/admin/v1/audit', '/.netlify/functions/admin-audit'])
const ALLOWED_QUERY_KEYS = new Set([
  'occurredFrom', 'occurredTo', 'action', 'resourceType', 'resourceRef',
  'actorRole', 'reasonCode', 'correlationId', 'limit', 'cursor',
])
const ACTIONS = new Set(ADMIN_AUDIT_ACTIONS)
const RESOURCE_TYPES = new Set(ADMIN_AUDIT_RESOURCE_TYPES)
const ROLES = new Set(ADMIN_ROLES)
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/

function parseTimestamp(value) {
  if (typeof value !== 'string' || value.length > 40 || !TIMESTAMP.test(value)) {
    reject(400, 'invalid_query')
  }
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) reject(400, 'invalid_query')
  return parsed.toISOString()
}

function entriesFor(event) {
  return readQueryEntries(event, 'invalid_query')
}

export function decodeAuditCursor(encoded) {
  if (typeof encoded !== 'string' || !/^[A-Za-z0-9_-]{1,512}$/.test(encoded)) {
    reject(400, 'invalid_cursor')
  }
  try {
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    if (
      !decoded || typeof decoded !== 'object' || Array.isArray(decoded)
      || Object.keys(decoded).sort().join(',') !== 'eventId,occurredAt'
      || typeof decoded.eventId !== 'string' || !UUID.test(decoded.eventId)
      || typeof decoded.occurredAt !== 'string' || decoded.occurredAt.length > 40
    ) reject(400, 'invalid_cursor')
    const occurredAt = new Date(decoded.occurredAt)
    if (!Number.isFinite(occurredAt.getTime())) reject(400, 'invalid_cursor')
    const canonical = { occurredAt: occurredAt.toISOString(), eventId: decoded.eventId.toLowerCase() }
    if (encodeAuditCursor(canonical) !== encoded) reject(400, 'invalid_cursor')
    return canonical
  } catch (error) {
    if (error?.code === 'invalid_cursor') throw error
    reject(400, 'invalid_cursor')
  }
}

export function encodeAuditCursor(cursor) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

export function parseAuditQuery(event) {
  const entries = entriesFor(event)
  const seen = new Set()
  const values = {}
  for (const [key, value] of entries) {
    if (!ALLOWED_QUERY_KEYS.has(key) || seen.has(key) || typeof value !== 'string') {
      reject(400, 'invalid_query')
    }
    seen.add(key)
    values[key] = value
  }
  if (values.action !== undefined && !ACTIONS.has(values.action)) reject(400, 'invalid_query')
  if (values.resourceType !== undefined && !RESOURCE_TYPES.has(values.resourceType)) reject(400, 'invalid_query')
  if (values.resourceRef !== undefined && !REFERENCE.test(values.resourceRef)) reject(400, 'invalid_query')
  if (values.actorRole !== undefined && !ROLES.has(values.actorRole)) reject(400, 'invalid_query')
  if (values.reasonCode !== undefined && !TOKEN.test(values.reasonCode)) reject(400, 'invalid_query')
  if (values.correlationId !== undefined && !UUID.test(values.correlationId)) reject(400, 'invalid_query')
  if (values.limit !== undefined && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(values.limit)) reject(400, 'invalid_query')
  const occurredFrom = values.occurredFrom === undefined ? undefined : parseTimestamp(values.occurredFrom)
  const occurredTo = values.occurredTo === undefined ? undefined : parseTimestamp(values.occurredTo)
  if (occurredFrom && occurredTo && occurredFrom > occurredTo) reject(400, 'invalid_query')
  return Object.freeze({
    occurredFrom,
    occurredTo,
    action: values.action,
    resourceType: values.resourceType,
    resourceRef: values.resourceRef,
    actorRole: values.actorRole,
    reasonCode: values.reasonCode,
    correlationId: values.correlationId?.toLowerCase(),
    limit: values.limit === undefined ? 50 : Number(values.limit),
    cursor: values.cursor === undefined ? undefined : decodeAuditCursor(values.cursor),
  })
}

export function createAdminAuditHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
  const authorization = overrides.authorization ?? createAdminAuthorization({
    env, fetchImpl, client: overrides.authorizationClient, authVerifier: overrides.authVerifier,
  })
  const reader = overrides.reader ?? createAdminAuditReader({
    env, fetchImpl, client: overrides.serviceClient,
  })
  return async (event) => {
    if (event?.httpMethod !== 'GET') return errorResponse(405, 'method_not_allowed', { allow: 'GET' })
    if (!PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (hasBody(event)) return errorResponse(400, 'invalid_request')
    const authorized = await authorization.require(event, 'audit:read')
    if (!authorized.ok) return authorized.response
    try {
      const query = parseAuditQuery(event)
      const result = await reader.list(query)
      const last = result.events.at(-1)
      return jsonResponse(200, {
        schemaVersion: ADMIN_CONTRACT_VERSION,
        events: result.events,
        nextCursor: result.hasMore && last
          ? encodeAuditCursor({ occurredAt: last.occurredAt, eventId: last.eventId })
          : null,
      })
    } catch (error) {
      if (error instanceof AdminAuditReadError) {
        const timeout = error.code === 'source_timeout'
        const incomplete = error.code === 'source_limit'
        return errorResponse(
          timeout ? 504 : 503,
          timeout ? 'audit_source_timeout' : incomplete ? 'audit_source_incomplete' : 'audit_source_unavailable',
        )
      }
      return responseForError(error)
    }
  }
}

export const handler = createAdminAuditHandler()
