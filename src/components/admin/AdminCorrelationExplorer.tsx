import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import {
  ADMIN_AUDIT_ACTIONS,
  ADMIN_AUDIT_RESOURCE_TYPES,
  ADMIN_ENGINE_IDS,
  ADMIN_OPERATIONAL_RESULTS,
  type AdminAuditAction,
  type AdminAuditResourceType,
  type AdminAuditValue,
  type AdminEngineId,
  type AdminOperationalResult,
} from '../../admin/contracts'
import {
  ADMIN_INCIDENT_DOMAINS,
  type AdminIncidentDomain,
  type AdminIncidentEvent,
  type AdminIncidentFilters,
  type AdminIncidentPage,
  type AdminIncidentReadState,
  type AdminIncidentSource,
} from '../../admin/incidentExplorerModel'
import './admin-correlation-explorer.css'

const SOURCE_LABELS: Readonly<Record<AdminIncidentSource, string>> = {
  runtime: 'Runtime event',
  'admin-audit': 'Admin audit',
  'provider-accounting': 'Provider accounting',
}

const DOMAIN_LABELS: Readonly<Record<AdminIncidentDomain, string>> = {
  all: 'All authorized sources',
  runtime: 'Runtime telemetry',
  'admin-audit': 'Admin audit',
  'provider-accounting': 'Provider accounting',
}

const REASON_MESSAGES: Readonly<Record<AdminIncidentPage['evidence']['reasons'][number], string>> = {
  runtime_unauthorized: 'Runtime evidence was omitted because this session lacks engine read access.',
  runtime_unavailable: 'Runtime evidence is temporarily unavailable.',
  runtime_timeout: 'Runtime evidence did not respond within the bounded read window.',
  runtime_malformed_entries: 'One or more malformed runtime entries were rejected.',
  runtime_retention_limited: 'The selected range extends beyond complete ordinary runtime retention.',
  admin_audit_unauthorized: 'Admin audit evidence was omitted because this session lacks audit read access.',
  admin_audit_unavailable: 'Admin audit evidence is temporarily unavailable.',
  admin_audit_timeout: 'Admin audit evidence did not respond within the bounded read window.',
  admin_audit_malformed_entries: 'One or more malformed Admin audit entries were rejected.',
  provider_accounting_unauthorized: 'Provider accounting evidence was omitted because this session lacks cost read access.',
  provider_accounting_unavailable: 'Provider accounting evidence is temporarily unavailable.',
  provider_accounting_timeout: 'Provider accounting evidence did not respond within the bounded read window.',
  provider_accounting_malformed_entries: 'One or more malformed provider accounting entries were rejected.',
}

interface Props {
  readonly authorized: boolean
  readonly state: AdminIncidentReadState
  readonly filters: AdminIncidentFilters
  readonly pageNumber: number
  readonly canGoBack: boolean
  readonly onFiltersChange: (filters: AdminIncidentFilters) => void
  readonly onNext: (cursor: string) => void
  readonly onPrevious: () => void
  readonly onRetry: () => void
}

function localDateTime(iso: string) {
  const date = new Date(iso)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function instant(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function label(value: string) {
  return value.replaceAll('_', ' ').replaceAll('.', ' · ').replaceAll('-', ' ')
}

function eventTitle(event: AdminIncidentEvent) {
  if (event.source === 'runtime') return `${label(event.facts.eventType)} · ${label(event.facts.result)}`
  if (event.source === 'admin-audit') return `${label(event.facts.action)} · ${label(event.facts.resourceType)}`
  return `${label(event.facts.provider)} · ${label(event.facts.costKind)} accounting`
}

export function AdminCorrelationExplorer({
  authorized,
  state,
  filters,
  pageNumber,
  canGoBack,
  onFiltersChange,
  onNext,
  onPrevious,
  onRetry,
}: Props) {
  const [selected, setSelected] = useState<AdminIncidentEvent | null>(null)
  const openerRef = useRef<HTMLButtonElement | null>(null)

  if (!authorized || state.status === 'unauthorized') {
    return <ExplorerState title="Incident evidence unavailable" copy="This session has no authorized operational evidence source." />
  }
  if (state.status === 'loading') {
    return <section className="admin-incident-state" aria-busy="true" aria-live="polite"><p>Loading bounded incident evidence…</p></section>
  }
  if (state.status === 'error') {
    const copy = state.code === 'invalid_query'
      ? 'The filters did not define a safe bounded query.'
      : state.code === 'incident_timeout'
        ? 'The incident sources did not respond in time.'
        : state.code === 'incident_malformed'
          ? 'The server response did not match the safe incident contract.'
          : 'Incident evidence is temporarily unavailable.'
    return <ExplorerState title="Incident search unavailable" copy={copy} action="Try again" onAction={onRetry} />
  }

  const page = state.page
  return (
    <section className="admin-incident-explorer" aria-labelledby="incident-explorer-heading">
      <div className="admin-incident-intro">
        <div>
          <p className="admin-eyebrow">Privacy-minimized operations</p>
          <h2 id="incident-explorer-heading">Correlation and incident explorer</h2>
          <p>Follow allowlisted operational facts across independently authorized sources. This is not a raw log viewer.</p>
        </div>
        <span className="admin-incident-readonly">Read only</span>
      </div>

      <IncidentFilters filters={filters} onApply={onFiltersChange} />

      <SourceStatus sources={page.sources} />
      {page.evidence.status === 'partial' && (
        <section className="admin-incident-partial" role="status" aria-label="Partial incident evidence">
          <div><strong>Partial evidence</strong><span>The available timeline may not represent every authorized source or retained event.</span></div>
          <ul>{page.evidence.reasons.map((reason) => <li key={reason}>{REASON_MESSAGES[reason]}</li>)}</ul>
        </section>
      )}

      <div className="admin-incident-results" aria-busy={state.status === 'loading-page'}>
        <div className="admin-incident-results__heading">
          <div>
            <p className="admin-eyebrow">Chronological timeline</p>
            <h3>{page.events.length === 0 ? 'No matching evidence' : `${page.events.length} safe event${page.events.length === 1 ? '' : 's'}`}</h3>
          </div>
          <span>Page {pageNumber}</span>
        </div>

        {page.events.length === 0 ? (
          <div className="admin-incident-empty" role="status">
            <strong>No safe operational evidence matched</strong>
            <p>Check the correlation ID and time bounds, or broaden only the source filters you are authorized to use.</p>
          </div>
        ) : (
          <ol className="admin-incident-timeline" aria-label="Incident evidence timeline">
            {page.events.map((event) => (
              <li key={`${event.source}:${event.eventId}`}>
                <span className={`admin-incident-marker admin-incident-marker--${event.source}`} aria-hidden="true" />
                <article>
                  <div className="admin-incident-event__topline">
                    <SourceBadge source={event.source} />
                    <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString()}</time>
                  </div>
                  <h4>{eventTitle(event)}</h4>
                  <div className="admin-incident-event__correlation">
                    <code>{event.correlationId}</code>
                    <CopyCorrelation value={event.correlationId} />
                  </div>
                  <button
                    type="button"
                    className="admin-incident-detail-button"
                    onClick={(click) => {
                      openerRef.current = click.currentTarget
                      setSelected(event)
                    }}
                    aria-haspopup="dialog"
                  >View bounded details</button>
                </article>
              </li>
            ))}
          </ol>
        )}
      </div>

      <nav className="admin-incident-pagination" aria-label="Incident timeline pages">
        <button type="button" disabled={!canGoBack || state.status === 'loading-page'} onClick={onPrevious}>Newer page</button>
        <button
          type="button"
          disabled={!page.nextCursor || state.status === 'loading-page'}
          onClick={() => page.nextCursor && onNext(page.nextCursor)}
        >Older page</button>
      </nav>

      {selected && <IncidentDrawer event={selected} onClose={() => {
        setSelected(null)
        globalThis.setTimeout(() => openerRef.current?.focus(), 0)
      }} />}
    </section>
  )
}

function IncidentFilters({ filters, onApply }: {
  readonly filters: AdminIncidentFilters
  readonly onApply: (filters: AdminIncidentFilters) => void
}) {
  const correlationId = useId()
  const errorId = useId()
  const [draft, setDraft] = useState(() => ({
    correlationId: filters.correlationId ?? '',
    occurredFrom: localDateTime(filters.occurredFrom),
    occurredTo: localDateTime(filters.occurredTo),
    domain: filters.domain,
    engine: filters.engine ?? '',
    result: filters.result ?? '',
    auditAction: filters.auditAction ?? '',
    auditResource: filters.auditResource ?? '',
    limit: String(filters.limit),
  }))
  const [error, setError] = useState<string | null>(null)

  return (
    <form className="admin-incident-filters" onSubmit={(event) => {
      event.preventDefault()
      const occurredFrom = instant(draft.occurredFrom)
      const occurredTo = instant(draft.occurredTo)
      if (!occurredFrom || !occurredTo || occurredFrom >= occurredTo) {
        setError('Choose a start time before the end time.')
        return
      }
      setError(null)
      onApply({
        ...(draft.correlationId.trim() ? { correlationId: draft.correlationId.trim() } : {}),
        occurredFrom,
        occurredTo,
        domain: draft.domain,
        ...(draft.engine ? { engine: draft.engine as AdminEngineId } : {}),
        ...(draft.result ? { result: draft.result as AdminOperationalResult } : {}),
        ...(draft.auditAction ? { auditAction: draft.auditAction as AdminAuditAction } : {}),
        ...(draft.auditResource ? { auditResource: draft.auditResource as AdminAuditResourceType } : {}),
        limit: Number(draft.limit),
      })
    }}>
      <div className="admin-incident-filter admin-incident-filter--correlation">
        <label htmlFor={correlationId}>Correlation ID</label>
        <input
          id={correlationId}
          value={draft.correlationId}
          onChange={(event) => setDraft({ ...draft, correlationId: event.target.value })}
          maxLength={128}
          autoComplete="off"
          spellCheck={false}
          placeholder="Trusted request or audit correlation ID"
          aria-describedby={error ? errorId : undefined}
        />
      </div>
      <FilterSelect label="Source domain" value={draft.domain} onChange={(domain) => setDraft({ ...draft, domain: domain as AdminIncidentDomain })}>
        {ADMIN_INCIDENT_DOMAINS.map((domain) => <option key={domain} value={domain}>{DOMAIN_LABELS[domain]}</option>)}
      </FilterSelect>
      <FilterInput label="From" type="datetime-local" value={draft.occurredFrom} onChange={(occurredFrom) => setDraft({ ...draft, occurredFrom })} />
      <FilterInput label="To" type="datetime-local" value={draft.occurredTo} onChange={(occurredTo) => setDraft({ ...draft, occurredTo })} />
      <FilterSelect label="Engine" value={draft.engine} onChange={(engine) => setDraft({ ...draft, engine })} disabled={draft.domain === 'admin-audit'}>
        <option value="">All engines</option>
        {ADMIN_ENGINE_IDS.map((engine) => <option key={engine} value={engine}>{label(engine)}</option>)}
      </FilterSelect>
      <FilterSelect label="Result" value={draft.result} onChange={(result) => setDraft({ ...draft, result })} disabled={draft.domain === 'admin-audit'}>
        <option value="">All results</option>
        {ADMIN_OPERATIONAL_RESULTS.map((result) => <option key={result} value={result}>{label(result)}</option>)}
      </FilterSelect>
      <FilterSelect label="Audit action" value={draft.auditAction} onChange={(auditAction) => setDraft({ ...draft, auditAction })} disabled={draft.domain === 'runtime' || draft.domain === 'provider-accounting'}>
        <option value="">All actions</option>
        {ADMIN_AUDIT_ACTIONS.map((action) => <option key={action} value={action}>{label(action)}</option>)}
      </FilterSelect>
      <FilterSelect label="Audit resource" value={draft.auditResource} onChange={(auditResource) => setDraft({ ...draft, auditResource })} disabled={draft.domain === 'runtime' || draft.domain === 'provider-accounting'}>
        <option value="">All resources</option>
        {ADMIN_AUDIT_RESOURCE_TYPES.map((resource) => <option key={resource} value={resource}>{label(resource)}</option>)}
      </FilterSelect>
      <FilterSelect label="Page size" value={draft.limit} onChange={(limit) => setDraft({ ...draft, limit })}>
        {[25, 50, 100].map((limit) => <option key={limit} value={limit}>{limit}</option>)}
      </FilterSelect>
      <button className="admin-incident-search" type="submit">Search evidence</button>
      {error && <p id={errorId} className="admin-incident-filter-error" role="alert">{error}</p>}
    </form>
  )
}

function FilterInput({ label: fieldLabel, type, value, onChange }: {
  readonly label: string
  readonly type: string
  readonly value: string
  readonly onChange: (value: string) => void
}) {
  const id = useId()
  return <div className="admin-incident-filter"><label htmlFor={id}>{fieldLabel}</label><input id={id} type={type} value={value} required onChange={(event) => onChange(event.target.value)} /></div>
}

function FilterSelect({ label: fieldLabel, value, onChange, disabled = false, children }: {
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly disabled?: boolean
  readonly children: ReactNode
}) {
  const id = useId()
  return <div className="admin-incident-filter"><label htmlFor={id}>{fieldLabel}</label><select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{children}</select></div>
}

function SourceStatus({ sources }: { readonly sources: AdminIncidentPage['sources'] }) {
  return (
    <ul className="admin-incident-sources" aria-label="Incident source availability">
      {(Object.keys(SOURCE_LABELS) as AdminIncidentSource[]).map((source) => (
        <li key={source} className={`is-${sources[source]}`}>
          <span aria-hidden="true" />
          <strong>{SOURCE_LABELS[source]}</strong>
          <small>{label(sources[source])}</small>
        </li>
      ))}
    </ul>
  )
}

function SourceBadge({ source }: { readonly source: AdminIncidentSource }) {
  return <span className={`admin-incident-badge admin-incident-badge--${source}`}>{SOURCE_LABELS[source]}</span>
}

function CopyCorrelation({ value }: { readonly value: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  return (
    <button type="button" onClick={async () => {
      try {
        await navigator.clipboard.writeText(value)
        setStatus('copied')
      } catch {
        setStatus('failed')
      }
    }} aria-label={`Copy correlation ID ${value}`}>
      {status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy unavailable' : 'Copy ID'}
    </button>
  )
}

export function IncidentDrawer({ event, onClose }: { readonly event: AdminIncidentEvent; readonly onClose: () => void }) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const keydown = (key: KeyboardEvent) => {
      if (key.key === 'Escape') onClose()
      if (key.key === 'Tab') {
        key.preventDefault()
        closeRef.current?.focus()
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [onClose])
  return (
    <div className="admin-incident-drawer-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
      <aside className="admin-incident-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header>
          <div><SourceBadge source={event.source} /><h2 id={titleId}>{eventTitle(event)}</h2></div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close incident details">×</button>
        </header>
        <p className="admin-incident-drawer__notice">Only bounded, allowlisted operational facts are shown.</p>
        <dl>
          <Detail label="Occurred at" value={new Date(event.occurredAt).toLocaleString()} />
          <Detail label="Correlation ID" value={event.correlationId} />
          <Detail label="Event ID" value={event.eventId} />
          {event.source === 'runtime' && <>
            <Detail label="Engine" value={event.facts.engine} />
            <Detail label="Event type" value={event.facts.eventType} />
            <Detail label="Result" value={event.facts.result} />
            <Detail label="Duration" value={event.facts.durationMs === null ? null : `${event.facts.durationMs} ms`} />
            <Detail label="Operation" value={event.facts.operation} />
            <Detail label="Reason code" value={event.facts.reasonCode} />
            <Detail label="Provider" value={event.facts.provider} />
            <Detail label="HTTP status" value={event.facts.httpStatus} />
            <Detail label="Failure stage" value={event.facts.failureStage} />
            <Detail label="Retryable" value={event.facts.retryable} />
          </>}
          {event.source === 'admin-audit' && <>
            <Detail label="Actor role" value={event.facts.actorRole} />
            <Detail label="Action" value={event.facts.action} />
            <Detail label="Resource" value={`${event.facts.resourceType} · ${event.facts.resourceRef}`} />
            <Detail label="Resource version" value={event.facts.resourceVersion} />
            <Detail label="Resource revision" value={event.facts.resourceRevision} />
            <Detail label="Reason code" value={event.facts.reasonCode} />
            <AuditTransition label="Previous state" value={event.facts.previousValue} />
            <AuditTransition label="New state" value={event.facts.newValue} />
          </>}
          {event.source === 'provider-accounting' && <>
            <Detail label="Engine" value={event.facts.engine} />
            <Detail label="Provider" value={event.facts.provider} />
            <Detail label="Provider product" value={event.facts.providerProductId} />
            <Detail label="Logical tier" value={event.facts.logicalModelTier} />
            <Detail label="Result" value={event.facts.result} />
            <Detail label="Reason code" value={event.facts.resultReasonCode} />
            <Detail label="Billing disposition" value={event.facts.billingDisposition} />
            <Detail label="Accounting state" value={event.facts.costKind} />
          </>}
        </dl>
      </aside>
    </div>
  )
}

function Detail({ label: term, value }: { readonly label: string; readonly value: string | number | boolean | null }) {
  return <div><dt>{term}</dt><dd>{value === null ? 'Not recorded' : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</dd></div>
}

function AuditTransition({ label: term, value }: { readonly label: string; readonly value: AdminAuditValue | null }) {
  return (
    <div className="admin-incident-transition">
      <dt>{term}</dt>
      <dd>{value === null ? 'Not recorded' : <dl>{Object.entries(value).map(([key, item]) => <Detail key={key} label={key} value={Array.isArray(item) ? item.join(', ') : item as string | number | boolean | null} />)}</dl>}</dd>
    </div>
  )
}

function ExplorerState({ title, copy, action, onAction }: {
  readonly title: string
  readonly copy: string
  readonly action?: string
  readonly onAction?: () => void
}) {
  return <section className="admin-incident-state" role="status"><h2>{title}</h2><p>{copy}</p>{action && <button type="button" onClick={onAction}>{action}</button>}</section>
}
