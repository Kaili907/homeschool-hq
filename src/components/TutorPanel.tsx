import type { Dispatch, SetStateAction } from 'react'
import type { AppState, Profile } from '../types'
import { SKILL_BY_ID } from '../skills'
import { updateProfile } from '../appState'
import { useVoices, speak } from '../tutor/voice'
import {
  clearTutorFlag,
  flaggedSkills,
  getVoicePrefs,
  isMuted,
  isTeen,
  setMuted,
  setRate,
  setVoiceOptIn,
  setVoiceURI,
} from '../tutor/tutorState'

const box = 'rounded-xl border border-slate-200 bg-white p-4'
const btn =
  'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50'

/** Global mute + per-profile voice picker, rate and teen opt-in. */
export function TutorControls({
  state,
  onStateChange,
}: {
  state: AppState
  onStateChange: Dispatch<SetStateAction<AppState>>
}) {
  const voices = useVoices()
  const muted = isMuted(state)
  // Voice-pref writes derive from the latest committed profile so they compose.
  const patch = (id: string, fn: (prev: Profile) => Profile) =>
    onStateChange((s) => (s.profiles[id] ? updateProfile(s, fn(s.profiles[id])) : s))

  return (
    <div className="space-y-3">
      <div className={`${box} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <div className="font-bold text-slate-800">Tutor voice</div>
          <div className="text-xs text-slate-500">
            Browser text-to-speech · text is always shown too · works offline
          </div>
        </div>
        <button
          onClick={() => onStateChange((s) => setMuted(s, !isMuted(s)))}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            muted
              ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
              : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          {muted ? '🔇 Voice muted (family)' : '🔊 Voice on (family)'}
        </button>
      </div>

      {voices.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          No system voices detected in this browser yet. The tutor still shows every
          step as text; if voices load, they'll appear here.
        </div>
      )}

      {Object.values(state.profiles).map((p) => {
        const prefs = getVoicePrefs(p)
        return (
          <div key={p.id} className={box}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-32 font-bold text-slate-800">{p.name}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                Grade {p.grade}
              </span>
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                Voice
                <select
                  value={prefs.voiceURI ?? ''}
                  onChange={(e) => patch(p.id, (prev) => setVoiceURI(prev, e.target.value || undefined))}
                  className="max-w-52 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-800"
                  aria-label={`voice for ${p.name}`}
                >
                  <option value="">System default</option>
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                Rate {prefs.rate.toFixed(2)}
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  value={prefs.rate}
                  onChange={(e) => patch(p.id, (prev) => setRate(prev, Number(e.target.value)))}
                  aria-label={`voice rate for ${p.name}`}
                />
              </label>
              {isTeen(p.grade) && (
                <label
                  className="flex items-center gap-1 text-xs font-semibold text-slate-500"
                  title="Teens are text-first; turn this on to let the tutor speak."
                >
                  <input
                    type="checkbox"
                    checked={prefs.voiceOptIn}
                    onChange={(e) => patch(p.id, (prev) => setVoiceOptIn(prev, e.target.checked))}
                  />
                  voice on
                </label>
              )}
              <button
                onClick={() =>
                  speak(`Hi ${p.name}, I'm your practice tutor. Let's work it out together.`, {
                    voiceURI: prefs.voiceURI,
                    rate: prefs.rate,
                  })
                }
                disabled={muted || !prefs.enabled}
                className={`${btn} disabled:opacity-40`}
                title={
                  muted
                    ? 'Voice is muted for the family'
                    : !prefs.enabled
                      ? 'Turn on "voice on" to hear the teen tutor'
                      : 'Hear a sample'
                }
              >
                ▶ Test
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** "Needs Dad" flags raised by the escalation rule; each gates a skill until cleared. */
export function NeedsDadFlags({
  state,
  onStateChange,
}: {
  state: AppState
  onStateChange: Dispatch<SetStateAction<AppState>>
}) {
  const rows = Object.values(state.profiles).flatMap((p) =>
    flaggedSkills(p).map((f) => ({ profile: p, ...f })),
  )

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        ✅ No skills need review right now. If a girl needs the same walkthrough 3+ times in
        a session (or 5+ in a week), that skill lands here and pauses in her practice until you
        clear it.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {rows.map(({ profile, skillId, flag }) => (
        <div
          key={`${profile.id}-${skillId}`}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
        >
          <div>
            <div className="font-bold text-amber-900">
              {profile.name} · {SKILL_BY_ID[skillId]?.name ?? skillId}
            </div>
            <div className="text-xs font-semibold text-amber-700">
              {flag.reason} · flagged {flag.since} · paused in practice
            </div>
          </div>
          <button
            onClick={() =>
              onStateChange((s) =>
                s.profiles[profile.id]
                  ? updateProfile(s, clearTutorFlag(s.profiles[profile.id], skillId))
                  : s,
              )
            }
            className="rounded-lg border border-emerald-300 bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-200"
          >
            Cleared — we reviewed it ✅
          </button>
        </div>
      ))}
    </div>
  )
}
