import {
  ADMIN_ENGINE_IDS,
  ADMIN_OPERATIONAL_RESULTS,
  ADMIN_TELEMETRY_EVENT_TYPES,
} from '../../../src/admin/contracts.ts'
import { systemHealthAggregateRanges } from '../../../src/admin/systemHealth.ts'
import { OPERATIONAL_TELEMETRY_MAX_DURATION_MS } from '../../../src/telemetry/operationalTelemetry.ts'
import { envFlagEnabled } from './http.js'
import { createAdminOperationalAggregateReader } from './admin-operational-aggregate-reader.js'

const SERVICE_IDS = [
  'admin_api', 'persistence', 'anthropic_gateway', 'tts_gateway', 'sync', 'curriculum_read',
]
const SUMMARY_KEYS = [
  'eventCount', 'successCount', 'fallbackCount', 'rejectedCount', 'timeoutCount',
  'providerErrorCount', 'validationErrorCount', 'safetyStopCount', 'durationCount',
  'durationP50Ms', 'durationP95Ms', 'firstOccurredAt', 'lastOccurredAt',
]
const SUMMARY_COUNT_KEYS = SUMMARY_KEYS.slice(0, 9)
const RESULT_SUMMARY_KEYS = Object.freeze({
  success: 'successCount',
  fallback: 'fallbackCount',
  rejected: 'rejectedCount',
  timeout: 'timeoutCount',
  provider_error: 'providerErrorCount',
  validation_error: 'validationErrorCount',
  safety_stop: 'safetyStopCount',
})
const RETENTION_CLASSES = Object.freeze({
  diagnostic_short: 30,
  operational_standard: 90,
  safety_extended: 365,
})
const EVENT_ENGINES = Object.freeze({
  'tutor.turn': new Set(['tutor']),
  'study.session': new Set(['study']),
  'assessment.attempt': new Set(['assessment']),
  'curriculum.load': new Set(['curriculum']),
  'jarvis.turn': new Set(['jarvis']),
  'tts.synthesis': new Set(['tts']),
  'gateway.request': new Set(['gateway']),
  'sync.operation': new Set(['sync']),
  'safety.classification': new Set(['tutor', 'study', 'assessment', 'jarvis', 'gateway']),
  'persistence.operation': new Set(ADMIN_ENGINE_IDS),
})
const SAFE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/
const SAFE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

const EMPTY_SUMMARY = Object.freeze({
  eventCount: 0,
  successCount: 0,
  fallbackCount: 0,
  rejectedCount: 0,
  timeoutCount: 0,
  providerErrorCount: 0,
  validationErrorCount: 0,
  safetyStopCount: 0,
  durationCount: 0,
  durationP50Ms: null,
  durationP95Ms: null,
  firstOccurredAt: null,
  lastOccurredAt: null,
})
const EMPTY_AGGREGATE = Object.freeze({
  summary: EMPTY_SUMMARY, engines: Object.freeze([]), services: Object.freeze([]),
  incidentGroups: Object.freeze([]),
})

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function count(value) {
  return Number.isSafeInteger(value) && value >= 0
}

function instantMs(value) {
  if (typeof value !== 'string') return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function nullableToken(value) {
  return value === null || (typeof value === 'string' && SAFE_TOKEN.test(value))
}

function retentionCategoryFor(eventType, result) {
  if (eventType === 'safety.classification' || result === 'safety_stop') return 'safety_extended'
  if (result !== 'success' || ['gateway.request', 'sync.operation', 'persistence.operation'].includes(eventType)) {
    return 'operational_standard'
  }
  return 'diagnostic_short'
}

function decodeSummary(value) {
  const candidate = record(value)
  if (!candidate || !SUMMARY_KEYS.every((key) => Object.hasOwn(candidate, key))) return null
  const firstOccurredAt = candidate.firstOccurredAt === null ? null : instantMs(candidate.firstOccurredAt)
  const lastOccurredAt = candidate.lastOccurredAt === null ? null : instantMs(candidate.lastOccurredAt)
  const resultTotal = candidate.successCount + candidate.fallbackCount + candidate.rejectedCount
    + candidate.timeoutCount + candidate.providerErrorCount
    + candidate.validationErrorCount + candidate.safetyStopCount
  if (
    !SUMMARY_COUNT_KEYS.every((key) => count(candidate[key]))
    || resultTotal !== candidate.eventCount
    || candidate.durationCount > candidate.eventCount
    || (candidate.eventCount === 0) !== (candidate.firstOccurredAt === null && candidate.lastOccurredAt === null)
    || (candidate.eventCount > 0 && (firstOccurredAt === null || lastOccurredAt === null))
    || (firstOccurredAt !== null && lastOccurredAt !== null && firstOccurredAt > lastOccurredAt)
    || (candidate.durationCount === 0) !== (candidate.durationP50Ms === null && candidate.durationP95Ms === null)
    || (candidate.durationCount > 0 && (!count(candidate.durationP50Ms) || !count(candidate.durationP95Ms)))
    || (candidate.durationP50Ms !== null && candidate.durationP50Ms > candidate.durationP95Ms)
    || (candidate.durationP95Ms !== null && candidate.durationP95Ms > OPERATIONAL_TELEMETRY_MAX_DURATION_MS)
  ) return null
  return Object.freeze({
    ...Object.fromEntries(SUMMARY_KEYS.map((key) => [key, candidate[key]])),
    firstOccurredAt: firstOccurredAt === null ? null : new Date(firstOccurredAt).toISOString(),
    lastOccurredAt: lastOccurredAt === null ? null : new Date(lastOccurredAt).toISOString(),
  })
}

function decodeEngineSummary(value) {
  const candidate = record(value)
  const summary = decodeSummary(candidate)
  if (
    !candidate || !summary || !ADMIN_ENGINE_IDS.includes(candidate.engine)
    || typeof candidate.appVersion !== 'string' || !SAFE_VERSION.test(candidate.appVersion)
    || typeof candidate.engineVersion !== 'string' || !SAFE_VERSION.test(candidate.engineVersion)
    || (candidate.curriculumVersion !== null
      && (typeof candidate.curriculumVersion !== 'string' || !SAFE_VERSION.test(candidate.curriculumVersion)))
  ) return null
  return Object.freeze({
    ...summary,
    engineId: candidate.engine,
    appVersion: candidate.appVersion,
    engineVersion: candidate.engineVersion,
    curriculumVersion: candidate.curriculumVersion,
  })
}

function decodeServiceSummary(value) {
  const candidate = record(value)
  const summary = decodeSummary(candidate)
  if (!candidate || !summary || !SERVICE_IDS.includes(candidate.serviceId)) return null
  return Object.freeze({ ...summary, serviceId: candidate.serviceId })
}

function decodeIncidentGroup(value) {
  const candidate = record(value)
  const firstOccurredAt = instantMs(candidate?.firstOccurredAt)
  const lastOccurredAt = instantMs(candidate?.lastOccurredAt)
  if (
    !candidate || !ADMIN_ENGINE_IDS.includes(candidate.engine)
    || !ADMIN_TELEMETRY_EVENT_TYPES.includes(candidate.eventType)
    || !EVENT_ENGINES[candidate.eventType]?.has(candidate.engine)
    || !ADMIN_OPERATIONAL_RESULTS.includes(candidate.result)
    || !nullableToken(candidate.operation) || !nullableToken(candidate.provider) || !nullableToken(candidate.route)
    || !Object.hasOwn(RETENTION_CLASSES, candidate.retentionCategory)
    || candidate.retentionCategory !== retentionCategoryFor(candidate.eventType, candidate.result)
    || !count(candidate.eventCount) || candidate.eventCount === 0
    || !count(candidate.durationCount) || candidate.durationCount > candidate.eventCount
    || firstOccurredAt === null || lastOccurredAt === null || firstOccurredAt > lastOccurredAt
  ) return null
  return Object.freeze({
    engineId: candidate.engine,
    eventType: candidate.eventType,
    result: candidate.result,
    operation: candidate.operation,
    provider: candidate.provider,
    route: candidate.route,
    eventCount: candidate.eventCount,
    durationCount: candidate.durationCount,
    firstOccurredAt: new Date(firstOccurredAt).toISOString(),
    lastOccurredAt: new Date(lastOccurredAt).toISOString(),
  })
}

function unique(values, key) {
  return new Set(values.map((value) => value[key])).size === values.length
}

function serviceFor(group) {
  if (group.operation === 'authorization' || group.route === 'admin') return 'admin_api'
  if (group.eventType === 'persistence.operation') return 'persistence'
  if (group.engineId === 'tts' || group.provider === 'elevenlabs') return 'tts_gateway'
  if (group.engineId === 'gateway' || group.provider === 'anthropic') return 'anthropic_gateway'
  if (group.engineId === 'sync') return 'sync'
  if (group.engineId === 'curriculum') return 'curriculum_read'
  return null
}

function summarizeGroups(groups) {
  const summary = {
    eventCount: 0, successCount: 0, fallbackCount: 0, rejectedCount: 0,
    timeoutCount: 0, providerErrorCount: 0, validationErrorCount: 0,
    safetyStopCount: 0, durationCount: 0, firstOccurredAt: null, lastOccurredAt: null,
  }
  for (const group of groups) {
    summary.eventCount += group.eventCount
    summary.durationCount += group.durationCount
    summary[RESULT_SUMMARY_KEYS[group.result]] += group.eventCount
    if (summary.firstOccurredAt === null || group.firstOccurredAt < summary.firstOccurredAt) {
      summary.firstOccurredAt = group.firstOccurredAt
    }
    if (summary.lastOccurredAt === null || group.lastOccurredAt > summary.lastOccurredAt) {
      summary.lastOccurredAt = group.lastOccurredAt
    }
  }
  return summary
}

function groupedSummaries(groups, keyFor) {
  const grouped = new Map()
  for (const group of groups) {
    const key = keyFor(group)
    if (key === null) continue
    const bucket = grouped.get(key) ?? []
    bucket.push(group)
    grouped.set(key, bucket)
  }
  return new Map([...grouped].map(([key, bucket]) => [key, summarizeGroups(bucket)]))
}

function summaryMatches(left, right) {
  return SUMMARY_COUNT_KEYS.every((key) => left[key] === right[key])
    && left.firstOccurredAt === right.firstOccurredAt
    && left.lastOccurredAt === right.lastOccurredAt
}

function summaryWithinRange(summary, start, endExclusive) {
  if (summary.eventCount === 0) return true
  return instantMs(summary.firstOccurredAt) >= start && instantMs(summary.lastOccurredAt) < endExclusive
}

function memberSummariesMatch(items, itemKey, grouped) {
  if (items.length !== grouped.size) return false
  return items.every((item) => {
    const expected = grouped.get(item[itemKey])
    return expected !== undefined && summaryMatches(item, expected)
  })
}

function completeRetentionEvidence(value) {
  if (!Array.isArray(value) || value.length !== Object.keys(RETENTION_CLASSES).length) return false
  const seen = new Set()
  return value.every((item) => {
    const candidate = record(item)
    if (!candidate || seen.has(candidate.category)) return false
    seen.add(candidate.category)
    return Object.hasOwn(RETENTION_CLASSES, candidate.category)
      && candidate.retainedDays === RETENTION_CLASSES[candidate.category]
      && candidate.complete === true
  })
}

export function decodeSystemHealthAggregate(value, expectedRange = null) {
  const candidate = record(value)
  const completeness = record(candidate?.completeness)
  const range = record(candidate?.range)
  const filters = record(candidate?.filters)
  const summary = decodeSummary(candidate?.summary)
  const rangeStart = instantMs(range?.start)
  const rangeEnd = instantMs(range?.endExclusive)
  const expectedStart = expectedRange === null ? null : instantMs(expectedRange.start)
  const expectedEnd = expectedRange === null ? null : instantMs(expectedRange.endExclusive)
  if (
    !candidate || candidate.schemaVersion !== 2 || !completeness
    || !range || rangeStart === null || rangeEnd === null || rangeStart >= rangeEnd
    || range.maximumDays !== 366
    || (expectedRange !== null && (rangeStart !== expectedStart || rangeEnd !== expectedEnd))
    || !filters || filters.engine !== null || filters.engineVersion !== null
    || filters.courseRef !== null || filters.unitRef !== null
    || completeness.grouping !== 'complete' || completeness.allRetentionClasses !== true
    || !completeRetentionEvidence(completeness.retentionClasses)
    || !count(completeness.groupCount) || completeness.groupLimit !== 4096
    || !summary || !count(candidate.totalEventCount) || candidate.totalEventCount !== summary.eventCount
    || !Array.isArray(candidate.engineSummaries) || !Array.isArray(candidate.serviceSummaries)
    || !Array.isArray(candidate.groups)
    || candidate.groups.length !== completeness.groupCount
    || candidate.groups.length > completeness.groupLimit
  ) return null
  const engines = candidate.engineSummaries.map(decodeEngineSummary)
  const services = candidate.serviceSummaries.map(decodeServiceSummary)
  const incidentGroups = candidate.groups.map(decodeIncidentGroup)
  if (
    engines.some((item) => item === null) || services.some((item) => item === null)
    || incidentGroups.some((item) => item === null)
    || !unique(engines, 'engineId') || !unique(services, 'serviceId')
    || !summaryWithinRange(summary, rangeStart, rangeEnd)
    || engines.some((item) => !summaryWithinRange(item, rangeStart, rangeEnd))
    || services.some((item) => !summaryWithinRange(item, rangeStart, rangeEnd))
    || incidentGroups.some((item) => !summaryWithinRange(item, rangeStart, rangeEnd))
  ) return null
  const totalFromGroups = summarizeGroups(incidentGroups)
  const enginesFromGroups = groupedSummaries(incidentGroups, (group) => group.engineId)
  const servicesFromGroups = groupedSummaries(incidentGroups, serviceFor)
  if (
    !summaryMatches(summary, totalFromGroups)
    || !memberSummariesMatch(engines, 'engineId', enginesFromGroups)
    || !memberSummariesMatch(services, 'serviceId', servicesFromGroups)
  ) return null
  return Object.freeze({
    summary,
    engines: Object.freeze(engines),
    services: Object.freeze(services),
    incidentGroups: Object.freeze(incidentGroups),
  })
}

/** Exact-default-off server gates are authoritative disabled evidence. */
export function disabledHealthEngines(env) {
  const disabled = new Set()
  if (!envFlagEnabled(env, 'ACADEMY_STUDY_ENABLED')) disabled.add('study')
  if (!envFlagEnabled(env, 'ACADEMY_TTS_ENABLED')) disabled.add('tts')
  if (!envFlagEnabled(env, 'ACADEMY_AI_ENABLED')) disabled.add('gateway')
  return disabled
}

/** Health adapter over TEL-FOUNDATION's complete, raw-row-free aggregate seam. */
export function createAdminHealthSource({ env, fetchImpl, client, reader } = {}) {
  const aggregateReader = reader ?? createAdminOperationalAggregateReader({ env, fetchImpl, client })

  return Object.freeze({
    async read({ now, selectedWindow }) {
      const ranges = systemHealthAggregateRanges(now, selectedWindow)
      const pending = new Map()
      const load = (range) => {
        if (range.start >= range.endExclusive) return Promise.resolve(EMPTY_AGGREGATE)
        const key = `${range.start}/${range.endExclusive}`
        if (!pending.has(key)) {
          pending.set(key, aggregateReader.aggregate({
            start: range.start,
            endExclusive: range.endExclusive,
            capability: 'health:read',
          }).then((value) => {
            const decoded = decodeSystemHealthAggregate(value, range)
            if (!decoded) throw new Error('health_source_unavailable')
            return decoded
          }))
        }
        return pending.get(key)
      }
      const [evaluation, history, previous] = await Promise.all([
        load(ranges.evaluation),
        load(ranges.history),
        load(ranges.previous),
      ])
      return Object.freeze({ evaluation, history, previous })
    },
  })
}
