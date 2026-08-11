import { createClient } from '@supabase/supabase-js'
import {
  ADMIN_AUDIT_ACTIONS,
  ADMIN_AUDIT_RESOURCE_TYPES,
  ADMIN_CONTRACT_VERSION,
  ADMIN_ROLES,
} from '../../../src/admin/contracts.ts'

const READ_TIMEOUT_MS = 5_000
const ACTIONS = new Set(ADMIN_AUDIT_ACTIONS)
const RESOURCE_TYPES = new Set(ADMIN_AUDIT_RESOURCE_TYPES)
const ROLES = new Set(ADMIN_ROLES)
const LEGACY_VALUE_KEYS = new Set([
  'value', 'state', 'enabled', 'limit', 'quota', 'model_tier', 'model_tiers',
  'voice', 'version', 'revision', 'role', 'status', 'release',
])
const ENTITY_VALUE_KEYS = new Set([
  'entity_ref', 'entity_type', 'draft_revision', 'position', 'status', 'tombstoned', 'digest',
])
const COLLABORATOR_VALUE_KEYS = new Set(['collaborator_ref', 'role', 'status'])
const DIGEST = /^[0-9a-f]{64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/

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

export class AdminAuditReadError extends Error {
  constructor(code) {
    super(code)
    this.name = 'AdminAuditReadError'
    this.code = code
  }
}

function fail() {
  throw new AdminAuditReadError('source_unavailable')
}

function safeIso(value) {
  if (typeof value !== 'string' || value.length > 40) fail()
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) fail()
  return date.toISOString()
}

function isSafeToken(value) {
  return typeof value === 'string' && value.length <= 128 && TOKEN.test(value)
    && !value.includes('://')
    && !/(?:^|[._:/-])(?:sk|pk|secret|credential|bearer|token|password|jwt|api.?key)(?:[._:/-]|$)|^eyj/i.test(value)
}

function curriculumValueKeys(action) {
  if (action.startsWith('curriculum_entity.')) return ENTITY_VALUE_KEYS
  if (action.startsWith('curriculum_draft.collaborator.')) return COLLABORATOR_VALUE_KEYS
  return null
}

function isSafeCurriculumValue(key, value) {
  if (['entity_ref', 'entity_type', 'collaborator_ref', 'role', 'status'].includes(key)) {
    return isSafeToken(value)
  }
  if (key === 'draft_revision' || key === 'position') {
    return typeof value === 'number' && Number.isInteger(value)
      && value >= 0 && value <= 1_000_000_000_000
  }
  if (key === 'tombstoned') return typeof value === 'boolean'
  return key === 'digest' && typeof value === 'string' && DIGEST.test(value)
}

function safeValue(action, value) {
  if (value === null) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail()
  const keys = Object.keys(value)
  const curriculumKeys = curriculumValueKeys(action)
  const allowedKeys = curriculumKeys ?? LEGACY_VALUE_KEYS
  if (keys.length < 1 || keys.length > allowedKeys.size || keys.some((key) => !allowedKeys.has(key))) fail()
  if (curriculumKeys === COLLABORATOR_VALUE_KEYS && !keys.includes('collaborator_ref')) fail()
  const result = {}
  for (const key of keys) {
    const candidate = value[key]
    if (curriculumKeys) {
      if (Array.isArray(candidate) || !isSafeCurriculumValue(key, candidate)) fail()
      result[key] = candidate
      continue
    }
    const values = Array.isArray(candidate) ? candidate : [candidate]
    if (values.length > 16) fail()
    for (const item of values) {
      if (item === null || typeof item === 'boolean') continue
      if (typeof item === 'number' && Number.isFinite(item) && Math.abs(item) <= 1_000_000_000_000) continue
      if (isSafeToken(item)) continue
      fail()
    }
    result[key] = Array.isArray(candidate) ? Object.freeze([...candidate]) : candidate
  }
  return Object.freeze(result)
}

function safeEvent(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) fail()
  if (
    row.schemaVersion !== ADMIN_CONTRACT_VERSION
    || typeof row.eventId !== 'string' || !UUID.test(row.eventId)
    || !ROLES.has(row.actorRole)
    || !ACTIONS.has(row.action)
    || !RESOURCE_TYPES.has(row.resourceType)
    || typeof row.resourceRef !== 'string' || !REFERENCE.test(row.resourceRef)
    || (row.resourceVersion !== null && (typeof row.resourceVersion !== 'string' || !TOKEN.test(row.resourceVersion)))
    || (row.resourceRevision !== null && (typeof row.resourceRevision !== 'string' || !TOKEN.test(row.resourceRevision)))
    || (row.reasonCode !== null && (typeof row.reasonCode !== 'string' || !TOKEN.test(row.reasonCode)))
    || typeof row.correlationId !== 'string' || !UUID.test(row.correlationId)
  ) fail()
  return Object.freeze({
    schemaVersion: ADMIN_CONTRACT_VERSION,
    eventId: row.eventId.toLowerCase(),
    occurredAt: safeIso(row.occurredAt),
    actorRole: row.actorRole,
    action: row.action,
    resourceType: row.resourceType,
    resourceRef: row.resourceRef,
    resourceVersion: row.resourceVersion,
    resourceRevision: row.resourceRevision,
    previousValue: safeValue(row.action, row.previousValue),
    newValue: safeValue(row.action, row.newValue),
    reasonCode: row.reasonCode,
    correlationId: row.correlationId.toLowerCase(),
  })
}

function safeProjection(data, limit) {
  if (data && typeof data === 'object' && Array.isArray(data.events) && data.events.length > limit) {
    throw new AdminAuditReadError('source_limit')
  }
  if (
    !data || typeof data !== 'object' || Array.isArray(data)
    || data.schemaVersion !== ADMIN_CONTRACT_VERSION
    || !Array.isArray(data.events)
    || typeof data.hasMore !== 'boolean'
  ) fail()
  return Object.freeze({
    events: Object.freeze(data.events.map(safeEvent)),
    hasMore: data.hasMore,
  })
}

/** Service-only reader for the minimized Admin audit projection. */
export function createAdminAuditReader({ env, fetchImpl, client } = {}) {
  let serviceClient = client
  function getClient() {
    if (serviceClient) return serviceClient
    const config = serviceConfig(env)
    if (!config) throw new AdminAuditReadError('source_unavailable')
    serviceClient = createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { fetch: fetchImpl },
    })
    return serviceClient
  }

  return Object.freeze({
    async list(query) {
      const signal = AbortSignal.timeout(READ_TIMEOUT_MS)
      try {
        const builder = getClient().rpc('academy_admin_read_audit_events_v1', {
          p_limit: query.limit,
          p_before_at: query.cursor?.occurredAt ?? null,
          p_before_event_id: query.cursor?.eventId ?? null,
          p_action: query.action ?? null,
          p_resource_type: query.resourceType ?? null,
          p_resource_ref: query.resourceRef ?? null,
          p_required_capability: 'audit:read',
          p_actor_role: query.actorRole ?? null,
          p_occurred_from: query.occurredFrom ?? null,
          p_occurred_to: query.occurredTo ?? null,
          p_correlation_id: query.correlationId ?? null,
          p_reason_code: query.reasonCode ?? null,
        })
        const { data, error } = typeof builder.abortSignal === 'function'
          ? await builder.abortSignal(signal)
          : await builder
        if (signal.aborted) throw new AdminAuditReadError('source_timeout')
        if (error) throw new AdminAuditReadError('source_unavailable')
        return safeProjection(data, query.limit)
      } catch (error) {
        if (error instanceof AdminAuditReadError) throw error
        throw new AdminAuditReadError(signal.aborted ? 'source_timeout' : 'source_unavailable')
      }
    },
  })
}
