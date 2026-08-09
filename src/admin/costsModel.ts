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

export interface AdminCostsModel {
  readonly contractVersion: 2
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
  if (
    !source || source.contractVersion !== 2 || source.currency !== 'USD'
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
    contractVersion: 2,
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
