import type {
  AdminCostAggregate,
  AdminCostsModel,
  AdminMonthlyCostAlert,
  AdminProviderAccountingCoverage,
} from './costsModel'

export function monthlyCostAlertFixture(
  overrides: Partial<AdminMonthlyCostAlert> = {},
): AdminMonthlyCostAlert {
  return {
    contractVersion: 1,
    generatedAt: '2026-08-08T18:30:00.000Z',
    currency: 'USD',
    window: {
      timezone: 'UTC',
      startAt: '2026-08-01T00:00:00.000Z',
      endExclusive: '2026-09-01T00:00:00.000Z',
    },
    costAuthority: 'academy_provider_usage_ledger',
    scope: 'recorded_usage_derived_calculated_provider_cost',
    providerInvoiceTotalClaim: false,
    automaticProviderShutdown: false,
    completeness: 'complete',
    status: 'normal',
    reason: 'complete',
    activeCritical: false,
    monthlyCostMicros: '9000000',
    warningThresholdMicros: '10000000',
    criticalThresholdMicros: '25000000',
    remainingToWarningMicros: '1000000',
    remainingToCriticalMicros: '16000000',
    ...overrides,
  }
}

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

export function providerAccountingCoverageFixture(
  overrides: Partial<AdminProviderAccountingCoverage> = {},
): AdminProviderAccountingCoverage {
  const metrics = {
    reservedAttempts: 3,
    dispatchPossibleAttempts: 0,
    observedOutcomes: 0,
    ledgerLinkedAttempts: 2,
    accountingGaps: 0,
    gapPending: 0,
    reconciliationConflicts: 0,
    confirmedNotDispatched: 1,
    unresolvable: 0,
  }
  const row = { key: 'tutor', status: 'complete_for_journaled_attempts' as const, ...metrics }
  return {
    status: 'partial',
    journalStatus: 'complete_for_journaled_attempts',
    reconciliationState: 'clear_for_journaled_attempts',
    providerInstrumentation: {
      status: 'partial',
      engines: [
        { key: 'tutor', status: 'covered' },
        { key: 'jarvis', status: 'covered' },
        { key: 'tts', status: 'covered' },
        { key: 'study', status: 'pending' },
      ],
    },
    invoiceCompletenessClaim: false,
    metrics,
    breakdowns: {
      engines: [row],
      purposes: [{ ...row, key: 'tutor_turn' }],
      providers: [{ ...row, key: 'anthropic' }],
    },
    ...overrides,
  }
}

export function costsModelFixture(overrides: Partial<AdminCostsModel> = {}): AdminCostsModel {
  const values = costAggregateFixture()
  const row = { key: 'tutor', label: 'Tutor', ...values }
  return {
    contractVersion: 4,
    generatedAt: '2026-08-08T18:30:00.000Z',
    currency: 'USD',
    range: {
      kind: 'today', start: '2026-08-08', end: '2026-08-08',
      startAt: '2026-08-08T00:00:00.000Z', endExclusive: '2026-08-09T00:00:00.000Z', days: 1,
    },
    source: { status: 'complete', reasons: [], recordLimit: 500, recordsIncluded: 3 },
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
    providerAccountingCoverage: providerAccountingCoverageFixture(),
    monthlyCostAlert: monthlyCostAlertFixture(),
    ...overrides,
  }
}
