import type { AppState, Profile, SchoolYear } from '../../types'
import { isDayComplete } from '../../missions'
import { todayForGirl } from '../../curriculum/hubModel'
import type { PlanDoc } from '../../curriculum/parser'

interface Props {
  profiles: Profile[]
  docs: PlanDoc[]
  sy: SchoolYear
  today: string
  state: AppState
}

function friendly(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

/** MP Today — the morning screen: one column per girl, live mission + derived teaching items. */
export function TodayView({ profiles, docs, sy, today }: Props) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-bold text-slate-800">{friendly(today)}</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {profiles.map((p) => (
          <GirlColumn key={p.id} p={p} docs={docs} sy={sy} today={today} />
        ))}
      </div>
    </div>
  )
}

function GirlColumn({ p, docs, sy, today }: { p: Profile; docs: PlanDoc[]; sy: SchoolYear; today: string }) {
  const day = p.missions[today]
  const total = day?.items.length ?? 0
  const done = day?.items.filter((i) => i.done).length ?? 0
  const complete = isDayComplete(day)
  const t = todayForGirl(p, docs, sy, today)

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-baseline justify-between">
        <span className="font-bold text-slate-900">{p.name}</span>
        <span className="text-xs font-semibold text-slate-400">Gr {p.grade}</span>
      </div>

      {/* live mission status */}
      <div className="mt-2">
        {total === 0 ? (
          <span className="text-xs font-semibold text-slate-400">No mission today</span>
        ) : (
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
              complete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Mission {done}/{total}
            {complete ? ' ✓' : ''}
          </span>
        )}
        {p.streaks.current > 0 && (
          <span className="ml-1 text-xs font-semibold text-orange-500">🔥{p.streaks.current}</span>
        )}
      </div>

      {/* teaching items */}
      <div className="mt-3 border-t border-slate-100 pt-2">
        {t.travelWeek ? (
          <div className="rounded-lg bg-sky-50 px-2 py-3 text-center text-sm font-bold text-sky-700">
            Travel week 🧳
          </div>
        ) : !sy.startDate ? (
          <div className="text-xs font-semibold text-slate-400">Set a start date to see today's plan.</div>
        ) : (
          <ul className="space-y-2">
            {t.subjects.map((s) => (
              <li key={s.subject.id}>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{s.subject.label}</span>
                  {!s.missing && <span className="text-[10px] font-semibold text-slate-300">wk {s.pointer}</span>}
                </div>
                {s.missing ? (
                  <div className="text-xs font-medium italic text-slate-400">awaiting placement results</div>
                ) : s.items.length === 0 ? (
                  <div className="text-xs font-medium text-slate-300">—</div>
                ) : (
                  <ul className="mt-0.5 space-y-0.5">
                    {s.items.map((it, i) => (
                      <li key={i} className="flex gap-1 text-sm text-slate-700">
                        <span className="shrink-0" title={it.dadTaught ? 'Dad-taught' : 'independent'}>
                          {it.dadTaught ? '✋' : '•'}
                        </span>
                        <span>{it.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
