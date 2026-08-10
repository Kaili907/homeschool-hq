import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { AdminCapability, AdminEngineId, AdminHealthState } from '../../admin/admin0Vocabulary'
import {
  formatUsdMicros,
  safeAuthorizationMessage,
  safeCompletenessMessage,
  safeCostReasonMessage,
  safeEngineReasonMessage,
  safeOverviewErrorMessage,
  safeStaleMessage,
} from '../../admin/overviewAdapter'
import {
  OVERVIEW_PRESETS,
  hasOverviewReadCapability,
  movePresetSelection,
  validateCustomRange,
  type AdminConsoleProps,
  type AdminOverviewModel,
  type AdminSection,
  type ApplicableMetric,
  type Metric,
  type OverviewPreset,
  type OverviewRange,
} from '../../admin/overviewModel'
import './admin-console.css'

const NAVIGATION: readonly { id: AdminSection; label: string; capability: AdminCapability }[] = [
  { id: 'overview', label: 'Overview', capability: 'overview:read' },
  { id: 'learners', label: 'Learners', capability: 'learners:read' },
  { id: 'engines', label: 'Engine Performance', capability: 'engines:read' },
  { id: 'costs', label: 'AI & Costs', capability: 'costs:read' },
  { id: 'system-health', label: 'System Health', capability: 'health:read' },
  { id: 'safety', label: 'Safety', capability: 'safety:read' },
  { id: 'curriculum', label: 'Curriculum', capability: 'curriculum:read' },
  { id: 'audit-log', label: 'Audit Log', capability: 'audit:read' },
]

const PRESET_LABELS: Record<OverviewPreset, string> = {
  today: 'Today',
  '7-days': '7 days',
  '30-days': '30 days',
  'school-year': 'School year',
}
const ENGINE_LABELS: Readonly<Record<AdminEngineId, string>> = {
  tutor: 'Tutor',
  study: 'Study',
  assessment: 'Assessment',
  curriculum: 'Curriculum',
  jarvis: 'Jarvis',
  tts: 'TTS',
  gateway: 'Gateway',
  sync: 'Sync',
}

const HEALTH_LABELS: Record<AdminHealthState, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  unavailable: 'Unavailable',
  disabled: 'Disabled',
  unknown: 'Unknown',
}

export function AdminConsole(props: AdminConsoleProps) {
  if (props.authorization.status === 'resolving') {
    return <AuthorizationState kind="resolving" />
  }
  if (!isAuthorizedConsoleProps(props)) {
    return <AuthorizationState kind="unauthorized" reasonCode={props.authorization.reasonCode} />
  }
  if (!hasOverviewReadCapability(props.authorization)) {
    return <AuthorizationState kind="unauthorized" reasonCode="overview_read_required" />
  }
  return <AuthorizedConsole {...props} />
}

function isAuthorizedConsoleProps(
  props: AdminConsoleProps,
): props is Extract<AdminConsoleProps, { authorization: { status: 'authorized' } }> {
  return props.authorization.status === 'authorized'
}

function AuthorizationState({ kind, reasonCode }: { kind: 'resolving' | 'unauthorized'; reasonCode?: 'admin_assignment_required' | 'authorization_unavailable' | 'overview_read_required' }) {
  const resolving = kind === 'resolving'
  return (
    <main className="admin-gate" aria-busy={resolving}>
      <div className="admin-gate__brand" aria-label="Manuel Academy">
        <BrandMark />
        <span>MANUEL ACADEMY</span>
      </div>
      <section className="admin-gate__panel" aria-live="polite">
        <span className={`admin-gate__icon ${resolving ? 'is-loading' : ''}`} aria-hidden="true">
          {resolving ? '' : '–'}
        </span>
        <p className="admin-eyebrow">Admin console</p>
        <h1>{resolving ? 'Verifying access' : 'Access unavailable'}</h1>
        <p>
          {resolving
            ? 'The console will remain private until administrator authorization is confirmed.'
            : safeAuthorizationMessage(reasonCode ?? 'authorization_unavailable')}
        </p>
      </section>
    </main>
  )
}

function AuthorizedConsole(props: Extract<AdminConsoleProps, { authorization: { status: 'authorized' } }>) {
  return (
    <AdminShell
      authorization={props.authorization}
      activeSection="overview"
      title="Academy overview"
      toolbar={<TimeRangeControl selected={props.selectedRange} onChange={props.onRangeChange} />}
      onNavigate={props.onNavigate}
    >
      {props.overview.status === 'loading' && <OverviewLoading />}
      {props.overview.status === 'error' && (
        <OverviewError code={props.overview.code} onRetry={props.onRetry} />
      )}
      {props.overview.status === 'ready' && <Overview model={props.overview.model} />}
    </AdminShell>
  )
}

type AuthorizedAdmin = Extract<AdminConsoleProps, { authorization: { status: 'authorized' } }>['authorization']

export function AdminShell({
  authorization,
  activeSection,
  title,
  toolbar,
  onNavigate,
  children,
}: {
  readonly authorization: AuthorizedAdmin
  readonly activeSection: AdminSection
  readonly title: string
  readonly toolbar?: ReactNode
  readonly onNavigate?: (section: AdminSection) => void
  readonly children: ReactNode
}) {
  const activeLabel = NAVIGATION.find((item) => item.id === activeSection)?.label ?? title
  const visibleNavigation = NAVIGATION.filter((item) => authorization.capabilities.includes(item.capability))
  return (
    <div className="admin-shell">
      <a className="admin-skip-link" href="#admin-main">Skip to {activeLabel.toLowerCase()}</a>
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <BrandMark />
          <div><strong>Manuel Academy</strong><span>Admin console</span></div>
        </div>
        <nav aria-label="Admin sections">
          <p className="admin-nav-label">Workspace</p>
          <ul>
            {visibleNavigation.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={item.id === activeSection ? 'is-active' : ''}
                  aria-current={item.id === activeSection ? 'page' : undefined}
                  onClick={() => onNavigate?.(item.id)}
                >
                  <NavIcon section={item.id} />
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="admin-sidebar__footer">
          <span className="admin-secure-dot" aria-hidden="true" />
          {authorization.role[0].toUpperCase() + authorization.role.slice(1)} operator session
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <p className="admin-breadcrumb">Admin console <span aria-hidden="true">/</span> {activeLabel}</p>
            <h1>{title}</h1>
          </div>
          {toolbar}
        </header>
        <main id="admin-main" className="admin-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  )
}

function TimeRangeControl({ selected, onChange }: { selected: OverviewRange; onChange: (range: OverviewRange) => void }) {
  const customId = useId()
  const [customOpen, setCustomOpen] = useState(selected.kind === 'custom')
  const [start, setStart] = useState(selected.kind === 'custom' ? selected.start : '')
  const [end, setEnd] = useState(selected.kind === 'custom' ? selected.end : '')
  const [submitted, setSubmitted] = useState(false)
  const error = validateCustomRange(start, end)

  useEffect(() => {
    if (selected.kind === 'custom') {
      setCustomOpen(true)
      setStart(selected.start)
      setEnd(selected.end)
    }
  }, [selected])

  function choosePreset(preset: OverviewPreset) {
    setCustomOpen(false)
    setSubmitted(false)
    onChange({ kind: 'preset', preset })
  }

  function handlePresetKey(event: KeyboardEvent<HTMLButtonElement>, preset: OverviewPreset) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = movePresetSelection(preset, event.key as 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End')
    choosePreset(next)
    const group = event.currentTarget.parentElement
    group?.querySelector<HTMLButtonElement>(`[data-preset="${next}"]`)?.focus()
  }

  return (
    <div className="admin-range">
      <div className="admin-range__presets" role="group" aria-label="Overview time range">
        {OVERVIEW_PRESETS.map((preset) => {
          const active = selected.kind === 'preset' && selected.preset === preset
          return (
            <button
              key={preset}
              type="button"
              data-preset={preset}
              className={active ? 'is-active' : ''}
              aria-pressed={active}
              onClick={() => choosePreset(preset)}
              onKeyDown={(event) => handlePresetKey(event, preset)}
            >{PRESET_LABELS[preset]}</button>
          )
        })}
        <button
          type="button"
          className={customOpen ? 'is-active' : ''}
          aria-expanded={customOpen}
          aria-controls={customId}
          onClick={() => setCustomOpen((open) => !open)}
        >Custom</button>
      </div>
      {customOpen && (
        <form
          id={customId}
          className="admin-custom-range"
          onSubmit={(event) => {
            event.preventDefault()
            setSubmitted(true)
            if (!error) onChange({ kind: 'custom', start, end })
          }}
        >
          <label>Start<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label>
          <label>End<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
          <button type="submit">Apply</button>
          {submitted && error && <p role="alert">{error}</p>}
        </form>
      )}
    </div>
  )
}

function Overview({ model }: { model: AdminOverviewModel }) {
  return (
    <div className="admin-overview">
      {model.freshness === 'stale' && (
        <div className="admin-banner admin-banner--stale" role="status">
          <StatusGlyph status="degraded" />
          <div><strong>Data may be out of date</strong><span>{safeStaleMessage(model.staleReasonCode)}</span></div>
        </div>
      )}

      <section className="admin-status-panel" aria-labelledby="academy-status-title">
        <SectionHeading id="academy-status-title" eyebrow="Current deployment" title="Academy status" />
        <dl className="admin-status-grid">
          <StatusItem label="Environment" metric={model.academy.environment} />
          <StatusItem label="App version" metric={model.academy.appVersion} />
          <StatusItem label="Curriculum" metric={model.academy.curriculumVersion} />
          <StatusItem label="Overall health" metric={model.academy.overallHealth} health />
          <StatusItem label="Observed at" metric={{ status: 'available', value: model.observedAt }} />
          <StatusItem label="Last successful refresh" metric={model.academy.lastSuccessfulDataRefresh} />
        </dl>
      </section>

      <section aria-labelledby="learners-title">
        <SectionHeading id="learners-title" eyebrow="Instructional activity" title="Learners" />
        <div className="admin-stat-grid admin-stat-grid--five">
          <StatCard label="Active learners" metric={model.learners.activeLearners} />
          <StatCard label="Lessons started" metric={model.learners.lessonsStarted} />
          <StatCard label="Lessons completed" metric={model.learners.lessonsCompleted} />
          <StatCard label="Study sessions" metric={model.learners.studySessions} />
          <StatCard label="Instructional time" metric={model.learners.instructionalMinutes} suffix=" min" />
        </div>
      </section>

      <div className="admin-two-column">
        <section className="admin-panel" aria-labelledby="engines-title">
          <SectionHeading id="engines-title" eyebrow="Service readiness" title="Engine health" />
          <ul className="admin-engine-list">
            {model.engines.map((engine) => (
              <li key={engine.engineId}>
                <div>
                  <strong>{ENGINE_LABELS[engine.engineId]}</strong>
                  <span>
                    {engine.engineVersion ?? 'Version not applicable'}
                    {engine.reasonCodes.length > 0 && ` · ${engine.reasonCodes.map(safeEngineReasonMessage).join(' · ')}`}
                  </span>
                </div>
                <a href={`/academy/admin/engines/${engine.engineId}`} aria-label={`View ${ENGINE_LABELS[engine.engineId]} engine details`}>
                  <HealthBadge status={engine.health} /><span aria-hidden="true">›</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="admin-panel" aria-labelledby="ai-title">
          <SectionHeading id="ai-title" eyebrow="Usage telemetry" title="AI & speech" />
          <div className="admin-compact-metrics">
            <CompactMetric label="AI requests" metric={model.ai.requests} />
            <CompactMetric label="Non-cached input tokens" metric={model.ai.inputTokens} />
            <CompactMetric label="Output tokens" metric={model.ai.outputTokens} />
            <CompactMetric label="Cached input read tokens" metric={model.ai.cachedInputReadTokens} />
            <CompactMetric label="Cached input write tokens" metric={model.ai.cachedInputWriteTokens} />
            <CompactMetric label="TTS characters" metric={model.ai.ttsCharacters} />
            <SpendMetric spend={model.ai.spend} />
          </div>
          <p className="admin-disclosure">
            {billingDispositionLabel(model.ai.spend.billingDisposition)}. {safeCompletenessMessage(model.ai.spend.completeness)}
            {safeCostReasonMessage(model.ai.spend.resultReasonCode) && ` ${safeCostReasonMessage(model.ai.spend.resultReasonCode)}`}
          </p>
          <p className="admin-disclosure">Calculated values are usage-derived marginal provider cost for recorded provider attempts using verified effective-dated pricing terms. They do not represent reconciled provider-invoice economics.</p>
          <p className="admin-disclosure">Overview does not establish aggregate query coverage, provider-traffic coverage, or accounting-gap evidence. Open AI &amp; Costs for those separate contract v3 signals.</p>
        </section>
      </div>

      <div className="admin-two-column">
        <section className="admin-panel" aria-labelledby="safety-title">
          <SectionHeading id="safety-title" eyebrow="Attention queue" title="Safety" />
          <div className="admin-compact-metrics">
            <CompactMetric label="Open safety stops" metric={model.safety.openSafetyStops} />
            <CompactMetric label="Adult reviews pending" metric={model.safety.adultReviewsPending} />
            <CompactMetric label="Safeguard failures" metric={model.safety.safeguardFailures} />
          </div>
        </section>
        <section className="admin-panel" aria-labelledby="system-title">
          <SectionHeading id="system-title" eyebrow="Platform signals" title="System" />
          <div className="admin-compact-metrics">
            <CompactMetric label="API error rate" metric={model.system.apiErrorRatePercent} formatter={(value) => `${value.toFixed(2)}%`} />
            <CompactMetric label="Median latency" metric={model.system.latencyMs} suffix=" ms" />
            <CompactMetric label="Sync failures" metric={model.system.syncFailures} />
            <CompactMetric label="Persistence failures" metric={model.system.persistenceFailures} />
          </div>
        </section>
      </div>
    </div>
  )
}

function OverviewLoading() {
  return (
    <div className="admin-loading" aria-live="polite" aria-busy="true">
      <span className="admin-sr-only">Loading academy overview</span>
      <div className="admin-skeleton admin-skeleton--banner" />
      <div className="admin-skeleton-row">{Array.from({ length: 5 }, (_, index) => <div className="admin-skeleton" key={index} />)}</div>
      <div className="admin-skeleton-row admin-skeleton-row--wide">{Array.from({ length: 4 }, (_, index) => <div className="admin-skeleton" key={index} />)}</div>
    </div>
  )
}

function OverviewError({ code, onRetry }: { code: 'overview_timeout' | 'overview_unavailable' | 'refresh_failed'; onRetry?: () => void }) {
  return (
    <section className="admin-error" role="alert">
      <StatusGlyph status="unavailable" />
      <p className="admin-eyebrow">Overview unavailable</p>
      <h2>We couldn’t load operational data</h2>
      <p>{safeOverviewErrorMessage(code)}</p>
      {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
    </section>
  )
}

function SectionHeading({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return <header className="admin-section-heading"><div><p>{eyebrow}</p><h2 id={id}>{title}</h2></div></header>
}

function StatusItem<T>({ label, metric, health = false }: { label: string; metric: ApplicableMetric<T>; health?: boolean }) {
  return (
    <div><dt>{label}</dt><dd>{health && metric.status === 'available'
      ? <HealthBadge status={metric.value as AdminHealthState} />
      : <MetricValue metric={metric} />}</dd></div>
  )
}

function StatCard({ label, metric, suffix }: { label: string; metric: Metric<number>; suffix?: string }) {
  return <article className={`admin-stat-card ${metric.status !== 'available' ? 'is-unavailable' : ''}`}><p>{label}</p><strong><MetricValue metric={metric} suffix={suffix} /></strong></article>
}

function CompactMetric<T>({ label, metric, formatter, suffix }: { label: string; metric: Metric<T>; formatter?: (value: T) => string; suffix?: string }) {
  return <div><dt>{label}</dt><dd><MetricValue metric={metric} formatter={formatter} suffix={suffix} /></dd></div>
}

function SpendMetric({ spend }: { spend: AdminOverviewModel['ai']['spend'] }) {
  const label = spend.status !== 'available' ? 'Spend' : spend.costKind === 'reconciled' ? 'Reconciled spend' : 'Estimated spend'
  return (
    <div>
      <dt>{label}</dt>
      <dd>{spend.status === 'available'
        ? formatUsdMicros(spend.costMicros, spend.currency)
        : <span className="admin-metric-missing"><span aria-hidden="true">—</span> {spend.status === 'unknown' ? 'Unknown' : 'Unavailable'}</span>}
      </dd>
    </div>
  )
}

function billingDispositionLabel(disposition: AdminOverviewModel['ai']['spend']['billingDisposition']): string {
  if (disposition === 'billable') return 'Billable usage'
  if (disposition === 'not_billable') return 'Explicitly not billable'
  return 'Billing disposition unknown'
}

function MetricValue<T>({ metric, formatter, suffix = '' }: { metric: ApplicableMetric<T>; formatter?: (value: T) => string; suffix?: string }) {
  if (metric.status !== 'available') {
    const label = metric.status === 'not_applicable' ? 'Not applicable' : metric.status === 'unknown' ? 'Unknown' : 'Unavailable'
    return <span className="admin-metric-missing"><span aria-hidden="true">—</span> {label}</span>
  }
  const value = formatter ? formatter(metric.value) : typeof metric.value === 'number' ? metric.value.toLocaleString() : String(metric.value)
  return <>{value}{suffix}</>
}

function HealthBadge({ status }: { status: AdminHealthState }) {
  return <span className={`admin-health admin-health--${status}`}><StatusGlyph status={status} />{HEALTH_LABELS[status]}</span>
}

function StatusGlyph({ status }: { status: AdminHealthState }) {
  return <span className={`admin-status-glyph admin-status-glyph--${status}`} aria-hidden="true">{status === 'healthy' ? '✓' : status === 'degraded' ? '!' : status === 'disabled' ? '–' : '?'}</span>
}

function BrandMark() {
  return <span className="admin-brand-mark" aria-hidden="true"><span>MA</span></span>
}

function NavIcon({ section }: { section: AdminSection }) {
  const icons: Record<AdminSection, string> = {
    overview: '⌂', learners: '◉', engines: '◇', costs: '✦', curriculum: '▤',
    safety: '◆', 'system-health': '⌁', configuration: '⚙', 'audit-log': '≡', releases: '↑',
  }
  return <span className="admin-nav-icon" aria-hidden="true">{icons[section]}</span>
}
