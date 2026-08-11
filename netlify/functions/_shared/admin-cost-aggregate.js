import { isCanonicalIntegerMicros } from '../../../src/admin/contracts.ts'
import { reject } from './http.js'

export const ADMIN_COST_GROUP_LIMIT = 384

const ENGINES = new Set(['tutor', 'study', 'jarvis', 'tts'])
const PROVIDERS = new Set(['anthropic', 'elevenlabs'])
const COST_KINDS = new Set(['calculated', 'reconciled', 'unavailable'])
const BILLING_DISPOSITIONS = new Set(['billable', 'not_billable', 'unknown'])
const DIMENSIONS = new Set([
  'summary',
  'day',
  'engine',
  'provider',
  'logical_tier',
  'cost_kind',
  'billing_disposition',
])
const KEYS = Object.freeze({
  summary: new Set(['all']),
  engine: ENGINES,
  provider: PROVIDERS,
  logical_tier: new Set(['sonnet', 'haiku', 'speech']),
  cost_kind: COST_KINDS,
  billing_disposition: BILLING_DISPOSITIONS,
})
const DATE = /^\d{4}-\d{2}-\d{2}$/

function objectWithKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
    ? value
    : null
}

function calendarDate(value) {
  if (typeof value !== 'string' || !DATE.test(value)) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : value
}

function decimalString(value) {
  return typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value) ? value : null
}

function safeDecimal(value) {
  const canonical = decimalString(value)
  if (canonical === null) return null
  const parsed = Number(canonical)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

function usageMetric(value) {
  const source = objectWithKeys(value, ['total', 'known', 'unavailable'])
  if (!source) return null
  const total = safeDecimal(source.total)
  const known = safeDecimal(source.known)
  const unavailable = safeDecimal(source.unavailable)
  return total === null || known === null || unavailable === null
    ? null
    : { total, known, unavailable }
}

function counts(value, keys) {
  const source = objectWithKeys(value, keys)
  if (!source) return null
  const result = Object.create(null)
  for (const key of keys) {
    const count = safeDecimal(source[key])
    if (count === null) return null
    result[key] = count
  }
  return result
}

function group(value) {
  const source = objectWithKeys(value, [
    'dimension', 'key', 'records', 'requests', 'usage', 'cost', 'counts',
  ])
  if (!source || !DIMENSIONS.has(source.dimension) || typeof source.key !== 'string') return null
  if (source.dimension === 'day') {
    if (!calendarDate(source.key)) return null
  } else if (!KEYS[source.dimension]?.has(source.key)) return null

  const requests = counts(source.requests, ['total', 'ai', 'tts'])
  const usage = objectWithKeys(source.usage, [
    'inputTokens', 'outputTokens', 'cachedInputReadTokens',
    'cachedInputWriteTokens', 'ttsCharacters',
  ])
  const cost = objectWithKeys(source.cost, ['calculated', 'reconciledMicros', 'unavailableCount'])
  const calculated = objectWithKeys(cost?.calculated, ['micros', 'known', 'unavailable'])
  const groupCounts = objectWithKeys(source.counts, [
    'usageUnavailable', 'billingDisposition', 'costKind', 'attribution',
  ])
  if (!requests || !usage || !cost || !calculated || !groupCounts) return null

  const records = safeDecimal(source.records)
  const inputTokens = usageMetric(usage.inputTokens)
  const outputTokens = usageMetric(usage.outputTokens)
  const cachedInputReadTokens = usageMetric(usage.cachedInputReadTokens)
  const cachedInputWriteTokens = usageMetric(usage.cachedInputWriteTokens)
  const ttsCharacters = usageMetric(usage.ttsCharacters)
  const calculatedMicros = decimalString(calculated.micros)
  const calculatedKnown = safeDecimal(calculated.known)
  const calculatedUnavailable = safeDecimal(calculated.unavailable)
  const reconciledMicros = decimalString(cost.reconciledMicros)
  const unavailableCostCount = safeDecimal(cost.unavailableCount)
  const usageUnavailableCount = safeDecimal(groupCounts.usageUnavailable)
  const billingDispositionCounts = counts(
    groupCounts.billingDisposition,
    ['billable', 'notBillable', 'unknown'],
  )
  const costKindCounts = counts(
    groupCounts.costKind,
    ['calculated', 'reconciled', 'unavailable'],
  )
  const attributionCounts = counts(
    groupCounts.attribution,
    ['resolved', 'ambiguous', 'unresolved'],
  )
  if (
    records === null
    || requests.total !== requests.ai + requests.tts
    || !Number.isSafeInteger(requests.ai + requests.tts)
    || !inputTokens || !outputTokens || !cachedInputReadTokens
    || !cachedInputWriteTokens || !ttsCharacters
    || calculatedMicros === null || !isCanonicalIntegerMicros(calculatedMicros)
    || calculatedKnown === null || calculatedUnavailable === null
    || reconciledMicros === null || !isCanonicalIntegerMicros(reconciledMicros)
    || unavailableCostCount === null || usageUnavailableCount === null
    || !billingDispositionCounts || !costKindCounts || !attributionCounts
  ) return null

  return {
    dimension: source.dimension,
    key: source.key,
    records,
    requests,
    usage: {
      inputTokens,
      outputTokens,
      cachedInputReadTokens,
      cachedInputWriteTokens,
      ttsCharacters,
    },
    cost: {
      calculated: {
        micros: calculatedMicros,
        known: calculatedKnown,
        unavailable: calculatedUnavailable,
      },
      reconciledMicros,
      unavailableCount: unavailableCostCount,
    },
    counts: {
      usageUnavailable: usageUnavailableCount,
      billingDisposition: billingDispositionCounts,
      costKind: costKindCounts,
      attribution: attributionCounts,
    },
  }
}

function countMetric(metric) {
  if (metric.known === 0 && metric.unavailable > 0) {
    return { status: 'unavailable', value: null }
  }
  return {
    status: metric.unavailable > 0 ? 'partial' : 'available',
    value: metric.total,
  }
}

function moneyMetric(metric) {
  if (metric.known === 0 && metric.unavailable > 0) {
    return { status: 'unavailable', micros: null, currency: 'USD' }
  }
  return {
    status: metric.unavailable > 0 ? 'partial' : 'available',
    micros: metric.micros,
    currency: 'USD',
  }
}

function present(groupValue) {
  return {
    totalRequests: { status: 'available', value: groupValue.requests.total },
    aiRequests: { status: 'available', value: groupValue.requests.ai },
    ttsRequests: { status: 'available', value: groupValue.requests.tts },
    inputTokens: countMetric(groupValue.usage.inputTokens),
    outputTokens: countMetric(groupValue.usage.outputTokens),
    cachedInputReadTokens: countMetric(groupValue.usage.cachedInputReadTokens),
    cachedInputWriteTokens: countMetric(groupValue.usage.cachedInputWriteTokens),
    ttsCharacters: countMetric(groupValue.usage.ttsCharacters),
    calculatedCost: moneyMetric(groupValue.cost.calculated),
    reconciledCost: {
      status: 'available',
      micros: groupValue.cost.reconciledMicros,
      currency: 'USD',
    },
    unavailableCostCount: groupValue.cost.unavailableCount,
  }
}

function label(dimension, key) {
  if (dimension === 'engine') {
    return key === 'tutor'
      ? 'Tutor'
      : key === 'study'
        ? 'Study'
        : key === 'jarvis'
          ? 'Jarvis'
          : 'Text to speech'
  }
  if (dimension === 'provider') return key === 'anthropic' ? 'Anthropic' : 'ElevenLabs'
  if (dimension === 'logical_tier') {
    if (key === 'sonnet') return 'Anthropic Sonnet tier'
    if (key === 'haiku') return 'Anthropic Haiku tier'
    return 'No logical tier (speech)'
  }
  if (dimension === 'cost_kind') {
    return key === 'calculated' ? 'Calculated' : key === 'reconciled' ? 'Reconciled' : 'Unavailable'
  }
  return key === 'not_billable' ? 'Not billable' : key[0].toUpperCase() + key.slice(1)
}

function breakdown(groups, dimension) {
  return groups
    .filter((item) => item.dimension === dimension)
    .map((item) => ({
      key: dimension === 'logical_tier' && item.key !== 'speech'
        ? `anthropic:${item.key}`
        : item.key,
      label: label(dimension, item.key),
      ...present(item),
    }))
    .sort((left, right) => left.label.localeCompare(right.label))
}

export function buildAdminCostAggregateProjection(value, range, generatedAt = new Date()) {
  const source = objectWithKeys(value, [
    'schemaVersion', 'range', 'completeness', 'accountingGapEvidence',
    'recordsIncluded', 'groups',
  ])
  const sourceRange = objectWithKeys(source?.range, ['startAt', 'endExclusive', 'maximumDays'])
  const completeness = objectWithKeys(source?.completeness, [
    'queryCoverage', 'providerTrafficCoverage', 'groupCount', 'groupLimit',
  ])
  const gapEvidence = objectWithKeys(source?.accountingGapEvidence, [
    'observedCount', 'retentionCoverage',
  ])
  const recordsIncluded = safeDecimal(source?.recordsIncluded)
  const observedGapCount = safeDecimal(gapEvidence?.observedCount)
  if (
    !source || source.schemaVersion !== 1 || !sourceRange || !completeness || !gapEvidence
    || sourceRange.maximumDays !== 366
    || Date.parse(sourceRange.startAt) !== Date.parse(range.startAt)
    || Date.parse(sourceRange.endExclusive) !== Date.parse(range.endExclusive)
    || completeness.queryCoverage !== 'complete'
    || completeness.providerTrafficCoverage !== 'coverage_unverified'
    || completeness.groupLimit !== ADMIN_COST_GROUP_LIMIT
    || !Number.isSafeInteger(completeness.groupCount)
    || completeness.groupCount < 1
    || completeness.groupCount > ADMIN_COST_GROUP_LIMIT
    || recordsIncluded === null || observedGapCount === null
    || !['within_retention', 'retention_limited'].includes(gapEvidence.retentionCoverage)
    || !Array.isArray(source.groups)
    || source.groups.length !== completeness.groupCount
  ) reject(503, 'cost_source_unavailable')

  const groups = source.groups.map(group)
  if (groups.some((item) => item === null)) reject(503, 'cost_source_unavailable')
  const unique = new Set(groups.map((item) => `${item.dimension}:${item.key}`))
  const summaries = groups.filter((item) => item.dimension === 'summary')
  if (
    unique.size !== groups.length
    || summaries.length !== 1
    || summaries[0].records !== recordsIncluded
    || groups.some((item) => item.dimension === 'day' && (
      item.key < range.start || item.key > range.end
    ))
  ) reject(503, 'cost_source_unavailable')

  const summary = summaries[0]
  const reasons = []
  if (summary.counts.attribution.ambiguous > 0) reasons.push('ambiguous_attribution')
  if (summary.counts.attribution.unresolved > 0) reasons.push('unresolved_attribution')
  if (summary.counts.usageUnavailable > 0) reasons.push('usage_unavailable')
  if (summary.counts.costKind.unavailable > 0) reasons.push('calculated_cost_unavailable')
  if (observedGapCount > 0) reasons.push('accounting_gap_evidence')

  return Object.freeze({
    contractVersion: 3,
    generatedAt: generatedAt.toISOString(),
    currency: 'USD',
    range,
    source: {
      status: reasons.length === 0 ? 'complete' : 'partial',
      reasons,
      queryCoverage: 'complete',
      providerTrafficCoverage: 'coverage_unverified',
      groupLimit: ADMIN_COST_GROUP_LIMIT,
      groupCount: completeness.groupCount,
      recordsIncluded,
      accountingGapEvidence: {
        observedCount: observedGapCount,
        retentionCoverage: gapEvidence.retentionCoverage,
      },
    },
    summary: {
      ...present(summary),
      usageUnavailableCount: summary.counts.usageUnavailable,
      billingDispositionCounts: summary.counts.billingDisposition,
      costKindCounts: summary.counts.costKind,
      attributionCounts: summary.counts.attribution,
    },
    trend: groups
      .filter((item) => item.dimension === 'day')
      .map((item) => ({ date: item.key, ...present(item) }))
      .sort((left, right) => left.date.localeCompare(right.date)),
    breakdowns: {
      engines: breakdown(groups, 'engine'),
      providers: breakdown(groups, 'provider'),
      models: breakdown(groups, 'logical_tier'),
      costKinds: breakdown(groups, 'cost_kind'),
      billingDispositions: breakdown(groups, 'billing_disposition'),
    },
  })
}
