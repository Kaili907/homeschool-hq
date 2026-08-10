import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { AppState, Profile, VoiceSelection, VoiceSlot } from '../types'
import { SKILL_BY_ID } from '../skills'
import { updateProfile } from '../appState'
import {
  CACHE_MAX_BYTES,
  DEFAULT_MONTHLY_CAP,
  encodeVoiceRef,
  getVoiceAdapter,
  getVoiceCache,
  setVoiceMonthlyCap,
  speak,
  staticVoiceLines,
  useVoices,
  voiceUsageSnapshot,
} from '../tutor/voice'
import {
  VOICE_SLOTS,
  clearTutorFlag,
  flaggedSkills,
  getSlotSelection,
  hasLegacyPremiumSelection,
  getVoicePrefs,
  isMuted,
  isTeen,
  prewarmTargets,
  resolveSlotRef,
  setRate,
  setMuted,
  setVoiceSelection,
  setVoiceOptIn,
} from '../tutor/tutorState'
import { getVoiceCatalogAccess, type PublicVoiceCatalogEntry } from '../tutor/voiceCatalog'

type SetState = Dispatch<SetStateAction<AppState>>

const box = 'rounded-xl border border-slate-200 bg-white p-4'
const btn =
  'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50'
const inp = 'rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-800'

const SAMPLE = "Hi! Let's work it out together."

/** Global mute + premium-voice settings + the per-girl / per-subject voice grid. */
export function TutorControls({
  state,
  onStateChange,
}: {
  state: AppState
  onStateChange: SetState
}) {
  const voices = useVoices()
  const muted = isMuted(state)
  const [catalogVoices, setCatalogVoices] = useState<readonly PublicVoiceCatalogEntry[]>([])

  useEffect(() => {
    void getVoiceCatalogAccess().load().then((catalog) => setCatalogVoices(catalog.voices))
  }, [])

  // Functional per-profile writer (H1 contract): base derives from the updater's
  // `prev`, and a missing profile leaves state untouched.
  const patchProfile = (id: string, fn: (p: Profile) => Profile) =>
    onStateChange((prev) => (prev.profiles[id] ? updateProfile(prev, fn(prev.profiles[id])) : prev))

  return (
    <div className="space-y-3">
      <div className={`${box} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <div className="font-bold text-slate-800">Tutor voice</div>
          <div className="text-xs text-slate-500">
            Premium (ElevenLabs) with browser text-to-speech fallback · text is always shown too
          </div>
        </div>
        <button
          onClick={() => onStateChange((prev) => setMuted(prev, !isMuted(prev)))}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            muted
              ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
              : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          {muted ? '🔇 Voice muted (family)' : '🔊 Voice on (family)'}
        </button>
      </div>

      <PremiumVoicePanel state={state} />

      {voices.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          No system voices detected in this browser yet. The tutor still shows every step as
          text; Academy premium voices appear only when an approved deployment is available.
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
                Rate {prefs.rate.toFixed(2)}
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  value={prefs.rate}
                  onChange={(e) => patchProfile(p.id, (pp) => setRate(pp, Number(e.target.value)))}
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
                    onChange={(e) => patchProfile(p.id, (pp) => setVoiceOptIn(pp, e.target.checked))}
                  />
                  voice on
                </label>
              )}
            </div>

            <VoiceGrid
              profile={p}
              voices={voices}
              catalogVoices={catalogVoices}
              rate={prefs.rate}
              canPlay={!muted && prefs.enabled}
              onSlotChange={(slot, ref) => patchProfile(p.id, (pp) => setVoiceSelection(pp, slot, ref))}
            />
          </div>
        )
      })}
    </div>
  )
}

// ---------- per-girl, per-subject voice grid ----------

type CellRef = VoiceSelection

function VoiceGrid({
  profile,
  voices,
  catalogVoices,
  rate,
  canPlay,
  onSlotChange,
}: {
  profile: Profile
  voices: SpeechSynthesisVoice[]
  catalogVoices: readonly PublicVoiceCatalogEntry[]
  rate: number
  canPlay: boolean
  onSlotChange: (slot: VoiceSlot, ref: CellRef | undefined) => void
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
      {VOICE_SLOTS.map(({ slot, label, hint }) => (
        <SlotRow
          key={slot}
          slot={slot}
          slotLabel={label}
          slotHint={hint}
          profile={profile}
          voices={voices}
          catalogVoices={catalogVoices}
          rate={rate}
          canPlay={canPlay}
          onChange={(ref) => onSlotChange(slot, ref)}
        />
      ))}
    </div>
  )
}

function SlotRow({
  slot,
  slotLabel,
  slotHint,
  profile,
  voices,
  catalogVoices,
  rate,
  canPlay,
  onChange,
}: {
  slot: VoiceSlot
  slotLabel: string
  slotHint: string
  profile: Profile
  voices: SpeechSynthesisVoice[]
  catalogVoices: readonly PublicVoiceCatalogEntry[]
  rate: number
  canPlay: boolean
  onChange: (ref: CellRef | undefined) => void
}) {
  const current = getSlotSelection(profile, slot)
  const resolved = resolveSlotRef(profile, slot)
  const legacyPremium = hasLegacyPremiumSelection(profile, slot)
  const selectedValue = current?.kind === 'catalog'
    ? `catalog:${current.voiceRef}:${current.voiceVersion}`
    : current?.kind === 'browser' ? `browser:${current.voiceURI}` : ''

  const test = () => speak(SAMPLE, { voiceURI: encodeVoiceRef(resolved), rate })
  const select = (value: string) => {
    if (!value) return onChange(undefined)
    if (value.startsWith('browser:')) {
      const voiceURI = value.slice('browser:'.length)
      const voice = voices.find((candidate) => candidate.voiceURI === voiceURI)
      return onChange({ kind: 'browser', voiceURI, displayLabel: voice?.name ?? 'System voice' })
    }
    const entry = catalogVoices.find(
      (candidate) => `catalog:${candidate.voiceRef}:${candidate.voiceVersion}` === value,
    )
    if (entry) {
      onChange({
        kind: 'catalog',
        voiceRef: entry.voiceRef,
        voiceVersion: entry.voiceVersion,
        displayLabel: entry.displayLabel,
      })
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0">
      <div className="w-40">
        <div className="text-sm font-bold text-slate-700">{slotLabel}</div>
        <div className="text-[11px] text-slate-400">{slotHint}</div>
      </div>

      <select
        value={selectedValue}
        onChange={(event) => select(event.target.value)}
        className={`${inp} max-w-72`}
        aria-label={`${profile.name} ${slotLabel} voice`}
      >
        <option value="">{slot === 'default' ? 'System default' : 'Use default slot'}</option>
        <optgroup label="Browser voices">
          {voices.map((voice) => (
            <option key={voice.voiceURI} value={`browser:${voice.voiceURI}`}>
              {voice.name} ({voice.lang})
            </option>
          ))}
        </optgroup>
        <optgroup label="Academy premium catalog">
          {catalogVoices.filter((entry) => entry.status === 'active').map((entry) => (
            <option
              key={`${entry.voiceRef}:${entry.voiceVersion}`}
              value={`catalog:${entry.voiceRef}:${entry.voiceVersion}`}
              disabled={!entry.deploymentAvailable && !entry.cachedPlaybackAllowed}
            >
              {entry.displayLabel}{entry.deploymentAvailable ? '' : ' (cache only)'}
            </option>
          ))}
        </optgroup>
      </select>

      <button
        onClick={test}
        disabled={!canPlay}
        className={`${btn} disabled:opacity-40`}
        title={canPlay ? `Hear ${slotLabel}` : 'Voice is muted or off for this girl'}
      >
        ▶ Test
      </button>
      {current && (
        <button onClick={() => onChange(undefined)} className={btn} title="Clear this slot">
          ×
        </button>
      )}
      {legacyPremium && !current && (
        <span className="text-[11px] font-semibold text-amber-600">
          Legacy premium selection hidden · browser fallback
        </span>
      )}
      {!current && resolved && resolved.kind !== 'legacy' && (
        <span className="text-[11px] italic text-slate-400">↳ {resolved.displayLabel}</span>
      )}
    </div>
  )
}

// ---------- premium voice: key, usage + cap, cache, pre-warm ----------

function fmtMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function PremiumVoicePanel({ state }: { state: AppState }) {
  const [testMsg, setTestMsg] = useState('')
  const [usage, setUsage] = useState(() => voiceUsageSnapshot())
  const [capInput, setCapInput] = useState(String(usage.cap))
  const [cacheBytes, setCacheBytes] = useState<number | null>(null)
  const [prewarmMsg, setPrewarmMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const refreshUsage = () => setUsage(voiceUsageSnapshot())
  const refreshCache = () => {
    void getVoiceCache()
      .sizeBytes()
      .then(setCacheBytes)
      .catch(() => setCacheBytes(0))
  }
  useEffect(refreshCache, [])

  const targets = prewarmTargets(state)

  const testVoice = async () => {
    setTestMsg('Testing…')
    const target = targets[0]
    if (!target) {
      setTestMsg('Choose an available Academy premium voice below, then test.')
      return
    }
    const used = await getVoiceAdapter()
      .speak({ text: SAMPLE, voiceRef: target.voiceRef, voiceVersion: target.voiceVersion, rate: target.rate })
      .catch(() => 'none' as const)
    refreshUsage()
    refreshCache()
    setTestMsg(
      used === 'elevenlabs' || used === 'cache'
        ? '✓ Premium voice played.'
        : '⚠ Fell back to browser — check your sign-in, entitlement, and connection.',
    )
  }

  const saveCap = () => {
    const n = Math.max(0, Math.floor(Number(capInput) || 0))
    setVoiceMonthlyCap(n)
    refreshUsage()
  }

  const clearCache = () => {
    void getVoiceCache()
      .clear()
      .then(refreshCache)
      .catch(() => undefined)
  }

  const prewarm = async () => {
    if (!targets.length) return
    setBusy(true)
    const lines = staticVoiceLines()
    const adapter = getVoiceAdapter()
    let done = 0
    let skipped = 0
    const totalUnits = targets.length * lines.length
    for (const t of targets) {
      for (const line of lines) {
        setPrewarmMsg(`Downloading… ${done + skipped + 1}/${totalUnits}`)
        // eslint-disable-next-line no-await-in-loop
        const ok = await adapter
          .prewarmLine({ text: line, voiceRef: t.voiceRef, voiceVersion: t.voiceVersion, rate: t.rate })
          .catch(() => false)
        if (ok) done++
        else skipped++
      }
    }
    refreshUsage()
    refreshCache()
    setBusy(false)
    setPrewarmMsg(
      skipped > 0
        ? `Cached ${done} lines. ${skipped} skipped (signed out, offline, or over a usage cap).`
        : `Cached ${done} lines — static tutor lines now play offline in premium voice.`,
    )
  }

  const pct = usage.cap > 0 ? Math.min(100, Math.round((usage.chars / usage.cap) * 100)) : 0

  return (
    <div className={`${box} space-y-4`}>
      <div className="font-bold text-slate-800">Premium voice (ElevenLabs)</div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500">
          Premium synthesis uses the secured Academy gateway; no provider key is stored in this browser.
        </span>
        <button onClick={testVoice} disabled={targets.length === 0} className={`${btn} disabled:opacity-40`}>
          ▶ Test premium voice
        </button>
        {testMsg && <span className="text-xs font-semibold text-slate-600">{testMsg}</span>}
      </div>

      {/* usage + cap */}
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500">
            This month ({usage.month}): {usage.chars.toLocaleString()} /{' '}
            {usage.cap.toLocaleString()} characters
          </span>
          <label className="flex items-center gap-1 text-xs font-semibold text-slate-500">
            Monthly cap
            <input
              value={capInput}
              onChange={(e) => setCapInput(e.target.value)}
              inputMode="numeric"
              className={`${inp} w-24`}
              aria-label="monthly character cap"
            />
            <button onClick={saveCap} className={btn}>
              Set
            </button>
          </label>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${usage.browserOnly ? 'bg-rose-400' : 'bg-emerald-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {usage.browserOnly && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-semibold text-amber-800">
            Monthly cap reached — the tutor is on browser voices for the rest of the month. Raise
            the cap to resume premium voices. (The girls never see this.)
          </div>
        )}
        <div className="text-[11px] text-slate-400">
          Default cap {DEFAULT_MONTHLY_CAP.toLocaleString()} · resets on the 1st.
        </div>
      </div>

      {/* cache + pre-warm */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500">
          Offline cache: {cacheBytes === null ? '…' : fmtMB(cacheBytes)} / {fmtMB(CACHE_MAX_BYTES)}
        </span>
        <button onClick={clearCache} className={btn}>
          Clear cache
        </button>
        <button
          onClick={prewarm}
          disabled={busy || targets.length === 0}
          className={`${btn} disabled:opacity-40`}
          title={
            targets.length === 0
              ? 'Choose at least one available Academy premium voice first'
              : 'Synthesize & cache every static tutor line for offline use'
          }
        >
          ⬇️ Download voices for offline
        </button>
        {prewarmMsg && <span className="text-xs font-semibold text-slate-600">{prewarmMsg}</span>}
      </div>
    </div>
  )
}

/** "Needs Dad" flags raised by the escalation rule; each gates a skill until cleared. */
export function NeedsDadFlags({
  state,
  onStateChange,
}: {
  state: AppState
  onStateChange: SetState
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
              onStateChange((prev) =>
                prev.profiles[profile.id]
                  ? updateProfile(prev, clearTutorFlag(prev.profiles[profile.id], skillId))
                  : prev,
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
