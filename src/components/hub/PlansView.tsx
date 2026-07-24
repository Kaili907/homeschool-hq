import { useMemo, useState } from 'react'
import type { Profile, SchoolYear } from '../../types'
import { nudgePointer, quarterOfWeek, resetPointer } from '../../curriculum/pacing'
import { definedWeeks, itemsForWeek, type PlanDoc } from '../../curriculum/parser'
import { subjectPlansFor } from '../../curriculum/hubModel'

interface Props {
  profiles: Profile[]
  docs: PlanDoc[]
  sy: SchoolYear
  today: string
  onPatchProfile: (id: string, update: (prev: Profile) => Profile) => void
}

/** MP Plans — the binder: girl → subject → week-by-week, pointer highlighted, printable. */
export function PlansView({ profiles, docs, sy, today, onPatchProfile }: Props) {
  const [girlId, setGirlId] = useState(profiles[0]?.id ?? '')
  const girl = profiles.find((p) => p.id === girlId) ?? profiles[0]
  const plans = useMemo(() => (girl ? subjectPlansFor(girl, docs, sy, today) : []), [girl, docs, sy, today])
  const [subjectId, setSubjectId] = useState(plans[0]?.subject.id ?? '')
  const plan = plans.find((p) => p.subject.id === subjectId) ?? plans[0]

  const pointer = plan?.pointer ?? 1
  const [viewWeek, setViewWeek] = useState(pointer)
  const [reason, setReason] = useState('')

  if (!girl || !plan) return <p className="text-sm text-slate-500">No profiles.</p>

  const weeks = plan.doc ? definedWeeks(plan.doc) : []
  const items = plan.doc ? itemsForWeek(plan.doc, viewWeek) : []
  const nudge = (to: number) => {
    onPatchProfile(girl.id, (p) => nudgePointer(p, subjectId, to, reason || 'manual nudge', new Date().toISOString(), sy, today))
    setReason('')
  }

  return (
    <div>
      {/* girl + subject pickers */}
      <div className="mb-3 flex flex-wrap gap-2 print:hidden">
        {profiles.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setGirlId(p.id)
              const first = subjectPlansFor(p, docs, sy, today)[0]
              setSubjectId(first?.subject.id ?? '')
              setViewWeek(first?.pointer ?? 1)
            }}
            className={`rounded-full px-3 py-1 text-sm font-bold ${
              p.id === girlId ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        {plans.map((sp) => (
          <button
            key={sp.subject.id}
            onClick={() => {
              setSubjectId(sp.subject.id)
              setViewWeek(sp.pointer)
            }}
            className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
              sp.subject.id === subjectId
                ? 'border-slate-800 bg-slate-800 text-white'
                : sp.missing
                  ? 'border-dashed border-slate-300 text-slate-400'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {sp.subject.label}
            {sp.missing ? ' · —' : ''}
          </button>
        ))}
      </div>

      {plan.missing || !plan.doc ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <div className="text-3xl">🕓</div>
          <p className="mt-2 font-bold text-slate-600">Awaiting placement results</p>
          <p className="mt-1 text-sm text-slate-500">
            {girl.name}'s {plan.subject.label} scope arrives once her assessment is scored. The hub stays useful
            meanwhile — her other subjects are ready.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          {/* week nav + pointer controls */}
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-3 print:hidden">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewWeek((w) => Math.max(1, w - 1))}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm font-bold text-slate-600 disabled:opacity-30"
                disabled={viewWeek <= 1}
              >
                ‹
              </button>
              <span className="min-w-[120px] text-center text-sm font-bold text-slate-800">
                Week {viewWeek} · Q{quarterOfWeek(sy, viewWeek)}
              </span>
              <button
                onClick={() => setViewWeek((w) => Math.min(sy.totalWeeks, w + 1))}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm font-bold text-slate-600 disabled:opacity-30"
                disabled={viewWeek >= sy.totalWeeks}
              >
                ›
              </button>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                viewWeek === pointer ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              current pointer: wk {pointer}
              {plan.drift !== 0 ? ` (${plan.drift > 0 ? '+' : ''}${plan.drift})` : ''}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="reason (logged)"
                className="w-40 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700"
                aria-label="nudge reason"
              />
              <button
                onClick={() => nudge(viewWeek)}
                disabled={viewWeek === pointer}
                className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-30"
              >
                Set pointer here
              </button>
              {plan.drift !== 0 && (
                <button
                  onClick={() => onPatchProfile(girl.id, (p) => resetPointer(p, subjectId))}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Reset to calendar
                </button>
              )}
              <button
                onClick={() => window.print()}
                className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                🖨 Print week
              </button>
            </div>
          </div>

          {/* the viewed week (this is what prints) */}
          <div className="p-4">
            <h3 className="text-lg font-bold text-slate-900">
              {girl.name} · {plan.subject.label} — Week {viewWeek}
            </h3>
            {items.length === 0 ? (
              <p className="mt-2 text-sm italic text-slate-400">No scope defined for this week.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {items.map((it, i) => (
                  <li key={i} className="flex gap-2 text-slate-700">
                    <span className="shrink-0">{it.dadTaught ? '✋' : '•'}</span>
                    <span>
                      {it.text}
                      {it.dadTaught && <span className="ml-2 text-xs font-semibold text-slate-400">(Dad-taught)</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* full scope list */}
          <div className="border-t border-slate-100 p-3 print:hidden">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Full scope</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {weeks.map((w) => (
                <button
                  key={w}
                  onClick={() => setViewWeek(w)}
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${
                    w === viewWeek
                      ? 'bg-slate-800 text-white'
                      : w === pointer
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* nudge log */}
      {girl.pacing && girl.pacing.nudges.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 print:hidden">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Pointer nudges (logged)</div>
          <ul className="mt-1 space-y-0.5">
            {[...girl.pacing.nudges].reverse().slice(0, 12).map((n, i) => (
              <li key={i} className="text-xs text-slate-500">
                {n.at.slice(0, 10)} · {n.subjectId}: wk {n.from} → {n.to}
                {n.reason ? ` — ${n.reason}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
