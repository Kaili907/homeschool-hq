import { useMemo, useState } from 'react'
import {
  ADMIN_ATTENTION_DOMAIN_LABELS,
  ADMIN_ATTENTION_SEVERITIES,
  type AdminAttentionCenterModel,
  type AdminAttentionDomain,
  type AdminAttentionItem,
  type AdminAttentionItemType,
  type AdminAttentionSeverity,
  type AdminAttentionStatus,
} from '../../admin/attentionModel'
import './admin-attention-center.css'

export type AdminAttentionReadState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly model: AdminAttentionCenterModel }

const STATUS_GROUPS: readonly {
  readonly status: AdminAttentionStatus
  readonly label: string
  readonly description: string
}[] = [
  { status: 'needs_attention', label: 'Needs attention', description: 'Active operational conditions that need an operator to review the authoritative source.' },
  { status: 'blocked_unavailable', label: 'Blocked / unavailable', description: 'Production gates, operating states, or evidence reads that cannot currently be cleared.' },
  { status: 'warning', label: 'Warnings', description: 'Current conditions that warrant review but are not classified as critical blockers.' },
  { status: 'informational', label: 'Informational', description: 'Context from authoritative projections that may help operator triage.' },
]

const SEVERITY_LABELS: Readonly<Record<AdminAttentionSeverity, string>> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  informational: 'Informational',
}

const ITEM_TYPE_LABELS: Readonly<Record<AdminAttentionItemType, string>> = {
  'production-readiness-gate': 'Production readiness gate',
  'system-health-state': 'System health state',
  'runtime-configuration-state': 'Runtime configuration state',
  'learner-operational-flag': 'Learner operational flag',
  'safety-condition': 'Safety condition',
  'cost-accounting-state': 'Cost accounting state',
  'evidence-unavailable': 'Evidence unavailable',
}

export function AdminAttentionCenter({
  state,
  onRetry,
}: {
  readonly state: AdminAttentionReadState
  readonly onRetry?: () => void
}) {
  if (state.status === 'loading') return <AttentionLoading />
  if (state.status === 'error') return <AttentionError onRetry={onRetry} />
  return <AttentionReady model={state.model} onRetry={onRetry} />
}

function AttentionLoading() {
  return (
    <section className="attention-center attention-loading" aria-busy="true" aria-live="polite">
      <p className="admin-eyebrow">Operator attention</p>
      <h2>Loading authorized operational evidence</h2>
      <p>Each readable source is being checked independently.</p>
      <div className="attention-loading__grid" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
    </section>
  )
}

function AttentionError({ onRetry }: { readonly onRetry?: () => void }) {
  return (
    <section className="attention-error" role="alert">
      <p className="admin-eyebrow">Operator attention</p>
      <h2>Attention evidence could not be composed</h2>
      <p>No all-clear is shown because the authorized projections were not evaluated.</p>
      {onRetry && <button type="button" onClick={onRetry}>Refetch evidence</button>}
    </section>
  )
}

function AttentionReady({
  model,
  onRetry,
}: {
  readonly model: AdminAttentionCenterModel
  readonly onRetry?: () => void
}) {
  const [domain, setDomain] = useState<'all' | AdminAttentionDomain>('all')
  const [severity, setSeverity] = useState<'all' | AdminAttentionSeverity>('all')
  const filtered = useMemo(() => model.items.filter((item) =>
    (domain === 'all' || item.domain === domain)
    && (severity === 'all' || item.severity === severity)), [domain, model.items, severity])

  return (
    <section className="attention-center" aria-labelledby="attention-center-title">
      <header className="attention-intro">
        <div>
          <p className="admin-eyebrow">Read-only operational triage</p>
          <h2 id="attention-center-title">What requires operator attention right now?</h2>
          <p>Signals are composed from existing Admin projections. Open the source section to investigate or act; this view cannot change operational state.</p>
        </div>
        {onRetry && <button type="button" className="attention-refetch" onClick={onRetry}>Refetch evidence</button>}
      </header>

      {model.evidence.status !== 'complete' && <EvidenceBanner model={model} />}

      <dl className="attention-summary" aria-label="Attention item summary">
        {STATUS_GROUPS.map((group) => (
          <div key={group.status} className={`is-${group.status}`}>
            <dt>{group.label}</dt>
            <dd>{model.items.filter((item) => item.status === group.status).length}</dd>
          </div>
        ))}
      </dl>

      <fieldset className="attention-filters">
        <legend>Filter attention items</legend>
        <label>
          Domain
          <select value={domain} onChange={(event) => setDomain(event.target.value as typeof domain)}>
            <option value="all">All readable domains</option>
            {model.visibleDomains.map((item) => (
              <option key={item} value={item}>{ADMIN_ATTENTION_DOMAIN_LABELS[item]}</option>
            ))}
          </select>
        </label>
        <label>
          Severity
          <select value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)}>
            <option value="all">All severities</option>
            {ADMIN_ATTENTION_SEVERITIES.map((item) => (
              <option key={item} value={item}>{SEVERITY_LABELS[item]}</option>
            ))}
          </select>
        </label>
      </fieldset>

      {model.items.length === 0 && model.evidence.status === 'complete' && (
        <section className="attention-empty" role="status">
          <h3>No current actionable items</h3>
          <p>Every authorized Attention Center source returned complete evidence for this read.</p>
        </section>
      )}
      {model.items.length === 0 && model.evidence.status !== 'complete' && (
        <section className="attention-empty is-partial" role="status">
          <h3>No actionable items in the available evidence</h3>
          <p>Evidence is incomplete, so this is not an all-clear.</p>
        </section>
      )}
      {model.items.length > 0 && filtered.length === 0 && (
        <p className="attention-no-match" role="status">No attention items match the selected filters.</p>
      )}

      {model.items.length > 0 && STATUS_GROUPS.map((group) => {
        const items = filtered.filter((item) => item.status === group.status)
        return (
          <section className="attention-group" key={group.status} aria-labelledby={`attention-${group.status}`}>
            <div className="attention-group__heading">
              <div>
                <h3 id={`attention-${group.status}`}>{group.label}</h3>
                <p>{group.description}</p>
              </div>
              <span aria-label={`${items.length} ${group.label.toLowerCase()} items`}>{items.length}</span>
            </div>
            {items.length === 0
              ? <p className="attention-group__empty">No items in this group match the current filters.</p>
              : <div className="attention-list">{items.map((item, index) => (
                  <AttentionItemCard key={`${item.itemType}:${item.reference}`} item={item} index={index} />
                ))}</div>}
          </section>
        )
      })}

      <p className="attention-boundary" aria-label="Read-only boundary">
        Read only: this center provides source navigation and evidence refetch only. It cannot change or resolve authoritative operational state.
      </p>
    </section>
  )
}

function EvidenceBanner({ model }: { readonly model: AdminAttentionCenterModel }) {
  const unavailable = model.evidence.unavailableDomains.map((domain) => ADMIN_ATTENTION_DOMAIN_LABELS[domain])
  const incomplete = model.evidence.incompleteDomains.map((domain) => ADMIN_ATTENTION_DOMAIN_LABELS[domain])
  const detail = [
    unavailable.length > 0 ? `Unavailable: ${unavailable.join(', ')}.` : '',
    incomplete.length > 0 ? `Incomplete: ${incomplete.join(', ')}.` : '',
  ].filter(Boolean).join(' ')
  return (
    <aside className="attention-evidence-banner" role="status" aria-live="polite">
      <span aria-hidden="true">!</span>
      <div>
        <strong>{model.evidence.status === 'unavailable' ? 'Attention evidence is unavailable' : 'Attention evidence is partial'}</strong>
        <p>{detail || 'No readable operational evidence domain is available.'} Unknown or unavailable evidence is never treated as healthy.</p>
      </div>
    </aside>
  )
}

function AttentionItemCard({ item, index }: { readonly item: AdminAttentionItem; readonly index: number }) {
  const headingId = `attention-item-${item.itemType}-${index}`
  return (
    <article className={`attention-item is-${item.severity}`} aria-labelledby={headingId}>
      <div className="attention-item__marker" aria-hidden="true" />
      <div className="attention-item__body">
        <div className="attention-item__meta">
          <span className={`attention-severity is-${item.severity}`}>{SEVERITY_LABELS[item.severity]}</span>
          <span>{ADMIN_ATTENTION_DOMAIN_LABELS[item.domain]}</span>
          <span>{statusLabel(item.status)}</span>
          <span>{ITEM_TYPE_LABELS[item.itemType]}</span>
        </div>
        <h4 id={headingId}>{item.title}</h4>
        <p className="attention-item__explanation">{item.explanation}</p>
        <dl className="attention-item__evidence">
          <div><dt>Evidence</dt><dd>{item.evidence.label}</dd></div>
          <div><dt>Observed</dt><dd>{item.evidence.observedAt
            ? <time dateTime={item.evidence.observedAt}>{item.evidence.observedAt}</time>
            : 'No authoritative timestamp supplied'}</dd></div>
          {item.evidence.window && <div><dt>Window</dt><dd><time dateTime={item.evidence.window.start}>{item.evidence.window.start}</time> to <time dateTime={item.evidence.window.end}>{item.evidence.window.end}</time></dd></div>}
        </dl>
        <div className="attention-item__footer">
          <p>Sources: {item.sourceAttribution.map((source) => source.label).join(' · ')}</p>
          <a href={item.destination}>Open authoritative source <span aria-hidden="true">→</span></a>
        </div>
        {item.retryable && <p className="attention-item__retry">This evidence is included in the read-only refetch above.</p>}
      </div>
    </article>
  )
}

function statusLabel(status: AdminAttentionStatus): string {
  if (status === 'needs_attention') return 'Needs attention'
  if (status === 'blocked_unavailable') return 'Blocked / unavailable'
  if (status === 'warning') return 'Warning'
  return 'Informational'
}
