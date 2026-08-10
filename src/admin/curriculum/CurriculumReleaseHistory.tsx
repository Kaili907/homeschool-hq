import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import type { AdminCapability } from '../contracts'
import type {
  CurriculumReleaseGovernanceEntry,
  CurriculumReleaseHistoryModel,
  CurriculumReleaseHistorySource,
  CurriculumReleaseLifecycle,
  CurriculumRollbackEligibilityState,
} from '../curriculum-history'
import './curriculum-release-history.css'

export interface CurriculumReleaseHistoryAuthorization {
  readonly status: 'checking' | 'authorized' | 'denied'
  readonly capabilities?: readonly AdminCapability[]
}

interface ReleaseFilters {
  readonly query: string
  readonly lifecycle: 'all' | CurriculumReleaseLifecycle
  readonly eligibility: 'all' | CurriculumRollbackEligibilityState
}

const INITIAL_FILTERS: ReleaseFilters = { query: '', lifecycle: 'all', eligibility: 'all' }

export function CurriculumReleaseHistory({
  authorization,
  source,
  releaseIntegrityHref,
}: {
  readonly authorization: CurriculumReleaseHistoryAuthorization
  readonly source: CurriculumReleaseHistorySource
  readonly releaseIntegrityHref?: (releaseVersion: string) => string | null
}) {
  const canRead = authorization.status === 'authorized'
    && authorization.capabilities?.includes('curriculum:read') === true
  const [model, setModel] = useState<CurriculumReleaseHistoryModel | null>(null)
  const [error, setError] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!canRead) {
      setModel(null)
      setError(false)
      return
    }
    let current = true
    setModel(null)
    setError(false)
    void source.read().then(
      (next) => { if (current) setModel(next) },
      () => { if (current) setError(true) },
    )
    return () => { current = false }
  }, [canRead, reload, source])

  if (authorization.status === 'checking') {
    return <CurriculumReleaseHistoryState role="status" title="Checking release history access">No release evidence has been requested yet.</CurriculumReleaseHistoryState>
  }
  if (!canRead) {
    return <CurriculumReleaseHistoryState role="alert" title="Release history access unavailable">The exact curriculum:read capability is required. No release or pointer evidence was loaded.</CurriculumReleaseHistoryState>
  }
  if (error) {
    return (
      <CurriculumReleaseHistoryState
        role="alert"
        title="Release history unavailable"
        onRetry={() => setReload((value) => value + 1)}
      >
        The authoritative release registry or pointer history could not be verified. No partial history is shown.
      </CurriculumReleaseHistoryState>
    )
  }
  if (!model) {
    return <CurriculumReleaseHistoryState role="status" title="Loading release governance">Reading the published registry and bounded pointer revisions.</CurriculumReleaseHistoryState>
  }
  return <CurriculumReleaseHistoryView model={model} releaseIntegrityHref={releaseIntegrityHref} />
}

export function CurriculumReleaseHistoryState({
  role,
  title,
  children,
  onRetry,
}: {
  readonly role: 'status' | 'alert'
  readonly title: string
  readonly children: ReactNode
  readonly onRetry?: () => void
}) {
  return (
    <section className="curriculum-history-state" role={role} aria-labelledby="curriculum-history-state-title">
      <p className="curriculum-studio-eyebrow">Release governance · Read-only</p>
      <h2 id="curriculum-history-state-title">{title}</h2>
      <p>{children}</p>
      {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
    </section>
  )
}

export function CurriculumReleaseHistoryView({
  model,
  releaseIntegrityHref,
}: {
  readonly model: CurriculumReleaseHistoryModel
  readonly releaseIntegrityHref?: (releaseVersion: string) => string | null
}) {
  const [filters, setFilters] = useState<ReleaseFilters>(INITIAL_FILTERS)
  const [selectedVersion, setSelectedVersion] = useState(model.activeReleaseVersion)
  const releaseButtons = useRef(new Map<string, HTMLButtonElement>())
  const headingRef = useRef<HTMLHeadingElement>(null)
  const filteredReleases = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase()
    return model.releases.filter((release) => {
      if (filters.lifecycle !== 'all' && release.lifecycle !== filters.lifecycle) return false
      if (filters.eligibility !== 'all'
        && release.rollbackEligibility.state !== filters.eligibility) return false
      if (!query) return true
      return [
        release.version,
        release.packageId,
        release.provenanceKind,
        release.provenanceCompleteness,
        release.sourceCommit,
        release.sourceRoot,
      ].some((value) => value.toLocaleLowerCase().includes(query))
    })
  }, [filters, model.releases])
  const selectedRelease = filteredReleases.find((release) => release.version === selectedVersion)
    ?? filteredReleases[0]

  function handleReleaseKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    release: CurriculumReleaseGovernanceEntry,
  ) {
    const currentIndex = filteredReleases.findIndex((item) => item.version === release.version)
    let nextIndex: number | null = null
    if (event.key === 'ArrowDown') nextIndex = Math.min(currentIndex + 1, filteredReleases.length - 1)
    if (event.key === 'ArrowUp') nextIndex = Math.max(currentIndex - 1, 0)
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = filteredReleases.length - 1
    if (nextIndex === null || nextIndex === currentIndex) return
    event.preventDefault()
    const next = filteredReleases[nextIndex]
    setSelectedVersion(next.version)
    releaseButtons.current.get(next.version)?.focus()
  }

  return (
    <section className="curriculum-release-history" aria-labelledby="curriculum-release-history-title">
      <header className="curriculum-history-header">
        <div>
          <p className="curriculum-studio-eyebrow">Release governance · Read-only</p>
          <h2 id="curriculum-release-history-title" ref={headingRef} tabIndex={-1}>Curriculum Release History</h2>
          <p>Published registry custody joined to pointer identities. No activation or rollback action is available here.</p>
        </div>
        <span className="curriculum-history-read-only">Read-only</span>
      </header>

      <dl className="curriculum-history-current" aria-label="Current curriculum authority">
        <div><dt>Current active</dt><dd>{model.activeReleaseVersion}</dd></div>
        <div><dt>Pointer revision</dt><dd>{model.pointerRevision}</dd></div>
        <div><dt>Last transition</dt><dd>{transitionLabel(model.pointerTransitionKind)}</dd></div>
        <div><dt>Effective at</dt><dd><time dateTime={model.pointerTransitionedAt}>{formatTimestamp(model.pointerTransitionedAt)}</time></dd></div>
      </dl>

      <section className="curriculum-history-filters" aria-labelledby="curriculum-history-filters-title">
        <div>
          <h3 id="curriculum-history-filters-title">Find a release</h3>
          <button type="button" onClick={() => setFilters(INITIAL_FILTERS)}>Clear filters</button>
        </div>
        <div className="curriculum-history-filter-grid">
          <label>
            Version, package, or provenance
            <input
              type="search"
              value={filters.query}
              onChange={(event) => setFilters({ ...filters, query: event.target.value })}
            />
          </label>
          <label>
            Lifecycle
            <select
              value={filters.lifecycle}
              onChange={(event) => setFilters({
                ...filters,
                lifecycle: event.target.value as ReleaseFilters['lifecycle'],
              })}
            >
              <option value="all">All lifecycle states</option>
              <option value="active">Active</option>
              <option value="previously_active">Previously active</option>
              <option value="published">Published, never active</option>
            </select>
          </label>
          <label>
            Rollback evaluation
            <select
              value={filters.eligibility}
              onChange={(event) => setFilters({
                ...filters,
                eligibility: event.target.value as ReleaseFilters['eligibility'],
              })}
            >
              <option value="all">All evaluations</option>
              <option value="eligible">Eligible</option>
              <option value="ineligible">Ineligible</option>
              <option value="unverified">Unverified</option>
            </select>
          </label>
        </div>
      </section>

      <div className="curriculum-history-workspace">
        <section className="curriculum-history-release-list" aria-labelledby="curriculum-history-release-list-title">
          <div className="curriculum-history-section-heading">
            <div>
              <p>Registry</p>
              <h3 id="curriculum-history-release-list-title">Published releases</h3>
            </div>
            <span aria-live="polite">{filteredReleases.length} of {model.releases.length}</span>
          </div>
          {model.releases.length === 0 ? (
            <p className="curriculum-history-empty" role="status">No published releases are available in the authoritative registry.</p>
          ) : filteredReleases.length === 0 ? (
            <p className="curriculum-history-empty" role="status">No releases match the current search and filters.</p>
          ) : (
            <ul role="listbox" aria-label="Published curriculum releases">
              {filteredReleases.map((release) => (
                <li key={release.version} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedRelease?.version === release.version}
                    aria-controls="curriculum-release-governance-detail"
                    tabIndex={selectedRelease?.version === release.version ? 0 : -1}
                    ref={(node) => {
                      if (node) releaseButtons.current.set(release.version, node)
                      else releaseButtons.current.delete(release.version)
                    }}
                    onClick={() => setSelectedVersion(release.version)}
                    onKeyDown={(event) => handleReleaseKeyDown(event, release)}
                  >
                    <span className="curriculum-release-list-title">
                      <strong>{release.version}</strong>
                      {release.active && <span className="curriculum-lifecycle-badge is-active">Current active</span>}
                    </span>
                    <span className="curriculum-release-list-badges">
                      <span className={`curriculum-lifecycle-badge is-${release.lifecycle}`}>
                        {lifecycleLabel(release.lifecycle)}
                      </span>
                      <span className={`curriculum-eligibility-badge is-${release.rollbackEligibility.state}`}>
                        Rollback {release.rollbackEligibility.state}
                      </span>
                    </span>
                    <span>Published <time dateTime={release.publishedAt}>{formatTimestamp(release.publishedAt)}</time></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          id="curriculum-release-governance-detail"
          className="curriculum-history-detail"
          aria-labelledby="curriculum-history-detail-title"
          aria-live="polite"
        >
          {selectedRelease ? (
            <ReleaseGovernanceDetail
              release={selectedRelease}
              integrityHref={releaseIntegrityHref?.(selectedRelease.version) ?? null}
            />
          ) : (
            <p className="curriculum-history-empty" role="status">Select an available release to inspect its governance evidence.</p>
          )}
        </section>
      </div>

      <ReleaseTimeline model={model} />
    </section>
  )
}

function ReleaseGovernanceDetail({
  release,
  integrityHref,
}: {
  readonly release: CurriculumReleaseGovernanceEntry
  readonly integrityHref: string | null
}) {
  return (
    <>
      <div className="curriculum-history-section-heading">
        <div>
          <p>Selected release</p>
          <h3 id="curriculum-history-detail-title">Version {release.version}</h3>
        </div>
        <span className={`curriculum-eligibility-badge is-${release.rollbackEligibility.state}`}>
          {release.rollbackEligibility.state}
        </span>
      </div>
      <div className="curriculum-history-detail-body">
        <section aria-labelledby="curriculum-history-custody-title">
          <h4 id="curriculum-history-custody-title">Lifecycle &amp; custody</h4>
          <dl>
            <div><dt>Published status</dt><dd>Published</dd></div>
            <div><dt>Lifecycle</dt><dd>{lifecycleLabel(release.lifecycle)}</dd></div>
            <div><dt>Package</dt><dd>{release.packageId}</dd></div>
            <div><dt>Authored on</dt><dd>{release.authoredOn ?? 'Unavailable'}</dd></div>
            <div><dt>Pointer revisions</dt><dd>{release.pointerRevisions.length > 0 ? release.pointerRevisions.join(', ') : 'None available'}</dd></div>
            <div><dt>Base release</dt><dd>Unavailable in published registry</dd></div>
          </dl>
        </section>
        <section aria-labelledby="curriculum-history-provenance-title">
          <h4 id="curriculum-history-provenance-title">Integrity &amp; provenance</h4>
          <div className="curriculum-history-evidence-badges">
            <span className="curriculum-provenance-badge">Legacy</span>
            <span className="curriculum-provenance-badge is-incomplete">Incomplete provenance</span>
            <span className={`curriculum-integrity-badge is-${release.integrityState}`}>
              {integrityLabel(release.integrityState)}
            </span>
          </div>
          <dl>
            <div><dt>Source commit</dt><dd><code>{release.sourceCommit}</code></dd></div>
            <div><dt>Source root</dt><dd><code>{release.sourceRoot}</code></dd></div>
          </dl>
          {integrityHref ? (
            <a className="curriculum-history-integrity-link" href={integrityHref}>Open Release Integrity</a>
          ) : (
            <p className="curriculum-history-integrity-seam">Release Integrity route unavailable for this release.</p>
          )}
        </section>
        <section className={`curriculum-rollback-evaluation is-${release.rollbackEligibility.state}`} aria-labelledby="curriculum-history-rollback-title">
          <h4 id="curriculum-history-rollback-title">Rollback eligibility: {release.rollbackEligibility.state}</h4>
          <p>{release.rollbackEligibility.explanation}</p>
          <p className="curriculum-rollback-read-only">Evaluation only. No rollback action is available on this page.</p>
        </section>
      </div>
    </>
  )
}

function ReleaseTimeline({ model }: { readonly model: CurriculumReleaseHistoryModel }) {
  return (
    <section className="curriculum-history-timeline" aria-labelledby="curriculum-history-timeline-title">
      <div className="curriculum-history-section-heading">
        <div>
          <p>Pointer identities</p>
          <h3 id="curriculum-history-timeline-title">Lifecycle timeline</h3>
        </div>
        <span>{model.transitions.length} bounded revision{model.transitions.length === 1 ? '' : 's'}</span>
      </div>
      {model.transitions.length === 0 ? (
        <p className="curriculum-history-empty" role="status">No pointer transition evidence is available.</p>
      ) : (
        <ol>
          {model.transitions.map((transition) => (
            <li key={transition.pointerRevision}>
              <span className={`curriculum-transition-marker is-${transition.transitionKind}`} aria-hidden="true" />
              <div className="curriculum-transition-main">
                <p>
                  <strong>Revision {transition.pointerRevision}</strong>
                  <span className={`curriculum-lifecycle-badge is-${transition.transitionKind}`}>{transitionLabel(transition.transitionKind)}</span>
                </p>
                <h4>
                  {transition.previousReleaseVersion
                    ? `${transition.previousReleaseVersion} → ${transition.newReleaseVersion}`
                    : `${transition.newReleaseVersion} established as the legacy registry seed`}
                </h4>
                <p>Reason: <code>{transition.reasonCode ?? 'Unavailable for migration seed'}</code></p>
              </div>
              <time dateTime={transition.transitionedAt}>{formatTimestamp(transition.transitionedAt)}</time>
            </li>
          ))}
        </ol>
      )}
      {model.historyTruncated && (
        <p className="curriculum-history-truncated" role="note">History is bounded to the newest 100 pointer revisions. Earlier transitions are not shown.</p>
      )}
    </section>
  )
}

function lifecycleLabel(value: CurriculumReleaseLifecycle): string {
  if (value === 'active') return 'Active'
  if (value === 'previously_active') return 'Previously active'
  return 'Published'
}

function transitionLabel(value: CurriculumReleaseHistoryModel['pointerTransitionKind']): string {
  if (value === 'activation') return 'Activation'
  if (value === 'rollback') return 'Rollback'
  return 'Migration seed'
}

function integrityLabel(value: CurriculumReleaseGovernanceEntry['integrityState']): string {
  if (value === 'verified_evidence_available') return 'Verified evidence available'
  if (value === 'evidence_unavailable') return 'Integrity evidence unavailable'
  return 'Integrity unverified'
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value)) + ' UTC'
}
