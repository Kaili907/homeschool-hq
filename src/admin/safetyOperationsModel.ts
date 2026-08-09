import type { StudySafetyMonitoringEventName } from '../study/contracts/safety'
import { ADMIN_ENGINE_IDS, type AdminCapability, type AdminEngineId, type AdminRole } from './contracts'
export { ADMIN_ENGINE_IDS } from './contracts'
import type { AdminOperationalEvent } from '../telemetry/operationalTelemetry'

export const ADMIN_SAFETY_READ_CAPABILITY = 'safety:read' as const
export const SAFETY_OPERATIONS_SCHEMA_VERSION = 1 as const
export const SAFETY_OPERATIONS_EVENT_LIMIT = 100 as const
export const SAFETY_EVENT_HISTORY_LIMIT = 50 as const

export type AdminSafetyReadAuthorization =
  | { readonly status: 'resolving' }
  | { readonly status: 'denied'; readonly reasonCode: 'admin_assignment_required' | 'authorization_unavailable' | 'safety_read_required' }
  | {
      readonly status: 'authorized'
      readonly role: AdminRole
      readonly capabilities: readonly AdminCapability[]
    }

export type SafetyEvidenceSource =
  | 'study-safety-stops'
  | 'study-adult-review'
  | 'study-safety-monitoring'
  | 'operational-telemetry'

export type SafetyEvidenceCategory =
  | 'safety-stop'
  | 'adult-review'
  | 'fail-closed'
  | 'fallback-rejection'

export type SafetyEventState = 'open' | 'resolved' | 'pending-review' | 'fail-closed' | 'rejected' | 'unknown'
export type SafetyResolutionState = 'unresolved' | 'pending-adult-review' | 'resolved' | 'not-applicable' | 'unknown'
export type SafetyEngine = AdminEngineId

export interface SafetyOperationsEventV1 {
  readonly schemaVersion: typeof SAFETY_OPERATIONS_SCHEMA_VERSION
  readonly eventRef: string
  readonly source: SafetyEvidenceSource
  readonly learner?: {
    readonly reference: string
    readonly displayName?: string
  }
  readonly occurredAt: string
  readonly engine: SafetyEngine
  readonly versionSnapshot?: {
    readonly appVersion: string
    readonly engineVersion: string
    readonly curriculumVersion: string | null
  }
  readonly evidenceCategory: SafetyEvidenceCategory
  readonly reasonCode: string
  readonly state: SafetyEventState
  readonly resolution: {
    readonly state: SafetyResolutionState
    readonly resolvedAt?: string
    readonly authorizedAdultRef?: string
  }
  readonly history: readonly {
    readonly occurredAt: string
    readonly state: SafetyEventState
    readonly reasonCode?: string
  }[]
}

export type SafetyCountMetric =
  | { readonly status: 'available'; readonly value: number }
  | { readonly status: 'unavailable' }

export interface SafetyOperationsSnapshotV1 {
  readonly schemaVersion: typeof SAFETY_OPERATIONS_SCHEMA_VERSION
  readonly observedAt: string
  readonly summary: {
    readonly openSafetyStops: SafetyCountMetric
    readonly resolvedSafetyStops: SafetyCountMetric
    readonly adultReviewPending: SafetyCountMetric
    readonly failClosedEvents: SafetyCountMetric
    readonly safetyStopEvents: SafetyCountMetric
    readonly fallbackRejectionEvents: SafetyCountMetric
    readonly unresolvedSafetyConditions: SafetyCountMetric
  }
  readonly sources: readonly {
    readonly source: SafetyEvidenceSource
    readonly status: 'available' | 'unavailable'
  }[]
  readonly operationalTelemetry: { readonly status: 'available' | 'unavailable' }
  readonly events: readonly SafetyOperationsEventV1[]
  readonly page: {
    readonly limit: number
    readonly nextCursor: string | null
  }
}

export type SafetyOperationsReadState =
  | { readonly status: 'loading' }
  | { readonly status: 'unavailable'; readonly reasonCode: 'source_unavailable' | 'read_failed' }
  | { readonly status: 'ready'; readonly snapshot: SafetyOperationsSnapshotV1 }

export interface AdminSafetyOperationsReadPort {
  /** The server endpoint must resolve identity and capability again. */
  read(input: {
    readonly capability: typeof ADMIN_SAFETY_READ_CAPABILITY
  }): Promise<SafetyOperationsReadState>
}

export async function readAuthorizedSafetyOperations(
  authorization: AdminSafetyReadAuthorization,
  port: AdminSafetyOperationsReadPort,
): Promise<SafetyOperationsReadState> {
  if (!hasSafetyReadGrant(authorization)) return { status: 'unavailable', reasonCode: 'read_failed' }
  return port.read({ capability: ADMIN_SAFETY_READ_CAPABILITY })
}

export function hasSafetyReadGrant(
  authorization: AdminSafetyReadAuthorization,
): authorization is Extract<AdminSafetyReadAuthorization, { status: 'authorized' }> {
  return authorization.status === 'authorized'
    && Array.isArray(authorization.capabilities)
    && authorization.capabilities.includes(ADMIN_SAFETY_READ_CAPABILITY)
}

export interface SafetyOperationsModel {
  readonly observedAt: string | null
  readonly summary: SafetyOperationsSnapshotV1['summary']
  readonly sources: SafetyOperationsSnapshotV1['sources']
  readonly operationalTelemetry: SafetyOperationsSnapshotV1['operationalTelemetry']
  readonly events: readonly SafetyOperationsEventV1[]
}

const UNAVAILABLE_METRIC: SafetyCountMetric = Object.freeze({ status: 'unavailable' })
const EMPTY_SUMMARY: SafetyOperationsSnapshotV1['summary'] = Object.freeze({
  openSafetyStops: UNAVAILABLE_METRIC,
  resolvedSafetyStops: UNAVAILABLE_METRIC,
  adultReviewPending: UNAVAILABLE_METRIC,
  failClosedEvents: UNAVAILABLE_METRIC,
  safetyStopEvents: UNAVAILABLE_METRIC,
  fallbackRejectionEvents: UNAVAILABLE_METRIC,
  unresolvedSafetyConditions: UNAVAILABLE_METRIC,
})

const SOURCES = new Set<SafetyEvidenceSource>([
  'study-safety-stops',
  'study-adult-review',
  'study-safety-monitoring',
  'operational-telemetry',
])
const ENGINES = new Set<SafetyEngine>(ADMIN_ENGINE_IDS)
const CATEGORIES = new Set<SafetyEvidenceCategory>(['safety-stop', 'adult-review', 'fail-closed', 'fallback-rejection'])
const EVENT_STATES = new Set<SafetyEventState>(['open', 'resolved', 'pending-review', 'fail-closed', 'rejected', 'unknown'])
const RESOLUTION_STATES = new Set<SafetyResolutionState>(['unresolved', 'pending-adult-review', 'resolved', 'not-applicable', 'unknown'])

const LOCAL_STOP_CODES = [
  'classifier-unreachable',
  'request-timeout',
  'gateway-503',
  'authentication-failure',
  'malformed-server-response',
  'non-production-safety-port',
  'network-failure-mid-request',
  'study-safety-stop',
] as const

const CLASSIFIER_CODES = [
  'safety-urgent-self-harm-current-v1',
  'safety-urgent-suicide-intent-current-v1',
  'safety-urgent-suicide-intent-future-v1',
  'safety-urgent-overdose-ingestion-v1',
  'safety-urgent-physical-abuse-v1',
  'safety-urgent-sexual-abuse-v1',
  'safety-urgent-neglect-v1',
  'safety-urgent-food-withholding-v1',
  'safety-urgent-fear-returning-home-v1',
  'safety-urgent-immediate-danger-v1',
  'safety-personal-signal-outranks-context-v1',
  'safety-multiple-categories-v1',
  'safety-uncertain-self-harm-v1',
  'safety-uncertain-danger-v1',
  'safety-uncertain-abuse-neglect-v1',
  'safety-uncertain-unattributed-quotation-v1',
  'safety-uncertain-third-party-disclosure-v1',
  'safety-uncertain-ambiguous-personal-context-v1',
  'safety-provider-urgent-v1',
  'safety-provider-uncertain-v1',
  'safety-invalid-input-v1',
  'safety-invalid-provider-output-v1',
  'safety-invalid-provider-unavailable-v1',
  'safety-invalid-provider-timeout-v1',
  'safety-invalid-provider-circuit-open-v1',
] as const

const MONITORING_CODES: readonly StudySafetyMonitoringEventName[] = [
  'study_safety.classifier_unavailable',
  'study_safety.classifier_malformed_response',
  'study_safety.classification_urgent',
  'study_safety.classification_uncertain',
  'study_safety.outbox_backlog',
  'study_safety.delivery_repeated_failure',
  'study_safety.proposal_duplicate',
  'study_safety.recipient_resolution_failure',
  'study_safety.request_unauthorized',
  'study_safety.request_rate_limited',
  'study_safety.provider_timeout',
  'study_safety.circuit_breaker_open',
]

const KNOWN_REASON_CODES = new Set<string>([...LOCAL_STOP_CODES, ...CLASSIFIER_CODES, ...MONITORING_CODES])
export const UNKNOWN_SAFETY_REASON_CODE = 'unknown-safety-condition' as const

export function canonicalSafetyReasonCode(value: unknown): string {
  return typeof value === 'string' && KNOWN_REASON_CODES.has(value) ? value : UNKNOWN_SAFETY_REASON_CODE
}

export function safeSafetyReasonMessage(reasonCode: string): string {
  const code = canonicalSafetyReasonCode(reasonCode)
  if (code === 'study-safety-stop') return 'A safety check paused the Study session.'
  if (LOCAL_STOP_CODES.includes(code as (typeof LOCAL_STOP_CODES)[number])) return 'A safety dependency failed closed and paused the Study session.'
  if (code.startsWith('safety-urgent-') || code === 'safety-provider-urgent-v1') return 'An urgent safety rule paused the Study session for adult review.'
  if (code.startsWith('safety-uncertain-') || code === 'safety-provider-uncertain-v1') return 'A safety rule paused the Study session for adult review.'
  if (code.startsWith('safety-invalid-')) return 'Safety classification could not be confirmed, so the session failed closed.'
  if (code === 'study_safety.request_unauthorized') return 'A safety request was rejected by authorization checks.'
  if (code === 'study_safety.request_rate_limited') return 'A safety request was rejected by the durable rate limit.'
  if (code === 'study_safety.outbox_backlog') return 'The adult-review delivery queue requires attention.'
  if (code === 'study_safety.delivery_repeated_failure') return 'Adult-review delivery has repeated structured failures.'
  if (code === 'study_safety.recipient_resolution_failure') return 'Authorized-recipient resolution was not completed.'
  if (code === 'study_safety.proposal_duplicate') return 'A duplicate adult-review proposal was safely deduplicated.'
  if (code.startsWith('study_safety.')) return 'A Study safety safeguard recorded a fail-closed condition.'
  return 'A safety condition was recorded. Raw details are intentionally not shown.'
}

export function buildSafetyOperationsModel(snapshot: SafetyOperationsSnapshotV1): SafetyOperationsModel {
  if (snapshot.schemaVersion !== SAFETY_OPERATIONS_SCHEMA_VERSION) {
    return { observedAt: null, summary: EMPTY_SUMMARY, sources: [], operationalTelemetry: { status: 'unavailable' }, events: [] }
  }
  return {
    observedAt: isIsoTime(snapshot.observedAt) ? snapshot.observedAt : null,
    summary: sanitizeSummary(snapshot.summary),
    sources: snapshot.sources.flatMap((source) => SOURCES.has(source.source) && (source.status === 'available' || source.status === 'unavailable') ? [{ source: source.source, status: source.status }] : []),
    operationalTelemetry: snapshot.operationalTelemetry?.status === 'available'
      ? { status: 'available' }
      : { status: 'unavailable' },
    events: snapshot.events.slice(0, SAFETY_OPERATIONS_EVENT_LIMIT).flatMap(sanitizeEvent).sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)),
  }
}

function sanitizeSummary(summary: SafetyOperationsSnapshotV1['summary']): SafetyOperationsSnapshotV1['summary'] {
  return {
    openSafetyStops: sanitizeMetric(summary.openSafetyStops),
    resolvedSafetyStops: sanitizeMetric(summary.resolvedSafetyStops),
    adultReviewPending: sanitizeMetric(summary.adultReviewPending),
    failClosedEvents: sanitizeMetric(summary.failClosedEvents),
    safetyStopEvents: sanitizeMetric(summary.safetyStopEvents),
    fallbackRejectionEvents: sanitizeMetric(summary.fallbackRejectionEvents),
    unresolvedSafetyConditions: sanitizeMetric(summary.unresolvedSafetyConditions),
  }
}

function sanitizeMetric(metric: SafetyCountMetric): SafetyCountMetric {
  return metric?.status === 'available' && Number.isSafeInteger(metric.value) && metric.value >= 0
    ? { status: 'available', value: metric.value }
    : UNAVAILABLE_METRIC
}

function sanitizeEvent(event: SafetyOperationsEventV1): SafetyOperationsEventV1[] {
  if (
    event?.schemaVersion !== SAFETY_OPERATIONS_SCHEMA_VERSION
    || !isOpaqueReference(event.eventRef)
    || !SOURCES.has(event.source)
    || (event.learner !== undefined && !isOpaqueReference(event.learner?.reference))
    || !isIsoTime(event.occurredAt)
    || !ENGINES.has(event.engine)
    || !CATEGORIES.has(event.evidenceCategory)
    || !EVENT_STATES.has(event.state)
    || !RESOLUTION_STATES.has(event.resolution?.state)
  ) return []
  const displayName = safeDisplayName(event.learner?.displayName)
  const resolvedAt = isIsoTime(event.resolution.resolvedAt) ? event.resolution.resolvedAt : undefined
  const authorizedAdultRef = isOpaqueReference(event.resolution.authorizedAdultRef) ? event.resolution.authorizedAdultRef : undefined
  return [{
    schemaVersion: SAFETY_OPERATIONS_SCHEMA_VERSION,
    eventRef: event.eventRef,
    source: event.source,
    ...(event.learner ? { learner: { reference: event.learner.reference, ...(displayName ? { displayName } : {}) } } : {}),
    occurredAt: event.occurredAt,
    engine: event.engine,
    ...(event.versionSnapshot ? { versionSnapshot: sanitizeVersionSnapshot(event.versionSnapshot) } : {}),
    evidenceCategory: event.evidenceCategory,
    reasonCode: canonicalSafetyReasonCode(event.reasonCode),
    state: event.state,
    resolution: {
      state: event.resolution.state,
      ...(resolvedAt ? { resolvedAt } : {}),
      ...(authorizedAdultRef ? { authorizedAdultRef } : {}),
    },
    history: (Array.isArray(event.history) ? event.history.slice(-SAFETY_EVENT_HISTORY_LIMIT) : []).flatMap((entry) => {
      if (!isIsoTime(entry?.occurredAt) || !EVENT_STATES.has(entry.state)) return []
      return [{
        occurredAt: entry.occurredAt,
        state: entry.state,
        ...(entry.reasonCode ? { reasonCode: canonicalSafetyReasonCode(entry.reasonCode) } : {}),
      }]
    }),
  }]
}

function sanitizeVersionSnapshot(
  snapshot: SafetyOperationsEventV1['versionSnapshot'],
): SafetyOperationsEventV1['versionSnapshot'] | undefined {
  if (!snapshot || !isVersion(snapshot.appVersion) || !isVersion(snapshot.engineVersion)) return undefined
  if (snapshot.curriculumVersion !== null && !isVersion(snapshot.curriculumVersion)) return undefined
  return {
    appVersion: snapshot.appVersion,
    engineVersion: snapshot.engineVersion,
    curriculumVersion: snapshot.curriculumVersion,
  }
}

function isVersion(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/.test(value)
}

/**
 * Trusted ADMIN-2 adapter. Provider errors, timeouts, fallbacks, and rejections
 * are deliberately excluded; only a canonical safety_stop result becomes a
 * Safety Operations event.
 */
export function adaptOperationalSafetyEvent(
  event: AdminOperationalEvent,
): SafetyOperationsEventV1 | null {
  if (event.result !== 'safety_stop') return null
  const reasonCode = typeof event.metadata.reason_code === 'string'
    ? canonicalSafetyReasonCode(event.metadata.reason_code)
    : UNKNOWN_SAFETY_REASON_CODE
  return {
    schemaVersion: SAFETY_OPERATIONS_SCHEMA_VERSION,
    eventRef: event.eventId,
    source: 'operational-telemetry',
    ...(event.scope === 'household' && event.learnerRef
      ? { learner: { reference: event.learnerRef } }
      : {}),
    occurredAt: event.occurredAt,
    engine: event.engine,
    versionSnapshot: {
      appVersion: event.appVersion,
      engineVersion: event.engineVersion,
      curriculumVersion: event.curriculumVersion,
    },
    evidenceCategory: 'safety-stop',
    reasonCode,
    state: 'unknown',
    resolution: { state: 'unknown' },
    history: [],
  }
}

function safeDisplayName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > 0 && normalized.length <= 80 && /^[\p{L}\p{M}\p{N} .'-]+$/u.test(normalized)
    ? normalized
    : undefined
}

function isOpaqueReference(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value)
}

function isIsoTime(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))
}

export type SafetyEventFilter = {
  readonly state: 'all' | SafetyEventState
  readonly engine: 'all' | SafetyEngine
  readonly category: 'all' | SafetyEvidenceCategory
}

export const DEFAULT_SAFETY_EVENT_FILTER: SafetyEventFilter = Object.freeze({ state: 'all', engine: 'all', category: 'all' })

export function filterSafetyOperationsEvents(events: readonly SafetyOperationsEventV1[], filter: SafetyEventFilter): readonly SafetyOperationsEventV1[] {
  return events.filter((event) =>
    (filter.state === 'all' || event.state === filter.state)
    && (filter.engine === 'all' || event.engine === filter.engine)
    && (filter.category === 'all' || event.evidenceCategory === filter.category))
}
