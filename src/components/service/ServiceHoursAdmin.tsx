import type { Profile } from '../../types'
import { isoToday } from '../../appState'
import {
  getServiceLog,
  serviceCsv,
  serviceYtd,
  setServiceApproved,
  sortedService,
} from '../../service/service'

function downloadText(filename: string, text: string, mime = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * SE-B Grown-Ups service-hours review (SE card #12). Dad's approval checkbox
 * LOCKS an entry (approved = official + read-only to the teen). YTD total + CSV.
 */
export function ServiceHoursAdmin({
  profile,
  onChange,
}: {
  profile: Profile
  onChange: (update: (prev: Profile) => Profile) => void
}) {
  const entries = sortedService(getServiceLog(profile))
  const ytd = serviceYtd(getServiceLog(profile), isoToday())

  const toggle = (id: string, approved: boolean) =>
    onChange((prev) => setServiceApproved(prev, id, approved))

  const friendly = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-slate-700">
          Service hours — {ytd.approved}h approved · {ytd.total}h logged · {ytd.pending} pending
        </span>
        <button
          onClick={() => downloadText(`service-hours-${profile.name || profile.id}-${isoToday()}.csv`, serviceCsv(getServiceLog(profile)))}
          disabled={entries.length === 0}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          ⬇️ Export CSV
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No service entries yet — she logs them on her home screen.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5">
              <label className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-600" title="Approve locks the entry (official)">
                <input
                  type="checkbox"
                  checked={e.approved}
                  onChange={(ev) => toggle(e.id, ev.target.checked)}
                  className="h-4 w-4"
                />
                {e.approved ? 'locked' : 'approve'}
              </label>
              <span className="shrink-0 text-sm font-bold text-slate-700">{e.hours}h</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-800">{e.org}</span>
                <span className="block truncate text-xs text-slate-500">
                  {friendly(e.date)}
                  {e.note ? ` · ${e.note}` : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
