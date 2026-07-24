import type { AppState, Grade, NeedsDadFlag, Profile, VoiceRef, VoiceSlot, WalkthroughEvent } from '../types'
import type { SkillId } from '../skills'
import { encodeVoiceRef } from './voice'

/**
 * MT-1 tutor state: pure helpers over the additive optional Profile/AppState
 * fields (see types.ts). No schemaVersion bump — every read defaults gracefully.
 */

// escalation thresholds (Tutor-Addendum-v2-1 §MT-1)
export const SESSION_ESCALATION = 3 // 3+ same-skill walkthroughs in one session
export const WEEK_ESCALATION = 5 //   or 5+ in a week
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const LOG_PRUNE_MS = 21 * 24 * 60 * 60 * 1000 // keep a little over a fortnight

// ---------- voice prefs ----------

export const isTeen = (grade: Grade): boolean => grade === '10' || grade === '12'

/** Voice a little slower for the littles; normal for the olders. */
export function defaultRate(grade: Grade): number {
  if (grade === '3') return 0.8
  if (grade === '4') return 0.85
  return 1
}

export interface ResolvedVoicePrefs {
  voiceURI?: string
  rate: number
  /** teens are text-first: voice plays only if they opted in. */
  enabled: boolean
  voiceOptIn: boolean
}

export function getVoicePrefs(p: Profile): ResolvedVoicePrefs {
  const t = p.tutor ?? {}
  const voiceOptIn = t.voiceOptIn ?? false
  return {
    // MT-V: the math tutor speaks the walkthrough, so resolve that slot (→ default →
    // legacy voiceURI) and encode the provider into voiceURI. Walkthrough/QuizSession
    // forward this untouched; the speak-layer adapter decodes it (`el:` = ElevenLabs).
    voiceURI: encodeVoiceRef(resolveSlotRef(p, 'mathTutor')),
    rate: t.rate ?? defaultRate(p.grade),
    voiceOptIn,
    enabled: isTeen(p.grade) ? voiceOptIn : true,
  }
}

export function setVoiceURI(p: Profile, voiceURI: string | undefined): Profile {
  return { ...p, tutor: { ...p.tutor, voiceURI } }
}

// ---------- MT-V per-girl, per-subject voice map ----------

/** Slot metadata for the Grown-Ups grid (order + labels). */
export const VOICE_SLOTS: { slot: VoiceSlot; label: string; hint: string }[] = [
  { slot: 'mathTutor', label: 'Math tutor', hint: 'walkthroughs & daily practice' },
  { slot: 'mindset', label: 'Mindset', hint: 'read-aloud lessons (arrives with MM)' },
  { slot: 'assistant', label: 'HS assistant', hint: 'the teen home assistant (MJ)' },
  { slot: 'japanese', label: 'Japanese', hint: 'hiragana trainer (coming soon)' },
  { slot: 'default', label: 'Default', hint: 'backs every unset slot' },
]

/** The voice mapped DIRECTLY to a slot (no fall-through) — for editing UI. */
export function getSlotRef(p: Profile, slot: VoiceSlot): VoiceRef | undefined {
  return p.tutor?.voiceMap?.[slot]
}

/**
 * The voice a slot RESOLVES to, applying fall-through:
 * slot → `default` slot → legacy MT-1 single voice (browser) → undefined (browser default).
 */
export function resolveSlotRef(p: Profile, slot: VoiceSlot): VoiceRef | undefined {
  const map = p.tutor?.voiceMap
  const direct = map?.[slot]
  if (direct) return direct
  if (slot !== 'default' && map?.default) return map.default
  const legacy = p.tutor?.voiceURI
  if (legacy) return { provider: 'browser', ref: legacy, label: 'System voice' }
  return undefined
}

/** Set (or clear, when `ref` is undefined) one slot. Additive — no schema bump. */
export function setSlotRef(p: Profile, slot: VoiceSlot, ref: VoiceRef | undefined): Profile {
  const map: Partial<Record<VoiceSlot, VoiceRef>> = { ...(p.tutor?.voiceMap ?? {}) }
  if (ref && ref.ref.trim()) map[slot] = ref
  else delete map[slot]
  const nextMap = Object.keys(map).length ? map : undefined
  return { ...p, tutor: { ...p.tutor, voiceMap: nextMap } }
}

/**
 * Migrate an MT-1 single voice into the `default` slot (once). No-op if there is
 * no legacy voice or a `default` slot already exists. Keeps `voiceURI` in place so
 * resolution stays correct even before this runs.
 */
export function migrateLegacyVoiceToDefault(p: Profile): Profile {
  const t = p.tutor
  if (!t?.voiceURI || t.voiceMap?.default) return p
  return setSlotRef(p, 'default', { provider: 'browser', ref: t.voiceURI, label: 'System voice' })
}

/**
 * Distinct ElevenLabs (encoded voiceRef, rate) pairs currently mapped to a spoken
 * slot across the family — the set "Download voices for offline" pre-warms.
 */
export function prewarmTargets(state: AppState): { voiceRef: string; rate: number; label: string }[] {
  const seen = new Set<string>()
  const out: { voiceRef: string; rate: number; label: string }[] = []
  for (const p of Object.values(state.profiles)) {
    const rate = getVoicePrefs(p).rate
    for (const slot of ['mathTutor', 'assistant', 'default'] as VoiceSlot[]) {
      const ref = resolveSlotRef(p, slot)
      if (!ref || ref.provider !== 'elevenlabs') continue
      const encoded = encodeVoiceRef(ref)
      if (!encoded) continue
      const dkey = `${encoded}|${rate}`
      if (seen.has(dkey)) continue
      seen.add(dkey)
      out.push({ voiceRef: encoded, rate, label: ref.label })
    }
  }
  return out
}

export function setRate(p: Profile, rate: number): Profile {
  return { ...p, tutor: { ...p.tutor, rate } }
}

export function setVoiceOptIn(p: Profile, voiceOptIn: boolean): Profile {
  return { ...p, tutor: { ...p.tutor, voiceOptIn } }
}

// ---------- global mute ----------

export const isMuted = (state: AppState): boolean => state.tutorMuted === true

export function setMuted(state: AppState, muted: boolean): AppState {
  return { ...state, tutorMuted: muted }
}

// ---------- escalation / Needs-Dad flags ----------

export const isSkillGated = (p: Profile, skillId: SkillId): boolean => !!p.tutorFlags?.[skillId]

export function flaggedSkills(p: Profile): { skillId: SkillId; flag: NeedsDadFlag }[] {
  const flags = p.tutorFlags ?? {}
  return (Object.keys(flags) as SkillId[])
    .filter((id) => flags[id])
    .map((id) => ({ skillId: id, flag: flags[id]! }))
}

const countFor = (log: WalkthroughEvent[], skillId: SkillId, sinceTs: number): number =>
  log.filter((e) => e.skillId === skillId && e.ts >= sinceTs).length

/**
 * Record that a wrong-answer walkthrough was viewed for `skillId`, then apply the
 * escalation rule: 3+ in this session (events at/after `sessionStart`) or 5+ in
 * the past week raises a "Needs Dad" flag that gates the skill from practice.
 * `ts`/`day`/`sessionStart` are injected so this stays pure and testable.
 */
export function logWalkthrough(
  p: Profile,
  skillId: SkillId,
  ts: number,
  sessionStart: number,
  day: string,
): Profile {
  const prior = (p.walkthroughLog ?? []).filter((e) => e.ts >= ts - LOG_PRUNE_MS)
  const log: WalkthroughEvent[] = [...prior, { skillId, ts, day }]

  const sessionCount = countFor(log, skillId, sessionStart)
  const weekCount = countFor(log, skillId, ts - WEEK_MS)

  let tutorFlags = p.tutorFlags
  const alreadyFlagged = !!tutorFlags?.[skillId]
  if (!alreadyFlagged && (sessionCount >= SESSION_ESCALATION || weekCount >= WEEK_ESCALATION)) {
    const reason =
      sessionCount >= SESSION_ESCALATION
        ? `${sessionCount} walkthroughs this session`
        : `${weekCount} walkthroughs this week`
    tutorFlags = {
      ...tutorFlags,
      [skillId]: { since: day, reason, sessionCount, weekCount } satisfies NeedsDadFlag,
    }
  }
  return { ...p, walkthroughLog: log, tutorFlags }
}

/** Dad clears the flag after a reteach; drop this skill's events so it resets. */
export function clearTutorFlag(p: Profile, skillId: SkillId): Profile {
  const flags = { ...(p.tutorFlags ?? {}) }
  delete flags[skillId]
  const log = (p.walkthroughLog ?? []).filter((e) => e.skillId !== skillId)
  return { ...p, tutorFlags: flags, walkthroughLog: log }
}
