import { useMemo, useState } from 'react'
import type { FinalCatalogCourse } from '../../../curriculum/final-runtime'
import {
  ACADEMY_GRADES,
  ACADEMY_SUBJECTS,
  type AcademyGrade,
  type AcademySubject,
  type Grade,
} from '../../../types'
import {
  MAX_STUDENTS,
  completeSetup,
  createStudent,
  setPinRequirement,
  setWorkingGrade,
  updateStudent,
  validateFamilySetup,
  type FamilySetupMutationResult,
  type FamilySetupState,
  type FamilySetupStudent,
} from '../setup'
import type { FinalFamilyPilotController } from './controller'

const NOMINAL_GRADES: readonly Grade[] = ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

const SUBJECT_LABELS: Readonly<Record<AcademySubject, string>> = Object.freeze({
  mathematics: 'Mathematics',
  'english-language-arts': 'English Language Arts',
  science: 'Science',
  'social-studies': 'Social Studies',
  health: 'Health',
  'physical-education': 'Physical Education',
  'ready-for-life': 'Ready for Life',
  technology: 'Technology & Computer Science',
  'arts-and-music': 'Arts & Music',
  'financial-literacy': 'Financial Literacy',
})

export interface FamilyLearnerDraft {
  readonly studentRef: string | null
  readonly displayName: string
  readonly nominalGrade: Grade
  readonly enabledSubjects: readonly AcademySubject[]
  readonly workingGradeBySubject: Partial<Record<AcademySubject, AcademyGrade>>
  readonly pinRequired: boolean
}

function emptyDraft(): FamilyLearnerDraft {
  return {
    studentRef: null,
    displayName: '',
    nominalGrade: '5',
    enabledSubjects: [],
    workingGradeBySubject: {},
    pinRequired: false,
  }
}

function draftOf(student: FamilySetupStudent): FamilyLearnerDraft {
  return {
    studentRef: student.studentRef,
    displayName: student.displayName,
    nominalGrade: student.nominalGrade,
    enabledSubjects: student.enabledSubjects,
    workingGradeBySubject: student.workingGradeBySubject,
    pinRequired: student.pinRequired,
  }
}

function blocked(
  reason: Extract<FamilySetupMutationResult, { status: 'blocked' }>['reason'],
  studentRef?: string,
): FamilySetupMutationResult {
  return { status: 'blocked', reason, ...(studentRef ? { studentRef } : {}) }
}

/** Applies one learner editor atomically to the existing setup contracts. */
export function applyFamilyLearnerDraft(
  state: FamilySetupState,
  draft: FamilyLearnerDraft,
  now: string,
  idSource?: () => string,
): FamilySetupMutationResult {
  if (
    draft.nominalGrade === '6' &&
    draft.enabledSubjects.some((subject) => draft.workingGradeBySubject[subject] === undefined)
  ) {
    return blocked('invalid-working-grade', draft.studentRef ?? undefined)
  }

  let result = draft.studentRef
    ? updateStudent(
        state,
        draft.studentRef,
        {
          displayName: draft.displayName,
          nominalGrade: draft.nominalGrade,
          enabledSubjects: draft.enabledSubjects,
        },
        now,
      )
    : createStudent(
        state,
        {
          displayName: draft.displayName,
          nominalGrade: draft.nominalGrade,
          enabledSubjects: draft.enabledSubjects,
        },
        now,
        idSource,
      )
  if (result.status !== 'ok') return result

  const studentRef = draft.studentRef ?? result.state.students.at(-1)?.studentRef
  if (!studentRef) return blocked('student-not-found')

  for (const subject of draft.enabledSubjects) {
    const desired = draft.workingGradeBySubject[subject]
    const current = result.state.students.find((student) => student.studentRef === studentRef)
      ?.workingGradeBySubject[subject]
    if (desired === current) continue
    result = setWorkingGrade(result.state, studentRef, subject, desired ?? null, now)
    if (result.status !== 'ok') return result
  }

  result = setPinRequirement(result.state, studentRef, draft.pinRequired, now)
  if (result.status !== 'ok') return result

  const validation = validateFamilySetup(result.state)
  if (!validation.valid) {
    return {
      status: 'blocked',
      reason: 'invalid-configuration',
      studentRef,
      issues: validation.issues,
    }
  }
  return result
}

function errorMessage(reason: string): string {
  if (reason === 'invalid-display-name') return 'Enter a learner display name.'
  if (reason === 'no-enabled-subjects') return 'Choose at least one course for this learner.'
  if (reason === 'invalid-working-grade') return 'Choose a published working grade for every selected Grade 6 subject.'
  if (reason === 'max-students-reached') return `This local family setup supports up to ${MAX_STUDENTS} learners.`
  return 'Review this learner setup and try again.'
}

function resolvedGrade(draft: FamilyLearnerDraft, subject: AcademySubject): AcademyGrade | null {
  const explicit = draft.workingGradeBySubject[subject]
  if (explicit) return explicit
  return ACADEMY_GRADES.includes(draft.nominalGrade as AcademyGrade)
    ? draft.nominalGrade as AcademyGrade
    : null
}

export function FamilyOnboarding({
  controller,
  mode,
  onContinue,
}: {
  readonly controller: FinalFamilyPilotController
  readonly mode: 'first-run' | 'manage'
  readonly onContinue: () => void
}) {
  const [setup, setSetup] = useState<FamilySetupState>(controller.appSnapshot.state.setup)
  const [draft, setDraft] = useState<FamilyLearnerDraft>(() =>
    setup.students[0] ? draftOf(setup.students[0]) : emptyDraft(),
  )
  const [learnerPin, setLearnerPin] = useState('')
  const [confirmLearnerPin, setConfirmLearnerPin] = useState('')
  const [parentPin, setParentPin] = useState('')
  const [confirmParentPin, setConfirmParentPin] = useState('')
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')

  const selectedStudent = draft.studentRef
    ? setup.students.find((student) => student.studentRef === draft.studentRef)
    : undefined
  const existingLearnerVerifier = draft.studentRef
    ? controller.appSnapshot.state.studentAccessVerifiers[draft.studentRef]
    : undefined
  const courses = useMemo(
    () => controller.catalog.runtime.listCourses(),
    [controller],
  )

  function courseFor(subject: AcademySubject): FinalCatalogCourse | undefined {
    const grade = resolvedGrade(draft, subject)
    if (!grade) return undefined
    return courses.find(
      (course) => course.grade === Number(grade) && course.subject === subject,
    )
  }

  function chooseStudent(student: FamilySetupStudent) {
    setDraft(draftOf(student))
    setLearnerPin('')
    setConfirmLearnerPin('')
    setError('')
    setSavedMessage('')
  }

  function startNewLearner() {
    setDraft(emptyDraft())
    setLearnerPin('')
    setConfirmLearnerPin('')
    setError('')
    setSavedMessage('')
  }

  async function saveLearner() {
    if (draft.pinRequired) {
      const mayKeepExisting = Boolean(selectedStudent && existingLearnerVerifier && learnerPin === '')
      if (!mayKeepExisting && (!/^\d{4}$/.test(learnerPin) || learnerPin !== confirmLearnerPin)) {
        setError('Set and confirm a matching 4-digit learner PIN, or turn learner PIN off.')
        return
      }
    }

    const now = new Date().toISOString()
    const result = applyFamilyLearnerDraft(setup, draft, now)
    if (result.status !== 'ok') {
      setError(errorMessage(result.reason))
      return
    }
    const saved = draft.studentRef
      ? result.state.students.find((student) => student.studentRef === draft.studentRef)
      : result.state.students.at(-1)
    if (!saved) {
      setError('The learner profile could not be saved.')
      return
    }

    try {
      controller.saveSetup(result.state)
      if (!draft.pinRequired) await controller.setStudentPin(saved.studentRef, null)
      else if (learnerPin) await controller.setStudentPin(saved.studentRef, learnerPin)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The learner profile could not be saved.')
      return
    }

    setSetup(result.state)
    setDraft(draftOf(saved))
    setLearnerPin('')
    setConfirmLearnerPin('')
    setError('')
    setSavedMessage(`${saved.displayName} is saved. Add another learner or continue when the family is ready.`)
  }

  async function finishFamily() {
    if (!/^\d{4}$/.test(parentPin) || parentPin !== confirmParentPin) {
      setError('Set and confirm a matching 4-digit Parent PIN.')
      return
    }
    const result = completeSetup(setup, new Date().toISOString())
    if (result.status !== 'ok') {
      setError(errorMessage(result.reason))
      return
    }
    try {
      await controller.setParentPin(parentPin)
      controller.saveSetup(result.state)
      setSetup(result.state)
      setParentPin('')
      setConfirmParentPin('')
      setError('')
      onContinue()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Family setup could not be completed.')
    }
  }

  const selectedCount = draft.enabledSubjects.length

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8" aria-labelledby="family-onboarding-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-sm font-extrabold uppercase tracking-widest text-cyan-700">
            {mode === 'first-run' ? 'First-run family setup' : 'Family setup'}
          </p>
          <h2 id="family-onboarding-heading" className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {mode === 'first-run' ? 'Set up everyone who learns here' : 'Manage learners'}
          </h2>
          <p className="mt-2 text-slate-600">
            Add one learner at a time. Nominal grade stays separate from the working grade used by each course.
            Only a display name, grade, course choices, and local access settings are collected.
          </p>
        </div>
        {mode === 'manage' ? (
          <button type="button" className="min-h-11 rounded-lg border bg-white px-4 py-2 font-bold" onClick={onContinue}>
            Back to School Plan
          </button>
        ) : null}
      </div>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Family learners">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-extrabold">Your learners</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
              {setup.students.length}
            </span>
          </div>
          {setup.students.length === 0 ? (
            <p className="mt-3 rounded-xl bg-cyan-50 p-3 text-sm font-semibold text-cyan-950">
              Start with the first learner in your family.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {setup.students.map((student) => (
                <li key={student.studentRef}>
                  <button
                    type="button"
                    aria-pressed={draft.studentRef === student.studentRef}
                    onClick={() => chooseStudent(student)}
                    className={`min-h-14 w-full rounded-xl border px-3 py-2 text-left ${
                      draft.studentRef === student.studentRef
                        ? 'border-cyan-700 bg-cyan-50 ring-2 ring-cyan-100'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block font-extrabold text-slate-900">{student.displayName}</span>
                    <span className="block text-sm text-slate-600">
                      Grade {student.nominalGrade} · {student.enabledSubjects.length} {student.enabledSubjects.length === 1 ? 'course' : 'courses'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            disabled={setup.students.length >= MAX_STUDENTS}
            onClick={startNewLearner}
            className="mt-3 min-h-11 w-full rounded-xl border-2 border-dashed border-cyan-600 px-3 py-2 font-extrabold text-cyan-800 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add another learner
          </button>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Each learner has an independent profile. Editing one never changes a sibling.
          </p>
        </aside>

        <form
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
          onSubmit={(event) => { event.preventDefault(); void saveLearner() }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-cyan-700">Learner profile</p>
              <h3 className="text-2xl font-extrabold">{selectedStudent ? `Edit ${selectedStudent.displayName}` : 'Add a learner'}</h3>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">
              {selectedCount} selected
            </span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="font-bold text-slate-800" htmlFor="family-learner-name">
              Display name
              <input
                id="family-learner-name"
                autoComplete="off"
                maxLength={160}
                value={draft.displayName}
                onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
              />
            </label>
            <label className="font-bold text-slate-800" htmlFor="family-nominal-grade">
              Nominal grade
              <select
                id="family-nominal-grade"
                value={draft.nominalGrade}
                onChange={(event) => setDraft({ ...draft, nominalGrade: event.target.value as Grade })}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
              >
                {NOMINAL_GRADES.map((grade) => (
                  <option key={grade} value={grade}>
                    Grade {grade}{grade === '6' ? ' — nominal only' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {draft.nominalGrade === '6' ? (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="status">
              <strong>Grade 6 is a valid nominal grade, but there is no Grade 6 course catalog.</strong>{' '}
              Choose a published working grade for every selected course. Nothing will be substituted automatically.
            </div>
          ) : null}

          <fieldset className="mt-6">
            <legend className="text-lg font-extrabold">Choose courses and working grades</legend>
            <p className="mt-1 text-sm text-slate-600">
              These are the courses in the admitted Manuel Academy catalog. School Plan decides when they appear.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {ACADEMY_SUBJECTS.map((subject) => {
                const enabled = draft.enabledSubjects.includes(subject)
                const workingGrade = draft.workingGradeBySubject[subject] ?? ''
                const course = courseFor(subject)
                return (
                  <div
                    key={subject}
                    className={`rounded-xl border p-3 ${enabled ? 'border-cyan-600 bg-cyan-50/50' : 'border-slate-200'}`}
                  >
                    <label className="flex min-h-11 cursor-pointer items-start gap-3 font-extrabold text-slate-900">
                      <input
                        type="checkbox"
                        className="mt-1 h-5 w-5 shrink-0"
                        checked={enabled}
                        onChange={(event) => {
                          const enabledSubjects = event.target.checked
                            ? [...draft.enabledSubjects, subject]
                            : draft.enabledSubjects.filter((item) => item !== subject)
                          const workingGradeBySubject = { ...draft.workingGradeBySubject }
                          if (!event.target.checked) delete workingGradeBySubject[subject]
                          setDraft({ ...draft, enabledSubjects, workingGradeBySubject })
                        }}
                      />
                      <span>{SUBJECT_LABELS[subject]}</span>
                    </label>
                    <label className="mt-2 block text-sm font-bold text-slate-700">
                      Working grade
                      <select
                        aria-label={`Working grade for ${SUBJECT_LABELS[subject]}`}
                        disabled={!enabled}
                        value={workingGrade}
                        onChange={(event) => {
                          const workingGradeBySubject = { ...draft.workingGradeBySubject }
                          if (event.target.value === '') delete workingGradeBySubject[subject]
                          else workingGradeBySubject[subject] = event.target.value as AcademyGrade
                          setDraft({ ...draft, workingGradeBySubject })
                        }}
                        className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 font-normal disabled:bg-slate-100"
                      >
                        <option value="">
                          {draft.nominalGrade === '6'
                            ? 'Choose a published grade'
                            : `Use nominal Grade ${draft.nominalGrade}`}
                        </option>
                        {ACADEMY_GRADES.map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}
                      </select>
                    </label>
                    {enabled ? (
                      course ? (
                        <p className="mt-2 text-sm leading-5 text-slate-700">
                          <strong>{course.title}</strong><br />
                          Grade {course.grade} · {course.lessonCount} lessons · {course.days} instructional days
                        </p>
                      ) : (
                        <p className="mt-2 text-sm font-bold text-amber-800">Choose a supported working grade to select a course.</p>
                      )
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">Not selected for this learner.</p>
                    )}
                  </div>
                )
              })}
            </div>
          </fieldset>

          <fieldset className="mt-6 rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-lg font-extrabold">Learner access</legend>
            <p className="text-sm text-slate-600">Choose how this learner opens their profile on this device.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className={`min-h-14 rounded-lg border p-3 font-bold ${!draft.pinRequired ? 'border-cyan-600 bg-cyan-50' : 'border-slate-200'}`}>
                <input type="radio" name="learner-access" checked={!draft.pinRequired} onChange={() => setDraft({ ...draft, pinRequired: false })} />
                <span className="ml-2">Open from learner picker</span>
              </label>
              <label className={`min-h-14 rounded-lg border p-3 font-bold ${draft.pinRequired ? 'border-cyan-600 bg-cyan-50' : 'border-slate-200'}`}>
                <input type="radio" name="learner-access" checked={draft.pinRequired} onChange={() => setDraft({ ...draft, pinRequired: true })} />
                <span className="ml-2">Require a 4-digit PIN</span>
              </label>
            </div>
            {draft.pinRequired ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-bold">
                  {existingLearnerVerifier ? 'New PIN (leave blank to keep current)' : 'Learner PIN'}
                  <input
                    aria-label="Learner PIN"
                    inputMode="numeric"
                    type="password"
                    maxLength={4}
                    value={learnerPin}
                    onChange={(event) => setLearnerPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="mt-1 min-h-11 w-full rounded-lg border px-3 py-2"
                  />
                </label>
                <label className="text-sm font-bold">
                  Confirm learner PIN
                  <input
                    aria-label="Confirm learner PIN"
                    inputMode="numeric"
                    type="password"
                    maxLength={4}
                    value={confirmLearnerPin}
                    onChange={(event) => setConfirmLearnerPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="mt-1 min-h-11 w-full rounded-lg border px-3 py-2"
                  />
                </label>
              </div>
            ) : null}
          </fieldset>

          {error ? <p className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 font-semibold text-red-950" role="alert">{error}</p> : null}
          {savedMessage ? <p className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 font-semibold text-emerald-950" role="status">{savedMessage}</p> : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="submit" className="min-h-11 rounded-lg bg-cyan-800 px-5 py-2 font-extrabold text-white hover:bg-cyan-900">
              {selectedStudent ? 'Save learner changes' : 'Save learner'}
            </button>
            {draft.studentRef || setup.students.length > 0 ? (
              <button type="button" className="min-h-11 rounded-lg border px-4 py-2 font-bold" onClick={startNewLearner}>Add another learner</button>
            ) : null}
          </div>
        </form>
      </div>

      {mode === 'first-run' ? (
        <section className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_22rem] lg:items-end">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-wider text-emerald-800">Final step</p>
              <h3 className="mt-1 text-2xl font-extrabold text-emerald-950">Protect Parent controls</h3>
              <p className="mt-2 text-sm leading-6 text-emerald-950">
                The Parent PIN protects family setup, School Plan, assignments, reports, and backups. Only a one-way local verifier is stored.
              </p>
              <p className="mt-2 text-sm font-bold text-emerald-950">
                Next: School Plan controls <em>when</em> the courses you selected appear. Course setup does not create a daily schedule.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <label className="text-sm font-bold text-emerald-950">
                Parent PIN
                <input aria-label="Parent PIN" inputMode="numeric" type="password" maxLength={4} value={parentPin} onChange={(event) => setParentPin(event.target.value.replace(/\D/g, '').slice(0, 4))} className="mt-1 min-h-11 w-full rounded-lg border border-emerald-400 bg-white px-3 py-2" />
              </label>
              <label className="text-sm font-bold text-emerald-950">
                Confirm Parent PIN
                <input aria-label="Confirm Parent PIN" inputMode="numeric" type="password" maxLength={4} value={confirmParentPin} onChange={(event) => setConfirmParentPin(event.target.value.replace(/\D/g, '').slice(0, 4))} className="mt-1 min-h-11 w-full rounded-lg border border-emerald-400 bg-white px-3 py-2" />
              </label>
              <button type="button" disabled={setup.students.length === 0} onClick={finishFamily} className="min-h-12 rounded-lg bg-emerald-800 px-5 py-3 font-extrabold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 lg:col-span-1">
                Continue to School Plan
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </section>
  )
}
