import { getGatewayAccessToken } from '../tutor/gatewayAuth'
import { withAdminDependencyTimeout } from './adminDependencyTimeout'
import {
  ADMIN_AUDIT_ACTIONS,
  ADMIN_AUDIT_RESOURCE_TYPES,
  ADMIN_ENGINE_IDS,
  ADMIN_OPERATIONAL_RESULTS,
  ADMIN_ROLES,
  ADMIN_TELEMETRY_EVENT_TYPES,
  type AdminAuditValue,
} from './contracts'
import {
  ADMIN_INCIDENT_DOMAINS,
  type AdminIncidentEvent,
  type AdminIncidentFilters,
  type AdminIncidentPage,
} from './incidentExplorerModel'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CORRELATION = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,159}$/
const SOURCES = ['runtime', 'admin-audit', 'provider-accounting'] as const
const SOURCE_STATUSES = ['available', 'unauthorized', 'unavailable', 'timeout', 'not-requested'] as const
const COMPLETENESS_REASONS = [
  'runtime_unauthorized', 'runtime_unavailable', 'runtime_timeout',
  'runtime_malformed_entries', 'runtime_retention_limited',
  'admin_audit_unauthorized', 'admin_audit_unavailable', 'admin_audit_timeout',
  'admin_audit_malformed_entries',
  'provider_accounting_unauthorized', 'provider_accounting_unavailable',
  'provider_accounting_timeout', 'provider_accounting_malformed_entries',
] as const
const AUDIT_VALUE_KEYS = new Set([
  'value', 'state', 'enabled', 'limit', 'quota', 'model_tier', 'model_tiers',
  'voice', 'version', 'revision', 'role', 'status', 'release',
])
const SECRET_LIKE = /(?:^|[._:/-])(?:sk|pk|secret|credential|bearer|token|password|jwt|api.?key)(?:[._:/-]|$)|^eyj/i

export class AdminIncidentReadError extends Error {
  constructor(readonly code:
    | 'incident_unauthorized'
    | 'incident_unavailable'
    | 'incident_timeout'
    | 'incident_malformed'
    | 'invalid_query') {
    super(code)
    this.name = 'AdminIncidentReadError'
  }
}

function malformed(): never {
  throw new AdminIncidentReadError('incident_malformed')
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) malformed()
  return value as Record<string, unknown>
}

function exact(value: unknown, keys: readonly string[]) {
  const source = record(value)
  const actual = Object.keys(source)
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) malformed()
  return source
}

function iso(value: unknown) {
  if (typeof value !== 'string' || value.length > 40) malformed()
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) malformed()
  return value
}

function uuid(value: unknown) {
  if (typeof value !== 'string' || !UUID.test(value)) malformed()
  return value.toLowerCase()
}

function token(value: unknown, nullable = true): string | null {
  if (nullable && value === null) return null
  if (typeof value !== 'string' || !TOKEN.test(value) || SECRET_LIKE.test(value)) malformed()
  return value
}

function auditValue(value: unknown): AdminAuditValue | null {
  if (value === null) return null
  const source = record(value)
  const keys = Object.keys(source)
  if (keys.length < 1 || keys.length > 8 || keys.some((key) => !AUDIT_VALUE_KEYS.has(key))) malformed()
  const result: Record<string, string | number | boolean | null | readonly (string | number | boolean | null)[]> = {}
  for (const [key, candidate] of Object.entries(source)) {
    const values = Array.isArray(candidate) ? candidate : [candidate]
    if (values.length > 16 || values.some((item) => {
      if (item === null || typeof item === 'boolean') return false
      if (typeof item === 'number') return !Number.isFinite(item) || Math.abs(item) > 1_000_000_000_000
      return typeof item !== 'string' || item.length > 128 || !TOKEN.test(item) || SECRET_LIKE.test(item)
    })) malformed()
    result[key] = candidate as typeof result[string]
  }
  return Object.freeze(result)
}

function commonEvent(row: Record<string, unknown>) {
  return {
    eventId: uuid(row.eventId),
    occurredAt: iso(row.occurredAt),
    correlationId: (() => {
      if (typeof row.correlationId !== 'string' || !CORRELATION.test(row.correlationId)
        || SECRET_LIKE.test(row.correlationId)) malformed()
      return row.correlationId
    })(),
  }
}

function safeEvent(value: unknown): AdminIncidentEvent {
  const row = exact(value, ['eventId', 'occurredAt', 'correlationId', 'source', 'facts'])
  const common = commonEvent(row)
  if (row.source === 'runtime') {
    const facts = exact(row.facts, [
      'engine', 'eventType', 'result', 'durationMs', 'operation', 'reasonCode',
      'provider', 'httpStatus', 'failureStage', 'retryable',
    ])
    if (!ADMIN_ENGINE_IDS.includes(facts.engine as never)
      || !ADMIN_TELEMETRY_EVENT_TYPES.includes(facts.eventType as never)
      || !ADMIN_OPERATIONAL_RESULTS.includes(facts.result as never)
      || (facts.durationMs !== null && (!Number.isSafeInteger(facts.durationMs) || (facts.durationMs as number) < 0 || (facts.durationMs as number) > 86_400_000))
      || (facts.httpStatus !== null && (!Number.isSafeInteger(facts.httpStatus) || (facts.httpStatus as number) < 100 || (facts.httpStatus as number) > 599))
      || (facts.retryable !== null && typeof facts.retryable !== 'boolean')) malformed()
    return Object.freeze({
      ...common,
      source: 'runtime',
      facts: Object.freeze({
        engine: facts.engine as typeof ADMIN_ENGINE_IDS[number],
        eventType: facts.eventType as typeof ADMIN_TELEMETRY_EVENT_TYPES[number],
        result: facts.result as typeof ADMIN_OPERATIONAL_RESULTS[number],
        durationMs: facts.durationMs as number | null,
        operation: token(facts.operation),
        reasonCode: token(facts.reasonCode),
        provider: token(facts.provider),
        httpStatus: facts.httpStatus as number | null,
        failureStage: token(facts.failureStage),
        retryable: facts.retryable as boolean | null,
      }),
    })
  }
  if (row.source === 'admin-audit') {
    const facts = exact(row.facts, [
      'actorRole', 'action', 'resourceType', 'resourceRef', 'resourceVersion',
      'resourceRevision', 'previousValue', 'newValue', 'reasonCode',
    ])
    if (!ADMIN_ROLES.includes(facts.actorRole as never)
      || !ADMIN_AUDIT_ACTIONS.includes(facts.action as never)
      || !ADMIN_AUDIT_RESOURCE_TYPES.includes(facts.resourceType as never)) malformed()
    const resourceRef = token(facts.resourceRef, false)
    if (resourceRef === null) malformed()
    return Object.freeze({
      ...common,
      source: 'admin-audit',
      facts: Object.freeze({
        actorRole: facts.actorRole as typeof ADMIN_ROLES[number],
        action: facts.action as typeof ADMIN_AUDIT_ACTIONS[number],
        resourceType: facts.resourceType as typeof ADMIN_AUDIT_RESOURCE_TYPES[number],
        resourceRef,
        resourceVersion: token(facts.resourceVersion),
        resourceRevision: token(facts.resourceRevision),
        previousValue: auditValue(facts.previousValue),
        newValue: auditValue(facts.newValue),
        reasonCode: token(facts.reasonCode),
      }),
    })
  }
  if (row.source === 'provider-accounting') {
    const facts = exact(row.facts, [
      'engine', 'provider', 'providerProductId', 'logicalModelTier', 'result',
      'resultReasonCode', 'billingDisposition', 'costKind', 'currency',
    ])
    if (!ADMIN_ENGINE_IDS.includes(facts.engine as never)
      || !ADMIN_OPERATIONAL_RESULTS.includes(facts.result as never)
      || !['billable', 'not_billable', 'unknown'].includes(facts.billingDisposition as string)
      || !['calculated', 'reconciled', 'unavailable'].includes(facts.costKind as string)
      || facts.currency !== 'USD') malformed()
    const provider = token(facts.provider, false)
    const providerProductId = token(facts.providerProductId, false)
    if (provider === null || providerProductId === null) malformed()
    return Object.freeze({
      ...common,
      source: 'provider-accounting',
      facts: Object.freeze({
        engine: facts.engine as typeof ADMIN_ENGINE_IDS[number],
        provider,
        providerProductId,
        logicalModelTier: token(facts.logicalModelTier),
        result: facts.result as typeof ADMIN_OPERATIONAL_RESULTS[number],
        resultReasonCode: token(facts.resultReasonCode),
        billingDisposition: facts.billingDisposition as 'billable' | 'not_billable' | 'unknown',
        costKind: facts.costKind as 'calculated' | 'reconciled' | 'unavailable',
        currency: 'USD',
      }),
    })
  }
  malformed()
}

function safeFilters(value: unknown): AdminIncidentFilters {
  const source = record(value)
  const allowed = [
    'correlationId', 'occurredFrom', 'occurredTo', 'domain', 'engine', 'result',
    'auditAction', 'auditResource', 'limit',
  ]
  if (Object.keys(source).some((key) => !allowed.includes(key))) malformed()
  if (!ADMIN_INCIDENT_DOMAINS.includes(source.domain as never)
    || !Number.isSafeInteger(source.limit) || (source.limit as number) < 1 || (source.limit as number) > 100) malformed()
  if (source.correlationId !== undefined
    && (typeof source.correlationId !== 'string' || !CORRELATION.test(source.correlationId)
      || SECRET_LIKE.test(source.correlationId))) malformed()
  if (source.engine !== undefined && !ADMIN_ENGINE_IDS.includes(source.engine as never)) malformed()
  if (source.result !== undefined && !ADMIN_OPERATIONAL_RESULTS.includes(source.result as never)) malformed()
  if (source.auditAction !== undefined && !ADMIN_AUDIT_ACTIONS.includes(source.auditAction as never)) malformed()
  if (source.auditResource !== undefined && !ADMIN_AUDIT_RESOURCE_TYPES.includes(source.auditResource as never)) malformed()
  return Object.freeze({
    ...(source.correlationId === undefined ? {} : { correlationId: source.correlationId as string }),
    occurredFrom: iso(source.occurredFrom),
    occurredTo: iso(source.occurredTo),
    domain: source.domain as AdminIncidentFilters['domain'],
    ...(source.engine === undefined ? {} : { engine: source.engine as AdminIncidentFilters['engine'] }),
    ...(source.result === undefined ? {} : { result: source.result as AdminIncidentFilters['result'] }),
    ...(source.auditAction === undefined ? {} : { auditAction: source.auditAction as AdminIncidentFilters['auditAction'] }),
    ...(source.auditResource === undefined ? {} : { auditResource: source.auditResource as AdminIncidentFilters['auditResource'] }),
    limit: source.limit as number,
  })
}

export function decodeAdminIncidentPage(value: unknown): AdminIncidentPage {
  const source = exact(value, [
    'schemaVersion', 'generatedAt', 'sortOrder', 'query', 'events', 'sources',
    'evidence', 'nextCursor',
  ])
  if (source.schemaVersion !== 2 || source.sortOrder !== 'chronological'
    || !Array.isArray(source.events) || source.events.length > 100
    || (source.nextCursor !== null && (typeof source.nextCursor !== 'string' || !/^[A-Za-z0-9_-]{1,1536}$/.test(source.nextCursor)))) malformed()
  const sourceStates = exact(source.sources, [...SOURCES])
  const sources = Object.fromEntries(SOURCES.map((name) => {
    const status = sourceStates[name]
    if (!SOURCE_STATUSES.includes(status as never)) malformed()
    return [name, status]
  })) as AdminIncidentPage['sources']
  const evidence = exact(source.evidence, ['status', 'reasons', 'rejectedEntries'])
  if (!['complete', 'partial'].includes(evidence.status as string)
    || !Array.isArray(evidence.reasons)
    || evidence.reasons.length > COMPLETENESS_REASONS.length
    || evidence.reasons.some((reason) => !COMPLETENESS_REASONS.includes(reason as never))
    || new Set(evidence.reasons).size !== evidence.reasons.length
    || !Number.isSafeInteger(evidence.rejectedEntries) || (evidence.rejectedEntries as number) < 0) malformed()
  const events = Object.freeze(source.events.map(safeEvent))
  if (events.some((item, index) => index > 0 && item.occurredAt < events[index - 1].occurredAt)) malformed()
  return Object.freeze({
    schemaVersion: 2,
    generatedAt: iso(source.generatedAt),
    sortOrder: 'chronological',
    query: safeFilters(source.query),
    events,
    sources,
    evidence: Object.freeze({
      status: evidence.status as 'complete' | 'partial',
      reasons: Object.freeze([...(evidence.reasons as AdminIncidentPage['evidence']['reasons'])]),
      rejectedEntries: evidence.rejectedEntries as number,
    }),
    nextCursor: source.nextCursor as string | null,
  })
}

function queryFor(filters: AdminIncidentFilters, cursor: string | null) {
  const query = new URLSearchParams()
  if (filters.correlationId) query.set('correlationId', filters.correlationId)
  query.set('occurredFrom', filters.occurredFrom)
  query.set('occurredTo', filters.occurredTo)
  query.set('domain', filters.domain)
  if (filters.engine) query.set('engine', filters.engine)
  if (filters.result) query.set('result', filters.result)
  if (filters.auditAction) query.set('auditAction', filters.auditAction)
  if (filters.auditResource) query.set('auditResource', filters.auditResource)
  query.set('limit', String(filters.limit))
  if (cursor) query.set('cursor', cursor)
  return query.toString()
}

interface ReadOptions {
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
  readonly getAccessToken?: () => Promise<string | null>
  readonly fetchImpl?: typeof fetch
}

export async function readAdminIncidentPage(
  filters: AdminIncidentFilters,
  cursor: string | null = null,
  options: ReadOptions = {},
): Promise<AdminIncidentPage> {
  const controller = new AbortController()
  const forwardAbort = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', forwardAbort, { once: true })
  if (options.signal?.aborted) controller.abort(options.signal.reason)
  const timer = globalThis.setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000)
  try {
    const accessToken = await withAdminDependencyTimeout(
      () => (options.getAccessToken ?? getGatewayAccessToken)(), options.timeoutMs ?? 10_000,
    )
    if (controller.signal.aborted) throw new AdminIncidentReadError('incident_timeout')
    if (!accessToken) throw new AdminIncidentReadError('incident_unauthorized')
    const response = await withAdminDependencyTimeout((timeoutSignal) => (options.fetchImpl ?? fetch)(
      `/api/admin/v1/correlations?${queryFor(filters, cursor)}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
        signal: AbortSignal.any([controller.signal, timeoutSignal]),
      },
    ), options.timeoutMs ?? 10_000)
    if (response.status === 401 || response.status === 403) throw new AdminIncidentReadError('incident_unauthorized')
    if (response.status === 400) throw new AdminIncidentReadError('invalid_query')
    if (response.status === 504) throw new AdminIncidentReadError('incident_timeout')
    if (response.status !== 200) throw new AdminIncidentReadError('incident_unavailable')
    let body: unknown
    try {
      body = await response.json()
    } catch {
      malformed()
    }
    return decodeAdminIncidentPage(body)
  } catch (error) {
    if (error instanceof AdminIncidentReadError) throw error
    throw new AdminIncidentReadError(controller.signal.aborted ? 'incident_timeout' : 'incident_unavailable')
  } finally {
    globalThis.clearTimeout(timer)
    options.signal?.removeEventListener('abort', forwardAbort)
  }
}
