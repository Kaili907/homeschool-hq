import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AdminCostRangeSelection, AdminCostsReadState } from '../../admin/costsModel'
import { costAggregateFixture, costsModelFixture } from '../../admin/costsTestFixtures'
import { AdminCostsDashboard } from './AdminCostsDashboard'

const RANGE = { kind: 'preset', preset: 'today' } as const

function render(
  state: AdminCostsReadState = { status: 'ready', model: costsModelFixture(), freshness: 'current' },
  authorized = true,
  range: AdminCostRangeSelection = RANGE,
) {
  return renderToStaticMarkup(
    <AdminCostsDashboard
      authorized={authorized}
      state={state}
      range={range}
      onRangeChange={() => {}}
      onRetry={() => {}}
      today="2026-08-08"
    />,
  )
}

describe('Admin AI and Costs dashboard', () => {
  it('renders loading and unauthorized states without data', () => {
    expect(render({ status: 'loading' })).toContain('Loading AI and cost data')
    const denied = render({ status: 'unauthorized' }, false)
    expect(denied).toContain('Costs access unavailable')
    expect(denied).not.toContain('9007199254740993')
  })

  it('renders exact calculated and reconciled semantics with separate cache token classes', () => {
    const markup = render()
    expect(markup).toContain('Usage-derived marginal provider cost')
    expect(markup).toContain('Reconciled cost')
    expect(markup).toContain('$9,007,199,254.74')
    expect(markup).toContain('Cached input read tokens')
    expect(markup).toContain('Cached input write tokens')
    expect(markup).toContain('TTS characters')
    expect(markup).toContain('Usage-derived marginal provider cost')
    expect(markup).toContain('Reconciled provider-invoice economics remain separate and are not inferred')
    expect(markup).toContain('Complete for stored ledger rows')
    expect(markup).toContain('Provider traffic')
    expect(markup).toContain('Unverified')
    expect(markup).not.toContain('500-record')
    expect(markup).not.toContain('All provider traffic accounted for')
  })

  it('renders the enforced monthly threshold as calculated evidence, not invoice economics', () => {
    const model = costsModelFixture({
      range: {
        kind: 'month', start: '2026-08-01', end: '2026-08-08',
        startAt: '2026-08-01T00:00:00.000Z', endExclusive: '2026-08-09T00:00:00.000Z', days: 8,
      },
      monthlyCostThreshold: {
        status: 'warning', reason: null, basis: 'calculated_usage_estimate',
        observedMicros: '11000000', warningMicros: '10000000',
        criticalMicros: '25000000', configurationRevisions: { warning: '2', critical: '3' },
      },
    })
    const markup = render({ status: 'ready', model, freshness: 'current' }, true, {
      kind: 'preset', preset: 'month',
    })
    expect(markup).toContain('Monthly cost warning threshold reached')
    expect(markup).toContain('$11.00 calculated usage cost')
    expect(markup).toContain('not provider-invoice economics')
  })

  it('renders unavailable cost explicitly and never as $0', () => {
    const source = costsModelFixture()
    const model = costsModelFixture({
      source: {
        ...source.source, status: 'partial',
        reasons: ['calculated_cost_unavailable'], recordsIncluded: 1,
      },
      summary: {
        ...source.summary,
        calculatedCost: { status: 'unavailable', micros: null, currency: 'USD' },
        unavailableCostCount: 1,
      },
    })
    const markup = render({ status: 'ready', model, freshness: 'current' })
    expect(markup).toContain('Unavailable, not $0')
    expect(markup).toContain('no trustworthy calculated cost')
    expect(markup).not.toMatch(/Calculated \/ estimated provider cost[\s\S]{0,180}?\$0\.00/)
  })

  it('renders partial attribution, billing, and cost kinds as independent counts', () => {
    const source = costsModelFixture()
    const model = costsModelFixture({
      source: {
        ...source.source, status: 'partial',
        reasons: ['ambiguous_attribution', 'unresolved_attribution'], recordsIncluded: 3,
      },
      summary: {
        ...source.summary,
        attributionCounts: { resolved: 1, ambiguous: 1, unresolved: 1 },
        billingDispositionCounts: { billable: 1, notBillable: 1, unknown: 1 },
        costKindCounts: { calculated: 1, reconciled: 1, unavailable: 1 },
      },
    })
    const markup = render({ status: 'ready', model, freshness: 'current' })
    expect(markup).toContain('Evidence limitations')
    expect(markup).toContain('ambiguous household attribution')
    expect(markup).toContain('Billing disposition')
    expect(markup).toContain('Cost kind')
    expect(markup).toContain('No learner-cost breakdown')
    expect(markup).not.toContain('accountRef')
    expect(markup).not.toContain('householdRef')
  })

  it('renders accounting-gap evidence separately from query and provider-traffic coverage', () => {
    const source = costsModelFixture()
    const model = costsModelFixture({
      source: {
        ...source.source,
        status: 'partial',
        reasons: ['accounting_gap_evidence'],
        accountingGapEvidence: { observedCount: 2, retentionCoverage: 'retention_limited' },
      },
    })
    const markup = render({ status: 'ready', model, freshness: 'current' })
    expect(markup).toContain('Aggregate query')
    expect(markup).toContain('Complete for stored ledger rows')
    expect(markup).toContain('Provider traffic')
    expect(markup).toContain('Unverified')
    expect(markup).toMatch(/Observed accounting gaps<\/dt><dd>2/)
    expect(markup).toContain('extends beyond the conservative telemetry-retention window')
    expect(markup).not.toContain('All provider traffic accounted for')
  })

  it('distinguishes a proven empty range from unavailable and creates no fake trend points', () => {
    const zero = costAggregateFixture({
      totalRequests: { status: 'available', value: 0 }, aiRequests: { status: 'available', value: 0 },
      ttsRequests: { status: 'available', value: 0 }, inputTokens: { status: 'available', value: 0 },
      outputTokens: { status: 'available', value: 0 }, cachedInputReadTokens: { status: 'available', value: 0 },
      cachedInputWriteTokens: { status: 'available', value: 0 }, ttsCharacters: { status: 'available', value: 0 },
      calculatedCost: { status: 'available', micros: '0', currency: 'USD' },
      reconciledCost: { status: 'available', micros: '0', currency: 'USD' }, unavailableCostCount: 0,
    })
    const source = costsModelFixture()
    const model = costsModelFixture({
      source: { ...source.source, status: 'complete', reasons: [], recordsIncluded: 0 },
      summary: { ...source.summary, ...zero, usageUnavailableCount: 0 },
      trend: [], breakdowns: { engines: [], providers: [], models: [], costKinds: [], billingDispositions: [] },
    })
    const markup = render({ status: 'ready', model, freshness: 'current' })
    expect(markup).toContain('zero recorded AI and TTS ledger attempts')
    expect(markup).toContain('does not prove zero provider traffic')
    expect(markup).toContain('$0.00')
    expect(markup).toContain('No real daily usage points')
  })

  it('uses native accessible controls, tables, status text, stale copy, and vetted errors', () => {
    const ready = render(
      { status: 'ready', model: costsModelFixture(), freshness: 'stale' },
      true,
      { kind: 'custom', start: '2026-08-01', end: '2026-08-08' },
    )
    expect(ready).toContain('aria-label="AI and cost date range"')
    expect(ready).toContain('type="date"')
    expect(ready).toContain('<table>')
    expect(ready).toContain('Showing stale data')
    expect(ready).toContain('Refresh data')

    const error = render({ status: 'error', code: 'costs_timeout' })
    expect(error).toContain('costs request timed out')
    expect(error).not.toContain('exception.message')
  })
})
