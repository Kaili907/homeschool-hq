import { useMemo } from 'react'
import {
  HIGH_SCHOOL_PROGRAM_SNAPSHOT,
  deriveHighSchoolProgramView,
  divergentReconciliations,
  knownGapSummaries,
  reconciliationVerdictCounts,
  totalCreditsByGrade,
  totalHighSchoolCredits,
  type CourseReconciliation,
  type CoverageStatus,
  type EvidenceRole,
  type HighSchoolGrade,
  type HighSchoolProgramSnapshot,
  type HighSchoolProgramView,
  type ReconciliationVerdict,
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

const RECONCILIATION_STYLE: Readonly<Record<ReconciliationVerdict, { label: string; className: string }>> = {
  MATCHES_CONTRACT: { label: 'MATCHES CONTRACT', className: 'bg-emerald-100 text-emerald-800 border border-emerald-300' },
  DIVERGES_TITLE: { label: 'DIVERGES · title', className: 'bg-amber-100 text-amber-800 border border-amber-300' },
  DIVERGES_SESSIONS: { label: 'DIVERGES · sessions', className: 'bg-amber-100 text-amber-800 border border-amber-300' },
  DIVERGES_TITLE_AND_SESSIONS: { label: 'DIVERGES · title + sessions', className: 'bg-amber-100 text-amber-800 border border-amber-300' },
  DIVERGES_ID_SCHEME: { label: 'DIVERGES · id scheme', className: 'bg-rose-100 text-rose-800 border border-rose-300' },
  DIVERGES_MULTIPLE: { label: 'DIVERGES · multiple', className: 'bg-rose-100 text-rose-800 border border-rose-300' },
  NO_SUBJECT_EVIDENCE: { label: 'NO SUBJECT EVIDENCE', className: 'bg-slate-100 text-slate-700 border border-slate-300' },
}

const ROLE_STYLE: Readonly<Record<EvidenceRole, { label: string; className: string }>> = {
  RELEASE_PLANNING_CONTRACT: { label: 'PLANNING CONTRACT', className: 'bg-slate-800 text-white border border-slate-800' },
  AUTHORED_SUBJECT_EVIDENCE: { label: 'AUTHORED EVIDENCE', className: 'bg-emerald-800 text-white border border-emerald-800' },
  SUPERSEDED_SUBJECT_EVIDENCE: { label: 'SUPERSEDED', className: 'bg-slate-500 text-white border border-slate-500' },
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
  const reconciliationsByCourse = useMemo(() => new Map(view.reconciliations.map((r) => [r.courseId, r])), [view.reconciliations])
  return (
    <section className="flex flex-col rounded-lg border border-slate-300 bg-white" aria-labelledby={`hs-grade-${grade}-heading`}>
      <header className="border-b border-slate-200 bg-slate-50 px-3 py-2">
        <h4 id={`hs-grade-${grade}-heading`} className="font-semibold text-slate-800">Grade {grade}</h4>
        <p className="text-xs text-slate-600">{row?.courses.length ?? 0} courses · {stated}/{row?.courses.length ?? 0} record a contracted credit · total {formatCredit(total)}</p>
      </header>
      <ol className="divide-y divide-slate-100">
        {row?.courses.map((c) => {
          const reconciliation = reconciliationsByCourse.get(c.courseId)
          const badge = reconciliation ? RECONCILIATION_STYLE[reconciliation.verdict] : null
          return (
            <li key={c.courseId} className="grid gap-1 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{c.courseName}</p>
                  <p className="break-all text-xs text-slate-500">{c.courseId} · {c.subject}</p>
                </div>
                <span
                  className="whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-mono text-slate-700"
                  title="CONTRACTED / RECOMMENDED credit from release matrix; '—' when the source records null (grade-8 anchors)"
                >
                  {formatCredit(c.creditRecommendation)} cr
                  <span className="ml-1 text-[0.6rem] uppercase text-slate-500">contracted</span>
                </span>
              </div>
              <p className="text-xs text-slate-600">{c.sessions} sessions{c.cadence ? ` · ${c.cadence}` : ''} · {c.authoringStatus === 'FROZEN_DO_NOT_MODIFY' ? 'frozen anchor' : 'contract: to be authored'}</p>
              {c.satisfiesStateRequirements.length > 0 && (
                <p className="text-xs text-slate-500"><span className="font-semibold text-slate-700">Satisfies:</span> {c.satisfiesStateRequirements.join(', ')}</p>
              )}
              {reconciliation && badge && (
                <p className="flex flex-wrap items-center gap-1 text-xs text-slate-600">
                  <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${badge.className}`}>{badge.label}</span>
                  <span>subject evidence: <span className="font-mono">{reconciliation.subjectRef}</span> @ <span className="font-mono">{reconciliation.subjectSha}</span></span>
                </p>
              )}
            </li>
          )
        })}
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

function SourceEvidenceSection({ view }: { readonly view: HighSchoolProgramView }) {
  return (
    <section aria-labelledby="hs-sources-heading" className="rounded-lg border border-slate-300 bg-white">
      <header className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 id="hs-sources-heading" className="font-semibold text-slate-800">Source evidence catalog</h3>
        <p className="text-xs text-slate-600">One row per read-only source consulted. SHAs are observed at snapshot-authoring time; verify by re-inspecting the ref before acting on any field.</p>
      </header>
      <ul className="divide-y divide-slate-100">
        {view.sources.map(({ source, displayStatus }) => (
          <li key={source.key} className="grid gap-1 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-slate-800">
                  <span className="break-all font-mono text-xs text-slate-600">{source.ref}</span>
                  <span className="mx-1 text-slate-400">@</span>
                  <span className="font-mono text-xs text-slate-600">{source.sha}</span>
                </p>
                <p className="text-xs text-slate-500">{source.headSubject}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${ROLE_STYLE[source.role].className}`}>{ROLE_STYLE[source.role].label}</span>
                <StatusBadge status={displayStatus} />
              </div>
            </div>
            <p className="text-sm text-slate-700">{source.validationSummary}</p>
            <p className="text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Families:</span> {source.familiesCovered.join(', ')}
              {source.supersededBy ? <> · <span className="font-semibold text-slate-700">Superseded by:</span> <span className="font-mono">{source.supersededBy}</span></> : null}
            </p>
            <ul className="list-disc pl-5 text-xs text-slate-600">
              {source.authoringRootPaths.map((p) => <li key={p} className="break-all font-mono">{p}</li>)}
            </ul>
            <p className="text-xs text-slate-500">{source.note}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ReconciliationSection({ view }: { readonly view: HighSchoolProgramView }) {
  const counts = reconciliationVerdictCounts(view)
  const divergent = divergentReconciliations(view)
  return (
    <section aria-labelledby="hs-reconciliation-heading" className="rounded-lg border border-slate-300 bg-white">
      <header className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 id="hs-reconciliation-heading" className="font-semibold text-slate-800">Contract ↔ subject-branch reconciliation</h3>
        <p className="text-xs text-slate-600">
          {counts.MATCHES_CONTRACT} of {view.reconciliations.length} courses match the contract. {divergent.length} diverge on title, session count, and/or id scheme.
          Divergences are open items for the release integration owner; the release matrix remains the authoritative planning contract.
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <caption className="sr-only">Per-course reconciliation between the release contract and subject-branch authored evidence</caption>
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="border-b border-slate-200 px-3 py-2">Course</th>
              <th scope="col" className="border-b border-slate-200 px-3 py-2">Contract title</th>
              <th scope="col" className="border-b border-slate-200 px-3 py-2">Subject-branch title</th>
              <th scope="col" className="border-b border-slate-200 px-3 py-2">Sessions (contract → subject)</th>
              <th scope="col" className="border-b border-slate-200 px-3 py-2">Subject ref @ SHA</th>
              <th scope="col" className="border-b border-slate-200 px-3 py-2">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {view.reconciliations.map((r) => (
              <tr key={r.courseId} className="border-b border-slate-100 align-top">
                <th scope="row" className="px-3 py-2 text-left align-top text-slate-800">
                  <p className="font-mono text-xs">{r.courseId}</p>
                  <p className="text-[0.65rem] uppercase text-slate-500">Grade {r.grade} · {r.subject}</p>
                </th>
                <td className="px-3 py-2 text-slate-700">{r.contractTitle}</td>
                <td className="px-3 py-2 text-slate-700">
                  {r.subjectTitle ?? <span className="text-xs uppercase text-slate-500">not authored</span>}
                  {r.subjectCourseId && !r.idMatch && (
                    <p className="mt-0.5 text-xs text-rose-700"><span className="font-semibold">id:</span> <span className="font-mono">{r.subjectCourseId}</span></p>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-700">
                  {r.contractSessions} → {r.subjectSessions ?? '—'}
                  {r.sessionsMatch ? <span className="ml-1 text-emerald-700">✓</span> : <span className="ml-1 text-rose-700">✗</span>}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {r.subjectRef ? <><span className="break-all font-mono">{r.subjectRef}</span><br /><span className="font-mono">@ {r.subjectSha}</span></> : '—'}
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${RECONCILIATION_STYLE[r.verdict].className}`}>{RECONCILIATION_STYLE[r.verdict].label}</span>
                  <p className="mt-1 text-xs text-slate-600">{r.note}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function DeliverySection({ view }: { readonly view: HighSchoolProgramView }) {
  return (
    <section aria-labelledby="hs-delivery-heading" className="rounded-lg border border-slate-300 bg-white">
      <header className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 id="hs-delivery-heading" className="font-semibold text-slate-800">Delivery / integration status</h3>
            <p className="text-xs text-slate-600">Whether the served runtime actually delivers Grades 9-12 today. Facts are lifted verbatim from read-only source documents; nothing here is inferred from absence.</p>
          </div>
          <StatusBadge status={view.deliveryStatus.displayStatus} />
        </div>
        <p className="mt-1 text-xs text-slate-600">{view.deliveryStatus.reason}</p>
      </header>
      <ul className="divide-y divide-slate-100">
        {view.delivery.map((d) => (
          <li key={d.fact} className="grid gap-1 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-slate-800">{d.fact}</p>
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${d.servedInRelease ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}`}>
                {d.servedInRelease ? 'SERVED' : 'NOT SERVED'}
              </span>
            </div>
            <p className="text-sm text-slate-700">{d.note}</p>
            <p className="break-all text-xs text-slate-500">Evidence: <span className="font-mono">{d.evidenceRef}</span> · <span className="font-mono">{d.evidencePath}</span></p>
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
  const reconciliationCounts = useMemo(() => reconciliationVerdictCounts(view), [view])
  const authoredSourceCount = view.sources.filter((s) => s.source.role === 'AUTHORED_SUBJECT_EVIDENCE').length
  const supersededSourceCount = view.sources.filter((s) => s.source.role === 'SUPERSEDED_SUBJECT_EVIDENCE').length

  return (
    <section aria-labelledby="admin-high-school-program-heading" className="mx-auto grid max-w-6xl gap-5 p-6 text-slate-800">
      <header className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Admin · High-school programme</p>
        <h2 id="admin-high-school-program-heading" className="font-serif text-2xl font-medium text-slate-900">
          Manuel Academy Grades 8 → 12
        </h2>
        <p className="text-sm text-slate-600">
          Credit and session values shown are <strong>CONTRACTED / RECOMMENDED</strong> by the release matrix. Subject-branch authored content may diverge from the contract and, per the release contract's own §5, is <strong>not yet served</strong> by the runtime.
        </p>
        <dl className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="font-semibold uppercase tracking-wide text-slate-500">Contract</dt>
            <dd className="break-all font-mono text-slate-700">{view.snapshot.contractId}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-wide text-slate-500">Source ref @ SHA</dt>
            <dd className="break-all font-mono text-slate-700">{view.snapshot.sourceRef} @ {view.snapshot.sourceSha}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-wide text-slate-500">Status</dt>
            <dd className="text-slate-700">{view.snapshot.contractStatus} ({view.snapshot.authoredOn})</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-wide text-slate-500">CONTRACTED credits G9-G12</dt>
            <dd className="text-slate-700">{formatCredit(totalCredits)}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-wide text-slate-500">Sources catalogued</dt>
            <dd className="text-slate-700">{view.sources.length} (1 planning contract, {authoredSourceCount} authored, {supersededSourceCount} superseded)</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-wide text-slate-500">Courses matching subject evidence</dt>
            <dd className="text-slate-700">{reconciliationCounts.MATCHES_CONTRACT} / {view.reconciliations.length}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-wide text-slate-500">Delivery / served</dt>
            <dd className="flex items-center gap-2 text-slate-700">
              <StatusBadge status={view.deliveryStatus.displayStatus} />
              <span>{view.deliveryStatus.servedInReleaseCount} / {view.deliveryStatus.totalFacts} facts served</span>
            </dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-wide text-slate-500">Graduation</dt>
            <dd className="flex items-center gap-2 text-slate-700">
              <StatusBadge status={view.graduationCompletionClaimable ? 'COVERED' : view.graduation.overallStatus === 'unverified' ? 'UNVERIFIED' : 'NOT_COVERED'} />
              <span>{view.graduation.overallStatus.replace(/_/g, ' ')}</span>
            </dd>
          </div>
        </dl>
      </header>

      <GraduationBanner view={view} />

      <section aria-labelledby="hs-progression-heading" className="grid gap-3">
        <h3 id="hs-progression-heading" className="font-semibold text-slate-800">Progression Grade 9 → 10 → 11 → 12 (contracted)</h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(view.snapshot.gradeSpan.filter((g) => g !== 8)).map((g) => <GradeColumn key={g} grade={g} view={view} />)}
        </div>
      </section>

      <section aria-labelledby="hs-family-progression-heading" className="grid gap-3">
        <h3 id="hs-family-progression-heading" className="font-semibold text-slate-800">Subject-family continuity (contracted)</h3>
        <FamilyProgressionTable view={view} />
      </section>

      <SeamSection view={view} />
      <StandardsSection view={view} />
      <GapsSection view={view} />
      <SourceEvidenceSection view={view} />
      <ReconciliationSection view={view} />
      <DeliverySection view={view} />

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
          Programme/planning contract embedded from <span className="font-mono">{view.snapshot.sourceRef} @ {view.snapshot.sourceSha}</span>. Subject branches (<span className="font-mono">mac/hs912-*-r1</span>, plus the science h2/h3/h4 fix chain) hold authored content that carries independent validation and, in several families, diverges from the contract on title and/or session count. Nothing on this view is served by the runtime today — see the delivery section for evidence.
        </p>
      </footer>
    </section>
  )
}
