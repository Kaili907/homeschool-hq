import type { FormEvent, ReactNode } from 'react'
import {
  ADMIN_AUDIT_ACTIONS,
  ADMIN_AUDIT_RESOURCE_TYPES,
  type AdminAuditAction,
  type AdminAuditResourceType,
  type AdminAuditValue,
} from '../../admin/contracts'
import type { AdminAuditFilters, AdminAuditReadState } from '../../admin/auditLogModel'
import './admin-audit-log.css'

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
  if (!authorized || state.status === 'unauthorized') {
    return <AuditNotice title="Audit access unavailable">Your current Admin assignment does not include audit:read.</AuditNotice>
  }
  return (
    <section className="admin-audit" aria-labelledby="admin-audit-heading">
      <div className="admin-audit__intro">
        <div>
          <p className="admin-audit__eyebrow">Immutable history</p>
          <h2 id="admin-audit-heading">Audit Log</h2>
          <p>Privileged actions in reverse chronological order. This surface is read-only.</p>
        </div>
        <span className="admin-audit__readonly">Read only</span>
      </div>
      <AuditFilters filters={filters} onApply={onFiltersChange} />
      {state.status === 'loading' && (
        <div className="admin-audit__notice" role="status" aria-live="polite">
          <span className="admin-audit__spinner" aria-hidden="true" />
          <div><strong>Loading audit history</strong><p>Reading the authorized immutable projection.</p></div>
        </div>
      )}
      {state.status === 'empty' && (
        <AuditNotice title="No audit events found">No immutable events match these safe filters.</AuditNotice>
      )}
      {state.status === 'error' && (
        <AuditNotice title={state.code === 'audit_timeout' ? 'Audit read timed out' : 'Audit history unavailable'}>
          <span>No audit data is shown because the authorized source could not be read.</span>
          <button type="button" onClick={onRetry}>Try again</button>
        </AuditNotice>
      )}
      {state.status === 'ready' && (
        <>
          <div className="admin-audit__table-wrap">
            <table className="admin-audit__table">
              <caption className="admin-sr-only">Admin audit events, newest first</caption>
              <thead><tr>
                <th scope="col">Occurred</th><th scope="col">Actor</th><th scope="col">Action</th>
                <th scope="col">Resource</th><th scope="col">Change</th><th scope="col">Reason</th>
              </tr></thead>
              <tbody>{state.page.events.map((event) => (
                <tr key={event.eventId}>
                  <td><time dateTime={event.occurredAt}>{formatTime(event.occurredAt)}</time></td>
                  <td><span className="admin-audit__role">{event.actorRole}</span></td>
                  <td><code>{event.action}</code></td>
                  <td>
                    <strong>{event.resourceType}</strong><code>{event.resourceRef}</code>
                    {(event.resourceVersion || event.resourceRevision) && <small>
                      {event.resourceVersion ? `Version ${event.resourceVersion}` : ''}
                      {event.resourceVersion && event.resourceRevision ? ' · ' : ''}
                      {event.resourceRevision ? `Revision ${event.resourceRevision}` : ''}
                    </small>}
                  </td>
                  <td><div className="admin-audit__change">
                    <AuditValue label="Previous" value={event.previousValue} />
                    <span aria-hidden="true">→</span>
                    <AuditValue label="New" value={event.newValue} />
                  </div></td>
                  <td>
                    <code>{event.reasonCode ?? 'Not provided'}</code>
                    <small>Correlation {event.correlationId}</small>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <nav className="admin-audit__pagination" aria-label="Audit log pages">
            <button type="button" onClick={onPrevious} disabled={!canGoBack}>Newer</button>
            <span>Page {pageNumber}</span>
            <button
              type="button"
              onClick={() => state.page.nextCursor && onNext(state.page.nextCursor)}
              disabled={!state.page.nextCursor}
            >Older</button>
          </nav>
        </>
      )}
    </section>
  )
}

function AuditFilters({ filters, onApply }: {
  readonly filters: AdminAuditFilters
  readonly onApply: (filters: AdminAuditFilters) => void
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const action = data.get('action') || undefined
    const resourceType = data.get('resourceType') || undefined
    const resourceRef = String(data.get('resourceRef') ?? '').trim() || undefined
    onApply({
      action: action as AdminAuditAction | undefined,
      resourceType: resourceType as AdminAuditResourceType | undefined,
      resourceRef,
      limit: filters.limit,
    })
  }
  return <form className="admin-audit__filters" aria-label="Audit filters" onSubmit={submit}>
    <label>Action<select name="action" defaultValue={filters.action ?? ''}>
      <option value="">All canonical actions</option>
      {ADMIN_AUDIT_ACTIONS.map((action) => <option key={action} value={action}>{action}</option>)}
    </select></label>
    <label>Resource type<select name="resourceType" defaultValue={filters.resourceType ?? ''}>
      <option value="">All resource types</option>
      {ADMIN_AUDIT_RESOURCE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
    </select></label>
    <label>Exact resource reference<input name="resourceRef" defaultValue={filters.resourceRef ?? ''} maxLength={160} pattern="[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}" /></label>
    <button type="submit">Apply filters</button>
  </form>
}

function AuditValue({ label, value }: { readonly label: string; readonly value: AdminAuditValue | null }) {
  return <div><span>{label}</span>{value === null
    ? <em>None</em>
    : <dl>{Object.entries(value).map(([key, item]) => <div key={key}>
      <dt>{key.replaceAll('_', ' ')}</dt><dd>{displayValue(item)}</dd>
    </div>)}</dl>}</div>
}

function displayValue(value: string | number | boolean | null | readonly (string | number | boolean | null)[]) {
  if (Array.isArray(value)) return value.map(displayScalar).join(', ')
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

function AuditNotice({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return <div className="admin-audit__notice" role="status"><div><strong>{title}</strong><div>{children}</div></div></div>
}
