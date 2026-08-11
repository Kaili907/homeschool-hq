import { useEffect, useMemo, useState } from 'react'
import {
  CURRICULUM_VALIDATION_CATEGORIES,
  type CurriculumEntityReference,
  type CurriculumFindingSeverity,
  type CurriculumSnapshotValidationRun,
  type CurriculumValidationCategory,
  type CurriculumValidationFinding,
} from '../../admin/curriculum-validation/engine.ts'

export type CurriculumFindingGroupBy = 'entity' | 'rule' | 'severity'
export const CURRICULUM_VALIDATION_RENDER_BATCH = 250 as const

export interface CurriculumFindingFilters {
  readonly query: string
  readonly severity: CurriculumFindingSeverity | 'all'
  readonly category: CurriculumValidationCategory | 'all'
  readonly blocking: 'all' | 'blocking' | 'non-blocking'
}

export interface CurriculumValidationWorkspaceProps {
  readonly run: CurriculumSnapshotValidationRun
  readonly onJumpToEntity?: (entity: CurriculumEntityReference) => void
}

const STATUS_COPY = {
  valid: {
    label: 'VALID',
    readiness: 'Ready for publication checks',
    style: 'border-emerald-400 bg-emerald-950/70 text-emerald-100',
  },
  invalid: {
    label: 'INVALID',
    readiness: 'Not ready — blocking findings',
    style: 'border-rose-400 bg-rose-950/70 text-rose-100',
  },
  incomplete: {
    label: 'INCOMPLETE',
    readiness: 'Not ready — snapshot incomplete',
    style: 'border-amber-400 bg-amber-950/70 text-amber-100',
  },
  unavailable: {
    label: 'UNAVAILABLE',
    readiness: 'Not ready — validation unavailable',
    style: 'border-slate-400 bg-slate-800 text-slate-100',
  },
  error: {
    label: 'VALIDATION ERROR',
    readiness: 'Not ready — validation did not complete',
    style: 'border-rose-400 bg-rose-950/70 text-rose-100',
  },
} as const

const SEVERITY_STYLES: Readonly<Record<CurriculumFindingSeverity, string>> = {
  error: 'border-rose-400 bg-rose-950/60 text-rose-100',
  warning: 'border-amber-400 bg-amber-950/60 text-amber-100',
  info: 'border-sky-400 bg-sky-950/60 text-sky-100',
}

function categoryLabel(category: CurriculumValidationCategory): string {
  return category.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ')
}

function entityLabel(entity: CurriculumEntityReference): string {
  const type = entity.type.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ')
  return entity.id ? `${type} · ${entity.id}` : type
}

function searchableText(finding: CurriculumValidationFinding): string {
  return [
    finding.id,
    finding.rule,
    finding.path,
    finding.explanation,
    finding.remediation ?? '',
    finding.category,
    finding.severity,
    finding.entity.type,
    finding.entity.id ?? '',
  ].join(' ').toLowerCase()
}

export function filterCurriculumValidationFindings(
  findings: readonly CurriculumValidationFinding[],
  filters: CurriculumFindingFilters,
): readonly CurriculumValidationFinding[] {
  const query = filters.query.trim().toLowerCase()
  return findings.filter((finding) =>
    (filters.severity === 'all' || finding.severity === filters.severity)
      && (filters.category === 'all' || finding.category === filters.category)
      && (filters.blocking === 'all'
        || (filters.blocking === 'blocking' ? finding.blocking : !finding.blocking))
      && (!query || searchableText(finding).includes(query)),
  )
}

function groupKey(finding: CurriculumValidationFinding, groupBy: CurriculumFindingGroupBy): string {
  if (groupBy === 'rule') return finding.rule
  if (groupBy === 'severity') return finding.severity
  return `${finding.entity.type}|${finding.entity.id ?? ''}`
}

function groupLabel(
  finding: CurriculumValidationFinding,
  groupBy: CurriculumFindingGroupBy,
): string {
  if (groupBy === 'rule') return finding.rule
  if (groupBy === 'severity') return `${finding.severity.toUpperCase()} severity`
  return entityLabel(finding.entity)
}

export function groupCurriculumValidationFindings(
  findings: readonly CurriculumValidationFinding[],
  groupBy: CurriculumFindingGroupBy,
): readonly { readonly key: string; readonly label: string; readonly findings: readonly CurriculumValidationFinding[] }[] {
  const groups = new Map<string, { label: string; findings: CurriculumValidationFinding[] }>()
  findings.forEach((finding) => {
    const key = groupKey(finding, groupBy)
    const existing = groups.get(key)
    if (existing) existing.findings.push(finding)
    else groups.set(key, { label: groupLabel(finding, groupBy), findings: [finding] })
  })
  return [...groups.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((left, right) => left.label.localeCompare(right.label))
}

function FindingCard({
  finding,
  onJumpToEntity,
}: {
  readonly finding: CurriculumValidationFinding
  readonly onJumpToEntity?: (entity: CurriculumEntityReference) => void
}) {
  return (
    <details className="rounded-lg border border-slate-700 bg-slate-950/70 open:border-slate-500">
      <summary className="cursor-pointer list-none p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400">
        <span className="flex flex-wrap items-start justify-between gap-3">
          <span>
            <strong className="block text-slate-100">{finding.explanation}</strong>
            <span className="mt-1 block break-all font-mono text-xs text-slate-400">{finding.path}</span>
          </span>
          <span className="flex flex-wrap gap-2">
            {finding.blocking && (
              <span className="rounded border border-rose-400 px-2 py-1 text-xs font-bold text-rose-200">
                BLOCKING
              </span>
            )}
            <span className={`rounded border px-2 py-1 text-xs font-bold ${SEVERITY_STYLES[finding.severity]}`}>
              {finding.severity.toUpperCase()}
            </span>
          </span>
        </span>
      </summary>
      <div className="border-t border-slate-700 px-4 pb-4 pt-3 text-sm">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div><dt className="text-xs uppercase tracking-wide text-slate-500">Rule</dt><dd className="mt-1 break-all font-mono text-slate-200">{finding.rule}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-slate-500">Entity</dt><dd className="mt-1 text-slate-200">{entityLabel(finding.entity)}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-slate-500">Category</dt><dd className="mt-1 text-slate-200">{categoryLabel(finding.category)}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-slate-500">Finding ID</dt><dd className="mt-1 break-all font-mono text-xs text-slate-400">{finding.id}</dd></div>
        </dl>
        {finding.remediation && (
          <div className="mt-4 rounded-lg border border-sky-900 bg-sky-950/50 p-3">
            <h4 className="font-semibold text-sky-200">Safe remediation</h4>
            <p className="mt-1 text-slate-200">{finding.remediation}</p>
          </div>
        )}
        {onJumpToEntity && finding.entity.id && (
          <button
            type="button"
            onClick={() => onJumpToEntity(finding.entity)}
            className="mt-4 min-h-11 rounded-lg border border-sky-500 px-4 py-2 font-bold text-sky-200 hover:bg-sky-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            Jump to entity
          </button>
        )}
      </div>
    </details>
  )
}

export function CurriculumValidationWorkspace({
  run,
  onJumpToEntity,
}: CurriculumValidationWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [severity, setSeverity] = useState<CurriculumFindingSeverity | 'all'>('all')
  const [category, setCategory] = useState<CurriculumValidationCategory | 'all'>('all')
  const [blocking, setBlocking] = useState<'all' | 'blocking' | 'non-blocking'>('all')
  const [groupBy, setGroupBy] = useState<CurriculumFindingGroupBy>('entity')
  const [renderLimit, setRenderLimit] = useState<number>(CURRICULUM_VALIDATION_RENDER_BATCH)
  const status = STATUS_COPY[run.status]

  const visibleFindings = useMemo(() => filterCurriculumValidationFindings(run.findings, {
    query,
    severity,
    category,
    blocking,
  }), [run.findings, query, severity, category, blocking])
  const renderedFindings = useMemo(() => visibleFindings.slice(0, renderLimit), [renderLimit, visibleFindings])
  const groups = useMemo(
    () => groupCurriculumValidationFindings(renderedFindings, groupBy),
    [renderedFindings, groupBy],
  )
  const blockingFindings = run.findings.filter((finding) => finding.blocking)

  useEffect(() => {
    setRenderLimit(CURRICULUM_VALIDATION_RENDER_BATCH)
  }, [blocking, category, groupBy, query, run, severity])

  return (
    <div className="min-w-0 bg-slate-950 py-6 text-slate-100" aria-labelledby="curriculum-validation-workspace-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <header className="flex flex-col gap-5 border-b border-slate-700 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">Curriculum Studio</p>
            <h2 id="curriculum-validation-workspace-title" className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Validation workspace
            </h2>
            <p className="mt-2 max-w-3xl text-slate-300">Deterministic validation for one explicit curriculum snapshot.</p>
          </div>
          <section className={`rounded-xl border px-5 py-4 ${status.style}`} aria-label="Validation and publication readiness" role="status">
            <span className="block text-xs font-bold uppercase tracking-widest">Validation status</span>
            <strong className="mt-1 block text-xl">{status.label}</strong>
            <span className="mt-1 block text-sm">{status.readiness}</span>
          </section>
        </header>

        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]" aria-labelledby="run-summary-title">
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
            <h2 id="run-summary-title" className="text-lg font-bold">Validation run</h2>
            <p className="mt-2 text-slate-300">{run.statusMessage}</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div><dt className="text-xs uppercase tracking-wide text-slate-500">Snapshot</dt><dd className="mt-1 break-all font-mono text-sm">{run.source.snapshotId ?? 'Not identified'}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-slate-500">Origin</dt><dd className="mt-1 text-sm">{run.source.origin === 'published-release' ? 'Published release' : 'Draft'}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-slate-500">Curriculum version</dt><dd className="mt-1 font-mono text-sm">{run.source.curriculumVersion ?? 'Not recorded'}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-slate-500">Schema set</dt><dd className="mt-1 font-mono text-sm">{run.source.schemaSetVersion ?? 'Not recorded'}</dd></div>
            </dl>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
            <h2 className="text-lg font-bold">Publication gate</h2>
            <strong className={`mt-3 block text-2xl ${run.publicationReady ? 'text-emerald-300' : 'text-rose-300'}`}>
              {run.publicationReady ? 'READY' : 'NOT READY'}
            </strong>
            <p className="mt-2 text-sm text-slate-300">
              {run.publicationReady
                ? 'Validation completed without a blocking finding.'
                : `${run.summary.blocking} blocking finding${run.summary.blocking === 1 ? '' : 's'} or an incomplete validation state prevents readiness.`}
            </p>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="Validation finding totals">
          {[
            ['Total', run.summary.total],
            ['Blocking', run.summary.blocking],
            ['Errors', run.summary.errors],
            ['Warnings', run.summary.warnings],
            ['Info', run.summary.info],
            ['Non-blocking', run.summary.nonBlocking],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-center">
              <strong className="block text-2xl">{value}</strong>
              <span className="text-sm text-slate-400">{label}</span>
            </div>
          ))}
        </section>

        {blockingFindings.length > 0 && (
          <section className="mt-8 rounded-xl border border-rose-500/70 bg-rose-950/30 p-5" aria-labelledby="blocking-findings-title">
            <h2 id="blocking-findings-title" className="text-xl font-bold text-rose-100">Blocking findings</h2>
            <p className="mt-1 text-sm text-rose-200">These findings must be resolved before publication can be considered.</p>
            <ul className="mt-4 space-y-2">
              {blockingFindings.slice(0, 10).map((finding) => (
                <li key={finding.id} className="rounded-lg bg-slate-950/60 px-4 py-3 text-sm">
                  <strong>{entityLabel(finding.entity)}</strong>
                  <span className="mx-2 text-slate-500">·</span>
                  <span>{finding.explanation}</span>
                </li>
              ))}
            </ul>
            {blockingFindings.length > 10 && <p className="mt-3 text-sm text-rose-200">Plus {blockingFindings.length - 10} additional blocking findings below.</p>}
          </section>
        )}

        <section className="mt-8" aria-labelledby="all-findings-title">
          <div>
            <h2 id="all-findings-title" className="text-2xl font-bold">All findings</h2>
            <p className="mt-1 text-sm text-slate-400">Search, filter, group, expand details, and jump back to the owning entity.</p>
          </div>
          <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5" role="search" onSubmit={(event) => event.preventDefault()}>
            <div>
              <label htmlFor="curriculum-validation-query" className="mb-1 block text-sm font-medium">Search</label>
              <input id="curriculum-validation-query" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Entity, path, rule…" className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2" />
            </div>
            <div>
              <label htmlFor="curriculum-validation-severity" className="mb-1 block text-sm font-medium">Severity</label>
              <select id="curriculum-validation-severity" value={severity} onChange={(event) => setSeverity(event.target.value as CurriculumFindingSeverity | 'all')} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2">
                <option value="all">All severities</option><option value="error">Error</option><option value="warning">Warning</option><option value="info">Info</option>
              </select>
            </div>
            <div>
              <label htmlFor="curriculum-validation-category" className="mb-1 block text-sm font-medium">Category</label>
              <select id="curriculum-validation-category" value={category} onChange={(event) => setCategory(event.target.value as CurriculumValidationCategory | 'all')} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2">
                <option value="all">All categories</option>
                {CURRICULUM_VALIDATION_CATEGORIES.map((value) => <option key={value} value={value}>{categoryLabel(value)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="curriculum-validation-blocking" className="mb-1 block text-sm font-medium">Publication impact</label>
              <select id="curriculum-validation-blocking" value={blocking} onChange={(event) => setBlocking(event.target.value as typeof blocking)} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2">
                <option value="all">All findings</option><option value="blocking">Blocking</option><option value="non-blocking">Non-blocking</option>
              </select>
            </div>
            <div>
              <label htmlFor="curriculum-validation-group" className="mb-1 block text-sm font-medium">Group by</label>
              <select id="curriculum-validation-group" value={groupBy} onChange={(event) => setGroupBy(event.target.value as CurriculumFindingGroupBy)} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2">
                <option value="entity">Entity</option><option value="rule">Rule</option><option value="severity">Severity</option>
              </select>
            </div>
          </form>

          <p className="mt-4 text-sm text-slate-400" aria-live="polite">
            Rendering {renderedFindings.length} of {visibleFindings.length} matching findings ({run.findings.length} total).
          </p>
          <div className="mt-4 space-y-4" id="curriculum-validation-results">
            {groups.map((group) => (
              <section key={group.key} className="rounded-xl border border-slate-700 bg-slate-900 p-4" aria-label={`${group.label} findings`}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="break-all text-lg font-bold">{group.label}</h3>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300">{group.findings.length}</span>
                </div>
                <div className="space-y-3">
                  {group.findings.map((finding) => <FindingCard key={finding.id} finding={finding} onJumpToEntity={onJumpToEntity} />)}
                </div>
              </section>
            ))}
            {groups.length === 0 && (
              <p className="rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-400">No findings match the current filters.</p>
            )}
            {renderedFindings.length < visibleFindings.length && (
              <button
                type="button"
                onClick={() => setRenderLimit((value) => value + CURRICULUM_VALIDATION_RENDER_BATCH)}
                className="min-h-11 rounded-lg border border-sky-500 px-4 py-2 font-bold text-sky-200 hover:bg-sky-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
              >
                Show {Math.min(CURRICULUM_VALIDATION_RENDER_BATCH, visibleFindings.length - renderedFindings.length)} more findings
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
