import { useEffect, useMemo, useRef, useState } from 'react'
import { ACADEMY_GRADES, ACADEMY_SUBJECTS, type AcademyGrade, type AcademySubject } from '../../../types'
import {
  FAMILY_AUTO_PLANNER_SCHEMA_VERSION,
  type FamilyAutoPlannerSchoolPlanV1,
  type FamilyAutoPlannerSubjectPlanV1,
  type SchoolWeekday,
} from '../auto-planner'
import type { FamilySetupStudent } from '../setup'
import type { FinalFamilyAutoPlannerHost } from './autoPlannerHost'
import type { FinalFamilyPilotController } from './controller'
import {
  composeFamilySetup,
  effectiveWorkingGrade,
  orderedEnabledSubjects,
  orderedSubjects,
  parentSubjectLabel,
  SCHOOL_WEEKDAYS,
  schoolDaysPhrase,
  schoolPlanSummary,
  toPlannerSchoolPlan,
  type SchoolPlanDraft,
} from './schoolPlanPresentation'

const STEPS = Object.freeze([
  'School year',
  'School days',
  'Subjects',
  'Subject levels',
  'Weekly schedule',
  'Review plan',
])

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

function timeZoneChoices(current: string): readonly string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] }
  let choices: string[] = []
  try {
    choices = intl.supportedValuesOf?.('timeZone') ?? []
  } catch {
    choices = []
  }
  return Object.freeze([...new Set([current, detectedTimeZone(), 'UTC', ...choices].filter(Boolean))].sort())
}

function studentWithDraft(student: FamilySetupStudent, draft: SchoolPlanDraft): FamilySetupStudent {
  return Object.freeze({
    ...student,
    enabledSubjects: draft.enabledSubjects,
    workingGradeBySubject: Object.freeze({ ...draft.workingGradeBySubject }),
  })
}

function newSubjectPlan(
  student: FamilySetupStudent,
  controller: FinalFamilyPilotController,
  subject: AcademySubject,
  order: number,
): FamilyAutoPlannerSubjectPlanV1 {
  const courses = controller.coursesFor(student, subject)
  return Object.freeze({
    subject,
    order,
    paused: false,
    ...(courses.length === 1 ? { courseRef: courses[0].courseRef } : {}),
    lessonsPerDay: 1,
    startLocalTime: '09:00',
  })
}

function draftFor(
  student: FamilySetupStudent,
  controller: FinalFamilyPilotController,
  stored: FamilyAutoPlannerSchoolPlanV1 | null,
  now = new Date(),
): SchoolPlanDraft {
  const year = recommendedYear(now)
  const bySubject = new Map(stored?.subjects.map((item) => [item.subject, item]) ?? [])
  const subjects = student.enabledSubjects.map((subject, index) =>
    bySubject.get(subject) ?? newSubjectPlan(student, controller, subject, index))
  return Object.freeze({
    householdTimeZone: stored?.householdTimeZone ?? detectedTimeZone(),
    schoolYearStart: stored?.schoolYearStart ?? year.start,
    schoolYearEnd: stored?.schoolYearEnd ?? year.end,
    schoolWeekdays: Object.freeze([...(stored?.schoolWeekdays ?? [1, 2, 3, 4, 5] as SchoolWeekday[])]),
    nonSchoolDates: Object.freeze([...(stored?.nonSchoolDates ?? [])]),
    addedSchoolDates: Object.freeze([...(stored?.addedSchoolDates ?? [])]),
    enabledSubjects: Object.freeze([...student.enabledSubjects]),
    workingGradeBySubject: Object.freeze({ ...student.workingGradeBySubject }),
    subjects: orderedSubjects(subjects),
    configuredAt: stored?.configuredAt ?? now.toISOString(),
  })
}

function replaceSubject(
  draft: SchoolPlanDraft,
  subject: AcademySubject,
  patch: Partial<FamilyAutoPlannerSubjectPlanV1>,
): SchoolPlanDraft {
  return Object.freeze({
    ...draft,
    subjects: Object.freeze(draft.subjects.map((item) =>
      item.subject === subject ? Object.freeze({ ...item, ...patch }) : item)),
  })
}

function dateLabel(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)))
}

function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

function DateList({
  title,
  description,
  values,
  input,
  setInput,
  onChange,
}: {
  readonly title: string
  readonly description: string
  readonly values: readonly string[]
  readonly input: string
  readonly setInput: (value: string) => void
  readonly onChange: (dates: readonly string[]) => void
}) {
  const add = () => {
    if (!input || values.includes(input)) return
    onChange(Object.freeze([...values, input].sort()))
    setInput('')
  }
  return (
    <section className="min-w-0 rounded-xl border border-slate-200 p-4">
      <h5 className="font-extrabold">{title}</h5>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="min-w-0 font-bold"><span className="sr-only">Add {title.toLowerCase()}</span>
          <input aria-label={`Add ${title.toLowerCase()}`} type="date" className="min-h-11 w-full min-w-0 rounded-lg border px-3 py-2" value={input} onChange={(event) => setInput(event.target.value)} />
        </label>
        <button type="button" className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 font-bold" onClick={add}>Add date</button>
      </div>
      {values.length ? <ul className="mt-3 space-y-2">{values.map((value) => (
        <li key={value} className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
          <span className="min-w-0 break-words font-semibold">{dateLabel(value)}</span>
          <button type="button" className="min-h-11 shrink-0 rounded-lg border px-3 py-2 font-bold" aria-label={`Remove ${dateLabel(value)} from ${title.toLowerCase()}`} onClick={() => onChange(Object.freeze(values.filter((date) => date !== value)))}>Remove</button>
        </li>
      ))}</ul> : <p className="mt-3 text-sm text-slate-500">No dates added.</p>}
    </section>
  )
}

export function FamilySchoolPlanPanel({
  controller,
  host,
  student,
}: {
  readonly controller: FinalFamilyPilotController
  readonly host: FinalFamilyAutoPlannerHost
  readonly student: FamilySetupStudent
}) {
  const [draft, setDraft] = useState<SchoolPlanDraft | null>(null)
  const [stored, setStored] = useState(false)
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [dayOffInput, setDayOffInput] = useState('')
  const [extraDayInput, setExtraDayInput] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let live = true
    setBusy(true)
    setDraft(null)
    setStep(0)
    setMessage('')
    setError('')
    void host.loadDocument(student.studentRef).then((loaded) => {
      if (!live) return
      if (loaded.status !== 'ready') {
        setError(loaded.status === 'read-only'
          ? 'This School Plan was saved by a newer version of the app and cannot be changed here.'
          : 'School Plan storage is unavailable on this device.')
        setBusy(false)
        return
      }
      setStored(Boolean(loaded.document.schoolPlan))
      setDraft(draftFor(student, controller, loaded.document.schoolPlan))
      setBusy(false)
    }).catch(() => {
      if (live) {
        setError('School Plan storage is unavailable on this device.')
        setBusy(false)
      }
    })
    return () => { live = false }
  }, [controller, host, student])

  useEffect(() => {
    if (!busy && draft) headingRef.current?.focus()
  }, [busy, step, student.studentRef])

  const timeZones = useMemo(() => timeZoneChoices(draft?.householdTimeZone ?? detectedTimeZone()), [draft?.householdTimeZone])
  const draftStudent = useMemo(() => draft ? studentWithDraft(student, draft) : student, [draft, student])
  const courseOptions = useMemo(() => new Map((draft?.enabledSubjects ?? []).map((subject) => [
    subject,
    controller.coursesFor(draftStudent, subject),
  ])), [controller, draft?.enabledSubjects, draftStudent])

  if (busy && !draft) return <section className="mt-6 rounded-2xl border bg-white p-5" aria-busy="true"><p role="status">Opening School Plan…</p></section>
  if (!draft) return <section className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-5"><p role="alert">{error || 'School Plan is unavailable.'}</p></section>

  const patch = (change: Partial<SchoolPlanDraft>) => setDraft(Object.freeze({ ...draft, ...change }))
  const move = (subject: AcademySubject, direction: -1 | 1) => {
    const items = [...orderedSubjects(draft.subjects)]
    const index = items.findIndex((item) => item.subject === subject)
    const target = index + direction
    if (index < 0 || target < 0 || target >= items.length) return
    ;[items[index], items[target]] = [items[target], items[index]]
    patch({ subjects: orderedSubjects(items) })
  }
  const setWorkingLevel = (subject: AcademySubject, rawGrade: string) => {
    const workingGradeBySubject = { ...draft.workingGradeBySubject }
    if (rawGrade) workingGradeBySubject[subject] = rawGrade as AcademyGrade
    else delete workingGradeBySubject[subject]
    const next = Object.freeze({ ...draft, workingGradeBySubject: Object.freeze(workingGradeBySubject) })
    const courses = controller.coursesFor(studentWithDraft(student, next), subject)
    setDraft(replaceSubject(next, subject, {
      courseRef: courses.length === 1 ? courses[0].courseRef : undefined,
    }))
  }
  const setSubjectEnabled = (subject: AcademySubject, enabled: boolean) => {
    const enabledSubjects = orderedEnabledSubjects(enabled
      ? [...draft.enabledSubjects, subject]
      : draft.enabledSubjects.filter((item) => item !== subject))
    const workingGradeBySubject = { ...draft.workingGradeBySubject }
    if (!enabled) delete workingGradeBySubject[subject]
    const partial = Object.freeze({
      ...draft,
      enabledSubjects,
      workingGradeBySubject: Object.freeze(workingGradeBySubject),
    })
    const subjects = enabled
      ? [...draft.subjects, newSubjectPlan(studentWithDraft(student, partial), controller, subject, draft.subjects.length)]
      : draft.subjects.filter((item) => item.subject !== subject)
    setDraft(Object.freeze({ ...partial, subjects: orderedSubjects(subjects) }))
  }

  const errorForStep = (index: number): string | null => {
    if (index === 0) {
      if (!draft.schoolYearStart || !draft.schoolYearEnd || draft.schoolYearEnd < draft.schoolYearStart) return 'Choose a school year with an end date after the start date.'
      if (!draft.householdTimeZone.trim() || !validTimeZone(draft.householdTimeZone.trim())) return 'Choose a valid time zone.'
    }
    if (index === 1) {
      if (!draft.schoolWeekdays.length) return 'Choose at least one school day.'
      if (draft.nonSchoolDates.some((date) => draft.addedSchoolDates.includes(date))) return 'A date cannot be both a day off and an extra school day.'
    }
    if (index === 2 && !draft.enabledSubjects.length) return `Choose at least one subject for ${student.displayName}.`
    if (index === 3) {
      for (const subject of draft.enabledSubjects) {
        if (!effectiveWorkingGrade(student, draft, subject)) return `Choose a supported ${parentSubjectLabel(subject)} level.`
        if (!(courseOptions.get(subject) ?? []).length) return `${parentSubjectLabel(subject)} does not have lessons at the selected level. Choose another level.`
      }
    }
    if (index === 4) {
      for (const subject of orderedSubjects(draft.subjects)) {
        const courses = courseOptions.get(subject.subject) ?? []
        if (!subject.courseRef || !courses.some((course) => course.courseRef === subject.courseRef)) return `Choose the available course for ${parentSubjectLabel(subject.subject)}.`
        if (!subject.startLocalTime) return `Choose a start time for ${parentSubjectLabel(subject.subject)}.`
      }
    }
    return null
  }
  const goToStep = (next: number) => {
    setMessage('')
    setError('')
    setStep(next)
  }
  const next = () => {
    const issue = errorForStep(step)
    if (issue) {
      setError(issue)
      return
    }
    goToStep(Math.min(STEPS.length - 1, step + 1))
  }
  const save = async () => {
    for (let index = 0; index < STEPS.length - 1; index += 1) {
      const issue = errorForStep(index)
      if (issue) {
        setStep(index)
        setMessage('')
        setError(issue)
        return
      }
    }
    setBusy(true)
    setError('')
    setMessage('')
    const now = new Date().toISOString()
    const previousSetup = controller.appSnapshot.state.setup
    const nextSetup = composeFamilySetup(previousSetup, student, draft, now)
    if (!nextSetup) {
      setBusy(false)
      setError('Subjects and working levels could not be prepared. Review those choices and try again.')
      return
    }
    try {
      controller.saveSetup(nextSetup)
    } catch {
      setBusy(false)
      setError('Subjects and working levels could not be saved on this device.')
      return
    }
    let result
    try {
      result = await host.configure(
        host.scope(student.studentRef),
        toPlannerSchoolPlan(draft, FAMILY_AUTO_PLANNER_SCHEMA_VERSION, now),
      )
    } catch {
      result = { status: 'rejected' as const, reason: 'PERSISTENCE_UNAVAILABLE' as const }
    }
    setBusy(false)
    if (result.status !== 'saved') {
      try { controller.saveSetup(previousSetup) } catch { /* best effort: both stores reported below */ }
      setError(result.reason === 'SCHOOL_PLAN_INVALID'
        ? 'Review the dates, school days, subjects, lesson counts, and start times, then try again.'
        : 'The School Plan could not be saved safely on this device. Your previous plan is still in place.')
      return
    }
    const savedStudent = nextSetup.students.find((item) => item.studentRef === student.studentRef) ?? draftStudent
    setStored(true)
    setDraft(draftFor(savedStudent, controller, result.document.schoolPlan))
    setStep(STEPS.length - 1)
    setMessage(`School Plan saved for ${student.displayName}. Today’s Work will use this plan the next time the dashboard opens.`)
  }

  const summary = schoolPlanSummary(draftStudent, draft)
  const selectedDays = schoolDaysPhrase(draft.schoolWeekdays)

  return (
    <div className="mt-6 min-w-0 space-y-5 overflow-x-hidden" data-testid="family-school-plan">
      <section className="min-w-0 rounded-2xl border bg-white p-4 sm:p-6">
        <p className="font-bold text-cyan-700">{stored ? 'Edit School Plan' : 'Set up School Plan'}</p>
        <h3 className="mt-1 break-words text-2xl font-extrabold">{student.displayName}’s School Plan</h3>
        <p className="mt-2 max-w-3xl text-slate-600">Choose when school happens and what {student.displayName} will work on. You can come back and change this plan later.</p>
        <p className="mt-3 rounded-xl bg-cyan-50 p-3 font-semibold">This plan belongs only to {student.displayName}. Switching children opens that child’s separate plan.</p>
        {!stored ? <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 font-semibold">Finish these steps once before daily lessons can be prepared automatically.</p> : null}
      </section>

      <nav aria-label="School Plan setup steps" className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            aria-current={step === index ? 'step' : undefined}
            className={`min-h-12 min-w-0 rounded-xl border px-2 py-2 text-left text-sm font-bold ${step === index ? 'border-cyan-800 bg-cyan-800 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
            onClick={() => goToStep(index)}
          >
            <span className="block text-xs opacity-80">Step {index + 1}</span>
            <span className="block break-words">{label}</span>
          </button>
        ))}
      </nav>

      <section className="min-w-0 rounded-2xl border bg-white p-4 sm:p-6">
        <h4 ref={headingRef} tabIndex={-1} className="text-xl font-extrabold outline-none">{STEPS[step]}</h4>

        {step === 0 ? <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="min-w-0 font-bold">School year starts
            <input aria-label="School year starts" type="date" className="mt-1 min-h-11 w-full min-w-0 rounded-lg border px-3 py-2" value={draft.schoolYearStart} onChange={(event) => patch({ schoolYearStart: event.target.value })} />
          </label>
          <label className="min-w-0 font-bold">School year ends
            <input aria-label="School year ends" type="date" className="mt-1 min-h-11 w-full min-w-0 rounded-lg border px-3 py-2" value={draft.schoolYearEnd} onChange={(event) => patch({ schoolYearEnd: event.target.value })} />
          </label>
          <label className="min-w-0 font-bold sm:col-span-2">Time zone
            <select aria-label="School Plan timezone" className="mt-1 min-h-11 w-full min-w-0 rounded-lg border px-3 py-2" value={draft.householdTimeZone} onChange={(event) => patch({ householdTimeZone: event.target.value })}>
              {timeZones.map((timeZone) => <option key={timeZone} value={timeZone}>{timeZone.replaceAll('_', ' ')}</option>)}
            </select>
            <span className="mt-1 block text-sm font-normal text-slate-600">Your current time zone is filled in. Keep it visible here so lesson dates and start times are clear.</span>
          </label>
        </div> : null}

        {step === 1 ? <div className="mt-4 min-w-0 space-y-5">
          <fieldset>
            <legend className="font-bold">School days</legend>
            <p className="mt-1 text-sm text-slate-600">Choose the days your family normally does school.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{SCHOOL_WEEKDAYS.map((day) => (
              <label key={day.value} className={`flex min-h-12 min-w-0 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 font-bold ${draft.schoolWeekdays.includes(day.value) ? 'border-cyan-700 bg-cyan-50' : 'border-slate-300'}`}>
                <input aria-label={day.label} type="checkbox" checked={draft.schoolWeekdays.includes(day.value)} onChange={(event) => patch({ schoolWeekdays: event.target.checked ? Object.freeze([...draft.schoolWeekdays, day.value]) : Object.freeze(draft.schoolWeekdays.filter((item) => item !== day.value)) })} />
                <span className="break-words sm:hidden lg:inline">{day.label}</span><span className="hidden sm:inline lg:hidden">{day.shortLabel}</span>
              </label>
            ))}</div>
          </fieldset>
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <DateList title="Days off" description="Add holidays, trips, and other dates when school will not happen." values={draft.nonSchoolDates} input={dayOffInput} setInput={setDayOffInput} onChange={(nonSchoolDates) => patch({ nonSchoolDates })} />
            <DateList title="Extra school days" description="Add a date when school will happen even though it is not a normal school day." values={draft.addedSchoolDates} input={extraDayInput} setInput={setExtraDayInput} onChange={(addedSchoolDates) => patch({ addedSchoolDates })} />
          </div>
        </div> : null}

        {step === 2 ? <fieldset className="mt-4 min-w-0">
          <legend className="font-bold">Which subjects will {student.displayName} study?</legend>
          <p className="mt-1 text-sm text-slate-600">Current subject choices are filled in. Turning a subject off does not erase completed work.</p>
          <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2">{ACADEMY_SUBJECTS.map((subject) => {
            const checked = draft.enabledSubjects.includes(subject)
            return <label key={subject} className={`flex min-h-14 min-w-0 cursor-pointer items-center gap-3 rounded-xl border p-3 font-bold ${checked ? 'border-cyan-700 bg-cyan-50' : 'border-slate-300'}`}>
              <input aria-label={`Include ${parentSubjectLabel(subject)}`} type="checkbox" checked={checked} onChange={(event) => setSubjectEnabled(subject, event.target.checked)} />
              <span className="min-w-0 break-words">{parentSubjectLabel(subject)}</span>
            </label>
          })}</div>
        </fieldset> : null}

        {step === 3 ? <div className="mt-4 min-w-0 space-y-3">
          <p className="text-sm text-slate-600">Each subject starts at {student.displayName}’s current grade unless your family already chose a different level. Changing a level here does not change the grade shown on reports.</p>
          {draft.enabledSubjects.map((subject) => {
            const grade = effectiveWorkingGrade(student, draft, subject)
            const courses = courseOptions.get(subject) ?? []
            const selected = orderedSubjects(draft.subjects).find((item) => item.subject === subject)
            return <section key={subject} className="min-w-0 rounded-xl border p-4">
              <label className="block min-w-0 font-extrabold">{parentSubjectLabel(subject)} level
                <select aria-label={`${parentSubjectLabel(subject)} level`} className="mt-2 min-h-11 w-full min-w-0 rounded-lg border px-3 py-2" value={draft.workingGradeBySubject[subject] ?? ''} onChange={(event) => setWorkingLevel(subject, event.target.value)}>
                  <option value="">{ACADEMY_GRADES.includes(student.nominalGrade as AcademyGrade) ? `Grade ${student.nominalGrade} (current grade)` : 'Choose a level'}</option>
                  {ACADEMY_GRADES.map((value) => <option key={value} value={value}>Grade {value}</option>)}
                </select>
              </label>
              {grade && courses.length === 1 ? <p className="mt-2 text-sm font-semibold text-emerald-800">Ready: Grade {grade} lessons are available.</p> : null}
              {!grade || courses.length === 0 ? <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 font-semibold">Choose a level with available lessons before saving.</p> : null}
              {courses.length > 1 ? <label className="mt-3 block font-bold">Course
                <select aria-label={`${parentSubjectLabel(subject)} course`} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border px-3 py-2" value={selected?.courseRef ?? ''} onChange={(event) => setDraft(replaceSubject(draft, subject, { courseRef: event.target.value || undefined }))}>
                  <option value="">Choose a course</option>
                  {courses.map((course) => <option key={course.courseRef} value={course.courseRef}>{course.title}</option>)}
                </select>
              </label> : null}
            </section>
          })}
        </div> : null}

        {step === 4 ? <div className="mt-4 min-w-0 space-y-4">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
            <p className="font-extrabold">Every active subject follows the school days above.</p>
            <p className="mt-1 text-sm text-slate-700">This School Plan can schedule Math, Science, and other active subjects on every school day. Different days for each subject are not available in this version.</p>
          </div>
          <ol className="min-w-0 space-y-4">{orderedSubjects(draft.subjects).map((subject, index) => (
            <li key={subject.subject} className="min-w-0 rounded-xl border p-4">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0"><p className="break-words font-extrabold">{index + 1}. {parentSubjectLabel(subject.subject)}</p><p className="text-sm text-slate-600">{subject.paused ? 'Paused' : `Every school day (${selectedDays})`}</p></div>
                <div className="grid shrink-0 grid-cols-2 gap-2">
                  <button type="button" aria-label={`Move ${parentSubjectLabel(subject.subject)} earlier`} className="min-h-11 rounded-lg border px-3 py-2 font-bold disabled:opacity-40" disabled={index === 0} onClick={() => move(subject.subject, -1)}>Earlier</button>
                  <button type="button" aria-label={`Move ${parentSubjectLabel(subject.subject)} later`} className="min-h-11 rounded-lg border px-3 py-2 font-bold disabled:opacity-40" disabled={index === draft.subjects.length - 1} onClick={() => move(subject.subject, 1)}>Later</button>
                </div>
              </div>
              <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                <label className="min-w-0 font-bold">Lessons per day
                  <select aria-label={`${parentSubjectLabel(subject.subject)} lessons per day`} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border px-3 py-2" value={subject.lessonsPerDay} onChange={(event) => setDraft(replaceSubject(draft, subject.subject, { lessonsPerDay: Number(event.target.value) }))}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} {value === 1 ? 'lesson' : 'lessons'}</option>)}</select>
                </label>
                <label className="min-w-0 font-bold">Start time
                  <input aria-label={`${parentSubjectLabel(subject.subject)} start time`} type="time" className="mt-1 min-h-11 w-full min-w-0 rounded-lg border px-3 py-2" value={subject.startLocalTime} onChange={(event) => setDraft(replaceSubject(draft, subject.subject, { startLocalTime: event.target.value }))} />
                </label>
              </div>
              <label className="mt-3 flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3 font-bold"><input aria-label={`Pause ${parentSubjectLabel(subject.subject)}`} type="checkbox" checked={subject.paused} onChange={(event) => setDraft(replaceSubject(draft, subject.subject, { paused: event.target.checked }))} />Pause this subject</label>
              <p className="mt-2 text-sm text-slate-600">Pausing keeps unfinished work available and stops new lessons for this subject.</p>
            </li>
          ))}</ol>
        </div> : null}

        {step === 5 ? <div className="mt-4 min-w-0 space-y-4">
          <div className="rounded-xl bg-cyan-50 p-4">
            <h5 className="font-extrabold">Here’s {student.displayName}’s plan</h5>
            <p className="mt-2 text-lg font-semibold">{summary.introduction}</p>
          </div>
          <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-4"><dt className="font-extrabold">School year</dt><dd className="mt-1 break-words">{dateLabel(draft.schoolYearStart)} through {dateLabel(draft.schoolYearEnd)}</dd></div>
            <div className="rounded-xl border p-4"><dt className="font-extrabold">School days</dt><dd className="mt-1 break-words">{selectedDays}</dd></div>
            <div className="rounded-xl border p-4"><dt className="font-extrabold">Days off</dt><dd className="mt-1 break-words">{draft.nonSchoolDates.length ? draft.nonSchoolDates.map(dateLabel).join(', ') : 'None added'}</dd></div>
            <div className="rounded-xl border p-4"><dt className="font-extrabold">Extra school days</dt><dd className="mt-1 break-words">{draft.addedSchoolDates.length ? draft.addedSchoolDates.map(dateLabel).join(', ') : 'None added'}</dd></div>
            <div className="rounded-xl border p-4"><dt className="font-extrabold">Time zone</dt><dd className="mt-1 break-words">{draft.householdTimeZone.replaceAll('_', ' ')}</dd></div>
          </dl>
          <section className="min-w-0 rounded-xl border p-4">
            <h5 className="font-extrabold">Subjects and daily lessons</h5>
            <ul className="mt-2 space-y-2">{summary.subjects.map((line) => <li key={line} className="break-words">{line}</li>)}</ul>
          </section>
          <section className="min-w-0 rounded-xl border p-4">
            <h5 className="font-extrabold">Levels</h5>
            <ul className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">{draft.enabledSubjects.map((subject) => <li key={subject} className="break-words">{parentSubjectLabel(subject)}: Grade {effectiveWorkingGrade(student, draft, subject) ?? 'not selected'}</li>)}</ul>
          </section>
          <p className="text-sm text-slate-600">Saving changes future automatic lessons. Work already created follows the existing School Plan rules and is not erased.</p>
        </div> : null}

        {error ? <p className="mt-5 rounded-lg border border-red-300 bg-red-50 p-3 font-semibold" role="alert">{error}</p> : null}
        {message ? <p className="mt-5 rounded-lg border border-emerald-300 bg-emerald-50 p-3 font-semibold" role="status">{message}</p> : null}

        <div className="mt-6 flex min-w-0 flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {step > 0 ? <button type="button" className="min-h-12 w-full rounded-lg border border-slate-300 px-5 py-3 font-extrabold sm:w-auto" onClick={() => goToStep(step - 1)}>Back</button> : <span />}
          {step < STEPS.length - 1
            ? <button type="button" className="min-h-12 w-full rounded-lg bg-cyan-800 px-5 py-3 font-extrabold text-white sm:w-auto" onClick={next}>Continue</button>
            : <button type="button" className="min-h-12 w-full rounded-lg bg-emerald-700 px-5 py-3 font-extrabold text-white disabled:opacity-50 sm:w-auto" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : stored ? 'Save changes' : 'Save School Plan'}</button>}
        </div>
      </section>
    </div>
  )
}
