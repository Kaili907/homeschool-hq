import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import type { AdminCapability } from '../contracts'
import type { CurriculumCatalog, CurriculumReadAuthorization } from './contracts'
import {
  buildCurriculumStudioIndex,
  canWriteCurriculumDrafts,
  curriculumTreeKeyboardAction,
  expandedAncestorsFor,
  resolveCurriculumStudioEntity,
  visibleCurriculumStudioRows,
  type CurriculumStudioEntity,
  type CurriculumStudioIndex,
  type CurriculumStudioRow,
  type CurriculumStudioSource,
  type CurriculumTreeKey,
} from './studioModel'
import './curriculum-studio.css'

const TREE_KEYS = new Set<CurriculumTreeKey>([
  'ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'Enter', ' ',
])

export interface CurriculumStudioProps {
  readonly authorization: CurriculumReadAuthorization
  readonly source: CurriculumStudioSource
}

export function CurriculumStudio({ authorization, source }: CurriculumStudioProps) {
  const canRead = authorization.status === 'authorized'
    && authorization.capabilities.includes('curriculum:read')
  const [catalog, setCatalog] = useState<CurriculumCatalog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!canRead) {
      setCatalog(null)
      return
    }
    let current = true
    setCatalog(null)
    setError(null)
    source.loadPublishedCatalog().then(
      (next) => { if (current) setCatalog(next) },
      (reason: unknown) => {
        if (current) setError(reason instanceof Error ? reason.message : 'Unknown curriculum source failure')
      },
    )
    return () => { current = false }
  }, [canRead, reload, source])

  if (authorization.status === 'checking') {
    return <StudioState role="status" title="Checking Curriculum Studio access">Published curriculum has not been requested yet.</StudioState>
  }
  if (!canRead) {
    return (
      <StudioState role="alert" title="Curriculum Studio access unavailable">
        This Admin session does not have the curriculum:read capability. No hierarchy or entity metadata was loaded.
      </StudioState>
    )
  }
  if (error) {
    return (
      <StudioState role="alert" title="Published curriculum unavailable" onRetry={() => setReload((value) => value + 1)}>
        The Studio could not load its published navigation source: {error}
      </StudioState>
    )
  }
  if (!catalog) {
    return <StudioState role="status" title="Loading Curriculum Studio">Loading the authorized published hierarchy.</StudioState>
  }
  return <CurriculumStudioView catalog={catalog} capabilities={authorization.capabilities} />
}

function StudioState({
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
    <section className="curriculum-studio-state" role={role} aria-labelledby="curriculum-studio-state-title">
      <p className="curriculum-studio-eyebrow">Curriculum Studio</p>
      <h2 id="curriculum-studio-state-title">{title}</h2>
      <p>{children}</p>
      {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
    </section>
  )
}

export function CurriculumStudioView({
  catalog,
  capabilities,
}: {
  readonly catalog: CurriculumCatalog
  readonly capabilities: readonly AdminCapability[]
}) {
  const index = useMemo(() => buildCurriculumStudioIndex(catalog), [catalog])
  const initial = useMemo(() => initialStudioRow(index), [index])
  const [selectedId, setSelectedId] = useState(initial?.id ?? '')
  const [focusedId, setFocusedId] = useState(initial?.id ?? '')
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => {
    const expanded = new Set(initial ? expandedAncestorsFor(index, initial.id) : [])
    if (initial?.hasChildren) expanded.add(initial.id)
    return expanded
  })
  const [query, setQuery] = useState('')
  const focusRequested = useRef(false)
  const itemRefs = useRef(new Map<string, HTMLButtonElement>())
  const visible = useMemo(
    () => visibleCurriculumStudioRows(index, expandedIds, query),
    [expandedIds, index, query],
  )
  const selected = resolveCurriculumStudioEntity(index, selectedId) ?? index.rows[0] ?? null
  const draftCapable = canWriteCurriculumDrafts(capabilities)

  useEffect(() => {
    if (selected) return
    const fallback = index.rows[0]
    if (fallback) {
      setSelectedId(fallback.id)
      setFocusedId(fallback.id)
    }
  }, [index, selected])

  useEffect(() => {
    if (!focusRequested.current) return
    focusRequested.current = false
    itemRefs.current.get(focusedId)?.focus()
  }, [focusedId, visible.rows])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPopState = () => {
      const token = new URLSearchParams(window.location.search).get('entity')
      const row = resolveCurriculumStudioEntity(index, token)
      if (!row) return
      setSelectedId(row.id)
      setFocusedId(row.id)
      setExpandedIds((current) => unionSets(current, expandedAncestorsFor(index, row.id)))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [index])

  function selectRow(row: CurriculumStudioRow, updateHistory = true) {
    setSelectedId(row.id)
    setFocusedId(row.id)
    setExpandedIds((current) => unionSets(current, expandedAncestorsFor(index, row.id)))
    if (updateHistory) writeStudioEntityLocation(row.id)
  }

  function toggleRow(row: CurriculumStudioRow) {
    if (!row.hasChildren) return
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(row.id)) next.delete(row.id)
      else next.add(row.id)
      return next
    })
  }

  function handleTreeKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!TREE_KEYS.has(event.key as CurriculumTreeKey)) return
    event.preventDefault()
    const action = curriculumTreeKeyboardAction(
      visible.rows,
      event.currentTarget.dataset.entityId ?? focusedId,
      expandedIds,
      event.key as CurriculumTreeKey,
    )
    if (!action) return
    if (action.toggleId) {
      const row = index.byId.get(action.toggleId)
      if (row) toggleRow(row)
    }
    if (action.selectId) {
      const row = index.byId.get(action.selectId)
      if (row) selectRow(row)
    }
    focusRequested.current = true
    setFocusedId(action.focusId)
  }

  return (
    <div className="curriculum-studio" data-draft-service="not-connected">
      <header className="curriculum-studio-header">
        <div>
          <p className="curriculum-studio-eyebrow">Published navigation · authoring seam ready</p>
          <h2>Curriculum Studio</h2>
          <p>
            Package <strong>{catalog.source.packageId}</strong> · version <strong>{catalog.source.version}</strong>
          </p>
        </div>
        <div className="curriculum-studio-connection" role="status">
          <span aria-hidden="true" />
          Draft service not connected
        </div>
      </header>

      <div className="curriculum-studio-grid">
        <aside className="curriculum-studio-pane curriculum-studio-tree-pane" aria-label="Curriculum hierarchy">
          <div className="curriculum-studio-pane-heading">
            <div><p>Navigator</p><h3>Curriculum</h3></div>
            <span>{catalog.lessons.length.toLocaleString()} lessons</span>
          </div>
          <label className="curriculum-studio-search">
            <span className="admin-sr-only">Filter curriculum hierarchy</span>
            <input
              type="search"
              value={query}
              placeholder="Find a course, unit, or lesson"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <p className="curriculum-tree-help" id="curriculum-tree-help">
            Arrow keys navigate. Right and left expand or collapse. Enter selects.
          </p>
          {visible.rows.length === 0 ? (
            <div className="curriculum-tree-empty" role="status">No curriculum entities match “{query}”.</div>
          ) : (
            <ul className="curriculum-tree" role="tree" aria-label="Published curriculum hierarchy" aria-describedby="curriculum-tree-help">
              {visible.rows.map((row) => {
                const expanded = row.hasChildren ? expandedIds.has(row.id) : undefined
                return (
                  <li key={row.id} role="none">
                    <div
                      className={`curriculum-tree-row${selected?.id === row.id ? ' is-selected' : ''}`}
                      style={{ '--curriculum-tree-depth': row.depth } as CSSProperties}
                    >
                      {row.hasChildren ? (
                        <button
                          type="button"
                          className="curriculum-tree-toggle"
                          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${row.label}`}
                          tabIndex={-1}
                          onClick={() => toggleRow(row)}
                        >
                          <span aria-hidden="true">{expanded ? '−' : '+'}</span>
                        </button>
                      ) : <span className="curriculum-tree-leaf" aria-hidden="true">•</span>}
                      <button
                        type="button"
                        role="treeitem"
                        ref={(node) => {
                          if (node) itemRefs.current.set(row.id, node)
                          else itemRefs.current.delete(row.id)
                        }}
                        data-entity-id={row.id}
                        aria-level={row.depth}
                        aria-expanded={expanded}
                        aria-selected={selected?.id === row.id}
                        tabIndex={focusedId === row.id ? 0 : -1}
                        onFocus={() => setFocusedId(row.id)}
                        onKeyDown={handleTreeKey}
                        onClick={() => selectRow(row)}
                      >
                        <span>{row.label}</span>
                        <small>{row.context}</small>
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {visible.limited && (
            <p className="curriculum-tree-limit" role="status">
              Showing {visible.rows.length} of {visible.total} matching rows. Refine the filter or collapse branches.
            </p>
          )}
        </aside>

        <section className="curriculum-studio-pane curriculum-studio-editor" aria-label="Selected entity editor workspace">
          {selected ? (
            <EntityEditor row={selected} catalog={catalog} draftCapable={draftCapable} />
          ) : (
            <div className="curriculum-studio-empty" role="status">
              <h3>No curriculum entity available</h3>
              <p>The authorized published catalog is empty.</p>
            </div>
          )}
        </section>

        <aside className="curriculum-studio-pane curriculum-studio-inspector" aria-label="Curriculum metadata and status inspector">
          <Inspector catalog={catalog} selected={selected} draftCapable={draftCapable} />
        </aside>
      </div>
    </div>
  )
}

function EntityEditor({
  row,
  catalog,
  draftCapable,
}: {
  readonly row: CurriculumStudioRow
  readonly catalog: CurriculumCatalog
  readonly draftCapable: boolean
}) {
  return (
    <>
      <header className="curriculum-editor-heading">
        <div>
          <p>{entityKindLabel(row.entity)} · Published reference</p>
          <h3>{row.label}</h3>
          <span>{row.context}</span>
        </div>
        <span className="curriculum-readonly-badge">Read-only source</span>
      </header>
      <div className={`curriculum-draft-notice${draftCapable ? ' is-pending-connection' : ''}`} role="status">
        <strong>{draftCapable ? 'Authoring is not connected' : 'Read-only Admin session'}</strong>
        <p>
          {draftCapable
            ? 'Your role can author drafts, but the draft service is unavailable in this shell. Editing and save controls are disabled; no save is implied.'
            : 'Your role can inspect published curriculum but does not include curriculum:drafts:write. No editing or save controls are available.'}
        </p>
      </div>
      <PublishedEntitySummary entity={row.entity} catalog={catalog} />
      <section className="curriculum-editor-slots" aria-labelledby="curriculum-editor-slots-heading">
        <div className="curriculum-section-heading">
          <div><p>Future authoring surface</p><h4 id="curriculum-editor-slots-heading">Editor structure</h4></div>
          <span>Awaiting draft adapter</span>
        </div>
        <div className="curriculum-slot-grid">
          <EditorSlot name="lesson-fields" title="Lesson fields">Objectives, lesson flow, formative checks, and guidance.</EditorSlot>
          <EditorSlot name="assessment-fields" title="Assessment fields">Prompts, scoring, rubrics, and accommodations.</EditorSlot>
          <EditorSlot name="resources" title="Resources">Applicable resource references and media fallbacks.</EditorSlot>
          <EditorSlot name="standards-mastery" title="Standards & mastery">Alignment, success criteria, and mastery evidence.</EditorSlot>
          <EditorSlot name="tutor-routes" title="Tutor routes">Signals, actions, and protected instructional routes.</EditorSlot>
          <EditorSlot name="safety-privacy" title="Safety & privacy">Safeguards, visibility, and privacy constraints.</EditorSlot>
          <EditorSlot name="accessibility" title="Accessibility">Accommodations and accessible alternatives.</EditorSlot>
        </div>
      </section>
    </>
  )
}

function EditorSlot({ name, title, children }: { readonly name: string; readonly title: string; readonly children: ReactNode }) {
  return (
    <article className="curriculum-editor-slot" data-editor-slot={name} aria-disabled="true">
      <span aria-hidden="true">◇</span>
      <div><h5>{title}</h5><p>{children}</p></div>
    </article>
  )
}

function PublishedEntitySummary({ entity, catalog }: { readonly entity: CurriculumStudioEntity; readonly catalog: CurriculumCatalog }) {
  let values: readonly [string, string][]
  if (entity.kind === 'grade') {
    values = [
      ['Grade', String(entity.grade)],
      ['Courses', String(catalog.courses.filter((course) => course.grade === entity.grade).length)],
      ['Units', String(catalog.units.filter((unit) => unit.grade === entity.grade).length)],
      ['Lessons', String(catalog.lessons.filter((lesson) => lesson.grade === entity.grade).length)],
    ]
  } else if (entity.kind === 'course') {
    values = [
      ['Course ID', entity.course.courseId], ['Subject', entity.course.subject],
      ['Grade', String(entity.course.grade)], ['Instructional days', String(entity.course.days)],
    ]
  } else if (entity.kind === 'unit') {
    values = [
      ['Unit ID', entity.unit.unitId], ['Course', entity.unit.courseId],
      ['Instructional days', String(entity.unit.days)], ['Standards', entity.unit.standards.join(', ') || 'Not indexed'],
      ['Topics', entity.unit.topics.join(', ') || 'Not indexed'], ['Assessment', entity.unit.assessmentId ?? 'Not indexed'],
    ]
  } else if (entity.kind === 'lesson') {
    values = [
      ['Lesson ID', entity.lesson.lessonId], ['Course day', String(entity.lesson.courseDay)],
      ['Unit day', String(entity.lesson.dayInUnit)], ['Phase', entity.lesson.phase ?? 'Not indexed'],
      ['Focus', entity.lesson.focus ?? 'Not indexed'], ['Standards', entity.lesson.standards.join(', ') || 'Not indexed'],
    ]
  } else {
    values = [
      ['Assessment ID', entity.assessment.assessmentId], ['Course', entity.assessment.courseId],
      ['Unit', String(entity.assessment.unitNumber)], ['Total points', String(entity.assessment.totalPoints ?? 'Not indexed')],
      ['Standards', entity.assessment.standards.join(', ') || 'Not indexed'],
    ]
  }
  return (
    <section className="curriculum-published-summary" aria-labelledby="published-entity-summary-heading">
      <div className="curriculum-section-heading">
        <div><p>Existing metadata</p><h4 id="published-entity-summary-heading">Published summary</h4></div>
      </div>
      <dl>{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>
  )
}

function Inspector({
  catalog,
  selected,
  draftCapable,
}: {
  readonly catalog: CurriculumCatalog
  readonly selected: CurriculumStudioRow | null
  readonly draftCapable: boolean
}) {
  return (
    <div className="curriculum-inspector-content">
      <div className="curriculum-studio-pane-heading"><div><p>Inspector</p><h3>Metadata & status</h3></div></div>
      <InspectorSection title="Lifecycle">
        <StatusLine label="Published source" value={catalog.source.lifecycle} tone="positive" />
        <StatusLine label="Draft service" value="Not connected" tone="warning" />
        <StatusLine label="Save state" value="No save attempted" />
      </InspectorSection>
      <InspectorSection title="Selection">
        <dl className="curriculum-inspector-list">
          <div><dt>Type</dt><dd>{selected ? entityKindLabel(selected.entity) : 'None'}</dd></div>
          <div><dt>Stable ID</dt><dd>{selected?.id ?? 'None'}</dd></div>
          <div><dt>Source version</dt><dd>{catalog.source.version}</dd></div>
        </dl>
      </InspectorSection>
      <InspectorSection title="Access">
        <p>{draftCapable ? 'Draft-capable Admin role' : 'Published read-only role'}</p>
        <small>
          {draftCapable
            ? 'The role includes curriculum:drafts:write; the service connection is still required.'
            : 'The role does not include curriculum:drafts:write.'}
        </small>
      </InspectorSection>
      <InspectorSection title="Validation">
        <StatusLine
          label="Published evidence"
          value={catalog.source.validationStatus === 'passed' ? 'Passed' : 'Unavailable'}
          tone={catalog.source.validationStatus === 'passed' ? 'positive' : 'warning'}
        />
        <a href="/academy/admin/curriculum/validation">Open validation evidence</a>
      </InspectorSection>
      <InspectorSection title="Resources">
        <p>Resource records are not exposed by the published summary index.</p>
        <small>The editor slot remains available for the future draft adapter without inventing resource data.</small>
      </InspectorSection>
    </div>
  )
}

function InspectorSection({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return <section className="curriculum-inspector-section"><h4>{title}</h4>{children}</section>
}

function StatusLine({ label, value, tone = 'neutral' }: { readonly label: string; readonly value: string; readonly tone?: 'neutral' | 'positive' | 'warning' }) {
  return <div className={`curriculum-status-line is-${tone}`}><span>{label}</span><strong>{value}</strong></div>
}

function entityKindLabel(entity: CurriculumStudioEntity): string {
  return entity.kind[0].toUpperCase() + entity.kind.slice(1)
}

function initialStudioRow(index: CurriculumStudioIndex): CurriculumStudioRow | null {
  if (typeof window !== 'undefined') {
    const token = new URLSearchParams(window.location.search).get('entity')
    const selected = resolveCurriculumStudioEntity(index, token)
    if (selected) return selected
  }
  return index.rows[0] ?? null
}

export function writeStudioEntityLocation(entityId: string): void {
  if (typeof window === 'undefined') return
  const next = new URL(window.location.href)
  next.searchParams.set('entity', entityId)
  window.history.pushState({}, '', `${next.pathname}${next.search}${next.hash}`)
}

function unionSets(left: ReadonlySet<string>, right: ReadonlySet<string>): ReadonlySet<string> {
  return new Set([...left, ...right])
}
