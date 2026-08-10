import { describe, expect, it } from 'vitest'
import {
  parseAdminCostsModel,
  validateAdminCostCustomRange,
} from './costsModel'
import { costsModelFixture } from './costsTestFixtures'

describe('Admin costs browser contract', () => {
  it('accepts exact IntegerMicros beyond Number safe range without converting it', () => {
    const model = parseAdminCostsModel(costsModelFixture())
    expect(model?.summary.calculatedCost.micros).toBe('9007199254740993')
    expect(typeof model?.summary.calculatedCost.micros).toBe('string')
  })

  it('rejects Number money and unvetted server labels', () => {
    expect(parseAdminCostsModel({
      ...costsModelFixture(),
      summary: { ...costsModelFixture().summary, calculatedCost: { status: 'available', micros: 1.2, currency: 'USD' } },
    })).toBeNull()
    expect(parseAdminCostsModel({
      ...costsModelFixture(),
      breakdowns: {
        ...costsModelFixture().breakdowns,
        models: [{ ...costsModelFixture().breakdowns.models[0], label: 'raw provider SECRET' }],
      },
    })).toBeNull()
  })

  it('accepts the bounded Study cost breakdown label', () => {
    const source = costsModelFixture()
    expect(parseAdminCostsModel({
      ...source,
      breakdowns: {
        ...source.breakdowns,
        engines: [{ ...source.breakdowns.engines[0], key: 'study', label: 'Study' }],
      },
    })?.breakdowns.engines[0]).toMatchObject({ key: 'study', label: 'Study' })
  })

  it('keeps unavailable money null and never coerces it to zero', () => {
    const source = costsModelFixture()
    const model = parseAdminCostsModel({
      ...source,
      summary: {
        ...source.summary,
        calculatedCost: { status: 'unavailable', micros: null, currency: 'USD' },
      },
    })
    expect(model?.summary.calculatedCost).toEqual({ status: 'unavailable', micros: null, currency: 'USD' })
  })

  it('requires complete query coverage without promoting provider traffic coverage', () => {
    const source = costsModelFixture()
    expect(parseAdminCostsModel(source)?.source).toMatchObject({
      queryCoverage: 'complete',
      providerTrafficCoverage: 'coverage_unverified',
      groupLimit: 384,
      groupCount: 7,
    })
    expect(parseAdminCostsModel({
      ...source,
      source: { ...source.source, queryCoverage: 'unavailable' },
    })).toBeNull()
    expect(parseAdminCostsModel({
      ...source,
      source: { ...source.source, providerTrafficCoverage: 'complete' },
    })).toBeNull()
  })

  it('validates calendar order, future dates, and the 366-day maximum', () => {
    expect(validateAdminCostCustomRange('2026-08-01', '2026-08-08', '2026-08-08')).toBeNull()
    expect(validateAdminCostCustomRange('2026-08-09', '2026-08-08', '2026-08-08')).toContain('on or before')
    expect(validateAdminCostCustomRange('2026-08-08', '2026-08-09', '2026-08-08')).toContain('future')
    expect(validateAdminCostCustomRange('2025-08-07', '2026-08-08', '2026-08-08')).toContain('366')
  })
})
