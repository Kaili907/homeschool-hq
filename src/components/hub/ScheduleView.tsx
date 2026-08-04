import { useState } from 'react'
import type { CoreDayConfig, Profile, ScheduleDay } from '../../types'
import { addDaysISO, mondayOf } from '../../curriculum/pacing'
import {
  FLEX_ROTATION,
  SCHEDULE_DAYS,
  addExtension,
  blocksForProfileDay,
  flexActivityForWeek,
  flexWeekIndex,
  removeExtension,
  type CoreDayBlock,
} from '../../schedule/coreDay'

interface Props {
  profiles: Profile[]
  today: string
  config: CoreDayConfig
  onConfigChange: (next: CoreDayConfig) => void
  onPatchProfile: (id: string, update: (prev: Profile) => Profile) => void
}

const dateLabel = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const BLOCK_STYLES: Record<CoreDayBlock['kind'], string> = {
  core: 'border-slate-200 bg-white',
  break: 'border-slate-200 bg-slate-50',
  flex: 'border-amber-200 bg-amber-50',
  extension: 'border-sky-200 bg-sky-50',
}

/**
 * SCHED-1 — Core Day v1: the per-girl weekly schedule. The shared template renders
 * for every girl; extension blocks are the per-girl additions Dad manages here.
 * Parent Hub only — the girls never see this view.
 */
export function ScheduleView({ profiles, today, config, onConfigChange, onPatchProfile }: Props) {
  const [girlId, setGirlId] = useState<string>(() => profiles[0]?.id ?? '')
  const [monday, setMonday] = useState<string>(() => mondayOf(today))
  const [label, setLabel] = useState('')
  const [days, setDays] = useState<ScheduleDay[]>([])
  const [start, setStart] = useState('13:00')
  const [end, setEnd] = useState('13:30')

  const girl = profiles.find((p) => p.id === girlId) ?? profiles[0]
  if (!girl) return null
  const flexActivity = flexActivityForWeek(flexWeekIndex(monday))
  const extensions = girl.scheduleExtensions ?? []
  const canAdd = label.trim().length > 0 && days.length > 0 && start < end

  const toggleDay = (day: ScheduleDay) =>
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))

  const submitAdd = () => {
    if (!canAdd) return
    const ordered = SCHEDULE_DAYS.filter((d) => days.includes(d))
    onPatchProfile(girl.id, (prev) =>
      addExtension(prev, { label: label.trim(), days: ordered, start, end }),
    )
    setLabel('')
    setDays([])
  }

  return (
    <div className="space-y-4">
      {/* girl selector + week nav + alternation config */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setGirlId(p.id)}
              aria-pressed={p.id === girl.id}
              className={`rounded-md px-3 py-1.5 text-sm font-bold ${
                p.id === girl.id ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonday(addDaysISO(monday, -7))}
            className="rounded-md border border-slate-200 px-2 py-1 text-sm font-bold text-slate-600 hover:bg-slate-50"
            aria-label="previous week"
          >
            ‹
          </button>
          <button
            onClick={() => setMonday(mondayOf(today))}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            this week
          </button>
          <button
            onClick={() => setMonday(addDaysISO(monday, 7))}
            className="rounded-md border border-slate-200 px-2 py-1 text-sm font-bold text-slate-600 hover:bg-slate-50"
            aria-label="next week"
          >
            ›
          </button>
          <span className="ml-1 text-xs font-semibold text-slate-500">
            week of {dateLabel(monday)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Writing days</span>
          <button
            onClick={() => onConfigChange({ writingDays: 'writing-mw' })}
            aria-pressed={config.writingDays === 'writing-mw'}
            className={`rounded-md px-2 py-1 text-xs font-bold ${
              config.writingDays === 'writing-mw'
                ? 'bg-slate-800 text-white'
                : 'border border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            Mon/Wed
          </button>
          <button
            onClick={() => onConfigChange({ writingDays: 'writing-tth' })}
            aria-pressed={config.writingDays === 'writing-tth'}
            className={`rounded-md px-2 py-1 text-xs font-bold ${
              config.writingDays === 'writing-tth'
                ? 'bg-slate-800 text-white'
                : 'border border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            Tue/Thu
          </button>
          <span className="text-xs text-slate-400">(Spelling takes the other pair)</span>
        </div>
      </div>

      {/* the week grid */}
      <div className="grid gap-3 md:grid-cols-5">
        {SCHEDULE_DAYS.map((day, i) => {
          const iso = addDaysISO(monday, i)
          return (
            <div key={day} className="rounded-xl border border-slate-200 bg-white p-2">
              <div className={`mb-2 rounded-lg px-2 py-1 ${iso === today ? 'bg-amber-50' : ''}`}>
                <span className="text-sm font-bold text-slate-800">{day}</span>{' '}
                <span className="text-xs text-slate-400">{dateLabel(iso)}</span>
              </div>
              <div className="space-y-1.5">
                {blocksForProfileDay(girl, day, config, flexActivity).map((block, j) => (
                  <div key={j} className={`rounded-lg border px-2 py-1.5 ${BLOCK_STYLES[block.kind]}`}>
                    <div className="text-[10px] font-semibold text-slate-400">
                      {block.start}–{block.end}
                    </div>
                    <div className="text-sm font-semibold text-slate-800">{block.label}</div>
                    {block.note && <div className="text-[10px] text-slate-400">{block.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-slate-400">
        Friday flex rotates weekly: {FLEX_ROTATION.join(' · ')} — this week: {flexActivity}.
      </p>

      {/* per-girl extension blocks */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <h3 className="text-sm font-bold text-slate-800">{girl.name}&rsquo;s extra blocks</h3>
        <p className="text-xs text-slate-400">
          Additions beyond the shared Core Day (the older two extend post-assessment).
        </p>
        {extensions.length === 0 ? (
          <p className="mt-2 text-xs italic text-slate-400">No extra blocks yet.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {extensions.map((ext) => (
              <li key={ext.id} className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold">{ext.label}</span>
                <span className="text-slate-400">
                  {ext.days.join('/')} · {ext.start}–{ext.end}
                </span>
                <button
                  onClick={() => onPatchProfile(girl.id, (prev) => removeExtension(prev, ext.id))}
                  className="rounded-md border border-rose-200 px-2 py-0.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                  aria-label={`remove ${ext.label}`}
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Block name
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Algebra practice"
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-semibold text-slate-800"
            />
          </label>
          <div className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Days
            <div className="flex gap-1">
              {SCHEDULE_DAYS.map((day) => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  aria-pressed={days.includes(day)}
                  className={`rounded-md px-2 py-1 text-xs font-bold ${
                    days.includes(day)
                      ? 'bg-slate-800 text-white'
                      : 'border border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Start
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-semibold text-slate-800"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            End
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-semibold text-slate-800"
            />
          </label>
          <button
            onClick={submitAdd}
            disabled={!canAdd}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            Add block
          </button>
        </div>
      </div>
    </div>
  )
}
