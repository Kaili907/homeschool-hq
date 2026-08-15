import type { StudySubject } from '../../types'
import { buildAssignViewModel } from './buildViewModel'
import type {
  FamilyPilotAssignLesson,
  FamilyPilotAssignment,
  FamilyPilotAssignStudent,
  FamilyPilotParentAssignCallbacks,
  FamilyPilotWorkingGradeEntry,
} from './types'

const STATUS_LABEL: Record<string, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  paused: 'Paused',
  completed: 'Completed',
  skipped: 'Skipped',
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  'not-started': 'bg-slate-100 text-slate-700',
  'in-progress': 'bg-cyan-100 text-cyan-900',
  paused: 'bg-amber-100 text-amber-900',
  completed: 'bg-emerald-100 text-emerald-900',
  skipped: 'bg-slate-200 text-slate-600',
}

function GradeGrid({
  studentRef,
  nominalGrade,
  workingGrades,
  onChangeWorkingGrade,
}: {
  readonly studentRef: string
  readonly nominalGrade: number
  readonly workingGrades: readonly FamilyPilotWorkingGradeEntry[]
  readonly onChangeWorkingGrade?: (studentRef: string, subject: StudySubject, grade: number) => void | Promise<void>
}) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl bg-slate-100 p-4">
        <p className="text-sm font-semibold text-slate-600">Nominal grade</p>
        <p className="text-2xl font-bold text-slate-900">{nominalGrade}</p>
      </div>
      {workingGrades.map((entry) => {
        const inputId = `family-pilot-assign-grade-${studentRef}-${entry.subject}`
        return (
          <div key={entry.subject} className="rounded-xl bg-slate-100 p-4">
            {onChangeWorkingGrade ? (
              <>
                <label htmlFor={inputId} className="text-sm font-semibold text-slate-600">
                  Working grade — {entry.subject}
                </label>
                <select
                  id={inputId}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-lg font-bold text-slate-900"
                  value={entry.grade}
                  onChange={(event) => onChangeWorkingGrade(studentRef, entry.subject, Number(event.target.value))}
                >
                  {Array.from({ length: 13 }, (_, grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-600">Working grade — {entry.subject}</p>
                <p className="text-2xl font-bold text-slate-900">{entry.grade}</p>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function FamilyPilotParentAssignPanel({
  student,
  availableLessons,
  currentAssignments,
  workingGrade,
  enabledSubjects,
  onAssignLesson,
  onResumeAssignment,
  onSkipAssignment,
  onChangeWorkingGrade,
}: {
  readonly student: FamilyPilotAssignStudent
  readonly availableLessons: readonly FamilyPilotAssignLesson[]
  readonly currentAssignments: readonly FamilyPilotAssignment[]
  readonly workingGrade: readonly FamilyPilotWorkingGradeEntry[]
  readonly enabledSubjects: readonly StudySubject[]
} & FamilyPilotParentAssignCallbacks) {
  const model = buildAssignViewModel({
    student,
    availableLessons,
    currentAssignments,
    workingGrade,
    enabledSubjects,
    supportsSkip: Boolean(onSkipAssignment),
  })
  const currentHeadingId = `family-pilot-assign-current-${model.studentRef}`
  const assignHeadingId = `family-pilot-assign-available-${model.studentRef}`

  return (
    <div className="family-pilot-parent-assign-panel space-y-5" data-student-ref={model.studentRef}>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-xl font-bold text-slate-900">{model.displayName}</h3>
        <GradeGrid
          studentRef={model.studentRef}
          nominalGrade={model.nominalGrade}
          workingGrades={model.workingGrades}
          onChangeWorkingGrade={onChangeWorkingGrade}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby={currentHeadingId}>
        <h3 id={currentHeadingId} className="text-xl font-bold text-slate-900">
          Current work
        </h3>
        {model.currentAssignments.length === 0 ? (
          <p className="mt-2 text-slate-600">No work is currently assigned to {model.displayName}.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {model.currentAssignments.map((assignment) => (
              <li key={assignment.assignmentRef} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-slate-900">
                    {assignment.lessonTitle}
                    {assignment.optional ? <span className="ml-2 text-xs font-semibold text-slate-500">(optional)</span> : null}
                  </p>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_BADGE_CLASS[assignment.status]}`}>
                    {STATUS_LABEL[assignment.status]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{assignment.subject}</p>
                <div className="mt-2 flex gap-2">
                  {assignment.canResume && (
                    <button
                      type="button"
                      className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white"
                      onClick={() => onResumeAssignment(model.studentRef, assignment.assignmentRef)}
                    >
                      Resume for {model.displayName}
                    </button>
                  )}
                  {assignment.canSkip && onSkipAssignment && (
                    <button
                      type="button"
                      className="rounded-lg border border-slate-400 px-3 py-2 text-sm font-bold text-slate-700"
                      onClick={() => onSkipAssignment(model.studentRef, assignment.assignmentRef)}
                    >
                      Skip this lesson
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby={assignHeadingId}>
        <h3 id={assignHeadingId} className="text-xl font-bold text-slate-900">
          Assign next lesson
        </h3>
        {model.assignableLessons.length === 0 ? (
          <p className="mt-2 text-slate-600">No available lessons to assign to {model.displayName} right now.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {model.assignableLessons.map((lesson) => (
              <li key={lesson.lessonRef} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-slate-900">{lesson.title}</p>
                  <span className="text-sm text-slate-600">
                    {lesson.subject} · Grade {lesson.grade}
                  </span>
                </div>
                {lesson.duplicateAssignmentRef ? (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 p-3">
                    <p role="alert" className="text-sm font-semibold text-amber-900">
                      {lesson.canResumeDuplicate
                        ? `Already assigned to ${model.displayName} — currently ${STATUS_LABEL[lesson.duplicateStatus ?? 'in-progress']}.`
                        : lesson.duplicateStatus === 'completed' || lesson.duplicateStatus === 'skipped'
                          ? `Already ${STATUS_LABEL[lesson.duplicateStatus].toLowerCase()} by ${model.displayName} — an exact duplicate was not created.`
                          : `Already queued for ${model.displayName} — no action needed, it's in Current work above.`}
                    </p>
                    {lesson.canResumeDuplicate && (
                      <button
                        type="button"
                        className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white"
                        onClick={() => onResumeAssignment(model.studentRef, lesson.duplicateAssignmentRef as string)}
                      >
                        Resume for {model.displayName}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white"
                      onClick={() => onAssignLesson(model.studentRef, lesson.lessonRef)}
                    >
                      Assign to {model.displayName}
                    </button>
                    {lesson.priorStatus && (
                      <p className="text-xs font-semibold text-slate-500">
                        Previously {STATUS_LABEL[lesson.priorStatus].toLowerCase()} by {model.displayName}.
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
