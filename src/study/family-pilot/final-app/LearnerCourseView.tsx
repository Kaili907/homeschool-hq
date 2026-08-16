import { ACADEMY_SUBJECT_LABELS } from '../../../academy/contentTypes'
import type { FinalLearnerCourseView } from './autoPlannerHost'

function todayMessage(view: FinalLearnerCourseView): string {
  const subject = ACADEMY_SUBJECT_LABELS[view.subject] ?? view.subject
  if (view.todayStatus === 'REQUIRED_TODAY') return `${subject} is required today.`
  if (view.todayStatus === 'TODAY_COMPLETE') return `Today’s ${subject} is complete.`
  if (view.todayStatus === 'NO_SCHOOL_TODAY') return 'No school today. Optional learning does not change today’s School Plan.'
  return `${subject} isn’t required today.`
}

export function LearnerCourseView({
  view,
  busy = false,
  error,
  onBack,
  onAction,
}: {
  readonly view: FinalLearnerCourseView | null
  readonly busy?: boolean
  readonly error?: string | null
  readonly onBack: () => void
  readonly onAction: (view: FinalLearnerCourseView) => void
}) {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <section className="mx-auto max-w-3xl rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" aria-labelledby="learner-course-heading">
        <button type="button" className="min-h-11 rounded-xl border border-slate-500 px-4 py-2 font-bold focus-visible:outline focus-visible:outline-4 focus-visible:outline-cyan-300" onClick={onBack}>← Back to courses</button>
        {busy && !view ? <p className="mt-8" role="status">Opening course…</p> : null}
        {error ? <p className="mt-6 rounded-xl border border-red-400 bg-red-950 p-4" role="alert">{error}</p> : null}
        {view ? <div className="mt-7">
          <p className="font-bold text-cyan-300">{ACADEMY_SUBJECT_LABELS[view.subject] ?? view.subject} · Working Grade {view.workingGrade}</p>
          <h1 id="learner-course-heading" className="mt-2 text-3xl font-extrabold">{view.courseTitle}</h1>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4"><p className="text-sm text-slate-300">Course completion</p><p className="mt-1 text-xl font-extrabold">{view.completedLessons} of {view.totalLessons} lessons</p></div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4"><p className="text-sm text-slate-300">Current position</p><p className="mt-1 font-extrabold">{view.currentPosition}</p></div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4"><p className="text-sm text-slate-300">Today</p><p className="mt-1 font-extrabold">{todayMessage(view)}</p></div>
          </div>
          {view.next ? <div className="mt-6 rounded-2xl border border-cyan-700 bg-slate-800 p-5">
            <p className="font-bold text-cyan-300">Next up</p>
            <h2 className="mt-1 text-xl font-extrabold">{view.next.title}</h2>
          </div> : null}
          {view.gate ? <p className="mt-6 rounded-xl border border-amber-400 bg-amber-950 p-4 font-semibold">{view.gate.message}</p> : null}
          {view.action ? <button
            type="button"
            className="mt-6 min-h-11 rounded-xl bg-emerald-600 px-5 py-3 font-extrabold text-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-cyan-300 disabled:opacity-50"
            aria-label={`${view.action.label} in ${view.courseTitle}`}
            disabled={busy}
            onClick={() => onAction(view)}
          >{busy ? 'Opening…' : view.action.label}</button> : null}
        </div> : null}
      </section>
    </main>
  )
}
