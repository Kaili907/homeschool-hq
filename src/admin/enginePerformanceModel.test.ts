import { describe, expect, it } from 'vitest'
import { ADMIN_ENGINE_IDS, type AdminEngineId } from './contracts'
import {
  buildEnginePerformanceProjection,
  ENGINE_PERFORMANCE_RATE_MIN_SAMPLE,
  ENGINE_PERFORMANCE_SOURCE_LIMIT,
  ENGINE_PERFORMANCE_VERSION_COMPARISON_MIN_SAMPLE,
  isEnginePerformanceProjection,
  type EnginePerformanceFilters,
} from './enginePerformanceModel'
import type { AdminOperationalEvent } from '../telemetry/operationalTelemetry'

const START = '2026-08-01T00:00:00.000Z'
const END = '2026-08-31T23:59:59.999Z'
const HOUSEHOLD = '00000000-0000-4000-8000-000000000001'
const LEARNER = '00000000-0000-4000-8000-000000000002'

const eventTypes: Record<AdminEngineId, AdminOperationalEvent['eventType']> = {
  tutor: 'tutor.turn', study: 'study.session', assessment: 'assessment.attempt',
  curriculum: 'curriculum.load', jarvis: 'jarvis.turn', tts: 'tts.synthesis',
  gateway: 'gateway.request', sync: 'sync.operation',
}

const filters: EnginePerformanceFilters = {
  start: START,
  end: END,
  engine: null,
  engineVersion: null,
  courseRef: null,
  unitRef: null,
}

let sequence = 1
function operationalEvent(
  engine: AdminEngineId,
  overrides: Partial<AdminOperationalEvent> & { operation?: string } = {},
): AdminOperationalEvent {
  const number = sequence++
  const { operation, ...eventOverrides } = overrides
  return {
    schemaVersion: 2,
    eventId: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
    occurredAt: `2026-08-${String(2 + (number % 20)).padStart(2, '0')}T12:00:00.000Z`,
    scope: 'household',
    householdRef: HOUSEHOLD,
    learnerRef: LEARNER,
    engine,
    appVersion: 'app-1',
    engineVersion: 'v1',
    curriculumVersion: 'curriculum-1',
    courseRef: 'course-1',
    unitRef: 'unit-1',
    lessonRef: null,
    skillRef: null,
    eventType: eventTypes[engine],
    result: 'success',
    durationMs: 100,
    metadata: operation === undefined ? {} : { operation },
    ...eventOverrides,
  } as AdminOperationalEvent
}

function projection(rows: unknown, selectedFilters = filters) {
  return buildEnginePerformanceProjection(rows, {
    generatedAt: END,
    filters: selectedFilters,
  })
}

function engine(model: ReturnType<typeof projection>, id: AdminEngineId) {
  return model.engines.find((candidate) => candidate.engineId === id)!
}

function metric(model: ReturnType<typeof projection>, engineId: AdminEngineId, id: string) {
  return engine(model, engineId).metrics.find((candidate) => candidate.id === id)!
}

describe('ADMIN-4 engine performance projection', () => {
  it('always represents all eight canonical engines without a health or quality score', () => {
    const model = projection([])
    expect(model.engines.map((candidate) => candidate.engineId)).toEqual(ADMIN_ENGINE_IDS)
    expect(model.engines.every((candidate) => candidate.evidenceState === 'unavailable')).toBe(true)
    expect(JSON.stringify(model)).not.toMatch(/qualityScore|"health"/)
    expect(model.engines[0].technicalHealthReference.path).toBe('/academy/admin/health')
  })

  it('shows no evidence as unavailable and a sub-threshold rate as insufficient evidence', () => {
    expect(metric(projection([]), 'tutor', 'fallback_rate').availability).toBe('unavailable')
    const events = Array.from({ length: ENGINE_PERFORMANCE_RATE_MIN_SAMPLE - 1 }, () =>
      operationalEvent('tutor', { operation: 'intervention', result: 'success' }))
    expect(metric(projection(events), 'tutor', 'fallback_rate')).toMatchObject({
      availability: 'insufficient_evidence',
      value: null,
      numerator: 0,
      denominator: ENGINE_PERFORMANCE_RATE_MIN_SAMPLE - 1,
      sampleCount: ENGINE_PERFORMANCE_RATE_MIN_SAMPLE - 1,
      reasonCode: 'minimum_sample_not_met',
    })
  })

  it('derives the reached source bound from exactly 500 raw rows', () => {
    const model = projection(Array.from({ length: ENGINE_PERFORMANCE_SOURCE_LIMIT }, () =>
      operationalEvent('study', { operation: 'start' })))

    expect(model.source).toMatchObject({
      rawRowCount: 500,
      acceptedEventCount: 500,
      rejectedRowCount: 0,
      limitReached: true,
      completeness: 'partial',
    })
  })

  it('keeps the source bound reached when one of exactly 500 raw rows is rejected', () => {
    const rows = [
      ...Array.from({ length: ENGINE_PERFORMANCE_SOURCE_LIMIT - 1 }, () =>
        operationalEvent('study', { operation: 'start' })),
      { malformed: true },
    ]
    const model = projection(rows)

    expect(model.source).toMatchObject({
      rawRowCount: 500,
      acceptedEventCount: 499,
      rejectedRowCount: 1,
      limitReached: true,
      completeness: 'partial',
    })
  })

  it('does not report the source limit reached for 499 raw rows with one rejected', () => {
    const rows = [
      ...Array.from({ length: ENGINE_PERFORMANCE_SOURCE_LIMIT - 2 }, () =>
        operationalEvent('study', { operation: 'start' })),
      { malformed: true },
    ]
    const model = projection(rows)

    expect(model.source).toMatchObject({
      rawRowCount: 499,
      acceptedEventCount: 498,
      rejectedRowCount: 1,
      limitReached: false,
      completeness: 'partial',
    })
  })

  it('excludes malformed rows from metrics and evidence-sufficiency thresholds', () => {
    const rows = [
      ...Array.from({ length: ENGINE_PERFORMANCE_RATE_MIN_SAMPLE - 1 }, () =>
        operationalEvent('tutor', { operation: 'intervention', result: 'success' })),
      { malformed: true },
    ]
    const model = projection(rows)

    expect(model.source).toMatchObject({
      rawRowCount: 10,
      acceptedEventCount: 9,
      rejectedRowCount: 1,
      completeness: 'partial',
    })
    expect(metric(model, 'tutor', 'tutor_interventions')).toMatchObject({ value: 9, sampleCount: 9 })
    expect(metric(model, 'tutor', 'fallback_rate')).toMatchObject({
      availability: 'insufficient_evidence',
      value: null,
      denominator: 9,
      sampleCount: 9,
    })
  })

  it('preserves a legitimate zero once the deterministic sample threshold is met', () => {
    const events = Array.from({ length: ENGINE_PERFORMANCE_RATE_MIN_SAMPLE }, () =>
      operationalEvent('jarvis', { operation: 'assist', result: 'success' }))
    expect(metric(projection(events), 'jarvis', 'fallback_rate')).toMatchObject({
      availability: 'available', value: 0, numerator: 0,
      denominator: ENGINE_PERFORMANCE_RATE_MIN_SAMPLE,
    })
  })

  it('counts structured Tutor interventions but never fabricates next-attempt or mastery outcomes', () => {
    const events = [
      operationalEvent('tutor', { operation: 'intervention' }),
      operationalEvent('tutor', { operation: 'intervention', result: 'fallback' }),
      operationalEvent('tutor', { operation: 'adult_escalation' }),
    ]
    const tutor = engine(projection(events), 'tutor')
    expect(tutor.metrics.find((candidate) => candidate.id === 'tutor_interventions')).toMatchObject({
      availability: 'available', value: 2, sampleCount: 3,
    })
    expect(tutor.unsupportedMetrics.map((candidate) => candidate.id)).toEqual([
      'next_attempt_improvement', 'eventual_mastery', 'mastery_within_attempts',
    ])
    expect(tutor.unsupportedMetrics.every((candidate) => candidate.reasonCode === 'structured_evidence_not_recorded')).toBe(true)
  })

  it('calculates Study completion, resume, review outcomes, and keeps safety stops separate', () => {
    const events = [
      ...Array.from({ length: 10 }, () => operationalEvent('study', { operation: 'start' })),
      ...Array.from({ length: 6 }, () => operationalEvent('study', { operation: 'complete' })),
      ...Array.from({ length: 10 }, (_, index) => operationalEvent('study', { operation: 'resume', result: index < 8 ? 'success' : 'fallback' })),
      ...Array.from({ length: 10 }, () => operationalEvent('study', { operation: 'review_recommended' })),
      ...Array.from({ length: 7 }, () => operationalEvent('study', { operation: 'review_accepted' })),
      ...Array.from({ length: 3 }, () => operationalEvent('study', { operation: 'review_rejected' })),
      operationalEvent('study', { operation: 'pause', result: 'safety_stop' }),
    ]
    const model = projection(events)
    expect(metric(model, 'study', 'completion_rate')).toMatchObject({ availability: 'available', value: 60, numerator: 6, denominator: 10 })
    expect(metric(model, 'study', 'resume_success_rate')).toMatchObject({ availability: 'available', value: 80, numerator: 8, denominator: 10 })
    expect(metric(model, 'study', 'review_acceptance_rate')).toMatchObject({ availability: 'available', value: 70, numerator: 7, denominator: 10 })
    expect(metric(model, 'study', 'review_rejection_rate')).toMatchObject({ availability: 'available', value: 30, numerator: 3, denominator: 10 })
    expect(metric(model, 'study', 'safety_stops')).toMatchObject({ availability: 'available', value: 1 })
    expect(metric(model, 'study', 'completion_rate').numerator).toBe(6)
  })

  it('calculates assessment lifecycle evidence without exposing answers or treating scores as engine failure', () => {
    const events = [
      ...Array.from({ length: 10 }, () => operationalEvent('assessment', { operation: 'start' })),
      ...Array.from({ length: 8 }, () => operationalEvent('assessment', { operation: 'complete' })),
      ...Array.from({ length: 2 }, () => operationalEvent('assessment', { operation: 'retake' })),
    ]
    const model = projection(events)
    expect(metric(model, 'assessment', 'completion_rate')).toMatchObject({ availability: 'available', value: 80 })
    expect(metric(model, 'assessment', 'retake_rate')).toMatchObject({ availability: 'available', value: 20 })
    expect(engine(model, 'assessment').unsupportedMetrics.map((candidate) => candidate.id)).toContain('score_band_outcomes')
    expect(JSON.stringify(model)).not.toMatch(/assessment_answer|answer_content|raw_answer/)
  })

  it('projects appropriate structured operational outcomes for the remaining engines', () => {
    const events = [
      ...Array.from({ length: 10 }, () => operationalEvent('curriculum', { operation: 'load' })),
      ...Array.from({ length: 10 }, () => operationalEvent('tts', { operation: 'synthesize' })),
      ...Array.from({ length: 10 }, () => operationalEvent('gateway', { operation: 'request' })),
      ...Array.from({ length: 10 }, () => operationalEvent('sync', { operation: 'synchronize' })),
    ]
    const model = projection(events)
    expect(metric(model, 'curriculum', 'successful_content_read_rate').value).toBe(100)
    expect(metric(model, 'tts', 'synthesis_success_rate').value).toBe(100)
    expect(metric(model, 'gateway', 'accepted_request_rate').value).toBe(100)
    expect(metric(model, 'sync', 'synchronization_success_rate').value).toBe(100)
    expect(engine(model, 'tts').unsupportedMetrics[0].reasonCode).toBe('educational_quality_not_applicable')
  })

  it('compares only shared rate evidence across versions and refuses tiny-sample conclusions', () => {
    const sufficient = [
      ...Array.from({ length: ENGINE_PERFORMANCE_VERSION_COMPARISON_MIN_SAMPLE }, (_, index) =>
        operationalEvent('tutor', { operation: 'intervention', engineVersion: 'v1', occurredAt: '2026-08-05T12:00:00.000Z', result: index < 4 ? 'fallback' : 'success' })),
      ...Array.from({ length: ENGINE_PERFORMANCE_VERSION_COMPARISON_MIN_SAMPLE }, (_, index) =>
        operationalEvent('tutor', { operation: 'intervention', engineVersion: 'v2', occurredAt: '2026-08-15T12:00:00.000Z', result: index < 2 ? 'fallback' : 'success' })),
    ]
    const comparison = engine(projection(sufficient), 'tutor').versionComparison
    expect(comparison).toMatchObject({ availability: 'available', previousVersion: 'v1', currentVersion: 'v2' })
    expect(comparison.metrics.find((candidate) => candidate.metricId === 'fallback_rate')).toMatchObject({
      availability: 'available',
      previous: { value: 20, numerator: 4, denominator: 20, sampleCount: 20 },
      current: { value: 10, numerator: 2, denominator: 20, sampleCount: 20 },
    })
    expect(JSON.stringify(comparison)).not.toMatch(/better|winner|quality/i)

    const tiny = projection(sufficient.slice(0, 10).concat(sufficient.slice(20, 30)))
    expect(engine(tiny, 'tutor').versionComparison.availability).toBe('insufficient_evidence')
    expect(engine(tiny, 'tutor').versionComparison.metrics.every((candidate) => candidate.previous.value === null && candidate.current.value === null)).toBe(true)
  })

  it('keeps version comparison based on accepted evidence under the corrected source model', () => {
    const rows = [
      ...Array.from({ length: ENGINE_PERFORMANCE_VERSION_COMPARISON_MIN_SAMPLE }, (_, index) =>
        operationalEvent('tutor', { operation: 'intervention', engineVersion: 'v1', occurredAt: '2026-08-05T12:00:00.000Z', result: index < 4 ? 'fallback' : 'success' })),
      ...Array.from({ length: ENGINE_PERFORMANCE_VERSION_COMPARISON_MIN_SAMPLE }, (_, index) =>
        operationalEvent('tutor', { operation: 'intervention', engineVersion: 'v2', occurredAt: '2026-08-15T12:00:00.000Z', result: index < 2 ? 'fallback' : 'success' })),
      { malformed: true },
    ]
    const model = projection(rows)
    const comparison = engine(model, 'tutor').versionComparison

    expect(model.source).toMatchObject({ rawRowCount: 41, acceptedEventCount: 40, rejectedRowCount: 1 })
    expect(comparison).toMatchObject({ availability: 'available', previousVersion: 'v1', currentVersion: 'v2' })
    expect(comparison.metrics.find((candidate) => candidate.metricId === 'fallback_rate')).toMatchObject({
      previous: { value: 20, sampleCount: 20 },
      current: { value: 10, sampleCount: 20 },
    })
  })

  it('applies bounded time, engine, version, course, and unit filters before aggregation', () => {
    const matching = operationalEvent('study', { operation: 'start', engineVersion: 'v2', courseRef: 'course-2', unitRef: 'unit-2' })
    const otherEngine = operationalEvent('tutor', { operation: 'intervention', engineVersion: 'v2', courseRef: 'course-2', unitRef: 'unit-2' })
    const otherVersion = operationalEvent('study', { operation: 'start', engineVersion: 'v1', courseRef: 'course-2', unitRef: 'unit-2' })
    const model = projection([matching, otherEngine, otherVersion], {
      ...filters, engine: 'study', engineVersion: 'v2', courseRef: 'course-2', unitRef: 'unit-2',
    })
    expect(model.source.filteredEventCount).toBe(1)
    expect(engine(model, 'study').sampleCount).toBe(1)
    expect(engine(model, 'tutor').sampleCount).toBe(0)
  })

  it('returns a bounded DTO with counts, windows, threshold disclosure, and no raw rows or private fields', () => {
    const model = projection([operationalEvent('tutor', { operation: 'intervention' })])
    const wire = JSON.stringify(model)
    expect(isEnginePerformanceProjection(model)).toBe(true)
    expect(model.thresholds).toEqual({ rateMinimumSample: 10, versionComparisonMinimumSample: 20 })
    expect(metric(model, 'tutor', 'tutor_interventions').observationWindow).toEqual({ start: START, end: END })
    expect(wire).not.toMatch(/eventId|householdRef|learnerRef|lessonRef|skillRef|conversation|transcript|prompt|response|student_audio|journal|emotion|personality|diagnos|provider payload/i)
  })

  it('fails closed for invalid observation windows and rejects DTOs with composite or health fields', () => {
    expect(() => projection([], { ...filters, start: 'not-a-date' })).toThrow('engine_performance_filter_invalid')
    const model = projection([])
    expect(isEnginePerformanceProjection({ ...model, rows: [] })).toBe(false)
    expect(isEnginePerformanceProjection({ ...model, engines: model.engines.map((item, index) => index === 0 ? { ...item, qualityScore: 99 } : item) })).toBe(false)
  })
})
