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

  it('validates calendar order, future dates, and the 366-day maximum', () => {
    expect(validateAdminCostCustomRange('2026-08-01', '2026-08-08', '2026-08-08')).toBeNull()
    expect(validateAdminCostCustomRange('2026-08-09', '2026-08-08', '2026-08-08')).toContain('on or before')
    expect(validateAdminCostCustomRange('2026-08-08', '2026-08-09', '2026-08-08')).toContain('future')
    expect(validateAdminCostCustomRange('2025-08-07', '2026-08-08', '2026-08-08')).toContain('366')
  })

  it('accepts only vetted provider accounting coverage and preserves the false invoice ruling', () => {
    const model = parseAdminCostsModel(costsModelFixture())
    expect(model?.providerAccountingCoverage).toMatchObject({
      status: 'partial',
      journalStatus: 'complete_for_journaled_attempts',
      reconciliationState: 'clear_for_journaled_attempts',
      providerInstrumentation: {
        status: 'partial',
        engines: expect.arrayContaining([
          { key: 'tutor', status: 'covered' },
          { key: 'jarvis', status: 'covered' },
          { key: 'tts', status: 'covered' },
          { key: 'study', status: 'pending' },
        ]),
      },
      invoiceCompletenessClaim: false,
      metrics: { reservedAttempts: 3, ledgerLinkedAttempts: 2 },
    })

    const source = costsModelFixture()
    expect(parseAdminCostsModel({
      ...source,
      providerAccountingCoverage: {
        ...source.providerAccountingCoverage,
        invoiceCompletenessClaim: true,
      },
    })).toBeNull()
  })

  it('drops unknown coverage fields instead of exposing content or raw provider diagnostics', () => {
    const source = costsModelFixture()
    const model = parseAdminCostsModel({
      ...source,
      providerAccountingCoverage: {
        ...source.providerAccountingCoverage,
        prompt: 'PRIVATE LEARNER CONTENT',
        rawProviderError: 'SECRET PROVIDER BODY',
      },
    })
    const wire = JSON.stringify(model?.providerAccountingCoverage)
    expect(wire).not.toContain('PRIVATE')
    expect(wire).not.toContain('SECRET')
    expect(wire).not.toContain('prompt')
    expect(wire).not.toContain('rawProviderError')
  })
})
