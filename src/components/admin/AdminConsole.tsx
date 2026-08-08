import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import {
  OVERVIEW_PRESETS,
  movePresetSelection,
  validateCustomRange,
  type AdminConsoleProps,
  type AdminOverviewModel,
  type AdminSection,
  type EngineHealth,
  type Metric,
  type OverviewPreset,
  type OverviewRange,
} from '../../admin/overviewModel'
import './admin-console.css'

const NAVIGATION: readonly { id: AdminSection; label: string; shortLabel?: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'learners', label: 'Learners' },
  { id: 'engines', label: 'Engines' },
  { id: 'ai-costs', label: 'AI & Costs' },
  { id: 'curriculum', label: 'Curriculum' },
  { id: 'safety', label: 'Safety' },
  { id: 'system-health', label: 'System Health' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'audit-log', label: 'Audit Log' },
  { id: 'releases', label: 'Releases' },
]

const PRESET_LABELS: Record<OverviewPreset, string> = {
  today: 'Today',
  '7-days': '7 days',
  '30-days': '30 days',
  'school-year': 'School year',
}
const HEALTH_LABELS: Record<EngineHealth, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  unavailable: 'Unavailable',
  disabled: 'Disabled',
  unknown: 'Unknown',
}

export function AdminConsole(props: AdminConsoleProps) {
  if (props.authorization === 'resolving') {
    return <AuthorizationState kind="resolving" />
  }
  if (props.authorization === 'unauthorized') {
    return <AuthorizationState kind="unauthorized" reason={props.reason} />
  }
  return <AuthorizedConsole {...props} />
}

function AuthorizationState({ kind, reason }: { kind: 'resolving' | 'unauthorized'; reason?: string }) {
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
            : reason ?? 'Your account is not authorized to view this console.'}
        </p>
      </section>
    </main>
  )
}

function AuthorizedConsole(props: Extract<AdminConsoleProps, { authorization: 'authorized' }>) {
  return (
    <div className="admin-shell">
      <a className="admin-skip-link" href="#admin-main">Skip to overview</a>
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <BrandMark />
          <div><strong>Manuel Academy</strong><span>Admin console</span></div>
        </div>
        <nav aria-label="Admin sections">
          <p className="admin-nav-label">Workspace</p>
          <ul>
            {NAVIGATION.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={item.id === 'overview' ? 'is-active' : ''}
                  aria-current={item.id === 'overview' ? 'page' : undefined}
                  onClick={() => props.onNavigate?.(item.id)}
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
          Authorized operator session
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <p className="admin-breadcrumb">Admin console <span aria-hidden="true">/</span> Overview</p>
            <h1>Academy overview</h1>
          </div>
          <TimeRangeControl selected={props.selectedRange} onChange={props.onRangeChange} />
        </header>
        <main id="admin-main" className="admin-main" tabIndex={-1}>
          {props.overview.status === 'loading' && <OverviewLoading />}
          {props.overview.status === 'error' && (
            <OverviewError message={props.overview.message} onRetry={props.onRetry} />
          )}
          {props.overview.status === 'ready' && <Overview model={props.overview.model} />}
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
          <div><strong>Data may be out of date</strong><span>{model.staleReason ?? 'The latest refresh did not complete.'}</span></div>
        </div>
      )}

      <section className="admin-status-panel" aria-labelledby="academy-status-title">
        <SectionHeading id="academy-status-title" eyebrow="Current deployment" title="Academy status" />
        <dl className="admin-status-grid">
          <StatusItem label="Environment" metric={model.academy.environment} />
          <StatusItem label="App version" metric={model.academy.appVersion} />
          <StatusItem label="Curriculum" metric={model.academy.curriculumVersion} />
          <StatusItem label="Overall health" metric={model.academy.overallHealth} health />
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
              <li key={engine.name}>
                <div><strong>{engine.name}</strong>{engine.detail && <span>{engine.detail}</span>}</div>
                {engine.href ? (
                  <a href={engine.href} aria-label={`View ${engine.name} engine details`}>
                    <HealthBadge status={engine.health} /><span aria-hidden="true">›</span>
                  </a>
                ) : <HealthBadge status={engine.health} />}
              </li>
            ))}
          </ul>
        </section>

        <section className="admin-panel" aria-labelledby="ai-title">
          <SectionHeading id="ai-title" eyebrow="Usage telemetry" title="AI & speech" />
          <div className="admin-compact-metrics">
            <CompactMetric label="AI requests" metric={model.ai.requests} />
            <CompactMetric label="Input tokens" metric={model.ai.inputTokens} />
            <CompactMetric label="Output tokens" metric={model.ai.outputTokens} />
            <CompactMetric label="TTS characters" metric={model.ai.ttsCharacters} />
            <CompactMetric
              label={model.ai.spend.status === 'available' && model.ai.spend.value.basis === 'calculated' ? 'Calculated spend' : 'Estimated spend'}
              metric={model.ai.spend}
              formatter={(value) => `$${value.amountUsd.toFixed(2)}`}
            />
          </div>
          <p className="admin-disclosure">Usage-derived amount. Not a reconciled provider invoice.</p>
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

function OverviewError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <section className="admin-error" role="alert">
      <StatusGlyph status="unavailable" />
      <p className="admin-eyebrow">Overview unavailable</p>
      <h2>We couldn’t load operational data</h2>
      <p>{message}</p>
      {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
    </section>
  )
}

function SectionHeading({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return <header className="admin-section-heading"><div><p>{eyebrow}</p><h2 id={id}>{title}</h2></div></header>
}

function StatusItem<T>({ label, metric, health = false }: { label: string; metric: Metric<T>; health?: boolean }) {
  return (
    <div><dt>{label}</dt><dd>{health && metric.status === 'available'
      ? <HealthBadge status={metric.value as EngineHealth} />
      : <MetricValue metric={metric} />}</dd></div>
  )
}

function StatCard({ label, metric, suffix }: { label: string; metric: Metric<number>; suffix?: string }) {
  return <article className={`admin-stat-card ${metric.status !== 'available' ? 'is-unavailable' : ''}`}><p>{label}</p><strong><MetricValue metric={metric} suffix={suffix} /></strong></article>
}

function CompactMetric<T>({ label, metric, formatter, suffix }: { label: string; metric: Metric<T>; formatter?: (value: T) => string; suffix?: string }) {
  return <div><dt>{label}</dt><dd><MetricValue metric={metric} formatter={formatter} suffix={suffix} /></dd></div>
}

function MetricValue<T>({ metric, formatter, suffix = '' }: { metric: Metric<T>; formatter?: (value: T) => string; suffix?: string }) {
  if (metric.status !== 'available') {
    return <span className="admin-metric-missing"><span aria-hidden="true">—</span> {metric.status === 'unknown' ? 'Unknown' : 'Unavailable'}</span>
  }
  const value = formatter ? formatter(metric.value) : typeof metric.value === 'number' ? metric.value.toLocaleString() : String(metric.value)
  return <>{value}{suffix}</>
}

function HealthBadge({ status }: { status: EngineHealth }) {
  return <span className={`admin-health admin-health--${status}`}><StatusGlyph status={status} />{HEALTH_LABELS[status]}</span>
}

function StatusGlyph({ status }: { status: EngineHealth }) {
  return <span className={`admin-status-glyph admin-status-glyph--${status}`} aria-hidden="true">{status === 'healthy' ? '✓' : status === 'degraded' ? '!' : status === 'disabled' ? '–' : '?'}</span>
}

function BrandMark() {
  return <span className="admin-brand-mark" aria-hidden="true"><span>MA</span></span>
}

function NavIcon({ section }: { section: AdminSection }) {
  const icons: Record<AdminSection, string> = {
    overview: '⌂', learners: '◉', engines: '◇', 'ai-costs': '✦', curriculum: '▤',
    safety: '◆', 'system-health': '⌁', configuration: '⚙', 'audit-log': '≡', releases: '↑',
  }
  return <span className="admin-nav-icon" aria-hidden="true">{icons[section]}</span>
}
