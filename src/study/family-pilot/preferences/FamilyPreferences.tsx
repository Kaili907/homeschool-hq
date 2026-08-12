import { useEffect, useState } from 'react'
import { ACADEMY_SUBJECTS, type AcademyGrade, type AcademySubject } from '../../../types'
import type { FamilySetupStudent, FamilySetupStudentRef } from '../setup'

/** Only these grades have published curriculum content — see AcademyGrade. */
const SUPPORTED_WORKING_GRADES: readonly AcademyGrade[] = ['5', '7', '8']

const SUBJECT_LABELS: Record<AcademySubject, string> = {
  mathematics: 'Mathematics',
  'english-language-arts': 'English Language Arts',
  science: 'Science',
  'social-studies': 'Social Studies',
  health: 'Health',
  'physical-education': 'Physical Education',
  'ready-for-life': 'Ready for Life',
  technology: 'Technology',
  'arts-and-music': 'Arts & Music',
  'financial-literacy': 'Financial Literacy',
}

export interface FamilyPreferencesProps {
  readonly student: FamilySetupStudent
  readonly onUpdateDisplayName: (studentRef: FamilySetupStudentRef, displayName: string) => void
  readonly onSetWorkingGrade: (
    studentRef: FamilySetupStudentRef,
    subject: AcademySubject,
    grade: AcademyGrade | null,
  ) => void
  readonly onSetSubjectEnabled: (
    studentRef: FamilySetupStudentRef,
    subject: AcademySubject,
    enabled: boolean,
  ) => void
  readonly onSetPinRequired: (studentRef: FamilySetupStudentRef, pinRequired: boolean) => void
  readonly onClose: () => void
}

/**
 * Preferences screen shown after first-run setup. A pure view over one
 * student: every edit is emitted as a host callback, never applied locally.
 * The host owns persistence and decides how the assignment planner reacts —
 * this component only requests the change.
 */
export function FamilyPreferences({
  student,
  onUpdateDisplayName,
  onSetWorkingGrade,
  onSetSubjectEnabled,
  onSetPinRequired,
  onClose,
}: FamilyPreferencesProps) {
  const [nameDraft, setNameDraft] = useState(student.displayName)
  const [nameError, setNameError] = useState('')
  const [gradeError, setGradeError] = useState<AcademySubject | null>(null)

  // Re-sync whenever the host hands back a (possibly updated) student, so a
  // confirmed edit doesn't leave stale text or a stale refusal banner behind
  // — including when a host reuses one mounted instance across students.
  useEffect(() => {
    setNameDraft(student.displayName)
    setNameError('')
    setGradeError(null)
  }, [student.studentRef, student.displayName])

  function commitDisplayName() {
    const trimmed = nameDraft.trim()
    if (trimmed.length === 0) {
      setNameError("Display name can't be blank.")
      return
    }
    setNameError('')
    if (trimmed !== student.displayName) {
      onUpdateDisplayName(student.studentRef, trimmed)
    }
  }

  // gradeError names at most one subject at a time; clearing it only when
  // that same subject resolves keeps an unrelated subject's still-pending
  // refusal banner from disappearing out from under it.
  function handleWorkingGradeChange(subject: AcademySubject, rawValue: string) {
    if (rawValue === '') {
      setGradeError((prev) => (prev === subject ? null : prev))
      onSetWorkingGrade(student.studentRef, subject, null)
      return
    }
    if (!(SUPPORTED_WORKING_GRADES as readonly string[]).includes(rawValue)) {
      setGradeError(subject)
      return
    }
    setGradeError((prev) => (prev === subject ? null : prev))
    onSetWorkingGrade(student.studentRef, subject, rawValue as AcademyGrade)
  }

  return (
    <div
      className="mx-auto w-full max-w-2xl px-4 py-8 text-slate-900"
      style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
    >
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Preferences — {student.displayName}</h1>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Close
        </button>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <label className="block text-sm font-semibold text-slate-700" htmlFor="family-pref-display-name">
          Display name
        </label>
        <input
          id="family-pref-display-name"
          type="text"
          value={nameDraft}
          onChange={(event) => {
            setNameDraft(event.target.value)
            if (nameError) setNameError('')
          }}
          onBlur={commitDisplayName}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        {nameError && <p className="mt-1 text-sm font-semibold text-rose-600">{nameError}</p>}
        <p className="mt-2 text-sm text-slate-500">
          Nominal grade: <span className="font-semibold text-slate-700">Grade {student.nominalGrade}</span> — stays
          fixed here. It's what she officially is for reporting, separate from any working-grade override below.
        </p>
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            aria-label="PIN required"
            checked={student.pinRequired}
            onChange={(event) => onSetPinRequired(student.studentRef, event.target.checked)}
          />
          Require PIN to switch to this student
        </label>
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Subjects</h2>
        <p className="mt-1 text-sm text-slate-500">
          Turning a subject off hides it from her day. It doesn't touch anything she's already completed.
        </p>
        <ul className="mt-3 divide-y divide-slate-100">
          {ACADEMY_SUBJECTS.map((subject) => {
            const label = SUBJECT_LABELS[subject]
            const enabled = student.enabledSubjects.includes(subject)
            const override = student.workingGradeBySubject[subject] ?? ''
            return (
              <li key={subject} className="flex items-center justify-between gap-3 py-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    aria-label={`Enable ${label}`}
                    checked={enabled}
                    onChange={(event) => onSetSubjectEnabled(student.studentRef, subject, event.target.checked)}
                  />
                  {label}
                </label>
                <div className="flex flex-col items-end">
                  <select
                    aria-label={`Working grade for ${label}`}
                    value={override}
                    disabled={!enabled}
                    onChange={(event) => {
                      if (!enabled) return
                      handleWorkingGradeChange(subject, event.target.value)
                    }}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">Use nominal (Grade {student.nominalGrade})</option>
                    {SUPPORTED_WORKING_GRADES.map((grade) => (
                      <option key={grade} value={grade}>
                        Grade {grade}
                      </option>
                    ))}
                  </select>
                  {gradeError === subject && (
                    <p className="mt-1 text-xs font-semibold text-rose-600">Unsupported grade — not changed.</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
