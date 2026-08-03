import type { StudyCalendarEntry } from '../../study/types'

export function StudyCalendarPanel({ entries }: { entries: readonly StudyCalendarEntry[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="study-calendar-heading">
      <h2 id="study-calendar-heading" className="text-xl font-bold text-slate-900">Study calendar projection</h2>
      <p className="mt-1 text-sm text-slate-600">Canonical blocks only. The school-year pacing calendar remains unchanged.</p>
      {entries.length === 0 ? <p className="mt-4 text-slate-600">No local Study blocks are scheduled for this learner.</p> : (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {entries.map((entry) => (
            <li key={entry.blockRef} className="rounded-xl border border-slate-200 p-4">
              <p className="font-bold text-slate-900">{entry.title}</p>
              <p className="mt-1 text-sm text-slate-600">{entry.intendedLocalDate} · {entry.blockKind.replaceAll('_', ' ')}</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{entry.state} · {entry.requiredWorkCompletionPercent}% required work complete</p>
              {entry.resumePoint && <p className="mt-2 text-sm text-cyan-800">Exact resume: step {entry.resumePoint.segmentOrdinal}, {entry.resumePoint.segmentRef}</p>}
              {entry.continuationOf && <p className="mt-2 text-sm text-slate-600">Continuation of {entry.continuationOf}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
