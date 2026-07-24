import { useState } from 'react'
import type { Profile, SchoolYear } from '../../types'
import {
  buildCalendar,
  derivedScopeWeek,
  mondayOf,
  setStartDate,
  toggleOffWeek,
} from '../../curriculum/pacing'
import { itemsForWeek, type PlanDoc } from '../../curriculum/parser'
import { subjectPlansFor } from '../../curriculum/hubModel'

interface Props {
  profiles: Profile[]
  docs: PlanDoc[]
  sy: SchoolYear
  today: string
  onChange: (sy: SchoolYear) => void
}

const dateLabel = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** MP Calendar — 36 scope weeks over real dates; off-week toggle is the travel button. */
export function CalendarView({ profiles, docs, sy, today, onChange }: Props) {
  const rows = buildCalendar(sy)
  const todayMonday = mondayOf(today)
  const [selected, setSelected] = useState<number | null>(() => derivedScopeWeek(sy, today) || null)

  // drift badges: girl × subject where a nudged pointer ≠ the calendar week
  const drifts = profiles.flatMap((p) =>
    subjectPlansFor(p, docs, sy, today)
      .filter((sp) => sp.drift !== 0)
      .map((sp) => ({ name: p.name, subject: sp.subject.label, drift: sp.drift, pointer: sp.pointer })),
  )

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {/* controls */}
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <label className="text-sm font-bold text-slate-700">Start date</label>
          <input
            type="date"
            value={sy.startDate}
            onChange={(e) => onChange(setStartDate(sy, e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800"
            aria-label="school year start date"
          />
          <span className="text-xs text-slate-500">36 weeks · quarter breaks after 9 / 18 / 27 · click a row to toggle a travel week</span>
        </div>

        {!sy.startDate ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500">
            Set a start date above to lay out the year.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {rows.map((r) => {
              const isToday = r.monday === todayMonday
              return (
                <div key={r.monday}>
                  <div
                    className={`flex items-center gap-3 border-b border-slate-100 px-3 py-1.5 ${
                      isToday ? 'bg-amber-50' : r.scopeWeek === selected && !r.off ? 'bg-sky-50' : ''
                    }`}
                  >
                    <button
                      onClick={() => !r.off && r.scopeWeek != null && setSelected(r.scopeWeek)}
                      className="flex flex-1 items-center gap-3 text-left"
                      disabled={r.off}
                    >
                      <span className={`w-16 shrink-0 font-bold ${r.off ? 'text-sky-600' : 'text-slate-700'}`}>
                        {r.off ? '🧳 off' : `Wk ${r.scopeWeek}`}
                      </span>
                      <span className="w-16 shrink-0 text-xs text-slate-500">{dateLabel(r.monday)}</span>
                      {!r.off && <span className="text-xs text-slate-400">Q{r.quarter}</span>}
                      {isToday && <span className="rounded-full bg-amber-200 px-2 text-[10px] font-bold text-amber-800">today</span>}
                    </button>
                    <button
                      onClick={() => onChange(toggleOffWeek(sy, r.monday))}
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        r.off
                          ? 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                          : 'border border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                      title={r.off ? 'Mark this week back as taught' : 'Mark this week as travel (shifts later weeks)'}
                    >
                      {r.off ? 'un-travel' : '🧳 travel'}
                    </button>
                  </div>
                  {r.quarterBreakAfter && (
                    <div className="border-b-2 border-dashed border-slate-300 bg-slate-50 px-3 py-0.5 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      quarter break
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* side: selected-week summary + drift badges */}
      <div className="space-y-4">
        {selected != null && sy.startDate && (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <h3 className="mb-2 text-sm font-bold text-slate-800">Week {selected} — across the girls</h3>
            <div className="space-y-2">
              {profiles.map((p) => {
                const plans = subjectPlansFor(p, docs, sy, today).filter((sp) => sp.doc)
                return (
                  <div key={p.id} className="text-xs">
                    <span className="font-bold text-slate-700">{p.name}:</span>{' '}
                    {plans.length === 0 ? (
                      <span className="italic text-slate-400">awaiting placement results</span>
                    ) : (
                      plans
                        .map((sp) => `${sp.subject.label} (${itemsForWeek(sp.doc!, selected).length})`)
                        .join(' · ')
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <h3 className="mb-2 text-sm font-bold text-slate-800">Pointer drift</h3>
          {drifts.length === 0 ? (
            <p className="text-xs text-slate-400">Every subject is on the calendar week.</p>
          ) : (
            <ul className="space-y-1">
              {drifts.map((d, i) => (
                <li key={i} className="text-xs text-slate-600">
                  <span className="font-semibold">{d.name}</span> · {d.subject}{' '}
                  <span className={`rounded px-1 font-bold ${d.drift < 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {d.drift > 0 ? '+' : ''}
                    {d.drift}
                  </span>{' '}
                  <span className="text-slate-400">(wk {d.pointer})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
