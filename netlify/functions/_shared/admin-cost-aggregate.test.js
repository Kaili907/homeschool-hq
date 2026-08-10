import { describe, expect, it, vi } from 'vitest'
import {
  buildAdminCostAggregateProjection,
} from './admin-cost-aggregate.js'
import {
  createAdminCostProjection,
  resolveAdminCostRange,
} from './admin-cost-projection.js'

const NOW = new Date('2026-08-08T18:30:00.000Z')
const RANGE = resolveAdminCostRange(
  { queryStringParameters: { range: 'today' } },
  NOW,
)

function usage(total = '10', known = '1', unavailable = '0') {
  return { total, known, unavailable }
}

function group(overrides = {}) {
  const value = {
    dimension: 'summary',
    key: 'all',
    records: '1',
    requests: { total: '1', ai: '1', tts: '0' },
    usage: {
      inputTokens: usage('10'),
      outputTokens: usage('4'),
      cachedInputReadTokens: usage('3'),
      cachedInputWriteTokens: usage('2'),
      ttsCharacters: usage('0', '0'),
    },
    cost: {
      calculated: { micros: '9007199254740993', known: '1', unavailable: '0' },
      reconciledMicros: '0',
      unavailableCount: '0',
    },
    counts: {
      usageUnavailable: '0',
      billingDisposition: { billable: '1', notBillable: '0', unknown: '0' },
      costKind: { calculated: '1', reconciled: '0', unavailable: '0' },
      attribution: { resolved: '1', ambiguous: '0', unresolved: '0' },
    },
    ...overrides,
  }
  return value
}

function aggregateSource(overrides = {}) {
  const groups = overrides.groups ?? [
    group(),
    group({ dimension: 'day', key: '2026-08-08' }),
    group({ dimension: 'engine', key: 'tutor' }),
    group({ dimension: 'provider', key: 'anthropic' }),
    group({ dimension: 'logical_tier', key: 'sonnet' }),
    group({ dimension: 'cost_kind', key: 'calculated' }),
    group({ dimension: 'billing_disposition', key: 'billable' }),
  ]
  return {
    schemaVersion: 1,
    range: {
      startAt: RANGE.startAt,
      endExclusive: RANGE.endExclusive,
      maximumDays: 366,
    },
    completeness: {
      queryCoverage: 'complete',
      providerTrafficCoverage: 'coverage_unverified',
      groupCount: groups.length,
      groupLimit: 384,
    },
    accountingGapEvidence: {
      observedCount: '0',
      retentionCoverage: 'within_retention',
    },
    recordsIncluded: groups.find((item) => item.dimension === 'summary')?.records ?? '0',
    groups,
    ...overrides,
  }
}

describe('Admin cost database aggregate projection', () => {
  it('preserves exact IntegerMicros and every fixed breakdown without raw-row arithmetic', () => {
    const model = buildAdminCostAggregateProjection(aggregateSource(), RANGE, NOW)
    expect(model).toMatchObject({
      contractVersion: 3,
      source: {
        queryCoverage: 'complete',
        providerTrafficCoverage: 'coverage_unverified',
        groupCount: 7,
        groupLimit: 384,
        recordsIncluded: 1,
      },
      summary: {
        calculatedCost: {
          status: 'available', micros: '9007199254740993', currency: 'USD',
        },
      },
    })
    expect(typeof model.summary.calculatedCost.micros).toBe('string')
    expect(model.trend).toHaveLength(1)
    expect(model.breakdowns).toMatchObject({
      engines: [expect.objectContaining({ key: 'tutor', label: 'Tutor' })],
      providers: [expect.objectContaining({ key: 'anthropic', label: 'Anthropic' })],
      models: [expect.objectContaining({ key: 'anthropic:sonnet', label: 'Anthropic Sonnet tier' })],
      costKinds: [expect.objectContaining({ key: 'calculated', label: 'Calculated' })],
      billingDispositions: [expect.objectContaining({ key: 'billable', label: 'Billable' })],
    })
  })

  it('keeps unavailable usage and cost distinct from partial known totals and legitimate zero', () => {
    const summary = group({
      records: '3',
      requests: { total: '3', ai: '3', tts: '0' },
      usage: {
        inputTokens: usage('10', '1', '2'),
        outputTokens: usage('0', '0', '2'),
        cachedInputReadTokens: usage('0', '3', '0'),
        cachedInputWriteTokens: usage('0', '3', '0'),
        ttsCharacters: usage('0', '0', '0'),
      },
      cost: {
        calculated: { micros: '5', known: '1', unavailable: '2' },
        reconciledMicros: '7',
        unavailableCount: '1',
      },
      counts: {
        usageUnavailable: '2',
        billingDisposition: { billable: '2', notBillable: '0', unknown: '1' },
        costKind: { calculated: '1', reconciled: '1', unavailable: '1' },
        attribution: { resolved: '1', ambiguous: '1', unresolved: '1' },
      },
    })
    const model = buildAdminCostAggregateProjection(
      aggregateSource({ groups: [summary] }),
      RANGE,
      NOW,
    )
    expect(model.summary.inputTokens).toEqual({ status: 'partial', value: 10 })
    expect(model.summary.outputTokens).toEqual({ status: 'unavailable', value: null })
    expect(model.summary.cachedInputReadTokens).toEqual({ status: 'available', value: 0 })
    expect(model.summary.calculatedCost).toEqual({ status: 'partial', micros: '5', currency: 'USD' })
    expect(model.summary.reconciledCost).toEqual({ status: 'available', micros: '7', currency: 'USD' })
    expect(model.source.reasons).toEqual([
      'ambiguous_attribution', 'unresolved_attribution',
      'usage_unavailable', 'calculated_cost_unavailable',
    ])
  })

  it('accepts and truthfully labels the bounded Study engine group', () => {
    const model = buildAdminCostAggregateProjection(aggregateSource({
      groups: [
        group(),
        group({ dimension: 'engine', key: 'study' }),
      ],
    }), RANGE, NOW)
    expect(model.breakdowns.engines).toEqual([
      expect.objectContaining({ key: 'study', label: 'Study' }),
    ])
  })

  it('surfaces accounting-gap evidence separately without fabricating usage or cost', () => {
    const empty = group({
      records: '0',
      requests: { total: '0', ai: '0', tts: '0' },
      usage: {
        inputTokens: usage('0', '0', '0'), outputTokens: usage('0', '0', '0'),
        cachedInputReadTokens: usage('0', '0', '0'),
        cachedInputWriteTokens: usage('0', '0', '0'), ttsCharacters: usage('0', '0', '0'),
      },
      cost: {
        calculated: { micros: '0', known: '0', unavailable: '0' },
        reconciledMicros: '0', unavailableCount: '0',
      },
      counts: {
        usageUnavailable: '0',
        billingDisposition: { billable: '0', notBillable: '0', unknown: '0' },
        costKind: { calculated: '0', reconciled: '0', unavailable: '0' },
        attribution: { resolved: '0', ambiguous: '0', unresolved: '0' },
      },
    })
    const source = aggregateSource({
      groups: [empty],
      accountingGapEvidence: { observedCount: '1', retentionCoverage: 'within_retention' },
    })
    const model = buildAdminCostAggregateProjection(source, RANGE, NOW)
    expect(model.source.reasons).toEqual(['accounting_gap_evidence'])
    expect(model.source.accountingGapEvidence.observedCount).toBe(1)
    expect(model.summary.totalRequests.value).toBe(0)
    expect(model.summary.calculatedCost.micros).toBe('0')
    expect(model.summary.unavailableCostCount).toBe(0)
  })

  it('fails closed for malformed, unbounded, raw, or non-exact aggregate responses', () => {
    const source = aggregateSource()
    expect(() => buildAdminCostAggregateProjection({ ...source, rawRows: [] }, RANGE, NOW)).toThrow()
    expect(() => buildAdminCostAggregateProjection({
      ...source,
      completeness: { ...source.completeness, groupCount: 385 },
    }, RANGE, NOW)).toThrow()
    expect(() => buildAdminCostAggregateProjection({
      ...source,
      groups: [group({ dimension: 'provider', key: 'raw-provider-secret' })],
      completeness: { ...source.completeness, groupCount: 1 },
      recordsIncluded: '1',
    }, RANGE, NOW)).toThrow()
    expect(() => buildAdminCostAggregateProjection({
      ...source,
      groups: [group({
        cost: {
          ...group().cost,
          calculated: { micros: 1.25, known: '1', unavailable: '0' },
        },
      })],
      completeness: { ...source.completeness, groupCount: 1 },
    }, RANGE, NOW)).toThrow()
  })

  it('uses only the bounded aggregate RPC seam for the resolved half-open range', async () => {
    const aggregateProviderUsageCosts = vi.fn(async () => aggregateSource())
    const gatewayAccess = {
      aggregateProviderUsageCosts,
      readProviderUsageCosts: vi.fn(() => { throw new Error('raw reader must not run') }),
    }
    const projection = createAdminCostProjection({ gatewayAccess, now: () => NOW })
    const model = await projection.read({ queryStringParameters: { range: 'today' } })
    expect(model.summary.aiRequests.value).toBe(1)
    expect(aggregateProviderUsageCosts).toHaveBeenCalledWith({
      start: '2026-08-08T00:00:00.000Z',
      endExclusive: '2026-08-09T00:00:00.000Z',
    })
    expect(gatewayAccess.readProviderUsageCosts).not.toHaveBeenCalled()
  })
})
