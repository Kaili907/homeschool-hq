import type { Dispatch, SetStateAction } from 'react'
import type { AppState, Profile } from '../../types'
import { isoToday } from '../../appState'
import { mindsetCompletionSummary, unlockedWeekCount, weekUnlockDate } from '../../mindset/mindset'

/**
 * Global school-year start date. Weeks unlock on the Fridays that follow. One idea
 * per week — earlier weeks stay revisitable, future weeks locked.
 */
export function MindsetStartDate({
  state,
  onStateChange,
}: {
  state: AppState
  onStateChange: Dispatch<SetStateAction<AppState>>
}) {
  const start = state.mindsetStartDate ?? ''
  const today = isoToday()
  const unlocked = unlockedWeekCount(state.mindsetStartDate, today)
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <label className="block text-sm font-bold text-slate-700">School-year start date</label>
      <p className="mt-0.5 text-xs text-slate-500">
        Week 1 unlocks the first Friday on or after this date; each later week unlocks the next Friday.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={start}
          onChange={(e) =>
            onStateChange((s) => ({ ...s, mindsetStartDate: e.target.value || undefined }))
          }
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800"
          aria-label="mindset start date"
        />
        {state.mindsetStartDate ? (
          <span className="text-xs font-semibold text-slate-500">
            {unlocked === 0
              ? `Week 1 unlocks ${weekUnlockDate(state.mindsetStartDate, 1)}`
              : `${unlocked} of 9 weeks unlocked`}
          </span>
        ) : (
          <span className="text-xs font-semibold text-amber-600">Not set — all mindset weeks are locked.</span>
        )}
      </div>
    </div>
  )
}

/**
 * PRIVACY (load-bearing): this is the ONLY mindset view in the Grown-Ups panel, and it
 * renders COMPLETION STATUS ONLY — no entry content, no excerpts, no word counts. It
 * reads `mindsetCompletionSummary`, which by construction carries only booleans.
 */
export function MindsetProfilePanel({ profile }: { profile: Profile }) {
  const rows = mindsetCompletionSummary(profile)
  const done = rows.filter((r) => r.completed).length
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-700">Mindset — completion only</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
          {done}/{rows.length} weeks
        </span>
      </div>
      <p className="mb-2 text-xs text-slate-500">
        Her journal is private. You see that she finished — never what she wrote.
      </p>
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.week} className="text-xs text-slate-600">
            <span className={r.completed ? 'text-emerald-600' : 'text-slate-300'}>
              {r.completed ? '✓' : '○'}
            </span>{' '}
            Week {r.week}: {r.title}
          </li>
        ))}
      </ul>
    </div>
  )
}
