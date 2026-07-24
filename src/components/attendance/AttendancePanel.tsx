import { useState } from 'react'
import type { Profile } from '../../types'
import { isoToday } from '../../appState'
import {
  attendanceCsv,
  effectiveHoursPerDay,
  estimateHoursFromTemplate,
  getAttendance,
  loggedMonths,
  monthTotals,
  setHoursPerDay,
  yearToDateTotals,
} from '../../attendance/attendance'

function downloadText(filename: string, text: string, mime = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

/**
 * SE-B Grown-Ups attendance section (SE card #6). Read-only log summary plus the
 * one thing Dad edits: the per-girl hours/day override (blank = estimate from her
 * template block count). Monthly + YTD counts, CSV export. Nothing here is kid-facing.
 */
export function AttendancePanel({
  profile,
  onChange,
}: {
  profile: Profile
  onChange: (update: (prev: Profile) => Profile) => void
}) {
  const att = getAttendance(profile)
  const estimate = estimateHoursFromTemplate(profile)
  const [override, setOverride] = useState(att.hoursPerDay != null ? String(att.hoursPerDay) : '')

  const commit = (raw: string) => {
    setOverride(raw)
    const trimmed = raw.trim()
    if (trimmed === '') onChange((prev) => setHoursPerDay(prev, undefined))
    else {
      const n = Number(trimmed)
      if (!Number.isNaN(n)) onChange((prev) => setHoursPerDay(prev, n))
    }
  }

  const months = loggedMonths(att)
  const ytd = yearToDateTotals(att, att.log.length ? att.log[att.log.length - 1].date : isoToday())

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-slate-700">Attendance — auto-logged on mission completion</span>
        <button
          onClick={() => downloadText(`attendance-${profile.name || profile.id}-${isoToday()}.csv`, attendanceCsv(att))}
          disabled={att.log.length === 0}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          ⬇️ Export CSV
        </button>
      </div>

      {/* hours/day override */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold text-slate-600">
          Hours per school day
          <input
            type="number"
            min="0"
            step="0.25"
            value={override}
            onChange={(e) => commit(e.target.value)}
            placeholder={`estimate ${estimate}`}
            className="ml-2 w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-800"
          />
        </label>
        <span className="text-xs text-slate-500">
          {override.trim() === ''
            ? `Using the ${estimate}h estimate from her template block count. Leave blank to keep estimating.`
            : `Override active · ${effectiveHoursPerDay(profile)}h/day credited to new days.`}
        </span>
      </div>

      {/* YTD + monthly */}
      {att.log.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No school days logged yet — they appear here as missions are completed.</p>
      ) : (
        <>
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-sm font-bold text-emerald-800">
            School-year to date: {ytd.days} days · {ytd.hours} hours
          </div>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-slate-500">
                <th className="py-1">Month</th>
                <th className="py-1">Days</th>
                <th className="py-1">Hours</th>
              </tr>
            </thead>
            <tbody>
              {months.map((ym) => {
                const m = monthTotals(att, ym)
                return (
                  <tr key={ym} className="border-t border-slate-200">
                    <td className="py-1 font-semibold text-slate-700">{monthLabel(ym)}</td>
                    <td className="py-1 text-slate-600">{m.days}</td>
                    <td className="py-1 text-slate-600">{m.hours}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
