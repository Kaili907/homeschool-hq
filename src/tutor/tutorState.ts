import type { AppState, Grade, NeedsDadFlag, Profile, WalkthroughEvent } from '../types'
import type { SkillId } from '../skills'

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
    voiceURI: t.voiceURI,
    rate: t.rate ?? defaultRate(p.grade),
    voiceOptIn,
    enabled: isTeen(p.grade) ? voiceOptIn : true,
  }
}

export function setVoiceURI(p: Profile, voiceURI: string | undefined): Profile {
  return { ...p, tutor: { ...p.tutor, voiceURI } }
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
