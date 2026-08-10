import { useMemo, useState, type FormEvent } from 'react'
import {
  CURRICULUM_STANDARDS_REVIEW_STATES,
  type CurriculumStandardsReviewDecision,
  type CurriculumStandardsReviewContextKind,
  type CurriculumStandardsReviewItem,
  type CurriculumStandardsReviewState,
} from '../../admin/curriculum-standards-review/contracts'
import {
  buildCurriculumStandardsReviewQueue,
  filterCurriculumStandardsReviewQueue,
  groupCurriculumStandardsReviewQueue,
  type CurriculumStandardsReviewGroupBy,
  type CurriculumStandardsReviewOccurrence,
} from '../../admin/curriculum-standards-review/model'
import {
  KNOWN_STANDARDS_REVIEW_CONTEXT,
  knownCurriculumStandardsReviewOccurrences,
} from '../../admin/curriculum-standards-review/knownEvidence'

export type CurriculumStandardsReviewReadState =
  | { readonly status: 'loading' }
  | { readonly status: 'denied' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly decisions: readonly CurriculumStandardsReviewDecision[] }

export interface StandardsReviewFormValue {
  readonly status: Exclude<CurriculumStandardsReviewState, 'unreviewed'>
  readonly canonicalStandardId: string | null
  readonly frameworkVersion: string | null
  readonly canonicalTitle: string | null
  readonly evidenceSource: string | null
  readonly reviewerNote: string | null
}

export interface CurriculumStandardsReviewWorkspaceProps {
  readonly readState: CurriculumStandardsReviewReadState
  readonly occurrences?: readonly CurriculumStandardsReviewOccurrence[]
  readonly context?: { readonly kind: CurriculumStandardsReviewContextKind; readonly ref: string }
  readonly canManage: boolean
  readonly canApprove: boolean
  readonly savingReviewKey?: string | null
  readonly saveError?: 'invalid' | 'conflict' | 'forbidden' | 'unavailable' | null
  readonly onRetry?: () => void
  readonly onUpdate?: (item: CurriculumStandardsReviewItem, value: StandardsReviewFormValue) => void
}

const STATUS_LABELS: Readonly<Record<CurriculumStandardsReviewState, string>> = {
  unreviewed: 'Unreviewed',
  in_review: 'In review',
  approved_mapping: 'Approved mapping',
  rejected_mapping: 'Rejected mapping',
  needs_evidence: 'Needs evidence',
}

const GROUP_LABELS: Readonly<Record<CurriculumStandardsReviewGroupBy, string>> = {
  'source-label': 'Source label', grade: 'Grade', course: 'Course', draft: 'Draft or release',
  'affected-count': 'Affected entity count', status: 'Review status',
}

const KNOWN_OCCURRENCES = knownCurriculumStandardsReviewOccurrences()

function message(error: NonNullable<CurriculumStandardsReviewWorkspaceProps['saveError']>): string {
  if (error === 'invalid') return 'The decision is incomplete. Approved mappings require every evidence field.'
  if (error === 'conflict') return 'This review changed elsewhere. Reload the queue before saving again.'
  if (error === 'forbidden') return 'Your current Admin capability does not authorize this decision.'
  return 'The review decision could not be saved. No curriculum content was changed.'
}

function clean(value: string): string | null {
  const normalized = value.trim()
  return normalized || null
}

export function CurriculumStandardsReviewWorkspace({
  readState,
  occurrences = KNOWN_OCCURRENCES,
  context = KNOWN_STANDARDS_REVIEW_CONTEXT,
  canManage,
  canApprove,
  savingReviewKey = null,
  saveError = null,
  onRetry,
  onUpdate,
}: CurriculumStandardsReviewWorkspaceProps) {
  if (readState.status === 'loading') return <section aria-busy="true" aria-label="Loading curriculum standards review"><p>Loading standards review queue…</p></section>
  if (readState.status === 'denied') return <section role="alert"><h2>Standards review unavailable</h2><p>Curriculum read capability is required.</p></section>
  if (readState.status === 'error') return <section role="alert"><h2>Standards review unavailable</h2><p>The decision ledger could not be read. No substitute decisions are shown.</p><button type="button" onClick={onRetry}>Try again</button></section>
  return <ReadyWorkspace {...{ decisions: readState.decisions, occurrences, context, canManage, canApprove, savingReviewKey, saveError, onUpdate }} />
}

function ReadyWorkspace({
  decisions,
  occurrences,
  context,
  canManage,
  canApprove,
  savingReviewKey,
  saveError,
  onUpdate,
}: {
  readonly decisions: readonly CurriculumStandardsReviewDecision[]
  readonly occurrences: readonly CurriculumStandardsReviewOccurrence[]
  readonly context: { readonly kind: CurriculumStandardsReviewContextKind; readonly ref: string }
  readonly canManage: boolean
  readonly canApprove: boolean
  readonly savingReviewKey: string | null
  readonly saveError: CurriculumStandardsReviewWorkspaceProps['saveError']
  readonly onUpdate?: CurriculumStandardsReviewWorkspaceProps['onUpdate']
}) {
  const [query, setQuery] = useState('')
  const [grade, setGrade] = useState<number | 'all'>('all')
  const [course, setCourse] = useState('all')
  const [status, setStatus] = useState<CurriculumStandardsReviewState | 'all'>('all')
  const [groupBy, setGroupBy] = useState<CurriculumStandardsReviewGroupBy>('source-label')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const items = useMemo(() => buildCurriculumStandardsReviewQueue(
    occurrences, context, decisions,
  ), [decisions, occurrences, context])
  const filtered = useMemo(() => filterCurriculumStandardsReviewQueue(items, {
    query, grade, courseRef: course, status,
  }), [items, query, grade, course, status])
  const groups = useMemo(() => groupCurriculumStandardsReviewQueue(filtered, groupBy), [filtered, groupBy])
  const selected = items.find((item) => item.reviewKey === selectedKey) ?? filtered[0] ?? null
  const courses = [...new Set(items.map((item) => item.courseRef))].sort()
  const unresolved = items.filter((item) => item.status !== 'approved_mapping')
    .reduce((total, item) => total + item.affectedCount, 0)

  return (
    <section aria-labelledby="standards-review-title" className="min-w-0 space-y-5 text-slate-100">
      <header className="rounded-2xl border border-slate-700 bg-slate-950 p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">Curriculum metadata only</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="standards-review-title" className="text-2xl font-bold sm:text-3xl">Human standards review</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Preserved local labels remain publication-blocking until an authorized human records complete verified evidence. This workspace never guesses official standards facts.</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-slate-900 p-3"><dt className="text-slate-400">Queue items</dt><dd className="text-xl font-bold">{items.length}</dd></div>
            <div className="rounded-xl bg-slate-900 p-3"><dt className="text-slate-400">Affected refs</dt><dd className="text-xl font-bold">{items.reduce((sum, item) => sum + item.affectedCount, 0)}</dd></div>
            <div className="col-span-2 rounded-xl bg-amber-950/60 p-3 sm:col-span-1"><dt className="text-amber-200">Still blocking</dt><dd className="text-xl font-bold">{unresolved}</dd></div>
          </dl>
        </div>
      </header>

      <div className="grid gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Standards review filters">
        <label className="text-sm" htmlFor="standards-review-query">Search<input id="standards-review-query" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Label, course, entity…" className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2" /></label>
        <label className="text-sm" htmlFor="standards-review-grade">Grade<select id="standards-review-grade" value={grade} onChange={(event) => setGrade(event.target.value === 'all' ? 'all' : Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2"><option value="all">All grades</option>{[5, 7, 8].map((value) => <option key={value} value={value}>Grade {value}</option>)}</select></label>
        <label className="text-sm" htmlFor="standards-review-course">Course<select id="standards-review-course" value={course} onChange={(event) => setCourse(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2"><option value="all">All courses</option>{courses.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-sm" htmlFor="standards-review-status">Review status<select id="standards-review-status" value={status} onChange={(event) => setStatus(event.target.value as CurriculumStandardsReviewState | 'all')} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2"><option value="all">All states</option>{CURRICULUM_STANDARDS_REVIEW_STATES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</select></label>
        <label className="text-sm" htmlFor="standards-review-group">Group by<select id="standards-review-group" value={groupBy} onChange={(event) => setGroupBy(event.target.value as CurriculumStandardsReviewGroupBy)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2">{Object.entries(GROUP_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,.9fr)]">
        <div className="min-w-0 space-y-4" id="standards-review-results" aria-live="polite">
          {groups.length === 0 && <p className="rounded-xl border border-slate-700 bg-slate-900 p-5">No review items match these filters.</p>}
          {groups.map((group) => <ReviewGroup key={group.key} group={group} selectedKey={selected?.reviewKey ?? null} onSelect={setSelectedKey} />)}
        </div>
        {selected && <ReviewPanel key={`${selected.reviewKey}:${selected.decision?.revision ?? 0}`} item={selected} canManage={canManage} canApprove={canApprove} saving={savingReviewKey === selected.reviewKey} saveError={saveError} onUpdate={onUpdate} />}
      </div>
    </section>
  )
}

function ReviewGroup({ group, selectedKey, onSelect }: {
  readonly group: ReturnType<typeof groupCurriculumStandardsReviewQueue>[number]
  readonly selectedKey: string | null
  readonly onSelect: (key: string) => void
}) {
  return <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900" aria-labelledby={`review-group-${group.key}`}>
    <header className="flex items-center justify-between gap-3 border-b border-slate-700 px-4 py-3"><h3 id={`review-group-${group.key}`} className="font-semibold capitalize">{group.label}</h3><span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs">{group.affectedCount} affected</span></header>
    <ul className="divide-y divide-slate-800">{group.items.map((item) => <li key={item.reviewKey}><button type="button" onClick={() => onSelect(item.reviewKey)} aria-pressed={selectedKey === item.reviewKey} className={`grid w-full gap-2 px-4 py-3 text-left sm:grid-cols-[1fr_auto] ${selectedKey === item.reviewKey ? 'bg-cyan-950/50' : 'hover:bg-slate-800'}`}><span><strong>Local label {item.sourceLabel}</strong><span className="mt-1 block break-all text-xs text-slate-400">Grade {item.grade} · {item.courseRef}</span></span><span className="flex items-center gap-2 text-xs"><span className="capitalize text-slate-300">{STATUS_LABELS[item.status]}</span><span className="rounded-full bg-slate-950 px-2 py-1">{item.affectedCount}</span></span></button></li>)}</ul>
  </section>
}

function ReviewPanel({ item, canManage, canApprove, saving, saveError, onUpdate }: {
  readonly item: CurriculumStandardsReviewItem
  readonly canManage: boolean
  readonly canApprove: boolean
  readonly saving: boolean
  readonly saveError: CurriculumStandardsReviewWorkspaceProps['saveError']
  readonly onUpdate?: CurriculumStandardsReviewWorkspaceProps['onUpdate']
}) {
  const [status, setStatus] = useState<Exclude<CurriculumStandardsReviewState, 'unreviewed'>>(
    item.status === 'unreviewed' ? 'in_review' : item.status,
  )
  const [canonicalStandardId, setCanonicalStandardId] = useState(item.decision?.canonicalStandardId ?? '')
  const [frameworkVersion, setFrameworkVersion] = useState(item.decision?.frameworkVersion ?? '')
  const [canonicalTitle, setCanonicalTitle] = useState(item.decision?.canonicalTitle ?? '')
  const [evidenceSource, setEvidenceSource] = useState(item.decision?.evidenceSource ?? '')
  const [reviewerNote, setReviewerNote] = useState(item.decision?.reviewerNote ?? '')
  const [localError, setLocalError] = useState<string | null>(null)
  const approving = status === 'approved_mapping'

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!canManage || (approving && !canApprove)) return
    const required = approving
      ? [canonicalStandardId, frameworkVersion, canonicalTitle, evidenceSource, reviewerNote]
      : ['rejected_mapping', 'needs_evidence'].includes(status) ? [reviewerNote] : []
    if (required.some((value) => !value.trim()) || (required.length > 0 && reviewerNote.trim().length < 8)) {
      setLocalError('Complete every required evidence field; decision notes must be at least 8 characters.')
      return
    }
    setLocalError(null)
    onUpdate?.(item, {
      status,
      canonicalStandardId: approving ? clean(canonicalStandardId) : null,
      frameworkVersion: approving ? clean(frameworkVersion) : null,
      canonicalTitle: approving ? clean(canonicalTitle) : null,
      evidenceSource: approving ? clean(evidenceSource) : null,
      reviewerNote: clean(reviewerNote),
    })
  }

  return <aside className="min-w-0 self-start rounded-2xl border border-slate-700 bg-slate-900 p-5 xl:sticky xl:top-4" aria-labelledby="review-panel-title">
    <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Review decision</p>
    <h3 id="review-panel-title" className="mt-1 text-xl font-bold">Local label {item.sourceLabel}</h3>
    <p className="mt-1 break-all text-sm text-slate-400">Grade {item.grade} · {item.courseRef} · release {item.contextRef}</p>
    <details className="mt-4 rounded-xl border border-slate-700 bg-slate-950 p-3">
      <summary className="cursor-pointer font-medium">Affected entities ({item.affectedCount})</summary>
      <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-xs">{item.entities.map((entity) => <li key={entity.findingId} className="rounded bg-slate-900 p-2"><span className="font-semibold capitalize">{entity.entityType}</span><span className="block break-all text-slate-300">{entity.entityRef}</span><code className="mt-1 block break-all text-slate-500">{entity.findingId}</code></li>)}</ul>
    </details>
    <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
      <label className="block text-sm" htmlFor="standards-decision-status">Decision state<select id="standards-decision-status" value={status} disabled={!canManage || saving} onChange={(event) => setStatus(event.target.value as typeof status)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2"><option value="in_review">In review</option><option value="needs_evidence">Needs evidence</option><option value="rejected_mapping">Rejected mapping</option><option value="approved_mapping" disabled={!canApprove}>Approved mapping{!canApprove ? ' — approval capability required' : ''}</option></select></label>
      {approving && <fieldset className="space-y-3 rounded-xl border border-emerald-800 bg-emerald-950/30 p-4"><legend className="px-1 text-sm font-semibold text-emerald-200">Verified mapping evidence</legend><p className="text-xs text-emerald-100">Enter only facts verified by a human against the cited evidence source.</p>
        <label className="block text-sm" htmlFor="standards-canonical-id">Canonical standard identifier<input id="standards-canonical-id" required value={canonicalStandardId} onChange={(event) => setCanonicalStandardId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2" /></label>
        <label className="block text-sm" htmlFor="standards-framework-version">Framework and version<input id="standards-framework-version" required value={frameworkVersion} onChange={(event) => setFrameworkVersion(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2" /></label>
        <label className="block text-sm" htmlFor="standards-canonical-title">Human-readable title or text<input id="standards-canonical-title" required value={canonicalTitle} onChange={(event) => setCanonicalTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2" /></label>
        <label className="block text-sm" htmlFor="standards-evidence-source">Evidence or source reference<textarea id="standards-evidence-source" required rows={3} value={evidenceSource} onChange={(event) => setEvidenceSource(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2" /></label>
      </fieldset>}
      <label className="block text-sm" htmlFor="standards-reviewer-note">Reviewer reason or note{['rejected_mapping', 'needs_evidence', 'approved_mapping'].includes(status) ? ' (required)' : ''}<textarea id="standards-reviewer-note" rows={3} value={reviewerNote} onChange={(event) => setReviewerNote(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2" /></label>
      {(localError || saveError) && <p role="alert" className="rounded-lg bg-red-950 p-3 text-sm text-red-200">{localError ?? message(saveError!)}</p>}
      {!canManage && <p className="text-sm text-amber-200">Curriculum draft write capability is required to update review workflow state.</p>}
      <button type="submit" disabled={!canManage || saving || (approving && !canApprove)} className="w-full rounded-lg bg-cyan-300 px-4 py-2.5 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving decision…' : 'Save review decision'}</button>
      <p className="text-xs leading-5 text-slate-400">Saving records a separate audited decision. It does not rewrite the published release or apply changes to a draft.</p>
    </form>
  </aside>
}
