import type {
  ProductionReadinessCheck,
  ProductionReadinessProjection,
  ProductionReadinessStatus,
} from '../../admin/productionReadinessModel'
import './production-readiness-center.css'

export type ProductionReadinessReadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly projection: ProductionReadinessProjection }
  | { readonly status: 'denied' }
  | { readonly status: 'error'; readonly code: 'timeout' | 'unavailable' | 'malformed' }

const STATUS_LABELS: Readonly<Record<ProductionReadinessStatus, string>> = {
  READY: 'Ready',
  BLOCKED: 'Blocked',
  PARTIAL: 'Partial',
  UNVERIFIED: 'Unverified',
  NOT_APPLICABLE: 'Not applicable',
  UNAVAILABLE: 'Unavailable',
}

function StatusBadge({ status }: { readonly status: ProductionReadinessStatus }) {
  return (
    <span className="readiness-status" data-status={status}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function CheckEvidence({ item }: { readonly item: ProductionReadinessCheck }) {
  return (
    <article className="readiness-check" data-status={item.status}>
      <div className="readiness-check__heading">
        <div>
          <p className="readiness-check__requirement">{item.required ? 'Required gate' : 'Informational check'}</p>
          <h4>{item.title}</h4>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <p>{item.summary}</p>
      <dl className="readiness-evidence">
        <div><dt>Evidence source</dt><dd>{item.evidence.source}</dd></div>
        <div><dt>Evidence status</dt><dd>{item.evidence.status.replace('_', ' ')}</dd></div>
      </dl>
      {item.observations.length > 0 && (
        <div className="readiness-environment">
          <h5>Presence checks</h5>
          <ul>
            {item.observations.map((fact) => (
              <li key={fact.label}>
                <span>{fact.label}</span>
                <strong data-presence={fact.status}>{fact.status.replace('_', ' ')}</strong>
              </li>
            ))}
          </ul>
          <p>Values are never returned by this center.</p>
        </div>
      )}
      {item.action && <p className="readiness-check__action"><strong>Safe next step:</strong> {item.action}</p>}
    </article>
  )
}

export function ProductionReadinessCenter({
  state,
  onRetry,
}: {
  readonly state: ProductionReadinessReadState
  readonly onRetry?: () => void
}) {
  if (state.status === 'loading') {
    return (
      <section className="readiness-state" aria-busy="true" aria-live="polite">
        <span className="readiness-state__spinner" aria-hidden="true" />
        <h2>Checking production evidence</h2>
        <p>Each required gate remains blocked until its evidence can be classified safely.</p>
      </section>
    )
  }
  if (state.status === 'denied') {
    return (
      <section className="readiness-state" role="alert">
        <h2>Production readiness access unavailable</h2>
        <p>The current server-resolved assignment does not include releases read access.</p>
      </section>
    )
  }
  if (state.status === 'error') {
    const message = state.code === 'timeout'
      ? 'The readiness request timed out. No gate was treated as ready.'
      : state.code === 'malformed'
        ? 'The readiness response was malformed and was rejected.'
        : 'Production readiness evidence could not be loaded safely.'
    return (
      <section className="readiness-state" role="alert">
        <h2>Production readiness unavailable</h2>
        <p>{message}</p>
        {onRetry && <button type="button" onClick={onRetry}>Retry evidence checks</button>}
      </section>
    )
  }

  const { projection } = state
  const blockers = projection.domains.flatMap((item) =>
    item.checks.filter((check) => check.required && check.status !== 'READY'))
  return (
    <div className="readiness-center">
      <section className="readiness-hero" data-status={projection.status} aria-labelledby="readiness-overall-title">
        <div>
          <p className="readiness-eyebrow">Read-only production preflight</p>
          <h2 id="readiness-overall-title">Overall readiness</h2>
          <p>
            {projection.status === 'READY'
              ? 'Every required production gate has positive authoritative evidence.'
              : 'Production activation is blocked. Unknown, unavailable, partial, and mismatched evidence never become ready.'}
          </p>
          <p className="readiness-observed">Evidence assembled {projection.generatedAt}</p>
        </div>
        <div className="readiness-overall" aria-label={`Overall readiness: ${STATUS_LABELS[projection.status]}`}>
          <StatusBadge status={projection.status} />
          <strong>{projection.requiredSummary.ready} of {projection.requiredSummary.total}</strong>
          <span>required gates ready</span>
          {onRetry && <button type="button" onClick={onRetry}>Refetch evidence</button>}
        </div>
      </section>

      <section className="readiness-blockers" aria-labelledby="readiness-blockers-title">
        <div className="readiness-section-heading">
          <div>
            <p className="readiness-eyebrow">Required blockers first</p>
            <h3 id="readiness-blockers-title">What prevents production readiness</h3>
          </div>
          <span>{projection.requiredSummary.blocking} blocking</span>
        </div>
        {blockers.length === 0 ? (
          <p className="readiness-blockers__empty">No required blockers remain.</p>
        ) : (
          <ol>
            {blockers.map((item) => (
              <li key={item.id}>
                <StatusBadge status={item.status} />
                <div><strong>{item.title}</strong><p>{item.summary}</p>{item.action && <p>Next: {item.action}</p>}</div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="readiness-domains" aria-labelledby="readiness-domains-title">
        <div className="readiness-section-heading">
          <div>
            <p className="readiness-eyebrow">Evidence by domain</p>
            <h3 id="readiness-domains-title">Production readiness domains</h3>
          </div>
        </div>
        <div className="readiness-domain-grid">
          {projection.domains.map((item) => (
            <section className="readiness-domain" key={item.id} aria-labelledby={`readiness-domain-${item.id}`}>
              <div className="readiness-domain__heading">
                <div><h3 id={`readiness-domain-${item.id}`}>{item.label}</h3><p>{item.summary}</p></div>
                <StatusBadge status={item.status} />
              </div>
              <div className="readiness-domain__checks">
                {item.checks.map((check) => <CheckEvidence item={check} key={check.id} />)}
              </div>
            </section>
          ))}
        </div>
      </section>

      <p className="readiness-boundary">
        This center cannot deploy, apply migrations, bootstrap an Owner, activate curriculum, publish releases, or repair hosted state.
      </p>
    </div>
  )
}
