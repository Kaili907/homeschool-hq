import { isCanonicalIntegerMicros, type IntegerMicros } from './contracts'

export const ADMIN_COST_CONTRACT_VERSION = 4 as const
export const ADMIN_COST_GROUP_LIMIT = 384 as const
export const ADMIN_COST_PRESETS = ['today', '7-days', '30-days', 'month'] as const
export type AdminCostPreset = (typeof ADMIN_COST_PRESETS)[number]
export type AdminCostQueryCoverage = 'complete'
export type AdminCostProviderTrafficCoverage = 'coverage_unverified'
export type AdminCostGapRetentionCoverage = 'within_retention' | 'retention_limited'

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
  readonly reservationOnlyAttempts: number
  readonly dispatchPossibleAttempts: number
  readonly observedOutcomes: number
  readonly ledgerLinkedAttempts: number
  readonly accountingGaps: number
  readonly gapPending: number
  readonly reconciliationConflicts: number
  readonly reconciledAttempts: number
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

export type AdminMonthlyCostAlertStatus =
  | 'normal'
  | 'warning'
  | 'critical'
  | 'partial'
  | 'unavailable'

export type AdminMonthlyCostAlertReason =
  | 'complete'
  | 'partial_lower_bound'
  | 'partial_lower_bound_critical'
  | 'aggregate_unavailable'
  | 'configuration_unavailable'

export interface AdminMonthlyCostAlert {
  readonly contractVersion: 1
  readonly generatedAt: string
  readonly currency: 'USD'
  readonly window: {
    readonly timezone: 'UTC'
    readonly startAt: string
    readonly endExclusive: string
  }
  readonly costAuthority: 'academy_provider_usage_ledger'
  readonly scope: 'recorded_usage_derived_calculated_provider_cost'
  readonly providerInvoiceTotalClaim: false
  readonly automaticProviderShutdown: false
  readonly completeness: 'complete' | 'partial' | 'unavailable'
  readonly status: AdminMonthlyCostAlertStatus
  readonly reason: AdminMonthlyCostAlertReason
  readonly activeCritical: boolean
  readonly monthlyCostMicros: IntegerMicros | null
  readonly warningThresholdMicros: IntegerMicros | null
  readonly criticalThresholdMicros: IntegerMicros | null
  readonly remainingToWarningMicros: IntegerMicros | null
  readonly remainingToCriticalMicros: IntegerMicros | null
}

export interface AdminCostCoverageEvidence {
  readonly queryCoverage: AdminCostQueryCoverage
  readonly providerTrafficCoverage: AdminCostProviderTrafficCoverage
  readonly accountingGapEvidence: {
    readonly observedCount: number
    readonly retentionCoverage: AdminCostGapRetentionCoverage
  }
}

export interface AdminCostsModel {
  readonly contractVersion: typeof ADMIN_COST_CONTRACT_VERSION
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
  readonly source: AdminCostCoverageEvidence & {
    readonly status: 'complete' | 'partial'
    readonly reasons: readonly AdminCostCompletenessReason[]
    readonly groupLimit: typeof ADMIN_COST_GROUP_LIMIT
    readonly groupCount: number
    readonly recordsIncluded: number
  }
  readonly monthlyCostThreshold: AdminMonthlyCostThreshold
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
  readonly monthlyCostAlert: AdminMonthlyCostAlert
}

export type AdminMonthlyCostThresholdStatus =
  | 'not_applicable'
  | 'unavailable'
  | 'below_warning'
  | 'warning'
  | 'critical'

export interface AdminMonthlyCostThreshold {
  readonly status: AdminMonthlyCostThresholdStatus
  readonly reason:
    | 'range_not_month'
    | 'configuration_unavailable'
    | 'calculated_cost_unavailable'
    | 'calculated_cost_partial'
    | null
  readonly basis: 'calculated_usage_estimate'
  readonly observedMicros: IntegerMicros | null
  readonly warningMicros: IntegerMicros | null
  readonly criticalMicros: IntegerMicros | null
  readonly configurationRevisions: {
    readonly warning: string
    readonly critical: string
  } | null
}

export type AdminCostCompletenessReason =
  | 'ambiguous_attribution'
  | 'unresolved_attribution'
  | 'usage_unavailable'
  | 'calculated_cost_unavailable'
  | 'accounting_gap_evidence'

export type AdminCostsReadState =
  | { readonly status: 'idle' | 'loading' }
  | { readonly status: 'unauthorized' }
  | { readonly status: 'error'; readonly code: AdminCostsErrorCode }
  | { readonly status: 'ready'; readonly model: AdminCostsModel; readonly freshness: 'current' | 'stale' }

export type AdminCostsErrorCode = 'costs_timeout' | 'costs_unavailable' | 'invalid_range'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000
const METRIC_STATUSES = new Set<AdminCostMetricStatus>(['available', 'partial', 'unavailable'])
const REASONS = new Set<AdminCostCompletenessReason>([
  'ambiguous_attribution',
  'unresolved_attribution',
  'usage_unavailable',
  'calculated_cost_unavailable',
  'accounting_gap_evidence',
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
  'reservationOnlyAttempts',
  'dispatchPossibleAttempts',
  'observedOutcomes',
  'ledgerLinkedAttempts',
  'accountingGaps',
  'gapPending',
  'reconciliationConflicts',
  'reconciledAttempts',
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

const MONTHLY_ALERT_STATUSES = new Set<AdminMonthlyCostAlertStatus>([
  'normal', 'warning', 'critical', 'partial', 'unavailable',
])
const MONTHLY_ALERT_REASONS = new Set<AdminMonthlyCostAlertReason>([
  'complete', 'partial_lower_bound', 'partial_lower_bound_critical',
  'aggregate_unavailable', 'configuration_unavailable',
])
const AGGREGATE_KEYS = [
  'totalRequests', 'aiRequests', 'ttsRequests', 'inputTokens', 'outputTokens',
  'cachedInputReadTokens', 'cachedInputWriteTokens', 'ttsCharacters',
  'calculatedCost', 'reconciledCost', 'unavailableCostCount',
] as const
const BREAKDOWN_LABELS = {
  engines: { tutor: 'Tutor', study: 'Study', jarvis: 'Jarvis', tts: 'Text to speech' },
  providers: { anthropic: 'Anthropic', elevenlabs: 'ElevenLabs' },
  models: {
    'anthropic:sonnet': 'Anthropic Sonnet tier',
    'anthropic:haiku': 'Anthropic Haiku tier',
    speech: 'No logical tier (speech)',
  },
  costKinds: { calculated: 'Calculated', reconciled: 'Reconciled', unavailable: 'Unavailable' },
  billingDispositions: { billable: 'Billable', not_billable: 'Not billable', unknown: 'Unknown' },
} as const
const THRESHOLD_STATUSES = new Set<AdminMonthlyCostThresholdStatus>([
  'not_applicable', 'unavailable', 'below_warning', 'warning', 'critical',
])
const THRESHOLD_REASONS = new Set([
  'range_not_month', 'configuration_unavailable',
  'calculated_cost_unavailable', 'calculated_cost_partial',
])
const POSITIVE_REVISION = /^[1-9]\d*$/

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function hasExactKeys(source: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(source).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index])
}

function calendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const parsed = new Date(value)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value
}

function safeCount(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : null
}

function countMetric(value: unknown): AdminCostCountMetric | null {
  const source = record(value)
  if (
    !source || !hasExactKeys(source, ['status', 'value'])
    || !METRIC_STATUSES.has(source.status as AdminCostMetricStatus)
  ) return null
  if (source.status === 'unavailable') {
    return source.value === null ? { status: 'unavailable', value: null } : null
  }
  const count = safeCount(source.value)
  return count === null ? null : { status: source.status, value: count } as AdminCostCountMetric
}

function moneyMetric(value: unknown): AdminCostMoneyMetric | null {
  const source = record(value)
  if (
    !source || !hasExactKeys(source, ['status', 'micros', 'currency'])
    || !METRIC_STATUSES.has(source.status as AdminCostMetricStatus) || source.currency !== 'USD'
  ) return null
  if (source.status === 'unavailable') {
    return source.micros === null ? { status: 'unavailable', micros: null, currency: 'USD' } : null
  }
  if (typeof source.micros !== 'string' || !isCanonicalIntegerMicros(source.micros)) return null
  return { status: source.status, micros: source.micros, currency: 'USD' } as AdminCostMoneyMetric
}

function aggregate(value: unknown, extraKeys: readonly string[] = []): AdminCostAggregate | null {
  const source = record(value)
  if (!source || !hasExactKeys(source, [...AGGREGATE_KEYS, ...extraKeys])) return null
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
  if (!source || !hasExactKeys(source, keys)) return null
  const result: Record<string, number> = {}
  for (const key of keys) {
    const count = safeCount(source[key])
    if (count === null) return null
    result[key] = count
  }
  return result
}

function breakdownRows(
  value: unknown,
  allowed: Readonly<Record<string, string>>,
): AdminCostBreakdownRow[] | null {
  if (!Array.isArray(value) || value.length > 32) return null
  const rows: AdminCostBreakdownRow[] = []
  const keys = new Set<string>()
  for (const item of value) {
    const source = record(item)
    const values = aggregate(item, ['key', 'label'])
    if (
      !source || !values || typeof source.key !== 'string'
      || source.label !== allowed[source.key] || keys.has(source.key)
    ) return null
    keys.add(source.key)
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

function providerCoverageStatusForMetrics(
  metrics: AdminProviderAccountingCoverageMetrics,
): Exclude<AdminProviderAccountingCoverageStatus, 'unavailable'> {
  if (metrics.reconciliationConflicts > 0) return 'reconciliation_conflict'
  if (metrics.accountingGaps > 0 || metrics.gapPending > 0 || metrics.unresolvable > 0) {
    return 'gaps_detected'
  }
  if (metrics.reservedAttempts === 0) return 'insufficient_evidence'
  if (
    metrics.reservationOnlyAttempts
    + metrics.dispatchPossibleAttempts
    + metrics.observedOutcomes > 0
  ) return 'partial'
  return 'complete_for_journaled_attempts'
}

function providerCoverageMetricsAreConsistent(
  metrics: AdminProviderAccountingCoverageMetrics,
  allowOrphanLedgerRows: boolean,
): boolean {
  const currentStates = [
    metrics.reservationOnlyAttempts,
    metrics.dispatchPossibleAttempts,
    metrics.observedOutcomes,
    metrics.ledgerLinkedAttempts,
    metrics.gapPending,
    metrics.reconciliationConflicts,
    metrics.reconciledAttempts,
    metrics.confirmedNotDispatched,
    metrics.unresolvable,
  ]
  const stateTotal = currentStates.reduce((total, count) => total + count, 0)
  const missingRelationships = metrics.observedOutcomes
    + metrics.gapPending
    + metrics.reconciliationConflicts
    + metrics.unresolvable
  return Number.isSafeInteger(stateTotal)
    && Number.isSafeInteger(missingRelationships)
    && stateTotal === metrics.reservedAttempts
    && (allowOrphanLedgerRows
      ? metrics.accountingGaps >= missingRelationships
      : metrics.accountingGaps === missingRelationships)
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
      || !providerCoverageMetricsAreConsistent(metrics, false)
      || source.status !== providerCoverageStatusForMetrics(metrics)
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

function sumProviderCoverageMetric(
  rows: readonly AdminProviderAccountingCoverageBreakdownRow[],
  key: keyof AdminProviderAccountingCoverageMetrics,
): number | null {
  let total = 0
  for (const row of rows) {
    total += row[key]
    if (!Number.isSafeInteger(total)) return null
  }
  return total
}

function providerCoverageRowsMatchSummary(
  rows: readonly AdminProviderAccountingCoverageBreakdownRow[],
  metrics: AdminProviderAccountingCoverageMetrics,
): boolean {
  const exactKeys: readonly (keyof AdminProviderAccountingCoverageMetrics)[] = [
    'reservedAttempts',
    'reservationOnlyAttempts',
    'dispatchPossibleAttempts',
    'observedOutcomes',
    'ledgerLinkedAttempts',
    'gapPending',
    'reconciliationConflicts',
    'reconciledAttempts',
    'confirmedNotDispatched',
    'unresolvable',
  ]
  return exactKeys.every((key) => sumProviderCoverageMetric(rows, key) === metrics[key])
    && (sumProviderCoverageMetric(rows, 'accountingGaps') ?? Number.POSITIVE_INFINITY)
      <= metrics.accountingGaps
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
  if (
    !providerCoverageMetricsAreConsistent(metrics, true)
    || source.journalStatus !== providerCoverageStatusForMetrics(metrics)
    || !providerCoverageRowsMatchSummary(engines, metrics)
    || !providerCoverageRowsMatchSummary(purposes, metrics)
    || !providerCoverageRowsMatchSummary(providers, metrics)
  ) return null
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

function nullableMicros(value: unknown): IntegerMicros | null | undefined {
  if (value === null) return null
  return typeof value === 'string' && value.length <= 24 && isCanonicalIntegerMicros(value)
    ? value
    : undefined
}

export function parseAdminMonthlyCostAlert(value: unknown): AdminMonthlyCostAlert | null {
  const source = record(value)
  const window = record(source?.window)
  const expectedKeys = [
    'contractVersion', 'generatedAt', 'currency', 'window', 'costAuthority', 'scope',
    'providerInvoiceTotalClaim', 'automaticProviderShutdown', 'completeness', 'status',
    'reason', 'activeCritical', 'monthlyCostMicros', 'warningThresholdMicros',
    'criticalThresholdMicros', 'remainingToWarningMicros', 'remainingToCriticalMicros',
  ]
  if (!source || !window
    || Object.keys(source).length !== expectedKeys.length
    || expectedKeys.some((key) => !Object.hasOwn(source, key))
    || Object.keys(window).length !== 3) return null
  const startMs = typeof window.startAt === 'string' ? Date.parse(window.startAt) : Number.NaN
  const endMs = typeof window.endExclusive === 'string'
    ? Date.parse(window.endExclusive)
    : Number.NaN
  const startDate = new Date(startMs)
  const expectedEnd = Number.isNaN(startMs)
    ? null
    : new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1)).toISOString()
  if (
    source.contractVersion !== 1
    || typeof source.generatedAt !== 'string' || Number.isNaN(Date.parse(source.generatedAt))
    || source.currency !== 'USD'
    || window.timezone !== 'UTC'
    || typeof window.startAt !== 'string' || typeof window.endExclusive !== 'string'
    || Number.isNaN(startMs) || Number.isNaN(endMs)
    || !window.startAt.endsWith('-01T00:00:00.000Z')
    || !window.endExclusive.endsWith('-01T00:00:00.000Z')
    || window.endExclusive !== expectedEnd
    || startMs >= endMs
    || Date.parse(source.generatedAt) < startMs
    || Date.parse(source.generatedAt) >= endMs
    || source.costAuthority !== 'academy_provider_usage_ledger'
    || source.scope !== 'recorded_usage_derived_calculated_provider_cost'
    || source.providerInvoiceTotalClaim !== false
    || source.automaticProviderShutdown !== false
    || !['complete', 'partial', 'unavailable'].includes(String(source.completeness))
    || !MONTHLY_ALERT_STATUSES.has(source.status as AdminMonthlyCostAlertStatus)
    || !MONTHLY_ALERT_REASONS.has(source.reason as AdminMonthlyCostAlertReason)
    || typeof source.activeCritical !== 'boolean'
  ) return null
  const monthly = nullableMicros(source.monthlyCostMicros)
  const warning = nullableMicros(source.warningThresholdMicros)
  const critical = nullableMicros(source.criticalThresholdMicros)
  const remainingWarning = nullableMicros(source.remainingToWarningMicros)
  const remainingCritical = nullableMicros(source.remainingToCriticalMicros)
  if (monthly === undefined || warning === undefined || critical === undefined
    || remainingWarning === undefined || remainingCritical === undefined) return null
  if (source.activeCritical !== (source.status === 'critical')) return null
  if ((source.completeness === 'unavailable') !== (monthly === null)) return null

  const configured = warning !== null && critical !== null
    && BigInt(warning) >= 1n
    && BigInt(critical) <= 1_000_000_000_000n
    && BigInt(warning) < BigInt(critical)
  if ((warning === null) !== (critical === null) || (warning !== null && !configured)) return null
  if (source.reason === 'configuration_unavailable') {
    if (configured || source.status !== 'unavailable' || remainingWarning !== null || remainingCritical !== null) return null
  } else if (source.reason === 'aggregate_unavailable') {
    if (!configured || monthly !== null || source.completeness !== 'unavailable'
      || source.status !== 'unavailable' || remainingWarning !== null || remainingCritical !== null) return null
  } else if (!configured || monthly === null) return null

  if (configured && monthly !== null) {
    const total = BigInt(monthly)
    const exactStatus = total >= BigInt(critical)
      ? 'critical'
      : total >= BigInt(warning) ? 'warning' : 'normal'
    if (source.reason === 'complete') {
      if (source.completeness !== 'complete' || source.status !== exactStatus) return null
      const expectedWarning = BigInt(warning) > total ? (BigInt(warning) - total).toString() : null
      const expectedCritical = BigInt(critical) > total ? (BigInt(critical) - total).toString() : null
      if (remainingWarning !== expectedWarning || remainingCritical !== expectedCritical) return null
    } else if (source.reason === 'partial_lower_bound') {
      if (source.completeness !== 'partial' || source.status !== 'partial'
        || total >= BigInt(critical) || remainingWarning !== null || remainingCritical !== null) return null
    } else if (source.reason === 'partial_lower_bound_critical') {
      if (source.completeness !== 'partial' || source.status !== 'critical'
        || total < BigInt(critical) || remainingWarning !== null || remainingCritical !== null) return null
    } else if (source.reason === 'aggregate_unavailable') return null
  }

  return Object.freeze({
    ...(source as unknown as AdminMonthlyCostAlert),
    window: Object.freeze(window as unknown as AdminMonthlyCostAlert['window']),
  })
}

function monthlyCostThreshold(value: unknown): AdminMonthlyCostThreshold | null {
  const source = record(value)
  if (
    !source
    || !hasExactKeys(source, [
      'status', 'reason', 'basis', 'observedMicros', 'warningMicros',
      'criticalMicros', 'configurationRevisions',
    ])
    || !THRESHOLD_STATUSES.has(source.status as AdminMonthlyCostThresholdStatus)
    || source.basis !== 'calculated_usage_estimate'
    || !(source.reason === null || THRESHOLD_REASONS.has(source.reason as string))
  ) return null
  const micros = (candidate: unknown) => candidate === null
    || (typeof candidate === 'string' && isCanonicalIntegerMicros(candidate))
  if (!micros(source.observedMicros) || !micros(source.warningMicros) || !micros(source.criticalMicros)) return null
  const revisions = record(source.configurationRevisions)
  if (source.configurationRevisions !== null && (
    !revisions
    || Object.keys(revisions).length !== 2
    || typeof revisions.warning !== 'string'
    || !POSITIVE_REVISION.test(revisions.warning)
    || typeof revisions.critical !== 'string'
    || !POSITIVE_REVISION.test(revisions.critical)
  )) return null
  const configured = typeof source.warningMicros === 'string'
    && typeof source.criticalMicros === 'string'
    && revisions !== null
    && source.warningMicros.length <= 13
    && source.criticalMicros.length <= 13
    && BigInt(source.warningMicros) >= 1n
    && BigInt(source.warningMicros) < BigInt(source.criticalMicros)
    && BigInt(source.criticalMicros) <= 1_000_000_000_000n
  const observed = typeof source.observedMicros === 'string'
  const classified = ['below_warning', 'warning', 'critical'].includes(source.status as string)
  if (
    (source.status === 'not_applicable' && !(
      source.reason === 'range_not_month' && source.observedMicros === null
      && source.warningMicros === null && source.criticalMicros === null && revisions === null
    ))
    || (source.status === 'unavailable' && source.reason === 'configuration_unavailable' && !(
      source.observedMicros === null && source.warningMicros === null
      && source.criticalMicros === null && revisions === null
    ))
    || (source.status === 'unavailable' && source.reason === 'calculated_cost_unavailable'
      && !(source.observedMicros === null && configured))
    || (source.status === 'unavailable' && source.reason === 'calculated_cost_partial'
      && !(observed && configured))
    || (source.status === 'unavailable' && ![
      'configuration_unavailable', 'calculated_cost_unavailable', 'calculated_cost_partial',
    ].includes(source.reason as string))
    || (classified && !(source.reason === null && observed && configured))
  ) return null
  return {
    status: source.status as AdminMonthlyCostThresholdStatus,
    reason: source.reason as AdminMonthlyCostThreshold['reason'],
    basis: 'calculated_usage_estimate',
    observedMicros: source.observedMicros as IntegerMicros | null,
    warningMicros: source.warningMicros as IntegerMicros | null,
    criticalMicros: source.criticalMicros as IntegerMicros | null,
    configurationRevisions: revisions as unknown as AdminMonthlyCostThreshold['configurationRevisions'],
  }
}

export function parseAdminCostsModel(value: unknown): AdminCostsModel | null {
  const source = record(value)
  const range = record(source?.range)
  const sourceState = record(source?.source)
  const gapEvidence = record(sourceState?.accountingGapEvidence)
  const summarySource = record(source?.summary)
  const summaryAggregate = aggregate(summarySource, [
    'usageUnavailableCount', 'billingDispositionCounts', 'costKindCounts', 'attributionCounts',
  ])
  const billing = fixedCounts(summarySource?.billingDispositionCounts, ['billable', 'notBillable', 'unknown'])
  const costKinds = fixedCounts(summarySource?.costKindCounts, ['calculated', 'reconciled', 'unavailable'])
  const attribution = fixedCounts(summarySource?.attributionCounts, ['resolved', 'ambiguous', 'unresolved'])
  const usageUnavailableCount = safeCount(summarySource?.usageUnavailableCount)
  const coverage = parseAdminProviderAccountingCoverage(source?.providerAccountingCoverage)
  const monthlyCostAlert = parseAdminMonthlyCostAlert(source?.monthlyCostAlert)
  const threshold = monthlyCostThreshold(source?.monthlyCostThreshold)
  const startMs = calendarDate(range?.start) ? Date.parse(`${range.start}T00:00:00.000Z`) : Number.NaN
  const endMs = calendarDate(range?.end) ? Date.parse(`${range.end}T00:00:00.000Z`) : Number.NaN
  const expectedDays = Number.isNaN(startMs) || Number.isNaN(endMs)
    ? Number.NaN
    : (endMs - startMs) / DAY_MS + 1
  if (
    !source || !hasExactKeys(source, [
      'contractVersion', 'generatedAt', 'currency', 'range', 'source',
      'monthlyCostThreshold', 'summary', 'trend', 'breakdowns',
      'providerAccountingCoverage', 'monthlyCostAlert',
    ])
    || source.contractVersion !== ADMIN_COST_CONTRACT_VERSION || source.currency !== 'USD'
    || !canonicalTimestamp(source.generatedAt)
    || !range || !hasExactKeys(range, ['kind', 'start', 'end', 'startAt', 'endExclusive', 'days'])
    || !(ADMIN_COST_PRESETS as readonly string[]).concat('custom').includes(range.kind as string)
    || !calendarDate(range.start) || !calendarDate(range.end) || range.start > range.end
    || range.startAt !== `${range.start}T00:00:00.000Z`
    || range.endExclusive !== new Date(endMs + DAY_MS).toISOString()
    || safeCount(range.days) === null || range.days !== expectedDays
    || (range.days as number) < 1 || (range.days as number) > 366
    || !sourceState || !hasExactKeys(sourceState, [
      'status', 'reasons', 'queryCoverage', 'providerTrafficCoverage',
      'groupLimit', 'groupCount', 'recordsIncluded', 'accountingGapEvidence',
    ])
    || !['complete', 'partial'].includes(sourceState.status as string)
    || !Array.isArray(sourceState.reasons)
    || sourceState.reasons.some((reason) => !REASONS.has(reason))
    || new Set(sourceState.reasons).size !== sourceState.reasons.length
    || (sourceState.status === 'complete') !== (sourceState.reasons.length === 0)
    || sourceState.queryCoverage !== 'complete'
    || sourceState.providerTrafficCoverage !== 'coverage_unverified'
    || sourceState.groupLimit !== ADMIN_COST_GROUP_LIMIT
    || safeCount(sourceState.groupCount) === null || (sourceState.groupCount as number) < 1
    || (sourceState.groupCount as number) > ADMIN_COST_GROUP_LIMIT
    || safeCount(sourceState.recordsIncluded) === null
    || !gapEvidence || !hasExactKeys(gapEvidence, ['observedCount', 'retentionCoverage'])
    || safeCount(gapEvidence.observedCount) === null
    || !['within_retention', 'retention_limited'].includes(
      gapEvidence.retentionCoverage as string,
    )
    || !summaryAggregate || !billing || !costKinds || !attribution || usageUnavailableCount === null
    || !threshold || !coverage || !monthlyCostAlert
    || summaryAggregate.totalRequests.status !== 'available'
    || summaryAggregate.totalRequests.value !== sourceState.recordsIncluded
    || sourceState.reasons.includes('ambiguous_attribution') !== (attribution.ambiguous > 0)
    || sourceState.reasons.includes('unresolved_attribution') !== (attribution.unresolved > 0)
    || sourceState.reasons.includes('usage_unavailable') !== (usageUnavailableCount > 0)
    || sourceState.reasons.includes('calculated_cost_unavailable') !== (costKinds.unavailable > 0)
    || sourceState.reasons.includes('accounting_gap_evidence') !== ((gapEvidence.observedCount as number) > 0)
    || !Array.isArray(source.trend) || source.trend.length > 366
  ) return null

  const trend: AdminCostTrendPoint[] = []
  const trendDates = new Set<string>()
  for (const item of source.trend) {
    const trendSource = record(item)
    const values = aggregate(item, ['date'])
    if (
      !trendSource || !values || !calendarDate(trendSource.date)
      || trendSource.date < range.start || trendSource.date > range.end
      || trendDates.has(trendSource.date)
    ) return null
    trendDates.add(trendSource.date)
    trend.push({ date: trendSource.date, ...values })
  }

  const breakdownsSource = record(source.breakdowns)
  if (!breakdownsSource || !hasExactKeys(
    breakdownsSource,
    ['engines', 'providers', 'models', 'costKinds', 'billingDispositions'],
  )) return null
  const engines = breakdownRows(breakdownsSource.engines, BREAKDOWN_LABELS.engines)
  const providers = breakdownRows(breakdownsSource.providers, BREAKDOWN_LABELS.providers)
  const models = breakdownRows(breakdownsSource.models, BREAKDOWN_LABELS.models)
  const breakdownCostKinds = breakdownRows(breakdownsSource.costKinds, BREAKDOWN_LABELS.costKinds)
  const billingDispositions = breakdownRows(
    breakdownsSource.billingDispositions,
    BREAKDOWN_LABELS.billingDispositions,
  )
  if (
    !engines || !providers || !models || !breakdownCostKinds || !billingDispositions
    || sourceState.groupCount !== 1 + trend.length + engines.length + providers.length
      + models.length + breakdownCostKinds.length + billingDispositions.length
  ) return null

  return {
    contractVersion: ADMIN_COST_CONTRACT_VERSION,
    generatedAt: source.generatedAt,
    currency: 'USD',
    range: range as unknown as AdminCostsModel['range'],
    source: {
      status: sourceState.status as 'complete' | 'partial',
      reasons: [...sourceState.reasons] as AdminCostCompletenessReason[],
      queryCoverage: 'complete',
      providerTrafficCoverage: 'coverage_unverified',
      groupLimit: ADMIN_COST_GROUP_LIMIT,
      groupCount: sourceState.groupCount as number,
      recordsIncluded: sourceState.recordsIncluded as number,
      accountingGapEvidence: {
        observedCount: gapEvidence.observedCount as number,
        retentionCoverage: gapEvidence.retentionCoverage as AdminCostGapRetentionCoverage,
      },
    },
    monthlyCostThreshold: threshold,
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
    monthlyCostAlert,
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
  ambiguous_attribution: 'Some usage had ambiguous household attribution.',
  unresolved_attribution: 'Some usage could not be resolved to a household.',
  usage_unavailable: 'Some provider usage quantities were unavailable.',
  calculated_cost_unavailable: 'Some usage had no trustworthy calculated cost, commonly because no effective production price was configured.',
  accounting_gap_evidence: 'Recorded gateway telemetry shows provider activity whose accounting persistence failed; no usage or cost was fabricated for those signals.',
}

export const ADMIN_COST_ERROR_MESSAGES: Readonly<Record<AdminCostsErrorCode, string>> = {
  costs_timeout: 'The costs request timed out. Try again shortly.',
  costs_unavailable: 'AI and cost data is temporarily unavailable.',
  invalid_range: 'The selected date range is not valid.',
}
