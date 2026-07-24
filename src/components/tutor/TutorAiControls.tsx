import { useState, type Dispatch, type SetStateAction } from 'react'
import type { AppState, Profile } from '../../types'
import { isoToday, updateProfile } from '../../appState'
import { clearTutorKey, getTutorKey, maskTutorKey, setTutorKey } from '../../tutor/tutorApi'
import { DEFAULT_DAILY_CAP } from '../../tutor/tutorEngine'
import { dailyCap, setDailyCap } from '../../tutor/tutorChat'
import { TutorChatsView } from './TutorChatsView'

const box = 'rounded-xl border border-slate-200 bg-white p-4'

/**
 * Grown-Ups "AI Tutor" controls: the masked Anthropic key (stored OUTSIDE AppState
 * so it never exports), the per-profile daily cap, and each girl's chat transcripts.
 * onStateChange is the functional AppState writer (CLAUDE.md rule 6).
 */
export function TutorAiControls({
  state,
  onStateChange,
}: {
  state: AppState
  onStateChange: Dispatch<SetStateAction<AppState>>
}) {
  const today = isoToday()
  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState<string | null>(getTutorKey())
  const [open, setOpen] = useState<string | null>(null)

  const save = () => {
    setTutorKey(draft)
    setSaved(getTutorKey())
    setDraft('')
  }
  const clear = () => {
    clearTutorKey()
    setSaved(null)
  }
  const setCap = (p: Profile, n: number) =>
    onStateChange((s) => (s.profiles[p.id] ? updateProfile(s, setDailyCap(s.profiles[p.id], n)) : s))

  return (
    <div className="space-y-3">
      {/* API key */}
      <div className={box}>
        <div className="font-bold text-slate-800">Anthropic API key</div>
        <div className="mt-0.5 text-xs text-slate-500">
          Stored on this device only, never in a backup export, never sent anywhere except Anthropic.
          The AI tutor is optional — the app works fully without it.
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={saved ? 'Enter a new key to replace' : 'sk-ant-…'}
            aria-label="Anthropic API key"
            className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-sm text-slate-800"
          />
          <button
            onClick={save}
            disabled={!draft.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            Save key
          </button>
          {saved && (
            <button
              onClick={clear}
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              Remove
            </button>
          )}
          <span className="text-xs font-semibold text-slate-500">
            {saved ? `Key set · ${maskTutorKey(saved)}` : 'No key — tutor napping'}
          </span>
        </div>
      </div>

      {/* per-profile cap + transcripts */}
      {Object.values(state.profiles).map((p) => {
        const expanded = open === p.id
        return (
          <div key={p.id} className={box}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-32 font-bold text-slate-800">{p.name}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                Grade {p.grade}
              </span>
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                Daily tutor cap
                <input
                  type="number"
                  min={0}
                  value={dailyCap(p)}
                  onChange={(e) => setCap(p, Number(e.target.value))}
                  className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-800"
                  aria-label={`daily tutor cap for ${p.name}`}
                />
                <span className="text-slate-400">(default {DEFAULT_DAILY_CAP})</span>
              </label>
              <button
                onClick={() => setOpen(expanded ? null : p.id)}
                className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                {expanded ? 'Hide chats' : 'Tutor chats'}
              </button>
            </div>
            {expanded && (
              <div className="mt-3">
                <TutorChatsView profile={p} today={today} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
