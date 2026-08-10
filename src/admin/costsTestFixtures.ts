import type { AdminCostAggregate, AdminCostsModel } from './costsModel'

export function costAggregateFixture(overrides: Partial<AdminCostAggregate> = {}): AdminCostAggregate {
  const count = (value: number) => ({ status: 'available' as const, value })
  const money = (micros: string) => ({ status: 'available' as const, micros, currency: 'USD' as const })
  return {
    totalRequests: count(3), aiRequests: count(2), ttsRequests: count(1),
    inputTokens: count(100), outputTokens: count(40), cachedInputReadTokens: count(20),
    cachedInputWriteTokens: count(5), ttsCharacters: count(250),
    calculatedCost: money('9007199254740993'), reconciledCost: money('0'),
    unavailableCostCount: 0, ...overrides,
  }
}

export function costsModelFixture(overrides: Partial<AdminCostsModel> = {}): AdminCostsModel {
  const values = costAggregateFixture()
  const row = { key: 'tutor', label: 'Tutor', ...values }
  return {
    contractVersion: 2,
    generatedAt: '2026-08-08T18:30:00.000Z',
    currency: 'USD',
    range: {
      kind: 'today', start: '2026-08-08', end: '2026-08-08',
      startAt: '2026-08-08T00:00:00.000Z', endExclusive: '2026-08-09T00:00:00.000Z', days: 1,
    },
    source: { status: 'complete', reasons: [], recordLimit: 500, recordsIncluded: 3 },
    monthlyCostThreshold: {
      status: 'not_applicable', reason: 'range_not_month', basis: 'calculated_usage_estimate',
      observedMicros: null, warningMicros: null, criticalMicros: null,
      configurationRevisions: null,
    },
    summary: {
      ...values,
      usageUnavailableCount: 0,
      billingDispositionCounts: { billable: 3, notBillable: 0, unknown: 0 },
      costKindCounts: { calculated: 3, reconciled: 0, unavailable: 0 },
      attributionCounts: { resolved: 3, ambiguous: 0, unresolved: 0 },
    },
    trend: [{ date: '2026-08-08', ...values }],
    breakdowns: {
      engines: [row],
      providers: [{ ...row, key: 'anthropic', label: 'Anthropic' }],
      models: [{ ...row, key: 'anthropic:sonnet', label: 'Anthropic Sonnet tier' }],
      costKinds: [{ ...row, key: 'calculated', label: 'Calculated' }],
      billingDispositions: [{ ...row, key: 'billable', label: 'Billable' }],
    },
    ...overrides,
  }
}
