import { describe, expect, it, vi } from 'vitest'
import {
  createAdminMonthlyCostAlertEvaluator,
  evaluateAdminMonthlyCostAlert,
  resolveAdminMonthlyCostWindow,
} from './admin-monthly-cost-alert.js'

const NOW = new Date('2026-08-10T18:30:45.123Z')
const KEYS = [
  'runtime.ai.enabled',
  'runtime.tts.enabled',
  'quota.ai.requests_per_account_day',
  'quota.tts.requests_per_account_day',
  'cost.warning.monthly_micros',
  'cost.critical.monthly_micros',
  'ai.approved_tiers',
  'ai.default_tier',
]

function setting(key, value) {
  const runtime = key.startsWith('runtime.')
  const quota = key.startsWith('quota.')
  const money = key.startsWith('cost.')
  const approved = key === 'ai.approved_tiers'
  return {
    key,
    value,
    revision: '1',
    requiredCapability: 'configuration:manage',
    protectiveCapability: runtime ? 'engines:operate' : null,
    warningLevel: runtime || approved || key === 'cost.critical.monthly_micros' ? 'critical' : 'warning',
    bounds: quota
      ? { minimum: '1', maximum: key.includes('.ai.') ? '200' : '1000' }
      : money ? { minimum: '1', maximum: '1000000000000' } : null,
    allowlist: key.startsWith('ai.') ? ['sonnet', 'haiku'] : null,
    deploymentCeilingType: runtime ? 'boolean_enablement'
      : quota ? 'integer_maximum'
        : money ? 'integer_micros_maximum'
          : approved ? 'allowlist_subset' : 'allowlist_member',
    registryVersion: 1,
    integrationStatus: 'pending_runtime_integration',
  }
}

function configuration(overrides = {}) {
  const values = {
    'runtime.ai.enabled': true,
    'runtime.tts.enabled': true,
    'quota.ai.requests_per_account_day': 50,
    'quota.tts.requests_per_account_day': 100,
    'cost.warning.monthly_micros': '10000000',
    'cost.critical.monthly_micros': '25000000',
    'ai.approved_tiers': ['sonnet', 'haiku'],
    'ai.default_tier': 'sonnet',
    ...overrides,
  }
  return {
    schemaVersion: 2,
    integrationStatus: 'pending_runtime_integration',
    settings: KEYS.map((key) => setting(key, values[key])),
  }
}

function costProjection(micros, status = 'available') {
  return {
    range: {
      startAt: '2026-08-01T00:00:00.000Z',
      endExclusive: '2026-09-01T00:00:00.000Z',
    },
    summary: {
      calculatedCost: {
        status,
        micros: status === 'unavailable' ? null : micros,
        currency: 'USD',
      },
    },
  }
}

function ledgerRecord(costMicros = '10000000') {
  return {
    schemaVersion: 2,
    usageId: 'usage-1',
    occurredAt: '2026-08-10T12:00:00.000Z',
    accountRef: 'private-account',
    householdRef: 'private-household',
    householdAttribution: 'resolved',
    learnerRef: null,
    engine: 'tutor',
    appVersion: 'build-1',
    engineVersion: 'tutor-1',
    curriculumVersion: null,
    provider: 'anthropic',
    providerProductId: 'claude-sonnet-4-6',
    providerModelId: 'claude-sonnet-4-6',
    logicalModelTier: 'sonnet',
    inputTokens: 10,
    outputTokens: 4,
    cachedInputReadTokens: 3,
    cachedInputWriteTokens: 2,
    ttsCharacters: null,
    requestCount: 1,
    latencyMs: 100,
    result: 'success',
    resultReasonCode: null,
    billingDisposition: 'billable',
    costMicros,
    currency: 'USD',
    costKind: 'calculated',
    pricingCatalogVersion: 'catalog-v1',
    costComponents: [{
      unit: 'input_token',
      rate: { unit: 'input_token', currency: 'USD', pricingCatalogVersion: 'catalog-v1' },
      calculatedCostMicros: costMicros,
    }],
    reconciliationRef: null,
  }
}

function evaluate(micros, status = 'available', saved = configuration()) {
  return evaluateAdminMonthlyCostAlert({
    costProjection: costProjection(micros, status),
    configuration: saved,
    generatedAt: NOW,
  })
}

describe('authoritative monthly cost alert evaluation', () => {
  it.each([
    ['9999999', 'normal', '1', '15000001'],
    ['10000000', 'warning', null, '15000000'],
    ['20000000', 'warning', null, '5000000'],
    ['25000000', 'critical', null, null],
    ['25000001', 'critical', null, null],
  ])('classifies exact threshold boundary %s as %s', (
    micros, expectedStatus, remainingWarning, remainingCritical,
  ) => {
    const result = evaluate(micros)
    expect(result).toMatchObject({
      monthlyCostMicros: micros,
      warningThresholdMicros: '10000000',
      criticalThresholdMicros: '25000000',
      remainingToWarningMicros: remainingWarning,
      remainingToCriticalMicros: remainingCritical,
      status: expectedStatus,
      activeCritical: expectedStatus === 'critical',
    })
  })

  it('uses exact UTC calendar-month boundaries from trusted server time', () => {
    expect(resolveAdminMonthlyCostWindow(new Date('2026-12-31T23:59:59.999Z'))).toEqual({
      timezone: 'UTC',
      startAt: '2026-12-01T00:00:00.000Z',
      endExclusive: '2027-01-01T00:00:00.000Z',
    })
    expect(evaluate('999999999999', 'available', configuration({
      'cost.warning.monthly_micros': '999999999999',
      'cost.critical.monthly_micros': '1000000000000',
    }))).toMatchObject({
      status: 'warning',
      remainingToCriticalMicros: '1',
    })
  })

  it('fails closed for missing or cross-setting-invalid configuration', () => {
    expect(evaluate('9000000', 'available', null)).toMatchObject({
      status: 'unavailable',
      reason: 'configuration_unavailable',
      monthlyCostMicros: '9000000',
      warningThresholdMicros: null,
      criticalThresholdMicros: null,
    })
    expect(evaluate('9000000', 'available', configuration({
      'cost.warning.monthly_micros': '25000000',
      'cost.critical.monthly_micros': '10000000',
    }))).toMatchObject({ status: 'unavailable', reason: 'configuration_unavailable' })
  })

  it('treats an incomplete recorded amount as a lower bound', () => {
    expect(evaluate('9999999', 'partial')).toMatchObject({
      completeness: 'partial', status: 'partial', reason: 'partial_lower_bound',
      remainingToWarningMicros: null, remainingToCriticalMicros: null,
    })
    expect(evaluate('10000000', 'partial')).toMatchObject({
      completeness: 'partial', status: 'partial', reason: 'partial_lower_bound',
    })
    expect(evaluate('24999999', 'partial')).toMatchObject({ status: 'partial' })
    expect(evaluate('25000000', 'partial')).toMatchObject({
      completeness: 'partial', status: 'critical', reason: 'partial_lower_bound_critical',
      activeCritical: true,
    })
  })

  it('reports an unavailable authoritative aggregate without inventing zero', () => {
    expect(evaluate(null, 'unavailable')).toMatchObject({
      completeness: 'unavailable',
      status: 'unavailable',
      reason: 'aggregate_unavailable',
      monthlyCostMicros: null,
      warningThresholdMicros: '10000000',
      criticalThresholdMicros: '25000000',
    })
  })

  it('states the exact authority and never creates provider-control semantics', () => {
    const result = evaluate('25000000')
    expect(result).toMatchObject({
      costAuthority: 'academy_provider_usage_ledger',
      scope: 'recorded_usage_derived_calculated_provider_cost',
      providerInvoiceTotalClaim: false,
      automaticProviderShutdown: false,
    })
    expect(result).not.toHaveProperty('aiEnabled')
    expect(result).not.toHaveProperty('ttsEnabled')
    expect(JSON.stringify(result)).not.toContain('provider_attempt')
  })

  it('evaluates only the authoritative usage/cost ledger and never reads journal counts', async () => {
    const gatewayAccess = {
      readProviderUsageCosts: vi.fn(async () => [ledgerRecord()]),
      readProviderAttemptCoverage: vi.fn(async () => ({ reservedAttempts: 999999 })),
    }
    const evaluator = createAdminMonthlyCostAlertEvaluator({
      gatewayAccess,
      configurationSource: { read: vi.fn(async () => configuration()) },
      now: () => NOW,
    })
    expect(await evaluator.read()).toMatchObject({
      monthlyCostMicros: '10000000',
      status: 'warning',
      costAuthority: 'academy_provider_usage_ledger',
    })
    expect(gatewayAccess.readProviderAttemptCoverage).not.toHaveBeenCalled()
  })

  it('bounds source failure as unavailable and reads the ledger only through the cost seam', async () => {
    const gatewayAccess = {
      readProviderUsageCosts: vi.fn(async () => { throw new Error('PRIVATE LEDGER ERROR') }),
    }
    const evaluator = createAdminMonthlyCostAlertEvaluator({
      gatewayAccess,
      configurationSource: { read: vi.fn(async () => configuration()) },
      now: () => NOW,
    })
    const result = await evaluator.read()
    expect(result).toMatchObject({ status: 'unavailable', reason: 'aggregate_unavailable' })
    expect(JSON.stringify(result)).not.toContain('PRIVATE')
    expect(gatewayAccess.readProviderUsageCosts).toHaveBeenCalledWith({
      limit: 500,
      before: NOW.toISOString(),
    })
  })
})
