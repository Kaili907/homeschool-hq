import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { AdminCapability } from '../contracts'
import {
  CurriculumDraftAuthoringError,
  type CurriculumDraftAuthoringSource,
  type CurriculumDraftEntityType,
  type CurriculumDraftSummary,
  type CurriculumPreviewChangeType,
  type CurriculumPreviewEntityDiff,
  type CurriculumPreviewResult,
} from '../curriculum-authoring/contracts'
import type { CurriculumReadAuthorization } from '../curriculum/contracts'
import {
  CURRICULUM_PREVIEW_RENDER_LIMIT,
  currentPreviewValidation,
  curriculumPreviewEntityToken,
  curriculumPreviewFilterOptions,
  curriculumPreviewKeyboardTarget,
  filterCurriculumPreview,
  isCurriculumPreviewStale,
} from './model'
import '../curriculum/curriculum-studio.css'
import './curriculum-preview.css'

type PreviewLoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'unavailable'; readonly message: string }
  | { readonly kind: 'stale-unavailable'; readonly requestedRevision: number; readonly latestRevision: number }
  | {
    readonly kind: 'ready'
    readonly preview: CurriculumPreviewResult
    readonly latestRevision: number
  }

export interface CurriculumPreviewProps {
  readonly authorization: CurriculumReadAuthorization
  readonly source: CurriculumDraftAuthoringSource
}

function hasReadAccess(authorization: CurriculumReadAuthorization): authorization is {
  readonly status: 'authorized'
  readonly capabilities: readonly AdminCapability[]
} {
  return authorization.status === 'authorized' && authorization.capabilities.includes('curriculum:read')
}

function initialRequest() {
  if (typeof window === 'undefined') return { draftId: null, revision: null }
  const query = new URLSearchParams(window.location.search)
  const draftId = query.get('draft')
  const rawRevision = query.get('revision')
  const revision = rawRevision && /^[1-9]\d{0,14}$/.test(rawRevision) ? Number(rawRevision) : null
  return { draftId, revision }
}

export function CurriculumPreview({ authorization, source }: CurriculumPreviewProps) {
  const [drafts, setDrafts] = useState<readonly CurriculumDraftSummary[]>([])
  const [selectedDraftId, setSelectedDraftId] = useState('')
  const [state, setState] = useState<PreviewLoadState>({ kind: 'loading' })
  const mounted = useRef(true)
  const readAllowed = hasReadAccess(authorization)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  async function loadPreview(draft: CurriculumDraftSummary, revision = draft.revision) {
    setSelectedDraftId(draft.draftId)
    setState({ kind: 'loading' })
    try {
      const preview = await source.readPreview(draft.draftId, revision)
      if (!mounted.current) return
      setState({ kind: 'ready', preview, latestRevision: revision })
      try {
        const latest = await source.readDraft(draft.draftId)
        if (!mounted.current) return
        setDrafts((current) => current.map((candidate) => candidate.draftId === latest.draftId
          ? { ...candidate, revision: latest.revision, updatedAt: latest.updatedAt }
          : candidate))
        setState((current) => current.kind === 'ready' && current.preview.previewRef === preview.previewRef
          ? { ...current, latestRevision: latest.revision }
          : current)
      } catch {
        // The preview was current when materialized. A failed later freshness read cannot replace it.
      }
    } catch (error) {
      if (!mounted.current) return
      if (error instanceof CurriculumDraftAuthoringError && error.code === 'conflict') {
        setState({ kind: 'stale-unavailable', requestedRevision: revision, latestRevision: draft.revision })
      } else {
        setState({ kind: 'unavailable', message: 'The exact preview could not be loaded safely.' })
      }
    }
  }

  useEffect(() => {
    if (!readAllowed) return
    let active = true
    void source.listDrafts().then(
      (result) => {
        if (!active) return
        setDrafts(result.drafts)
        if (!result.drafts.length) {
          setState({ kind: 'empty' })
          return
        }
        const request = initialRequest()
        const selected = result.drafts.find((draft) => draft.draftId === request.draftId) ?? result.drafts[0]
        const revision = request.draftId === selected.draftId && request.revision !== null
          ? request.revision
          : selected.revision
        void loadPreview(selected, revision)
      },
      () => {
        if (active) setState({ kind: 'unavailable', message: 'Draft choices are unavailable.' })
      },
    )
    return () => { active = false }
  // The source is a stable composition owned by the Admin route.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readAllowed, source])

  async function checkFreshness() {
    if (state.kind !== 'ready') return
    const previewRef = state.preview.previewRef
    try {
      const latest = await source.readDraft(state.preview.authority.draftId)
      if (!mounted.current) return
      setDrafts((current) => current.map((candidate) => candidate.draftId === latest.draftId
        ? { ...candidate, revision: latest.revision, updatedAt: latest.updatedAt }
        : candidate))
      setState((current) => current.kind === 'ready' && current.preview.previewRef === previewRef
        ? { ...current, latestRevision: latest.revision }
        : current)
    } catch {
      // Keep the last known freshness; a failed check cannot make a stale preview current.
    }
  }

  useEffect(() => {
    if (state.kind !== 'ready') return
    const timer = window.setInterval(() => { void checkFreshness() }, 15_000)
    return () => window.clearInterval(timer)
  // Restart the check only when the exact preview identity changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind === 'ready' ? state.preview.previewRef : null])

  if (!readAllowed) {
    return (
      <CurriculumPreviewState title="Curriculum preview access unavailable">
        No draft, candidate metadata, or validation result was loaded. Curriculum read access is required.
      </CurriculumPreviewState>
    )
  }

  if (state.kind === 'loading') {
    return <CurriculumPreviewState title="Building exact revision preview" busy>Loading the immutable base and bound draft candidate…</CurriculumPreviewState>
  }
  if (state.kind === 'empty') {
    return <CurriculumPreviewState title="No draft is available to compare">Create a draft in Curriculum Studio before requesting a preview.</CurriculumPreviewState>
  }
  if (state.kind === 'unavailable') {
    return <CurriculumPreviewState title="Curriculum preview unavailable" alert>{state.message}</CurriculumPreviewState>
  }
  if (state.kind === 'stale-unavailable') {
    const latest = drafts.find((draft) => draft.draftId === selectedDraftId)
    return (
      <CurriculumPreviewState title="Requested preview revision is stale" alert>
        Revision {state.requestedRevision} was not regenerated from revision {state.latestRevision}.{' '}
        {latest && <button type="button" onClick={() => void loadPreview(latest)}>Preview revision {latest.revision}</button>}
      </CurriculumPreviewState>
    )
  }

  return (
    <CurriculumPreviewView
      preview={state.preview}
      drafts={drafts}
      selectedDraftId={selectedDraftId}
      latestRevision={state.latestRevision}
      onDraftChange={(draftId) => {
        const draft = drafts.find((candidate) => candidate.draftId === draftId)
        if (draft) void loadPreview(draft)
      }}
      onCheckFreshness={() => { void checkFreshness() }}
      onLoadLatest={() => {
        const draft = drafts.find((candidate) => candidate.draftId === selectedDraftId)
        if (draft) void loadPreview({ ...draft, revision: state.latestRevision })
      }}
    />
  )
}

export function CurriculumPreviewState({
  title,
  children,
  alert = false,
  busy = false,
}: {
  readonly title: string
  readonly children: ReactNode
  readonly alert?: boolean
  readonly busy?: boolean
}) {
  return (
    <section className="curriculum-preview-state" aria-labelledby="curriculum-preview-state-heading" aria-busy={busy || undefined}>
      <p className="curriculum-studio-eyebrow">Preview / Diff</p>
      <h2 id="curriculum-preview-state-heading">{title}</h2>
      <div role={alert ? 'alert' : 'status'}>{children}</div>
    </section>
  )
}

export function CurriculumPreviewView({
  preview,
  drafts,
  selectedDraftId,
  latestRevision,
  onDraftChange = () => undefined,
  onCheckFreshness = () => undefined,
  onLoadLatest = () => undefined,
}: {
  readonly preview: CurriculumPreviewResult
  readonly drafts: readonly CurriculumDraftSummary[]
  readonly selectedDraftId: string
  readonly latestRevision: number
  readonly onDraftChange?: (draftId: string) => void
  readonly onCheckFreshness?: () => void
  readonly onLoadLatest?: () => void
}) {
  const [search, setSearch] = useState('')
  const [changeType, setChangeType] = useState<CurriculumPreviewChangeType | 'all'>('all')
  const [entityType, setEntityType] = useState<CurriculumDraftEntityType | 'all'>('all')
  const [selectedToken, setSelectedToken] = useState(() => {
    const initial = preview.entities.find((entity) => entity.changeType !== 'unchanged') ?? preview.entities[0]
    return initial ? curriculumPreviewEntityToken(initial) : ''
  })
  const rowRefs = useRef(new Map<string, HTMLButtonElement>())
  const filtered = useMemo(() => filterCurriculumPreview(preview, { search, changeType, entityType }), [preview, search, changeType, entityType])
  const selected = filtered.entities.find((entity) => curriculumPreviewEntityToken(entity) === selectedToken)
    ?? filtered.entities[0]
    ?? null
  const stale = isCurriculumPreviewStale(preview.authority.draftRevision, latestRevision)
  const validation = currentPreviewValidation(preview)
  const changedCount = preview.summary.added + preview.summary.modified + preview.summary.removed

  function onRowKeyDown(event: KeyboardEvent<HTMLButtonElement>, entity: CurriculumPreviewEntityDiff) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const nextToken = curriculumPreviewKeyboardTarget(
      filtered.entities,
      curriculumPreviewEntityToken(entity),
      event.key as 'ArrowDown' | 'ArrowUp' | 'Home' | 'End',
    )
    if (!nextToken) return
    setSelectedToken(nextToken)
    rowRefs.current.get(nextToken)?.focus()
  }

  return (
    <section className="curriculum-preview" aria-labelledby="curriculum-preview-heading" data-preview-ref={preview.previewRef}>
      <header className="curriculum-preview-header">
        <div>
          <p className="curriculum-studio-eyebrow">Revision-bound candidate</p>
          <h2 id="curriculum-preview-heading">Curriculum Preview / Diff</h2>
          <p>This inspection is read-only. It does not stage, publish, activate, or modify curriculum.</p>
        </div>
        <span className={`curriculum-preview-freshness ${stale ? 'is-stale' : 'is-current'}`} role="status">
          {stale ? `Stale · draft is now revision ${latestRevision}` : `Current · revision ${preview.authority.draftRevision}`}
        </span>
      </header>

      <div className="curriculum-preview-toolbar">
        <label htmlFor="curriculum-preview-draft">Draft</label>
        <select id="curriculum-preview-draft" value={selectedDraftId} onChange={(event) => onDraftChange(event.target.value)}>
          {drafts.map((draft) => <option key={draft.draftId} value={draft.draftId}>{draft.targetVersion} · revision {draft.revision}</option>)}
        </select>
        <button type="button" onClick={onCheckFreshness}>Check freshness</button>
        {stale && <button type="button" className="is-primary" onClick={onLoadLatest}>Preview revision {latestRevision}</button>}
      </div>

      <dl className="curriculum-preview-authority" aria-label="Preview authority">
        <Fact label="Draft ID" value={preview.authority.draftId} />
        <Fact label="Base release" value={preview.authority.baseReleaseVersion} />
        <Fact label="Target version" value={preview.authority.targetVersion} />
        <Fact label="Draft revision" value={String(preview.authority.draftRevision)} />
        <Fact label="Schema Set" value={preview.authority.schemaSetVersion} />
        <Fact label="Candidate fingerprint" value={preview.authority.candidateDigest.slice(0, 16)} title={preview.authority.candidateDigest} />
      </dl>

      {stale && (
        <div className="curriculum-preview-stale" role="alert">
          This preview remains bound to revision {preview.authority.draftRevision}. Revision {latestRevision} has not been previewed.
        </div>
      )}
      {!changedCount && <div className="curriculum-preview-no-change" role="status">No candidate changes. The exact draft candidate matches its published base.</div>}

      <div className="curriculum-preview-summary" aria-label="Candidate change summary">
        <SummaryMetric label="Unchanged" value={preview.summary.unchanged} />
        <SummaryMetric label="Added" value={preview.summary.added} />
        <SummaryMetric label="Modified" value={preview.summary.modified} />
        <SummaryMetric label="Removed" value={preview.summary.removed} />
        <SummaryMetric label="Candidate entities" value={preview.summary.candidateEntities} />
        <SummaryMetric label="Validation blockers" value={validation ? preview.summary.validationBlockers : '—'} warning={Boolean(validation && preview.summary.validationBlockers > 0)} />
      </div>

      <section className="curriculum-preview-validation" aria-labelledby="curriculum-preview-validation-heading">
        <div>
          <p className="curriculum-studio-eyebrow">Exact-revision validation</p>
          <h3 id="curriculum-preview-validation-heading">
            {validation ? `Validation: ${validation.status}` : 'Validation is not current for this preview'}
          </h3>
          <p>{validation?.statusMessage ?? 'A validation result from another revision is never treated as current.'}</p>
        </div>
        <dl>
          <Fact label="Blocking findings" value={String(validation?.summary.blocking ?? '—')} />
          <Fact label="Human-review blockers" value={validation ? String(preview.summary.humanReviewBlockers) : '—'} />
          <Fact label="Standards blockers" value={validation ? String(preview.summary.standardsBlockers) : '—'} />
          <Fact label="Publication ready" value={validation?.publicationReady ? 'Yes' : 'No'} />
        </dl>
        {validation && validation.findings.filter((finding) => finding.blocking).length > 0 && (
          <ul className="curriculum-preview-blockers" aria-label="Validation blockers">
            {validation.findings.filter((finding) => finding.blocking).slice(0, 25).map((finding) => (
              <li key={finding.id}>
                <strong>{finding.category}</strong> · {finding.explanation}
                {finding.entity.id && <span>{finding.entity.type}: {finding.entity.id}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="curriculum-preview-filters" role="search" aria-label="Filter curriculum differences">
        <label>
          Search
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, reference, or context" />
        </label>
        <label>
          Change type
          <select value={changeType} onChange={(event) => setChangeType(event.target.value as CurriculumPreviewChangeType | 'all')}>
            <option value="all">All changes</option>
            {curriculumPreviewFilterOptions.changeTypes.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>
          Entity type
          <select value={entityType} onChange={(event) => setEntityType(event.target.value as CurriculumDraftEntityType | 'all')}>
            <option value="all">All entity types</option>
            {curriculumPreviewFilterOptions.entityTypes.map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}
          </select>
        </label>
        <p role="status">Showing {filtered.entities.length} of {filtered.total} matches</p>
      </div>

      <div className="curriculum-preview-grid">
        <section className="curriculum-preview-entities" aria-labelledby="curriculum-preview-entities-heading">
          <header>
            <h3 id="curriculum-preview-entities-heading">Entity differences</h3>
            <span>{preview.summary.totalCompared} compared</span>
          </header>
          {filtered.entities.length ? (
            <ul aria-label="Curriculum entity differences">
              {filtered.entities.map((entity) => (
                <li key={`${entity.entityType}:${entity.entityRef}`}>
                  <button
                    type="button"
                    ref={(node) => {
                      const token = curriculumPreviewEntityToken(entity)
                      if (node) rowRefs.current.set(token, node); else rowRefs.current.delete(token)
                    }}
                    className={selected && curriculumPreviewEntityToken(selected) === curriculumPreviewEntityToken(entity) ? 'is-selected' : ''}
                    aria-pressed={selected ? curriculumPreviewEntityToken(selected) === curriculumPreviewEntityToken(entity) : false}
                    onClick={() => setSelectedToken(curriculumPreviewEntityToken(entity))}
                    onKeyDown={(event) => onRowKeyDown(event, entity)}
                  >
                    <span className={`curriculum-preview-change is-${entity.changeType}`}>{entity.changeType}</span>
                    <strong>{entity.label}</strong>
                    <small>{entity.entityType.replace('_', ' ')} · {entity.entityRef}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="curriculum-preview-empty">No entity differences match these filters.</p>}
          {filtered.limited && (
            <p className="curriculum-preview-limit" role="status">
              Rendering is capped at {CURRICULUM_PREVIEW_RENDER_LIMIT} rows. Summary counts still cover the complete candidate.
            </p>
          )}
        </section>

        <EntityDiffDetail entity={selected} />
      </div>
    </section>
  )
}

function EntityDiffDetail({ entity }: { readonly entity: CurriculumPreviewEntityDiff | null }) {
  if (!entity) {
    return <section className="curriculum-preview-detail" aria-label="Selected entity difference"><p>Select an entity difference.</p></section>
  }
  return (
    <section className="curriculum-preview-detail" aria-labelledby="curriculum-preview-detail-heading">
      <header>
        <div>
          <p className="curriculum-studio-eyebrow">{entity.entityType.replace('_', ' ')}</p>
          <h3 id="curriculum-preview-detail-heading">{entity.label}</h3>
          <p>{entity.entityRef} · {entity.context}</p>
        </div>
        <span className={`curriculum-preview-change is-${entity.changeType}`}>{entity.changeType}</span>
      </header>
      {entity.changeType === 'unchanged' ? (
        <div className="curriculum-preview-unchanged" role="status">No authored or ordering fields differ from the published base.</div>
      ) : entity.fieldChanges.length ? (
        <div className="curriculum-preview-field-table" role="table" aria-label="Structured before and after changes">
          <div role="row" className="curriculum-preview-field-header">
            <span role="columnheader">Field</span><span role="columnheader">Published base</span><span role="columnheader">Draft candidate</span>
          </div>
          {entity.fieldChanges.map((change) => (
            <div role="row" key={change.path}>
              <span role="rowheader"><strong>{change.label}</strong><small>{change.category}</small></span>
              <span role="cell">{change.before.display}</span>
              <span role="cell">{change.after.display}</span>
            </div>
          ))}
          {entity.fieldChangesLimited && <p role="status">Showing {entity.fieldChanges.length} of {entity.fieldChangeCount} structured field changes.</p>}
        </div>
      ) : <div className="curriculum-preview-unchanged">The entity changed only in fields withheld from Admin preview.</div>}
    </section>
  )
}

function Fact({ label, value, title }: { readonly label: string; readonly value: string; readonly title?: string }) {
  return <div><dt>{label}</dt><dd title={title}>{value}</dd></div>
}

function SummaryMetric({ label, value, warning = false }: { readonly label: string; readonly value: number | string; readonly warning?: boolean }) {
  return <div className={warning ? 'is-warning' : ''}><span>{label}</span><strong>{typeof value === 'number' ? value.toLocaleString() : value}</strong></div>
}
