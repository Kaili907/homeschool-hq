import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { buildEnginePerformanceProjection } from '../../admin/enginePerformanceModel'
import type { AdminOperationalEvent } from '../../telemetry/operationalTelemetry'
import { EnginePerformanceDashboard } from './EnginePerformanceDashboard'

function event(number: number, operation: string, result: AdminOperationalEvent['result'] = 'success', version = 'study-v1'): AdminOperationalEvent {
  return {
    schemaVersion: 2,
    eventId: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
    occurredAt: version === 'study-v1' ? '2026-08-10T12:00:00.000Z' : '2026-08-20T12:00:00.000Z',
    scope: 'household', householdRef: '00000000-0000-4000-8000-000000000001', learnerRef: null,
    engine: 'study', appVersion: 'app-1', engineVersion: version, curriculumVersion: 'curriculum-1',
    courseRef: 'course-1', unitRef: 'unit-1', lessonRef: null, skillRef: null,
    eventType: 'study.session', result, durationMs: 100, metadata: { operation },
  }
}

const rows = [
  ...Array.from({ length: 20 }, (_, index) => event(index + 1, 'start', 'success', 'study-v1')),
  ...Array.from({ length: 10 }, (_, index) => event(index + 21, 'complete', 'success', 'study-v1')),
  ...Array.from({ length: 20 }, (_, index) => event(index + 31, 'start', 'success', 'study-v2')),
  ...Array.from({ length: 16 }, (_, index) => event(index + 51, 'complete', 'success', 'study-v2')),
  event(67, 'pause', 'safety_stop', 'study-v2'),
]

const model = buildEnginePerformanceProjection(rows, {
  generatedAt: '2026-08-31T12:00:00.000Z',
  filters: {
    start: '2026-08-01T12:00:00.000Z', end: '2026-08-31T12:00:00.000Z',
    engine: null, engineVersion: null, courseRef: null, unitRef: null,
  },
})

function readyMarkup(readyModel = model) {
  return renderToStaticMarkup(<EnginePerformanceDashboard state={{ status: 'ready', model: readyModel }} selectedEngine="study" selectedWindow="30d" selectedVersion={null} />)
}

describe('EnginePerformanceDashboard', () => {
  it('renders all engines, evidence/sample counts, filters, and explicit health separation', () => {
    const html = readyMarkup()
    for (const label of ['Tutor', 'Study', 'Assessment', 'Curriculum', 'Jarvis', 'TTS', 'Gateway', 'Sync']) {
      expect(html).toContain(label)
    }
    expect(html).toContain('Engine performance analytics')
    expect(html).toContain('Performance evidence is separate from technical health')
    expect(html).toContain('No composite quality score is calculated')
    expect(html).toContain('View technical system health')
    expect(html).toContain('filtered evidence samples')
    expect(html).toContain('Sample count')
    expect(html).toContain('Time range')
    expect(html).toContain('Engine version')
  })

  it('renders supported Study outcomes, a legitimate zero, and safety stops separately', () => {
    const html = readyMarkup()
    expect(html).toContain('Sessions started')
    expect(html).toContain('Sessions completed')
    expect(html).toContain('Completion rate')
    expect(html).toContain('Safety stops (separate from performance failures)')
    expect(html).toContain('Safety stops are displayed separately')
    expect(html).toContain('Paused sessions')
  })

  it('shows evidence-based version comparison with cohort sizes and no winner', () => {
    const html = readyMarkup()
    expect(html).toContain('Comparing study-v1 with study-v2')
    expect(html).toContain('Metrics supported by both version cohorts')
    expect(html).toContain('20 samples')
    expect(html).toContain('no version is declared “better.”')
    expect(html).not.toMatch(/winner|rank engines/i)
  })

  it('keeps bounded and rejected-evidence notices visible when a malformed row reaches the raw limit', () => {
    const boundedRows = [
      ...Array.from({ length: 499 }, (_, index) => event(1_000 + index, 'start')),
      { malformed: true },
    ]
    const boundedModel = buildEnginePerformanceProjection(boundedRows, {
      generatedAt: '2026-08-31T12:00:00.000Z',
      filters: {
        start: '2026-08-01T12:00:00.000Z', end: '2026-08-31T12:00:00.000Z',
        engine: null, engineVersion: null, courseRef: null, unitRef: null,
      },
    })
    const html = readyMarkup(boundedModel)

    expect(boundedModel.source).toMatchObject({
      rawRowCount: 500, acceptedEventCount: 499, rejectedRowCount: 1,
      limitReached: true, completeness: 'partial',
    })
    expect(html).toContain('canonical 500-event read limit was reached')
    expect(html).toContain('Some malformed stored evidence was rejected')
  })

  it('provides loading, unauthorized, and safe error states with accessibility landmarks', () => {
    const loading = renderToStaticMarkup(<EnginePerformanceDashboard state={{ status: 'loading' }} selectedEngine="tutor" selectedWindow="7d" selectedVersion={null} />)
    const denied = renderToStaticMarkup(<EnginePerformanceDashboard state={{ status: 'unauthorized' }} selectedEngine="tutor" selectedWindow="7d" selectedVersion={null} />)
    const error = renderToStaticMarkup(<EnginePerformanceDashboard state={{ status: 'error', code: 'unavailable' }} selectedEngine="tutor" selectedWindow="7d" selectedVersion={null} onRetry={() => undefined} />)
    expect(loading).toContain('aria-busy="true"')
    expect(loading).toContain('role="status"')
    expect(denied).toContain('role="alert"')
    expect(denied).toContain('engines:read')
    expect(denied).toContain('href="/academy"')
    expect(error).toContain('role="alert"')
    expect(error).toContain('No substitute data is shown')
    expect(error).toContain('Try again')
  })

  it('renders no raw telemetry or private learner content', () => {
    const html = readyMarkup()
    expect(html).not.toMatch(/eventId|householdRef|learnerRef|conversation|transcript|prompt|student_audio|assessment_answer|journal|emotion|personality|diagnosis/i)
    expect(html).not.toContain('<main')
    expect(html).toContain('aria-labelledby="engine-performance-title"')
    expect(html).toContain('aria-label="Canonical engines"')
    expect(html).toContain('aria-controls="selected-engine-panel"')
    expect(html).toContain('id="selected-engine-panel"')
    expect(html).toContain('<caption>Metrics supported by both version cohorts</caption>')
  })
})
