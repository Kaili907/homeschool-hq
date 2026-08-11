import { useState } from 'react'
import {
  ADMIN_ENGINE_IDS,
  DEFAULT_SAFETY_EVENT_FILTER,
  buildSafetyOperationsModel,
  canonicalSafetyReasonCode,
  filterSafetyOperationsEvents,
  hasSafetyReadGrant,
  safeSafetyReasonMessage,
  type AdminSafetyReadAuthorization,
  type SafetyCountMetric,
  type SafetyEventFilter,
  type SafetyEventState,
  type SafetyEvidenceCategory,
  type SafetyEvidenceSource,
  type SafetyOperationsReadState,
  type SafetyResolutionState,
} from '../../admin/safetyOperationsModel'
import './admin-safety-operations.css'

export interface AdminSafetyOperationsProps {
  readonly authorization: AdminSafetyReadAuthorization
  readonly readState: SafetyOperationsReadState
  readonly onRetry?: () => void
}

const STATE_LABELS: Record<SafetyEventState, string> = {
  open: 'Open',
  resolved: 'Resolved',
  'pending-review': 'Pending adult review',
  'fail-closed': 'Failed closed',
  rejected: 'Rejected',
  unknown: 'Unknown',
}

const RESOLUTION_LABELS: Record<SafetyResolutionState, string> = {
  unresolved: 'Unresolved',
  'pending-adult-review': 'Pending adult review',
  resolved: 'Resolved',
  'not-applicable': 'Not applicable',
  unknown: 'Unknown',
}

const CATEGORY_LABELS: Record<SafetyEvidenceCategory, string> = {
  'safety-stop': 'Safety stop',
  'adult-review': 'Adult review',
  'fail-closed': 'Fail-closed safeguard',
  'fallback-rejection': 'Fallback or rejection',
}

const SOURCE_LABELS: Record<SafetyEvidenceSource, string> = {
  'study-safety-stops': 'Study safety stops',
  'study-adult-review': 'Adult-review operations',
  'study-safety-monitoring': 'Study safety monitoring',
  'operational-telemetry': 'Admin operational telemetry',
}

export function AdminSafetyOperations({ authorization, readState, onRetry }: AdminSafetyOperationsProps) {
  if (authorization.status === 'resolving') return <SafetyAuthorizationGate resolving />
  if (!hasSafetyReadGrant(authorization)) return <SafetyAuthorizationGate resolving={false} />
  if (readState.status === 'loading') return <SafetyLoading />
  if (readState.status === 'unavailable') return <SafetyUnavailable onRetry={onRetry} />
  return <AuthorizedSafetyOperations readState={readState} />
}

function SafetyAuthorizationGate({ resolving }: { resolving: boolean }) {
  return (
    <div className="safety-ops-gate" aria-busy={resolving}>
      <section aria-live="polite" aria-labelledby="safety-access-title">
        <p className="safety-ops-eyebrow">Safety operations</p>
        <h2 id="safety-access-title">{resolving ? 'Verifying safety access' : 'Safety data unavailable'}</h2>
        <p>{resolving
          ? 'Safety evidence remains hidden until the canonical administrator read capability is confirmed.'
          : 'The canonical safety read capability is required. Household guardian membership does not grant Admin access.'}</p>
        {!resolving && <a href="/academy">Back to Academy</a>}
      </section>
    </div>
  )
}

function SafetyLoading() {
  return (
    <div className="safety-ops-state" aria-busy="true" aria-live="polite">
      <p className="safety-ops-eyebrow">Safety operations</p>
      <h2>Loading authorized safety evidence</h2>
    </div>
  )
}

function SafetyUnavailable({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="safety-ops-state" role="alert">
      <p className="safety-ops-eyebrow">Safety operations</p>
      <h2>Safety evidence is unavailable</h2>
      <p>No safety counts or event details are shown because the authorized read source could not be confirmed.</p>
      {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
    </div>
  )
}

function AuthorizedSafetyOperations({ readState }: { readState: Extract<SafetyOperationsReadState, { status: 'ready' }> }) {
  const [filter, setFilter] = useState<SafetyEventFilter>(DEFAULT_SAFETY_EVENT_FILTER)
  const model = buildSafetyOperationsModel(readState.snapshot)
  const visibleEvents = filterSafetyOperationsEvents(model.events, filter)
  const legitimateZero = model.events.length === 0
    && Object.values(model.summary).every((metric) => metric.status === 'available' && metric.value === 0)
    && model.sources.length > 0
    && model.sources.every((source) => source.status === 'available')

  return (
    <div className="safety-ops" id="admin-safety-surface">
      <header className="safety-ops-header">
        <div>
          <p className="safety-ops-eyebrow">Read-only operations</p>
          <h2>Safety</h2>
          <p>Centralized, data-minimized visibility into existing Study safety evidence.</p>
        </div>
        {model.observedAt && <p className="safety-ops-observed">Observed <time dateTime={model.observedAt}>{formatTime(model.observedAt)}</time></p>}
      </header>

      <section aria-labelledby="safety-summary-title">
        <div className="safety-ops-section-heading">
          <div><p>Current evidence</p><h2 id="safety-summary-title">Safety overview</h2></div>
          <span className="safety-ops-readonly">Read only</span>
        </div>
        <dl className="safety-ops-summary">
          <SummaryMetric label="Open safety stops" metric={model.summary.openSafetyStops} />
          <SummaryMetric label="Resolved safety stops" metric={model.summary.resolvedSafetyStops} />
          <SummaryMetric label="Adult review pending" metric={model.summary.adultReviewPending} />
          <SummaryMetric label="Fail-closed events" metric={model.summary.failClosedEvents} />
          <SummaryMetric label="Canonical safety stops" metric={model.summary.safetyStopEvents} />
          <SummaryMetric label="Fallback / rejection events" metric={model.summary.fallbackRejectionEvents} />
          <SummaryMetric label="Unresolved conditions" metric={model.summary.unresolvedSafetyConditions} />
        </dl>
      </section>

      <section className="safety-ops-sources" aria-labelledby="safety-sources-title">
        <div>
          <p className="safety-ops-eyebrow">Evidence coverage</p>
          <h2 id="safety-sources-title">Authoritative sources</h2>
        </div>
        <ul>
          {model.sources.map((source) => <li key={source.source}><span>{SOURCE_LABELS[source.source]}</span><strong className={`is-${source.status}`}>{source.status === 'available' ? 'Available' : 'Unavailable'}</strong></li>)}
        </ul>
        <p>Unavailable sources are never counted as zero. Only canonical safety evidence is projected.</p>
      </section>

      {readState.snapshot.page.nextCursor && (
        <p className="safety-ops-incomplete" role="status">More safety events exist beyond this bounded response. This page is incomplete; narrow the authorized query or continue from the server-provided pagination flow before drawing a complete-range conclusion.</p>
      )}
      <section id="safety-events-results" aria-labelledby="safety-events-title" aria-live="polite">
        <div className="safety-ops-section-heading safety-ops-events-heading">
          <div><p>Bounded records</p><h2 id="safety-events-title">Safety events</h2></div>
          <SafetyFilters filter={filter} onChange={setFilter} />
        </div>

        {legitimateZero ? (
          <div className="safety-ops-zero" role="status">
            <h3>No safety events in the authorized range</h3>
            <p>Available sources reported a legitimate zero state. Unavailable source coverage is listed above.</p>
          </div>
        ) : model.events.length === 0 ? (
          <div className="safety-ops-zero" role="status">
            <h3>No authorized event records are available</h3>
            <p>Review the source coverage and unavailable metrics above. Missing evidence is not treated as zero.</p>
          </div>
        ) : visibleEvents.length === 0 ? (
          <p className="safety-ops-zero" role="status">No safety events match the selected filters.</p>
        ) : (
          <div className="safety-ops-table-wrap">
            <table>
              <caption>Authorized, structured safety evidence. Raw conversation and backend error bodies are excluded.</caption>
              <thead><tr><th scope="col">Learner</th><th scope="col">Occurred</th><th scope="col">Engine</th><th scope="col">Evidence</th><th scope="col">State</th><th scope="col">Inspect</th></tr></thead>
              <tbody>{visibleEvents.map((event) => (
                <tr key={event.eventRef}>
                  <td><strong>{event.learner?.displayName ?? (event.learner ? 'Learner' : 'System')}</strong>{event.learner && <span>{event.learner.reference}</span>}</td>
                  <td><time dateTime={event.occurredAt}>{formatTime(event.occurredAt)}</time></td>
                  <td>{engineLabel(event.engine)}</td>
                  <td>{CATEGORY_LABELS[event.evidenceCategory]}</td>
                  <td><span className={`safety-ops-state-badge is-${event.state}`}>{STATE_LABELS[event.state]}</span></td>
                  <td><a href={`#safety-event-${event.eventRef}`}>View evidence</a></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        <div className="safety-ops-drilldowns">
          {visibleEvents.map((event) => {
            const reasonCode = canonicalSafetyReasonCode(event.reasonCode)
            return (
              <details id={`safety-event-${event.eventRef}`} key={event.eventRef}>
                <summary>{event.learner?.displayName ?? event.learner?.reference ?? 'System'} · {CATEGORY_LABELS[event.evidenceCategory]} · {STATE_LABELS[event.state]}</summary>
                <dl>
                  <Detail label="Event reference" value={event.eventRef} />
                  <Detail label="Evidence category" value={CATEGORY_LABELS[event.evidenceCategory]} />
                  <Detail label="Canonical reason code" value={reasonCode} code />
                  <Detail label="Safe presentation" value={safeSafetyReasonMessage(reasonCode)} />
                  <Detail label="Current state" value={STATE_LABELS[event.state]} />
                  {event.versionSnapshot && <>
                    <Detail label="App version" value={event.versionSnapshot.appVersion} />
                    <Detail label="Engine version" value={event.versionSnapshot.engineVersion} />
                    <Detail label="Curriculum version" value={event.versionSnapshot.curriculumVersion ?? 'Not applicable'} />
                  </>}
                  <Detail label="Resolution status" value={RESOLUTION_LABELS[event.resolution.state]} />
                  {event.resolution.resolvedAt && <Detail label="Resolved at" value={formatTime(event.resolution.resolvedAt)} />}
                  {event.resolution.authorizedAdultRef && <Detail label="Authorized adult reference" value={event.resolution.authorizedAdultRef} />}
                </dl>
                <h3>State history</h3>
                {event.history.length === 0 ? <p>No additional structured history is available.</p> : <ol>{event.history.map((entry, index) => (
                  <li key={`${entry.occurredAt}:${index}`}><time dateTime={entry.occurredAt}>{formatTime(entry.occurredAt)}</time><span>{STATE_LABELS[entry.state]}</span>{entry.reasonCode && <span>{safeSafetyReasonMessage(entry.reasonCode)}</span>}</li>
                ))}</ol>}
              </details>
            )
          })}
        </div>
      </section>

      <aside className="safety-ops-privacy" aria-label="Privacy boundary">
        <strong>Privacy boundary</strong>
        <p>This view excludes Tutor and Study conversation, audio, journal text, emotional labels, diagnostic inference, credentials, and arbitrary exception bodies.</p>
      </aside>
    </div>
  )
}

function SummaryMetric({ label, metric }: { label: string; metric: SafetyCountMetric }) {
  return <div className={metric.status === 'available' ? '' : 'is-unavailable'}><dt>{label}</dt><dd>{metric.status === 'available' ? metric.value.toLocaleString() : <><span aria-hidden="true">—</span> Unavailable</>}</dd></div>
}

function SafetyFilters({ filter, onChange }: { filter: SafetyEventFilter; onChange: (filter: SafetyEventFilter) => void }) {
  return (
    <fieldset className="safety-ops-filters" aria-controls="safety-events-results">
      <legend>Filter safety events</legend>
      <label>State<select value={filter.state} onChange={(event) => onChange({ ...filter, state: event.target.value as SafetyEventFilter['state'] })}>
        <option value="all">All states</option>{Object.entries(STATE_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select></label>
      <label>Engine<select value={filter.engine} onChange={(event) => onChange({ ...filter, engine: event.target.value as SafetyEventFilter['engine'] })}>
        <option value="all">All engines</option>{ADMIN_ENGINE_IDS.map((engine) => <option value={engine} key={engine}>{engineLabel(engine)}</option>)}
      </select></label>
      <label>Evidence<select value={filter.category} onChange={(event) => onChange({ ...filter, category: event.target.value as SafetyEventFilter['category'] })}>
        <option value="all">All evidence</option>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select></label>
    </fieldset>
  )
}

function Detail({ label, value, code = false }: { label: string; value: string; code?: boolean }) {
  return <div><dt>{label}</dt><dd>{code ? <code>{value}</code> : value}</dd></div>
}

function engineLabel(engine: (typeof ADMIN_ENGINE_IDS)[number]): string {
  return engine[0].toUpperCase() + engine.slice(1)
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value))
}
