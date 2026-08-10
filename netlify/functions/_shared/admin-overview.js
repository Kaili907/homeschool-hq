import { ADMIN_CONTRACT_VERSION } from '../../../src/admin/contracts.ts'
import { buildCurriculumValidationReadModel } from '../../../src/admin/curriculum-validation/model.ts'
import { buildEnginePerformanceProjectionFromAggregate } from '../../../src/admin/enginePerformanceModel.ts'
import { buildSystemHealthProjection } from '../../../src/admin/systemHealth.ts'
import { buildAdminCostProjection, ADMIN_COST_RECORD_LIMIT } from './admin-cost-projection.js'

const DAY_MS = 24 * 60 * 60 * 1_000
const PERFORMANCE_RETENTION_MARGIN_MS = 60 * 60 * 1_000
const RANGE_KINDS = new Set(['today', '7-days', '30-days', 'school-year', 'custom'])
const DOMAIN_CAPABILITIES = Object.freeze({
  learners: 'learners:read',
  engineHealth: 'health:read',
  enginePerformance: 'engines:read',
  costs: 'costs:read',
  safety: 'safety:read',
  curriculum: 'curriculum:read',
})

function rejectRange(code = 'invalid_range') {
  const error = new Error(code)
  error.code = code
  error.statusCode = 400
  throw error
}

function isoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value ? null : value
}

function dateAt(milliseconds) {
  return new Date(milliseconds).toISOString().slice(0, 10)
}

function midnight(date) {
  return Date.parse(`${date}T00:00:00.000Z`)
}

function queryEntries(event) {
  const raw = typeof event?.rawQueryString === 'string'
    ? event.rawQueryString
    : typeof event?.rawQuery === 'string'
      ? event.rawQuery
      : null
  const multi = event?.multiValueQueryStringParameters
  if (multi !== null && multi !== undefined) {
    if (!multi || typeof multi !== 'object' || Array.isArray(multi)) rejectRange()
    for (const values of Object.values(multi)) {
      if (!Array.isArray(values) || values.length !== 1 || typeof values[0] !== 'string') rejectRange()
    }
  }
  if (raw !== null) return [...new URLSearchParams(raw).entries()]
  if (multi && Object.keys(multi).length > 0) {
    return Object.entries(multi).map(([key, values]) => [key, values[0]])
  }
  const query = event?.queryStringParameters
  if (query === null || query === undefined) return []
  if (!query || typeof query !== 'object' || Array.isArray(query)) rejectRange()
  return Object.entries(query).filter(([, value]) => value !== null)
}

/** Resolves the requested UTC date range once for every range-aware domain. */
export function resolveAdminOverviewRange(event, now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.valueOf())) rejectRange()
  const entries = queryEntries(event)
  const allowed = new Set(['range', 'start', 'end'])
  if (entries.some(([key, value]) => !allowed.has(key) || typeof value !== 'string')) rejectRange()
  const query = Object.create(null)
  for (const [key, value] of entries) {
    if (Object.hasOwn(query, key)) rejectRange()
    query[key] = value
  }
  const kind = query.range ?? 'today'
  if (!RANGE_KINDS.has(kind)) rejectRange()
  const today = now.toISOString().slice(0, 10)
  let start
  let end
  if (kind === 'custom') {
    if (Object.keys(query).length !== 3) rejectRange()
    start = isoDate(query.start)
    end = isoDate(query.end)
    if (!start || !end || start > end || end > today) rejectRange()
  } else {
    if (Object.keys(query).some((key) => key !== 'range')) rejectRange()
    end = today
    const endMs = midnight(end)
    if (kind === 'school-year') {
      const year = Number(end.slice(0, 4)) - (end.slice(5) < '08' ? 1 : 0)
      start = `${year}-08-01`
    } else {
      const days = kind === 'today' ? 1 : kind === '7-days' ? 7 : 30
      start = dateAt(endMs - (days - 1) * DAY_MS)
    }
  }
  const startMs = midnight(start)
  const endExclusiveMs = midnight(end) + DAY_MS
  const days = Math.round((endExclusiveMs - startMs) / DAY_MS)
  if (days < 1 || days > 366) rejectRange('range_too_large')
  return Object.freeze({
    kind,
    start,
    end,
    startInclusive: new Date(startMs).toISOString(),
    endExclusive: new Date(endExclusiveMs).toISOString(),
    days,
    timezone: 'UTC',
  })
}

function window(kind, label, startInclusive, endExclusive, observedAt = null) {
  return Object.freeze({ kind, label, startInclusive, endExclusive, observedAt })
}

function unavailable(windowValue, reasonCode) {
  return Object.freeze({
    availability: 'unavailable',
    freshness: 'unknown',
    completeness: 'unknown',
    observationStatus: 'unavailable',
    reasonCode,
    window: windowValue,
    data: null,
  })
}

function available(data, metadata) {
  return Object.freeze({
    availability: 'available',
    freshness: metadata.freshness,
    completeness: metadata.completeness,
    observationStatus: metadata.observationStatus,
    reasonCode: null,
    window: metadata.window,
    data: Object.freeze(data),
  })
}

function metric(value) {
  return value === null || value === undefined
    ? Object.freeze({ status: 'unavailable' })
    : Object.freeze({ status: 'available', value })
}

function capabilitySet(principal) {
  return new Set(Array.isArray(principal?.capabilities) ? principal.capabilities : [])
}

async function isolatedDomain(capabilities, name, windowValue, read) {
  if (!capabilities.has(DOMAIN_CAPABILITIES[name])) return unavailable(windowValue, 'capability_required')
  try {
    return await read()
  } catch {
    return unavailable(windowValue, 'source_unavailable')
  }
}

function deploymentEnvironment(env) {
  const value = String(env?.CONTEXT ?? env?.DEPLOY_CONTEXT ?? '').trim().toLowerCase()
  if (value === 'production') return 'production'
  if (value === 'deploy-preview') return 'deploy-preview'
  if (value === 'branch-deploy') return 'branch-deploy'
  return value === 'dev' || value === 'development' || value === 'local' ? 'local' : 'unknown'
}

function deployedVersion(env) {
  for (const value of [env?.APP_VERSION, env?.COMMIT_REF, env?.BUILD_ID]) {
    if (typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/.test(value)) return value
  }
  return null
}

function healthCompleteness(projection) {
  if (projection.evidenceCompleteness === 'truncated') return 'truncated'
  if (projection.evidenceCompleteness === 'invalid_rows_rejected') return 'partial'
  return 'complete'
}

function healthFreshness(projection) {
  return projection.freshness === 'current' ? 'current' : projection.freshness === 'stale' ? 'stale' : 'unknown'
}

function observationStatus(freshness, completeness, unknown = false) {
  if (completeness === 'partial' || completeness === 'truncated') return 'partial'
  if (freshness === 'stale') return 'stale'
  if (unknown || freshness === 'unknown') return 'unknown'
  return 'current'
}

function costWindow(range) {
  return Object.freeze({
    kind: range.kind,
    start: range.start,
    end: range.end,
    startAt: range.startInclusive,
    endExclusive: range.endExclusive,
    days: range.days,
  })
}

function mapCount(metricValue) {
  return Object.freeze({ status: metricValue.status, value: metricValue.value })
}

function curriculumStatus(validation) {
  return validation.status === 'pass'
    ? 'passed'
    : validation.status === 'pass_with_warnings'
      ? 'warning'
      : validation.status === 'fail'
        ? 'failed'
        : 'unavailable'
}

/**
 * Composes existing domain projections. It performs no ledger calculations of
 * its own and deliberately serializes aggregates only.
 */
export async function composeAdminOverview({ principal, accessToken, range, generatedAt, sources, env = {} }) {
  const capabilities = capabilitySet(principal)
  const todayWindow = window(
    'fixed',
    'Attendance recorded today (UTC)',
    `${generatedAt.slice(0, 10)}T00:00:00.000Z`,
    new Date(Date.parse(`${generatedAt.slice(0, 10)}T00:00:00.000Z`) + DAY_MS).toISOString(),
  )
  const requestedWindow = window('requested', 'Requested UTC range', range.startInclusive, range.endExclusive)
  const healthWindow = window('fixed', 'System health: selected 1-hour history and fixed evaluation window', null, generatedAt)
  const performanceWindow = window(
    'fixed',
    'Engine performance: trailing 30 days (one-hour retention margin)',
    new Date(Date.parse(generatedAt) - 30 * DAY_MS + PERFORMANCE_RETENTION_MARGIN_MS).toISOString(),
    generatedAt,
  )
  const asOfSafety = window('as-of', 'Safety durable projection as of observation', null, null)
  const asOfCurriculum = window('as-of', 'Published curriculum and validation artifacts', null, null)

  const [learners, health, enginePerformance, costs, safety, curriculum] = await Promise.all([
    isolatedDomain(capabilities, 'learners', todayWindow, async () => {
      const projection = await sources.learners({ accessToken, today: generatedAt.slice(0, 10) })
      return available({
        activeLearners: metric(projection.learners.filter((learner) => learner.attendance.recordedToday).length),
        lessonsStarted: metric(null),
        lessonsCompleted: metric(null),
        studySessions: metric(null),
        instructionalMinutes: metric(null),
      }, {
        freshness: 'current', completeness: 'complete', observationStatus: 'current',
        window: window(todayWindow.kind, todayWindow.label, todayWindow.startInclusive, todayWindow.endExclusive, projection.observedAt),
      })
    }),
    isolatedDomain(capabilities, 'engineHealth', healthWindow, async () => {
      const evidence = await sources.health()
      const projection = buildSystemHealthProjection(evidence.events, {
        now: new Date(generatedAt), selectedWindow: '1h', disabledEngines: sources.disabledEngines,
        sourceTruncated: evidence.sourceTruncated, rejectedRows: evidence.rejectedRows,
      })
      const completeness = healthCompleteness(projection)
      const freshness = healthFreshness(projection)
      return available({
        overallHealth: projection.overallHealth,
        overallReasonCodes: projection.overallReasonCodes,
        historyMetrics: projection.historyMetrics,
        engines: projection.engines,
        services: projection.services,
      }, {
        freshness,
        completeness,
        observationStatus: observationStatus(freshness, completeness, projection.overallHealth === 'unknown'),
        window: window(
          'fixed', healthWindow.label, projection.historyWindow.start,
          projection.historyWindow.end, projection.observedAt,
        ),
      })
    }),
    isolatedDomain(capabilities, 'enginePerformance', performanceWindow, async () => {
      const filters = {
        start: performanceWindow.startInclusive,
        end: performanceWindow.endExclusive,
        engine: null,
        engineVersion: null,
        courseRef: null,
        unitRef: null,
      }
      const aggregate = await sources.enginePerformance({
        start: filters.start,
        endExclusive: filters.end,
        engine: filters.engine,
        engineVersion: filters.engineVersion,
        courseRef: filters.courseRef,
        unitRef: filters.unitRef,
        capability: DOMAIN_CAPABILITIES.enginePerformance,
      })
      const projection = buildEnginePerformanceProjectionFromAggregate(aggregate, {
        generatedAt,
        filters,
      })
      const completeness = projection.source.completeness === 'complete' ? 'complete' : 'partial'
      const unknown = projection.engines.every((engine) =>
        engine.evidenceState === 'unavailable' || engine.evidenceState === 'insufficient_evidence')
      return available({
        engines: projection.engines.map((engine) => Object.freeze({
          engineId: engine.engineId,
          evidenceState: engine.evidenceState,
        })),
        qualityScore: metric(null),
      }, {
        freshness: 'unknown',
        completeness,
        observationStatus: completeness === 'complete' && !unknown ? 'unknown' : completeness === 'complete' ? 'unknown' : 'partial',
        window: performanceWindow,
      })
    }),
    isolatedDomain(capabilities, 'costs', requestedWindow, async () => {
      const records = await sources.costs({ limit: ADMIN_COST_RECORD_LIMIT, before: range.endExclusive })
      const projection = buildAdminCostProjection(records, costWindow(range), new Date(generatedAt))
      const completeness = projection.source.reasons.includes('source_record_limit')
        ? 'truncated'
        : projection.source.status === 'partial' ? 'partial' : 'complete'
      return available({
        currency: 'USD',
        requests: mapCount(projection.summary.aiRequests),
        inputTokens: mapCount(projection.summary.inputTokens),
        outputTokens: mapCount(projection.summary.outputTokens),
        cachedInputReadTokens: mapCount(projection.summary.cachedInputReadTokens),
        cachedInputWriteTokens: mapCount(projection.summary.cachedInputWriteTokens),
        ttsCharacters: mapCount(projection.summary.ttsCharacters),
        calculatedCost: projection.summary.calculatedCost,
        reconciledCost: projection.summary.reconciledCost,
        billingDispositionCounts: projection.summary.billingDispositionCounts,
        costKindCounts: projection.summary.costKindCounts,
        attributionCounts: projection.summary.attributionCounts,
        usageUnavailableCount: projection.summary.usageUnavailableCount,
        reasons: projection.source.reasons,
      }, {
        freshness: 'unknown',
        completeness,
        observationStatus: completeness === 'complete' ? 'unknown' : 'partial',
        window: requestedWindow,
      })
    }),
    isolatedDomain(capabilities, 'safety', asOfSafety, async () => {
      const projection = await sources.safety({ limit: 1, cursor: null })
      return available({
        openSafetyStops: projection.summary.openSafetyStops,
        adultReviewsPending: projection.summary.adultReviewPending,
        failClosedEvents: projection.summary.failClosedEvents,
      }, {
        freshness: 'unknown', completeness: 'complete', observationStatus: 'unknown',
        window: window('as-of', asOfSafety.label, null, null, projection.observedAt),
      })
    }),
    isolatedDomain(capabilities, 'curriculum', asOfCurriculum, async () => {
      const [catalog, evidence] = await Promise.all([sources.curriculumCatalog(), sources.curriculumValidation()])
      const validation = buildCurriculumValidationReadModel(evidence)
      return available({
        publishedVersion: metric(catalog.source.version),
        validationState: metric(curriculumStatus(validation)),
        validatedAt: metric(validation.validatedAt),
        validationArtifactVersion: metric(validation.validationArtifactVersion),
        coverageWarning: metric(null),
      }, {
        freshness: 'unknown', completeness: 'complete', observationStatus: 'unknown',
        window: window('as-of', asOfCurriculum.label, null, null, validation.validatedAt),
      })
    }),
  ])

  const system = health.availability === 'available'
    ? available({
        apiErrorRatePercent: metric(null),
        medianLatencyMs: metric(health.data.historyMetrics.p50LatencyMs),
        syncFailures: metric(health.data.services.find((service) => service.serviceId === 'sync')?.failureCount ?? null),
        persistenceFailures: metric(health.data.services.find((service) => service.serviceId === 'persistence')?.failureCount ?? null),
      }, {
        freshness: health.freshness,
        completeness: health.completeness,
        observationStatus: health.observationStatus,
        window: health.window,
      })
    : unavailable(health.window, health.reasonCode)

  const curriculumVersion = curriculum.availability === 'available'
    ? curriculum.data.publishedVersion
    : metric(null)
  const overallTechnicalHealth = health.availability === 'available'
    ? metric(health.data.overallHealth)
    : metric(null)
  const academy = available({
    environment: metric(deploymentEnvironment(env)),
    appVersion: metric(deployedVersion(env)),
    curriculumVersion,
    overallTechnicalHealth,
    lastSuccessfulRefresh: metric(null),
  }, {
    freshness: 'unknown', completeness: 'complete', observationStatus: 'unknown',
    window: window('as-of', 'Deployment metadata as of request', null, null, null),
  })

  return Object.freeze({
    contractVersion: ADMIN_CONTRACT_VERSION,
    generatedAt,
    range,
    academy,
    learners,
    engineHealth: health,
    enginePerformance,
    costs,
    safety,
    system,
    curriculum,
  })
}
