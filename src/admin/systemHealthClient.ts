import { getGatewayAccessToken } from '../tutor/gatewayAuth'
import {
  AdminDependencyTimeoutError,
  withAdminDependencyTimeout,
} from './adminDependencyTimeout'
import {
  ADMIN_CONTRACT_VERSION,
  ADMIN_ENGINE_IDS,
  ADMIN_HEALTH_STATES,
  type AdminEngineId,
} from './contracts'
import {
  SYSTEM_HEALTH_REASON_CODES,
  SYSTEM_HEALTH_THRESHOLDS,
  SYSTEM_HEALTH_WINDOWS,
  SYSTEM_INCIDENT_REASON_CODES,
  type EngineHealthProjection,
  type HealthRateMetrics,
  type ServiceHealthProjection,
  type SystemHealthIncident,
  type SystemHealthProjection,
  type SystemHealthReasonCode,
  type SystemHealthWindow,
} from './systemHealth'

export const ADMIN_HEALTH_ENDPOINT = '/api/admin/v1/health'
export const ADMIN_HEALTH_TIMEOUT_MS = 5_000

export type SystemHealthReadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly projection: SystemHealthProjection }
  | { readonly status: 'denied' }
  | { readonly status: 'error'; readonly code: 'health_timeout' | 'health_unavailable' }

type FetchLike = (url: string, init: RequestInit) => Promise<{
  readonly status: number
  json(): Promise<unknown>
}>

interface ReadSystemHealthOptions {
  readonly window: SystemHealthWindow
  readonly getAccessToken?: () => Promise<string | null>
  readonly fetchImpl?: FetchLike
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  const candidate = record(value)
  if (!candidate) return null
  const actual = Object.keys(candidate)
  return actual.length === keys.length && actual.every((key) => keys.includes(key))
    ? candidate
    : null
}

function instant(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value
}

function nullableInstant(value: unknown): value is string | null {
  return value === null || instant(value)
}

function nullableString(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/.test(value))
}

function count(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function nullableCount(value: unknown): value is number | null {
  return value === null || count(value)
}

function nullableRate(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100)
}

function knownReasons(value: unknown): value is SystemHealthProjection['overallReasonCodes'] {
  return Array.isArray(value) && value.length <= SYSTEM_HEALTH_REASON_CODES.length
    && value.every((item) => typeof item === 'string' && SYSTEM_HEALTH_REASON_CODES.includes(item as never))
}

const RATE_KEYS = [
  'eligibleEventCount', 'successCount', 'successRatePercent', 'fallbackCount',
  'fallbackRatePercent', 'rejectedCount', 'timeoutCount', 'timeoutRatePercent',
  'providerErrorCount', 'providerErrorRatePercent', 'validationErrorCount', 'safetyStopCount',
] as const

function rateMetrics(candidate: Record<string, unknown>): candidate is Record<string, unknown> & HealthRateMetrics {
  return count(candidate.eligibleEventCount)
    && count(candidate.successCount)
    && nullableRate(candidate.successRatePercent)
    && count(candidate.fallbackCount)
    && nullableRate(candidate.fallbackRatePercent)
    && count(candidate.rejectedCount)
    && count(candidate.timeoutCount)
    && nullableRate(candidate.timeoutRatePercent)
    && count(candidate.providerErrorCount)
    && nullableRate(candidate.providerErrorRatePercent)
    && count(candidate.validationErrorCount)
    && count(candidate.safetyStopCount)
}

const ENGINE_KEYS = [
  'engineId', 'health', 'freshness', 'observedAt', 'windowStart', 'windowEnd',
  'appVersion', 'engineVersion', 'curriculumVersion', 'eventCount', ...RATE_KEYS,
  'p50LatencyMs', 'p95LatencyMs', 'reasonCodes',
] as const

function engine(value: unknown, expectedId: AdminEngineId): EngineHealthProjection | null {
  const candidate = exact(value, ENGINE_KEYS)
  if (
    !candidate
    || candidate.engineId !== expectedId
    || !ADMIN_HEALTH_STATES.includes(candidate.health as never)
    || !['current', 'stale', 'no_evidence'].includes(candidate.freshness as string)
    || !nullableInstant(candidate.observedAt)
    || !instant(candidate.windowStart)
    || !instant(candidate.windowEnd)
    || !nullableString(candidate.appVersion)
    || !nullableString(candidate.engineVersion)
    || !nullableString(candidate.curriculumVersion)
    || !count(candidate.eventCount)
    || !rateMetrics(candidate)
    || !nullableCount(candidate.p50LatencyMs)
    || !nullableCount(candidate.p95LatencyMs)
    || !knownReasons(candidate.reasonCodes)
  ) return null
  return candidate as unknown as EngineHealthProjection
}

const SERVICE_IDS = [
  'admin_api', 'persistence', 'anthropic_gateway', 'tts_gateway', 'sync', 'curriculum_read',
] as const
const SERVICE_KEYS = [
  'serviceId', 'health', 'freshness', 'observedAt', 'eventCount', 'failureCount',
  'p95LatencyMs', 'reasonCodes',
] as const

function service(value: unknown, expectedId: (typeof SERVICE_IDS)[number]): ServiceHealthProjection | null {
  const candidate = exact(value, SERVICE_KEYS)
  if (
    !candidate
    || candidate.serviceId !== expectedId
    || !ADMIN_HEALTH_STATES.includes(candidate.health as never)
    || !['current', 'stale', 'no_evidence'].includes(candidate.freshness as string)
    || !nullableInstant(candidate.observedAt)
    || !count(candidate.eventCount)
    || !count(candidate.failureCount)
    || !nullableCount(candidate.p95LatencyMs)
    || !knownReasons(candidate.reasonCodes)
  ) return null
  return candidate as unknown as ServiceHealthProjection
}

const INCIDENT_KEYS = ['occurredAt', 'engineId', 'serviceId', 'result', 'reasonCode'] as const

function incident(value: unknown): SystemHealthIncident | null {
  const candidate = exact(value, INCIDENT_KEYS)
  if (
    !candidate
    || !instant(candidate.occurredAt)
    || !ADMIN_ENGINE_IDS.includes(candidate.engineId as never)
    || ![...SERVICE_IDS, 'academy_engine'].includes(candidate.serviceId as never)
    || !['fallback', 'timeout', 'provider_error', 'validation_error'].includes(candidate.result as string)
    || !SYSTEM_INCIDENT_REASON_CODES.includes(candidate.reasonCode as never)
  ) return null
  return candidate as unknown as SystemHealthIncident
}

function windowRange(value: unknown): { readonly start: string; readonly end: string } | null {
  const candidate = exact(value, ['start', 'end'])
  return candidate && instant(candidate.start) && instant(candidate.end)
    ? candidate as unknown as { readonly start: string; readonly end: string }
    : null
}

const PROJECTION_KEYS = [
  'contractVersion', 'generatedAt', 'selectedWindow', 'historyWindow', 'evaluationWindow',
  'evidenceCompleteness', 'overallHealth', 'overallReasonCodes', 'observedAt', 'freshness',
  'failureTrend', 'currentFailureCount', 'previousFailureCount', 'historyMetrics', 'engines', 'services', 'incidents',
] as const

const HISTORY_KEYS = ['eventCount', ...RATE_KEYS, 'p50LatencyMs', 'p95LatencyMs'] as const
const CRITICAL_ENGINES = new Set<AdminEngineId>([
  'tutor', 'study', 'assessment', 'curriculum', 'gateway', 'sync',
])

function historyMetrics(value: unknown): boolean {
  const candidate = exact(value, HISTORY_KEYS)
  return candidate !== null
    && count(candidate.eventCount)
    && rateMetrics(candidate)
    && nullableCount(candidate.p50LatencyMs)
    && nullableCount(candidate.p95LatencyMs)
}

function derivedOverallHealth(engines: readonly EngineHealthProjection[]): EngineHealthProjection['health'] {
  const critical = engines.filter((item) => CRITICAL_ENGINES.has(item.engineId) && item.health !== 'disabled')
  const enabled = engines.filter((item) => item.health !== 'disabled')
  if (critical.some((item) => item.health === 'unavailable')) return 'unavailable'
  if (critical.some((item) => item.health === 'degraded') || enabled.some((item) => item.health === 'unavailable')) return 'degraded'
  if (critical.length === 0 || critical.some((item) => item.health === 'unknown')) return 'unknown'
  if (enabled.some((item) => item.health === 'degraded')) return 'degraded'
  return 'healthy'
}

function expectedRate(numerator: number, denominator: number): number | null {
  return denominator < SYSTEM_HEALTH_THRESHOLDS.minimumRateEvents
    ? null
    : Math.round((numerator / denominator) * 1_000) / 10
}

function consistentRates(value: HealthRateMetrics, eventCount: number): boolean {
  return value.eligibleEventCount === value.successCount + value.fallbackCount
      + value.timeoutCount + value.providerErrorCount + value.validationErrorCount
    && eventCount === value.eligibleEventCount + value.rejectedCount + value.safetyStopCount
    && value.successRatePercent === expectedRate(value.successCount, value.eligibleEventCount)
    && value.fallbackRatePercent === expectedRate(value.fallbackCount, value.eligibleEventCount)
    && value.timeoutRatePercent === expectedRate(value.timeoutCount, value.eligibleEventCount)
    && value.providerErrorRatePercent === expectedRate(value.providerErrorCount, value.eligibleEventCount)
}

function expectedEngineState(
  item: EngineHealthProjection,
  incomplete: boolean,
): { health: EngineHealthProjection['health']; reasons: readonly SystemHealthReasonCode[] } {
  if (item.health === 'disabled') return { health: 'disabled', reasons: ['feature_disabled'] }
  if (incomplete) return { health: 'unknown', reasons: ['telemetry_incomplete'] }
  if (item.freshness === 'no_evidence') return { health: 'unknown', reasons: ['no_evidence'] }
  if (item.freshness === 'stale') return { health: 'unknown', reasons: ['stale_evidence'] }
  if (item.eligibleEventCount < SYSTEM_HEALTH_THRESHOLDS.minimumRateEvents) {
    return { health: 'unknown', reasons: ['insufficient_volume'] }
  }
  const failureCount = item.timeoutCount + item.providerErrorCount + item.validationErrorCount
  const failureRate = expectedRate(failureCount, item.eligibleEventCount) ?? 0
  if (failureCount >= SYSTEM_HEALTH_THRESHOLDS.unavailableFailureCount
    && failureRate >= SYSTEM_HEALTH_THRESHOLDS.unavailableFailureRatePercent) {
    return { health: 'unavailable', reasons: ['core_operation_unavailable'] }
  }
  const reasons: SystemHealthReasonCode[] = []
  if (failureCount >= SYSTEM_HEALTH_THRESHOLDS.degradedFailureCount
    && failureRate >= SYSTEM_HEALTH_THRESHOLDS.degradedFailureRatePercent) reasons.push('elevated_failure_rate')
  if (item.timeoutCount >= SYSTEM_HEALTH_THRESHOLDS.degradedTimeoutCount
    && (item.timeoutRatePercent ?? 0) >= SYSTEM_HEALTH_THRESHOLDS.degradedTimeoutRatePercent) reasons.push('elevated_timeout_rate')
  if (item.providerErrorCount >= SYSTEM_HEALTH_THRESHOLDS.degradedProviderErrorCount
    && (item.providerErrorRatePercent ?? 0) >= SYSTEM_HEALTH_THRESHOLDS.degradedProviderErrorRatePercent) reasons.push('elevated_provider_error_rate')
  if (item.fallbackCount >= SYSTEM_HEALTH_THRESHOLDS.degradedFallbackCount
    && (item.fallbackRatePercent ?? 0) >= SYSTEM_HEALTH_THRESHOLDS.degradedFallbackRatePercent) reasons.push('elevated_fallback_rate')
  if (item.p95LatencyMs !== null
    && item.p95LatencyMs >= SYSTEM_HEALTH_THRESHOLDS.degradedP95LatencyMs) reasons.push('elevated_latency')
  if (reasons.length > 0) return { health: 'degraded', reasons }
  return {
    health: 'healthy',
    reasons: item.safetyStopCount > 0
      ? ['operating_normally', 'safety_policy_working']
      : ['operating_normally'],
  }
}

function sameReasons(left: readonly SystemHealthReasonCode[], right: readonly SystemHealthReasonCode[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export function decodeSystemHealthProjection(value: unknown): SystemHealthProjection | null {
  const candidate = exact(value, PROJECTION_KEYS)
  if (
    !candidate
    || candidate.contractVersion !== ADMIN_CONTRACT_VERSION
    || !instant(candidate.generatedAt)
    || !SYSTEM_HEALTH_WINDOWS.includes(candidate.selectedWindow as never)
    || !windowRange(candidate.historyWindow)
    || !windowRange(candidate.evaluationWindow)
    || !['complete', 'truncated', 'invalid_rows_rejected'].includes(candidate.evidenceCompleteness as string)
    || !ADMIN_HEALTH_STATES.includes(candidate.overallHealth as never)
    || !knownReasons(candidate.overallReasonCodes)
    || !nullableInstant(candidate.observedAt)
    || !['current', 'stale', 'no_evidence'].includes(candidate.freshness as string)
    || !['increasing', 'stable', 'decreasing', 'unknown'].includes(candidate.failureTrend as string)
    || !nullableCount(candidate.currentFailureCount)
    || !nullableCount(candidate.previousFailureCount)
    || !historyMetrics(candidate.historyMetrics)
    || !Array.isArray(candidate.engines)
    || candidate.engines.length !== ADMIN_ENGINE_IDS.length
    || !Array.isArray(candidate.services)
    || candidate.services.length !== SERVICE_IDS.length
    || !Array.isArray(candidate.incidents)
    || candidate.incidents.length > 25
  ) return null
  const engines = candidate.engines.map((value, index) => engine(value, ADMIN_ENGINE_IDS[index]))
  const services = candidate.services.map((value, index) => service(value, SERVICE_IDS[index]))
  const incidents = candidate.incidents.map(incident)
  if (engines.some((item) => item === null) || services.some((item) => item === null) || incidents.some((item) => item === null)) return null
  const trustedEngines = engines as EngineHealthProjection[]
  const trustedServices = services as ServiceHealthProjection[]
  const trustedHistory = candidate.historyMetrics as unknown as SystemHealthProjection['historyMetrics']
  const incomplete = candidate.evidenceCompleteness !== 'complete'
  if (
    trustedEngines.some((item) => {
      const expected = expectedEngineState(item, incomplete)
      return !consistentRates(item, item.eventCount)
        || item.health !== expected.health || !sameReasons(item.reasonCodes, expected.reasons)
    })
    || trustedServices.some((item) => item.health === 'healthy' && (
      item.freshness !== 'current' || !item.reasonCodes.includes('operating_normally')
      || item.eventCount < SYSTEM_HEALTH_THRESHOLDS.minimumRateEvents
      || item.failureCount > item.eventCount
      || (item.p95LatencyMs !== null && item.p95LatencyMs >= SYSTEM_HEALTH_THRESHOLDS.degradedP95LatencyMs)
    ))
    || !consistentRates(trustedHistory, trustedHistory.eventCount)
    || candidate.overallHealth !== derivedOverallHealth(trustedEngines)
    || (candidate.overallHealth === 'healthy' && (
      candidate.evidenceCompleteness !== 'complete'
      || candidate.freshness !== 'current'
      || !candidate.overallReasonCodes.includes('operating_normally')
    ))
  ) return null
  return Object.freeze({
    ...candidate,
    historyWindow: windowRange(candidate.historyWindow)!,
    evaluationWindow: windowRange(candidate.evaluationWindow)!,
    engines: Object.freeze(trustedEngines),
    services: Object.freeze(trustedServices),
    incidents: Object.freeze(incidents as SystemHealthIncident[]),
  }) as unknown as SystemHealthProjection
}

export async function readSystemHealth(options: ReadSystemHealthOptions): Promise<SystemHealthReadState> {
  const getAccessToken = options.getAccessToken ?? getGatewayAccessToken
  const fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init))
  let accessToken: string | null
  try {
    accessToken = await withAdminDependencyTimeout(
      () => getAccessToken(), options.timeoutMs ?? ADMIN_HEALTH_TIMEOUT_MS,
    )
  } catch (error) {
    return {
      status: 'error',
      code: error instanceof AdminDependencyTimeoutError ? 'health_timeout' : 'health_unavailable',
    }
  }
  if (options.signal?.aborted) return { status: 'error', code: 'health_unavailable' }
  if (!accessToken) return { status: 'denied' }

  const controller = new AbortController()
  const cancel = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', cancel, { once: true })
  const timer = globalThis.setTimeout(() => controller.abort(), options.timeoutMs ?? ADMIN_HEALTH_TIMEOUT_MS)
  try {
    const response = await withAdminDependencyTimeout((timeoutSignal) => fetchImpl(`${ADMIN_HEALTH_ENDPOINT}?window=${options.window}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.any([controller.signal, timeoutSignal]),
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    }), options.timeoutMs ?? ADMIN_HEALTH_TIMEOUT_MS)
    if (response.status === 401 || response.status === 403) return { status: 'denied' }
    if (response.status !== 200) return { status: 'error', code: 'health_unavailable' }
    const projection = decodeSystemHealthProjection(await response.json())
    return projection ? { status: 'ready', projection } : { status: 'error', code: 'health_unavailable' }
  } catch (error) {
    return {
      status: 'error',
      code: controller.signal.aborted || error instanceof AdminDependencyTimeoutError
        ? 'health_timeout' : 'health_unavailable',
    }
  } finally {
    globalThis.clearTimeout(timer)
    options.signal?.removeEventListener('abort', cancel)
  }
}
