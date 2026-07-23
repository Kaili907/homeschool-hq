import { useRef, useState } from 'react'
import type { AppState, Profile } from '../types'
import {
  downloadJson,
  exportAllBackup,
  importBackup,
  listV1BackupKeys,
  readLocalStorageKey,
} from '../appState'
import { emptyProfile, SCHEMA_VERSION } from '../migration'

interface GrownUpsProps {
  state: AppState
  onStateChange: (s: AppState) => void
  onClose: () => void
  onChangeParentPin: () => void
}

export function GrownUps({ state, onStateChange, onClose, onChangeParentPin }: GrownUpsProps) {
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const backupKeys = listV1BackupKeys()

  function patchProfile(p: Profile) {
    onStateChange({ ...state, profiles: { ...state.profiles, [p.id]: p } })
  }

  function resetProgress(p: Profile) {
    if (!window.confirm(`Erase ALL progress for ${p.name}? This cannot be undone.`)) return
    if (!window.confirm(`Really sure? ${p.name}'s mastery, streaks and missions will be wiped.`)) return
    const fresh = emptyProfile(p.id, p.name, p.grade)
    patchProfile({ ...fresh, pin: p.pin, theme: p.theme, createdAt: p.createdAt })
    setMsg(`${p.name}'s progress was reset.`)
  }

  function handleImport(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    file.text().then((text) => {
      const result = importBackup(state, text)
      if (!result.ok) {
        setMsg(`❌ ${result.error}`)
      } else if (
        window.confirm(`${result.note}\n\nThis will overwrite current data. Continue?`)
      ) {
        onStateChange(result.state)
        setMsg(`✅ ${result.note}`)
      }
      if (fileRef.current) fileRef.current.value = ''
    })
  }

  const masteredCount = (p: Profile) =>
    Object.values(p.skills).filter((s) => s && s.attempts > 0 && s.mastery >= 75).length

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">🔒 Grown-Ups panel</h1>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Done
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Schema v{SCHEMA_VERSION} · all data lives on this device · export a backup regularly
        </p>
        {msg && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">
            {msg}
          </div>
        )}

        {/* profiles */}
        <h2 className="mt-6 mb-2 text-lg font-bold text-slate-800">Profiles</h2>
        <div className="space-y-3">
          {Object.values(state.profiles).map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={p.name}
                  onChange={(e) => patchProfile({ ...p, name: e.target.value })}
                  className="w-40 rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-800"
                  aria-label={`name for ${p.id}`}
                />
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  Grade {p.grade} · {p.theme}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {p.pin ? 'PIN set' : 'no PIN yet'} · {masteredCount(p)} skills mastered ·{' '}
                  {p.totals.questionsAnswered} questions all-time
                </span>
                <span className="ml-auto flex gap-2">
                  {p.pin && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Clear ${p.name}'s PIN? She'll choose a new one at next sign-in.`))
                          patchProfile({ ...p, pin: '' })
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Clear PIN
                    </button>
                  )}
                  <button
                    onClick={() => resetProgress(p)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    Reset progress
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* backup */}
        <h2 className="mt-6 mb-2 text-lg font-bold text-slate-800">Backup</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              exportAllBackup(state)
              setMsg('✅ Exported all five profiles to one JSON file.')
            }}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            ⬇️ Export ALL profiles (JSON)
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
            onClick={onChangeParentPin}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Change parent PIN
          </button>
        </div>

        {/* migration snapshots */}
        {backupKeys.length > 0 && (
          <>
            <h2 className="mt-6 mb-2 text-lg font-bold text-slate-800">Migration snapshots</h2>
            <div className="space-y-2">
              {backupKeys.map((k) => (
                <div
                  key={k}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-xs"
                >
                  <code className="text-slate-500">{k}</code>
                  <button
                    onClick={() => {
                      const raw = readLocalStorageKey(k)
                      if (raw) downloadJson(`${k.replaceAll(':', '_')}.json`, raw)
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
