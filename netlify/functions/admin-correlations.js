import { createHash } from 'node:crypto'
import {
  ADMIN_AUDIT_ACTIONS,
  ADMIN_AUDIT_RESOURCE_TYPES,
  ADMIN_CONTRACT_VERSION,
  ADMIN_ENGINE_IDS,
  ADMIN_OPERATIONAL_RESULTS,
} from '../../src/admin/contracts.ts'
import { createAdminAuthorization } from './_shared/admin-authorization.js'
import {
  AdminCorrelationReadError,
  createAdminCorrelationReader,
} from './_shared/admin-correlation-reader.js'
import { errorResponse, jsonResponse, reject, responseForError } from './_shared/http.js'

const PATHS = new Set([
  '/api/admin/v1/correlations',
  '/.netlify/functions/admin-correlations',
])
const ALLOWED_QUERY_KEYS = new Set([
  'correlationId', 'occurredFrom', 'occurredTo', 'domain', 'engine', 'result',
  'auditAction', 'auditResource', 'limit', 'cursor',
])
const DOMAINS = new Set(['all', 'runtime', 'admin-audit', 'provider-accounting'])
const SOURCES = ['runtime', 'admin-audit', 'provider-accounting']
const CAPABILITIES = Object.freeze({
  runtime: 'engines:read',
  'admin-audit': 'audit:read',
  'provider-accounting': 'costs:read',
})
const READER_METHODS = Object.freeze({
  runtime: 'runtime',
  'admin-audit': 'audit',
  'provider-accounting': 'providerAccounting',
})
const SOURCE_ORDER = Object.freeze({ runtime: 0, 'admin-audit': 1, 'provider-accounting': 2 })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CORRELATION = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const SECRET_LIKE = /(?:^|[._:/-])(?:sk|pk|secret|credential|bearer|token|password|jwt|api.?key)(?:[._:/-]|$)|^eyj/i
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/
const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1_000
const DIAGNOSTIC_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000

function entriesFor(event) {
  const raw = typeof event?.rawQueryString === 'string'
    ? event.rawQueryString
    : typeof event?.rawQuery === 'string' ? event.rawQuery : null
  if (raw !== null) return [...new URLSearchParams(raw).entries()]
  const entries = []
  for (const [key, values] of Object.entries(event?.multiValueQueryStringParameters ?? {})) {
    if (!Array.isArray(values)) reject(400, 'invalid_query')
    for (const value of values) entries.push([key, value])
  }
  if (entries.length > 0) return entries
  return Object.entries(event?.queryStringParameters ?? {})
}

function timestamp(value) {
  if (typeof value !== 'string' || value.length > 40 || !TIMESTAMP.test(value)) {
    reject(400, 'invalid_query')
  }
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) reject(400, 'invalid_query')
  return parsed.toISOString()
}

function queryFingerprint(query) {
  return createHash('sha256').update(JSON.stringify(query)).digest('base64url').slice(0, 22)
}

function canonicalCursor(cursor) {
  return {
    queryHash: cursor.queryHash,
    sources: {
      runtime: cursor.sources.runtime,
      'admin-audit': cursor.sources['admin-audit'],
      'provider-accounting': cursor.sources['provider-accounting'],
    },
  }
}

export function encodeCorrelationCursor(cursor) {
  return Buffer.from(JSON.stringify(canonicalCursor(cursor)), 'utf8').toString('base64url')
}

function cursorPosition(value) {
  if (value === null) return null
  if (
    !value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== 'eventId,occurredAt'
    || typeof value.eventId !== 'string' || !UUID.test(value.eventId)
    || typeof value.occurredAt !== 'string' || value.occurredAt.length > 40
  ) reject(400, 'invalid_cursor')
  const occurredAt = new Date(value.occurredAt)
  if (!Number.isFinite(occurredAt.getTime())) reject(400, 'invalid_cursor')
  return { occurredAt: occurredAt.toISOString(), eventId: value.eventId.toLowerCase() }
}

export function decodeCorrelationCursor(encoded, expectedQueryHash) {
  if (typeof encoded !== 'string' || !/^[A-Za-z0-9_-]{1,1536}$/.test(encoded)) {
    reject(400, 'invalid_cursor')
  }
  try {
    const value = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    if (
      !value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).sort().join(',') !== 'queryHash,sources'
      || value.queryHash !== expectedQueryHash
      || !value.sources || typeof value.sources !== 'object' || Array.isArray(value.sources)
      || Object.keys(value.sources).sort().join(',') !== 'admin-audit,provider-accounting,runtime'
    ) reject(400, 'invalid_cursor')
    const decoded = canonicalCursor({
      queryHash: value.queryHash,
      sources: {
        runtime: cursorPosition(value.sources.runtime),
        'admin-audit': cursorPosition(value.sources['admin-audit']),
        'provider-accounting': cursorPosition(value.sources['provider-accounting']),
      },
    })
    if (encodeCorrelationCursor(decoded) !== encoded) reject(400, 'invalid_cursor')
    return decoded.sources
  } catch (error) {
    if (error?.code === 'invalid_cursor') throw error
    reject(400, 'invalid_cursor')
  }
}

export function parseCorrelationQuery(event, now = new Date().toISOString()) {
  const entries = entriesFor(event)
  const values = {}
  const seen = new Set()
  for (const [key, value] of entries) {
    if (!ALLOWED_QUERY_KEYS.has(key) || seen.has(key) || typeof value !== 'string') {
      reject(400, 'invalid_query')
    }
    seen.add(key)
    values[key] = value
  }

  const generatedAt = timestamp(now)
  const hasFrom = values.occurredFrom !== undefined
  const hasTo = values.occurredTo !== undefined
  if (hasFrom !== hasTo) reject(400, 'invalid_query')
  const occurredTo = hasTo ? timestamp(values.occurredTo) : generatedAt
  const occurredFrom = hasFrom
    ? timestamp(values.occurredFrom)
    : new Date(new Date(generatedAt).getTime() - 24 * 60 * 60 * 1_000).toISOString()
  const rangeMs = new Date(occurredTo).getTime() - new Date(occurredFrom).getTime()
  if (rangeMs <= 0 || rangeMs > MAX_RANGE_MS) reject(400, 'invalid_query')

  if (
    values.correlationId !== undefined
    && (!CORRELATION.test(values.correlationId) || SECRET_LIKE.test(values.correlationId))
  ) reject(400, 'invalid_query')
  if (values.domain !== undefined && !DOMAINS.has(values.domain)) reject(400, 'invalid_query')
  if (values.engine !== undefined && !ADMIN_ENGINE_IDS.includes(values.engine)) reject(400, 'invalid_query')
  if (values.result !== undefined && !ADMIN_OPERATIONAL_RESULTS.includes(values.result)) reject(400, 'invalid_query')
  if (values.auditAction !== undefined && !ADMIN_AUDIT_ACTIONS.includes(values.auditAction)) reject(400, 'invalid_query')
  if (values.auditResource !== undefined && !ADMIN_AUDIT_RESOURCE_TYPES.includes(values.auditResource)) reject(400, 'invalid_query')
  if (values.limit !== undefined && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(values.limit)) reject(400, 'invalid_query')

  const query = Object.freeze({
    ...(values.correlationId === undefined ? {} : { correlationId: values.correlationId }),
    occurredFrom,
    occurredTo,
    domain: values.domain ?? 'all',
    ...(values.engine === undefined ? {} : { engine: values.engine }),
    ...(values.result === undefined ? {} : { result: values.result }),
    ...(values.auditAction === undefined ? {} : { auditAction: values.auditAction }),
    ...(values.auditResource === undefined ? {} : { auditResource: values.auditResource }),
    limit: values.limit === undefined ? 50 : Number(values.limit),
  })
  const queryHash = queryFingerprint(query)
  return Object.freeze({
    generatedAt,
    query,
    queryHash,
    cursor: values.cursor === undefined
      ? Object.freeze({ runtime: null, 'admin-audit': null, 'provider-accounting': null })
      : Object.freeze(decodeCorrelationCursor(values.cursor, queryHash)),
  })
}

function selectedSources(domain) {
  return domain === 'all' ? SOURCES : [domain]
}

function descending(left, right) {
  const time = right.occurredAt.localeCompare(left.occurredAt)
  if (time !== 0) return time
  const source = SOURCE_ORDER[right.source] - SOURCE_ORDER[left.source]
  return source !== 0 ? source : right.eventId.localeCompare(left.eventId)
}

function statusForAuthorization(result) {
  const statusCode = result?.response?.statusCode
  if (statusCode === 401 || statusCode === 403) return 'unauthorized'
  if (statusCode === 504) return 'timeout'
  return 'unavailable'
}

function reasonFor(source, status) {
  const prefix = source === 'admin-audit'
    ? 'admin_audit'
    : source === 'provider-accounting' ? 'provider_accounting' : 'runtime'
  return `${prefix}_${status}`
}

export function createAdminCorrelationsHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
  const authorization = overrides.authorization ?? createAdminAuthorization({
    env, fetchImpl, client: overrides.authorizationClient, authVerifier: overrides.authVerifier,
  })
  const reader = overrides.reader ?? createAdminCorrelationReader({
    env, fetchImpl, client: overrides.serviceClient,
  })
  const now = overrides.now ?? (() => new Date().toISOString())

  return async (event) => {
    if (event?.httpMethod !== 'GET') return errorResponse(405, 'method_not_allowed', { allow: 'GET' })
    if (!PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    try {
      const parsed = parseCorrelationQuery(event, now())
      const selected = selectedSources(parsed.query.domain)
      const sourceStatuses = {
        runtime: 'not-requested',
        'admin-audit': 'not-requested',
        'provider-accounting': 'not-requested',
      }

      const authorizationResults = await Promise.all(selected.map(async (source) => {
        try {
          return [source, await authorization.require(event, CAPABILITIES[source])]
        } catch {
          return [source, { ok: false, response: { statusCode: 503 } }]
        }
      }))
      const unauthenticated = authorizationResults.find(([, result]) => result?.response?.statusCode === 401)
      if (unauthenticated) return unauthenticated[1].response

      const authorizedSources = []
      for (const [source, result] of authorizationResults) {
        if (result.ok) authorizedSources.push(source)
        else sourceStatuses[source] = statusForAuthorization(result)
      }
      if (authorizedSources.length === 0) {
        return authorizationResults.every(([, result]) => result?.response?.statusCode === 403)
          ? errorResponse(403, 'correlation_access_denied')
          : errorResponse(503, 'correlation_authorization_unavailable')
      }

      const reads = await Promise.all(authorizedSources.map(async (source) => {
        try {
          const result = await reader[READER_METHODS[source]](parsed.query, parsed.cursor[source])
          return [source, { ok: true, result }]
        } catch (error) {
          const status = error instanceof AdminCorrelationReadError && error.code === 'source_timeout'
            ? 'timeout' : 'unavailable'
          return [source, { ok: false, status }]
        }
      }))

      const results = {}
      for (const [source, outcome] of reads) {
        if (outcome.ok) {
          sourceStatuses[source] = 'available'
          results[source] = outcome.result
        } else {
          sourceStatuses[source] = outcome.status
        }
      }

      const candidates = Object.values(results).flatMap((result) => result.events).sort(descending)
      const consumed = candidates.slice(0, parsed.query.limit)
      const chronological = Object.freeze([...consumed].reverse())
      const positions = { ...parsed.cursor }
      for (const source of authorizedSources) {
        const last = consumed.filter((item) => item.source === source).at(-1)
        if (last) positions[source] = { occurredAt: last.occurredAt, eventId: last.eventId }
      }
      const hasMore = candidates.length > parsed.query.limit
        || Object.values(results).some((result) => result.hasMore)

      const reasons = []
      let rejectedEntries = 0
      for (const source of selected) {
        const status = sourceStatuses[source]
        if (status !== 'available') reasons.push(reasonFor(source, status))
        const rejected = results[source]?.rejectedEntries ?? 0
        rejectedEntries += rejected
        if (rejected > 0) reasons.push(reasonFor(source, 'malformed_entries'))
      }
      if (
        selected.includes('runtime') && sourceStatuses.runtime === 'available'
        && new Date(parsed.query.occurredFrom).getTime()
          < new Date(parsed.generatedAt).getTime() - DIAGNOSTIC_RETENTION_MS
      ) reasons.push('runtime_retention_limited')

      return jsonResponse(200, {
        schemaVersion: ADMIN_CONTRACT_VERSION,
        generatedAt: parsed.generatedAt,
        sortOrder: 'chronological',
        query: parsed.query,
        events: chronological,
        sources: sourceStatuses,
        evidence: {
          status: reasons.length === 0 ? 'complete' : 'partial',
          reasons,
          rejectedEntries,
        },
        nextCursor: hasMore
          ? encodeCorrelationCursor({ queryHash: parsed.queryHash, sources: positions })
          : null,
      })
    } catch (error) {
      return responseForError(error)
    }
  }
}

export const handler = createAdminCorrelationsHandler()
