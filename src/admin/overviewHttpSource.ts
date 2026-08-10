import { ADMIN_CONTRACT_VERSION, ADMIN_ENGINE_IDS, ADMIN_HEALTH_STATES, isCanonicalIntegerMicros, type AdminBillingDisposition, type AdminCostKind, type AdminEngineId, type AdminHealthState } from './contracts'
import { getGatewayAccessToken } from '../tutor/gatewayAuth'
import type { AdminOverviewModel, Metric, OverviewDomain, OverviewDomainStatus, OverviewRange, PresentedSpend } from './overviewModel'
import { parseAdminMonthlyCostAlert, parseAdminProviderAccountingCoverage } from './costsModel'

export const ADMIN_OVERVIEW_ENDPOINT = '/api/admin/v1/overview'
const TIMEOUT_MS = 10_000
const DOMAIN_NAMES: readonly OverviewDomain[] = ['academy', 'learners', 'engineHealth', 'enginePerformance', 'costs', 'safety', 'system', 'curriculum']

type FetchLike = (url: string, init: RequestInit) => Promise<{ readonly status: number; json(): Promise<unknown> }>

export class AdminOverviewReadError extends Error {
  constructor(readonly code: 'overview_unauthorized' | 'overview_timeout' | 'overview_unavailable' | 'invalid_range') {
    super(code)
    this.name = 'AdminOverviewReadError'
  }
}

interface ReadOptions {
  readonly getAccessToken?: () => Promise<string | null>
  readonly fetchImpl?: FetchLike
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function instant(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function countMetric(value: unknown): Metric<number> {
  const source = record(value)
  if (source?.status === 'available' && Number.isSafeInteger(source.value) && Number(source.value) >= 0) {
    return { status: 'available', value: Number(source.value) }
  }
  return { status: source?.status === 'unavailable' ? 'unavailable' : 'unknown' }
}

function stringMetric(value: unknown): Metric<string> {
  const source = record(value)
  if (source?.status === 'available' && typeof source.value === 'string' && source.value.length <= 128) {
    return { status: 'available', value: source.value }
  }
  return { status: source?.status === 'unavailable' ? 'unavailable' : 'unknown' }
}

function healthMetric(value: unknown): Metric<AdminHealthState> {
  const source = record(value)
  if (source?.status === 'available' && ADMIN_HEALTH_STATES.includes(source.value as AdminHealthState)) {
    return { status: 'available', value: source.value as AdminHealthState }
  }
  return { status: source?.status === 'unavailable' ? 'unavailable' : 'unknown' }
}

function domainStatus(value: unknown): OverviewDomainStatus | null {
  const source = record(value)
  const sourceWindow = record(source?.window)
  if (
    !source || !sourceWindow
    || !['available', 'unavailable'].includes(String(source.availability))
    || !['current', 'stale', 'unknown'].includes(String(source.freshness))
    || !['complete', 'partial', 'truncated', 'unknown'].includes(String(source.completeness))
    || !['current', 'stale', 'partial', 'unavailable', 'unknown'].includes(String(source.observationStatus))
    || typeof sourceWindow.label !== 'string' || sourceWindow.label.length > 160
  ) return null
  return {
    availability: source.availability as OverviewDomainStatus['availability'],
    freshness: source.freshness as OverviewDomainStatus['freshness'],
    completeness: source.completeness as OverviewDomainStatus['completeness'],
    observationStatus: source.observationStatus as OverviewDomainStatus['observationStatus'],
    windowLabel: sourceWindow.label,
  }
}

function metricFromCost(value: unknown): Metric<number> {
  const source = record(value)
  if ((source?.status === 'available' || source?.status === 'partial') && Number.isSafeInteger(source.value) && Number(source.value) >= 0) {
    return { status: 'available', value: Number(source.value) }
  }
  return { status: source?.status === 'unavailable' ? 'unavailable' : 'unknown' }
}

function spendFromCost(
  value: unknown,
  costKind: Exclude<AdminCostKind, 'unavailable'>,
  costData: Record<string, unknown>,
  completeness: OverviewDomainStatus['completeness'],
): PresentedSpend {
  const source = record(value)
  const micros = typeof source?.micros === 'string' && isCanonicalIntegerMicros(source.micros) ? source.micros : null
  const billing = record(costData.billingDispositionCounts)
  const billable = Number(billing?.billable ?? 0)
  const notBillable = Number(billing?.notBillable ?? 0)
  const unknown = Number(billing?.unknown ?? 0)
  const billingDisposition: AdminBillingDisposition = unknown === 0 && billable > 0 && notBillable === 0
    ? 'billable'
    : unknown === 0 && notBillable > 0 && billable === 0 ? 'not_billable' : 'unknown'
  const reasons = Array.isArray(costData.reasons) ? costData.reasons : []
  const aggregateCompleteness = completeness === 'complete'
    ? 'complete'
    : reasons.includes('ambiguous_attribution')
      ? 'partial_attribution_ambiguous'
      : reasons.includes('unresolved_attribution')
        ? 'partial_attribution_unresolved'
        : 'partial_usage_unavailable'
  const context = {
    costKind,
    billingDisposition,
    currency: 'USD' as const,
    completeness: aggregateCompleteness as PresentedSpend['completeness'],
    result: null,
    resultReasonCode: reasons.includes('usage_unavailable') ? 'missing_provider_usage' as const : null,
  }
  return micros === null
    ? ({
        ...context,
        status: source?.status === 'available' || source?.status === 'partial' ? 'unknown' : 'unavailable',
        costKind: source?.status === 'available' || source?.status === 'partial' ? costKind : 'unavailable',
      } as PresentedSpend)
    : { ...context, status: 'available', costMicros: micros, costKind }
}

function selectedRange(range: Record<string, unknown>): OverviewRange | null {
  if (range.kind === 'custom' && typeof range.start === 'string' && typeof range.end === 'string') {
    return { kind: 'custom', start: range.start, end: range.end }
  }
  if (['today', '7-days', '30-days', 'school-year'].includes(String(range.kind))) {
    return { kind: 'preset', preset: range.kind as 'today' | '7-days' | '30-days' | 'school-year' }
  }
  return null
}

export function parseAdminOverview(value: unknown): AdminOverviewModel | null {
  const source = record(value)
  const range = record(source?.range)
  if (!source || source.contractVersion !== ADMIN_CONTRACT_VERSION || !instant(source.generatedAt) || !range) return null
  const selection = selectedRange(range)
  if (!selection) return null
  const statuses = {} as Record<OverviewDomain, OverviewDomainStatus>
  for (const name of DOMAIN_NAMES) {
    const status = domainStatus(source[name])
    if (!status) return null
    statuses[name] = status
  }
  const academy = record(record(source.academy)?.data) ?? {}
  const learners = record(record(source.learners)?.data) ?? {}
  const health = record(record(source.engineHealth)?.data) ?? {}
  const performance = record(record(source.enginePerformance)?.data) ?? {}
  const costs = record(record(source.costs)?.data) ?? {}
  const providerAccounting = parseAdminProviderAccountingCoverage(costs.providerAccountingCoverage)
  const monthlyCostAlert = parseAdminMonthlyCostAlert(costs.monthlyCostAlert)
  const safety = record(record(source.safety)?.data) ?? {}
  const system = record(record(source.system)?.data) ?? {}
  const curriculum = record(record(source.curriculum)?.data) ?? {}
  const healthEngines = Array.isArray(health.engines) ? health.engines : []
  const engines = healthEngines.flatMap((value) => {
    const engine = record(value)
    if (!engine || !ADMIN_ENGINE_IDS.includes(engine.engineId as AdminEngineId) || !ADMIN_HEALTH_STATES.includes(engine.health as AdminHealthState)) return []
    return [{
      engineId: engine.engineId as AdminEngineId,
      health: engine.health as AdminHealthState,
      appVersion: typeof engine.appVersion === 'string' ? engine.appVersion : null,
      engineVersion: typeof engine.engineVersion === 'string' ? engine.engineVersion : null,
      observedAt: instant(engine.observedAt) ? engine.observedAt : null,
      windowStart: instant(engine.windowStart) ? engine.windowStart : source.generatedAt as string,
      windowEnd: instant(engine.windowEnd) ? engine.windowEnd : source.generatedAt as string,
      reasonCodes: [],
    }]
  })
  const performanceEngines = Array.isArray(performance.engines) ? performance.engines.flatMap((value) => {
    const engine = record(value)
    return engine && ADMIN_ENGINE_IDS.includes(engine.engineId as AdminEngineId)
      && ['available', 'partial', 'insufficient_evidence', 'unavailable'].includes(String(engine.evidenceState))
      ? [{ engineId: engine.engineId as AdminEngineId, evidenceState: engine.evidenceState as 'available' | 'partial' | 'insufficient_evidence' | 'unavailable' }]
      : []
  }) : []
  const observedAt = DOMAIN_NAMES.flatMap((name) => {
    const candidate = record(record(source[name])?.window)?.observedAt
    return instant(candidate) ? [candidate] : []
  }).sort().at(-1) ?? null
  const partial = Object.values(statuses).some((status) => status.observationStatus === 'partial')
  const stale = Object.values(statuses).some((status) => status.observationStatus === 'stale')
  if (statuses.costs.availability === 'available' && (
    !providerAccounting || !monthlyCostAlert
    || costs.activeCriticalCostAlert !== monthlyCostAlert.activeCritical
  )) return null
  return {
    contractVersion: ADMIN_CONTRACT_VERSION,
    range: selection,
    observedAt,
    freshness: stale || partial ? 'stale' : 'current',
    staleReasonCode: partial ? 'telemetry_incomplete' : stale ? 'refresh_delayed' : undefined,
    academy: {
      environment: stringMetric(academy.environment),
      appVersion: stringMetric(academy.appVersion),
      curriculumVersion: stringMetric(academy.curriculumVersion),
      overallHealth: healthMetric(academy.overallTechnicalHealth),
      lastSuccessfulDataRefresh: stringMetric(academy.lastSuccessfulRefresh),
    },
    learners: {
      activeLearners: countMetric(learners.activeLearners),
      lessonsStarted: countMetric(learners.lessonsStarted),
      lessonsCompleted: countMetric(learners.lessonsCompleted),
      studySessions: countMetric(learners.studySessions),
      instructionalMinutes: countMetric(learners.instructionalMinutes),
    },
    engines,
    enginePerformance: performanceEngines,
    ai: {
      requests: metricFromCost(costs.requests),
      inputTokens: metricFromCost(costs.inputTokens),
      outputTokens: metricFromCost(costs.outputTokens),
      cachedInputReadTokens: metricFromCost(costs.cachedInputReadTokens),
      cachedInputWriteTokens: metricFromCost(costs.cachedInputWriteTokens),
      ttsCharacters: metricFromCost(costs.ttsCharacters),
      spend: spendFromCost(costs.calculatedCost, 'calculated', costs, statuses.costs.completeness),
      reconciledSpend: spendFromCost(costs.reconciledCost, 'reconciled', costs, statuses.costs.completeness),
      ...(providerAccounting ? { providerAccounting } : {}),
      ...(monthlyCostAlert ? {
        monthlyCostAlert,
        activeCriticalCostAlert: monthlyCostAlert.activeCritical,
      } : {}),
    },
    safety: {
      openSafetyStops: countMetric(safety.openSafetyStops),
      adultReviewsPending: countMetric(safety.adultReviewsPending),
      safeguardFailures: countMetric(safety.failClosedEvents),
    },
    system: {
      apiErrorRatePercent: countMetric(system.apiErrorRatePercent),
      latencyMs: countMetric(system.medianLatencyMs),
      syncFailures: countMetric(system.syncFailures),
      persistenceFailures: countMetric(system.persistenceFailures),
    },
    curriculum: {
      publishedVersion: stringMetric(curriculum.publishedVersion),
      validationState: stringMetric(curriculum.validationState),
      validatedAt: stringMetric(curriculum.validatedAt),
      validationArtifactVersion: stringMetric(curriculum.validationArtifactVersion),
      coverageWarning: stringMetric(curriculum.coverageWarning),
    },
    domainStatuses: statuses,
  }
}

function queryFor(range: OverviewRange): string {
  const query = new URLSearchParams()
  if (range.kind === 'preset') query.set('range', range.preset)
  else {
    query.set('range', 'custom')
    query.set('start', range.start)
    query.set('end', range.end)
  }
  return query.toString()
}

export async function readAdminOverview(range: OverviewRange, options: ReadOptions = {}): Promise<AdminOverviewModel> {
  const getAccessToken = options.getAccessToken ?? getGatewayAccessToken
  const fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init))
  const token = await getAccessToken().catch(() => null)
  if (!token) throw new AdminOverviewReadError('overview_unauthorized')
  const controller = new AbortController()
  const cancel = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', cancel, { once: true })
  const timer = globalThis.setTimeout(() => controller.abort(), options.timeoutMs ?? TIMEOUT_MS)
  try {
    const response = await fetchImpl(`${ADMIN_OVERVIEW_ENDPOINT}?${queryFor(range)}`, {
      method: 'GET', headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
      cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
    })
    if (response.status === 401 || response.status === 403) throw new AdminOverviewReadError('overview_unauthorized')
    if (response.status === 400) throw new AdminOverviewReadError('invalid_range')
    if (response.status !== 200) throw new AdminOverviewReadError('overview_unavailable')
    const model = parseAdminOverview(await response.json())
    if (!model) throw new AdminOverviewReadError('overview_unavailable')
    return model
  } catch (error) {
    if (error instanceof AdminOverviewReadError) throw error
    throw new AdminOverviewReadError(controller.signal.aborted ? 'overview_timeout' : 'overview_unavailable')
  } finally {
    globalThis.clearTimeout(timer)
    options.signal?.removeEventListener('abort', cancel)
  }
}
