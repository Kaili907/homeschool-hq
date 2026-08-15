import { useMemo } from 'react'
import {
  HIGH_SCHOOL_PROGRAM_SNAPSHOT,
  deriveHighSchoolProgramView,
  knownGapSummaries,
  totalCreditsByGrade,
  totalHighSchoolCredits,
  type CoverageStatus,
  type HighSchoolGrade,
  type HighSchoolProgramSnapshot,
  type HighSchoolProgramView,
  type SeamContinuityVerdict,
} from '../../admin/high-school-program'

/**
 * Admin surface for the Grades 8-12 programme.
 *
 * Independently mountable — takes an optional `snapshot` override for tests
 * and defaults to the frozen snapshot derived from
 * `origin/mac/hs912-release-r1`. Does NOT touch AdminConsole navigation.
 * DASH-7 will mount this at a later step.
 */
export interface AdminHighSchoolProgramProps {
  readonly snapshot?: HighSchoolProgramSnapshot
}

const STATUS_STYLE: Readonly<Record<CoverageStatus, { label: string; className: string }>> = {
  COVERED: { label: 'COVERED', className: 'bg-emerald-100 text-emerald-800 border border-emerald-300' },
  PARTIAL: { label: 'PARTIAL', className: 'bg-amber-100 text-amber-800 border border-amber-300' },
  NOT_COVERED: { label: 'NOT COVERED', className: 'bg-rose-100 text-rose-800 border border-rose-300' },
  UNVERIFIED: { label: 'UNVERIFIED', className: 'bg-slate-100 text-slate-700 border border-slate-300' },
}

const SEAM_STYLE: Readonly<Record<SeamContinuityVerdict, { label: string; className: string }>> = {
  CONTINUOUS: { label: 'CONTINUOUS', className: 'bg-emerald-100 text-emerald-800 border border-emerald-300' },
  CONTINUOUS_WITH_DESIGN_DECISION: { label: 'CONTINUOUS · design decision', className: 'bg-emerald-100 text-emerald-800 border border-emerald-300' },
  CONTINUOUS_WITH_CADENCE_CHANGE: { label: 'CONTINUOUS · cadence change', className: 'bg-emerald-100 text-emerald-800 border border-emerald-300' },
  DELIBERATE_OVERLAP: { label: 'DELIBERATE OVERLAP', className: 'bg-amber-100 text-amber-800 border border-amber-300' },
  NO_ANCHOR: { label: 'NO ANCHOR', className: 'bg-rose-100 text-rose-800 border border-rose-300' },
}

function StatusBadge({ status }: { readonly status: CoverageStatus }) {
  const style = STATUS_STYLE[status]
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${style.className}`}>{style.label}</span>
}

function SeamBadge({ ruling }: { readonly ruling: SeamContinuityVerdict }) {
  const style = SEAM_STYLE[ruling]
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${style.className}`}>{style.label}</span>
}

function formatCredit(credit: number | null): string {
  if (credit === null) return '—'
  return credit.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

function GradeColumn({ grade, view }: { readonly grade: HighSchoolGrade; readonly view: HighSchoolProgramView }) {
  const row = view.progressionByGrade.find((r) => r.grade === grade)
  const total = totalCreditsByGrade(view)[grade]
  const stated = row ? row.courses.filter((c) => c.creditRecommendation !== null).length : 0
  return (
    <section className="flex flex-col rounded-lg border border-slate-300 bg-white" aria-labelledby={`hs-grade-${grade}-heading`}>
      <header className="border-b border-slate-200 bg-slate-50 px-3 py-2">
        <h4 id={`hs-grade-${grade}-heading`} className="font-semibold text-slate-800">Grade {grade}</h4>
        <p className="text-xs text-slate-600">{row?.courses.length ?? 0} courses · {stated}/{row?.courses.length ?? 0} record a credit · total {formatCredit(total)}</p>
      </header>
      <ol className="divide-y divide-slate-100">
        {row?.courses.map((c) => (
          <li key={c.courseId} className="grid gap-1 px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-800">{c.courseName}</p>
                <p className="break-all text-xs text-slate-500">{c.courseId} · {c.subject}</p>
              </div>
              <span className="whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-mono text-slate-700" title="Credit recorded in source; '—' when source recorded null">
                {formatCredit(c.creditRecommendation)} cr
              </span>
            </div>
            <p className="text-xs text-slate-600">{c.sessions} sessions{c.cadence ? ` · ${c.cadence}` : ''} · {c.authoringStatus === 'FROZEN_DO_NOT_MODIFY' ? 'frozen' : 'to be authored'}</p>
            {c.satisfiesStateRequirements.length > 0 && (
              <p className="text-xs text-slate-500"><span className="font-semibold text-slate-700">Satisfies:</span> {c.satisfiesStateRequirements.join(', ')}</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

function FamilyProgressionTable({ view }: { readonly view: HighSchoolProgramView }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <caption className="sr-only">Subject family progression Grade 8 to Grade 12</caption>
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
          <tr>
            <th scope="col" className="border-b border-slate-200 px-3 py-2">Subject family</th>
            {(view.snapshot.gradeSpan).map((g) => <th key={g} scope="col" className="border-b border-slate-200 px-3 py-2">Grade {g}</th>)}
            <th scope="col" className="border-b border-slate-200 px-3 py-2">Progression</th>
          </tr>
        </thead>
        <tbody>
          {view.progressionByFamily.map((family) => (
            <tr key={family.subject} className="border-b border-slate-100 align-top">
              <th scope="row" className="px-3 py-2 text-left font-medium text-slate-800">{family.subject}</th>
              {view.snapshot.gradeSpan.map((g) => {
                const course = family.grades[g]
                return (
                  <td key={g} className="px-3 py-2 text-slate-700">
                    {course ? (
                      <div>
                        <p className="text-sm">{course.courseName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{formatCredit(course.creditRecommendation)} cr · {course.sessions} sess</p>
                      </div>
                    ) : <span className="text-xs uppercase text-rose-700">missing</span>}
                  </td>
                )
              })}
              <td className="px-3 py-2">
                <StatusBadge status={family.progressionStatus === 'continuous' ? 'COVERED' : 'NOT_COVERED'} />
                {family.progressionNotes.length > 0 && (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-600">
                    {family.progressionNotes.map((note) => <li key={note}>{note}</li>)}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SeamSection({ view }: { readonly view: HighSchoolProgramView }) {
  return (
    <section aria-labelledby="hs-seam-heading" className="rounded-lg border border-slate-300 bg-white">
      <header className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 id="hs-seam-heading" className="font-semibold text-slate-800">Grade 8 → 9 seam</h3>
        <p className="text-xs text-slate-600">Every family the contract knows about. World Language is included so an absent anchor is not read as complete.</p>
      </header>
      <ul className="divide-y divide-slate-100">
        {view.seamG8G9.map((seam) => (
          <li key={seam.family} className="grid gap-2 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-slate-800">{seam.familyLabel}</p>
                <p className="break-all text-xs text-slate-500">
                  {seam.grade8CourseId ?? '—'} → {seam.grade9CourseId ?? '—'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SeamBadge ruling={seam.ruling} />
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold uppercase ${seam.linkage === 'linked' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-700 border border-slate-300'}`}>
                  {seam.linkage === 'linked' ? 'prereq linked' : 'no prereq link'}
                </span>
              </div>
            </div>
            {seam.namedDiscontinuities.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {seam.namedDiscontinuities.map((d) => <li key={d}>{d}</li>)}
              </ul>
            )}
            <p className="text-sm text-slate-700">{seam.note}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function StandardsSection({ view }: { readonly view: HighSchoolProgramView }) {
  return (
    <section aria-labelledby="hs-standards-heading" className="rounded-lg border border-slate-300 bg-white">
      <header className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 id="hs-standards-heading" className="font-semibold text-slate-800">Standards / requirement coverage</h3>
        <p className="text-xs text-slate-600">Verification lifted from standards-reference.md. PARTIAL means the source explicitly flagged an unverified aspect (dotted HS ELA codes, inferred PE coding legend, 2011 Arts revision date).</p>
      </header>
      <ul className="divide-y divide-slate-100">
        {view.standardsCoverage.map((s) => (
          <li key={s.family} className="grid gap-1 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-slate-800">{s.familyLabel}</p>
                <p className="text-xs text-slate-500">{s.framework ?? 'No coded framework anchor'}</p>
              </div>
              <StatusBadge status={s.displayStatus} />
            </div>
            <p className="text-sm text-slate-700">{s.note}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function GapsSection({ view }: { readonly view: HighSchoolProgramView }) {
  return (
    <section aria-labelledby="hs-gaps-heading" className="rounded-lg border border-slate-300 bg-white">
      <header className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 id="hs-gaps-heading" className="font-semibold text-slate-800">Known gaps and open decisions</h3>
        <p className="text-xs text-slate-600">Each row is a declared coverage gap in credit-coverage-map.md. Display status mirrors the source verdict: NOT_COVERED, PARTIALLY_COVERED, REQUIRES_DIRECTOR_DECISION.</p>
      </header>
      <ul className="divide-y divide-slate-100">
        {view.coverageGaps.map((g) => (
          <li key={g.requirement} className="grid gap-1 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-slate-800">{g.requirementLabel}</p>
                <p className="text-xs text-slate-500">
                  <span className="font-mono">{g.requirement}</span>{g.authority ? ` · ${g.authority}` : ''} · owner {g.owner}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={g.displayStatus} />
                <span className="whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-mono text-slate-700">
                  {formatCredit(g.creditsRequired)} required{g.irreducibleRemainderCredits !== null ? ` · ${formatCredit(g.irreducibleRemainderCredits)} irreducible` : ''}
                </span>
              </div>
            </div>
            <p className="text-sm text-slate-700">{g.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function GraduationBanner({ view }: { readonly view: HighSchoolProgramView }) {
  const g = view.graduation
  const status: CoverageStatus = g.overallStatus === 'graduation_complete' ? 'COVERED' : g.overallStatus === 'unverified' ? 'UNVERIFIED' : 'NOT_COVERED'
  return (
    <section aria-label="Graduation completeness ruling" className={`rounded-lg border p-4 ${status === 'COVERED' ? 'border-emerald-300 bg-emerald-50' : status === 'UNVERIFIED' ? 'border-slate-300 bg-slate-50' : 'border-rose-300 bg-rose-50'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={status} />
        <h3 className="font-semibold text-slate-800">
          {g.overallStatus === 'graduation_complete' ? 'Graduation-complete against MMC (per source)' : g.overallStatus === 'unverified' ? 'Graduation ruling is UNVERIFIED' : 'NOT graduation-complete against MMC'}
        </h3>
      </div>
      <p className="mt-2 text-sm text-slate-700">{g.reason}</p>
      <p className="mt-1 text-xs text-slate-500">{g.note}</p>
      <p className="mt-1 break-all text-xs text-slate-500">Source: {g.sourceDoc}</p>
    </section>
  )
}

export function AdminHighSchoolProgram({ snapshot = HIGH_SCHOOL_PROGRAM_SNAPSHOT }: AdminHighSchoolProgramProps = {}) {
  const view = useMemo(() => deriveHighSchoolProgramView(snapshot), [snapshot])
  const gaps = useMemo(() => knownGapSummaries(view), [view])
  const totalCredits = totalHighSchoolCredits(view)

  return (
    <section aria-labelledby="admin-high-school-program-heading" className="mx-auto grid max-w-6xl gap-5 p-6 text-slate-800">
      <header className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Admin · High-school programme</p>
        <h2 id="admin-high-school-program-heading" className="font-serif text-2xl font-medium text-slate-900">
          Manuel Academy Grades 8 → 12
        </h2>
        <dl className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="font-semibold uppercase tracking-wide text-slate-500">Contract</dt>
            <dd className="break-all font-mono text-slate-700">{view.snapshot.contractId}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-wide text-slate-500">Source ref</dt>
            <dd className="break-all font-mono text-slate-700">{view.snapshot.sourceRef}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-wide text-slate-500">Status</dt>
            <dd className="text-slate-700">{view.snapshot.contractStatus} ({view.snapshot.authoredOn})</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-wide text-slate-500">Recommended credits G9-G12</dt>
            <dd className="text-slate-700">{formatCredit(totalCredits)}</dd>
          </div>
        </dl>
      </header>

      <GraduationBanner view={view} />

      <section aria-labelledby="hs-progression-heading" className="grid gap-3">
        <h3 id="hs-progression-heading" className="font-semibold text-slate-800">Progression Grade 9 → 10 → 11 → 12</h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(view.snapshot.gradeSpan.filter((g) => g !== 8)).map((g) => <GradeColumn key={g} grade={g} view={view} />)}
        </div>
      </section>

      <section aria-labelledby="hs-family-progression-heading" className="grid gap-3">
        <h3 id="hs-family-progression-heading" className="font-semibold text-slate-800">Subject-family continuity</h3>
        <FamilyProgressionTable view={view} />
      </section>

      <SeamSection view={view} />
      <StandardsSection view={view} />
      <GapsSection view={view} />

      <footer aria-label="Summary of known gaps" className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <p className="font-semibold uppercase tracking-wide text-slate-500">Summary</p>
        <ul className="mt-1 grid gap-1 md:grid-cols-2">
          {gaps.map((g) => (
            <li key={g.requirement}>
              <StatusBadge status={g.displayStatus} /> <span className="ml-2 font-mono">{g.requirement}</span> — {g.owner}
            </li>
          ))}
        </ul>
        <p className="mt-2">
          Data is embedded from <span className="font-mono">{HIGH_SCHOOL_PROGRAM_SNAPSHOT.sourceRef}</span>. Subject branches (<span className="font-mono">mac/hs912-*-r1</span>) hold in-progress authored content that has not been reconciled into the release; this admin view intentionally shows only what the release contract has published.
        </p>
      </footer>
    </section>
  )
}
