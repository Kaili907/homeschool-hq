import { useState } from 'react'
import type { Profile } from '../../types'
import { isoToday } from '../../appState'
import { useTheme } from '../../theme'
import {
  addServiceEntry,
  deleteServiceEntry,
  getServiceLog,
  serviceYtd,
  sortedService,
} from '../../service/service'

/**
 * SE-B teen-home service log (SE card #12). She adds date / org / hours / note;
 * Dad approves + locks each entry in the Grown-Ups panel. Approved entries are
 * read-only here. YTD total shown; CSV export lives in the Grown-Ups admin.
 */
export function ServiceHoursCard({
  profile,
  onProfileChange,
}: {
  profile: Profile
  onProfileChange: (update: (prev: Profile) => Profile) => void
}) {
  const t = useTheme()
  const [date, setDate] = useState(isoToday())
  const [org, setOrg] = useState('')
  const [hours, setHours] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const entries = sortedService(getServiceLog(profile))
  const ytd = serviceYtd(getServiceLog(profile), isoToday())

  const submit = () => {
    const input = { date, org, hours: Number(hours), note }
    const res = addServiceEntry(profile, input)
    if (!res.ok) {
      setError(res.error ?? 'Could not add that entry.')
      return
    }
    onProfileChange((prev) => addServiceEntry(prev, input).profile)
    setOrg('')
    setHours('')
    setNote('')
    setError('')
  }

  const remove = (id: string) => onProfileChange((prev) => deleteServiceEntry(prev, id).profile)

  const friendly = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className={`${t.card} p-5`}>
      <div className="flex items-baseline justify-between">
        <h2 className={`text-lg font-bold ${t.heading}`}>Service hours 🤝</h2>
        <span className="text-sm font-semibold text-slate-500">
          {ytd.approved} approved · {ytd.total} logged this year
        </span>
      </div>
      <p className={`mt-1 text-sm ${t.sub}`}>
        Log volunteering as you go — Dad approves each entry, and approved hours drop straight into
        college applications. Aim for 30–50 hours a year.
      </p>

      {/* logging form */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-500">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Hours
          <input
            type="number"
            min="0"
            step="0.5"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="e.g. 3"
            className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
          />
        </label>
        <label className="text-xs font-semibold text-slate-500 sm:col-span-2">
          Organization
          <input
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            placeholder="Wrestling club, food bank, church…"
            className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
          />
        </label>
        <label className="text-xs font-semibold text-slate-500 sm:col-span-2">
          What you did (optional)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Helped coach the littles' club"
            className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
          />
        </label>
      </div>
      {error && <div className="mt-2 text-sm font-semibold text-rose-600">{error}</div>}
      <button onClick={submit} className={`${t.primaryBtn} mt-3 px-4 py-2 text-sm`}>
        Log hours
      </button>

      {/* entries */}
      {entries.length > 0 && (
        <ul className="mt-4 space-y-2">
          {entries.map((e) => (
            <li
              key={e.id}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                e.approved ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
              }`}
            >
              <span className="shrink-0 text-sm font-bold text-slate-700">{e.hours}h</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-800">{e.org}</span>
                <span className="block truncate text-xs text-slate-500">
                  {friendly(e.date)}
                  {e.note ? ` · ${e.note}` : ''}
                </span>
              </span>
              {e.approved ? (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                  ✓ approved
                </span>
              ) : (
                <>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                    pending
                  </span>
                  <button
                    onClick={() => remove(e.id)}
                    className="shrink-0 rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-rose-500"
                    aria-label={`remove ${e.org}`}
                  >
                    ✕
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
