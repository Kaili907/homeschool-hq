import {
  ADMIN_CONTRACT_VERSION,
  ADMIN_ENGINE_IDS,
  type AdminEngineId,
} from './contracts'
import {
  ADMIN_OPERATIONAL_RESULTS,
  ADMIN_TELEMETRY_EVENT_TYPES,
  decodeStoredOperationalEvents,
  type AdminOperationalEvent,
  type AdminOperationalResult,
  type AdminTelemetryEventType,
} from '../telemetry/operationalTelemetry'

export const ENGINE_PERFORMANCE_RATE_MIN_SAMPLE = 10
export const ENGINE_PERFORMANCE_VERSION_COMPARISON_MIN_SAMPLE = 20
export const ENGINE_PERFORMANCE_SOURCE_LIMIT = 500
export const ENGINE_PERFORMANCE_AGGREGATE_GROUP_LIMIT = 4_096

// Ordinary successful observations retain for 30 days. Longer performance
// windows would compare them with longer-retained failures and bias rates.
export const ENGINE_PERFORMANCE_WINDOWS = ['7d', '30d'] as const
export type EnginePerformanceWindowPreset = (typeof ENGINE_PERFORMANCE_WINDOWS)[number]

export interface EnginePerformanceFilters {
  readonly start: string
  readonly end: string
  readonly engine: AdminEngineId | null
  readonly engineVersion: string | null
  readonly courseRef: string | null
  readonly unitRef: string | null
}

export type EngineMetricAvailability =
  | 'available'
  | 'insufficient_evidence'
  | 'unavailable'
  | 'not_applicable'

export interface EnginePerformanceMetric {
  readonly id: string
  readonly label: string
  readonly kind: 'count' | 'rate'
  readonly availability: EngineMetricAvailability
  readonly value: number | null
  readonly numerator: number | null
  readonly denominator: number | null
  readonly sampleCount: number
  readonly observationWindow: { readonly start: string; readonly end: string }
  readonly reasonCode: string | null
}

export interface UnsupportedEngineMetric {
  readonly id: string
  readonly label: string
  readonly reasonCode: 'structured_evidence_not_recorded' | 'educational_quality_not_applicable'
  readonly futureInstrumentation: string | null
}

export interface EngineVersionComparisonMetric {
  readonly metricId: string
  readonly label: string
  readonly availability: Exclude<EngineMetricAvailability, 'not_applicable'>
  readonly previous: {
    readonly version: string
    readonly value: number | null
    readonly numerator: number | null
    readonly denominator: number | null
    readonly sampleCount: number
  }
  readonly current: {
    readonly version: string
    readonly value: number | null
    readonly numerator: number | null
    readonly denominator: number | null
    readonly sampleCount: number
  }
  readonly reasonCode: string | null
}

export interface EngineVersionComparison {
  readonly availability: 'available' | 'insufficient_evidence' | 'unavailable'
  readonly previousVersion: string | null
  readonly currentVersion: string | null
  readonly observationWindow: { readonly start: string; readonly end: string }
  readonly metrics: readonly EngineVersionComparisonMetric[]
  readonly reasonCode: string | null
}

export interface EnginePerformanceSummary {
  readonly engineId: AdminEngineId
  readonly evidenceState: 'available' | 'partial' | 'insufficient_evidence' | 'unavailable'
  readonly sampleCount: number
  readonly versions: readonly string[]
  readonly metrics: readonly EnginePerformanceMetric[]
  readonly unsupportedMetrics: readonly UnsupportedEngineMetric[]
  readonly versionComparison: EngineVersionComparison
  readonly technicalHealthReference: {
    readonly label: 'View technical system health'
    readonly path: '/academy/admin/health'
  }
}

export interface EnginePerformanceProjection {
  readonly contractVersion: typeof ADMIN_CONTRACT_VERSION
  readonly generatedAt: string
  readonly filters: EnginePerformanceFilters
  readonly thresholds: {
    readonly rateMinimumSample: typeof ENGINE_PERFORMANCE_RATE_MIN_SAMPLE
    readonly versionComparisonMinimumSample: typeof ENGINE_PERFORMANCE_VERSION_COMPARISON_MIN_SAMPLE
  }
  readonly source: EnginePerformanceRawSource | EnginePerformanceAggregateSource
  readonly engines: readonly EnginePerformanceSummary[]
}

export interface EnginePerformanceRawSource {
    readonly rawRowCount: number
    readonly acceptedEventCount: number
    readonly rejectedRowCount: number
    readonly filteredEventCount: number
    readonly limit: typeof ENGINE_PERFORMANCE_SOURCE_LIMIT
    readonly limitReached: boolean
    readonly completeness: 'complete' | 'partial'
}

export interface EnginePerformanceRetentionClass {
  readonly category: 'diagnostic_short' | 'operational_standard' | 'safety_extended'
  readonly retainedDays: 30 | 90 | 365
  readonly complete: boolean
}

export interface EnginePerformanceAggregateSource {
  readonly mode: 'aggregate'
  readonly acceptedEventCount: number
  readonly filteredEventCount: number
  readonly groupCount: number
  readonly groupLimit: typeof ENGINE_PERFORMANCE_AGGREGATE_GROUP_LIMIT
  readonly grouping: 'complete' | 'partial'
  readonly completeness: 'complete' | 'partial' | 'retention_limited'
  readonly retention: {
    readonly status: 'complete' | 'retention_limited'
    readonly allRetentionClasses: boolean
    readonly classes: readonly EnginePerformanceRetentionClass[]
  }
}

export class EnginePerformanceAggregateError extends Error {
  constructor(readonly code: 'aggregate_malformed') {
    super(code)
    this.name = 'EnginePerformanceAggregateError'
  }
}

type EnginePerformanceEvidence = {
  readonly engine: AdminEngineId
  readonly engineVersion: string
  readonly eventType: AdminTelemetryEventType
  readonly result: AdminOperationalResult
  readonly metadata: Readonly<{ operation?: string; reason_code?: string }>
  readonly eventCount: number
  readonly lastOccurredAt: string
}

type MetricDefinition = {
  readonly id: string
  readonly label: string
  readonly kind: 'count' | 'rate'
  build(events: readonly EnginePerformanceEvidence[], window: EnginePerformanceFilters): EnginePerformanceMetric
}

const PRIMARY_EVENT: Readonly<Record<AdminEngineId, AdminOperationalEvent['eventType']>> = {
  tutor: 'tutor.turn',
  study: 'study.session',
  assessment: 'assessment.attempt',
  curriculum: 'curriculum.load',
  jarvis: 'jarvis.turn',
  tts: 'tts.synthesis',
  gateway: 'gateway.request',
  sync: 'sync.operation',
}

const OPERATION_VOCABULARY: Readonly<Record<AdminEngineId, readonly string[]>> = {
  tutor: ['intervention', 'adult_escalation'],
  study: [
    'start', 'complete', 'pause', 'resume', 'prerequisite_redirect',
    'break_recommended', 'break_accepted', 'review_recommended',
    'review_accepted', 'review_rejected',
  ],
  assessment: ['assigned', 'start', 'complete', 'retake'],
  curriculum: ['load', 'validate'],
  jarvis: ['assist'],
  tts: ['synthesize'],
  gateway: ['request'],
  sync: ['synchronize', 'recover'],
}

function metricBase(
  id: string,
  label: string,
  kind: 'count' | 'rate',
  window: EnginePerformanceFilters,
) {
  return { id, label, kind, observationWindow: { start: window.start, end: window.end } }
}

function unavailableMetric(
  id: string,
  label: string,
  kind: 'count' | 'rate',
  window: EnginePerformanceFilters,
  reasonCode = 'structured_evidence_not_recorded',
): EnginePerformanceMetric {
  return Object.freeze({
    ...metricBase(id, label, kind, window),
    availability: 'unavailable', value: null, numerator: null, denominator: null,
    sampleCount: 0, reasonCode,
  })
}

function countMetric(
  id: string,
  label: string,
  events: readonly EnginePerformanceEvidence[],
  window: EnginePerformanceFilters,
  predicate: (event: EnginePerformanceEvidence) => boolean,
  evidenceAvailable = events.length > 0,
): EnginePerformanceMetric {
  if (!evidenceAvailable) return unavailableMetric(id, label, 'count', window)
  const value = weightedCount(events, predicate)
  return Object.freeze({
    ...metricBase(id, label, 'count', window),
    availability: 'available', value, numerator: value, denominator: null,
    sampleCount: weightedCount(events), reasonCode: null,
  })
}

function rateMetric(
  id: string,
  label: string,
  numerator: number,
  denominator: number,
  window: EnginePerformanceFilters,
  evidenceAvailable = true,
): EnginePerformanceMetric {
  if (!evidenceAvailable || denominator === 0 || numerator > denominator) {
    return unavailableMetric(
      id,
      label,
      'rate',
      window,
      numerator > denominator ? 'inconsistent_structured_evidence' : 'structured_evidence_not_recorded',
    )
  }
  const sufficient = denominator >= ENGINE_PERFORMANCE_RATE_MIN_SAMPLE
  return Object.freeze({
    ...metricBase(id, label, 'rate', window),
    availability: sufficient ? 'available' : 'insufficient_evidence',
    value: sufficient ? (numerator / denominator) * 100 : null,
    numerator,
    denominator,
    sampleCount: denominator,
    reasonCode: sufficient ? null : 'minimum_sample_not_met',
  })
}

function primaryEvents(
  engine: AdminEngineId,
  events: readonly EnginePerformanceEvidence[],
): readonly EnginePerformanceEvidence[] {
  return events.filter((event) => event.eventType === PRIMARY_EVENT[engine])
}

function hasOperationEvidence(
  engine: AdminEngineId,
  events: readonly EnginePerformanceEvidence[],
): boolean {
  return events.length > 0 && events.every((event) => {
    const operation = event.metadata.operation
    return typeof operation === 'string' && OPERATION_VOCABULARY[engine].includes(operation)
  })
}

function weightedCount(
  events: readonly EnginePerformanceEvidence[],
  predicate: (event: EnginePerformanceEvidence) => boolean = () => true,
): number {
  return events.reduce((total, event) => predicate(event) ? total + event.eventCount : total, 0)
}

function operationCount(events: readonly EnginePerformanceEvidence[], operation: string): number {
  return weightedCount(events, (event) => event.metadata.operation === operation)
}

function resultRate(
  id: string,
  label: string,
  events: readonly EnginePerformanceEvidence[],
  result: AdminOperationalResult,
  window: EnginePerformanceFilters,
): EnginePerformanceMetric {
  return rateMetric(id, label, weightedCount(events, (event) => event.result === result), weightedCount(events), window)
}

function operationCountDefinition(id: string, label: string, engine: AdminEngineId, operation: string): MetricDefinition {
  return {
    id, label, kind: 'count',
    build(events, window) {
      const primary = primaryEvents(engine, events)
      return countMetric(id, label, primary, window, (event) => event.metadata.operation === operation, hasOperationEvidence(engine, primary))
    },
  }
}

function operationRateDefinition(
  id: string,
  label: string,
  engine: AdminEngineId,
  numeratorOperation: string,
  denominatorOperation: string,
): MetricDefinition {
  return {
    id, label, kind: 'rate',
    build(events, window) {
      const primary = primaryEvents(engine, events)
      const instrumented = hasOperationEvidence(engine, primary)
      return rateMetric(
        id,
        label,
        operationCount(primary, numeratorOperation),
        operationCount(primary, denominatorOperation),
        window,
        instrumented,
      )
    },
  }
}

function primaryResultRateDefinition(
  id: string,
  label: string,
  engine: AdminEngineId,
  result: AdminOperationalEvent['result'],
): MetricDefinition {
  return {
    id, label, kind: 'rate',
    build(events, window) {
      return resultRate(id, label, primaryEvents(engine, events), result, window)
    },
  }
}

const DEFINITIONS: Readonly<Record<AdminEngineId, readonly MetricDefinition[]>> = {
  tutor: [
    operationCountDefinition('tutor_interventions', 'Tutor interventions', 'tutor', 'intervention'),
    operationCountDefinition('adult_escalations', 'Adult escalations', 'tutor', 'adult_escalation'),
    primaryResultRateDefinition('fallback_rate', 'Fallback rate', 'tutor', 'fallback'),
    primaryResultRateDefinition('rejection_rate', 'Refusal / rejection rate', 'tutor', 'rejected'),
  ],
  study: [
    operationCountDefinition('sessions_started', 'Sessions started', 'study', 'start'),
    operationCountDefinition('sessions_completed', 'Sessions completed', 'study', 'complete'),
    operationRateDefinition('completion_rate', 'Completion rate', 'study', 'complete', 'start'),
    operationCountDefinition('paused_sessions', 'Paused sessions', 'study', 'pause'),
    {
      id: 'resume_success_rate', label: 'Resume success rate', kind: 'rate',
      build(events, window) {
        const primary = primaryEvents('study', events)
        const resumes = primary.filter((event) => event.metadata.operation === 'resume')
        return rateMetric('resume_success_rate', 'Resume success rate', weightedCount(resumes, (event) => event.result === 'success'), weightedCount(resumes), window, hasOperationEvidence('study', primary))
      },
    },
    operationCountDefinition('prerequisite_redirects', 'Prerequisite redirects', 'study', 'prerequisite_redirect'),
    operationCountDefinition('break_recommendations', 'Break recommendations', 'study', 'break_recommended'),
    operationRateDefinition('break_acceptance_rate', 'Break acceptance rate', 'study', 'break_accepted', 'break_recommended'),
    operationCountDefinition('review_recommendations', 'Review recommendations', 'study', 'review_recommended'),
    operationRateDefinition('review_acceptance_rate', 'Review acceptance rate', 'study', 'review_accepted', 'review_recommended'),
    operationRateDefinition('review_rejection_rate', 'Review rejection rate', 'study', 'review_rejected', 'review_recommended'),
    {
      id: 'safety_stops', label: 'Safety stops (separate from performance failures)', kind: 'count',
      build(events, window) {
        return countMetric('safety_stops', 'Safety stops (separate from performance failures)', events, window, (event) => event.result === 'safety_stop')
      },
    },
  ],
  assessment: [
    operationCountDefinition('assigned', 'Assessments assigned', 'assessment', 'assigned'),
    operationCountDefinition('started', 'Assessments started', 'assessment', 'start'),
    operationCountDefinition('completed', 'Assessments completed', 'assessment', 'complete'),
    operationRateDefinition('completion_rate', 'Completion rate', 'assessment', 'complete', 'start'),
    operationCountDefinition('retakes', 'Retakes', 'assessment', 'retake'),
    operationRateDefinition('retake_rate', 'Retake rate', 'assessment', 'retake', 'start'),
  ],
  curriculum: [
    {
      id: 'successful_content_reads', label: 'Successful content reads', kind: 'count',
      build(events, window) {
        const primary = primaryEvents('curriculum', events)
        return countMetric('successful_content_reads', 'Successful content reads', primary, window, (event) => event.result === 'success')
      },
    },
    primaryResultRateDefinition('successful_content_read_rate', 'Successful content read rate', 'curriculum', 'success'),
    {
      id: 'broken_reference_failures', label: 'Broken reference failures', kind: 'count',
      build(events, window) {
        const primary = primaryEvents('curriculum', events)
        return countMetric('broken_reference_failures', 'Broken reference failures', primary, window, (event) => event.result === 'validation_error' && event.metadata.reason_code === 'broken_reference')
      },
    },
    {
      id: 'unavailable_lessons', label: 'Unavailable lessons', kind: 'count',
      build(events, window) {
        const primary = primaryEvents('curriculum', events)
        return countMetric('unavailable_lessons', 'Unavailable lessons', primary, window, (event) => event.metadata.reason_code === 'unavailable_lesson')
      },
    },
  ],
  jarvis: [
    primaryResultRateDefinition('bounded_assistance_success_rate', 'Successful bounded assistance rate', 'jarvis', 'success'),
    primaryResultRateDefinition('fallback_rate', 'Fallback rate', 'jarvis', 'fallback'),
    primaryResultRateDefinition('rejection_rate', 'Rejection rate', 'jarvis', 'rejected'),
  ],
  tts: [primaryResultRateDefinition('synthesis_success_rate', 'Successful synthesis rate', 'tts', 'success')],
  gateway: [primaryResultRateDefinition('accepted_request_rate', 'Accepted request rate', 'gateway', 'success')],
  sync: [primaryResultRateDefinition('synchronization_success_rate', 'Successful synchronization / recovery rate', 'sync', 'success')],
}

const UNSUPPORTED: Readonly<Record<AdminEngineId, readonly UnsupportedEngineMetric[]>> = {
  tutor: [
    { id: 'next_attempt_improvement', label: 'Next-attempt improvement', reasonCode: 'structured_evidence_not_recorded', futureInstrumentation: 'A privacy-minimized intervention-to-next-attempt outcome event with a stable opaque correlation reference.' },
    { id: 'eventual_mastery', label: 'Eventual mastery after intervention', reasonCode: 'structured_evidence_not_recorded', futureInstrumentation: 'A structured mastery outcome event linked by an opaque intervention reference and bounded attempt number.' },
    { id: 'mastery_within_attempts', label: 'Mastery within bounded attempts', reasonCode: 'structured_evidence_not_recorded', futureInstrumentation: 'A canonical bounded-attempt mastery outcome; Tutor text is not an acceptable substitute.' },
  ],
  study: [],
  assessment: [
    { id: 'score_band_outcomes', label: 'Privacy-safe score-band outcomes', reasonCode: 'structured_evidence_not_recorded', futureInstrumentation: 'A server-derived aggregate score-band event that contains no answers or answer content.' },
    { id: 'working_level_recommendations', label: 'Working-level recommendation evidence', reasonCode: 'structured_evidence_not_recorded', futureInstrumentation: 'A structured recommendation outcome event with no assessment answers.' },
  ],
  curriculum: [
    { id: 'standards_quality_score', label: 'Standards quality score', reasonCode: 'educational_quality_not_applicable', futureInstrumentation: null },
  ],
  jarvis: [],
  tts: [
    { id: 'educational_audio_quality', label: 'Educational audio quality', reasonCode: 'educational_quality_not_applicable', futureInstrumentation: null },
  ],
  gateway: [],
  sync: [],
}

function metricsForEngine(
  engine: AdminEngineId,
  events: readonly EnginePerformanceEvidence[],
  filters: EnginePerformanceFilters,
): readonly EnginePerformanceMetric[] {
  return Object.freeze(DEFINITIONS[engine].map((definition) => definition.build(events, filters)))
}

function evidenceState(metrics: readonly EnginePerformanceMetric[]): EnginePerformanceSummary['evidenceState'] {
  const available = metrics.some((metric) => metric.availability === 'available')
  const unavailable = metrics.some((metric) => metric.availability === 'unavailable')
  if (available) return unavailable ? 'partial' : 'available'
  if (metrics.some((metric) => metric.availability === 'insufficient_evidence')) return 'insufficient_evidence'
  return 'unavailable'
}

function versionComparison(
  engine: AdminEngineId,
  events: readonly EnginePerformanceEvidence[],
  filters: EnginePerformanceFilters,
): EngineVersionComparison {
  const comparableEvents = primaryEvents(engine, events)
  const latestByVersion = new Map<string, number>()
  for (const event of comparableEvents) {
    latestByVersion.set(event.engineVersion, Math.max(latestByVersion.get(event.engineVersion) ?? 0, Date.parse(event.lastOccurredAt)))
  }
  const versions = [...latestByVersion].sort((left, right) => left[1] - right[1]).map(([version]) => version)
  const currentVersion = versions.at(-1) ?? null
  const previousVersion = versions.at(-2) ?? null
  const window = { start: filters.start, end: filters.end }
  if (!currentVersion || !previousVersion) {
    return Object.freeze({ availability: 'unavailable', previousVersion, currentVersion, observationWindow: window, metrics: [], reasonCode: 'two_versions_required' })
  }

  const previousMetrics = metricsForEngine(engine, comparableEvents.filter((event) => event.engineVersion === previousVersion), filters)
  const currentMetrics = metricsForEngine(engine, comparableEvents.filter((event) => event.engineVersion === currentVersion), filters)
  const comparisons: EngineVersionComparisonMetric[] = []
  for (const previous of previousMetrics) {
    if (previous.kind !== 'rate') continue
    const current = currentMetrics.find((metric) => metric.id === previous.id && metric.kind === 'rate')
    if (!current) continue
    const supported = previous.denominator !== null && current.denominator !== null
    const sufficient = supported
      && previous.denominator >= ENGINE_PERFORMANCE_VERSION_COMPARISON_MIN_SAMPLE
      && current.denominator >= ENGINE_PERFORMANCE_VERSION_COMPARISON_MIN_SAMPLE
      && previous.numerator !== null && current.numerator !== null
    comparisons.push(Object.freeze({
      metricId: previous.id,
      label: previous.label,
      availability: sufficient ? 'available' : supported ? 'insufficient_evidence' : 'unavailable',
      previous: Object.freeze({ version: previousVersion, value: sufficient ? (previous.numerator! / previous.denominator!) * 100 : null, numerator: previous.numerator, denominator: previous.denominator, sampleCount: previous.sampleCount }),
      current: Object.freeze({ version: currentVersion, value: sufficient ? (current.numerator! / current.denominator!) * 100 : null, numerator: current.numerator, denominator: current.denominator, sampleCount: current.sampleCount }),
      reasonCode: sufficient ? null : supported ? 'comparison_minimum_sample_not_met' : 'metric_not_supported_by_both_versions',
    }))
  }
  const available = comparisons.some((metric) => metric.availability === 'available')
  const supported = comparisons.some((metric) => metric.availability !== 'unavailable')
  return Object.freeze({
    availability: available ? 'available' : supported ? 'insufficient_evidence' : 'unavailable',
    previousVersion,
    currentVersion,
    observationWindow: window,
    metrics: Object.freeze(comparisons),
    reasonCode: available ? null : supported ? 'comparison_minimum_sample_not_met' : 'no_shared_supported_rate',
  })
}

function isInstant(value: string): boolean {
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value
}

function normalizeFilters(filters: EnginePerformanceFilters): EnginePerformanceFilters {
  if (!isInstant(filters.start) || !isInstant(filters.end) || filters.start > filters.end) {
    throw new TypeError('engine_performance_filter_invalid')
  }
  return Object.freeze({ ...filters })
}

function projectEvidence(
  evidence: readonly EnginePerformanceEvidence[],
  options: { readonly generatedAt: string; readonly filters: EnginePerformanceFilters },
  source: EnginePerformanceProjection['source'],
): EnginePerformanceProjection {
  const engines = ADMIN_ENGINE_IDS.map((engineId): EnginePerformanceSummary => {
    const events = evidence.filter((event) => event.engine === engineId)
    const metrics = metricsForEngine(engineId, events, options.filters)
    const sampleCount = weightedCount(events)
    const state = evidenceState(metrics)
    return Object.freeze({
      engineId,
      evidenceState: source.completeness !== 'complete' && sampleCount > 0 ? 'partial' : state,
      sampleCount,
      versions: Object.freeze([...new Set(events.map((event) => event.engineVersion))].sort()),
      metrics,
      unsupportedMetrics: UNSUPPORTED[engineId],
      versionComparison: versionComparison(engineId, events, options.filters),
      technicalHealthReference: Object.freeze({ label: 'View technical system health' as const, path: '/academy/admin/health' as const }),
    })
  })
  return Object.freeze({
    contractVersion: ADMIN_CONTRACT_VERSION,
    generatedAt: options.generatedAt,
    filters: options.filters,
    thresholds: Object.freeze({
      rateMinimumSample: ENGINE_PERFORMANCE_RATE_MIN_SAMPLE,
      versionComparisonMinimumSample: ENGINE_PERFORMANCE_VERSION_COMPARISON_MIN_SAMPLE,
    }),
    source: Object.freeze(source),
    engines: Object.freeze(engines),
  })
}

export function buildEnginePerformanceProjection(
  rows: unknown,
  options: {
    readonly generatedAt: string
    readonly filters: EnginePerformanceFilters
    readonly sourceLimit?: number
  },
): EnginePerformanceProjection {
  if (!isInstant(options.generatedAt)) throw new TypeError('engine_performance_generated_at_invalid')
  const filters = normalizeFilters(options.filters)
  const rawRowCount = Array.isArray(rows) ? rows.length : 0
  const sourceLimit = options.sourceLimit ?? ENGINE_PERFORMANCE_SOURCE_LIMIT
  const decoded = decodeStoredOperationalEvents(rows)
  const filtered = decoded.events.filter((event) =>
    event.occurredAt >= filters.start
    && event.occurredAt <= filters.end
    && (filters.engine === null || event.engine === filters.engine)
    && (filters.engineVersion === null || event.engineVersion === filters.engineVersion)
    && (filters.courseRef === null || event.courseRef === filters.courseRef)
    && (filters.unitRef === null || event.unitRef === filters.unitRef),
  )
  const evidence = filtered.map((event): EnginePerformanceEvidence => Object.freeze({
    engine: event.engine,
    engineVersion: event.engineVersion,
    eventType: event.eventType,
    result: event.result,
    metadata: Object.freeze({
      ...(typeof event.metadata.operation === 'string' ? { operation: event.metadata.operation } : {}),
      ...(typeof event.metadata.reason_code === 'string' ? { reason_code: event.metadata.reason_code } : {}),
    }),
    eventCount: 1,
    lastOccurredAt: event.occurredAt,
  }))
  return projectEvidence(evidence, { generatedAt: options.generatedAt, filters }, {
      rawRowCount,
      acceptedEventCount: decoded.events.length,
      rejectedRowCount: decoded.rejectedRows,
      filteredEventCount: filtered.length,
      limit: ENGINE_PERFORMANCE_SOURCE_LIMIT,
      limitReached: rawRowCount >= sourceLimit,
      completeness: rawRowCount >= sourceLimit || decoded.rejectedRows > 0 ? 'partial' as const : 'complete' as const,
  })
}

const AGGREGATE_ROOT_FIELDS = [
  'schemaVersion', 'range', 'filters', 'completeness', 'totalEventCount', 'groups',
] as const
const AGGREGATE_GROUP_FIELDS = [
  'retentionCategory', 'engine', 'appVersion', 'engineVersion', 'curriculumVersion',
  'courseRef', 'unitRef', 'eventType', 'result', 'operation', 'reasonCode',
  'provider', 'route', 'eventCount', 'durationCount', 'durationTotalMs',
  'durationP50Ms', 'durationP95Ms', 'firstOccurredAt', 'lastOccurredAt',
] as const
const SAFE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/
const SAFE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const SAFE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const RETENTION_DAYS = Object.freeze({
  diagnostic_short: 30,
  operational_standard: 90,
  safety_extended: 365,
} as const)

function aggregateMalformed(): never {
  throw new EnginePerformanceAggregateError('aggregate_malformed')
}

function normalizedInstant(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null
}

function nullableToken(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && SAFE_TOKEN.test(value))
}

function nullableVersion(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && SAFE_VERSION.test(value))
}

function nullableReference(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && SAFE_REFERENCE.test(value))
}

function validAggregateEventEngine(engine: AdminEngineId, eventType: AdminTelemetryEventType): boolean {
  if (eventType === 'safety.classification') {
    return ['tutor', 'study', 'assessment', 'jarvis', 'gateway'].includes(engine)
  }
  return eventType === 'persistence.operation' || PRIMARY_EVENT[engine] === eventType
}

function decodeAggregateGroup(
  value: unknown,
  filters: EnginePerformanceFilters,
): EnginePerformanceEvidence {
  if (!isRecord(value) || !hasExactKeys(value, AGGREGATE_GROUP_FIELDS)) aggregateMalformed()
  if (!ADMIN_ENGINE_IDS.includes(value.engine as AdminEngineId)) aggregateMalformed()
  const engine = value.engine as AdminEngineId
  if (!ADMIN_TELEMETRY_EVENT_TYPES.includes(value.eventType as AdminTelemetryEventType)) aggregateMalformed()
  const eventType = value.eventType as AdminTelemetryEventType
  if (!validAggregateEventEngine(engine, eventType)) aggregateMalformed()
  if (!ADMIN_OPERATIONAL_RESULTS.includes(value.result as AdminOperationalResult)) aggregateMalformed()
  if (typeof value.appVersion !== 'string' || !SAFE_VERSION.test(value.appVersion)) aggregateMalformed()
  if (typeof value.engineVersion !== 'string' || !SAFE_VERSION.test(value.engineVersion)) aggregateMalformed()
  if (!nullableVersion(value.curriculumVersion)) aggregateMalformed()
  if (!nullableReference(value.courseRef) || !nullableReference(value.unitRef)) aggregateMalformed()
  if (!nullableToken(value.operation) || !nullableToken(value.reasonCode)
    || !nullableToken(value.provider) || !nullableToken(value.route)) aggregateMalformed()
  if (typeof value.retentionCategory !== 'string'
    || !Object.hasOwn(RETENTION_DAYS, value.retentionCategory)) aggregateMalformed()
  if (!safeCount(value.eventCount) || value.eventCount < 1
    || !safeCount(value.durationCount) || value.durationCount > value.eventCount
    || !safeCount(value.durationTotalMs)
    || !nullableSafeCount(value.durationP50Ms) || !nullableSafeCount(value.durationP95Ms)) aggregateMalformed()
  const firstOccurredAt = normalizedInstant(value.firstOccurredAt)
  const lastOccurredAt = normalizedInstant(value.lastOccurredAt)
  if (!firstOccurredAt || !lastOccurredAt || firstOccurredAt > lastOccurredAt
    || firstOccurredAt < filters.start || lastOccurredAt >= filters.end) aggregateMalformed()
  if ((value.courseRef !== null || value.unitRef !== null) && value.curriculumVersion === null) aggregateMalformed()
  if ((filters.engine !== null && engine !== filters.engine)
    || (filters.engineVersion !== null && value.engineVersion !== filters.engineVersion)
    || (filters.courseRef !== null && value.courseRef !== filters.courseRef)
    || (filters.unitRef !== null && value.unitRef !== filters.unitRef)) aggregateMalformed()
  return Object.freeze({
    engine,
    engineVersion: value.engineVersion,
    eventType,
    result: value.result as AdminOperationalResult,
    metadata: Object.freeze({
      ...(value.operation === null ? {} : { operation: value.operation }),
      ...(value.reasonCode === null ? {} : { reason_code: value.reasonCode }),
    }),
    eventCount: value.eventCount,
    lastOccurredAt,
  })
}

function decodeAggregateRetention(value: unknown): {
  readonly allRetentionClasses: boolean
  readonly classes: readonly EnginePerformanceRetentionClass[]
} {
  if (!isRecord(value)
    || !hasExactKeys(value, ['grouping', 'groupCount', 'groupLimit', 'allRetentionClasses', 'retentionClasses'])
    || (value.grouping !== 'complete' && value.grouping !== 'partial')
    || !safeCount(value.groupCount)
    || value.groupLimit !== ENGINE_PERFORMANCE_AGGREGATE_GROUP_LIMIT
    || value.groupCount > value.groupLimit
    || typeof value.allRetentionClasses !== 'boolean'
    || !Array.isArray(value.retentionClasses)
    || value.retentionClasses.length !== 3) aggregateMalformed()
  const byCategory = new Map<string, EnginePerformanceRetentionClass>()
  for (const candidate of value.retentionClasses) {
    if (!isRecord(candidate)
      || !hasExactKeys(candidate, ['category', 'retainedDays', 'complete'])
      || typeof candidate.category !== 'string'
      || !Object.hasOwn(RETENTION_DAYS, candidate.category)
      || candidate.retainedDays !== RETENTION_DAYS[candidate.category as keyof typeof RETENTION_DAYS]
      || typeof candidate.complete !== 'boolean'
      || byCategory.has(candidate.category as string)) aggregateMalformed()
    byCategory.set(candidate.category as string, Object.freeze({
      category: candidate.category as EnginePerformanceRetentionClass['category'],
      retainedDays: candidate.retainedDays as EnginePerformanceRetentionClass['retainedDays'],
      complete: candidate.complete,
    }))
  }
  const classes = Object.keys(RETENTION_DAYS).map((category) => byCategory.get(category)!)
  if (classes.some((candidate) => !candidate)
    || value.allRetentionClasses !== classes.every((candidate) => candidate.complete)) aggregateMalformed()
  return Object.freeze({
    allRetentionClasses: value.allRetentionClasses,
    classes: Object.freeze(classes),
  })
}

export function buildEnginePerformanceProjectionFromAggregate(
  aggregate: unknown,
  options: { readonly generatedAt: string; readonly filters: EnginePerformanceFilters },
): EnginePerformanceProjection {
  if (!isInstant(options.generatedAt)) throw new TypeError('engine_performance_generated_at_invalid')
  const filters = normalizeFilters(options.filters)
  if (!isRecord(aggregate) || !hasExactKeys(aggregate, AGGREGATE_ROOT_FIELDS)
    || aggregate.schemaVersion !== ADMIN_CONTRACT_VERSION
    || !safeCount(aggregate.totalEventCount)
    || !Array.isArray(aggregate.groups)) aggregateMalformed()
  if (!isRecord(aggregate.range)
    || !hasExactKeys(aggregate.range, ['start', 'endExclusive', 'maximumDays'])
    || normalizedInstant(aggregate.range.start) !== filters.start
    || normalizedInstant(aggregate.range.endExclusive) !== filters.end
    || aggregate.range.maximumDays !== 366) aggregateMalformed()
  if (!isRecord(aggregate.filters)
    || !hasExactKeys(aggregate.filters, ['engine', 'engineVersion', 'courseRef', 'unitRef'])
    || aggregate.filters.engine !== filters.engine
    || aggregate.filters.engineVersion !== filters.engineVersion
    || aggregate.filters.courseRef !== filters.courseRef
    || aggregate.filters.unitRef !== filters.unitRef) aggregateMalformed()
  const retention = decodeAggregateRetention(aggregate.completeness)
  const completeness = aggregate.completeness as Record<string, unknown>
  if (completeness.groupCount !== aggregate.groups.length) aggregateMalformed()
  const evidence = aggregate.groups.map((group) => decodeAggregateGroup(group, filters))
  const representedCount = evidence.reduce((total, group) => total + group.eventCount, 0)
  if (!Number.isSafeInteger(representedCount) || representedCount !== aggregate.totalEventCount) aggregateMalformed()
  const grouping = completeness.grouping as 'complete' | 'partial'
  const sourceCompleteness = grouping === 'partial'
    ? 'partial' as const
    : retention.allRetentionClasses ? 'complete' as const : 'retention_limited' as const
  return projectEvidence(evidence, { generatedAt: options.generatedAt, filters }, {
    mode: 'aggregate',
    acceptedEventCount: representedCount,
    filteredEventCount: representedCount,
    groupCount: evidence.length,
    groupLimit: ENGINE_PERFORMANCE_AGGREGATE_GROUP_LIMIT,
    grouping,
    completeness: sourceCompleteness,
    retention: Object.freeze({
      status: retention.allRetentionClasses ? 'complete' as const : 'retention_limited' as const,
      allRetentionClasses: retention.allRetentionClasses,
      classes: retention.classes,
    }),
  })
}

export function isEnginePerformanceProjection(value: unknown): value is EnginePerformanceProjection {
  if (!isRecord(value)) return false
  const record = value as Record<string, unknown>
  if (
    !hasExactKeys(record, ['contractVersion', 'generatedAt', 'filters', 'thresholds', 'source', 'engines'])
    || record.contractVersion !== ADMIN_CONTRACT_VERSION
    || !isInstant(String(record.generatedAt))
    || !validWireFilters(record.filters)
    || !validWireThresholds(record.thresholds)
    || !validWireSource(record.source)
    || !Array.isArray(record.engines)
    || record.engines.length !== ADMIN_ENGINE_IDS.length
  ) return false
  return record.engines.every((candidate, index) => validWireEngine(candidate, ADMIN_ENGINE_IDS[index]))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(record).length === keys.length && keys.every((key) => Object.hasOwn(record, key))
}

function safeCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function nullableSafeCount(value: unknown): boolean {
  return value === null || safeCount(value)
}

function nullableFiniteNumber(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0)
}

function validWindow(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ['start', 'end'])
    && typeof value.start === 'string' && isInstant(value.start)
    && typeof value.end === 'string' && isInstant(value.end)
    && value.start <= value.end
}

function validWireFilters(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ['start', 'end', 'engine', 'engineVersion', 'courseRef', 'unitRef'])
    && validWindow({ start: value.start, end: value.end })
    && (value.engine === null || ADMIN_ENGINE_IDS.includes(value.engine as AdminEngineId))
    && [value.engineVersion, value.courseRef, value.unitRef].every((item) => item === null || typeof item === 'string')
}

function validWireThresholds(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ['rateMinimumSample', 'versionComparisonMinimumSample'])
    && value.rateMinimumSample === ENGINE_PERFORMANCE_RATE_MIN_SAMPLE
    && value.versionComparisonMinimumSample === ENGINE_PERFORMANCE_VERSION_COMPARISON_MIN_SAMPLE
}

function validWireSource(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (value.mode === 'aggregate') {
    if (!hasExactKeys(value, [
      'mode', 'acceptedEventCount', 'filteredEventCount', 'groupCount', 'groupLimit',
      'grouping', 'completeness', 'retention',
    ])
      || !safeCount(value.acceptedEventCount)
      || value.filteredEventCount !== value.acceptedEventCount
      || !safeCount(value.groupCount)
      || value.groupLimit !== ENGINE_PERFORMANCE_AGGREGATE_GROUP_LIMIT
      || value.groupCount > value.groupLimit
      || (value.grouping !== 'complete' && value.grouping !== 'partial')
      || !isRecord(value.retention)
      || !hasExactKeys(value.retention, ['status', 'allRetentionClasses', 'classes'])
      || (value.retention.status !== 'complete' && value.retention.status !== 'retention_limited')
      || typeof value.retention.allRetentionClasses !== 'boolean'
      || !Array.isArray(value.retention.classes)
      || value.retention.classes.length !== 3) return false
    const categories = new Set<string>()
    for (const candidate of value.retention.classes) {
      if (!isRecord(candidate)
        || !hasExactKeys(candidate, ['category', 'retainedDays', 'complete'])
        || typeof candidate.category !== 'string'
        || !Object.hasOwn(RETENTION_DAYS, candidate.category)
        || candidate.retainedDays !== RETENTION_DAYS[candidate.category as keyof typeof RETENTION_DAYS]
        || typeof candidate.complete !== 'boolean'
        || categories.has(candidate.category as string)) return false
      categories.add(candidate.category as string)
    }
    const retentionComplete = value.retention.classes.every((candidate) => (candidate as Record<string, unknown>).complete === true)
    return categories.size === 3
      && value.retention.allRetentionClasses === retentionComplete
      && value.retention.status === (retentionComplete ? 'complete' : 'retention_limited')
      && value.completeness === (
        value.grouping === 'partial' ? 'partial' : retentionComplete ? 'complete' : 'retention_limited'
      )
  }
  return hasExactKeys(value, ['rawRowCount', 'acceptedEventCount', 'rejectedRowCount', 'filteredEventCount', 'limit', 'limitReached', 'completeness'])
    && safeCount(value.rawRowCount)
    && safeCount(value.acceptedEventCount)
    && safeCount(value.rejectedRowCount)
    && safeCount(value.filteredEventCount)
    && value.limit === ENGINE_PERFORMANCE_SOURCE_LIMIT
    && typeof value.limitReached === 'boolean'
    && (value.completeness === 'complete' || value.completeness === 'partial')
    && value.limitReached === ((value.rawRowCount as number) >= ENGINE_PERFORMANCE_SOURCE_LIMIT)
    && value.completeness === (value.limitReached || (value.rejectedRowCount as number) > 0 ? 'partial' : 'complete')
}

function validWireMetric(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, [
    'id', 'label', 'kind', 'availability', 'value', 'numerator', 'denominator',
    'sampleCount', 'observationWindow', 'reasonCode',
  ])) return false
  return typeof value.id === 'string'
    && typeof value.label === 'string'
    && (value.kind === 'count' || value.kind === 'rate')
    && ['available', 'insufficient_evidence', 'unavailable', 'not_applicable'].includes(String(value.availability))
    && nullableFiniteNumber(value.value)
    && nullableSafeCount(value.numerator)
    && nullableSafeCount(value.denominator)
    && safeCount(value.sampleCount)
    && validWindow(value.observationWindow)
    && (value.reasonCode === null || typeof value.reasonCode === 'string')
}

function validWireUnsupportedMetric(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ['id', 'label', 'reasonCode', 'futureInstrumentation'])
    && typeof value.id === 'string'
    && typeof value.label === 'string'
    && (value.reasonCode === 'structured_evidence_not_recorded' || value.reasonCode === 'educational_quality_not_applicable')
    && (value.futureInstrumentation === null || typeof value.futureInstrumentation === 'string')
}

function validComparisonCohort(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ['version', 'value', 'numerator', 'denominator', 'sampleCount'])
    && typeof value.version === 'string'
    && nullableFiniteNumber(value.value)
    && nullableSafeCount(value.numerator)
    && nullableSafeCount(value.denominator)
    && safeCount(value.sampleCount)
}

function validWireComparisonMetric(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ['metricId', 'label', 'availability', 'previous', 'current', 'reasonCode'])
    && typeof value.metricId === 'string'
    && typeof value.label === 'string'
    && ['available', 'insufficient_evidence', 'unavailable'].includes(String(value.availability))
    && validComparisonCohort(value.previous)
    && validComparisonCohort(value.current)
    && (value.reasonCode === null || typeof value.reasonCode === 'string')
}

function validWireComparison(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ['availability', 'previousVersion', 'currentVersion', 'observationWindow', 'metrics', 'reasonCode'])
    && ['available', 'insufficient_evidence', 'unavailable'].includes(String(value.availability))
    && (value.previousVersion === null || typeof value.previousVersion === 'string')
    && (value.currentVersion === null || typeof value.currentVersion === 'string')
    && validWindow(value.observationWindow)
    && Array.isArray(value.metrics)
    && value.metrics.every(validWireComparisonMetric)
    && (value.reasonCode === null || typeof value.reasonCode === 'string')
}

function validWireEngine(value: unknown, expectedId: AdminEngineId): boolean {
  if (!isRecord(value) || !hasExactKeys(value, [
    'engineId', 'evidenceState', 'sampleCount', 'versions', 'metrics',
    'unsupportedMetrics', 'versionComparison', 'technicalHealthReference',
  ])) return false
  const healthReference = value.technicalHealthReference
  return value.engineId === expectedId
    && ['available', 'partial', 'insufficient_evidence', 'unavailable'].includes(String(value.evidenceState))
    && safeCount(value.sampleCount)
    && Array.isArray(value.versions) && value.versions.every((version) => typeof version === 'string')
    && Array.isArray(value.metrics) && value.metrics.every(validWireMetric)
    && Array.isArray(value.unsupportedMetrics) && value.unsupportedMetrics.every(validWireUnsupportedMetric)
    && validWireComparison(value.versionComparison)
    && isRecord(healthReference)
    && hasExactKeys(healthReference, ['label', 'path'])
    && healthReference.label === 'View technical system health'
    && healthReference.path === '/academy/admin/health'
}
