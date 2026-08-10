import { describe, expect, it } from 'vitest'
import {
  ADMIN_COST_CONTRACT_VERSION,
  ADMIN_COST_GROUP_LIMIT,
  parseAdminCostsModel,
  validateAdminCostCustomRange,
} from './costsModel'
import { costsModelFixture } from './costsTestFixtures'

describe('Admin costs browser contract', () => {
  it('decodes the exact v3 coverage and group-bound source contract', () => {
    const model = parseAdminCostsModel(costsModelFixture())
    expect(model).toMatchObject({
      contractVersion: ADMIN_COST_CONTRACT_VERSION,
      source: {
        queryCoverage: 'complete',
        providerTrafficCoverage: 'coverage_unverified',
        accountingGapEvidence: { observedCount: 0, retentionCoverage: 'within_retention' },
        groupLimit: ADMIN_COST_GROUP_LIMIT,
        groupCount: 7,
        recordsIncluded: 3,
      },
    })
  })

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
    expect(parseAdminCostsModel({
      ...costsModelFixture(),
      breakdowns: {
        ...costsModelFixture().breakdowns,
        providers: [{
          ...costsModelFixture().breakdowns.providers[0],
          calculatedCost: { status: 'available', micros: '01', currency: 'USD' },
        }],
      },
    })).toBeNull()
  })

  it('keeps unavailable money null and never coerces it to zero', () => {
    const source = costsModelFixture()
    const model = parseAdminCostsModel({
      ...source,
      source: {
        ...source.source,
        status: 'partial',
        reasons: ['calculated_cost_unavailable'],
      },
      summary: {
        ...source.summary,
        calculatedCost: { status: 'unavailable', micros: null, currency: 'USD' },
        unavailableCostCount: 3,
        costKindCounts: { calculated: 0, reconciled: 0, unavailable: 3 },
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

  it('keeps accounting-gap evidence independent and requires its reason to agree', () => {
    const source = costsModelFixture()
    expect(parseAdminCostsModel({
      ...source,
      source: {
        ...source.source,
        status: 'partial',
        reasons: ['accounting_gap_evidence'],
        accountingGapEvidence: { observedCount: 2, retentionCoverage: 'retention_limited' },
      },
    })?.source).toMatchObject({
      queryCoverage: 'complete',
      providerTrafficCoverage: 'coverage_unverified',
      accountingGapEvidence: { observedCount: 2, retentionCoverage: 'retention_limited' },
    })
    expect(parseAdminCostsModel({
      ...source,
      source: { ...source.source, status: 'partial', reasons: ['accounting_gap_evidence'] },
    })).toBeNull()
  })

  it('rejects old v2 fixtures, hybrid record-limit fields, extra keys, and invalid group bounds', () => {
    const source = costsModelFixture()
    expect(parseAdminCostsModel({ ...source, contractVersion: 2 })).toBeNull()
    expect(parseAdminCostsModel({
      ...source,
      source: { ...source.source, recordLimit: 500 },
    })).toBeNull()
    expect(parseAdminCostsModel({ ...source, unexpectedCoverageClaim: true })).toBeNull()
    expect(parseAdminCostsModel({
      ...source,
      source: { ...source.source, groupLimit: 500 },
    })).toBeNull()
    expect(parseAdminCostsModel({
      ...source,
      source: { ...source.source, groupCount: ADMIN_COST_GROUP_LIMIT + 1 },
    })).toBeNull()
  })

  it('validates calendar order, future dates, and the 366-day maximum', () => {
    expect(validateAdminCostCustomRange('2026-08-01', '2026-08-08', '2026-08-08')).toBeNull()
    expect(validateAdminCostCustomRange('2026-08-09', '2026-08-08', '2026-08-08')).toContain('on or before')
    expect(validateAdminCostCustomRange('2026-08-08', '2026-08-09', '2026-08-08')).toContain('future')
    expect(validateAdminCostCustomRange('2025-08-07', '2026-08-08', '2026-08-08')).toContain('366')
  })
})
