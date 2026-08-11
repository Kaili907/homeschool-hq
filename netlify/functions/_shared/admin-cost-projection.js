import {
  hasConsistentAdminUsageCost,
  isCanonicalIntegerMicros,
} from '../../../src/admin/contracts.ts'
import {
  readAdminProviderAccountingCoverage,
  unavailableProviderAccountingCoverage,
} from './admin-provider-coverage.js'
import { readQueryEntries, reject } from './http.js'
import { buildAdminCostAggregateProjection } from './admin-cost-aggregate.js'

export const ADMIN_COST_RECORD_LIMIT = 500
export const ADMIN_COST_MAX_RANGE_DAYS = 366

const DAY_MS = 24 * 60 * 60 * 1_000
const RANGE_PRESETS = new Set(['today', '7-days', '30-days', 'month'])
const ENGINES = new Set(['tutor', 'study', 'jarvis', 'tts'])
const PROVIDERS = new Set(['anthropic', 'elevenlabs'])
const MODEL_TIERS = new Set(['sonnet', 'haiku'])
const BILLING_DISPOSITIONS = new Set(['billable', 'not_billable', 'unknown'])
const COST_KINDS = new Set(['calculated', 'reconciled', 'unavailable'])
const ATTRIBUTION_STATES = new Set([
  'resolved',
  'no_active_household',
  'ambiguous',
  'lookup_unavailable',
])

function isoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : value
}

function utcDate(milliseconds) {
  return new Date(milliseconds).toISOString().slice(0, 10)
}

function midnightUtc(date) {
  return Date.parse(`${date}T00:00:00.000Z`)
}

function parseQuery(event) {
  const entries = readQueryEntries(event, 'invalid_range')
  const allowed = new Set(['range', 'start', 'end'])
  if (entries.length < 1 || entries.some(([key, value]) => !allowed.has(key) || typeof value !== 'string')) {
    reject(400, 'invalid_range')
  }
  const query = Object.create(null)
  for (const [key, value] of entries) {
    if (Object.hasOwn(query, key)) reject(400, 'invalid_range')
    query[key] = value
  }
  return query
}

export function resolveAdminCostRange(event, now = new Date()) {
  const query = parseQuery(event)
  const today = utcDate(now.getTime())
  let start
  let end
  let kind

  if (query.range === 'custom') {
    if (Object.keys(query).length !== 3) reject(400, 'invalid_range')
    start = isoDate(query.start)
    end = isoDate(query.end)
    kind = 'custom'
    if (!start || !end || start > end || end > today) reject(400, 'invalid_range')
  } else {
    if (Object.keys(query).length !== 1 || !RANGE_PRESETS.has(query.range)) {
      reject(400, 'invalid_range')
    }
    kind = query.range
    end = today
    const endMs = midnightUtc(end)
    if (kind === 'month') start = `${end.slice(0, 7)}-01`
    else {
      const days = kind === 'today' ? 1 : kind === '7-days' ? 7 : 30
      start = utcDate(endMs - (days - 1) * DAY_MS)
    }
  }

  const startMs = midnightUtc(start)
  const endExclusiveMs = midnightUtc(end) + DAY_MS
  const days = Math.round((endExclusiveMs - startMs) / DAY_MS)
  if (days < 1 || days > ADMIN_COST_MAX_RANGE_DAYS) reject(400, 'range_too_large')

  return Object.freeze({
    kind,
    start,
    end,
    startAt: new Date(startMs).toISOString(),
    endExclusive: new Date(endExclusiveMs).toISOString(),
    days,
  })
}

function nullableUsage(value) {
  return value === null || (Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000)
}

function validString(value, max = 128) {
  return typeof value === 'string' && value.length >= 1 && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value)
}

function validateRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) reject(503, 'cost_source_unavailable')
  const occurred = typeof record.occurredAt === 'string' ? Date.parse(record.occurredAt) : Number.NaN
  const usageFields = [
    record.inputTokens,
    record.outputTokens,
    record.cachedInputReadTokens,
    record.cachedInputWriteTokens,
    record.ttsCharacters,
  ]
  if (
    record.schemaVersion !== 2
    || Number.isNaN(occurred)
    || !ENGINES.has(record.engine)
    || !PROVIDERS.has(record.provider)
    || !validString(record.providerProductId, 120)
    || !validString(record.providerModelId, 120)
    || !(record.logicalModelTier === null || MODEL_TIERS.has(record.logicalModelTier))
    || usageFields.some((value) => !nullableUsage(value))
    || record.requestCount !== 1
    || !BILLING_DISPOSITIONS.has(record.billingDisposition)
    || !COST_KINDS.has(record.costKind)
    || !(record.costMicros === null || (
      typeof record.costMicros === 'string' && isCanonicalIntegerMicros(record.costMicros)
    ))
    || record.currency !== 'USD'
    || !ATTRIBUTION_STATES.has(record.householdAttribution)
    || !Array.isArray(record.costComponents)
    || !hasConsistentAdminUsageCost(record)
  ) {
    reject(503, 'cost_source_unavailable')
  }
  const aiShape = record.provider === 'anthropic'
    && (record.engine === 'tutor' || record.engine === 'study' || record.engine === 'jarvis')
    && MODEL_TIERS.has(record.logicalModelTier)
    && record.ttsCharacters === null
  const ttsShape = record.provider === 'elevenlabs'
    && record.engine === 'tts'
    && record.logicalModelTier === null
    && record.inputTokens === null
    && record.outputTokens === null
    && record.cachedInputReadTokens === null
    && record.cachedInputWriteTokens === null
    && record.ttsCharacters !== null
  if (!aiShape && !ttsShape) reject(503, 'cost_source_unavailable')
  const aiUsage = [
    record.inputTokens,
    record.outputTokens,
    record.cachedInputReadTokens,
    record.cachedInputWriteTokens,
  ]
  if (aiShape && !(aiUsage.every((value) => value === null) || aiUsage.every((value) => value !== null))) {
    reject(503, 'cost_source_unavailable')
  }
  return { ...record, occurredMs: occurred }
}

function exactMicrosMetric(total, known, unavailable, sourcePartial) {
  if (known === 0 && unavailable > 0) {
    return { status: 'unavailable', micros: null, currency: 'USD' }
  }
  return {
    status: sourcePartial || unavailable > 0 ? 'partial' : 'available',
    micros: total.toString(),
    currency: 'USD',
  }
}

function countMetric(total, known, unavailable, sourcePartial) {
  if (known === 0 && unavailable > 0) return { status: 'unavailable', value: null }
  return { status: sourcePartial || unavailable > 0 ? 'partial' : 'available', value: total }
}

function newAggregate() {
  return {
    records: 0,
    aiRequests: 0,
    ttsRequests: 0,
    usage: {
      inputTokens: { total: 0, known: 0, unavailable: 0 },
      outputTokens: { total: 0, known: 0, unavailable: 0 },
      cachedInputReadTokens: { total: 0, known: 0, unavailable: 0 },
      cachedInputWriteTokens: { total: 0, known: 0, unavailable: 0 },
      ttsCharacters: { total: 0, known: 0, unavailable: 0 },
    },
    calculated: { total: 0n, known: 0, unavailable: 0 },
    reconciled: { total: 0n, known: 0, unavailable: 0 },
    unavailableCostCount: 0,
  }
}

function safeAdd(current, increment) {
  const next = current + increment
  if (!Number.isSafeInteger(next)) reject(503, 'cost_source_unavailable')
  return next
}

function addRecord(aggregate, record) {
  aggregate.records += 1
  if (record.engine === 'tts') aggregate.ttsRequests += record.requestCount
  else aggregate.aiRequests += record.requestCount

  for (const field of Object.keys(aggregate.usage)) {
    const metric = aggregate.usage[field]
    const value = record[field]
    const applies = field === 'ttsCharacters' ? record.engine === 'tts' : record.engine !== 'tts'
    if (!applies) continue
    if (value === null) metric.unavailable += 1
    else {
      metric.total = safeAdd(metric.total, value)
      metric.known += 1
    }
  }

  if (record.costKind === 'calculated') {
    aggregate.calculated.total += BigInt(record.costMicros)
    aggregate.calculated.known += 1
  } else if (record.costKind === 'reconciled') {
    aggregate.calculated.unavailable += 1
    aggregate.reconciled.total += BigInt(record.costMicros)
    aggregate.reconciled.known += 1
  } else {
    aggregate.calculated.unavailable += 1
    aggregate.unavailableCostCount += 1
  }
}

function presentAggregate(aggregate, sourcePartial) {
  const totalRequests = aggregate.aiRequests + aggregate.ttsRequests
  return {
    totalRequests: countMetric(totalRequests, totalRequests === 0 ? 0 : 1, 0, sourcePartial),
    aiRequests: countMetric(aggregate.aiRequests, aggregate.aiRequests === 0 ? 0 : 1, 0, sourcePartial),
    ttsRequests: countMetric(aggregate.ttsRequests, aggregate.ttsRequests === 0 ? 0 : 1, 0, sourcePartial),
    inputTokens: countMetric(
      aggregate.usage.inputTokens.total,
      aggregate.usage.inputTokens.known,
      aggregate.usage.inputTokens.unavailable,
      sourcePartial,
    ),
    outputTokens: countMetric(
      aggregate.usage.outputTokens.total,
      aggregate.usage.outputTokens.known,
      aggregate.usage.outputTokens.unavailable,
      sourcePartial,
    ),
    cachedInputReadTokens: countMetric(
      aggregate.usage.cachedInputReadTokens.total,
      aggregate.usage.cachedInputReadTokens.known,
      aggregate.usage.cachedInputReadTokens.unavailable,
      sourcePartial,
    ),
    cachedInputWriteTokens: countMetric(
      aggregate.usage.cachedInputWriteTokens.total,
      aggregate.usage.cachedInputWriteTokens.known,
      aggregate.usage.cachedInputWriteTokens.unavailable,
      sourcePartial,
    ),
    ttsCharacters: countMetric(
      aggregate.usage.ttsCharacters.total,
      aggregate.usage.ttsCharacters.known,
      aggregate.usage.ttsCharacters.unavailable,
      sourcePartial,
    ),
    calculatedCost: exactMicrosMetric(
      aggregate.calculated.total,
      aggregate.calculated.known,
      aggregate.calculated.unavailable,
      sourcePartial,
    ),
    reconciledCost: exactMicrosMetric(
      aggregate.reconciled.total,
      aggregate.records,
      0,
      sourcePartial,
    ),
    unavailableCostCount: aggregate.unavailableCostCount,
  }
}

function engineLabel(engine) {
  return engine === 'tutor'
    ? 'Tutor'
    : engine === 'study'
      ? 'Study safety'
      : engine === 'jarvis'
        ? 'Jarvis'
        : 'Text to speech'
}

function providerLabel(provider) {
  return provider === 'anthropic' ? 'Anthropic' : 'ElevenLabs'
}

function productLabel(record) {
  if (record.provider === 'elevenlabs') return 'ElevenLabs Turbo speech'
  return record.logicalModelTier === 'sonnet' ? 'Anthropic Sonnet tier' : 'Anthropic Haiku tier'
}

function groupedRows(records, sourcePartial, keyFor, labelFor) {
  const grouped = new Map()
  for (const record of records) {
    const key = keyFor(record)
    if (!grouped.has(key)) grouped.set(key, { label: labelFor(record), aggregate: newAggregate() })
    addRecord(grouped.get(key).aggregate, record)
  }
  return [...grouped.entries()]
    .map(([key, value]) => ({ key, label: value.label, ...presentAggregate(value.aggregate, sourcePartial) }))
    .sort((left, right) => left.label.localeCompare(right.label))
}

export function buildAdminCostProjection(
  records,
  range,
  generatedAt = new Date(),
  providerCoverage = unavailableProviderAccountingCoverage(),
) {
  if (!Array.isArray(records)) reject(503, 'cost_source_unavailable')
  if (records.length > ADMIN_COST_RECORD_LIMIT) reject(503, 'cost_source_incomplete')
  const validated = records.map(validateRecord)
  const inRange = validated.filter(
    (record) => record.occurredMs >= Date.parse(range.startAt)
      && record.occurredMs < Date.parse(range.endExclusive),
  )
  const oldest = validated.reduce(
    (value, record) => Math.min(value, record.occurredMs),
    Number.POSITIVE_INFINITY,
  )
  const sourcePartial = validated.length === ADMIN_COST_RECORD_LIMIT
    && oldest >= Date.parse(range.startAt)

  const aggregate = newAggregate()
  const dayAggregates = new Map()
  const billingDispositionCounts = { billable: 0, notBillable: 0, unknown: 0 }
  const costKindCounts = { calculated: 0, reconciled: 0, unavailable: 0 }
  const attributionCounts = { resolved: 0, ambiguous: 0, unresolved: 0 }
  let usageUnavailableCount = 0

  for (const record of inRange) {
    addRecord(aggregate, record)
    const day = utcDate(record.occurredMs)
    if (!dayAggregates.has(day)) dayAggregates.set(day, newAggregate())
    addRecord(dayAggregates.get(day), record)
    billingDispositionCounts[record.billingDisposition === 'not_billable' ? 'notBillable' : record.billingDisposition] += 1
    costKindCounts[record.costKind] += 1
    attributionCounts[
      record.householdAttribution === 'resolved'
        ? 'resolved'
        : record.householdAttribution === 'ambiguous'
          ? 'ambiguous'
          : 'unresolved'
    ] += 1
    if (record.engine !== 'tts' && record.inputTokens === null) usageUnavailableCount += 1
  }

  const reasons = []
  if (sourcePartial) reasons.push('source_record_limit')
  if (attributionCounts.ambiguous > 0) reasons.push('ambiguous_attribution')
  if (attributionCounts.unresolved > 0) reasons.push('unresolved_attribution')
  if (usageUnavailableCount > 0) reasons.push('usage_unavailable')
  if (costKindCounts.unavailable > 0) reasons.push('calculated_cost_unavailable')

  return Object.freeze({
    contractVersion: 3,
    generatedAt: generatedAt.toISOString(),
    currency: 'USD',
    range,
    source: {
      status: reasons.length === 0 ? 'complete' : 'partial',
      reasons,
      recordLimit: ADMIN_COST_RECORD_LIMIT,
      recordsIncluded: inRange.length,
    },
    summary: {
      ...presentAggregate(aggregate, sourcePartial),
      usageUnavailableCount,
      billingDispositionCounts,
      costKindCounts,
      attributionCounts,
    },
    trend: [...dayAggregates.entries()]
      .map(([date, value]) => ({ date, ...presentAggregate(value, sourcePartial) }))
      .sort((left, right) => left.date.localeCompare(right.date)),
    breakdowns: {
      engines: groupedRows(inRange, sourcePartial, (record) => record.engine, (record) => engineLabel(record.engine)),
      providers: groupedRows(inRange, sourcePartial, (record) => record.provider, (record) => providerLabel(record.provider)),
      models: groupedRows(
        inRange,
        sourcePartial,
        (record) => `${record.provider}:${record.logicalModelTier ?? 'speech'}`,
        productLabel,
      ),
      costKinds: groupedRows(inRange, sourcePartial, (record) => record.costKind, (record) => (
        record.costKind === 'calculated' ? 'Calculated' : record.costKind === 'reconciled' ? 'Reconciled' : 'Unavailable'
      )),
      billingDispositions: groupedRows(
        inRange,
        sourcePartial,
        (record) => record.billingDisposition,
        (record) => record.billingDisposition === 'not_billable'
          ? 'Not billable'
          : record.billingDisposition[0].toUpperCase() + record.billingDisposition.slice(1),
      ),
    },
    providerAccountingCoverage: providerCoverage,
  })
}

export function createAdminCostProjection({ gatewayAccess, now = () => new Date() }) {
  if (
    !gatewayAccess || typeof gatewayAccess.aggregateProviderUsageCosts !== 'function'
    || typeof gatewayAccess.readProviderAttemptCoverage !== 'function'
  ) {
    throw new TypeError('admin cost projection requires aggregate and attempt coverage read seams')
  }
  return Object.freeze({
    async read(event) {
      const observedAt = now()
      const range = resolveAdminCostRange(event, observedAt)
      const [aggregate, coverage] = await Promise.all([
        gatewayAccess.aggregateProviderUsageCosts({
          start: range.startAt,
          endExclusive: range.endExclusive,
        }),
        readAdminProviderAccountingCoverage(
          (input) => gatewayAccess.readProviderAttemptCoverage(input),
          range,
        ),
      ])
      return Object.freeze({
        ...buildAdminCostAggregateProjection(aggregate, range, observedAt),
        providerAccountingCoverage: coverage,
      })
    },
  })
}
