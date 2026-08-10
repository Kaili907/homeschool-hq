import { createClient } from '@supabase/supabase-js'
import {
  ADMIN_AUDIT_ACTIONS,
  ADMIN_AUDIT_RESOURCE_TYPES,
  ADMIN_ENGINE_IDS,
  ADMIN_OPERATIONAL_RESULTS,
  ADMIN_ROLES,
  ADMIN_TELEMETRY_EVENT_TYPES,
  ADMIN_TELEMETRY_METADATA_KEYS,
} from '../../../src/admin/contracts.ts'

const READ_TIMEOUT_MS = 5_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/
const CORRELATION = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,127}$/
const SECRET_LIKE = /(?:^|[._:/-])(?:sk|pk|secret|credential|bearer|token|password|jwt|api.?key)(?:[._:/-]|$)|^eyj/i
const PROHIBITED_FIELD = /(?:raw|messages?|conversation|transcript|prompt|response|audio|speech|emotion|personality|psycholog|diagnos|answer|journal|secret|credential|bearer|token|password|api.?key|contact|email|phone|protected.?work|body|content|error)/i

const ENGINES = new Set(ADMIN_ENGINE_IDS)
const RESULTS = new Set(ADMIN_OPERATIONAL_RESULTS)
const EVENT_TYPES = new Set(ADMIN_TELEMETRY_EVENT_TYPES)
const METADATA_KEYS = new Set(ADMIN_TELEMETRY_METADATA_KEYS)
const ACTIONS = new Set(ADMIN_AUDIT_ACTIONS)
const RESOURCES = new Set(ADMIN_AUDIT_RESOURCE_TYPES)
const ROLES = new Set(ADMIN_ROLES)
const AUDIT_VALUE_KEYS = new Set([
  'value', 'state', 'enabled', 'limit', 'quota', 'model_tier', 'model_tiers',
  'voice', 'version', 'revision', 'role', 'status', 'release',
])

const RUNTIME_KEYS = new Set([
  'event_id', 'execution_key', 'occurred_at', 'engine', 'event_type',
  'result', 'duration_ms', 'metadata',
])
const AUDIT_KEYS = new Set([
  'schemaVersion', 'eventId', 'occurredAt', 'actorRole', 'action',
  'resourceType', 'resourceRef', 'resourceVersion', 'resourceRevision',
  'previousValue', 'newValue', 'reasonCode', 'correlationId',
])
const PROVIDER_KEYS = new Set([
  'id', 'execution_key', 'occurred_at', 'engine', 'provider',
  'provider_product_id', 'logical_model_tier', 'result', 'result_reason_code',
  'billing_disposition', 'cost_kind', 'currency',
])

function serviceConfig(env) {
  const rawUrl = (env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || '').trim()
  const serviceRoleKey = (env?.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' || url.username || url.password || !serviceRoleKey) return null
    return { url: url.toString().replace(/\/+$/, ''), serviceRoleKey }
  } catch {
    return null
  }
}

export class AdminCorrelationReadError extends Error {
  constructor(code) {
    super(code)
    this.name = 'AdminCorrelationReadError'
    this.code = code
  }
}

function malformed() {
  throw new AdminCorrelationReadError('entry_malformed')
}

function plainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function exactKeys(value, expected) {
  if (!plainRecord(value)) malformed()
  const keys = Object.keys(value)
  if (keys.length !== expected.size || keys.some((key) => !expected.has(key))) malformed()
  return value
}

function safeIso(value) {
  if (typeof value !== 'string' || value.length > 40) malformed()
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) malformed()
  return parsed.toISOString()
}

function safeUuid(value) {
  if (typeof value !== 'string' || !UUID.test(value)) malformed()
  return value.toLowerCase()
}

function safeCorrelation(value) {
  if (typeof value !== 'string' || !CORRELATION.test(value) || SECRET_LIKE.test(value)) malformed()
  return value
}

function optionalToken(value) {
  if (value === null) return null
  if (typeof value !== 'string' || !TOKEN.test(value) || SECRET_LIKE.test(value)) malformed()
  return value
}

function safeInteger(value, maximum) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) malformed()
  return value
}

function auditValue(value) {
  if (value === null) return null
  if (!plainRecord(value)) malformed()
  const keys = Object.keys(value)
  if (keys.length < 1 || keys.length > 8 || keys.some((key) => !AUDIT_VALUE_KEYS.has(key))) malformed()
  const projected = {}
  for (const key of keys) {
    const candidate = value[key]
    const values = Array.isArray(candidate) ? candidate : [candidate]
    if (values.length > 16) malformed()
    for (const item of values) {
      if (item === null || typeof item === 'boolean') continue
      if (typeof item === 'number' && Number.isFinite(item) && Math.abs(item) <= 1_000_000_000_000) continue
      if (
        typeof item === 'string' && item.length <= 128 && TOKEN.test(item)
        && !item.includes('://') && !SECRET_LIKE.test(item)
      ) continue
      malformed()
    }
    projected[key] = Array.isArray(candidate) ? Object.freeze([...candidate]) : candidate
  }
  return Object.freeze(projected)
}

function runtimeMetadata(value) {
  if (!plainRecord(value)) malformed()
  const projected = {}
  for (const [key, candidate] of Object.entries(value)) {
    if (PROHIBITED_FIELD.test(key) || !METADATA_KEYS.has(key)) malformed()
    if (candidate === null) {
      projected[key] = null
    } else if (key === 'attempt') {
      projected[key] = safeInteger(candidate, Number.MAX_SAFE_INTEGER)
    } else if (key === 'http_status') {
      const status = safeInteger(candidate, 599)
      if (status < 100) malformed()
      projected[key] = status
    } else if (key === 'cache_hit' || key === 'retryable') {
      if (typeof candidate !== 'boolean') malformed()
      projected[key] = candidate
    } else {
      projected[key] = optionalToken(candidate)
    }
  }
  return projected
}

export function sanitizeRuntimeEntry(value) {
  const row = exactKeys(value, RUNTIME_KEYS)
  const metadata = runtimeMetadata(row.metadata)
  if (!ENGINES.has(row.engine) || !EVENT_TYPES.has(row.event_type) || !RESULTS.has(row.result)) malformed()
  const durationMs = row.duration_ms === null ? null : safeInteger(row.duration_ms, 86_400_000)
  return Object.freeze({
    eventId: safeUuid(row.event_id),
    occurredAt: safeIso(row.occurred_at),
    correlationId: safeCorrelation(row.execution_key),
    source: 'runtime',
    facts: Object.freeze({
      engine: row.engine,
      eventType: row.event_type,
      result: row.result,
      durationMs,
      operation: metadata.operation ?? null,
      reasonCode: metadata.reason_code ?? null,
      provider: metadata.provider ?? null,
      httpStatus: metadata.http_status ?? null,
      failureStage: metadata.failure_stage ?? null,
      retryable: metadata.retryable ?? null,
    }),
  })
}

export function sanitizeAuditEntry(value) {
  const row = exactKeys(value, AUDIT_KEYS)
  if (
    row.schemaVersion !== 2 || !ROLES.has(row.actorRole) || !ACTIONS.has(row.action)
    || !RESOURCES.has(row.resourceType) || typeof row.resourceRef !== 'string'
    || !REFERENCE.test(row.resourceRef)
  ) malformed()
  return Object.freeze({
    eventId: safeUuid(row.eventId),
    occurredAt: safeIso(row.occurredAt),
    correlationId: safeUuid(row.correlationId),
    source: 'admin-audit',
    facts: Object.freeze({
      actorRole: row.actorRole,
      action: row.action,
      resourceType: row.resourceType,
      resourceRef: row.resourceRef,
      resourceVersion: optionalToken(row.resourceVersion),
      resourceRevision: optionalToken(row.resourceRevision),
      previousValue: auditValue(row.previousValue),
      newValue: auditValue(row.newValue),
      reasonCode: optionalToken(row.reasonCode),
    }),
  })
}

export function sanitizeProviderEntry(value) {
  const row = exactKeys(value, PROVIDER_KEYS)
  if (
    !ENGINES.has(row.engine) || !RESULTS.has(row.result)
    || !['billable', 'not_billable', 'unknown'].includes(row.billing_disposition)
    || !['calculated', 'reconciled', 'unavailable'].includes(row.cost_kind)
    || row.currency !== 'USD'
  ) malformed()
  const provider = optionalToken(row.provider)
  const providerProductId = optionalToken(row.provider_product_id)
  if (provider === null || providerProductId === null) malformed()
  return Object.freeze({
    eventId: safeUuid(row.id),
    occurredAt: safeIso(row.occurred_at),
    correlationId: safeCorrelation(row.execution_key),
    source: 'provider-accounting',
    facts: Object.freeze({
      engine: row.engine,
      provider,
      providerProductId,
      logicalModelTier: optionalToken(row.logical_model_tier),
      result: row.result,
      resultReasonCode: optionalToken(row.result_reason_code),
      billingDisposition: row.billing_disposition,
      costKind: row.cost_kind,
      currency: 'USD',
    }),
  })
}

export function sanitizeCorrelationRows(rows, sanitizer, sourceHasMore = false, sourceLimit = 100) {
  if (!Array.isArray(rows)) throw new AdminCorrelationReadError('source_unavailable')
  const events = []
  let rejectedEntries = 0
  for (const row of rows.slice(0, sourceLimit + 1)) {
    try {
      events.push(sanitizer(row))
    } catch (error) {
      if (!(error instanceof AdminCorrelationReadError) || error.code !== 'entry_malformed') throw error
      rejectedEntries += 1
    }
  }
  return Object.freeze({
    events: Object.freeze(events.slice(0, sourceLimit + 1)),
    rejectedEntries,
    hasMore: events.length > 0 && (sourceHasMore || rows.length > sourceLimit),
  })
}

function olderThan(builder, cursor, timestampColumn, idColumn) {
  if (!cursor) return builder
  return builder.or(
    `${timestampColumn}.lt.${cursor.occurredAt},and(${timestampColumn}.eq.${cursor.occurredAt},${idColumn}.lt.${cursor.eventId})`,
  )
}

async function readBuilder(builder, signal) {
  const pending = typeof builder.abortSignal === 'function' ? builder.abortSignal(signal) : builder
  const { data, error } = await pending
  if (signal.aborted) throw new AdminCorrelationReadError('source_timeout')
  if (error) throw new AdminCorrelationReadError('source_unavailable')
  return data
}

function boundedRead(task) {
  return async (...args) => {
    const signal = AbortSignal.timeout(READ_TIMEOUT_MS)
    try {
      return await task(signal, ...args)
    } catch (error) {
      if (error instanceof AdminCorrelationReadError && error.code !== 'entry_malformed') throw error
      throw new AdminCorrelationReadError(signal.aborted ? 'source_timeout' : 'source_unavailable')
    }
  }
}

/** Service-only, field-minimized reads from the existing operational ledgers. */
export function createAdminCorrelationReader({ env, fetchImpl, client } = {}) {
  let serviceClient = client
  function getClient() {
    if (serviceClient) return serviceClient
    const config = serviceConfig(env)
    if (!config) throw new AdminCorrelationReadError('source_unavailable')
    serviceClient = createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { fetch: fetchImpl },
    })
    return serviceClient
  }

  const runtime = boundedRead(async (signal, query, cursor) => {
    const { data, error } = await getClient().rpc('academy_admin_read_incident_runtime_v1', {
      p_limit: query.limit,
      p_before_at: cursor?.occurredAt ?? null,
      p_before_event_id: cursor?.eventId ?? null,
      p_occurred_from: query.occurredFrom,
      p_occurred_to: query.occurredTo,
      p_correlation_id: query.correlationId ?? null,
      p_engine: query.engine ?? null,
      p_result: query.result ?? null,
      p_required_capability: 'engines:read',
    }).abortSignal(signal)
    if (signal.aborted) throw new AdminCorrelationReadError('source_timeout')
    if (error || !plainRecord(data) || data.schemaVersion !== 2
      || !Array.isArray(data.events) || typeof data.hasMore !== 'boolean') {
      throw new AdminCorrelationReadError('source_unavailable')
    }
    return sanitizeCorrelationRows(data.events, sanitizeRuntimeEntry, data.hasMore, query.limit)
  })

  const audit = boundedRead(async (signal, query, cursor) => {
    if (query.correlationId && !UUID.test(query.correlationId)) {
      return Object.freeze({ events: Object.freeze([]), rejectedEntries: 0, hasMore: false })
    }
    const { data, error } = await getClient().rpc('academy_admin_read_audit_events_v1', {
      p_limit: query.limit,
      p_before_at: cursor?.occurredAt ?? null,
      p_before_event_id: cursor?.eventId ?? null,
      p_action: query.auditAction ?? null,
      p_resource_type: query.auditResource ?? null,
      p_resource_ref: null,
      p_required_capability: 'audit:read',
      p_actor_role: null,
      p_occurred_from: query.occurredFrom,
      p_occurred_to: query.occurredTo,
      p_correlation_id: query.correlationId ?? null,
      p_reason_code: null,
    }).abortSignal(signal)
    if (signal.aborted) throw new AdminCorrelationReadError('source_timeout')
    if (error || !plainRecord(data) || data.schemaVersion !== 2
      || !Array.isArray(data.events) || typeof data.hasMore !== 'boolean') {
      throw new AdminCorrelationReadError('source_unavailable')
    }
    return sanitizeCorrelationRows(data.events, sanitizeAuditEntry, data.hasMore, query.limit)
  })

  const providerAccounting = boundedRead(async (signal, query, cursor) => {
    let builder = getClient().from('academy_provider_usage_ledger')
      .select('id,execution_key,occurred_at,engine,provider,provider_product_id,logical_model_tier,result,result_reason_code,billing_disposition,cost_kind,currency')
      .gte('occurred_at', query.occurredFrom).lt('occurred_at', query.occurredTo)
      .order('occurred_at', { ascending: false }).order('id', { ascending: false })
      .limit(query.limit + 1)
    if (query.correlationId) builder = builder.eq('execution_key', query.correlationId)
    if (query.engine) builder = builder.eq('engine', query.engine)
    if (query.result) builder = builder.eq('result', query.result)
    builder = olderThan(builder, cursor, 'occurred_at', 'id')
    return sanitizeCorrelationRows(await readBuilder(builder, signal), sanitizeProviderEntry, false, query.limit)
  })

  return Object.freeze({ runtime, audit, providerAccounting })
}
