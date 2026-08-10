import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
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
  type OverviewDomainStatus,
} from '../../admin/overviewModel'
import './admin-console.css'

const NAVIGATION: readonly { id: AdminSection; label: string; capability: AdminCapability }[] = [
  { id: 'attention', label: 'Attention Center', capability: 'overview:read' },
  { id: 'overview', label: 'Overview', capability: 'overview:read' },
  { id: 'learners', label: 'Learners', capability: 'learners:read' },
  { id: 'engines', label: 'Engine Performance', capability: 'engines:read' },
  { id: 'costs', label: 'AI & Costs', capability: 'costs:read' },
  { id: 'system-health', label: 'System Health', capability: 'health:read' },
  { id: 'safety', label: 'Safety', capability: 'safety:read' },
  { id: 'curriculum', label: 'Curriculum', capability: 'curriculum:read' },
  { id: 'configuration', label: 'Configuration', capability: 'configuration:read' },
  { id: 'audit-log', label: 'Audit Log', capability: 'audit:read' },
  { id: 'access', label: 'Access & Permissions', capability: 'overview:read' },
  { id: 'releases', label: 'Production Readiness', capability: 'releases:read' },
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
        {!resolving && <a className="admin-gate__back" href="/academy">Back to Academy</a>}
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
  const headingRef = useRef<HTMLHeadingElement>(null)
  const previousTitle = useRef<string | null>(null)
  const activeLabel = NAVIGATION.find((item) => item.id === activeSection)?.label ?? title
  const visibleNavigation = NAVIGATION.filter((item) => authorization.capabilities.includes(item.capability))
  useEffect(() => {
    applyAdminRoutePresentation(title, document, headingRef.current, previousTitle.current !== null)
    previousTitle.current = title
  }, [title])
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
                  aria-label={item.label}
                  aria-current={item.id === activeSection ? 'page' : undefined}
                  onClick={() => onNavigate?.(item.id)}
                >
                  <NavIcon section={item.id} />
                  <span className="admin-nav-text">{item.label}</span>
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
            <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
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

export function applyAdminRoutePresentation(
  title: string,
  documentTarget: Pick<Document, 'title'>,
  heading: Pick<HTMLElement, 'focus'> | null,
  focusHeading = true,
) {
  documentTarget.title = `${title} | Manuel Academy Admin`
  if (focusHeading) heading?.focus()
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
          <StatusItem label="Observed at" metric={model.observedAt === null ? { status: 'unknown' } : { status: 'available', value: model.observedAt }} />
          <StatusItem label="Last successful refresh" metric={model.academy.lastSuccessfulDataRefresh} />
        </dl>
        <DomainStatus status={model.domainStatuses?.academy} />
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
        <DomainStatus status={model.domainStatuses?.learners} />
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
                    {model.enginePerformance?.find((value) => value.engineId === engine.engineId) && ` · Performance evidence: ${performanceEvidenceLabel(model.enginePerformance.find((value) => value.engineId === engine.engineId)!.evidenceState)}`}
                  </span>
                </div>
                <a href={`/academy/admin/engines/${engine.engineId}`} aria-label={`View ${ENGINE_LABELS[engine.engineId]} engine details`}>
                  <HealthBadge status={engine.health} /><span aria-hidden="true">›</span>
                </a>
              </li>
            ))}
          </ul>
          <DomainStatus status={model.domainStatuses?.engineHealth} />
          <DomainStatus status={model.domainStatuses?.enginePerformance} />
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
            {model.ai.reconciledSpend && <SpendMetric spend={model.ai.reconciledSpend} />}
          </div>
          <p className="admin-disclosure">
            {billingDispositionLabel(model.ai.spend.billingDisposition)}. {safeCompletenessMessage(model.ai.spend.completeness)}
            {safeCostReasonMessage(model.ai.spend.resultReasonCode) && ` ${safeCostReasonMessage(model.ai.spend.resultReasonCode)}`}
          </p>
          <p className="admin-disclosure">Calculated values are usage-derived estimates, not reconciled provider invoices.</p>
          {model.ai.monthlyCostAlert?.activeCritical && (
            <p className="admin-disclosure" role="alert">
              <strong>Critical monthly cost alert active.</strong>{' '}
              The authoritative recorded usage-derived calculated cost has reached the configured critical alert threshold.
              This operational alert does not shut down or reroute providers.
            </p>
          )}
          {model.ai.providerAccounting && (
            <p className="admin-disclosure">
              <strong>Provider accounting:</strong>{' '}
              {model.ai.providerAccounting.status === 'complete_for_journaled_attempts'
                ? 'Complete for currently journaled/instrumented provider-attempt paths'
                : model.ai.providerAccounting.status === 'partial'
                  ? 'Partial'
                  : model.ai.providerAccounting.status.replaceAll('_', ' ')}.
              {' '}Journal: {model.ai.providerAccounting.journalStatus.replaceAll('_', ' ')}.
              {' '}Instrumentation: {model.ai.providerAccounting.providerInstrumentation.engines
                .map((engine) => `${ENGINE_LABELS[engine.key]} ${engine.status}`)
                .join('; ')}.
              {' '}This does not establish provider-bill completeness.
            </p>
          )}
          <DomainStatus status={model.domainStatuses?.costs} />
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
          <DomainStatus status={model.domainStatuses?.safety} />
        </section>
        <section className="admin-panel" aria-labelledby="system-title">
          <SectionHeading id="system-title" eyebrow="Platform signals" title="System" />
          <div className="admin-compact-metrics">
            <CompactMetric label="API error rate" metric={model.system.apiErrorRatePercent} formatter={(value) => `${value.toFixed(2)}%`} />
            <CompactMetric label="Median latency" metric={model.system.latencyMs} suffix=" ms" />
            <CompactMetric label="Sync failures" metric={model.system.syncFailures} />
            <CompactMetric label="Persistence failures" metric={model.system.persistenceFailures} />
          </div>
          <DomainStatus status={model.domainStatuses?.system} />
        </section>
      </div>

      {model.curriculum && (
        <section className="admin-status-panel" aria-labelledby="curriculum-overview-title">
          <SectionHeading id="curriculum-overview-title" eyebrow="Published evidence" title="Curriculum" />
          <dl className="admin-status-grid">
            <StatusItem label="Published version" metric={model.curriculum.publishedVersion} />
            <StatusItem label="Validation state" metric={model.curriculum.validationState} />
            <StatusItem label="Validated at" metric={model.curriculum.validatedAt} />
            <StatusItem label="Validation artifact" metric={model.curriculum.validationArtifactVersion} />
            <StatusItem label="Coverage warning" metric={model.curriculum.coverageWarning} />
          </dl>
          <DomainStatus status={model.domainStatuses?.curriculum} />
        </section>
      )}
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

function DomainStatus({ status }: { status?: OverviewDomainStatus }) {
  if (!status || (status.observationStatus === 'current' && status.completeness === 'complete')) return null
  const label = status.observationStatus === 'unavailable'
    ? 'Unavailable'
    : status.completeness === 'truncated'
      ? 'Truncated'
      : status.observationStatus === 'partial'
        ? 'Partial'
        : status.observationStatus === 'stale'
          ? 'Stale'
          : 'Unknown'
  return <p className="admin-disclosure" role="status"><strong>{label}:</strong> {status.windowLabel}</p>
}

function performanceEvidenceLabel(state: NonNullable<AdminOverviewModel['enginePerformance']>[number]['evidenceState']): string {
  if (state === 'insufficient_evidence') return 'insufficient evidence'
  return state
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
  const label = spend.status !== 'available' ? 'Provider cost' : spend.costKind === 'reconciled' ? 'Reconciled provider cost' : 'Calculated provider cost (estimate)'
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
    attention: '!', overview: '⌂', learners: '◉', engines: '◇', costs: '✦', curriculum: '▤',
    safety: '◆', 'system-health': '⌁', configuration: '⚙', 'audit-log': '≡', access: '⌘', releases: '↑',
  }
  return <span className="admin-nav-icon" aria-hidden="true">{icons[section]}</span>
}
