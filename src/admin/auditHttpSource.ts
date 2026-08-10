import { getGatewayAccessToken } from '../tutor/gatewayAuth'
import {
  ADMIN_AUDIT_ACTIONS,
  ADMIN_AUDIT_RESOURCE_TYPES,
  ADMIN_ROLES,
} from './contracts'
import type { AdminAuditFilters, AdminAuditLogEvent, AdminAuditPage } from './auditLogModel'

const ACTIONS = new Set<string>(ADMIN_AUDIT_ACTIONS)
const RESOURCE_TYPES = new Set<string>(ADMIN_AUDIT_RESOURCE_TYPES)
const ROLES = new Set<string>(ADMIN_ROLES)
const VALUE_KEYS = new Set([
  'value', 'state', 'enabled', 'limit', 'quota', 'model_tier', 'model_tiers',
  'voice', 'version', 'revision', 'role', 'status', 'release',
])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/

export class AdminAuditReadError extends Error {
  constructor(readonly code:
    | 'audit_unauthorized'
    | 'audit_unavailable'
    | 'audit_timeout'
    | 'audit_malformed'
    | 'invalid_query') {
    super(code)
    this.name = 'AdminAuditReadError'
  }
}

function malformed(): never {
  throw new AdminAuditReadError('audit_malformed')
}

interface ReadOptions {
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
  readonly getAccessToken?: () => Promise<string | null>
  readonly fetchImpl?: typeof fetch
}

function safeValue(value: unknown): AdminAuditLogEvent['previousValue'] {
  if (value === null) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) malformed()
  const source = value as Record<string, unknown>
  const keys = Object.keys(source)
  if (keys.length < 1 || keys.length > 8 || keys.some((key) => !VALUE_KEYS.has(key))) {
    malformed()
  }
  const result: Record<string, string | number | boolean | null | readonly (string | number | boolean | null)[]> = {}
  for (const key of keys) {
    const candidate = source[key]
    const values = Array.isArray(candidate) ? candidate : [candidate]
    if (values.length > 16 || values.some((item) => {
      if (item === null || typeof item === 'boolean') return false
      if (typeof item === 'number') return !Number.isFinite(item) || Math.abs(item) > 1_000_000_000_000
      return typeof item !== 'string' || item.length > 128 || !TOKEN.test(item)
        || item.includes('://')
        || /(?:^|[._:/-])(?:sk|pk|secret|credential|bearer|token|password|jwt|api.?key)(?:[._:/-]|$)|^eyj/i.test(item)
    })) malformed()
    result[key] = candidate as typeof result[string]
  }
  return Object.freeze(result)
}

function safeEvent(value: unknown): AdminAuditLogEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) malformed()
  const row = value as Record<string, unknown>
  if (
    row.schemaVersion !== 2 || typeof row.eventId !== 'string' || !UUID.test(row.eventId)
    || typeof row.occurredAt !== 'string' || !Number.isFinite(new Date(row.occurredAt).getTime())
    || typeof row.actorRole !== 'string' || !ROLES.has(row.actorRole)
    || typeof row.action !== 'string' || !ACTIONS.has(row.action)
    || typeof row.resourceType !== 'string' || !RESOURCE_TYPES.has(row.resourceType)
    || typeof row.resourceRef !== 'string' || !REFERENCE.test(row.resourceRef)
    || (row.resourceVersion !== null && (typeof row.resourceVersion !== 'string' || !TOKEN.test(row.resourceVersion)))
    || (row.resourceRevision !== null && (typeof row.resourceRevision !== 'string' || !TOKEN.test(row.resourceRevision)))
    || (row.reasonCode !== null && (typeof row.reasonCode !== 'string' || !TOKEN.test(row.reasonCode)))
    || typeof row.correlationId !== 'string' || !UUID.test(row.correlationId)
  ) malformed()
  return Object.freeze({
    schemaVersion: 2,
    eventId: row.eventId.toLowerCase(),
    occurredAt: new Date(row.occurredAt).toISOString(),
    actorRole: row.actorRole as AdminAuditLogEvent['actorRole'],
    action: row.action as AdminAuditLogEvent['action'],
    resourceType: row.resourceType as AdminAuditLogEvent['resourceType'],
    resourceRef: row.resourceRef,
    resourceVersion: row.resourceVersion as string | null,
    resourceRevision: row.resourceRevision as string | null,
    previousValue: safeValue(row.previousValue),
    newValue: safeValue(row.newValue),
    reasonCode: row.reasonCode as string | null,
    correlationId: row.correlationId.toLowerCase(),
  })
}

function safePage(value: unknown): AdminAuditPage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) malformed()
  const source = value as Record<string, unknown>
  if (
    source.schemaVersion !== 2 || !Array.isArray(source.events) || source.events.length > 100
    || (source.nextCursor !== null && (typeof source.nextCursor !== 'string' || !/^[A-Za-z0-9_-]{1,512}$/.test(source.nextCursor)))
  ) malformed()
  return Object.freeze({
    events: Object.freeze(source.events.map(safeEvent)),
    nextCursor: source.nextCursor as string | null,
  })
}

function queryFor(filters: AdminAuditFilters, cursor: string | null) {
  const query = new URLSearchParams()
  if (filters.occurredFrom) query.set('occurredFrom', filters.occurredFrom)
  if (filters.occurredTo) query.set('occurredTo', filters.occurredTo)
  if (filters.action) query.set('action', filters.action)
  if (filters.resourceType) query.set('resourceType', filters.resourceType)
  if (filters.resourceRef) query.set('resourceRef', filters.resourceRef)
  if (filters.actorRole) query.set('actorRole', filters.actorRole)
  if (filters.reasonCode) query.set('reasonCode', filters.reasonCode)
  if (filters.correlationId) query.set('correlationId', filters.correlationId)
  query.set('limit', String(filters.limit))
  if (cursor) query.set('cursor', cursor)
  return query.toString()
}

export async function readAdminAuditPage(
  filters: AdminAuditFilters,
  cursor: string | null = null,
  options: ReadOptions = {},
): Promise<AdminAuditPage> {
  const controller = new AbortController()
  const forwardAbort = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', forwardAbort, { once: true })
  const timer = globalThis.setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000)
  try {
    const token = await (options.getAccessToken ?? getGatewayAccessToken)()
    if (!token || controller.signal.aborted) throw new AdminAuditReadError('audit_unauthorized')
    const response = await (options.fetchImpl ?? fetch)(
      `/api/admin/v1/audit?${queryFor(filters, cursor)}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
        signal: controller.signal,
      },
    )
    if (response.status === 401 || response.status === 403) throw new AdminAuditReadError('audit_unauthorized')
    if (response.status === 400) throw new AdminAuditReadError('invalid_query')
    if (response.status === 504) throw new AdminAuditReadError('audit_timeout')
    if (response.status !== 200) throw new AdminAuditReadError('audit_unavailable')
    let body: unknown
    try {
      body = await response.json()
    } catch {
      malformed()
    }
    return safePage(body)
  } catch (error) {
    if (error instanceof AdminAuditReadError) throw error
    throw new AdminAuditReadError(controller.signal.aborted ? 'audit_timeout' : 'audit_unavailable')
  } finally {
    globalThis.clearTimeout(timer)
    options.signal?.removeEventListener('abort', forwardAbort)
  }
}
