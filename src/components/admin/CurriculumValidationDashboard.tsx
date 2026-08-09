import { useMemo, useState } from 'react'
import {
  CURRICULUM_VALIDATION_CAPABILITY,
  type CurriculumValidationReadModel,
  type CurriculumValidationStatus,
  type ValidationCheckState,
  type ValidationScope,
} from '../../admin/curriculum-validation/model'

export type CurriculumValidationAuthorization =
  | { readonly state: 'unresolved' }
  | { readonly state: 'denied' }
  | {
      readonly state: 'authorized'
      readonly capability: typeof CURRICULUM_VALIDATION_CAPABILITY
    }

export interface CurriculumValidationDashboardProps {
  readonly authorization: CurriculumValidationAuthorization
  readonly model: CurriculumValidationReadModel | null
}

const STATUS_LABELS: Readonly<Record<CurriculumValidationStatus, string>> = {
  pass: 'PASS',
  pass_with_warnings: 'PASS WITH WARNINGS',
  fail: 'FAIL',
  unknown: 'UNKNOWN / NOT VALIDATED',
}

const CHECK_LABELS: Readonly<Record<ValidationCheckState, string>> = {
  not_checked: 'NOT CHECKED',
  passed: 'CHECKED AND PASSED',
  warning: 'CHECKED WITH WARNINGS',
  failed: 'CHECKED AND FAILED',
}

const STATUS_STYLES: Readonly<Record<ValidationCheckState | CurriculumValidationStatus, string>> = {
  pass: 'border-emerald-300 bg-emerald-50 text-emerald-950',
  pass_with_warnings: 'border-amber-300 bg-amber-50 text-amber-950',
  fail: 'border-rose-300 bg-rose-50 text-rose-950',
  unknown: 'border-slate-300 bg-slate-100 text-slate-800',
  not_checked: 'border-slate-300 bg-slate-100 text-slate-700',
  passed: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
  failed: 'border-rose-300 bg-rose-50 text-rose-900',
}

function metadata(value: string | null): string {
  return value ?? 'Not recorded'
}

function scopeText(scope: ValidationScope): string {
  return Object.entries(scope)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `${key}: ${value}`)
    .join(' · ')
}

function LockedValidationSurface({ state }: { readonly state: 'unresolved' | 'denied' }) {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100" aria-labelledby="validation-access-title">
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">Admin Console</p>
        <h1 id="validation-access-title" className="mt-3 text-2xl font-bold">Curriculum validation unavailable</h1>
        <p className="mt-4 text-slate-300" role={state === 'denied' ? 'alert' : 'status'}>
          {state === 'unresolved'
            ? 'Authorization is still being verified. Validation evidence remains hidden.'
            : 'Your Admin assignment does not include curriculum:read.'}
        </p>
      </section>
    </main>
  )
}

export function CurriculumValidationDashboard({
  authorization,
  model,
}: CurriculumValidationDashboardProps) {
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState<ValidationCheckState | 'all'>('all')

  const visibleCategories = useMemo(() => {
    if (!model) return []
    const normalizedQuery = query.trim().toLowerCase()
    return model.categories.flatMap((category) => {
      if (stateFilter !== 'all' && category.state !== stateFilter) return []
      if (!normalizedQuery) return [category]
      const categoryMatches = `${category.label} ${CHECK_LABELS[category.state]}`
        .toLowerCase()
        .includes(normalizedQuery)
      const findings = category.findings.filter((finding) =>
        `${finding.check} ${finding.detail} ${scopeText(finding.scope)}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
      return categoryMatches || findings.length ? [{ ...category, findings }] : []
    })
  }, [model, query, stateFilter])

  if (authorization.state !== 'authorized') {
    return <LockedValidationSurface state={authorization.state} />
  }

  if (!model) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100" aria-labelledby="validation-empty-title">
        <section className="mx-auto max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-8">
          <h1 id="validation-empty-title" className="text-2xl font-bold">UNKNOWN / NOT VALIDATED</h1>
          <p className="mt-3 text-slate-300" role="status">No validation evidence was provided.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6" aria-labelledby="validation-title">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-slate-700 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">Admin Console · Read only</p>
            <h1 id="validation-title" className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Curriculum Validation</h1>
            <p className="mt-2 max-w-2xl text-slate-300">Recorded validation evidence for the immutable curriculum package.</p>
          </div>
          <div
            className={`rounded-xl border px-5 py-4 ${STATUS_STYLES[model.status]}`}
            role="status"
            aria-label={`Overall validation status: ${STATUS_LABELS[model.status]}`}
          >
            <span className="block text-xs font-bold uppercase tracking-widest">Overall status</span>
            <strong className="mt-1 block text-xl">{STATUS_LABELS[model.status]}</strong>
          </div>
        </header>

        {model.evidenceError && (
          <div className="mt-6 rounded-xl border border-rose-400 bg-rose-950/60 p-4 text-rose-100" role="alert">
            {model.evidenceError}
          </div>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5" aria-label="Validation evidence metadata">
          {[
            ['Curriculum version', metadata(model.curriculumVersion)],
            ['Validation-reported curriculum version', metadata(model.validationReportedCurriculumVersion)],
            ['Package', metadata(model.packageId)],
            ['Validated on', metadata(model.validatedAt)],
            ['Validation artifact version', metadata(model.validationArtifactVersion)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
              <dd className="mt-2 break-words font-mono text-sm text-slate-100">{value}</dd>
            </div>
          ))}
        </section>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Validation category totals">
          {[
            ['Checked', model.summary.checked],
            ['Passed', model.summary.passed],
            ['Warnings', model.summary.warnings],
            ['Failed', model.summary.failed],
            ['Not checked', model.summary.notChecked],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-center">
              <strong className="block text-2xl">{value}</strong>
              <span className="text-sm text-slate-400">{label}</span>
            </div>
          ))}
        </section>

        <section className="mt-8" aria-labelledby="checks-title">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 id="checks-title" className="text-2xl font-bold">Validation checks</h2>
              <p className="mt-1 text-sm text-slate-400">Open a category to inspect recorded findings and affected references.</p>
            </div>
            <form className="grid gap-3 sm:grid-cols-2" role="search" onSubmit={(event) => event.preventDefault()}>
              <div>
                <label htmlFor="validation-search" className="mb-1 block text-sm font-medium">Search findings</label>
                <input
                  id="validation-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
                  placeholder="Lesson, check, reference…"
                />
              </div>
              <div>
                <label htmlFor="validation-state" className="mb-1 block text-sm font-medium">Check state</label>
                <select
                  id="validation-state"
                  value={stateFilter}
                  onChange={(event) => setStateFilter(event.target.value as ValidationCheckState | 'all')}
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
                >
                  <option value="all">All states</option>
                  <option value="failed">Checked and failed</option>
                  <option value="warning">Checked with warnings</option>
                  <option value="passed">Checked and passed</option>
                  <option value="not_checked">Not checked</option>
                </select>
              </div>
            </form>
          </div>

          <div className="mt-5 space-y-3">
            {visibleCategories.map((category) => (
              <details key={category.id} className="rounded-xl border border-slate-700 bg-slate-900 open:border-slate-500">
                <summary className="cursor-pointer list-none px-5 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400">
                  <span className="flex flex-wrap items-center justify-between gap-3">
                    <strong>{category.label}</strong>
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${STATUS_STYLES[category.state]}`}>
                      {CHECK_LABELS[category.state]}
                    </span>
                  </span>
                </summary>
                <div className="border-t border-slate-700 px-5 py-4">
                  {category.findings.length === 0 ? (
                    <p className="text-slate-400">No recorded check exists for this category.</p>
                  ) : (
                    <ol className="space-y-4">
                      {category.findings.map((finding) => {
                        const scope = scopeText(finding.scope)
                        return (
                          <li key={finding.id} className="rounded-lg bg-slate-950/70 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <strong>{finding.check}</strong>
                              <span className={`rounded border px-2 py-0.5 text-xs font-bold ${STATUS_STYLES[finding.state]}`}>
                                {CHECK_LABELS[finding.state]}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-200">{finding.detail}</p>
                            {scope && <p className="mt-2 text-xs text-sky-200">Affected · {scope}</p>}
                            <p className="mt-2 break-words font-mono text-xs text-slate-500">Source: {finding.source}</p>
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </div>
              </details>
            ))}
            {visibleCategories.length === 0 && <p className="rounded-xl border border-slate-700 p-5 text-slate-400">No checks match these filters.</p>}
          </div>
        </section>

        <section className="mt-8" aria-labelledby="coverage-title">
          <h2 id="coverage-title" className="text-2xl font-bold">Standards coverage</h2>
          {model.coverage.length === 0 ? (
            <p className="mt-3 rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-300">
              Granular standard-to-lesson and standard-to-assessment coverage was not recorded in this validation artifact.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-700">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <caption className="sr-only">Canonical standards mappings and identified gaps</caption>
                <thead className="bg-slate-800 text-slate-200">
                  <tr><th className="p-3">Standard</th><th className="p-3">Lessons</th><th className="p-3">Assessments</th><th className="p-3">Coverage</th></tr>
                </thead>
                <tbody>
                  {model.coverage.map((row) => (
                    <tr key={row.standard} className="border-t border-slate-700 bg-slate-900 align-top">
                      <th scope="row" className="p-3 font-mono">{row.standard}</th>
                      <td className="p-3">{row.lessonRefs.join(', ') || 'No mapped lessons'}</td>
                      <td className="p-3">{row.assessmentRefs.join(', ') || 'No mapped assessments'}</td>
                      <td className="p-3 font-semibold">{row.state === 'covered' ? 'COVERED' : 'GAP'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-8 border-t border-slate-700 pt-6" aria-labelledby="sources-title">
          <h2 id="sources-title" className="text-lg font-bold">Evidence sources</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 font-mono text-xs text-slate-400">
            {model.sources.length
              ? model.sources.map((source) => <li key={source}>{source}</li>)
              : <li>No authoritative source was recorded.</li>}
          </ul>
        </section>
      </div>
    </main>
  )
}
