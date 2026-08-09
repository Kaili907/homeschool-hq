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
    expect(markup).toContain('Calculated / estimated provider cost')
    expect(markup).toContain('Reconciled cost')
    expect(markup).toContain('$9,007,199,254.74')
    expect(markup).toContain('Cached input read tokens')
    expect(markup).toContain('Cached input write tokens')
    expect(markup).toContain('TTS characters')
    expect(markup).toContain('Usage-derived marginal provider cost')
    expect(markup).toContain('not a complete provider invoice')
    expect(markup).toContain('Provider traffic')
    expect(markup).toContain('Unverified')
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
