import { useEffect, useState } from 'react'
import type { StudyPortBundle } from '../../study/ports'
import type { HostStudyLaunchContext, StudyCalendarEntry, StudyReviewRecommendation } from '../../study/types'
import { ensureLocalDevelopmentStudyDay } from '../../study/calendarAdapter'
import './study-host.css'

interface Props {
  context: HostStudyLaunchContext
  ports: StudyPortBundle
  onLaunch: (entry: StudyCalendarEntry) => void
  onSettings: () => void
  onBack: () => void
}

export function StudyDashboard({ context, ports, onLaunch, onSettings, onBack }: Props) {
  const [blocks, setBlocks] = useState<readonly StudyCalendarEntry[]>([])
  const [reviews, setReviews] = useState<readonly StudyReviewRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const scope = { householdRef: context.householdRef, learnerRef: context.learnerRef }

  useEffect(() => {
    let current = true
    setLoading(true)
    ensureLocalDevelopmentStudyDay({
      scope,
      grade: context.grade,
      householdTimeZone: context.householdTimeZone,
      calendar: ports.calendar,
      timerHidden: context.timerPreference.visibility === 'hidden',
    })
      .then(async () => Promise.all([ports.calendar.list(scope), ports.reviewQueue.list(scope)]))
      .then(([nextBlocks, nextReviews]) => {
        if (!current) return
        setBlocks(nextBlocks)
        setReviews(nextReviews)
        setError(null)
      })
      .catch(() => current && setError('Today’s Study plan could not be prepared safely.'))
      .finally(() => current && setLoading(false))
    return () => { current = false }
  }, [context.grade, context.householdTimeZone, context.learnerRef, context.timerPreference.visibility, ports])

  const today = blocks.filter((entry) => entry.intendedLocalDate === context.learnerLocalDate && entry.state !== 'completed')
  const resumes = blocks.filter((entry) => entry.state === 'paused')
  const completed = blocks.filter((entry) => entry.state === 'completed')

  return (
    <div className="study-runtime-host min-h-screen bg-slate-50 text-slate-900" data-large-text={context.accessibility.largeText} data-high-contrast={context.accessibility.highContrast} data-reduced-motion={context.accessibility.reducedMotion}>
      <a href="#study-plan" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:bg-white focus:p-3">Skip to today’s Study plan</a>
      <main id="study-plan" className="mx-auto max-w-5xl px-4 py-6" aria-busy={loading}>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-cyan-700">Adaptive Study Engine · local preview</p>
            <h1 className="text-3xl font-bold">Today’s Study plan</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold" onClick={onSettings}>Study settings</button>
            <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold" onClick={onBack}>Back home</button>
          </div>
        </header>

        <p className="mt-2 text-sm text-slate-600">This plan is scoped to the currently authenticated learner. Local preview data is not durable.</p>
        {loading && <p className="mt-6 rounded-xl bg-white p-5" role="status">Preparing your Study plan…</p>}
        {error && <section className="mt-6 rounded-xl border border-red-300 bg-red-50 p-5" role="alert"><h2 className="font-bold">Study is unavailable</h2><p>{error}</p><button className="mt-3 rounded-lg border border-red-400 bg-white px-4 py-2" onClick={onBack}>Back home</button></section>}
        {!loading && !error && (
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <StudyBlockList title="Scheduled blocks" entries={today} onLaunch={onLaunch} />
            <StudyBlockList title="Resume Study Session" entries={resumes} onLaunch={onLaunch} empty="No Study Session needs a resume." />
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-xl font-bold">Upcoming reviews</h2>
              {reviews.length === 0 ? <p className="mt-2 text-slate-600">No reviews are queued.</p> : <ul className="mt-3 space-y-2">{reviews.map((review) => <li key={review.recommendationRef} className="rounded-lg bg-slate-50 p-3"><span className="font-semibold">{review.dueDate}</span><span className="block text-sm">{review.reasonCodes.join(', ')}</span></li>)}</ul>}
            </section>
            <StudyBlockList title="Completed learning blocks" entries={completed} onLaunch={onLaunch} empty="No Study blocks are completed yet." completed />
          </div>
        )}
      </main>
    </div>
  )
}

function StudyBlockList({ title, entries, onLaunch, empty = 'Nothing scheduled.', completed = false }: {
  title: string
  entries: readonly StudyCalendarEntry[]
  onLaunch: (entry: StudyCalendarEntry) => void
  empty?: string
  completed?: boolean
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-xl font-bold">{title}</h2>
      {entries.length === 0 ? <p className="mt-2 text-slate-600">{empty}</p> : (
        <ul className="mt-3 space-y-3">
          {entries.map((entry) => (
            <li key={entry.blockRef} className="rounded-xl border border-slate-200 p-4">
              <p className="font-bold">{entry.title}</p>
              <p className="text-sm text-slate-600">{entry.subject} · {entry.state} · {entry.requiredWorkCompletionPercent}% complete</p>
              {!completed && <button className="mt-3 w-full rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white sm:w-auto" onClick={() => onLaunch(entry)}>{entry.state === 'paused' ? 'Resume exact step' : 'Launch Study Session'}</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
