import { describe, expect, it } from 'vitest'
import { adaptAdminOverview, adaptSourceMetric, type AdminOverviewSource } from './overviewAdapter'
import { movePresetSelection, validateCustomRange } from './overviewModel'

describe('admin overview presentation adapter', () => {
  it('preserves real zero values instead of treating them as unavailable', () => {
    expect(adaptSourceMetric(0)).toEqual({ status: 'available', value: 0 })
  })

  it('maps explicit unavailability and missing telemetry without fabricating values', () => {
    expect(adaptSourceMetric(null)).toEqual({ status: 'unavailable' })
    expect(adaptSourceMetric(undefined)).toEqual({ status: 'unknown' })
  })

  it('adapts the narrow source snapshot without changing health meaning', () => {
    const source: AdminOverviewSource = {
      range: { kind: 'preset', preset: 'today' },
      freshness: 'current',
      academy: { environment: 'production', overallHealth: 'unknown' },
      learners: { activeLearners: 0, lessonsStarted: null },
      engines: [
        { name: 'Tutor', health: 'unknown' },
        { name: 'TTS', health: 'disabled' },
        { name: 'Sync', health: 'unavailable' },
      ],
      ai: {}, safety: {}, system: {},
    }
    const model = adaptAdminOverview(source)
    expect(model.academy.overallHealth).toEqual({ status: 'available', value: 'unknown' })
    expect(model.learners.activeLearners).toEqual({ status: 'available', value: 0 })
    expect(model.learners.lessonsStarted).toEqual({ status: 'unavailable' })
    expect(model.learners.lessonsCompleted).toEqual({ status: 'unknown' })
    expect(model.engines.map(({ health }) => health)).toEqual(['unknown', 'disabled', 'unavailable'])
  })
})

describe('overview range behavior', () => {
  it('validates custom range completeness and ordering', () => {
    expect(validateCustomRange('', '')).toMatch(/both/i)
    expect(validateCustomRange('2026-08-08', '')).toMatch(/both/i)
    expect(validateCustomRange('08/08/2026', '2026-08-09')).toMatch(/valid/i)
    expect(validateCustomRange('2026-02-30', '2026-03-01')).toMatch(/valid/i)
    expect(validateCustomRange('2026-08-10', '2026-08-09')).toMatch(/on or before/i)
    expect(validateCustomRange('2026-08-08', '2026-08-09')).toBeNull()
  })

  it('supports arrow, Home, and End keyboard movement across presets', () => {
    expect(movePresetSelection('today', 'ArrowLeft')).toBe('school-year')
    expect(movePresetSelection('today', 'ArrowRight')).toBe('7-days')
    expect(movePresetSelection('30-days', 'Home')).toBe('today')
    expect(movePresetSelection('today', 'End')).toBe('school-year')
  })
})
