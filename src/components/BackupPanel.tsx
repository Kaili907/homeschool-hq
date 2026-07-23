import { useRef, useState } from 'react'
import type { Profile } from '../types'
import { exportBackup, parseBackup, resetProfile } from '../storage'

interface BackupPanelProps {
  profile: Profile
  onProfileChange: (p: Profile) => void
}

export function BackupPanel({ profile, onProfileChange }: BackupPanelProps) {
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleImport(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    file.text().then((text) => {
      const p = parseBackup(text)
      if (p) {
        onProfileChange(p)
        setMsg('✅ Backup loaded!')
      } else {
        setMsg('❌ That file is not a valid Homeschool HQ backup.')
      }
      if (fileRef.current) fileRef.current.value = ''
    })
  }

  return (
    <div className="rounded-3xl bg-white/70 p-4 shadow">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left text-sm font-extrabold text-slate-600"
      >
        {open ? '▾' : '▸'} Grown-ups: backup & settings
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-bold text-slate-600" htmlFor="learner-name">
              Learner name:
            </label>
            <input
              id="learner-name"
              value={profile.name}
              onChange={(e) => onProfileChange({ ...profile, name: e.target.value })}
              className="rounded-xl border-2 border-violet-200 bg-white px-3 py-1 font-bold text-slate-800"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => exportBackup(profile)}
              className="rounded-2xl bg-violet-600 px-4 py-2 text-sm font-extrabold text-white shadow hover:bg-violet-700"
            >
              ⬇️ Export backup (JSON)
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-extrabold text-white shadow hover:bg-sky-700"
            >
              ⬆️ Import backup
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => handleImport(e.target.files)}
            />
            <button
              onClick={() => {
                if (window.confirm('Really erase ALL progress and start over? Export a backup first!')) {
                  onProfileChange(resetProfile())
                  setMsg('Profile reset.')
                }
              }}
              className="rounded-2xl bg-rose-100 px-4 py-2 text-sm font-extrabold text-rose-700 shadow hover:bg-rose-200"
            >
              🗑️ Reset progress
            </button>
          </div>
          {msg && <div className="text-sm font-bold text-slate-600">{msg}</div>}
          <div className="text-xs text-slate-400">
            Everything is saved on this device (localStorage). Export a backup before switching computers.
          </div>
        </div>
      )}
    </div>
  )
}
