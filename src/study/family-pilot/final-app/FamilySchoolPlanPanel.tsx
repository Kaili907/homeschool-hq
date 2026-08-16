import { useEffect, useMemo, useState } from 'react'
import { ACADEMY_SUBJECT_LABELS } from '../../../academy/contentTypes'
import type { AcademySubject } from '../../../types'
import {
  FAMILY_AUTO_PLANNER_SCHEMA_VERSION,
  type FamilyAutoPlannerSchoolPlanV1,
  type FamilyAutoPlannerSubjectPlanV1,
  type SchoolWeekday,
} from '../auto-planner'
import type { FamilySetupStudent } from '../setup'
import type { FinalFamilyAutoPlannerHost } from './autoPlannerHost'
import type { FinalFamilyPilotController } from './controller'

const WEEKDAYS: readonly { readonly value: SchoolWeekday; readonly label: string }[] = Object.freeze([
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
])

interface SchoolPlanDraft {
  readonly householdTimeZone: string
  readonly schoolYearStart: string
  readonly schoolYearEnd: string
  readonly schoolWeekdays: readonly SchoolWeekday[]
  readonly nonSchoolDates: string
  readonly addedSchoolDates: string
  readonly allowWorkAhead: boolean
  readonly subjects: readonly FamilyAutoPlannerSubjectPlanV1[]
  readonly configuredAt: string
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function recommendedYear(now: Date): { readonly start: string; readonly end: string } {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1
  const startYear = month >= 7 ? year : year - 1
  return { start: `${startYear}-08-01`, end: `${startYear + 1}-06-30` }
}

function detectedTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function dates(value: string): readonly string[] {
  return Object.freeze([...new Set(value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean))].sort())
}

function draftFor(
  student: FamilySetupStudent,
  controller: FinalFamilyPilotController,
  stored: FamilyAutoPlannerSchoolPlanV1 | null,
  now = new Date(),
): SchoolPlanDraft {
  if (stored) {
    const bySubject = new Map(stored.subjects.map((item) => [item.subject, item]))
    return Object.freeze({
      householdTimeZone: stored.householdTimeZone,
      schoolYearStart: stored.schoolYearStart,
      schoolYearEnd: stored.schoolYearEnd,
      schoolWeekdays: Object.freeze([...stored.schoolWeekdays]),
      nonSchoolDates: stored.nonSchoolDates.join('\n'),
      addedSchoolDates: stored.addedSchoolDates.join('\n'),
      allowWorkAhead: stored.allowWorkAhead !== false,
      subjects: Object.freeze(student.enabledSubjects.map((subject, index) => bySubject.get(subject) ?? Object.freeze({
        subject,
        order: index,
        paused: false,
        courseRef: controller.coursesFor(student, subject)[0]?.courseRef,
        lessonsPerDay: 1,
        startLocalTime: '09:00',
      }))),
      configuredAt: stored.configuredAt,
    })
  }
  const year = recommendedYear(now)
  return Object.freeze({
    householdTimeZone: detectedTimeZone(),
    schoolYearStart: year.start,
    schoolYearEnd: year.end,
    schoolWeekdays: Object.freeze([1, 2, 3, 4, 5] as SchoolWeekday[]),
    nonSchoolDates: '',
    addedSchoolDates: '',
    allowWorkAhead: true,
    subjects: Object.freeze(student.enabledSubjects.map((subject, index) => Object.freeze({
      subject,
      order: index,
      paused: false,
      courseRef: controller.coursesFor(student, subject)[0]?.courseRef,
      lessonsPerDay: 1,
      startLocalTime: '09:00',
    }))),
    configuredAt: now.toISOString(),
  })
}

function replaceSubject(
  draft: SchoolPlanDraft,
  subject: AcademySubject,
  patch: Partial<FamilyAutoPlannerSubjectPlanV1>,
): SchoolPlanDraft {
  return Object.freeze({
    ...draft,
    subjects: Object.freeze(draft.subjects.map((item) => item.subject === subject ? Object.freeze({ ...item, ...patch }) : item)),
  })
}

function ordered(subjects: readonly FamilyAutoPlannerSubjectPlanV1[]): readonly FamilyAutoPlannerSubjectPlanV1[] {
  return Object.freeze([...subjects]
    .sort((a, b) => a.order - b.order || a.subject.localeCompare(b.subject))
    .map((item, order) => Object.freeze({ ...item, order })))
}

export function FamilySchoolPlanPanel({
  controller,
  host,
  student,
  onSaved,
}: {
  readonly controller: FinalFamilyPilotController
  readonly host: FinalFamilyAutoPlannerHost
  readonly student: FamilySetupStudent
  readonly onSaved?: () => void
}) {
  const [draft, setDraft] = useState<SchoolPlanDraft | null>(null)
  const [stored, setStored] = useState(false)
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    setBusy(true)
    setDraft(null)
    setMessage('')
    setError('')
    void host.loadDocument(student.studentRef).then((loaded) => {
      if (!live) return
      if (loaded.status !== 'ready') {
        setError(loaded.status === 'read-only'
          ? 'This School Plan was written by a newer app and cannot be changed here.'
          : 'School Plan storage is unavailable on this device.')
        setBusy(false)
        return
      }
      setStored(Boolean(loaded.document.schoolPlan))
      setDraft(draftFor(student, controller, loaded.document.schoolPlan))
      setBusy(false)
    }).catch(() => {
      if (live) { setError('School Plan storage is unavailable on this device.'); setBusy(false) }
    })
    return () => { live = false }
  // Controller refreshes replace snapshot objects even when this learner did
  // not change. Key the load to identity so a successful save can announce
  // itself instead of immediately remounting the editor.
  }, [controller, host, student.studentRef])

  const courseOptions = useMemo(() => new Map(student.enabledSubjects.map((subject) => [
    subject,
    controller.coursesFor(student, subject),
  ])), [controller, student])

  if (busy) return <section className="mt-6 rounded-2xl border bg-white p-5" aria-busy="true"><p role="status">Opening School Plan…</p></section>
  if (!draft) return <section className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-5"><p role="alert">{error || 'School Plan is unavailable.'}</p></section>

  const patch = (change: Partial<SchoolPlanDraft>) => setDraft(Object.freeze({ ...draft, ...change }))
  const move = (subject: AcademySubject, direction: -1 | 1) => {
    const items = [...ordered(draft.subjects)]
    const index = items.findIndex((item) => item.subject === subject)
    const target = index + direction
    if (index < 0 || target < 0 || target >= items.length) return
    ;[items[index], items[target]] = [items[target], items[index]]
    patch({ subjects: ordered(items.map((item, order) => Object.freeze({ ...item, order }))) })
  }
  const save = async () => {
    setBusy(true)
    setError('')
    setMessage('')
    const now = new Date().toISOString()
    const plan: FamilyAutoPlannerSchoolPlanV1 = Object.freeze({
      schemaVersion: FAMILY_AUTO_PLANNER_SCHEMA_VERSION,
      householdTimeZone: draft.householdTimeZone.trim(),
      schoolYearStart: draft.schoolYearStart,
      schoolYearEnd: draft.schoolYearEnd,
      schoolWeekdays: Object.freeze([...draft.schoolWeekdays].sort()),
      nonSchoolDates: dates(draft.nonSchoolDates),
      addedSchoolDates: dates(draft.addedSchoolDates),
      allowWorkAhead: draft.allowWorkAhead,
      subjects: ordered(draft.subjects).map((item) => Object.freeze({ ...item, courseRef: item.courseRef?.trim() || undefined })),
      configuredAt: draft.configuredAt,
      updatedAt: now,
    })
    const result = await host.configure(host.scope(student.studentRef), plan)
    setBusy(false)
    if (result.status !== 'saved') {
      setError(result.reason === 'SCHOOL_PLAN_INVALID'
        ? 'Review every field. Dates must be valid, at least one school weekday is required, dates off cannot also be added school days, and every subject needs a valid course, time, order, and lesson cap.'
        : 'The School Plan could not be saved safely on this device.')
      return
    }
    setStored(true)
    setDraft(draftFor(student, controller, result.document.schoolPlan))
    setMessage('School Plan saved. Today’s Work will now be prepared automatically in the family overview or when this learner opens the dashboard.')
    onSaved?.()
  }

  return (
    <div className="mt-6 space-y-5" data-testid="family-school-plan">
      <section className="rounded-2xl border bg-white p-5">
        <p className="font-bold text-cyan-700">Parent-authorized School Plan</p>
        <h3 className="mt-1 text-2xl font-extrabold">{student.displayName}’s automatic daily plan</h3>
        <p className="mt-2 text-slate-600">Review and save every value below. Suggested values are prefilled only for review; nothing is persisted until you choose Save School Plan.</p>
        <p className="mt-2 font-semibold">Learner: {student.displayName} · Nominal Grade {student.nominalGrade}</p>
        <p className="text-sm text-slate-600">Working levels and enrolled subjects remain under Preferences. This plan never changes them.</p>
        {!stored ? <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 font-semibold">One-time setup required before ordinary lessons can be assigned automatically.</p> : null}
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h4 className="text-lg font-extrabold">Calendar and timezone</h4>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="font-bold sm:col-span-3">IANA timezone
            <input aria-label="School Plan timezone" className="mt-1 w-full rounded-lg border px-3 py-2" value={draft.householdTimeZone} onChange={(event) => patch({ householdTimeZone: event.target.value })} />
            <span className="mt-1 block text-xs font-normal text-slate-600">Detected timezone is a suggested starting value. Save makes the reviewed value explicit.</span>
          </label>
          <label className="font-bold">School year starts<input aria-label="School year starts" type="date" className="mt-1 w-full rounded-lg border px-3 py-2" value={draft.schoolYearStart} onChange={(event) => patch({ schoolYearStart: event.target.value })} /></label>
          <label className="font-bold">School year ends<input aria-label="School year ends" type="date" className="mt-1 w-full rounded-lg border px-3 py-2" value={draft.schoolYearEnd} onChange={(event) => patch({ schoolYearEnd: event.target.value })} /></label>
          <p className="self-end text-sm text-slate-600">Recommended dates are editable and must be reviewed.</p>
        </div>
        <fieldset className="mt-5">
          <legend className="font-bold">School weekdays</legend>
          <div className="mt-2 flex flex-wrap gap-3">{WEEKDAYS.map((day) => <label key={day.value} className="flex items-center gap-2 rounded-lg border px-3 py-2"><input type="checkbox" checked={draft.schoolWeekdays.includes(day.value)} onChange={(event) => patch({ schoolWeekdays: event.target.checked ? Object.freeze([...draft.schoolWeekdays, day.value]) : Object.freeze(draft.schoolWeekdays.filter((item) => item !== day.value)) })} />{day.label}</label>)}</div>
        </fieldset>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="font-bold">Explicit days off<textarea aria-label="Explicit days off" className="mt-1 min-h-28 w-full rounded-lg border px-3 py-2 font-mono text-sm" value={draft.nonSchoolDates} onChange={(event) => patch({ nonSchoolDates: event.target.value })} placeholder="YYYY-MM-DD, one per line" /></label>
          <label className="font-bold">Added school days<textarea aria-label="Added school days" className="mt-1 min-h-28 w-full rounded-lg border px-3 py-2 font-mono text-sm" value={draft.addedSchoolDates} onChange={(event) => patch({ addedSchoolDates: event.target.value })} placeholder="YYYY-MM-DD, one per line" /></label>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h4 className="text-lg font-extrabold">Learner flexibility</h4>
        <label className="mt-3 flex min-h-11 items-start gap-3 rounded-xl border p-4 font-bold">
          <input type="checkbox" className="mt-1" checked={draft.allowWorkAhead} onChange={(event) => patch({ allowWorkAhead: event.target.checked })} />
          <span>Allow work ahead<span className="mt-1 block text-sm font-normal text-slate-600">When enabled, this learner can start the next eligible lesson even when it is not scheduled for today. Work completed early counts toward course progress and will not be assigned again later.</span></span>
        </label>
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h4 className="text-lg font-extrabold">Subjects, order, cadence, and pauses</h4>
        <p className="mt-1 text-sm text-slate-600">Every enabled subject is shown. Choose which household school weekdays require each subject. Daily lesson cap applies only to required work; it never limits optional work ahead.</p>
        <ol className="mt-4 space-y-4">{ordered(draft.subjects).map((subject, index) => {
          const courses = courseOptions.get(subject.subject) ?? []
          const workingGrade = student.workingGradeBySubject[subject.subject] ?? student.nominalGrade
          return <li key={subject.subject} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="font-extrabold">{index + 1}. {ACADEMY_SUBJECT_LABELS[subject.subject] ?? subject.subject}</p><p className="text-sm text-slate-600">Official Working Grade {workingGrade}</p></div>
              <div className="flex gap-2"><button type="button" aria-label={`Move ${subject.subject} earlier`} className="rounded-lg border px-3 py-2 font-bold disabled:opacity-40" disabled={index === 0} onClick={() => move(subject.subject, -1)}>Earlier</button><button type="button" aria-label={`Move ${subject.subject} later`} className="rounded-lg border px-3 py-2 font-bold disabled:opacity-40" disabled={index === draft.subjects.length - 1} onClick={() => move(subject.subject, 1)}>Later</button></div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <label className="font-bold sm:col-span-2">Authorized course
                <select aria-label={`${subject.subject} authorized course`} className="mt-1 w-full rounded-lg border px-3 py-2" value={subject.courseRef ?? ''} onChange={(event) => setDraft(replaceSubject(draft, subject.subject, { courseRef: event.target.value || undefined }))}>
                  <option value="">Choose a course</option>
                  {courses.map((course) => <option key={course.courseRef} value={course.courseRef}>{course.title} · Grade {course.grade}</option>)}
                </select>
              </label>
              <label className="font-bold">Daily lesson cap<select aria-label={`${subject.subject} daily lesson cap`} className="mt-1 w-full rounded-lg border px-3 py-2" value={subject.lessonsPerDay} onChange={(event) => setDraft(replaceSubject(draft, subject.subject, { lessonsPerDay: Number(event.target.value) }))}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label className="font-bold">Local start time<input aria-label={`${subject.subject} local start time`} type="time" className="mt-1 w-full rounded-lg border px-3 py-2" value={subject.startLocalTime} onChange={(event) => setDraft(replaceSubject(draft, subject.subject, { startLocalTime: event.target.value }))} /></label>
            </div>
            <fieldset className="mt-3">
              <legend className="font-bold">Required weekdays</legend>
              <div className="mt-2 flex flex-wrap gap-2">{WEEKDAYS.filter((day) => draft.schoolWeekdays.includes(day.value)).map((day) => {
                const selected = subject.schoolWeekdays ?? draft.schoolWeekdays
                return <label key={day.value} className="flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2"><input type="checkbox" checked={selected.includes(day.value)} onChange={(event) => setDraft(replaceSubject(draft, subject.subject, { schoolWeekdays: event.target.checked ? Object.freeze([...selected, day.value].sort()) as readonly SchoolWeekday[] : Object.freeze(selected.filter((item) => item !== day.value)) }))} />{day.label}</label>
              })}</div>
            </fieldset>
            <label className="mt-3 flex items-center gap-2 font-bold"><input type="checkbox" checked={subject.paused} onChange={(event) => setDraft(replaceSubject(draft, subject.subject, { paused: event.target.checked }))} />Pause this subject (unfinished work is preserved; no new lesson is assigned)</label>
            {workingGrade === '6' || courses.length === 0 ? <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 font-semibold">Grade 6 is intentionally unsupported. Set an explicit supported working grade in Preferences; no Grade 5 or Grade 7 course will be substituted.</p> : null}
          </li>
        })}</ol>
      </section>

      {message ? <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 font-semibold" role="status">{message}</p> : null}
      {error ? <p className="rounded-lg border border-red-300 bg-red-50 p-3 font-semibold" role="alert">{error}</p> : null}
      <button type="button" className="rounded-lg bg-emerald-700 px-5 py-3 font-extrabold text-white disabled:opacity-50" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save School Plan'}</button>
      <p className="text-xs text-slate-500">Draft prepared {dateOnly(new Date())}. Saving is restricted to this already-unlocked Parent Hub.</p>
    </div>
  )
}
