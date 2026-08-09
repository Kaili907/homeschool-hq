import {
  ADMIN_ENGINE_IDS,
  ADMIN_OPERATIONAL_RESULTS,
  ADMIN_TELEMETRY_EVENT_TYPES,
} from '../../../src/admin/contracts.ts'
import { systemHealthAggregateRanges } from '../../../src/admin/systemHealth.ts'
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

function instant(value) {
  if (typeof value !== 'string') return false
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime())
}

function nullableToken(value) {
  return value === null || (typeof value === 'string' && value.length <= 128)
}

function decodeSummary(value) {
  const candidate = record(value)
  if (!candidate || !SUMMARY_KEYS.every((key) => Object.hasOwn(candidate, key))) return null
  const resultTotal = candidate.successCount + candidate.fallbackCount + candidate.rejectedCount
    + candidate.timeoutCount + candidate.providerErrorCount
    + candidate.validationErrorCount + candidate.safetyStopCount
  if (
    !SUMMARY_KEYS.slice(0, 9).every((key) => count(candidate[key]))
    || resultTotal !== candidate.eventCount
    || candidate.durationCount > candidate.eventCount
    || (candidate.eventCount === 0) !== (candidate.firstOccurredAt === null && candidate.lastOccurredAt === null)
    || (candidate.eventCount > 0 && (!instant(candidate.firstOccurredAt) || !instant(candidate.lastOccurredAt)))
    || (candidate.firstOccurredAt !== null && candidate.firstOccurredAt > candidate.lastOccurredAt)
    || (candidate.durationCount === 0) !== (candidate.durationP50Ms === null && candidate.durationP95Ms === null)
    || (candidate.durationCount > 0 && (!count(candidate.durationP50Ms) || !count(candidate.durationP95Ms)))
  ) return null
  return Object.freeze({
    ...Object.fromEntries(SUMMARY_KEYS.map((key) => [key, candidate[key]])),
    firstOccurredAt: candidate.firstOccurredAt === null
      ? null : new Date(candidate.firstOccurredAt).toISOString(),
    lastOccurredAt: candidate.lastOccurredAt === null
      ? null : new Date(candidate.lastOccurredAt).toISOString(),
  })
}

function decodeEngineSummary(value) {
  const candidate = record(value)
  const summary = decodeSummary(candidate)
  if (
    !candidate || !summary || !ADMIN_ENGINE_IDS.includes(candidate.engine)
    || typeof candidate.appVersion !== 'string' || candidate.appVersion.length > 128
    || typeof candidate.engineVersion !== 'string' || candidate.engineVersion.length > 128
    || !nullableToken(candidate.curriculumVersion)
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
  if (
    !candidate || !ADMIN_ENGINE_IDS.includes(candidate.engine)
    || !ADMIN_TELEMETRY_EVENT_TYPES.includes(candidate.eventType)
    || !ADMIN_OPERATIONAL_RESULTS.includes(candidate.result)
    || !nullableToken(candidate.operation) || !nullableToken(candidate.provider) || !nullableToken(candidate.route)
    || !count(candidate.eventCount) || candidate.eventCount === 0 || !instant(candidate.lastOccurredAt)
  ) return null
  return Object.freeze({
    engineId: candidate.engine,
    eventType: candidate.eventType,
    result: candidate.result,
    operation: candidate.operation,
    provider: candidate.provider,
    route: candidate.route,
    eventCount: candidate.eventCount,
    lastOccurredAt: new Date(candidate.lastOccurredAt).toISOString(),
  })
}

function unique(values, key) {
  return new Set(values.map((value) => value[key])).size === values.length
}

export function decodeSystemHealthAggregate(value) {
  const candidate = record(value)
  const completeness = record(candidate?.completeness)
  const summary = decodeSummary(candidate?.summary)
  if (
    !candidate || candidate.schemaVersion !== 2 || !completeness
    || completeness.grouping !== 'complete' || completeness.allRetentionClasses !== true
    || !count(completeness.groupCount) || completeness.groupLimit !== 4096
    || !summary || candidate.totalEventCount !== summary.eventCount
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
    || engines.reduce((total, item) => total + item.eventCount, 0) !== summary.eventCount
    || incidentGroups.reduce((total, item) => total + item.eventCount, 0) !== summary.eventCount
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
            const decoded = decodeSystemHealthAggregate(value)
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
