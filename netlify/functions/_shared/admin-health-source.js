import {
  ADMIN_ENGINE_IDS,
  ADMIN_OPERATIONAL_RESULTS,
  ADMIN_TELEMETRY_EVENT_TYPES,
} from '../../../src/admin/contracts.ts'
import { systemHealthAggregateRanges } from '../../../src/admin/systemHealth.ts'
import { OPERATIONAL_TELEMETRY_MAX_DURATION_MS } from '../../../src/telemetry/operationalTelemetry.ts'
import { createAdminOperationalAggregateReader } from './admin-operational-aggregate-reader.js'
import { envFlagEnabled } from './http.js'

const SERVICE_IDS = [
  'admin_api', 'persistence', 'anthropic_gateway', 'tts_gateway', 'sync', 'curriculum_read',
]
const EXPECTED_GROUP_LIMIT = 4096
const SUMMARY_COUNT_KEYS = [
  'eventCount', 'successCount', 'fallbackCount', 'rejectedCount', 'timeoutCount',
  'providerErrorCount', 'validationErrorCount', 'safetyStopCount', 'durationCount',
]
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
const SAFE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const SAFE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const TOP_LEVEL_KEYS = [
  'schemaVersion', 'range', 'filters', 'completeness', 'totalEventCount', 'groups',
]
const GROUP_KEYS = [
  'retentionCategory', 'engine', 'appVersion', 'engineVersion', 'curriculumVersion',
  'courseRef', 'unitRef', 'eventType', 'result', 'operation', 'reasonCode', 'provider',
  'route', 'eventCount', 'durationCount', 'durationTotalMs', 'durationP50Ms',
  'durationP95Ms', 'firstOccurredAt', 'lastOccurredAt',
]
const EVIDENCE_ERROR_CODES = new Set([
  'partial', 'retention_limited', 'malformed', 'unavailable', 'timeout', 'group_incomplete',
])

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
  summary: EMPTY_SUMMARY,
  engines: Object.freeze([]),
  services: Object.freeze([]),
  incidentGroups: Object.freeze([]),
})

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function exact(value, keys) {
  const candidate = record(value)
  if (!candidate) return null
  const actual = Object.keys(candidate)
  return actual.length === keys.length && actual.every((key) => keys.includes(key))
    ? candidate
    : null
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

function nullableReference(value) {
  return value === null || (typeof value === 'string' && SAFE_REFERENCE.test(value))
}

function nullableVersion(value) {
  return value === null || (typeof value === 'string' && SAFE_VERSION.test(value))
}

function retentionCategoryFor(eventType, result) {
  if (eventType === 'safety.classification' || result === 'safety_stop') return 'safety_extended'
  if (result !== 'success' || ['gateway.request', 'sync.operation', 'persistence.operation'].includes(eventType)) {
    return 'operational_standard'
  }
  return 'diagnostic_short'
}

function decodeGroup(value) {
  const candidate = exact(value, GROUP_KEYS)
  const firstOccurredAt = instantMs(candidate?.firstOccurredAt)
  const lastOccurredAt = instantMs(candidate?.lastOccurredAt)
  const hasDurations = count(candidate?.durationCount) && candidate.durationCount > 0
  if (
    !candidate
    || !ADMIN_ENGINE_IDS.includes(candidate.engine)
    || typeof candidate.appVersion !== 'string' || !SAFE_VERSION.test(candidate.appVersion)
    || typeof candidate.engineVersion !== 'string' || !SAFE_VERSION.test(candidate.engineVersion)
    || !nullableVersion(candidate.curriculumVersion)
    || !nullableReference(candidate.courseRef) || !nullableReference(candidate.unitRef)
    || !ADMIN_TELEMETRY_EVENT_TYPES.includes(candidate.eventType)
    || !EVENT_ENGINES[candidate.eventType]?.has(candidate.engine)
    || !ADMIN_OPERATIONAL_RESULTS.includes(candidate.result)
    || !nullableToken(candidate.operation) || !nullableToken(candidate.reasonCode)
    || !nullableToken(candidate.provider) || !nullableToken(candidate.route)
    || !Object.hasOwn(RETENTION_CLASSES, candidate.retentionCategory)
    || candidate.retentionCategory !== retentionCategoryFor(candidate.eventType, candidate.result)
    || !count(candidate.eventCount) || candidate.eventCount === 0
    || !count(candidate.durationCount) || candidate.durationCount > candidate.eventCount
    || !count(candidate.durationTotalMs)
    || candidate.durationTotalMs > candidate.durationCount * OPERATIONAL_TELEMETRY_MAX_DURATION_MS
    || firstOccurredAt === null || lastOccurredAt === null || firstOccurredAt > lastOccurredAt
    || (!hasDurations && (
      candidate.durationTotalMs !== 0 || candidate.durationP50Ms !== null || candidate.durationP95Ms !== null
    ))
    || (hasDurations && (
      !count(candidate.durationP50Ms) || !count(candidate.durationP95Ms)
      || candidate.durationP50Ms > candidate.durationP95Ms
      || candidate.durationP95Ms > OPERATIONAL_TELEMETRY_MAX_DURATION_MS
    ))
  ) return null
  return Object.freeze({
    retentionCategory: candidate.retentionCategory,
    engineId: candidate.engine,
    appVersion: candidate.appVersion,
    engineVersion: candidate.engineVersion,
    curriculumVersion: candidate.curriculumVersion,
    courseRef: candidate.courseRef,
    unitRef: candidate.unitRef,
    eventType: candidate.eventType,
    result: candidate.result,
    operation: candidate.operation,
    reasonCode: candidate.reasonCode,
    provider: candidate.provider,
    route: candidate.route,
    eventCount: candidate.eventCount,
    durationCount: candidate.durationCount,
    durationP50Ms: candidate.durationP50Ms,
    durationP95Ms: candidate.durationP95Ms,
    firstOccurredAt: new Date(firstOccurredAt).toISOString(),
    lastOccurredAt: new Date(lastOccurredAt).toISOString(),
  })
}

function groupIdentity(group) {
  return [
    group.retentionCategory, group.engineId, group.appVersion, group.engineVersion,
    group.curriculumVersion, group.courseRef, group.unitRef, group.eventType, group.result,
    group.operation, group.reasonCode, group.provider, group.route,
  ].map((value) => value ?? '').join('\u0000')
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
  }
  for (const group of groups) {
    summary.eventCount += group.eventCount
    summary.durationCount += group.durationCount
    summary[RESULT_SUMMARY_KEYS[group.result]] += group.eventCount
    if (!SUMMARY_COUNT_KEYS.every((key) => Number.isSafeInteger(summary[key]))) return null
    if (group.durationP50Ms !== null) {
      summary.durationP50Ms = Math.max(summary.durationP50Ms ?? 0, group.durationP50Ms)
      summary.durationP95Ms = Math.max(summary.durationP95Ms ?? 0, group.durationP95Ms)
    }
    if (summary.firstOccurredAt === null || group.firstOccurredAt < summary.firstOccurredAt) {
      summary.firstOccurredAt = group.firstOccurredAt
    }
    if (summary.lastOccurredAt === null || group.lastOccurredAt > summary.lastOccurredAt) {
      summary.lastOccurredAt = group.lastOccurredAt
    }
  }
  return Object.freeze(summary)
}

function groupsBy(groups, keyFor) {
  const grouped = new Map()
  for (const group of groups) {
    const key = keyFor(group)
    if (key === null) continue
    const bucket = grouped.get(key) ?? []
    bucket.push(group)
    grouped.set(key, bucket)
  }
  return grouped
}

function latestVersion(groups, key) {
  const latestAt = groups.reduce((latest, group) => Math.max(latest, instantMs(group.lastOccurredAt)), -Infinity)
  const values = new Set(groups.filter((group) => instantMs(group.lastOccurredAt) === latestAt).map((group) => group[key]))
  return values.size === 1 ? [...values][0] : null
}

function engineSummaries(groups) {
  const summaries = []
  for (const [engineId, bucket] of groupsBy(groups, (group) => group.engineId)) {
    const summary = summarizeGroups(bucket)
    if (!summary) return null
    summaries.push(Object.freeze({
      ...summary,
      engineId,
      appVersion: latestVersion(bucket, 'appVersion'),
      engineVersion: latestVersion(bucket, 'engineVersion'),
      curriculumVersion: latestVersion(bucket, 'curriculumVersion'),
    }))
  }
  return summaries.sort((left, right) => ADMIN_ENGINE_IDS.indexOf(left.engineId) - ADMIN_ENGINE_IDS.indexOf(right.engineId))
}

function serviceSummaries(groups) {
  const summaries = []
  for (const [serviceId, bucket] of groupsBy(groups, serviceFor)) {
    const summary = summarizeGroups(bucket)
    if (!summary || !SERVICE_IDS.includes(serviceId)) return null
    summaries.push(Object.freeze({ ...summary, serviceId }))
  }
  return summaries.sort((left, right) => SERVICE_IDS.indexOf(left.serviceId) - SERVICE_IDS.indexOf(right.serviceId))
}

function retentionStatus(value, declaredAllComplete) {
  if (typeof declaredAllComplete !== 'boolean' || !Array.isArray(value) || value.length !== 3) return 'malformed'
  const seen = new Set()
  let allComplete = true
  for (const item of value) {
    const candidate = exact(item, ['category', 'retainedDays', 'complete'])
    if (
      !candidate || seen.has(candidate.category) || !Object.hasOwn(RETENTION_CLASSES, candidate.category)
      || candidate.retainedDays !== RETENTION_CLASSES[candidate.category]
      || typeof candidate.complete !== 'boolean'
    ) return 'malformed'
    seen.add(candidate.category)
    allComplete &&= candidate.complete
  }
  if (allComplete !== declaredAllComplete) return 'malformed'
  return allComplete ? 'complete' : 'retention_limited'
}

function inspectSystemHealthAggregate(value, expectedRange = null) {
  const candidate = exact(value, TOP_LEVEL_KEYS)
  const range = exact(candidate?.range, ['start', 'endExclusive', 'maximumDays'])
  const filters = exact(candidate?.filters, ['engine', 'engineVersion', 'courseRef', 'unitRef'])
  const completeness = exact(candidate?.completeness, [
    'grouping', 'groupCount', 'groupLimit', 'allRetentionClasses', 'retentionClasses',
  ])
  const rangeStart = instantMs(range?.start)
  const rangeEnd = instantMs(range?.endExclusive)
  const expectedStart = expectedRange === null ? null : instantMs(expectedRange.start)
  const expectedEnd = expectedRange === null ? null : instantMs(expectedRange.endExclusive)
  if (
    !candidate || candidate.schemaVersion !== 2
    || !range || rangeStart === null || rangeEnd === null || rangeStart >= rangeEnd
    || range.maximumDays !== 366
    || (expectedRange !== null && (rangeStart !== expectedStart || rangeEnd !== expectedEnd))
    || !filters || filters.engine !== null || filters.engineVersion !== null
    || filters.courseRef !== null || filters.unitRef !== null
    || !completeness
    || !count(candidate.totalEventCount)
    || !Array.isArray(candidate.groups)
  ) return { status: 'malformed' }

  if (
    completeness.grouping !== 'complete'
    || !count(completeness.groupCount)
    || !count(completeness.groupLimit)
    || completeness.groupLimit !== EXPECTED_GROUP_LIMIT
    || completeness.groupCount > completeness.groupLimit
    || candidate.groups.length !== completeness.groupCount
  ) return { status: 'group_incomplete' }

  const retention = retentionStatus(completeness.retentionClasses, completeness.allRetentionClasses)
  if (retention !== 'complete') return { status: retention }

  const groups = candidate.groups.map(decodeGroup)
  if (groups.some((group) => group === null)) return { status: 'malformed' }
  const decodedGroups = groups
  if (new Set(decodedGroups.map(groupIdentity)).size !== decodedGroups.length) return { status: 'malformed' }
  if (decodedGroups.some((group) => (
    instantMs(group.firstOccurredAt) < rangeStart || instantMs(group.lastOccurredAt) >= rangeEnd
  ))) return { status: 'malformed' }

  const summary = summarizeGroups(decodedGroups)
  const engines = engineSummaries(decodedGroups)
  const services = serviceSummaries(decodedGroups)
  if (!summary || !engines || !services || summary.eventCount !== candidate.totalEventCount) {
    return { status: 'malformed' }
  }
  return {
    status: 'complete',
    value: Object.freeze({
      summary,
      engines: Object.freeze(engines),
      services: Object.freeze(services),
      incidentGroups: Object.freeze(decodedGroups),
    }),
  }
}

export function decodeSystemHealthAggregate(value, expectedRange = null) {
  const inspected = inspectSystemHealthAggregate(value, expectedRange)
  return inspected.status === 'complete' ? inspected.value : null
}

export class AdminHealthSourceReadError extends Error {
  constructor(code) {
    const safeCode = EVIDENCE_ERROR_CODES.has(code) ? code : 'unavailable'
    super(`health_${safeCode}`)
    this.name = 'AdminHealthSourceReadError'
    this.code = safeCode
  }
}

function sourceFailure(error) {
  if (error instanceof AdminHealthSourceReadError) return error.code
  if (error?.code === 'source_timeout') return 'timeout'
  if (error?.code === 'source_group_incomplete') return 'group_incomplete'
  return 'unavailable'
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
            const inspected = inspectSystemHealthAggregate(value, range)
            if (inspected.status !== 'complete') throw new AdminHealthSourceReadError(inspected.status)
            return inspected.value
          }).catch((error) => {
            throw error instanceof AdminHealthSourceReadError
              ? error
              : new AdminHealthSourceReadError(sourceFailure(error))
          }))
        }
        return pending.get(key)
      }
      const settled = await Promise.allSettled([
        load(ranges.evaluation),
        load(ranges.history),
        load(ranges.previous),
      ])
      const failures = settled.filter((result) => result.status === 'rejected')
      if (failures.length > 0) {
        const successes = settled.length - failures.length
        const codes = new Set(failures.map((failure) => sourceFailure(failure.reason)))
        const code = successes > 0 || codes.size > 1 ? 'partial' : [...codes][0]
        throw new AdminHealthSourceReadError(code)
      }
      return Object.freeze({
        evaluation: settled[0].value,
        history: settled[1].value,
        previous: settled[2].value,
      })
    },
  })
}
