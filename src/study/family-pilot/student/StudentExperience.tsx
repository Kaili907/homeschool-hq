import { useState } from 'react'
import {
  assignmentStatusLabel,
  resolveCurrentSegment,
  resolvePrimaryAction,
  resolveSegmentProgress,
} from './studentAssignmentLogic'
import type { AssignmentStatus, StudentAssignment, StudentExperienceProps } from './types'

const STATUS_BADGE_CLASS: Record<AssignmentStatus, string> = {
  NOT_STARTED: 'bg-slate-100 text-slate-600',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
}

/**
 * Self-contained student-facing Family Pilot Study experience.
 *
 * Reads only from props and holds no assignment/session data itself — the
 * host owns data and persistence and is notified of every intent through
 * onStart / onResume / onPause / onComplete / onExit.
 */
export function StudentExperience({
  student,
  assignments,
  loading = false,
  error = null,
  actionsDisabled = false,
  onStart,
  onResume,
  onPause,
  onComplete,
  onExit,
}: StudentExperienceProps) {
  const [openAssignmentRef, setOpenAssignmentRef] = useState<string | null>(null)
  const openAssignment = assignments.find((assignment) => assignment.assignmentRef === openAssignmentRef) ?? null

  const returnToAssignments = (assignmentRef: string) => {
    onExit(assignmentRef)
    setOpenAssignmentRef(null)
  }

  return (
    <div className="family-pilot-student min-h-screen bg-slate-50 text-slate-900">
      <a
        href="#family-pilot-student-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3 focus:shadow"
      >
        Skip to your assignments
      </a>
      <main
        id="family-pilot-student-main"
        className="mx-auto max-w-3xl px-4 py-6"
        aria-busy={loading}
      >
        <header className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-700 text-lg font-bold text-white"
          >
            {(student.avatarInitial ?? student.displayName.charAt(0) ?? '?').toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-cyan-700">Family Pilot Study</p>
            <h1 className="text-2xl font-bold">Hi, {student.displayName}</h1>
          </div>
        </header>

        {loading && (
          <p className="mt-6 rounded-xl bg-white p-5" role="status">
            Loading your assignments…
          </p>
        )}

        {error && !loading && (
          <section className="mt-6 rounded-xl border border-red-300 bg-red-50 p-5" role="alert">
            <h2 className="font-bold">Your assignments couldn’t load</h2>
            <p>{error}</p>
          </section>
        )}

        {!loading && !error && openAssignment && (
          <ActiveAssignmentView
            assignment={openAssignment}
            onPause={onPause}
            onResume={onResume}
            onComplete={onComplete}
            onExit={returnToAssignments}
            actionsDisabled={actionsDisabled}
          />
        )}

        {!loading && !error && !openAssignment && (
          <AssignmentList
            assignments={assignments}
            onStart={(assignmentRef) => {
              onStart(assignmentRef)
              setOpenAssignmentRef(assignmentRef)
            }}
            onResume={(assignmentRef) => {
              onResume(assignmentRef)
              setOpenAssignmentRef(assignmentRef)
            }}
          />
        )}
      </main>
    </div>
  )
}

export function AssignmentList({
  assignments,
  onStart,
  onResume,
}: {
  assignments: readonly StudentAssignment[]
  onStart: (assignmentRef: string) => void
  onResume: (assignmentRef: string) => void
}) {
  return (
    <section aria-label="Your assignments" className="mt-6">
      <h2 className="text-xl font-bold">Your Study work</h2>
      {assignments.length === 0 ? (
        <p className="mt-2 text-slate-600">Nothing assigned right now.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {assignments.map((assignment) => (
            <li key={assignment.assignmentRef} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">{assignment.title}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_BADGE_CLASS[assignment.status]}`}
                >
                  {assignmentStatusLabel(assignment.status)}
                </span>
              </div>
              {assignment.subject && <p className="text-sm text-slate-600">{assignment.subject}</p>}
              {resolvePrimaryAction(assignment) === 'start' && (
                <button
                  type="button"
                  className="mt-3 w-full rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900 sm:w-auto"
                  aria-label={`Start ${assignment.title}`}
                  onClick={() => onStart(assignment.assignmentRef)}
                >
                  Start assignment
                </button>
              )}
              {resolvePrimaryAction(assignment) === 'resume' && (
                <button
                  type="button"
                  className="mt-3 w-full rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900 sm:w-auto"
                  aria-label={`Resume ${assignment.title}`}
                  onClick={() => onResume(assignment.assignmentRef)}
                >
                  {assignment.sessionState === 'paused' ? 'Resume assignment' : 'Continue assignment'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function ActiveAssignmentView({
  assignment,
  onPause,
  onResume,
  onComplete,
  onExit,
  actionsDisabled = false,
}: {
  assignment: StudentAssignment
  onPause: (assignmentRef: string) => void
  onResume: (assignmentRef: string) => void
  onComplete: (assignmentRef: string) => void
  onExit: (assignmentRef: string) => void
  actionsDisabled?: boolean
}) {
  const currentSegment = resolveCurrentSegment(assignment)
  const progress = resolveSegmentProgress(assignment)
  const isPaused = assignment.sessionState === 'paused'

  return (
    <section aria-label={`Working on ${assignment.title}`} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
      <button
        type="button"
        className="text-sm font-semibold text-cyan-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900"
        onClick={() => onExit(assignment.assignmentRef)}
      >
        ← Return to assignments
      </button>

      <h2 className="mt-2 text-xl font-bold">{assignment.title}</h2>
      <p className="mt-1 text-sm text-slate-600" aria-live="polite">
        {isPaused ? 'Paused' : 'In progress'} · {progress.completed} of {progress.total} steps complete
      </p>

      <div className="mt-4 rounded-xl bg-slate-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Current step</p>
        {currentSegment ? (
          <p className="mt-1 font-semibold">{currentSegment.title}</p>
        ) : (
          <p className="mt-1 text-slate-600">All steps are complete.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {isPaused ? (
          <button
            type="button"
            className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900"
            aria-label={`Continue ${assignment.title}`}
            onClick={() => onResume(assignment.assignmentRef)}
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900"
            aria-label={`Pause ${assignment.title}`}
            disabled={actionsDisabled}
            onClick={() => onPause(assignment.assignmentRef)}
          >
            Pause
          </button>
        )}
        <button
          type="button"
          className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900"
          aria-label={`Finish ${assignment.title}`}
          disabled={actionsDisabled}
          onClick={() => onComplete(assignment.assignmentRef)}
        >
          Finish
        </button>
      </div>
    </section>
  )
}
