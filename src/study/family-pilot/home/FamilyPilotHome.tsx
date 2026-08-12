import { resolveHomeAssignmentAction, simpleProgressPercent } from './familyPilotHomeLogic'
import type { FamilyPilotHomeAssignment, FamilyPilotHomeAssignmentStatus, FamilyPilotHomeProps } from './types'

const STATUS_LABEL: Record<FamilyPilotHomeAssignmentStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  completed: 'Completed',
}

const STATUS_BADGE_CLASS: Record<FamilyPilotHomeAssignmentStatus, string> = {
  'not-started': 'bg-slate-100 text-slate-700',
  'in-progress': 'bg-cyan-100 text-cyan-900',
  completed: 'bg-emerald-100 text-emerald-900',
}

const ACTION_BUTTON_CLASS =
  'mt-3 min-h-11 w-full rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900 sm:w-auto'

/**
 * Family Pilot Study home — the student's landing screen after identity
 * selection. Reads only from props and holds no state itself: the host owns
 * data and persistence and is notified of every intent through the
 * on* callbacks.
 */
export function FamilyPilotHome({
  student,
  todayAssignments,
  inProgressAssignment = null,
  completedTodayCount,
  tutorAvailability = null,
  hold = null,
  loading = false,
  error = null,
  onStartAssignment,
  onResumeAssignment,
  onOpenTutor,
  onOpenAssignments,
  onSwitchStudent,
}: FamilyPilotHomeProps) {
  const holdActive = hold?.active ?? false
  const progressPercent = simpleProgressPercent(completedTodayCount, todayAssignments.length)

  return (
    <div className="family-pilot-home min-h-screen bg-slate-50 text-slate-900">
      <a
        href="#family-pilot-home-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3 focus:shadow"
      >
        Skip to today&rsquo;s work
      </a>
      <main id="family-pilot-home-main" className="mx-auto max-w-3xl px-4 py-6" aria-busy={loading}>
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-700 text-lg font-bold text-white"
            >
              {(student.avatarInitial || student.displayName.charAt(0) || '?').toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-cyan-700">Family Pilot Study</p>
              <h1 className="text-2xl font-bold">Hi, {student.displayName}</h1>
            </div>
          </div>
          <button
            type="button"
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900"
            onClick={onSwitchStudent}
          >
            Switch student
          </button>
        </header>

        {holdActive && (
          <section className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4" role="alert">
            <h2 className="font-bold text-amber-900">Study is on hold</h2>
            <p className="mt-1 text-amber-900">
              {hold?.reason ?? 'A grown-up needs to check in before you continue.'}
            </p>
          </section>
        )}

        {loading && (
          <p className="mt-6 rounded-xl bg-white p-5" role="status">
            Loading your day…
          </p>
        )}

        {error && !loading && (
          <section className="mt-6 rounded-xl border border-red-300 bg-red-50 p-5" role="alert">
            <h2 className="font-bold">Your day couldn&rsquo;t load</h2>
            <p>{error}</p>
          </section>
        )}

        {!loading && !error && (
          <>
            <section className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white p-4">
                <p className="text-sm font-semibold text-slate-600">Completed today</p>
                <p className="text-2xl font-bold">{completedTodayCount}</p>
              </div>
              <div className="rounded-xl bg-white p-4">
                <p className="text-sm font-semibold text-slate-600">Today&rsquo;s progress</p>
                <div
                  className="mt-2 h-2 rounded-full bg-slate-200"
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Today's progress"
                >
                  <div className="h-2 rounded-full bg-cyan-700" style={{ width: `${progressPercent}%` }} />
                </div>
                <p className="mt-1 text-sm text-slate-600">{progressPercent}%</p>
              </div>
            </section>

            {tutorAvailability && (
              <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <div>
                  <p className="font-bold">Tutor help</p>
                  <p className="text-sm text-slate-600">
                    {tutorAvailability.available
                      ? 'Your Tutor is ready to help.'
                      : (tutorAvailability.reason ?? 'Tutor help is not available right now.')}
                  </p>
                </div>
                <button
                  type="button"
                  className="min-h-11 rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900"
                  disabled={!tutorAvailability.available || holdActive}
                  onClick={onOpenTutor}
                >
                  Ask your Tutor
                </button>
              </section>
            )}

            {inProgressAssignment && (
              <section
                className="mt-6 rounded-2xl border border-cyan-200 bg-white p-5"
                aria-labelledby="family-pilot-home-in-progress"
              >
                <h2 id="family-pilot-home-in-progress" className="text-xl font-bold">
                  Pick up where you left off
                </h2>
                <p className="mt-1 font-semibold">{inProgressAssignment.title}</p>
                {inProgressAssignment.subject && (
                  <p className="text-sm text-slate-600">{inProgressAssignment.subject}</p>
                )}
                <button
                  type="button"
                  className={ACTION_BUTTON_CLASS}
                  aria-label={`Resume ${inProgressAssignment.title}`}
                  disabled={holdActive}
                  onClick={() => onResumeAssignment(inProgressAssignment.assignmentRef)}
                >
                  Resume
                </button>
              </section>
            )}

            <section className="mt-6" aria-labelledby="family-pilot-home-today">
              <div className="flex items-center justify-between">
                <h2 id="family-pilot-home-today" className="text-xl font-bold">
                  Today&rsquo;s work
                </h2>
                <button
                  type="button"
                  className="text-sm font-semibold text-cyan-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900"
                  onClick={onOpenAssignments}
                >
                  View all assignments
                </button>
              </div>

              {todayAssignments.length === 0 ? (
                <p className="mt-2 text-slate-600">Nothing assigned for today.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {todayAssignments.map((assignment) =>
                    renderAssignmentRow(assignment, {
                      // The in-progress card above already offers this assignment's
                      // primary action — no need to repeat the button here.
                      showAction: assignment.assignmentRef !== inProgressAssignment?.assignmentRef,
                      holdActive,
                      onStartAssignment,
                      onResumeAssignment,
                    }),
                  )}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

function renderAssignmentRow(
  assignment: FamilyPilotHomeAssignment,
  {
    showAction,
    holdActive,
    onStartAssignment,
    onResumeAssignment,
  }: {
    showAction: boolean
    holdActive: boolean
    onStartAssignment: (assignmentRef: string) => void
    onResumeAssignment: (assignmentRef: string) => void
  },
) {
  const action = showAction ? resolveHomeAssignmentAction(assignment) : null
  return (
    <li key={assignment.assignmentRef} className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">{assignment.title}</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_BADGE_CLASS[assignment.status]}`}>
          {STATUS_LABEL[assignment.status]}
        </span>
      </div>
      {assignment.subject && <p className="text-sm text-slate-600">{assignment.subject}</p>}
      {action === 'start' && (
        <button
          type="button"
          className={ACTION_BUTTON_CLASS}
          aria-label={`Start ${assignment.title}`}
          disabled={holdActive}
          onClick={() => onStartAssignment(assignment.assignmentRef)}
        >
          Start
        </button>
      )}
      {action === 'resume' && (
        <button
          type="button"
          className={ACTION_BUTTON_CLASS}
          aria-label={`Resume ${assignment.title}`}
          disabled={holdActive}
          onClick={() => onResumeAssignment(assignment.assignmentRef)}
        >
          Resume
        </button>
      )}
    </li>
  )
}
