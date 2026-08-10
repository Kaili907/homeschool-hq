import { isCanonicalIntegerMicros, type IntegerMicros } from './contracts'

export const ADMIN_COST_PRESETS = ['today', '7-days', '30-days', 'month'] as const
export type AdminCostPreset = (typeof ADMIN_COST_PRESETS)[number]

export type AdminCostRangeSelection =
  | { readonly kind: 'preset'; readonly preset: AdminCostPreset }
  | { readonly kind: 'custom'; readonly start: string; readonly end: string }

export type AdminCostMetricStatus = 'available' | 'partial' | 'unavailable'

export interface AdminCostCountMetric {
  readonly status: AdminCostMetricStatus
  readonly value: number | null
}

export interface AdminCostMoneyMetric {
  readonly status: AdminCostMetricStatus
  readonly micros: IntegerMicros | null
  readonly currency: 'USD'
}

export interface AdminCostAggregate {
  readonly totalRequests: AdminCostCountMetric
  readonly aiRequests: AdminCostCountMetric
  readonly ttsRequests: AdminCostCountMetric
  readonly inputTokens: AdminCostCountMetric
  readonly outputTokens: AdminCostCountMetric
  readonly cachedInputReadTokens: AdminCostCountMetric
  readonly cachedInputWriteTokens: AdminCostCountMetric
  readonly ttsCharacters: AdminCostCountMetric
  readonly calculatedCost: AdminCostMoneyMetric
  readonly reconciledCost: AdminCostMoneyMetric
  readonly unavailableCostCount: number
}

export interface AdminCostSummary extends AdminCostAggregate {
  readonly usageUnavailableCount: number
  readonly billingDispositionCounts: {
    readonly billable: number
    readonly notBillable: number
    readonly unknown: number
  }
  readonly costKindCounts: {
    readonly calculated: number
    readonly reconciled: number
    readonly unavailable: number
  }
  readonly attributionCounts: {
    readonly resolved: number
    readonly ambiguous: number
    readonly unresolved: number
  }
}

export interface AdminCostTrendPoint extends AdminCostAggregate {
  readonly date: string
}

export interface AdminCostBreakdownRow extends AdminCostAggregate {
  readonly key: string
  readonly label: string
}

export type AdminProviderAccountingCoverageStatus =
  | 'complete_for_journaled_attempts'
  | 'partial'
  | 'gaps_detected'
  | 'reconciliation_conflict'
  | 'unavailable'
  | 'insufficient_evidence'

export type AdminProviderAccountingReconciliationState =
  | 'clear_for_journaled_attempts'
  | 'in_progress'
  | 'gaps_detected'
  | 'conflict'
  | 'unavailable'
  | 'insufficient_evidence'

export interface AdminProviderAccountingCoverageMetrics {
  readonly reservedAttempts: number
  readonly dispatchPossibleAttempts: number
  readonly observedOutcomes: number
  readonly ledgerLinkedAttempts: number
  readonly accountingGaps: number
  readonly gapPending: number
  readonly reconciliationConflicts: number
  readonly confirmedNotDispatched: number
  readonly unresolvable: number
}

export type AdminProviderInstrumentationStatus = 'covered'

export interface AdminProviderInstrumentationCoverage {
  readonly status: 'complete'
  readonly engines: readonly {
    readonly key: 'tutor' | 'jarvis' | 'tts' | 'study'
    readonly status: AdminProviderInstrumentationStatus
  }[]
}

export interface AdminProviderAccountingCoverageBreakdownRow
  extends AdminProviderAccountingCoverageMetrics {
  readonly key: string
  readonly status: Exclude<AdminProviderAccountingCoverageStatus, 'unavailable'>
}

export interface AdminProviderAccountingCoverage {
  readonly status: AdminProviderAccountingCoverageStatus
  readonly journalStatus: AdminProviderAccountingCoverageStatus
  readonly reconciliationState: AdminProviderAccountingReconciliationState
  readonly providerInstrumentation: AdminProviderInstrumentationCoverage
  readonly invoiceCompletenessClaim: false
  readonly metrics: AdminProviderAccountingCoverageMetrics | null
  readonly breakdowns: {
    readonly engines: readonly AdminProviderAccountingCoverageBreakdownRow[]
    readonly purposes: readonly AdminProviderAccountingCoverageBreakdownRow[]
    readonly providers: readonly AdminProviderAccountingCoverageBreakdownRow[]
  }
}

export interface AdminCostsModel {
  readonly contractVersion: 3
  readonly generatedAt: string
  readonly currency: 'USD'
  readonly range: {
    readonly kind: AdminCostPreset | 'custom'
    readonly start: string
    readonly end: string
    readonly startAt: string
    readonly endExclusive: string
    readonly days: number
  }
  readonly source: {
    readonly status: 'complete' | 'partial'
    readonly reasons: readonly AdminCostCompletenessReason[]
    readonly recordLimit: 500
    readonly recordsIncluded: number
  }
  readonly summary: AdminCostSummary
  readonly trend: readonly AdminCostTrendPoint[]
  readonly breakdowns: {
    readonly engines: readonly AdminCostBreakdownRow[]
    readonly providers: readonly AdminCostBreakdownRow[]
    readonly models: readonly AdminCostBreakdownRow[]
    readonly costKinds: readonly AdminCostBreakdownRow[]
    readonly billingDispositions: readonly AdminCostBreakdownRow[]
  }
  readonly providerAccountingCoverage: AdminProviderAccountingCoverage
}

export type AdminCostCompletenessReason =
  | 'source_record_limit'
  | 'ambiguous_attribution'
  | 'unresolved_attribution'
  | 'usage_unavailable'
  | 'calculated_cost_unavailable'

export type AdminCostsReadState =
  | { readonly status: 'idle' | 'loading' }
  | { readonly status: 'unauthorized' }
  | { readonly status: 'error'; readonly code: AdminCostsErrorCode }
  | { readonly status: 'ready'; readonly model: AdminCostsModel; readonly freshness: 'current' | 'stale' }

export type AdminCostsErrorCode = 'costs_timeout' | 'costs_unavailable' | 'invalid_range'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const METRIC_STATUSES = new Set<AdminCostMetricStatus>(['available', 'partial', 'unavailable'])
const REASONS = new Set<AdminCostCompletenessReason>([
  'source_record_limit',
  'ambiguous_attribution',
  'unresolved_attribution',
  'usage_unavailable',
  'calculated_cost_unavailable',
])
const BREAKDOWN_LABELS = new Set([
  'Tutor',
  'Study safety',
  'Jarvis',
  'Text to speech',
  'Anthropic',
  'ElevenLabs',
  'Anthropic Sonnet tier',
  'Anthropic Haiku tier',
  'ElevenLabs Turbo speech',
  'Calculated',
  'Reconciled',
  'Unavailable',
  'Billable',
  'Not billable',
  'Unknown',
])
const PROVIDER_COVERAGE_STATUSES = new Set<AdminProviderAccountingCoverageStatus>([
  'complete_for_journaled_attempts',
  'partial',
  'gaps_detected',
  'reconciliation_conflict',
  'unavailable',
  'insufficient_evidence',
])
const PROVIDER_RECONCILIATION_STATES = new Set<AdminProviderAccountingReconciliationState>([
  'clear_for_journaled_attempts',
  'in_progress',
  'gaps_detected',
  'conflict',
  'unavailable',
  'insufficient_evidence',
])
const PROVIDER_COVERAGE_METRIC_KEYS = [
  'reservedAttempts',
  'dispatchPossibleAttempts',
  'observedOutcomes',
  'ledgerLinkedAttempts',
  'accountingGaps',
  'gapPending',
  'reconciliationConflicts',
  'confirmedNotDispatched',
  'unresolvable',
] as const
const PROVIDER_INSTRUMENTATION_STATUSES = Object.freeze({
  tutor: 'covered',
  jarvis: 'covered',
  tts: 'covered',
  study: 'covered',
} as const)
const PROVIDER_COVERAGE_DIMENSIONS = {
  engines: new Set<string>(['tutor', 'study', 'jarvis', 'tts']),
  purposes: new Set<string>(['tutor_turn', 'jarvis_turn', 'tts_synthesis', 'safety_classification']),
  providers: new Set<string>(['anthropic', 'elevenlabs']),
} as const

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function safeCount(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : null
}

function countMetric(value: unknown): AdminCostCountMetric | null {
  const source = record(value)
  if (!source || !METRIC_STATUSES.has(source.status as AdminCostMetricStatus)) return null
  if (source.status === 'unavailable') {
    return source.value === null ? { status: 'unavailable', value: null } : null
  }
  const count = safeCount(source.value)
  return count === null ? null : { status: source.status, value: count } as AdminCostCountMetric
}

function moneyMetric(value: unknown): AdminCostMoneyMetric | null {
  const source = record(value)
  if (!source || !METRIC_STATUSES.has(source.status as AdminCostMetricStatus) || source.currency !== 'USD') return null
  if (source.status === 'unavailable') {
    return source.micros === null ? { status: 'unavailable', micros: null, currency: 'USD' } : null
  }
  if (typeof source.micros !== 'string' || !isCanonicalIntegerMicros(source.micros)) return null
  return { status: source.status, micros: source.micros, currency: 'USD' } as AdminCostMoneyMetric
}

function aggregate(value: unknown): AdminCostAggregate | null {
  const source = record(value)
  if (!source) return null
  const totalRequests = countMetric(source.totalRequests)
  const aiRequests = countMetric(source.aiRequests)
  const ttsRequests = countMetric(source.ttsRequests)
  const inputTokens = countMetric(source.inputTokens)
  const outputTokens = countMetric(source.outputTokens)
  const cachedInputReadTokens = countMetric(source.cachedInputReadTokens)
  const cachedInputWriteTokens = countMetric(source.cachedInputWriteTokens)
  const ttsCharacters = countMetric(source.ttsCharacters)
  const calculatedCost = moneyMetric(source.calculatedCost)
  const reconciledCost = moneyMetric(source.reconciledCost)
  const unavailableCostCount = safeCount(source.unavailableCostCount)
  if (
    !totalRequests || !aiRequests || !ttsRequests || !inputTokens || !outputTokens
    || !cachedInputReadTokens || !cachedInputWriteTokens || !ttsCharacters
    || !calculatedCost || !reconciledCost || unavailableCostCount === null
  ) return null
  return {
    totalRequests,
    aiRequests,
    ttsRequests,
    inputTokens,
    outputTokens,
    cachedInputReadTokens,
    cachedInputWriteTokens,
    ttsCharacters,
    calculatedCost,
    reconciledCost,
    unavailableCostCount,
  }
}

function fixedCounts(value: unknown, keys: readonly string[]): Record<string, number> | null {
  const source = record(value)
  if (!source || Object.keys(source).length !== keys.length) return null
  const result: Record<string, number> = {}
  for (const key of keys) {
    const count = safeCount(source[key])
    if (count === null) return null
    result[key] = count
  }
  return result
}

function breakdownRows(value: unknown): AdminCostBreakdownRow[] | null {
  if (!Array.isArray(value) || value.length > 32) return null
  const rows: AdminCostBreakdownRow[] = []
  for (const item of value) {
    const source = record(item)
    const values = aggregate(item)
    if (
      !source || !values || typeof source.key !== 'string' || source.key.length > 80
      || typeof source.label !== 'string' || !BREAKDOWN_LABELS.has(source.label)
    ) return null
    rows.push({ key: source.key, label: source.label, ...values })
  }
  return rows
}

function providerCoverageMetrics(value: unknown): AdminProviderAccountingCoverageMetrics | null {
  const source = record(value)
  if (!source || Object.keys(source).length !== PROVIDER_COVERAGE_METRIC_KEYS.length) return null
  const metrics: Record<string, number> = {}
  for (const key of PROVIDER_COVERAGE_METRIC_KEYS) {
    const metric = safeCount(source[key])
    if (metric === null) return null
    metrics[key] = metric
  }
  return metrics as unknown as AdminProviderAccountingCoverageMetrics
}

function providerCoverageRows(
  value: unknown,
  dimension: keyof typeof PROVIDER_COVERAGE_DIMENSIONS,
): AdminProviderAccountingCoverageBreakdownRow[] | null {
  if (!Array.isArray(value) || value.length > PROVIDER_COVERAGE_DIMENSIONS[dimension].size) return null
  const rows: AdminProviderAccountingCoverageBreakdownRow[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const source = record(item)
    const metrics = source
      ? providerCoverageMetrics(Object.fromEntries(
        PROVIDER_COVERAGE_METRIC_KEYS.map((key) => [key, source[key]]),
      ))
      : null
    if (
      !source || !metrics || typeof source.key !== 'string'
      || !PROVIDER_COVERAGE_DIMENSIONS[dimension].has(source.key)
      || seen.has(source.key)
      || !PROVIDER_COVERAGE_STATUSES.has(source.status as AdminProviderAccountingCoverageStatus)
      || source.status === 'unavailable'
      || Object.keys(source).length !== PROVIDER_COVERAGE_METRIC_KEYS.length + 2
    ) return null
    rows.push({
      key: source.key,
      status: source.status as AdminProviderAccountingCoverageBreakdownRow['status'],
      ...metrics,
    })
    seen.add(source.key)
  }
  return rows
}

function providerInstrumentationCoverage(value: unknown): AdminProviderInstrumentationCoverage | null {
  const source = record(value)
  if (
    !source || source.status !== 'complete' || Object.keys(source).length !== 2
    || !Array.isArray(source.engines) || source.engines.length !== 4
  ) return null
  const seen = new Set<string>()
  const engines: AdminProviderInstrumentationCoverage['engines'][number][] = []
  for (const item of source.engines) {
    const row = record(item)
    const key = row?.key as keyof typeof PROVIDER_INSTRUMENTATION_STATUSES
    if (
      !row || Object.keys(row).length !== 2 || !(key in PROVIDER_INSTRUMENTATION_STATUSES)
      || row.status !== PROVIDER_INSTRUMENTATION_STATUSES[key] || seen.has(key)
    ) return null
    engines.push({ key, status: row.status as AdminProviderInstrumentationStatus })
    seen.add(key)
  }
  return { status: 'complete', engines }
}

export function parseAdminProviderAccountingCoverage(value: unknown): AdminProviderAccountingCoverage | null {
  const source = record(value)
  const breakdownsSource = record(source?.breakdowns)
  const instrumentation = providerInstrumentationCoverage(source?.providerInstrumentation)
  if (
    !source || !PROVIDER_COVERAGE_STATUSES.has(source.status as AdminProviderAccountingCoverageStatus)
    || !PROVIDER_COVERAGE_STATUSES.has(source.journalStatus as AdminProviderAccountingCoverageStatus)
    || !PROVIDER_RECONCILIATION_STATES.has(
      source.reconciliationState as AdminProviderAccountingReconciliationState,
    )
    || !instrumentation
    || source.invoiceCompletenessClaim !== false
    || !breakdownsSource || Object.keys(breakdownsSource).length !== 3
  ) return null

  const engines = providerCoverageRows(breakdownsSource.engines, 'engines')
  const purposes = providerCoverageRows(breakdownsSource.purposes, 'purposes')
  const providers = providerCoverageRows(breakdownsSource.providers, 'providers')
  if (!engines || !purposes || !providers) return null

  const expectedReconciliation = {
    complete_for_journaled_attempts: 'clear_for_journaled_attempts',
    partial: 'in_progress',
    gaps_detected: 'gaps_detected',
    reconciliation_conflict: 'conflict',
    unavailable: 'unavailable',
    insufficient_evidence: 'insufficient_evidence',
  } as const
  if (
    source.reconciliationState
    !== expectedReconciliation[source.journalStatus as AdminProviderAccountingCoverageStatus]
  ) return null
  const expectedOverall = source.journalStatus === 'complete_for_journaled_attempts'
    ? instrumentation.status === 'complete' ? source.journalStatus : 'partial'
    : source.journalStatus
  if (source.status !== expectedOverall) return null

  if (source.status === 'unavailable') {
    if (
      source.journalStatus !== 'unavailable' || source.metrics !== null
      || source.reconciliationState !== 'unavailable'
      || engines.length > 0 || purposes.length > 0 || providers.length > 0
    ) return null
    return {
      status: 'unavailable',
      journalStatus: 'unavailable',
      reconciliationState: 'unavailable',
      providerInstrumentation: instrumentation,
      invoiceCompletenessClaim: false,
      metrics: null,
      breakdowns: { engines, purposes, providers },
    }
  }

  const metrics = providerCoverageMetrics(source.metrics)
  if (!metrics) return null
  return {
    status: source.status as Exclude<AdminProviderAccountingCoverageStatus, 'unavailable'>,
    journalStatus: source.journalStatus as Exclude<AdminProviderAccountingCoverageStatus, 'unavailable'>,
    reconciliationState: source.reconciliationState as Exclude<
      AdminProviderAccountingReconciliationState,
      'unavailable'
    >,
    providerInstrumentation: instrumentation,
    invoiceCompletenessClaim: false,
    metrics,
    breakdowns: { engines, purposes, providers },
  }
}

export function parseAdminCostsModel(value: unknown): AdminCostsModel | null {
  const source = record(value)
  const range = record(source?.range)
  const sourceState = record(source?.source)
  const summarySource = record(source?.summary)
  const summaryAggregate = aggregate(summarySource)
  const billing = fixedCounts(summarySource?.billingDispositionCounts, ['billable', 'notBillable', 'unknown'])
  const costKinds = fixedCounts(summarySource?.costKindCounts, ['calculated', 'reconciled', 'unavailable'])
  const attribution = fixedCounts(summarySource?.attributionCounts, ['resolved', 'ambiguous', 'unresolved'])
  const usageUnavailableCount = safeCount(summarySource?.usageUnavailableCount)
  const coverage = parseAdminProviderAccountingCoverage(source?.providerAccountingCoverage)
  if (
    !source || source.contractVersion !== 3 || source.currency !== 'USD'
    || typeof source.generatedAt !== 'string' || Number.isNaN(Date.parse(source.generatedAt))
    || !range || !(ADMIN_COST_PRESETS as readonly string[]).concat('custom').includes(range.kind as string)
    || typeof range.start !== 'string' || !DATE.test(range.start)
    || typeof range.end !== 'string' || !DATE.test(range.end)
    || typeof range.startAt !== 'string' || Number.isNaN(Date.parse(range.startAt))
    || typeof range.endExclusive !== 'string' || Number.isNaN(Date.parse(range.endExclusive))
    || safeCount(range.days) === null || (range.days as number) < 1 || (range.days as number) > 366
    || !sourceState || !['complete', 'partial'].includes(sourceState.status as string)
    || !Array.isArray(sourceState.reasons) || sourceState.reasons.some((reason) => !REASONS.has(reason))
    || sourceState.recordLimit !== 500 || safeCount(sourceState.recordsIncluded) === null
    || !summaryAggregate || !billing || !costKinds || !attribution || usageUnavailableCount === null
    || !coverage
    || !Array.isArray(source.trend) || source.trend.length > 366
  ) return null

  const trend: AdminCostTrendPoint[] = []
  for (const item of source.trend) {
    const trendSource = record(item)
    const values = aggregate(item)
    if (!trendSource || !values || typeof trendSource.date !== 'string' || !DATE.test(trendSource.date)) return null
    trend.push({ date: trendSource.date, ...values })
  }

  const breakdownsSource = record(source.breakdowns)
  const engines = breakdownRows(breakdownsSource?.engines)
  const providers = breakdownRows(breakdownsSource?.providers)
  const models = breakdownRows(breakdownsSource?.models)
  const breakdownCostKinds = breakdownRows(breakdownsSource?.costKinds)
  const billingDispositions = breakdownRows(breakdownsSource?.billingDispositions)
  if (!engines || !providers || !models || !breakdownCostKinds || !billingDispositions) return null

  return {
    contractVersion: 3,
    generatedAt: source.generatedAt,
    currency: 'USD',
    range: range as unknown as AdminCostsModel['range'],
    source: {
      status: sourceState.status as 'complete' | 'partial',
      reasons: [...sourceState.reasons] as AdminCostCompletenessReason[],
      recordLimit: 500,
      recordsIncluded: sourceState.recordsIncluded as number,
    },
    summary: {
      ...summaryAggregate,
      usageUnavailableCount,
      billingDispositionCounts: billing as unknown as AdminCostSummary['billingDispositionCounts'],
      costKindCounts: costKinds as unknown as AdminCostSummary['costKindCounts'],
      attributionCounts: attribution as unknown as AdminCostSummary['attributionCounts'],
    },
    trend,
    breakdowns: { engines, providers, models, costKinds: breakdownCostKinds, billingDispositions },
    providerAccountingCoverage: coverage,
  }
}

export function validateAdminCostCustomRange(start: string, end: string, today: string): string | null {
  const calendarDate = (value: string) => {
    if (!DATE.test(value)) return false
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }
  if (!start || !end) return 'Choose both a start and end date.'
  if (!calendarDate(start) || !calendarDate(end)) return 'Enter valid calendar dates.'
  if (start > end) return 'Start date must be on or before end date.'
  if (end > today) return 'End date cannot be in the future.'
  const days = (Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 86_400_000 + 1
  if (days > 366) return 'Choose a range of 366 days or fewer.'
  return null
}

export const ADMIN_COST_COMPLETENESS_MESSAGES: Readonly<Record<AdminCostCompletenessReason, string>> = {
  source_record_limit: 'The selected range exceeded the bounded 500-record read, so totals are partial.',
  ambiguous_attribution: 'Some usage had ambiguous household attribution.',
  unresolved_attribution: 'Some usage could not be resolved to a household.',
  usage_unavailable: 'Some provider usage quantities were unavailable.',
  calculated_cost_unavailable: 'Some usage had no trustworthy calculated cost, commonly because no effective production price was configured.',
}

export const ADMIN_COST_ERROR_MESSAGES: Readonly<Record<AdminCostsErrorCode, string>> = {
  costs_timeout: 'The costs request timed out. Try again shortly.',
  costs_unavailable: 'AI and cost data is temporarily unavailable.',
  invalid_range: 'The selected date range is not valid.',
}
