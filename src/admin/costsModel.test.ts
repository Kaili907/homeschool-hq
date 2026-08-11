import { describe, expect, it } from 'vitest'
import {
  parseAdminMonthlyCostAlert,
  ADMIN_COST_CONTRACT_VERSION,
  ADMIN_COST_GROUP_LIMIT,
  parseAdminCostsModel,
  validateAdminCostCustomRange,
} from './costsModel'
import { costsModelFixture, monthlyCostAlertFixture } from './costsTestFixtures'

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

  it('keeps configured monthly thresholds and observed cost as exact decimal strings', () => {
    const model = parseAdminCostsModel(costsModelFixture({
      monthlyCostThreshold: {
        status: 'warning', reason: null, basis: 'calculated_usage_estimate',
        observedMicros: '9007199254740993', warningMicros: '10000000',
        criticalMicros: '25000000', configurationRevisions: { warning: '2', critical: '3' },
      },
    }))
    expect(model?.monthlyCostThreshold).toMatchObject({
      status: 'warning', observedMicros: '9007199254740993',
    })
    expect(typeof model?.monthlyCostThreshold.observedMicros).toBe('string')
  })

  it('rejects classified thresholds with missing or out-of-registry bounds', () => {
    const source = costsModelFixture()
    expect(parseAdminCostsModel({
      ...source,
      monthlyCostThreshold: {
        status: 'critical', reason: null, basis: 'calculated_usage_estimate',
        observedMicros: '2', warningMicros: null, criticalMicros: '1',
        configurationRevisions: { warning: '1', critical: '1' },
      },
    })).toBeNull()
    expect(parseAdminCostsModel({
      ...source,
      monthlyCostThreshold: {
        status: 'warning', reason: null, basis: 'calculated_usage_estimate',
        observedMicros: '2', warningMicros: '1000000000001', criticalMicros: '1000000000002',
        configurationRevisions: { warning: '1', critical: '1' },
      },
    })).toBeNull()
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

  it('accepts only vetted provider accounting coverage and preserves the false invoice ruling', () => {
    const model = parseAdminCostsModel(costsModelFixture())
    expect(model?.providerAccountingCoverage).toMatchObject({
      status: 'complete_for_journaled_attempts',
      journalStatus: 'complete_for_journaled_attempts',
      reconciliationState: 'clear_for_journaled_attempts',
      providerInstrumentation: {
        status: 'complete',
        engines: expect.arrayContaining([
          { key: 'tutor', status: 'covered' },
          { key: 'jarvis', status: 'covered' },
          { key: 'tts', status: 'covered' },
          { key: 'study', status: 'covered' },
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

  it('rejects a false complete label when the wire metrics contain accounting gaps', () => {
    const source = costsModelFixture()
    const forgedMetrics = {
      ...source.providerAccountingCoverage.metrics!,
      accountingGaps: 1,
      gapPending: 1,
      ledgerLinkedAttempts: 1,
    }
    const forgeRows = <T extends object>(rows: readonly T[]) => rows.map((row) => ({
      ...row,
      ...forgedMetrics,
    }))
    expect(parseAdminCostsModel({
      ...source,
      providerAccountingCoverage: {
        ...source.providerAccountingCoverage,
        metrics: forgedMetrics,
        breakdowns: {
          engines: forgeRows(source.providerAccountingCoverage.breakdowns.engines),
          purposes: forgeRows(source.providerAccountingCoverage.breakdowns.purposes),
          providers: forgeRows(source.providerAccountingCoverage.breakdowns.providers),
        },
      },
    })).toBeNull()
  })

  it('rejects false-complete source metadata and impossible partial-row aggregates', () => {
    const source = costsModelFixture()
    expect(parseAdminCostsModel({
      ...source,
      source: { ...source.source, status: 'complete', reasons: ['usage_unavailable'] },
    })).toBeNull()
    expect(parseAdminCostsModel({
      ...source,
      source: { ...source.source, recordsIncluded: 501 },
    })).toBeNull()
    expect(parseAdminCostsModel({
      ...source,
      summary: {
        ...source.summary,
        attributionCounts: { ...source.summary.attributionCounts, unresolved: 1 },
      },
    })).toBeNull()
  })

  it('distinguishes reconciled terminal evidence from an interrupted dispatch', () => {
    const source = costsModelFixture()
    const coverage = source.providerAccountingCoverage
    const withEvidence = (
      metrics: NonNullable<typeof coverage.metrics>,
      status: 'complete_for_journaled_attempts' | 'partial',
    ) => ({
      ...coverage,
      status,
      journalStatus: status,
      reconciliationState: status === 'partial' ? 'in_progress' as const : 'clear_for_journaled_attempts' as const,
      metrics,
      breakdowns: {
        engines: coverage.breakdowns.engines.map((row) => ({ ...row, ...metrics, status })),
        purposes: coverage.breakdowns.purposes.map((row) => ({ ...row, ...metrics, status })),
        providers: coverage.breakdowns.providers.map((row) => ({ ...row, ...metrics, status })),
      },
    })
    const reconciled = {
      ...coverage.metrics!,
      ledgerLinkedAttempts: 1,
      reconciledAttempts: 1,
    }
    expect(parseAdminCostsModel(costsModelFixture({
      providerAccountingCoverage: withEvidence(reconciled, 'complete_for_journaled_attempts'),
    }))?.providerAccountingCoverage.status).toBe('complete_for_journaled_attempts')

    const interrupted = {
      ...coverage.metrics!,
      ledgerLinkedAttempts: 1,
      dispatchPossibleAttempts: 1,
      confirmedNotDispatched: 1,
    }
    expect(parseAdminCostsModel(costsModelFixture({
      providerAccountingCoverage: withEvidence(interrupted, 'partial'),
    }))?.providerAccountingCoverage.status).toBe('partial')
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

  it('accepts only internally consistent authoritative monthly alert results', () => {
    expect(parseAdminMonthlyCostAlert(monthlyCostAlertFixture())).toMatchObject({
      status: 'normal',
      monthlyCostMicros: '9000000',
      remainingToWarningMicros: '1000000',
      providerInvoiceTotalClaim: false,
      automaticProviderShutdown: false,
    })
    expect(parseAdminMonthlyCostAlert(monthlyCostAlertFixture({
      status: 'critical',
      activeCritical: false,
    }))).toBeNull()
    expect(parseAdminMonthlyCostAlert({
      ...monthlyCostAlertFixture(),
      browserClaimedCost: '25000000',
    })).toBeNull()
  })
})
