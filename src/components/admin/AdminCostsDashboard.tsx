import { useEffect, useId, useState, type FormEvent } from 'react'
import { formatUsdMicros } from '../../admin/overviewAdapter'
import {
  ADMIN_COST_COMPLETENESS_MESSAGES,
  ADMIN_COST_ERROR_MESSAGES,
  ADMIN_COST_PRESETS,
  validateAdminCostCustomRange,
  type AdminCostBreakdownRow,
  type AdminCostCountMetric,
  type AdminCostMoneyMetric,
  type AdminCostRangeSelection,
  type AdminCostsModel,
  type AdminCostsReadState,
  type AdminProviderAccountingCoverage,
  type AdminProviderAccountingCoverageBreakdownRow,
  type AdminProviderAccountingCoverageStatus,
} from '../../admin/costsModel'
import './admin-costs.css'

const PRESET_LABELS = {
  today: 'Today',
  '7-days': '7 days',
  '30-days': '30 days',
  month: 'Current month',
} as const

const PROVIDER_COVERAGE_STATUS_LABELS: Readonly<Record<AdminProviderAccountingCoverageStatus, string>> = {
  complete_for_journaled_attempts: 'Complete for currently journaled/instrumented provider-attempt paths',
  partial: 'Partial',
  gaps_detected: 'Gaps detected',
  reconciliation_conflict: 'Reconciliation conflict',
  unavailable: 'Unavailable',
  insufficient_evidence: 'Insufficient evidence',
}

const PROVIDER_COVERAGE_STATUS_COPY: Readonly<Record<AdminProviderAccountingCoverageStatus, string>> = {
  complete_for_journaled_attempts: 'Every journaled attempt in this range has a supported terminal accounting resolution, and every currently implemented external provider-attempt path is instrumented.',
  partial: 'Provider accounting coverage is partial. Instrumented paths and journal lifecycle evidence are shown below.',
  gaps_detected: 'The journal knows about missing accounting relationships or attempts that could not be resolved.',
  reconciliation_conflict: 'At least one journaled attempt conflicts with the authoritative usage ledger.',
  unavailable: 'The journal coverage projection could not be read safely.',
  insufficient_evidence: 'No journaled attempts or unmatched ledger rows were observed in this range. Absence is not proof of provider-path coverage.',
}

const PROVIDER_COVERAGE_DIMENSION_LABELS: Readonly<Record<string, string>> = {
  tutor: 'Tutor',
  study: 'Study safety',
  jarvis: 'Jarvis',
  tts: 'Text to speech',
  tutor_turn: 'Tutor turn',
  jarvis_turn: 'Jarvis turn',
  tts_synthesis: 'Speech synthesis',
  safety_classification: 'Safety classification',
  anthropic: 'Anthropic',
  elevenlabs: 'ElevenLabs',
}

export interface AdminCostsDashboardProps {
  readonly authorized: boolean
  readonly state: AdminCostsReadState
  readonly range: AdminCostRangeSelection
  readonly onRangeChange: (range: AdminCostRangeSelection) => void
  readonly onRetry?: () => void
  readonly today?: string
}

export function AdminCostsDashboard({
  authorized,
  state,
  range,
  onRangeChange,
  onRetry,
  today = new Date().toISOString().slice(0, 10),
}: AdminCostsDashboardProps) {
  if (!authorized || state.status === 'unauthorized') {
    return (
      <section className="admin-costs-message" role="alert">
        <p className="admin-costs-eyebrow">AI &amp; Costs</p>
        <h1>Costs access unavailable</h1>
        <p>Cost data remains private because current administrator authorization could not be confirmed.</p>
      </section>
    )
  }

  return (
    <div className="admin-costs">
      <header className="admin-costs-header">
        <div>
          <p className="admin-costs-eyebrow">Provider usage ledger</p>
          <h1>AI &amp; Costs</h1>
          <p>Read-only usage and provider-cost evidence. All calendar boundaries are UTC.</p>
        </div>
        <div className="admin-costs-header__controls">
          <CostRangeControl range={range} onChange={onRangeChange} today={today} />
          {state.status === 'ready' && onRetry && <button className="admin-costs-refresh" type="button" onClick={onRetry}>Refresh data</button>}
        </div>
      </header>

      {(state.status === 'idle' || state.status === 'loading') && <CostsLoading />}
      {state.status === 'error' && (
        <section className="admin-costs-message" role="alert">
          <p className="admin-costs-eyebrow">Data unavailable</p>
          <h2>We couldn’t load AI and cost data</h2>
          <p>{ADMIN_COST_ERROR_MESSAGES[state.code]}</p>
          {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
        </section>
      )}
      {state.status === 'ready' && (
        <CostsContent
          model={state.model}
          stale={state.freshness === 'stale'}
          onRetry={onRetry}
        />
      )}
    </div>
  )
}

function CostRangeControl({
  range,
  onChange,
  today,
}: {
  range: AdminCostRangeSelection
  onChange: (range: AdminCostRangeSelection) => void
  today: string
}) {
  const customId = useId()
  const [customOpen, setCustomOpen] = useState(range.kind === 'custom')
  const [start, setStart] = useState(range.kind === 'custom' ? range.start : '')
  const [end, setEnd] = useState(range.kind === 'custom' ? range.end : today)
  const [submitted, setSubmitted] = useState(false)
  const error = validateAdminCostCustomRange(start, end, today)

  useEffect(() => {
    if (range.kind === 'custom') {
      setCustomOpen(true)
      setStart(range.start)
      setEnd(range.end)
    }
  }, [range])

  function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (!error) onChange({ kind: 'custom', start, end })
  }

  return (
    <div className="admin-costs-range">
      <div role="group" aria-label="AI and cost date range" className="admin-costs-range__presets">
        {ADMIN_COST_PRESETS.map((preset) => {
          const active = range.kind === 'preset' && range.preset === preset
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={active}
              className={active ? 'is-active' : ''}
              onClick={() => {
                setCustomOpen(false)
                setSubmitted(false)
                onChange({ kind: 'preset', preset })
              }}
            >{PRESET_LABELS[preset]}</button>
          )
        })}
        <button
          type="button"
          aria-expanded={customOpen}
          aria-controls={customId}
          className={customOpen ? 'is-active' : ''}
          onClick={() => setCustomOpen((open) => !open)}
        >Custom</button>
      </div>
      {customOpen && (
        <form id={customId} className="admin-costs-range__custom" onSubmit={submit}>
          <label>Start (UTC)<input type="date" value={start} max={today} onChange={(event) => setStart(event.target.value)} /></label>
          <label>End (UTC)<input type="date" value={end} max={today} onChange={(event) => setEnd(event.target.value)} /></label>
          <button type="submit">Apply</button>
          {submitted && error && <p role="alert">{error}</p>}
        </form>
      )}
    </div>
  )
}

function CostsLoading() {
  return (
    <div className="admin-costs-loading" aria-live="polite" aria-busy="true">
      <span className="admin-costs-sr-only">Loading AI and cost data</span>
      <div className="admin-costs-skeleton admin-costs-skeleton--wide" />
      <div className="admin-costs-card-grid">
        {Array.from({ length: 6 }, (_, index) => <div className="admin-costs-skeleton" key={index} />)}
      </div>
    </div>
  )
}

function CostsContent({
  model,
  stale,
  onRetry,
}: {
  model: AdminCostsModel
  stale: boolean
  onRetry?: () => void
}) {
  const empty = model.summary.totalRequests.status === 'available' && model.summary.totalRequests.value === 0
  return (
    <>
      {stale && (
        <section className="admin-costs-banner" role="status">
          <strong>Showing stale data</strong>
          <span>The latest refresh failed. Values below are from the last successful authorized read.</span>
        </section>
      )}
      {model.source.status === 'partial' && (
        <section className="admin-costs-banner admin-costs-banner--partial" aria-labelledby="costs-partial-title">
          <strong id="costs-partial-title">Partial totals</strong>
          <ul>
            {model.source.reasons.map((reason) => <li key={reason}>{ADMIN_COST_COMPLETENESS_MESSAGES[reason]}</li>)}
          </ul>
        </section>
      )}
      {empty && (
        <section className="admin-costs-empty" role="status">
          <h2>No recorded provider usage</h2>
          <p>The complete authorized projection proves zero stored AI and TTS requests for this range.</p>
        </section>
      )}

      <section aria-labelledby="cost-summary-title">
        <SectionHeading id="cost-summary-title" eyebrow={`${model.range.start} through ${model.range.end} UTC`} title="Usage summary" />
        <div className="admin-costs-card-grid">
          <MetricCard label="AI requests" metric={model.summary.aiRequests} />
          <MetricCard label="TTS requests" metric={model.summary.ttsRequests} />
          <MetricCard label="Input tokens" metric={model.summary.inputTokens} />
          <MetricCard label="Output tokens" metric={model.summary.outputTokens} />
          <MetricCard label="Cached input read tokens" metric={model.summary.cachedInputReadTokens} />
          <MetricCard label="Cached input write tokens" metric={model.summary.cachedInputWriteTokens} />
          <MetricCard label="TTS characters" metric={model.summary.ttsCharacters} />
          <MoneyCard label="Calculated provider cost (estimate)" metric={model.summary.calculatedCost} />
          <MoneyCard label="Reconciled provider cost" metric={model.summary.reconciledCost} />
          <article className="admin-costs-card">
            <p>Unavailable costs</p>
            <strong>{model.summary.unavailableCostCount.toLocaleString()}</strong>
            <span>records without trustworthy cost</span>
          </article>
        </div>
        <p className="admin-costs-disclosure">Calculated provider cost is a usage-derived estimate, not provider-invoice truth. Reconciled provider cost is reported separately.</p>
      </section>

      <ProviderAccountingCoverageSection
        coverage={model.providerAccountingCoverage}
        onRetry={onRetry}
      />

      <section className="admin-costs-panel" aria-labelledby="cost-completeness-title">
        <SectionHeading id="cost-completeness-title" eyebrow="Evidence quality" title="Completeness and disposition" />
        <div className="admin-costs-completeness-grid">
          <CountList title="Attribution" values={[
            ['Resolved', model.summary.attributionCounts.resolved],
            ['Ambiguous', model.summary.attributionCounts.ambiguous],
            ['Unresolved', model.summary.attributionCounts.unresolved],
          ]} />
          <CountList title="Billing disposition" values={[
            ['Billable', model.summary.billingDispositionCounts.billable],
            ['Not billable', model.summary.billingDispositionCounts.notBillable],
            ['Unknown', model.summary.billingDispositionCounts.unknown],
          ]} />
          <CountList title="Cost kind" values={[
            ['Calculated', model.summary.costKindCounts.calculated],
            ['Reconciled', model.summary.costKindCounts.reconciled],
            ['Unavailable', model.summary.costKindCounts.unavailable],
          ]} />
        </div>
        <p className="admin-costs-disclosure">No learner-cost breakdown is shown because the integrated ledger does not contain trusted learner attribution for these provider calls.</p>
      </section>

      <section className="admin-costs-panel" aria-labelledby="cost-trend-title">
        <SectionHeading id="cost-trend-title" eyebrow="Recorded days only" title="Daily trend" />
        {model.trend.length === 0 ? (
          <p className="admin-costs-table-empty">No real daily usage points are available for this range.</p>
        ) : (
          <div className="admin-costs-table-wrap">
            <table>
              <caption>Daily AI and TTS usage with calculated and reconciled cost</caption>
              <thead><tr><th scope="col">UTC date</th><th scope="col">AI requests</th><th scope="col">TTS requests</th><th scope="col">Tokens</th><th scope="col">TTS characters</th><th scope="col">Calculated</th><th scope="col">Reconciled</th></tr></thead>
              <tbody>{model.trend.map((point) => (
                <tr key={point.date}>
                  <th scope="row">{point.date}</th>
                  <td><CountValue metric={point.aiRequests} /></td>
                  <td><CountValue metric={point.ttsRequests} /></td>
                  <td><CombinedTokens point={point} /></td>
                  <td><CountValue metric={point.ttsCharacters} /></td>
                  <td><MoneyValue metric={point.calculatedCost} /></td>
                  <td><MoneyValue metric={point.reconciledCost} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <BreakdownTable title="Usage by engine" rows={model.breakdowns.engines} />
      <BreakdownTable title="Usage by provider" rows={model.breakdowns.providers} />
      <BreakdownTable title="Usage by approved product tier" rows={model.breakdowns.models} />
      <div className="admin-costs-two-column">
        <BreakdownTable title="Usage by cost kind" rows={model.breakdowns.costKinds} compact />
        <BreakdownTable title="Usage by billing disposition" rows={model.breakdowns.billingDispositions} compact />
      </div>

      <footer className="admin-costs-footer">
        Projection generated <time dateTime={model.generatedAt}>{formatUtc(model.generatedAt)}</time>. {model.source.recordsIncluded.toLocaleString()} bounded ledger records included.
      </footer>
    </>
  )
}

function ProviderAccountingCoverageSection({
  coverage,
  onRetry,
}: {
  coverage: AdminProviderAccountingCoverage
  onRetry?: () => void
}) {
  const titleId = useId()
  if (coverage.status === 'unavailable' || coverage.metrics === null) {
    return (
      <section className="admin-costs-panel admin-provider-coverage" aria-labelledby={titleId}>
        <SectionHeading id={titleId} eyebrow="Accounting trail" title="Provider accounting coverage" />
        <div className="admin-provider-coverage__unavailable" role="status">
          <strong>Coverage unavailable</strong>
          <p>{PROVIDER_COVERAGE_STATUS_COPY.unavailable} Existing usage and cost totals above remain independently sourced.</p>
          {onRetry && <button type="button" onClick={onRetry}>Retry coverage</button>}
        </div>
        <CoverageScopeDisclosure coverage={coverage} />
      </section>
    )
  }

  const metrics = coverage.metrics
  const journalLabel = PROVIDER_COVERAGE_STATUS_LABELS[coverage.journalStatus]
  const reconciliationLabel = coverage.reconciliationState === 'clear_for_journaled_attempts'
    ? 'Clear for journaled attempts'
    : coverage.reconciliationState === 'in_progress'
      ? 'In progress'
      : coverage.reconciliationState === 'gaps_detected'
        ? 'Gaps detected'
        : coverage.reconciliationState === 'conflict'
          ? 'Conflict'
          : 'Insufficient evidence'
  return (
    <section className="admin-costs-panel admin-provider-coverage" aria-labelledby={titleId}>
      <SectionHeading id={titleId} eyebrow="Accounting trail" title="Provider accounting coverage" />
      <div
        className={`admin-provider-coverage__status admin-provider-coverage__status--${coverage.status}`}
        role="status"
      >
        <div>
          <span>Status</span>
          <strong>{PROVIDER_COVERAGE_STATUS_LABELS[coverage.status]}</strong>
        </div>
        <p>{PROVIDER_COVERAGE_STATUS_COPY[coverage.status]}</p>
        <p><strong>Journal state:</strong> {journalLabel}</p>
        <p><strong>Reconciliation state:</strong> {reconciliationLabel}</p>
      </div>

      <div className="admin-provider-coverage__metrics" aria-label="Provider accounting coverage summary">
        {([
          ['Reserved attempts', metrics.reservedAttempts, 'Journal reservations in the selected range'],
          ['Reservation-only attempts', metrics.reservationOnlyAttempts, 'Reservations not yet closed or dispatch-ready'],
          ['Dispatch-possible', metrics.dispatchPossibleAttempts, 'Current lifecycle state'],
          ['Observed outcomes', metrics.observedOutcomes, 'Awaiting final accounting state'],
          ['Ledger-linked attempts', metrics.ledgerLinkedAttempts, 'Exact authoritative ledger relationship'],
          ['Accounting gaps', metrics.accountingGaps, 'Missing journal or ledger relationships'],
          ['Gap pending', metrics.gapPending, 'Known provider attempts awaiting a ledger relationship'],
          ['Reconciliation conflicts', metrics.reconciliationConflicts, 'Conflicting durable facts'],
          ['Reconciled attempts', metrics.reconciledAttempts, 'Closed with bounded reconciliation evidence'],
          ['Confirmed not dispatched', metrics.confirmedNotDispatched, 'Trusted evidence that no provider call occurred'],
          ['Unresolvable', metrics.unresolvable, 'Closed without recoverable resolution'],
        ] as const).map(([label, value, detail]) => (
          <article className="admin-provider-coverage__metric" key={label}>
            <p>{label}</p>
            <strong>{value.toLocaleString()}</strong>
            <span>{detail}</span>
          </article>
        ))}
      </div>

      <CoverageBreakdownTable
        title="Coverage by engine"
        caption="Journaled provider accounting coverage grouped by engine"
        rows={coverage.breakdowns.engines}
      />
      <CoverageBreakdownTable
        title="Coverage by purpose"
        caption="Journaled provider accounting coverage grouped by purpose"
        rows={coverage.breakdowns.purposes}
      />
      <CoverageBreakdownTable
        title="Coverage by provider"
        caption="Journaled provider accounting coverage grouped by provider"
        rows={coverage.breakdowns.providers}
      />
      <CoverageScopeDisclosure coverage={coverage} />
    </section>
  )
}

function CoverageScopeDisclosure({ coverage }: { coverage: AdminProviderAccountingCoverage }) {
  return (
    <div className="admin-provider-coverage__scope" role="note">
      <strong>Coverage boundary</strong>
      <ul>
        {coverage.providerInstrumentation.engines.map((engine) => (
          <li key={engine.key}>
            {PROVIDER_COVERAGE_DIMENSION_LABELS[engine.key]} provider instrumentation: {engine.status}
          </li>
        ))}
      </ul>
      <p>The instrumentation rows above are the server-owned coverage contract. Coverage is complete only for the currently implemented, instrumented provider-attempt paths.</p>
      <p>This is an accounting-trail check, not a provider bill comparison. It cannot establish that stored activity equals a provider bill.</p>
    </div>
  )
}

function CoverageBreakdownTable({
  title,
  caption,
  rows,
}: {
  title: string
  caption: string
  rows: readonly AdminProviderAccountingCoverageBreakdownRow[]
}) {
  const id = useId()
  return (
    <section className="admin-provider-coverage__breakdown" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      {rows.length === 0 ? (
        <p className="admin-costs-table-empty">No journaled attempts to break down.</p>
      ) : (
        <div className="admin-costs-table-wrap" tabIndex={0}>
          <table>
            <caption>{caption}. Unmatched ledger rows without a journal relationship remain in the summary only.</caption>
            <thead>
              <tr><th scope="col">Dimension</th><th scope="col">Reserved</th><th scope="col">Ledger linked</th><th scope="col">Gaps</th><th scope="col">Conflicts</th><th scope="col">Status</th></tr>
            </thead>
            <tbody>{rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{PROVIDER_COVERAGE_DIMENSION_LABELS[row.key]}</th>
                <td>{row.reservedAttempts.toLocaleString()}</td>
                <td>{row.ledgerLinkedAttempts.toLocaleString()}</td>
                <td>{row.accountingGaps.toLocaleString()}</td>
                <td>{row.reconciliationConflicts.toLocaleString()}</td>
                <td>{PROVIDER_COVERAGE_STATUS_LABELS[row.status]}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function MetricCard({ label, metric }: { label: string; metric: AdminCostCountMetric }) {
  return (
    <article className={`admin-costs-card admin-costs-card--${metric.status}`}>
      <p>{label}</p>
      <strong><CountValue metric={metric} /></strong>
      <span>{metric.status === 'partial' ? 'Partial total' : metric.status === 'unavailable' ? 'Unavailable' : 'Recorded total'}</span>
    </article>
  )
}

function MoneyCard({ label, metric }: { label: string; metric: AdminCostMoneyMetric }) {
  return (
    <article className={`admin-costs-card admin-costs-card--${metric.status}`}>
      <p>{label}</p>
      <strong><MoneyValue metric={metric} /></strong>
      <span>{metric.status === 'partial' ? 'Partial USD total' : metric.status === 'unavailable' ? 'Unavailable, not $0' : 'USD'}</span>
    </article>
  )
}

function CountValue({ metric }: { metric: AdminCostCountMetric }) {
  if (metric.status === 'unavailable' || metric.value === null) return <>— <span className="admin-costs-value-status">Unavailable</span></>
  return <>{metric.value.toLocaleString()}{metric.status === 'partial' && <span className="admin-costs-value-status"> Partial</span>}</>
}

function MoneyValue({ metric }: { metric: AdminCostMoneyMetric }) {
  if (metric.status === 'unavailable' || metric.micros === null) return <>— <span className="admin-costs-value-status">Unavailable</span></>
  return <>{formatUsdMicros(metric.micros, metric.currency)}{metric.status === 'partial' && <span className="admin-costs-value-status"> Partial</span>}</>
}

function CombinedTokens({ point }: { point: AdminCostAggregateForView }) {
  const metrics = [point.inputTokens, point.outputTokens, point.cachedInputReadTokens, point.cachedInputWriteTokens]
  if (metrics.some((metric) => metric.value === null)) return <>— <span className="admin-costs-value-status">Unavailable</span></>
  const total = metrics.reduce((sum, metric) => sum + (metric.value ?? 0), 0)
  return <>{total.toLocaleString()}{metrics.some((metric) => metric.status === 'partial') && <span className="admin-costs-value-status"> Partial</span>}</>
}

type AdminCostAggregateForView = Pick<AdminCostsModel['summary'],
  'inputTokens' | 'outputTokens' | 'cachedInputReadTokens' | 'cachedInputWriteTokens'>

function CountList({ title, values }: { title: string; values: readonly (readonly [string, number])[] }) {
  return (
    <div><h3>{title}</h3><dl>{values.map(([label, value]) => (
      <div key={label}><dt>{label}</dt><dd>{value.toLocaleString()}</dd></div>
    ))}</dl></div>
  )
}

function BreakdownTable({ title, rows, compact = false }: { title: string; rows: readonly AdminCostBreakdownRow[]; compact?: boolean }) {
  const id = useId()
  return (
    <section className="admin-costs-panel" aria-labelledby={id}>
      <SectionHeading id={id} eyebrow="Privacy-safe aggregate" title={title} />
      {rows.length === 0 ? <p className="admin-costs-table-empty">No recorded usage.</p> : (
        <div className="admin-costs-table-wrap">
          <table>
            <thead><tr><th scope="col">{compact ? 'State' : 'Source'}</th><th scope="col">Requests</th><th scope="col">Calculated</th><th scope="col">Reconciled</th><th scope="col">Cost unavailable</th></tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                <td><CountValue metric={row.totalRequests} /></td>
                <td><MoneyValue metric={row.calculatedCost} /></td>
                <td><MoneyValue metric={row.reconciledCost} /></td>
                <td>{row.unavailableCostCount.toLocaleString()}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function SectionHeading({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return <header className="admin-costs-section-heading"><p>{eyebrow}</p><h2 id={id}>{title}</h2></header>
}

function formatUtc(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
  }).format(new Date(value)) + ' UTC'
}
