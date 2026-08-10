import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AdminCostRangeSelection, AdminCostsReadState } from '../../admin/costsModel'
import {
  costAggregateFixture,
  costsModelFixture,
  providerAccountingCoverageFixture,
} from '../../admin/costsTestFixtures'
import { AdminCostsDashboard } from './AdminCostsDashboard'

const RANGE = { kind: 'preset', preset: 'today' } as const
const COST_STYLES = readFileSync(new URL('./admin-costs.css', import.meta.url), 'utf8')

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
    expect(markup).toContain('Calculated provider cost (estimate)')
    expect(markup).toContain('Reconciled provider cost')
    expect(markup).toContain('$9,007,199,254.74')
    expect(markup).toContain('Cached input read tokens')
    expect(markup).toContain('Cached input write tokens')
    expect(markup).toContain('TTS characters')
    expect(markup).toContain('not provider-invoice truth')
  })

  it('renders unavailable cost explicitly and never as $0', () => {
    const source = costsModelFixture()
    const model = costsModelFixture({
      source: { status: 'partial', reasons: ['calculated_cost_unavailable'], recordLimit: 500, recordsIncluded: 1 },
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
        status: 'partial', reasons: ['ambiguous_attribution', 'unresolved_attribution'],
        recordLimit: 500, recordsIncluded: 3,
      },
      summary: {
        ...source.summary,
        attributionCounts: { resolved: 1, ambiguous: 1, unresolved: 1 },
        billingDispositionCounts: { billable: 1, notBillable: 1, unknown: 1 },
        costKindCounts: { calculated: 1, reconciled: 1, unavailable: 1 },
      },
    })
    const markup = render({ status: 'ready', model, freshness: 'current' })
    expect(markup).toContain('Partial totals')
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
      source: { status: 'complete', reasons: [], recordLimit: 500, recordsIncluded: 0 },
      summary: { ...source.summary, ...zero, usageUnavailableCount: 0 },
      trend: [], breakdowns: { engines: [], providers: [], models: [], costKinds: [], billingDispositions: [] },
    })
    const markup = render({ status: 'ready', model, freshness: 'current' })
    expect(markup).toContain('proves zero stored AI and TTS requests')
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

  it('renders journal-bounded accounting coverage, safe dimensions, and the instrumentation boundary', () => {
    const markup = render()
    expect(markup).toContain('Provider accounting coverage')
    expect(markup).toContain('Partial')
    expect(markup).toContain('Complete for journaled attempts')
    expect(markup).toContain('Reserved attempts')
    expect(markup).toContain('Dispatch-possible')
    expect(markup).toContain('Observed outcomes')
    expect(markup).toContain('Ledger-linked attempts')
    expect(markup).toContain('Accounting gaps')
    expect(markup).toContain('Gap pending')
    expect(markup).toContain('Reconciliation conflicts')
    expect(markup).toContain('Confirmed not dispatched')
    expect(markup).toContain('Unresolvable')
    expect(markup).toContain('Coverage by engine')
    expect(markup).toContain('Coverage by purpose')
    expect(markup).toContain('Coverage by provider')
    expect(markup).toContain('Tutor provider instrumentation: covered')
    expect(markup).toContain('Jarvis provider instrumentation: covered')
    expect(markup).toContain('Text to speech provider instrumentation: covered')
    expect(markup).toContain('Study safety provider instrumentation: pending')
    expect(markup).toContain('keeps overall provider coverage partial')
    expect(markup).toContain('not a provider bill comparison')
    expect(markup.toLowerCase()).not.toContain('invoice complete')
    expect(markup).toContain('role="note"')
    expect(markup).toContain('tabindex="0"')
  })

  it('renders gaps, conflicts, and unresolvable evidence without exposing identifiers', () => {
    const source = costsModelFixture()
    const model = costsModelFixture({
      providerAccountingCoverage: providerAccountingCoverageFixture({
        status: 'reconciliation_conflict',
        journalStatus: 'reconciliation_conflict',
        reconciliationState: 'conflict',
        metrics: {
          reservedAttempts: 4,
          dispatchPossibleAttempts: 0,
          observedOutcomes: 0,
          ledgerLinkedAttempts: 1,
          accountingGaps: 2,
          gapPending: 1,
          reconciliationConflicts: 1,
          confirmedNotDispatched: 0,
          unresolvable: 1,
        },
        breakdowns: source.providerAccountingCoverage.breakdowns,
      }),
    })
    const markup = render({ status: 'ready', model, freshness: 'current' })
    expect(markup).toContain('Reconciliation conflict')
    expect(markup).toContain('Conflicting durable facts')
    expect(markup).toContain('Closed without recoverable resolution')
    expect(markup).not.toContain('attempt_id')
    expect(markup).not.toContain('usage_id')
    expect(markup).not.toContain('ledger_execution_key')
  })

  it('keeps cost evidence visible while provider accounting coverage is retryably unavailable', () => {
    const coverage = providerAccountingCoverageFixture({
      status: 'unavailable',
      journalStatus: 'unavailable',
      reconciliationState: 'unavailable',
      metrics: null,
      breakdowns: { engines: [], purposes: [], providers: [] },
    })
    const markup = render({
      status: 'ready',
      model: costsModelFixture({ providerAccountingCoverage: coverage }),
      freshness: 'current',
    })
    expect(markup).toContain('Calculated provider cost (estimate)')
    expect(markup).toContain('Coverage unavailable')
    expect(markup).toContain('Retry coverage')
    expect(markup).toContain('role="status"')
  })

  it('keeps coverage status and metrics responsive at tablet and narrow-phone widths', () => {
    expect(COST_STYLES).toContain('@media (max-width: 800px)')
    expect(COST_STYLES).toContain('.admin-provider-coverage__status { grid-template-columns: 1fr; }')
    expect(COST_STYLES).toContain('@media (max-width: 520px)')
    expect(COST_STYLES).toContain('.admin-provider-coverage__metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }')
  })
})
