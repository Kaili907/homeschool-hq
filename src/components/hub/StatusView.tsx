import { useState } from 'react'
import type { MasterySnapshot, Profile } from '../../types'
import { getStat } from '../../appState'
import { isDayComplete } from '../../missions'
import { skillsForGrade } from '../../skills'
import { flaggedSkills } from '../../tutor/tutorState'
import { getAttendance, yearToDateTotals } from '../../attendance/attendance'
import { addDaysISO, weekdayOf } from '../../curriculum/pacing'

interface Props {
  profiles: Profile[]
  today: string
  onPatchProfile: (id: string, update: (prev: Profile) => Profile) => void
}

/** 90/75 gradebook thresholds → green/yellow/red; no attempts → grey. */
function band(mastery: number, attempts: number): { cls: string; label: string } {
  if (attempts === 0) return { cls: 'bg-slate-100 text-slate-300', label: '—' }
  if (mastery >= 90) return { cls: 'bg-emerald-500 text-white', label: `${mastery}` }
  if (mastery >= 75) return { cls: 'bg-amber-400 text-white', label: `${mastery}` }
  return { cls: 'bg-rose-500 text-white', label: `${mastery}` }
}

/** MP Status — absorbs M5: mission/streaks + mastery heat + last-7 + Needs-Dad + snapshots. */
export function StatusView({ profiles, today, onPatchProfile }: Props) {
  return (
    <div className="space-y-4">
      {profiles.map((p) => (
        <GirlStatus key={p.id} p={p} today={today} onPatchProfile={onPatchProfile} />
      ))}
    </div>
  )
}

function GirlStatus({ p, today, onPatchProfile }: { p: Profile; today: string; onPatchProfile: Props['onPatchProfile'] }) {
  const skills = skillsForGrade(p.grade)
  const flags = flaggedSkills(p)
  const ytd = yearToDateTotals(getAttendance(p), today)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = addDaysISO(today, -(6 - i))
    return { date: d, complete: isDayComplete(p.missions[d]) }
  })
  const snapshots = p.masterySnapshots ?? []

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold text-slate-900">
          {p.name} <span className="text-sm font-semibold text-slate-400">· Grade {p.grade}</span>
        </h3>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-600">🔥 {p.streaks.current}-day · best {p.streaks.best}</span>
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">📅 {ytd.days} days · {ytd.hours}h YTD</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">✏️ {p.totals.questionsAnswered} answered</span>
        </div>
      </div>

      {/* last 7 days */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Last 7</span>
        <div className="flex gap-1">
          {last7.map((d) => (
            <span
              key={d.date}
              title={d.date}
              className={`flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold ${
                d.complete ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {weekdayOf(d.date)[0]}
            </span>
          ))}
        </div>
      </div>

      {/* mastery heat map */}
      {skills.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Math mastery (90 / 75)</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {skills.map((s) => {
              const stat = getStat(p, s.id)
              const b = band(stat.mastery, stat.attempts)
              return (
                <span
                  key={s.id}
                  title={`${s.name}: ${stat.attempts === 0 ? 'not started' : stat.mastery + '%'}`}
                  className={`flex h-8 min-w-8 items-center justify-center rounded px-1 text-[10px] font-bold ${b.cls}`}
                >
                  {b.label}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* needs-dad flags */}
      {flags.length > 0 && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2">
          <span className="text-xs font-bold text-rose-700">Needs Dad:</span>{' '}
          <span className="text-xs text-rose-600">
            {flags.map((f) => f.skillId).join(', ')} — cleared in the classic panel
          </span>
        </div>
      )}

      {/* manual mastery snapshot entry (paper subjects) */}
      <SnapshotPanel p={p} snapshots={snapshots} onPatchProfile={onPatchProfile} />
    </div>
  )
}

function SnapshotPanel({
  p,
  snapshots,
  onPatchProfile,
}: {
  p: Profile
  snapshots: MasterySnapshot[]
  onPatchProfile: Props['onPatchProfile']
}) {
  const [subject, setSubject] = useState('')
  const [level, setLevel] = useState('')
  const [note, setNote] = useState('')
  const add = () => {
    const lv = Math.max(0, Math.min(100, Number(level)))
    if (!subject.trim() || Number.isNaN(lv) || level === '') return
    const snap: MasterySnapshot = { at: new Date().toISOString(), subject: subject.trim(), level: lv, note: note.trim() || undefined }
    onPatchProfile(p.id, (prev) => ({ ...prev, masterySnapshots: [...(prev.masterySnapshots ?? []), snap] }))
    setSubject('')
    setLevel('')
    setNote('')
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Mastery snapshots (paper subjects)</div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="subject (e.g. Spelling)" className="w-40 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700" />
        <input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="level 0–100" inputMode="numeric" className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="note (optional)" className="w-48 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700" />
        <button onClick={add} className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700">
          Add
        </button>
      </div>
      {snapshots.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {[...snapshots].reverse().slice(0, 8).map((s, i) => (
            <li key={i} className="text-xs text-slate-500">
              {s.at.slice(0, 10)} · <span className="font-semibold text-slate-700">{s.subject}</span>: {s.level}
              {s.note ? ` — ${s.note}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
