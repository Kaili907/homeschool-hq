import { describe, expect, it, vi } from 'vitest'
import {
  ADMIN_COST_MAX_RANGE_DAYS,
  ADMIN_COST_RECORD_LIMIT,
  buildAdminCostProjection,
  createAdminCostProjection,
  resolveAdminCostRange,
} from './admin-cost-projection.js'

const NOW = new Date('2026-08-08T18:30:00.000Z')

function event(queryStringParameters) {
  return { queryStringParameters }
}

function calculatedComponents(costMicros) {
  if (costMicros === '0') return []
  return [{
    unit: 'input_token',
    rate: { unit: 'input_token', currency: 'USD', pricingCatalogVersion: 'catalog-v1' },
    calculatedCostMicros: costMicros,
  }]
}

function record(overrides = {}) {
  const base = {
    schemaVersion: 2,
    usageId: 'usage-1',
    occurredAt: '2026-08-08T12:00:00.000Z',
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
    costMicros: '12500',
    currency: 'USD',
    costKind: 'calculated',
    pricingCatalogVersion: 'catalog-v1',
    costComponents: calculatedComponents('12500'),
    reconciliationRef: null,
  }
  const value = { ...base, ...overrides }
  if (overrides.costMicros !== undefined && overrides.costComponents === undefined && value.costKind === 'calculated') {
    value.costComponents = calculatedComponents(value.costMicros)
  }
  if (value.costKind !== 'calculated' && overrides.costComponents === undefined) value.costComponents = []
  if (value.costKind !== 'calculated' && overrides.pricingCatalogVersion === undefined) value.pricingCatalogVersion = null
  if (value.costKind === 'reconciled' && overrides.reconciliationRef === undefined) value.reconciliationRef = 'invoice-line'
  return value
}

function ttsRecord(overrides = {}) {
  return record({
    usageId: 'tts-1',
    engine: 'tts',
    provider: 'elevenlabs',
    providerProductId: 'eleven_turbo_v2_5',
    providerModelId: 'eleven_turbo_v2_5',
    logicalModelTier: null,
    inputTokens: null,
    outputTokens: null,
    cachedInputReadTokens: null,
    cachedInputWriteTokens: null,
    ttsCharacters: 280,
    ...overrides,
  })
}

describe('Admin cost UTC date ranges', () => {
  it.each([
    [{ range: 'today' }, ['2026-08-08', '2026-08-08', 1]],
    [{ range: '7-days' }, ['2026-08-02', '2026-08-08', 7]],
    [{ range: '30-days' }, ['2026-07-10', '2026-08-08', 30]],
    [{ range: 'month' }, ['2026-08-01', '2026-08-08', 8]],
    [{ range: 'custom', start: '2025-08-08', end: '2026-08-08' }, ['2025-08-08', '2026-08-08', ADMIN_COST_MAX_RANGE_DAYS]],
  ])('resolves %o', (query, expected) => {
    const range = resolveAdminCostRange(event(query), NOW)
    expect([range.start, range.end, range.days]).toEqual(expected)
    expect(range.startAt).toMatch(/T00:00:00\.000Z$/)
    expect(range.endExclusive).toMatch(/T00:00:00\.000Z$/)
  })

  it.each([
    {},
    { range: 'school-year' },
    { range: 'today', role: 'owner' },
    { range: 'custom', start: '2026-08-08' },
    { range: 'custom', start: '2026-08-09', end: '2026-08-08' },
    { range: 'custom', start: '2026-02-30', end: '2026-08-08' },
    { range: 'custom', start: '2026-08-08', end: '2026-08-09' },
  ])('rejects malformed range %o', (query) => {
    expect(() => resolveAdminCostRange(event(query), NOW)).toThrow()
  })

  it('rejects an excessive custom range and duplicate query keys', () => {
    expect(() => resolveAdminCostRange(event({
      range: 'custom', start: '2025-08-07', end: '2026-08-08',
    }), NOW)).toThrow()
    expect(() => resolveAdminCostRange({ rawQueryString: 'range=today&range=30-days' }, NOW)).toThrow()
    expect(() => resolveAdminCostRange({
      queryStringParameters: { range: 'today' },
      multiValueQueryStringParameters: { range: ['today', '30-days'] },
    }, NOW)).toThrow()
  })
})

describe('Admin cost aggregate projection', () => {
  const today = resolveAdminCostRange(event({ range: 'today' }), NOW)

  it('aggregates AI, cached token classes, TTS characters, and exact micros', () => {
    const model = buildAdminCostProjection([
      record({ costMicros: '9007199254740993' }),
      record({ usageId: 'usage-2', logicalModelTier: 'haiku', providerProductId: 'claude-haiku-4-5', providerModelId: 'claude-haiku-4-5', costMicros: '9007199254740992' }),
      ttsRecord({ costMicros: '7' }),
    ], today, NOW)

    expect(model.summary.aiRequests).toEqual({ status: 'available', value: 2 })
    expect(model.summary.ttsRequests).toEqual({ status: 'available', value: 1 })
    expect(model.summary.inputTokens.value).toBe(20)
    expect(model.summary.cachedInputReadTokens.value).toBe(6)
    expect(model.summary.cachedInputWriteTokens.value).toBe(4)
    expect(model.summary.ttsCharacters.value).toBe(280)
    expect(model.summary.calculatedCost).toEqual({
      status: 'available', micros: '18014398509481992', currency: 'USD',
    })
    expect(model.summary.reconciledCost).toEqual({ status: 'available', micros: '0', currency: 'USD' })
    expect(model.trend).toHaveLength(1)
    expect(model.breakdowns.models.map((row) => row.label)).toEqual([
      'Anthropic Haiku tier', 'Anthropic Sonnet tier', 'ElevenLabs Turbo speech',
    ])
  })

  it('keeps unknown usage and calculated cost unavailable instead of zero', () => {
    const model = buildAdminCostProjection([
      record({
        inputTokens: null, outputTokens: null, cachedInputReadTokens: null,
        cachedInputWriteTokens: null, costKind: 'unavailable', costMicros: null,
        pricingCatalogVersion: null, costComponents: [], billingDisposition: 'unknown',
      }),
    ], today, NOW)
    expect(model.summary.inputTokens).toEqual({ status: 'unavailable', value: null })
    expect(model.summary.cachedInputReadTokens).toEqual({ status: 'unavailable', value: null })
    expect(model.summary.calculatedCost).toEqual({ status: 'unavailable', micros: null, currency: 'USD' })
    expect(model.summary.unavailableCostCount).toBe(1)
    expect(model.source.reasons).toEqual(['usage_unavailable', 'calculated_cost_unavailable'])
  })

  it('separates reconciled from calculated and billing disposition from cost kind', () => {
    const model = buildAdminCostProjection([
      record({ costKind: 'reconciled', costMicros: '2100000', billingDisposition: 'billable' }),
      record({
        usageId: 'non-billable', billingDisposition: 'not_billable', costMicros: '0',
        pricingCatalogVersion: null, costComponents: [],
      }),
    ], today, NOW)
    expect(model.summary.calculatedCost).toEqual({ status: 'partial', micros: '0', currency: 'USD' })
    expect(model.summary.reconciledCost).toEqual({ status: 'available', micros: '2100000', currency: 'USD' })
    expect(model.summary.billingDispositionCounts).toEqual({ billable: 1, notBillable: 1, unknown: 0 })
    expect(model.summary.costKindCounts).toEqual({ calculated: 1, reconciled: 1, unavailable: 0 })
  })

  it('reports partial attribution without exposing or inventing identities', () => {
    const model = buildAdminCostProjection([
      record({ householdRef: null, householdAttribution: 'ambiguous' }),
      record({ usageId: 'unresolved', householdRef: null, householdAttribution: 'lookup_unavailable' }),
    ], today, NOW)
    expect(model.summary.attributionCounts).toEqual({ resolved: 0, ambiguous: 1, unresolved: 1 })
    expect(model.source.reasons).toContain('ambiguous_attribution')
    expect(model.source.reasons).toContain('unresolved_attribution')
    const wire = JSON.stringify(model)
    expect(wire).not.toContain('private-account')
    expect(wire).not.toContain('accountRef')
    expect(wire).not.toContain('householdRef')
    expect(wire).not.toContain('learnerRef')
    expect(wire).not.toContain('providerModelId')
    expect(wire).not.toContain('costComponents')
  })

  it('returns provable real zero for an empty complete range and no fake day points', () => {
    const model = buildAdminCostProjection([], today, NOW)
    expect(model.source.status).toBe('complete')
    expect(model.summary.totalRequests).toEqual({ status: 'available', value: 0 })
    expect(model.summary.calculatedCost).toEqual({ status: 'available', micros: '0', currency: 'USD' })
    expect(model.trend).toEqual([])
  })

  it('marks totals partial when the existing server seam cannot prove more than its record ceiling', () => {
    const records = Array.from({ length: ADMIN_COST_RECORD_LIMIT }, (_, index) => record({ usageId: `usage-${index}` }))
    const model = buildAdminCostProjection(records, today, NOW)
    expect(model.source.status).toBe('partial')
    expect(model.source.reasons).toContain('source_record_limit')
    expect(model.summary.totalRequests.status).toBe('partial')
    expect(model.summary.calculatedCost.status).toBe('partial')
  })

  it('uses only the bounded ADMIN-3 server read seam', async () => {
    const gatewayAccess = { readProviderUsageCosts: vi.fn(async () => [record()]) }
    const projection = createAdminCostProjection({ gatewayAccess, now: () => NOW })
    const model = await projection.read(event({ range: '7-days' }))
    expect(model.summary.aiRequests.value).toBe(1)
    expect(gatewayAccess.readProviderUsageCosts).toHaveBeenCalledWith({
      limit: ADMIN_COST_RECORD_LIMIT,
      before: '2026-08-09T00:00:00.000Z',
    })
  })

  it('fails closed for malformed ledger rows rather than surfacing raw fields', () => {
    expect(() => buildAdminCostProjection([
      { ...record(), accountRef: 'SECRET', costMicros: 1.25 },
    ], today, NOW)).toThrow()
  })
})
