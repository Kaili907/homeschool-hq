import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import {
  ADMIN_AUDIT_ACTIONS,
  ADMIN_AUDIT_RESOURCE_TYPES,
  ADMIN_ROLES,
  type AdminAuditAction,
  type AdminAuditResourceType,
  type AdminAuditValue,
  type AdminRole,
} from '../../admin/contracts'
import type {
  AdminAuditFilters,
  AdminAuditLogEvent,
  AdminAuditReadState,
} from '../../admin/auditLogModel'
import './admin-audit-log.css'

const REFERENCE_PATTERN = '[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}'
const TOKEN_PATTERN = '[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}'
const UUID_PATTERN = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}'

export function hasActiveAuditFilters(filters: AdminAuditFilters) {
  return Boolean(
    filters.occurredFrom || filters.occurredTo || filters.action
    || filters.resourceType || filters.resourceRef || filters.actorRole
    || filters.reasonCode || filters.correlationId,
  )
}

export function activeAuditFilterCount(filters: AdminAuditFilters) {
  return [
    filters.occurredFrom, filters.occurredTo, filters.action,
    filters.resourceType, filters.resourceRef, filters.actorRole,
    filters.reasonCode, filters.correlationId,
  ].filter(Boolean).length
}

export function isAuditPanelCloseKey(key: string) {
  return key === 'Escape'
}

export function resetAuditFilters(filters: AdminAuditFilters): AdminAuditFilters {
  return { limit: filters.limit }
}

export function AdminAuditLog({
  authorized,
  state,
  filters,
  pageNumber,
  canGoBack,
  onFiltersChange,
  onNext,
  onPrevious,
  onRetry,
}: {
  readonly authorized: boolean
  readonly state: AdminAuditReadState
  readonly filters: AdminAuditFilters
  readonly pageNumber: number
  readonly canGoBack: boolean
  readonly onFiltersChange: (filters: AdminAuditFilters) => void
  readonly onNext: (cursor: string) => void
  readonly onPrevious: () => void
  readonly onRetry: () => void
}) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const detailHeadingId = useId()
  const detailPanelId = useId()
  const detailCloseRef = useRef<HTMLButtonElement>(null)
  const detailOpenerRef = useRef<HTMLButtonElement | null>(null)
  const page = state.status === 'ready' || state.status === 'loading-page'
    ? state.page
    : null
  const selectedEvent = page?.events.find((event) => event.eventId === selectedEventId) ?? null
  const filtersActive = hasActiveAuditFilters(filters)
  const filterCount = activeAuditFilterCount(filters)
  const pageIsLoading = state.status === 'loading-page'

  useEffect(() => {
    if (selectedEvent) detailCloseRef.current?.focus()
  }, [selectedEvent])

  useEffect(() => {
    if (selectedEventId && !selectedEvent) setSelectedEventId(null)
  }, [selectedEvent, selectedEventId])

  function openDetails(event: AdminAuditLogEvent, opener: HTMLButtonElement) {
    detailOpenerRef.current = opener
    setSelectedEventId(event.eventId)
  }

  function closeDetails() {
    setSelectedEventId(null)
    globalThis.setTimeout(() => {
      const opener = detailOpenerRef.current
      if (opener?.isConnected) opener.focus()
    }, 0)
  }

  function resetFilters() {
    setSelectedEventId(null)
    onFiltersChange(resetAuditFilters(filters))
  }

  if (!authorized || state.status === 'unauthorized') {
    return (
      <AuditNotice role="alert" title="Permission denied">
        Your current Admin assignment does not include <code>audit:read</code>.
        No audit history has been requested or displayed.
      </AuditNotice>
    )
  }

  return (
    <section
      className="admin-audit"
      aria-labelledby="admin-audit-heading"
    >
      <div className="admin-audit__intro">
        <div>
          <p className="admin-audit__eyebrow">Immutable history</p>
          <h2 id="admin-audit-heading">Audit Log</h2>
          <p>Authorized privileged actions, newest first. Audit events cannot be changed here.</p>
        </div>
        <span className="admin-audit__readonly">Read only</span>
      </div>

      <AuditFilters
        key={filterKey(filters)}
        filters={filters}
        activeCount={filterCount}
        onApply={onFiltersChange}
        onReset={resetFilters}
      />

      {state.status === 'loading' && (
        <div className="admin-audit__notice" role="status" aria-live="polite">
          <span className="admin-audit__spinner" aria-hidden="true" />
          <div>
            <strong>Loading audit history</strong>
            <p>Reading a bounded page from the authorized immutable projection.</p>
          </div>
        </div>
      )}

      {state.status === 'empty' && (
        <AuditNotice title={filtersActive ? 'No events match these filters' : 'No audit events yet'}>
          {filtersActive
            ? <><span>Try a broader time range or clear the active filters.</span><button type="button" onClick={resetFilters}>Clear all filters</button></>
            : 'There are no events in the authorized audit projection.'}
        </AuditNotice>
      )}

      {state.status === 'error' && (
        <AuditNotice
          role="alert"
          title={state.code === 'audit_timeout'
            ? 'Audit read timed out'
            : state.code === 'audit_malformed'
              ? 'Audit response could not be displayed safely'
              : 'Audit history unavailable'}
        >
          <span>{state.code === 'audit_malformed'
            ? 'The response did not match the minimized audit contract. No partial or raw data was shown.'
            : 'No audit data is shown because the authorized source could not be read.'}</span>
          <button type="button" onClick={onRetry}>Try again</button>
        </AuditNotice>
      )}

      {page && (
        <>
          <div className="admin-audit__results-heading">
            <p role="status" aria-live="polite">
              {pageIsLoading
                ? `Loading ${state.direction} audit events. Page ${pageNumber} remains visible.`
                : `${page.events.length} event${page.events.length === 1 ? '' : 's'} on page ${pageNumber}.`}
            </p>
            {filtersActive && <span>{filterCount} active filter{filterCount === 1 ? '' : 's'}</span>}
          </div>

          <div className="admin-audit__workspace">
            <div className="admin-audit__table-wrap" aria-busy={pageIsLoading}>
              <table className="admin-audit__table">
                <caption className="admin-sr-only">Admin audit events, newest first</caption>
                <thead>
                  <tr>
                    <th scope="col">Occurred</th>
                    <th scope="col">Action</th>
                    <th scope="col">Resource</th>
                    <th scope="col">Actor category</th>
                    <th scope="col">Reason</th>
                    <th scope="col"><span className="admin-sr-only">Event details</span></th>
                  </tr>
                </thead>
                <tbody>{page.events.map((event) => (
                  <tr key={event.eventId} data-selected={event.eventId === selectedEventId || undefined}>
                    <td data-label="Occurred"><time dateTime={event.occurredAt}>{formatTime(event.occurredAt)}</time></td>
                    <td data-label="Action"><code>{event.action}</code></td>
                    <td data-label="Resource">
                      <strong>{humanize(event.resourceType)}</strong>
                      <code>{event.resourceRef}</code>
                    </td>
                    <td data-label="Actor category"><span className="admin-audit__role">{event.actorRole}</span></td>
                    <td data-label="Reason"><code>{event.reasonCode ?? 'Not recorded'}</code></td>
                    <td data-label="Details" className="admin-audit__details-cell">
                      <button
                        type="button"
                        className="admin-audit__details-button"
                        aria-expanded={event.eventId === selectedEventId}
                        aria-controls={detailPanelId}
                        onClick={(clickEvent) => openDetails(event, clickEvent.currentTarget)}
                      >View event<span className="admin-sr-only"> {event.eventId}</span></button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>

            {selectedEvent && (
              <EventDetailPanel
                event={selectedEvent}
                panelId={detailPanelId}
                headingId={detailHeadingId}
                closeRef={detailCloseRef}
                onClose={closeDetails}
              />
            )}
          </div>

          <nav className="admin-audit__pagination" aria-label="Audit log pages">
            <button type="button" onClick={onPrevious} disabled={!canGoBack || pageIsLoading}>Newer events</button>
            <span aria-current="page">Page {pageNumber}</span>
            <button
              type="button"
              onClick={() => page.nextCursor && onNext(page.nextCursor)}
              disabled={!page.nextCursor || pageIsLoading}
            >Older events</button>
          </nav>
        </>
      )}
    </section>
  )
}

function AuditFilters({ filters, activeCount, onApply, onReset }: {
  readonly filters: AdminAuditFilters
  readonly activeCount: number
  readonly onApply: (filters: AdminAuditFilters) => void
  readonly onReset: () => void
}) {
  const [rangeError, setRangeError] = useState(false)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const occurredFrom = localInputToIso(data.get('occurredFrom'))
    const occurredTo = localInputToIso(data.get('occurredTo'))
    if (occurredFrom && occurredTo && occurredFrom > occurredTo) {
      setRangeError(true)
      return
    }
    setRangeError(false)
    const action = data.get('action') || undefined
    const resourceType = data.get('resourceType') || undefined
    const actorRole = data.get('actorRole') || undefined
    const resourceRef = trimmed(data.get('resourceRef'))
    const reasonCode = trimmed(data.get('reasonCode'))
    const correlationId = trimmed(data.get('correlationId'))?.toLowerCase()
    onApply({
      occurredFrom,
      occurredTo,
      action: action as AdminAuditAction | undefined,
      resourceType: resourceType as AdminAuditResourceType | undefined,
      resourceRef,
      actorRole: actorRole as AdminRole | undefined,
      reasonCode,
      correlationId,
      limit: filters.limit,
    })
  }

  return (
    <form className="admin-audit__filters" aria-label="Audit filters" onSubmit={submit}>
      <div className="admin-audit__filter-heading">
        <div>
          <strong>Filter audit history</strong>
          <span>Exact server-side filters apply to every cursor page.{activeCount > 0 ? ` ${activeCount} active filter${activeCount === 1 ? '' : 's'}.` : ''}</span>
        </div>
        <button type="button" className="admin-audit__reset" onClick={onReset} disabled={activeCount === 0}>
          Clear all<span className="admin-sr-only"> audit filters</span>
        </button>
      </div>
      <div className="admin-audit__filter-grid">
        <label>From (local time)<input name="occurredFrom" type="datetime-local" defaultValue={isoToLocalInput(filters.occurredFrom)} aria-describedby={rangeError ? 'admin-audit-range-error' : undefined} /></label>
        <label>Through (local time)<input name="occurredTo" type="datetime-local" defaultValue={isoToLocalInput(filters.occurredTo)} aria-describedby={rangeError ? 'admin-audit-range-error' : undefined} /></label>
        <label>Action<select name="action" defaultValue={filters.action ?? ''}>
          <option value="">All canonical actions</option>
          {ADMIN_AUDIT_ACTIONS.map((action) => <option key={action} value={action}>{action}</option>)}
        </select></label>
        <label>Resource type<select name="resourceType" defaultValue={filters.resourceType ?? ''}>
          <option value="">All resource types</option>
          {ADMIN_AUDIT_RESOURCE_TYPES.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}
        </select></label>
        <label>Actor category<select name="actorRole" defaultValue={filters.actorRole ?? ''}>
          <option value="">All Admin roles</option>
          {ADMIN_ROLES.map((role) => <option key={role} value={role}>{humanize(role)}</option>)}
        </select></label>
        <label>Exact resource reference<input name="resourceRef" defaultValue={filters.resourceRef ?? ''} maxLength={160} pattern={REFERENCE_PATTERN} autoComplete="off" /></label>
        <label>Exact reason code<input name="reasonCode" defaultValue={filters.reasonCode ?? ''} maxLength={128} pattern={TOKEN_PATTERN} autoComplete="off" /></label>
        <label>Correlation ID<input name="correlationId" defaultValue={filters.correlationId ?? ''} maxLength={36} pattern={UUID_PATTERN} inputMode="text" autoComplete="off" /></label>
      </div>
      {rangeError && <p id="admin-audit-range-error" className="admin-audit__filter-error" role="alert">The start time must be before the end time.</p>}
      <div className="admin-audit__filter-actions"><button type="submit">Apply filters</button></div>
    </form>
  )
}

export function EventDetailPanel({ event, panelId, headingId, closeRef, onClose }: {
  readonly event: AdminAuditLogEvent
  readonly panelId: string
  readonly headingId: string
  readonly closeRef: React.RefObject<HTMLButtonElement | null>
  readonly onClose: () => void
}) {
  function handleKeyDown(keyEvent: KeyboardEvent<HTMLElement>) {
    if (isAuditPanelCloseKey(keyEvent.key)) {
      keyEvent.preventDefault()
      onClose()
    }
  }

  return (
    <aside
      id={panelId}
      className="admin-audit__detail"
      aria-labelledby={headingId}
      onKeyDown={handleKeyDown}
    >
      <div className="admin-audit__detail-heading">
        <div><p>Event details</p><h3 id={headingId}>{event.action}</h3></div>
        <button ref={closeRef} type="button" onClick={onClose}>Close<span className="admin-sr-only"> event details</span></button>
      </div>

      <dl className="admin-audit__facts">
        <Fact label="Occurred"><time dateTime={event.occurredAt}>{formatTime(event.occurredAt)}</time></Fact>
        <Fact label="Actor category">{humanize(event.actorRole)}</Fact>
        <Fact label="Resource type">{humanize(event.resourceType)}</Fact>
        <Fact label="Resource reference"><code>{event.resourceRef}</code></Fact>
        {event.resourceVersion && <Fact label="Resource version"><code>{event.resourceVersion}</code></Fact>}
        {event.resourceRevision && <Fact label="Resource revision"><code>{event.resourceRevision}</code></Fact>}
        <Fact label="Reason code"><code>{event.reasonCode ?? 'Not recorded'}</code></Fact>
        <Fact label="Correlation ID"><code>{event.correlationId}</code></Fact>
        <Fact label="Event ID"><code>{event.eventId}</code></Fact>
      </dl>

      <section className="admin-audit__recorded-change" aria-labelledby={`${headingId}-change`}>
        <h4 id={`${headingId}-change`}>Recorded before/after metadata</h4>
        <p>Before and after values are shown exactly as recorded. Missing values and differences are not inferred.</p>
        {event.previousValue === null && event.newValue === null
          ? <div className="admin-audit__minimized" role="note">No before/after metadata was recorded. This event remains intentionally minimized.</div>
          : <div className="admin-audit__change">
              <AuditValue label="Before" value={event.previousValue} />
              <span className="admin-audit__change-arrow" aria-hidden="true">→</span>
              <AuditValue label="After" value={event.newValue} />
            </div>}
      </section>
    </aside>
  )
}

function Fact({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>
}

function AuditValue({ label, value }: { readonly label: string; readonly value: AdminAuditValue | null }) {
  return <div className="admin-audit__value"><strong>{label}</strong>{value === null
    ? <em>Not recorded</em>
    : <dl>{Object.entries(value).map(([key, item]) => <div key={key}>
      <dt>{humanize(key)}</dt><dd>{displayValue(item)}</dd>
    </div>)}</dl>}</div>
}

function displayValue(value: string | number | boolean | null | readonly (string | number | boolean | null)[]) {
  if (Array.isArray(value)) {
    return value.length === 0
      ? 'Empty list'
      : <ul>{value.map((item, index) => <li key={`${index}-${String(item)}`}>{displayScalar(item)}</li>)}</ul>
  }
  return displayScalar(value as string | number | boolean | null)
}

function displayScalar(value: string | number | boolean | null) {
  if (value === null) return 'None'
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  return String(value)
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
  }).format(new Date(value)) + ' UTC'
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())
}

function trimmed(value: FormDataEntryValue | null) {
  return String(value ?? '').trim() || undefined
}

function localInputToIso(value: FormDataEntryValue | null) {
  const raw = trimmed(value)
  if (!raw) return undefined
  const date = new Date(raw)
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined
}

function isoToLocalInput(value: string | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function filterKey(filters: AdminAuditFilters) {
  return JSON.stringify(filters)
}

function AuditNotice({ title, children, role = 'status' }: {
  readonly title: string
  readonly children: ReactNode
  readonly role?: 'status' | 'alert'
}) {
  return <div className="admin-audit__notice" role={role}><div><strong>{title}</strong><div>{children}</div></div></div>
}
