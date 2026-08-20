import { useState } from 'react'
import { ADMIN_ENGINE_IDS, type AdminEngineId, type AdminHealthState } from '../../admin/contracts'
import type { ServerResolvedAdminAuthorization } from '../../admin/overviewModel'
import {
  SYSTEM_HEALTH_WINDOWS,
  type EngineHealthProjection,
  type HealthFreshness,
  type SystemHealthEvidenceCompleteness,
  type SystemHealthReasonCode,
  type SystemHealthWindow,
  type SystemIncidentReasonCode,
  type SystemServiceId,
} from '../../admin/systemHealth'
import type { SystemHealthReadState } from '../../admin/systemHealthClient'
import './system-health-dashboard.css'

interface SystemHealthDashboardProps {
  readonly authorization: ServerResolvedAdminAuthorization
  readonly readState: SystemHealthReadState
  readonly selectedWindow: SystemHealthWindow
  readonly onWindowChange: (window: SystemHealthWindow) => void
  readonly onRetry?: () => void
}

const ENGINE_LABELS: Readonly<Record<AdminEngineId, string>> = {
  tutor: 'Tutor', study: 'Study', assessment: 'Assessment', curriculum: 'Curriculum',
  jarvis: 'Jarvis', tts: 'TTS', gateway: 'Gateway', sync: 'Sync',
}
const HEALTH_LABELS: Readonly<Record<AdminHealthState, string>> = {
  healthy: 'Healthy', degraded: 'Degraded', unavailable: 'Unavailable',
  disabled: 'Disabled', unknown: 'Unknown',
}
const WINDOW_LABELS: Readonly<Record<SystemHealthWindow, string>> = {
  '1h': 'Last hour', today: 'Today (UTC)', '24h': '24 hours', '7d': '7 days',
}
const SERVICE_LABELS: Readonly<Record<SystemServiceId | 'academy_engine', string>> = {
  admin_api: 'Admin API', persistence: 'Supabase / persistence',
  anthropic_gateway: 'Anthropic gateway', tts_gateway: 'ElevenLabs / TTS gateway',
  sync: 'Sync', curriculum_read: 'Curriculum read service', academy_engine: 'Academy engine',
}
const REASON_MESSAGES: Readonly<Record<SystemHealthReasonCode, string>> = {
  operating_normally: 'Current evidence meets the declared service objectives.',
  feature_disabled: 'Deliberately disabled by approved server configuration.',
  no_evidence: 'No trusted operational evidence is available.',
  stale_evidence: 'The most recent evidence is older than the freshness objective.',
  insufficient_volume: 'Too few eligible observations exist for a trustworthy rate.',
  telemetry_incomplete: 'The bounded telemetry source is incomplete, so health is unknown.',
  elevated_failure_rate: 'The bounded core-failure rate is elevated.',
  elevated_timeout_rate: 'The bounded timeout rate is elevated.',
  elevated_provider_error_rate: 'The bounded provider-error rate is elevated.',
  elevated_fallback_rate: 'The bounded fallback rate is elevated.',
  elevated_latency: 'Worst grouped P95 latency exceeds the declared objective.',
  core_operation_unavailable: 'Recent evidence indicates the core operation cannot serve reliably.',
  safety_policy_working: 'Safety stops were observed without treating policy enforcement as a service failure.',
}
const INCIDENT_MESSAGES: Readonly<Record<SystemIncidentReasonCode, string>> = {
  fallback_used: 'A documented fallback path was used.',
  request_timeout: 'A bounded operation timed out.',
  provider_timeout: 'A provider did not return a reliable result before timeout.',
  provider_failure: 'A provider operation failed.',
  validation_failed: 'An operational contract or integrity check failed.',
  persistence_failed: 'A persistence operation failed.',
  sync_failed: 'A sync operation failed.',
  operational_detail_unavailable: 'Additional operational detail is unavailable.',
}
const EVIDENCE_MESSAGES: Readonly<Record<Exclude<SystemHealthEvidenceCompleteness, 'complete'>, {
  readonly title: string
  readonly message: string
}>> = {
  partial: {
    title: 'Partial aggregate evidence',
    message: 'One or more required health windows could not be established, so health remains unknown.',
  },
  retention_limited: {
    title: 'Retention-limited evidence',
    message: 'The requested evidence is not complete across every declared retention class, so health remains unknown.',
  },
  malformed: {
    title: 'Malformed aggregate evidence',
    message: 'The aggregate contract failed validation, so no health conclusion is shown.',
  },
  unavailable: {
    title: 'Aggregate evidence unavailable',
    message: 'The trusted aggregate source could not be reached, so health remains unknown.',
  },
  timeout: {
    title: 'Aggregate evidence timed out',
    message: 'The trusted aggregate source did not complete within its bound, so health remains unknown.',
  },
  group_incomplete: {
    title: 'Aggregate groups incomplete',
    message: 'The declared group bound or returned group set was incomplete, so health remains unknown.',
  },
}

function hasHealthRead(authorization: ServerResolvedAdminAuthorization): boolean {
  return authorization.status === 'authorized' && authorization.capabilities.includes('health:read')
}

export function SystemHealthDashboard(props: SystemHealthDashboardProps) {
  if (props.authorization.status === 'resolving') {
    return <HealthAccessState busy title="Verifying health access" message="Health evidence remains private until authorization is confirmed." />
  }
  if (!hasHealthRead(props.authorization) || props.readState.status === 'denied') {
    return <HealthAccessState title="System Health unavailable" message="The canonical health:read capability is required. Guardian access does not grant this permission." />
  }
  if (props.readState.status === 'loading') return <HealthLoading />
  if (props.readState.status === 'error') {
    return (
      <HealthAccessState
        title="Health evidence unavailable"
        message={props.readState.code === 'health_timeout'
          ? 'The authorized health projection timed out.'
          : 'The authorized health projection could not be loaded.'}
        onRetry={props.onRetry}
      />
    )
  }
  return (
    <HealthReady
      projection={props.readState.projection}
      selectedWindow={props.selectedWindow}
      onWindowChange={props.onWindowChange}
    />
  )
}

function HealthAccessState({ busy = false, title, message, onRetry }: { busy?: boolean; title: string; message: string; onRetry?: () => void }) {
  return (
    <div className="health-state" aria-busy={busy} aria-live="polite" role={busy ? 'status' : 'alert'}>
      <p className="health-state__eyebrow">System operations</p>
      <span className={`health-state__glyph ${busy ? 'is-loading' : ''}`} aria-hidden="true">{busy ? '' : '!'}</span>
      <h2>{title}</h2><p>{message}</p>
      {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
      {!busy && <a href="/academy">Back to Academy</a>}
    </div>
  )
}

function HealthLoading() {
  return (
    <div className="health-dashboard" aria-busy="true" aria-live="polite">
      <span className="health-sr-only">Loading System Health</span>
      <div className="health-skeleton health-skeleton--hero" />
      <div className="health-skeleton-grid">{ADMIN_ENGINE_IDS.map((engine) => <div className="health-skeleton" key={engine} />)}</div>
    </div>
  )
}

function HealthReady({ projection, selectedWindow, onWindowChange }: {
  projection: Extract<SystemHealthReadState, { status: 'ready' }>['projection']
  selectedWindow: SystemHealthWindow
  onWindowChange: (window: SystemHealthWindow) => void
}) {
  const [selectedEngine, setSelectedEngine] = useState<AdminEngineId>('tutor')
  const detail = projection.engines.find((engine) => engine.engineId === selectedEngine) ?? projection.engines[0]
  const incompleteEvidence = projection.evidenceCompleteness === 'complete'
    ? null
    : EVIDENCE_MESSAGES[projection.evidenceCompleteness]

  return (
    <div className="health-dashboard" aria-labelledby="system-health-title">
      <header className="health-heading">
        <div><p>Read-only operations</p><h2 id="system-health-title">System Health</h2><span>Deterministic status from bounded trusted telemetry.</span></div>
        <div className="health-window" role="group" aria-label="System Health history window">
          {SYSTEM_HEALTH_WINDOWS.map((window) => <button key={window} type="button" aria-pressed={selectedWindow === window} className={selectedWindow === window ? 'is-active' : ''} onClick={() => onWindowChange(window)}>{WINDOW_LABELS[window]}</button>)}
        </div>
        <p className="health-window-explanation">Overall Health and each primary engine status always use the most recent one-hour evaluation. These controls change only the history summaries and incident list below.</p>
      </header>

      {incompleteEvidence && (
        <div className="health-banner" role="status"><strong>{incompleteEvidence.title}</strong><span>{incompleteEvidence.message}</span></div>
      )}

      <section className="health-overall" aria-labelledby="overall-health-title">
        <div>
          <p>Academy health</p><h2 id="overall-health-title"><HealthBadge health={projection.overallHealth} /></h2>
          <p className="health-reason">{projection.overallReasonCodes.map(safeReason).join(' ')}</p>
        </div>
        <dl>
          <Metric label="Evidence observed" value={projection.observedAt ?? 'No evidence'} />
          <Metric label="Projection generated" value={projection.generatedAt} />
          <Metric label="Freshness" value={freshnessLabel(projection.freshness)} />
          <Metric label="Failure trend" value={trendLabel(projection.failureTrend)} />
          <Metric label="Current failures" value={projection.currentFailureCount} />
          <Metric label="Previous period" value={projection.previousFailureCount} />
        </dl>
      </section>

      <section aria-labelledby="engine-grid-title">
        <SectionTitle eyebrow="Primary one-hour evaluation" title="Eight canonical engines" id="engine-grid-title" />
        <div className="health-engine-grid">
          {projection.engines.map((engine) => (
            <button key={engine.engineId} type="button" aria-controls="health-engine-detail" aria-pressed={selectedEngine === engine.engineId} onClick={() => setSelectedEngine(engine.engineId)}>
              <span><strong>{ENGINE_LABELS[engine.engineId]}</strong><small>{freshnessLabel(engine.freshness)} · {engine.eventCount} events</small></span>
              <HealthBadge health={engine.health} />
            </button>
          ))}
        </div>
      </section>

      <section id="health-engine-detail" className="health-detail" aria-labelledby="engine-detail-title" aria-live="polite">
        <SectionTitle eyebrow="Engine drilldown" title={ENGINE_LABELS[detail.engineId]} id="engine-detail-title" />
        <div className="health-detail__status"><HealthBadge health={detail.health} /><span>{detail.reasonCodes.map(safeReason).join(' ')}</span></div>
        <dl className="health-metrics">
          <Metric label="Observed at" value={detail.observedAt ?? 'No evidence'} />
          <Metric label="Evaluation window" value={`${detail.windowStart} – ${detail.windowEnd}`} />
          <Metric label="App version" value={detail.appVersion ?? 'Unknown'} />
          <Metric label="Engine version" value={detail.engineVersion ?? 'Unknown'} />
          <Metric label="Curriculum version" value={detail.curriculumVersion ?? 'Unknown'} />
          <Metric label="Events" value={detail.eventCount} />
          <Metric label="Success" value={countRate(detail.successCount, detail.successRatePercent)} />
          <Metric label="Fallback" value={countRate(detail.fallbackCount, detail.fallbackRatePercent)} />
          <Metric label="Timeout" value={countRate(detail.timeoutCount, detail.timeoutRatePercent)} />
          <Metric label="Provider error" value={countRate(detail.providerErrorCount, detail.providerErrorRatePercent)} />
          <Metric label="Rejected (excluded from health failures)" value={detail.rejectedCount} />
          <Metric label="Safety stops (not infrastructure failures)" value={detail.safetyStopCount} />
          <Metric label="Worst grouped P50 latency" value={latency(detail.p50LatencyMs)} />
          <Metric label="Worst grouped P95 latency" value={latency(detail.p95LatencyMs)} />
        </dl>
      </section>

      <section aria-labelledby="service-health-title">
        <SectionTitle eyebrow="Trusted service signals" title="System and service health" id="service-health-title" />
        <div className="health-service-grid">
          {projection.services.map((service) => (
            <article key={service.serviceId}>
              <div><strong>{SERVICE_LABELS[service.serviceId]}</strong><HealthBadge health={service.health} /></div>
              <p>{service.reasonCodes.map(safeReason).join(' ')}</p>
              <dl><Metric label="Events" value={service.eventCount} /><Metric label="Failures" value={service.failureCount} /><Metric label="Worst grouped P95" value={latency(service.p95LatencyMs)} /></dl>
            </article>
          ))}
        </div>
      </section>

      <section className="health-summary" aria-labelledby="health-summary-title">
        <SectionTitle eyebrow={WINDOW_LABELS[projection.selectedWindow]} title="Latency and failure summary" id="health-summary-title" />
        <dl className="health-summary__metrics">
          <Metric label="Timeouts" value={countRate(projection.historyMetrics.timeoutCount, projection.historyMetrics.timeoutRatePercent)} />
          <Metric label="Provider errors" value={countRate(projection.historyMetrics.providerErrorCount, projection.historyMetrics.providerErrorRatePercent)} />
          <Metric label="Fallbacks" value={countRate(projection.historyMetrics.fallbackCount, projection.historyMetrics.fallbackRatePercent)} />
          <Metric label="Represented events" value={projection.historyMetrics.eventCount} />
          <Metric label="Worst grouped P50 latency" value={latency(projection.historyMetrics.p50LatencyMs)} />
          <Metric label="Worst grouped P95 latency" value={latency(projection.historyMetrics.p95LatencyMs)} />
        </dl>
      </section>

      <section className="health-incidents" aria-labelledby="recent-incidents-title">
        <SectionTitle eyebrow={WINDOW_LABELS[projection.selectedWindow]} title="Recent degradation evidence" id="recent-incidents-title" />
        {projection.incidents.length === 0
          ? <p className="health-empty">No failure or fallback evidence is present in this bounded window. This does not by itself prove health.</p>
          : <ol>{projection.incidents.map((incident, index) => (
            <li key={`${incident.occurredAt}-${incident.engineId}-${index}`}>
              <time dateTime={incident.occurredAt}>{incident.occurredAt}</time>
              <strong>{ENGINE_LABELS[incident.engineId]} · {SERVICE_LABELS[incident.serviceId]}</strong>
              <span>{INCIDENT_MESSAGES[incident.reasonCode] ?? INCIDENT_MESSAGES.operational_detail_unavailable}</span>
            </li>
          ))}</ol>}
      </section>
    </div>
  )
}

function SectionTitle({ eyebrow, title, id }: { eyebrow: string; title: string; id: string }) {
  return <header className="health-section-title"><p>{eyebrow}</p><h2 id={id}>{title}</h2></header>
}

function Metric({ label, value }: { label: string; value: string | number | null }) {
  return <div><dt>{label}</dt><dd>{value === null ? 'Unknown' : value}</dd></div>
}

function HealthBadge({ health }: { health: AdminHealthState }) {
  const glyph = health === 'healthy' ? '✓' : health === 'degraded' ? '!' : health === 'unavailable' ? '×' : health === 'disabled' ? '–' : '?'
  return <span className={`health-badge health-badge--${health}`}><span aria-hidden="true">{glyph}</span>{HEALTH_LABELS[health]}</span>
}

function safeReason(reason: SystemHealthReasonCode): string {
  return REASON_MESSAGES[reason] ?? 'Additional operational detail is unavailable.'
}

function freshnessLabel(freshness: HealthFreshness): string {
  return freshness === 'current' ? 'Current evidence' : freshness === 'stale' ? 'Stale evidence' : 'No evidence'
}

function trendLabel(trend: 'increasing' | 'stable' | 'decreasing' | 'unknown'): string {
  if (trend === 'increasing') return 'Failures increasing'
  if (trend === 'decreasing') return 'Failures decreasing'
  if (trend === 'stable') return 'Failures stable'
  return 'Unknown — insufficient evidence'
}

function countRate(count: number, rate: number | null): string {
  return rate === null ? `${count} · rate unknown` : `${count} · ${rate.toFixed(1)}%`
}

function latency(value: number | null): string {
  return value === null ? 'Unknown — insufficient samples' : `${value} ms`
}
