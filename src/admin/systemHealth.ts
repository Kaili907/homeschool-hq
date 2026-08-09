import {
  ADMIN_CONTRACT_VERSION,
  ADMIN_ENGINE_IDS,
  type AdminEngineId,
  type AdminHealthState,
  type AdminOperationalEvent,
  type AdminOperationalResult,
} from './contracts'

export const SYSTEM_HEALTH_WINDOWS = ['1h', 'today', '24h', '7d'] as const
export type SystemHealthWindow = (typeof SYSTEM_HEALTH_WINDOWS)[number]

export const SYSTEM_HEALTH_THRESHOLDS = Object.freeze({
  primaryEvaluationWindowMs: 60 * 60 * 1_000,
  currentEvidenceMaxAgeMs: 15 * 60 * 1_000,
  minimumRateEvents: 5,
  minimumP50Samples: 3,
  minimumP95Samples: 20,
  degradedFailureCount: 2,
  degradedFailureRatePercent: 20,
  unavailableFailureCount: 3,
  unavailableFailureRatePercent: 60,
  degradedTimeoutCount: 2,
  degradedTimeoutRatePercent: 10,
  degradedProviderErrorCount: 2,
  degradedProviderErrorRatePercent: 10,
  degradedFallbackCount: 3,
  degradedFallbackRatePercent: 30,
  degradedP95LatencyMs: 5_000,
  maximumSourceEvents: 500,
  maximumIncidents: 25,
})

export type HealthFreshness = 'current' | 'stale' | 'no_evidence'

export const SYSTEM_HEALTH_REASON_CODES = [
  'operating_normally',
  'feature_disabled',
  'no_evidence',
  'stale_evidence',
  'insufficient_volume',
  'telemetry_incomplete',
  'elevated_failure_rate',
  'elevated_timeout_rate',
  'elevated_provider_error_rate',
  'elevated_fallback_rate',
  'elevated_latency',
  'core_operation_unavailable',
  'safety_policy_working',
] as const
export type SystemHealthReasonCode = (typeof SYSTEM_HEALTH_REASON_CODES)[number]

export const SYSTEM_INCIDENT_REASON_CODES = [
  'fallback_used',
  'request_timeout',
  'provider_timeout',
  'provider_failure',
  'validation_failed',
  'persistence_failed',
  'sync_failed',
  'operational_detail_unavailable',
] as const
export type SystemIncidentReasonCode = (typeof SYSTEM_INCIDENT_REASON_CODES)[number]

export type SystemServiceId =
  | 'admin_api'
  | 'persistence'
  | 'anthropic_gateway'
  | 'tts_gateway'
  | 'sync'
  | 'curriculum_read'

export interface HealthRateMetrics {
  readonly eligibleEventCount: number
  readonly successCount: number
  readonly successRatePercent: number | null
  readonly fallbackCount: number
  readonly fallbackRatePercent: number | null
  readonly rejectedCount: number
  readonly timeoutCount: number
  readonly timeoutRatePercent: number | null
  readonly providerErrorCount: number
  readonly providerErrorRatePercent: number | null
  readonly validationErrorCount: number
  readonly safetyStopCount: number
}

export interface EngineHealthProjection extends HealthRateMetrics {
  readonly engineId: AdminEngineId
  readonly health: AdminHealthState
  readonly freshness: HealthFreshness
  readonly observedAt: string | null
  readonly windowStart: string
  readonly windowEnd: string
  readonly appVersion: string | null
  readonly engineVersion: string | null
  readonly curriculumVersion: string | null
  readonly eventCount: number
  readonly p50LatencyMs: number | null
  readonly p95LatencyMs: number | null
  readonly reasonCodes: readonly SystemHealthReasonCode[]
}

export interface ServiceHealthProjection {
  readonly serviceId: SystemServiceId
  readonly health: AdminHealthState
  readonly freshness: HealthFreshness
  readonly observedAt: string | null
  readonly eventCount: number
  readonly failureCount: number
  readonly p95LatencyMs: number | null
  readonly reasonCodes: readonly SystemHealthReasonCode[]
}

export interface SystemHealthIncident {
  readonly occurredAt: string
  readonly engineId: AdminEngineId
  readonly serviceId: SystemServiceId | 'academy_engine'
  readonly result: Extract<AdminOperationalResult, 'fallback' | 'timeout' | 'provider_error' | 'validation_error'>
  readonly reasonCode: SystemIncidentReasonCode
}

export interface SystemHealthHistoryMetrics extends HealthRateMetrics {
  readonly eventCount: number
  readonly p50LatencyMs: number | null
  readonly p95LatencyMs: number | null
}

export interface SystemHealthProjection {
  readonly contractVersion: typeof ADMIN_CONTRACT_VERSION
  readonly generatedAt: string
  readonly selectedWindow: SystemHealthWindow
  readonly historyWindow: { readonly start: string; readonly end: string }
  readonly evaluationWindow: { readonly start: string; readonly end: string }
  readonly evidenceCompleteness: 'complete' | 'truncated' | 'invalid_rows_rejected'
  readonly overallHealth: AdminHealthState
  readonly overallReasonCodes: readonly SystemHealthReasonCode[]
  readonly observedAt: string | null
  readonly freshness: HealthFreshness
  readonly failureTrend: 'increasing' | 'stable' | 'decreasing' | 'unknown'
  readonly currentFailureCount: number | null
  readonly previousFailureCount: number | null
  readonly historyMetrics: SystemHealthHistoryMetrics
  readonly engines: readonly EngineHealthProjection[]
  readonly services: readonly ServiceHealthProjection[]
  readonly incidents: readonly SystemHealthIncident[]
}

export interface BuildSystemHealthOptions {
  readonly now?: Date
  readonly selectedWindow?: SystemHealthWindow
  readonly disabledEngines?: ReadonlySet<AdminEngineId>
  readonly sourceTruncated?: boolean
  readonly rejectedRows?: number
}

const CRITICAL_ENGINES = new Set<AdminEngineId>([
  'tutor', 'study', 'assessment', 'curriculum', 'gateway', 'sync',
])
const SERVICE_IDS: readonly SystemServiceId[] = [
  'admin_api', 'persistence', 'anthropic_gateway', 'tts_gateway', 'sync', 'curriculum_read',
]

function percentage(numerator: number, denominator: number): number | null {
  if (denominator < SYSTEM_HEALTH_THRESHOLDS.minimumRateEvents) return null
  return Math.round((numerator / denominator) * 1_000) / 10
}

function percentile(values: readonly number[], percentileValue: 50 | 95): number | null {
  const minimum = percentileValue === 50
    ? SYSTEM_HEALTH_THRESHOLDS.minimumP50Samples
    : SYSTEM_HEALTH_THRESHOLDS.minimumP95Samples
  if (values.length < minimum) return null
  const ordered = [...values].sort((left, right) => left - right)
  if (percentileValue === 50) {
    const middle = Math.floor(ordered.length / 2)
    return ordered.length % 2 === 1
      ? ordered[middle]
      : Math.round((ordered[middle - 1] + ordered[middle]) / 2)
  }
  return ordered[Math.max(0, Math.ceil(ordered.length * 0.95) - 1)]
}

function instantMs(value: string): number | null {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function latestEvent(events: readonly AdminOperationalEvent[]): AdminOperationalEvent | null {
  let latest: AdminOperationalEvent | null = null
  let latestMs = Number.NEGATIVE_INFINITY
  for (const event of events) {
    const occurredAt = instantMs(event.occurredAt)
    if (occurredAt !== null && occurredAt > latestMs) {
      latest = event
      latestMs = occurredAt
    }
  }
  return latest
}

function freshnessFor(event: AdminOperationalEvent | null, nowMs: number): HealthFreshness {
  if (!event) return 'no_evidence'
  const occurredAt = instantMs(event.occurredAt)
  if (occurredAt === null || occurredAt > nowMs) return 'stale'
  return nowMs - occurredAt <= SYSTEM_HEALTH_THRESHOLDS.currentEvidenceMaxAgeMs
    ? 'current'
    : 'stale'
}

function rateMetrics(events: readonly AdminOperationalEvent[]): HealthRateMetrics {
  const count = (result: AdminOperationalResult) => events.filter((event) => event.result === result).length
  const successCount = count('success')
  const fallbackCount = count('fallback')
  const rejectedCount = count('rejected')
  const timeoutCount = count('timeout')
  const providerErrorCount = count('provider_error')
  const validationErrorCount = count('validation_error')
  const safetyStopCount = count('safety_stop')
  const eligibleEventCount = events.filter((event) => event.result !== 'rejected' && event.result !== 'safety_stop').length
  return {
    eligibleEventCount,
    successCount,
    successRatePercent: percentage(successCount, eligibleEventCount),
    fallbackCount,
    fallbackRatePercent: percentage(fallbackCount, eligibleEventCount),
    rejectedCount,
    timeoutCount,
    timeoutRatePercent: percentage(timeoutCount, eligibleEventCount),
    providerErrorCount,
    providerErrorRatePercent: percentage(providerErrorCount, eligibleEventCount),
    validationErrorCount,
    safetyStopCount,
  }
}

interface Evaluation {
  readonly health: AdminHealthState
  readonly reasons: readonly SystemHealthReasonCode[]
  readonly metrics: HealthRateMetrics
  readonly p50LatencyMs: number | null
  readonly p95LatencyMs: number | null
}

function evaluate(
  events: readonly AdminOperationalEvent[],
  freshness: HealthFreshness,
  disabled: boolean,
  incomplete: boolean,
): Evaluation {
  const metrics = rateMetrics(events)
  const durations = events.flatMap((event) => event.durationMs === null ? [] : [event.durationMs])
  const p50LatencyMs = percentile(durations, 50)
  const p95LatencyMs = percentile(durations, 95)
  const base = { metrics, p50LatencyMs, p95LatencyMs }
  if (disabled) return { ...base, health: 'disabled', reasons: ['feature_disabled'] }
  if (incomplete) return { ...base, health: 'unknown', reasons: ['telemetry_incomplete'] }
  if (freshness === 'no_evidence') return { ...base, health: 'unknown', reasons: ['no_evidence'] }
  if (freshness === 'stale') return { ...base, health: 'unknown', reasons: ['stale_evidence'] }
  if (metrics.eligibleEventCount < SYSTEM_HEALTH_THRESHOLDS.minimumRateEvents) {
    return { ...base, health: 'unknown', reasons: ['insufficient_volume'] }
  }

  const failureCount = metrics.timeoutCount + metrics.providerErrorCount + metrics.validationErrorCount
  const failureRate = percentage(failureCount, metrics.eligibleEventCount) ?? 0
  if (
    failureCount >= SYSTEM_HEALTH_THRESHOLDS.unavailableFailureCount
    && failureRate >= SYSTEM_HEALTH_THRESHOLDS.unavailableFailureRatePercent
  ) {
    return { ...base, health: 'unavailable', reasons: ['core_operation_unavailable'] }
  }

  const reasons: SystemHealthReasonCode[] = []
  if (
    failureCount >= SYSTEM_HEALTH_THRESHOLDS.degradedFailureCount
    && failureRate >= SYSTEM_HEALTH_THRESHOLDS.degradedFailureRatePercent
  ) reasons.push('elevated_failure_rate')
  if (
    metrics.timeoutCount >= SYSTEM_HEALTH_THRESHOLDS.degradedTimeoutCount
    && (metrics.timeoutRatePercent ?? 0) >= SYSTEM_HEALTH_THRESHOLDS.degradedTimeoutRatePercent
  ) reasons.push('elevated_timeout_rate')
  if (
    metrics.providerErrorCount >= SYSTEM_HEALTH_THRESHOLDS.degradedProviderErrorCount
    && (metrics.providerErrorRatePercent ?? 0) >= SYSTEM_HEALTH_THRESHOLDS.degradedProviderErrorRatePercent
  ) reasons.push('elevated_provider_error_rate')
  if (
    metrics.fallbackCount >= SYSTEM_HEALTH_THRESHOLDS.degradedFallbackCount
    && (metrics.fallbackRatePercent ?? 0) >= SYSTEM_HEALTH_THRESHOLDS.degradedFallbackRatePercent
  ) reasons.push('elevated_fallback_rate')
  if (p95LatencyMs !== null && p95LatencyMs >= SYSTEM_HEALTH_THRESHOLDS.degradedP95LatencyMs) {
    reasons.push('elevated_latency')
  }
  if (reasons.length > 0) return { ...base, health: 'degraded', reasons }
  return {
    ...base,
    health: 'healthy',
    reasons: metrics.safetyStopCount > 0
      ? ['operating_normally', 'safety_policy_working']
      : ['operating_normally'],
  }
}

function selectedHistoryStart(now: Date, window: SystemHealthWindow): number {
  const nowMs = now.getTime()
  if (window === 'today') {
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  }
  const duration = window === '1h'
    ? 60 * 60 * 1_000
    : window === '24h'
      ? 24 * 60 * 60 * 1_000
      : 7 * 24 * 60 * 60 * 1_000
  return nowMs - duration
}

function inWindow(event: AdminOperationalEvent, start: number, end: number): boolean {
  const occurredAt = instantMs(event.occurredAt)
  return occurredAt !== null && occurredAt >= start && occurredAt <= end
}

function serviceFor(event: AdminOperationalEvent): SystemServiceId | 'academy_engine' {
  if (event.metadata.operation === 'authorization' || event.metadata.route === 'admin') return 'admin_api'
  if (event.eventType === 'persistence.operation') return 'persistence'
  if (event.engine === 'tts' || event.metadata.provider === 'elevenlabs') return 'tts_gateway'
  if (event.engine === 'gateway' || event.metadata.provider === 'anthropic') return 'anthropic_gateway'
  if (event.engine === 'sync') return 'sync'
  if (event.engine === 'curriculum') return 'curriculum_read'
  return 'academy_engine'
}

function serviceEvents(events: readonly AdminOperationalEvent[], serviceId: SystemServiceId): AdminOperationalEvent[] {
  return events.filter((event) => serviceFor(event) === serviceId)
}

function incidentReason(event: AdminOperationalEvent): SystemIncidentReasonCode {
  const service = serviceFor(event)
  if (event.result === 'fallback') return 'fallback_used'
  if (event.result === 'timeout') {
    return service === 'anthropic_gateway' || service === 'tts_gateway'
      ? 'provider_timeout'
      : 'request_timeout'
  }
  if (event.result === 'provider_error') {
    if (service === 'persistence') return 'persistence_failed'
    if (service === 'sync') return 'sync_failed'
    return 'provider_failure'
  }
  if (event.result === 'validation_error') {
    if (service === 'persistence') return 'persistence_failed'
    if (service === 'sync') return 'sync_failed'
    return 'validation_failed'
  }
  return 'operational_detail_unavailable'
}

function failureEvents(events: readonly AdminOperationalEvent[]): AdminOperationalEvent[] {
  return events.filter((event) => [
    'timeout', 'provider_error', 'validation_error',
  ].includes(event.result))
}

function overallHealth(engines: readonly EngineHealthProjection[]): {
  health: AdminHealthState
  reasons: readonly SystemHealthReasonCode[]
} {
  const critical = engines.filter((engine) => CRITICAL_ENGINES.has(engine.engineId) && engine.health !== 'disabled')
  const enabled = engines.filter((engine) => engine.health !== 'disabled')
  if (critical.some((engine) => engine.health === 'unavailable')) {
    return { health: 'unavailable', reasons: ['core_operation_unavailable'] }
  }
  if (critical.some((engine) => engine.health === 'degraded') || enabled.some((engine) => engine.health === 'unavailable')) {
    return { health: 'degraded', reasons: ['elevated_failure_rate'] }
  }
  if (critical.length === 0 || critical.some((engine) => engine.health === 'unknown')) {
    const reason = critical.flatMap((engine) => engine.reasonCodes).find((code) =>
      code === 'telemetry_incomplete' || code === 'stale_evidence' || code === 'no_evidence' || code === 'insufficient_volume')
    return { health: 'unknown', reasons: [reason ?? 'no_evidence'] }
  }
  if (enabled.some((engine) => engine.health === 'degraded')) {
    return { health: 'degraded', reasons: ['elevated_failure_rate'] }
  }
  return { health: 'healthy', reasons: ['operating_normally'] }
}

export function buildSystemHealthProjection(
  events: readonly AdminOperationalEvent[],
  options: BuildSystemHealthOptions = {},
): SystemHealthProjection {
  const now = options.now ?? new Date()
  const nowMs = now.getTime()
  if (!Number.isFinite(nowMs)) throw new TypeError('valid observation time required')
  const selectedWindow = options.selectedWindow ?? '1h'
  if (!SYSTEM_HEALTH_WINDOWS.includes(selectedWindow)) throw new TypeError('invalid health window')
  const historyStart = selectedHistoryStart(now, selectedWindow)
  const evaluationStart = nowMs - SYSTEM_HEALTH_THRESHOLDS.primaryEvaluationWindowMs
  const previousStart = historyStart - (nowMs - historyStart)
  const incomplete = options.sourceTruncated === true || (options.rejectedRows ?? 0) > 0
  const evaluationEvents = events.filter((event) => inWindow(event, evaluationStart, nowMs))
  const historyEvents = events.filter((event) => inWindow(event, historyStart, nowMs))

  const engines = ADMIN_ENGINE_IDS.map((engineId): EngineHealthProjection => {
    const allEngineEvents = events.filter((event) => event.engine === engineId && (instantMs(event.occurredAt) ?? Infinity) <= nowMs)
    const engineEvents = evaluationEvents.filter((event) => event.engine === engineId)
    const latest = latestEvent(allEngineEvents)
    const freshness = freshnessFor(latest, nowMs)
    const evaluation = evaluate(
      engineEvents,
      freshness,
      options.disabledEngines?.has(engineId) === true,
      incomplete,
    )
    return Object.freeze({
      engineId,
      health: evaluation.health,
      freshness,
      observedAt: latest?.occurredAt ?? null,
      windowStart: new Date(evaluationStart).toISOString(),
      windowEnd: now.toISOString(),
      appVersion: latest?.appVersion ?? null,
      engineVersion: latest?.engineVersion ?? null,
      curriculumVersion: latest?.curriculumVersion ?? null,
      eventCount: engineEvents.length,
      ...evaluation.metrics,
      p50LatencyMs: evaluation.p50LatencyMs,
      p95LatencyMs: evaluation.p95LatencyMs,
      reasonCodes: Object.freeze([...evaluation.reasons]),
    })
  })

  const services = SERVICE_IDS.map((serviceId): ServiceHealthProjection => {
    const allServiceEvents = serviceEvents(events, serviceId)
      .filter((event) => (instantMs(event.occurredAt) ?? Infinity) <= nowMs)
    const current = serviceEvents(evaluationEvents, serviceId)
    const latest = latestEvent(allServiceEvents)
    const freshness = freshnessFor(latest, nowMs)
    const disabled = (serviceId === 'anthropic_gateway' && options.disabledEngines?.has('gateway') === true)
      || (serviceId === 'tts_gateway' && options.disabledEngines?.has('tts') === true)
    const evaluation = evaluate(current, freshness, disabled, incomplete)
    return Object.freeze({
      serviceId,
      health: evaluation.health,
      freshness,
      observedAt: latest?.occurredAt ?? null,
      eventCount: current.length,
      failureCount: evaluation.metrics.timeoutCount
        + evaluation.metrics.providerErrorCount
        + evaluation.metrics.validationErrorCount,
      p95LatencyMs: evaluation.p95LatencyMs,
      reasonCodes: Object.freeze([...evaluation.reasons]),
    })
  })

  const overall = overallHealth(engines)
  const latest = latestEvent(events.filter((event) => (instantMs(event.occurredAt) ?? Infinity) <= nowMs))
  const currentFailures = failureEvents(historyEvents).length
  const historyRates = rateMetrics(historyEvents)
  const historyDurations = historyEvents.flatMap((event) => event.durationMs === null ? [] : [event.durationMs])
  const previousEvents = events.filter((event) => inWindow(event, previousStart, historyStart))
  const previousFailures = failureEvents(previousEvents).length
  const canTrend = !incomplete && (historyEvents.length > 0 || previousEvents.length > 0)
  const failureTrend = !canTrend
    ? 'unknown'
    : currentFailures > previousFailures
      ? 'increasing'
      : currentFailures < previousFailures
        ? 'decreasing'
        : 'stable'
  const incidents = historyEvents
    .filter((event): event is AdminOperationalEvent & { result: SystemHealthIncident['result'] } =>
      ['fallback', 'timeout', 'provider_error', 'validation_error'].includes(event.result))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, SYSTEM_HEALTH_THRESHOLDS.maximumIncidents)
    .map((event) => Object.freeze({
      occurredAt: event.occurredAt,
      engineId: event.engine,
      serviceId: serviceFor(event),
      result: event.result,
      reasonCode: incidentReason(event),
    }))

  return Object.freeze({
    contractVersion: ADMIN_CONTRACT_VERSION,
    generatedAt: now.toISOString(),
    selectedWindow,
    historyWindow: Object.freeze({ start: new Date(historyStart).toISOString(), end: now.toISOString() }),
    evaluationWindow: Object.freeze({ start: new Date(evaluationStart).toISOString(), end: now.toISOString() }),
    evidenceCompleteness: (options.rejectedRows ?? 0) > 0
      ? 'invalid_rows_rejected'
      : options.sourceTruncated
        ? 'truncated'
        : 'complete',
    overallHealth: overall.health,
    overallReasonCodes: Object.freeze([...overall.reasons]),
    observedAt: latest?.occurredAt ?? null,
    freshness: freshnessFor(latest, nowMs),
    failureTrend,
    currentFailureCount: canTrend ? currentFailures : null,
    previousFailureCount: canTrend ? previousFailures : null,
    historyMetrics: Object.freeze({
      eventCount: historyEvents.length,
      ...historyRates,
      p50LatencyMs: percentile(historyDurations, 50),
      p95LatencyMs: percentile(historyDurations, 95),
    }),
    engines: Object.freeze(engines),
    services: Object.freeze(services),
    incidents: Object.freeze(incidents),
  })
}
