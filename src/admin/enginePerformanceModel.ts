import {
  ADMIN_CONTRACT_VERSION,
  ADMIN_ENGINE_IDS,
  type AdminEngineId,
} from './contracts'
import {
  decodeStoredOperationalEvents,
  type AdminOperationalEvent,
} from '../telemetry/operationalTelemetry'

export const ENGINE_PERFORMANCE_RATE_MIN_SAMPLE = 10
export const ENGINE_PERFORMANCE_VERSION_COMPARISON_MIN_SAMPLE = 20
export const ENGINE_PERFORMANCE_SOURCE_LIMIT = 500

export const ENGINE_PERFORMANCE_WINDOWS = ['7d', '30d', '90d'] as const
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
    readonly path: '/academy/admin/system-health'
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
  readonly source: {
    readonly acceptedEventCount: number
    readonly rejectedRowCount: number
    readonly filteredEventCount: number
    readonly limit: typeof ENGINE_PERFORMANCE_SOURCE_LIMIT
    readonly limitReached: boolean
  }
  readonly engines: readonly EnginePerformanceSummary[]
}

type MetricDefinition = {
  readonly id: string
  readonly label: string
  readonly kind: 'count' | 'rate'
  build(events: readonly AdminOperationalEvent[], window: EnginePerformanceFilters): EnginePerformanceMetric
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
  events: readonly AdminOperationalEvent[],
  window: EnginePerformanceFilters,
  predicate: (event: AdminOperationalEvent) => boolean,
  evidenceAvailable = events.length > 0,
): EnginePerformanceMetric {
  if (!evidenceAvailable) return unavailableMetric(id, label, 'count', window)
  const value = events.filter(predicate).length
  return Object.freeze({
    ...metricBase(id, label, 'count', window),
    availability: 'available', value, numerator: value, denominator: null,
    sampleCount: events.length, reasonCode: null,
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
  events: readonly AdminOperationalEvent[],
): readonly AdminOperationalEvent[] {
  return events.filter((event) => event.eventType === PRIMARY_EVENT[engine])
}

function hasOperationEvidence(
  engine: AdminEngineId,
  events: readonly AdminOperationalEvent[],
): boolean {
  return events.length > 0 && events.every((event) => {
    const operation = event.metadata.operation
    return typeof operation === 'string' && OPERATION_VOCABULARY[engine].includes(operation)
  })
}

function operationCount(events: readonly AdminOperationalEvent[], operation: string): number {
  return events.filter((event) => event.metadata.operation === operation).length
}

function resultRate(
  id: string,
  label: string,
  events: readonly AdminOperationalEvent[],
  result: AdminOperationalEvent['result'],
  window: EnginePerformanceFilters,
): EnginePerformanceMetric {
  return rateMetric(id, label, events.filter((event) => event.result === result).length, events.length, window)
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
        return rateMetric('resume_success_rate', 'Resume success rate', resumes.filter((event) => event.result === 'success').length, resumes.length, window, hasOperationEvidence('study', primary))
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
  events: readonly AdminOperationalEvent[],
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
  events: readonly AdminOperationalEvent[],
  filters: EnginePerformanceFilters,
): EngineVersionComparison {
  const comparableEvents = primaryEvents(engine, events)
  const latestByVersion = new Map<string, number>()
  for (const event of comparableEvents) {
    latestByVersion.set(event.engineVersion, Math.max(latestByVersion.get(event.engineVersion) ?? 0, Date.parse(event.occurredAt)))
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
  const decoded = decodeStoredOperationalEvents(rows)
  const filtered = decoded.events.filter((event) =>
    event.occurredAt >= filters.start
    && event.occurredAt <= filters.end
    && (filters.engine === null || event.engine === filters.engine)
    && (filters.engineVersion === null || event.engineVersion === filters.engineVersion)
    && (filters.courseRef === null || event.courseRef === filters.courseRef)
    && (filters.unitRef === null || event.unitRef === filters.unitRef),
  )
  const engines = ADMIN_ENGINE_IDS.map((engineId): EnginePerformanceSummary => {
    const events = filtered.filter((event) => event.engine === engineId)
    const metrics = metricsForEngine(engineId, events, filters)
    return Object.freeze({
      engineId,
      evidenceState: evidenceState(metrics),
      sampleCount: events.length,
      versions: Object.freeze([...new Set(events.map((event) => event.engineVersion))].sort()),
      metrics,
      unsupportedMetrics: UNSUPPORTED[engineId],
      versionComparison: versionComparison(engineId, events, filters),
      technicalHealthReference: Object.freeze({ label: 'View technical system health' as const, path: '/academy/admin/system-health' as const }),
    })
  })
  return Object.freeze({
    contractVersion: ADMIN_CONTRACT_VERSION,
    generatedAt: options.generatedAt,
    filters,
    thresholds: Object.freeze({
      rateMinimumSample: ENGINE_PERFORMANCE_RATE_MIN_SAMPLE,
      versionComparisonMinimumSample: ENGINE_PERFORMANCE_VERSION_COMPARISON_MIN_SAMPLE,
    }),
    source: Object.freeze({
      acceptedEventCount: decoded.events.length,
      rejectedRowCount: decoded.rejectedRows,
      filteredEventCount: filtered.length,
      limit: ENGINE_PERFORMANCE_SOURCE_LIMIT,
      limitReached: decoded.events.length >= (options.sourceLimit ?? ENGINE_PERFORMANCE_SOURCE_LIMIT),
    }),
    engines: Object.freeze(engines),
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
  return isRecord(value)
    && hasExactKeys(value, ['acceptedEventCount', 'rejectedRowCount', 'filteredEventCount', 'limit', 'limitReached'])
    && safeCount(value.acceptedEventCount)
    && safeCount(value.rejectedRowCount)
    && safeCount(value.filteredEventCount)
    && value.limit === ENGINE_PERFORMANCE_SOURCE_LIMIT
    && typeof value.limitReached === 'boolean'
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
    && healthReference.path === '/academy/admin/system-health'
}
