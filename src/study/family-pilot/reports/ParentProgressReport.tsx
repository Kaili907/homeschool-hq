import { useMemo, useState } from 'react'
import { ACADEMY_SUBJECT_LABELS } from '../../../academy/contentTypes'
import type { BuildParentProgressReportInput, ParentProgressReportModel, ParentReportRangePreset } from './parentReport'
import {
  buildParentProgressReport,
  parentProgressReportToJson,
  parentSchoolLogToCsv,
  resolveParentReportRange,
} from './parentReport'

type ReportSource = Omit<BuildParentProgressReportInput, 'range' | 'generatedOn'>

function formatDate(date: string): string {
  const held = new Date(`${date}T12:00:00.000Z`)
  return Number.isFinite(held.getTime())
    ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(held)
    : date
}

function formatStudyTime(seconds: number | null, coverage: 'recorded' | 'partial' | 'not-recorded'): string {
  if (seconds === null) return 'Not recorded'
  const hours = Math.floor(seconds / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  const remainder = seconds % 60
  const parts = [hours ? `${hours}h` : '', minutes ? `${minutes}m` : '', remainder || (!hours && !minutes) ? `${remainder}s` : ''].filter(Boolean)
  return `${parts.join(' ')}${coverage === 'partial' ? ' (partial history)' : ''}`
}

function assessmentStatus(status: string): string {
  return status.toLowerCase().replaceAll('_', ' ').replace(/^./, (character) => character.toUpperCase())
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'learner'
}

function download(contents: string, type: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function Fact({ label, value }: { readonly label: string; readonly value: string | number }) {
  return <div className="report-fact rounded-lg border border-slate-200 p-3"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-xl font-extrabold text-slate-950">{value}</dd></div>
}

function ReportDocument({ report }: { readonly report: ParentProgressReportModel }) {
  return (
    <article className="parent-progress-report-document rounded-2xl border border-slate-300 bg-white p-6 text-slate-950" data-parent-report-student-ref={report.learner.studentRef}>
      <header className="border-b-2 border-slate-900 pb-4">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-600">Manuel Academy</p>
        <h2 className="mt-1 text-3xl font-extrabold">Parent Progress Report</h2>
        <div className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          <p><strong>Learner:</strong> {report.learner.displayName}</p>
          <p><strong>Nominal grade:</strong> Grade {report.learner.nominalGrade}</p>
          <p><strong>Period:</strong> {formatDate(report.range.startDate)}–{formatDate(report.range.endDate)}</p>
          <p><strong>Generated:</strong> {formatDate(report.generatedOn)}</p>
        </div>
        <p className="mt-3 text-xs text-slate-600">Factual household record generated from saved learning activity. The school log is not labeled as legally sufficient attendance documentation.</p>
      </header>

      <section className="report-section mt-5" aria-labelledby="parent-report-summary">
        <h3 id="parent-report-summary" className="text-xl font-extrabold">Period summary</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Lessons completed" value={report.totals.lessonsCompleted} />
          <Fact label="Recorded active Study time" value={formatStudyTime(report.totals.recordedStudyTime.activeSeconds, report.totals.recordedStudyTime.coverage)} />
          <Fact label="School days with recorded activity" value={report.totals.schoolDaysWithRecordedActivity} />
          <Fact label="Certified assessments" value={report.totals.certifiedAssessments} />
        </dl>
      </section>

      <section className="report-section mt-6" aria-labelledby="parent-report-subjects">
        <h3 id="parent-report-subjects" className="text-xl font-extrabold">Courses and working levels</h3>
        <p className="mt-1 text-sm text-slate-600">Nominal grade remains the reporting grade. Working levels describe current subject placement only.</p>
        <div className="mt-3 space-y-3">
          {report.subjects.map((subject) => (
            <section key={subject.subject} className="report-subject rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="font-extrabold">{ACADEMY_SUBJECT_LABELS[subject.subject]} · Working Grade {subject.workingGrade}</h4>
                <p className="text-sm font-semibold">{subject.completedLessonsInPeriod} completed · {formatStudyTime(subject.recordedStudyTime.activeSeconds, subject.recordedStudyTime.coverage)}</p>
              </div>
              <p className="mt-1 text-sm"><strong>Course:</strong> {subject.courseTitle}{subject.courseLessonCount !== null ? ` · ${subject.courseLessonCount} catalog lessons` : ''}</p>
              <p className="mt-1 text-sm"><strong>Position:</strong> {subject.position
                ? `${subject.position.unitNumber !== null ? `Unit ${subject.position.unitNumber}${subject.position.unitTitle ? `: ${subject.position.unitTitle}` : ''} · ` : ''}${subject.position.courseLessonNumber !== null ? `Course lesson ${subject.position.courseLessonNumber} · ` : ''}${subject.position.lessonTitle} (${subject.position.lessonState})`
                : 'No assigned lesson position recorded'}</p>
              <p className="mt-1 text-sm"><strong>Assessment records:</strong> {subject.certifiedAssessmentsInPeriod} certified in period · {subject.pendingAssessments} currently pending</p>
            </section>
          ))}
        </div>
      </section>

      <section className="report-section mt-6" aria-labelledby="parent-report-assessments">
        <h3 id="parent-report-assessments" className="text-xl font-extrabold">Assessments</h3>
        <p className="mt-1 text-sm text-slate-600">Only saved certification state is reported. No score, letter grade, GPA, or class rank is calculated.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="font-extrabold">Certified in this period</h4>
            {report.certifiedAssessments.length ? <ul className="mt-2 space-y-2">{report.certifiedAssessments.map((assessment) => (
              <li key={assessment.assessmentRef} className="rounded-lg bg-emerald-50 p-3 text-sm"><strong>{assessment.title}</strong><br />{ACADEMY_SUBJECT_LABELS[assessment.subject]} · Certified {formatDate(assessment.recordDate)}</li>
            ))}</ul> : <p className="mt-2 text-sm text-slate-600">No certified assessment records in this period.</p>}
          </div>
          <div>
            <h4 className="font-extrabold">Currently pending</h4>
            {report.pendingAssessments.length ? <ul className="mt-2 space-y-2">{report.pendingAssessments.map((assessment) => (
              <li key={assessment.assessmentRef} className="rounded-lg bg-amber-50 p-3 text-sm"><strong>{assessment.title}</strong><br />{ACADEMY_SUBJECT_LABELS[assessment.subject]} · {assessmentStatus(assessment.status)}</li>
            ))}</ul> : <p className="mt-2 text-sm text-slate-600">No pending assessment records.</p>}
          </div>
        </div>
      </section>

      <section className="report-section mt-6" aria-labelledby="parent-school-log">
        <h3 id="parent-school-log" className="text-xl font-extrabold">Chronological school activity log</h3>
        <p className="mt-1 text-sm text-slate-600">Each row is a date with saved active Study time, a completed lesson, or a non-planned assessment state record.</p>
        {report.schoolLog.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="report-log w-full border-collapse text-left text-sm">
              <thead><tr className="border-y-2 border-slate-900"><th className="p-2">Date</th><th className="p-2">Subjects worked</th><th className="p-2">Lessons completed</th><th className="p-2">Recorded active Study time</th><th className="p-2">Assessment state</th></tr></thead>
              <tbody>{report.schoolLog.map((entry) => (
                <tr key={entry.date} className="border-b border-slate-200 align-top">
                  <td className="p-2 font-semibold whitespace-nowrap">{formatDate(entry.date)}</td>
                  <td className="p-2">{entry.subjectsWorked.map((subject) => ACADEMY_SUBJECT_LABELS[subject]).join(', ')}</td>
                  <td className="p-2">{entry.lessonsCompleted.length ? entry.lessonsCompleted.map((lesson) => lesson.title).join('; ') : 'None recorded'}</td>
                  <td className="p-2">{formatStudyTime(entry.recordedStudyTime.activeSeconds, entry.recordedStudyTime.coverage)}</td>
                  <td className="p-2">{entry.assessmentStates.length ? entry.assessmentStates.map((assessment) => `${assessment.title}: ${assessmentStatus(assessment.status)}`).join('; ') : 'None recorded'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="mt-3 rounded-lg bg-slate-100 p-4 text-sm text-slate-600">No saved school activity falls within this period.</p>}
      </section>

      <footer className="mt-6 border-t border-slate-300 pt-3 text-xs text-slate-600">
        Recorded active Study time counts bounded intervals while Study was visible and active. Paused and hidden time is excluded; historical coverage is labeled when unavailable or partial.
      </footer>
    </article>
  )
}

/** Parent-PIN-gated report controls and printable factual document. */
export function ParentProgressReport({
  source,
  today,
  schoolYear,
}: {
  readonly source: ReportSource
  readonly today: string
  readonly schoolYear?: { readonly startDate: string; readonly endDate: string } | null
}) {
  const [preset, setPreset] = useState<ParentReportRangePreset>('this-week')
  const [customStart, setCustomStart] = useState(today)
  const [customEnd, setCustomEnd] = useState(today)
  const resolution = resolveParentReportRange({ preset, today, schoolYear, customStart, customEnd })
  const report = useMemo(() => resolution.status === 'ready' ? buildParentProgressReport({
    ...source,
    range: resolution.range,
    generatedOn: today,
  }) : null, [resolution, source, today])

  const exportReport = (format: 'csv' | 'json') => {
    if (!report) return
    const stem = `${slug(report.learner.displayName)}-progress-${report.range.startDate}-${report.range.endDate}`
    if (format === 'csv') download(parentSchoolLogToCsv(report), 'text/csv;charset=utf-8', `${stem}.csv`)
    else download(parentProgressReportToJson(report), 'application/json;charset=utf-8', `${stem}.json`)
  }

  return (
    <div className="parent-progress-report space-y-5">
      <section className="parent-report-controls rounded-2xl border bg-white p-5 print:hidden">
        <h3 className="text-xl font-extrabold">Generate learner record</h3>
        <p className="mt-1 text-sm text-slate-600">Choose one learner above and one factual reporting period.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="font-bold">Report period
            <select aria-label="Report period" className="mt-1 block rounded-lg border px-3 py-2" value={preset} onChange={(event) => setPreset(event.target.value as ParentReportRangePreset)}>
              <option value="this-week">This week</option>
              <option value="month">Month to date</option>
              <option value="school-year" disabled={!schoolYear}>School year</option>
              <option value="custom">Custom date range</option>
            </select>
          </label>
          {preset === 'custom' ? <>
            <label className="font-bold">Starts<input aria-label="Custom report starts" type="date" className="mt-1 block rounded-lg border px-3 py-2" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label>
            <label className="font-bold">Ends<input aria-label="Custom report ends" type="date" className="mt-1 block rounded-lg border px-3 py-2" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label>
          </> : null}
          <button type="button" className="rounded-lg bg-slate-900 px-4 py-2 font-bold text-white" disabled={!report} onClick={() => window.print()}>Print / Save as PDF</button>
          <button type="button" className="rounded-lg border border-slate-400 bg-white px-4 py-2 font-bold" disabled={!report} onClick={() => exportReport('csv')}>Export school log CSV</button>
          <button type="button" className="rounded-lg border border-slate-400 bg-white px-4 py-2 font-bold" disabled={!report} onClick={() => exportReport('json')}>Export factual JSON</button>
        </div>
        {!schoolYear ? <p className="mt-3 text-sm text-amber-800">Save this learner’s School Plan to enable the school-year preset.</p> : null}
        {resolution.status === 'unavailable' ? <p className="mt-3 font-semibold text-red-700" role="alert">{resolution.reason}</p> : null}
      </section>
      {report ? <ReportDocument report={report} /> : null}
    </div>
  )
}
