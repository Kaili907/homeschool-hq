import type { SkillId } from './skills'
import type { AssessmentState } from './assessment/types'

// ---------- questions (unchanged from v1) ----------

export type Difficulty = 1 | 2 | 3

export type Visual =
  | { kind: 'clock'; h: number; m: number }
  | { kind: 'fraction'; num: number; den: number }
  | { kind: 'fractionPair'; a: [number, number]; b: [number, number] }
  | { kind: 'rect'; w: number; h: number; labels: boolean }
  | { kind: 'numberLine'; min: number; max: number; value: number }
  | { kind: 'coordGrid'; x: number; y: number }
  | { kind: 'ratioTable'; headers: [string, string]; rows: [string, string][] }
  | { kind: 'angle'; degrees: number }

export interface Question {
  skillId: SkillId
  difficulty: Difficulty
  prompt: string
  visual?: Visual
  choices: string[]
  answerIndex: number
}

export interface AnswerRecord {
  question: Question
  chosenIndex: number
  correct: boolean
}

export type SkillStatus = 'mastered' | 'developing' | 'not-started'

// ---------- schema v2 (M1 multi-profile) ----------

export type ISODate = string // YYYY-MM-DD

export type Grade = '3' | '4' | '6' | '10' | '12'
export type ThemeId = 'playful' | 'cool' | 'clean'

export interface SkillState {
  attempts: number
  correct: number
  /** 0–100 rolling mastery estimate */
  mastery: number
  lastSeen?: ISODate
}

export interface MissionItem {
  id: string
  label: string
  done: boolean
  /** auto items flip when the linked in-app activity completes */
  auto?: boolean
}

export interface MissionDay {
  items: MissionItem[]
}

export interface MissionTemplateItem {
  id: string
  label: string
  auto?: boolean
}

/** Per-profile mission schedule. Friday is the light-day variant. */
export interface MissionTemplate {
  weekday: MissionTemplateItem[]
  friday: MissionTemplateItem[]
}

export interface Streaks {
  current: number
  best: number
  lastActiveDate: ISODate | ''
}

export interface ProfileTotals {
  questionsAnswered: number
  correct: number
  bestStreak: number
  sessions: number
}

// ---------- M4 high school mode (all additive & optional; no schema bump) ----------

/** Rolling practice tally for one HS unit (geometry unit or algebra topic). */
export interface HsUnitStat {
  attempts: number
  correct: number
  lastSeen?: ISODate
}

/** One tickable unit inside a manually-tracked course. */
export interface CourseUnit {
  id: string
  label: string
  done: boolean
}

/** A whole-year course whose units Dad or the girl checks off (English, Science, …). */
export interface CourseTrack {
  id: string
  name: string
  units: CourseUnit[]
}

/** A senior's college-application to-do with an optional due date. */
export interface CollegeTask {
  id: string
  label: string
  /** ISO date, or '' for no due date. */
  due: ISODate | ''
  done: boolean
}

// ---------- MS star economy (additive, all OPTIONAL; no schemaVersion bump) ----------

/** Where a ledger entry came from. Auto-earn sources are subject to the daily cap;
 * manual grants and redemptions are not. */
export type StarEventSource =
  | 'practice-session'
  | 'accuracy-bonus'
  | 'tutor-retry'
  | 'mission-complete'
  | 'weekly-streak'
  | 'manual-grant'
  | 'redeem'

/** Auto-earn sources counted against the 25/day cap. */
export const AUTO_EARN_SOURCES: StarEventSource[] = [
  'practice-session',
  'accuracy-bonus',
  'tutor-retry',
  'mission-complete',
  'weekly-streak',
]

/** One append-only ledger row. Positive = earned/granted, negative = redeemed.
 * Ledger is never edited or deleted; balance must always equal the ledger sum. */
export interface LedgerEntry {
  id: string
  /** ISO timestamp (full precision) */
  at: string
  /** local calendar day of the entry, for daily-cap accounting */
  day: ISODate
  amount: number
  /** kid-readable ("Tue — finished practice ⭐8") */
  reason: string
  source: StarEventSource
}

/** A prize the kid has asked for, awaiting Dad's approval. The cost/name/emoji are
 * snapshotted at request time so an in-flight save's price can never change under her. */
export interface PendingRedemption {
  id: string
  prizeId: string
  name: string
  emoji: string
  cost: number
  requestedAt: string
}

/** Per-profile star wallet. Present only on star-enabled profiles. */
export interface StarState {
  balance: number
  lifetimeEarned: number
  ledger: LedgerEntry[]
  pendingRedemptions: PendingRedemption[]
}

/** A real-world prize, Dad-edited in the Grown-Ups panel. Global (shared list). */
export interface Prize {
  id: string
  name: string
  emoji: string
  cost: number
  active: boolean
}

/** The Dad-editable earning table + caps. Global. */
export interface StarRates {
  practiceSession: number
  /** paid on top of practiceSession when the session is ≥80% accurate */
  accuracyBonus: number
  /** paid per walkthrough-assisted retry solved correctly */
  tutorRetry: number
  /** per-day ceiling on tutor-retry stars */
  tutorRetryDailyMax: number
  missionComplete: number
  /** paid once per week when the 4th mission day completes */
  weeklyStreak: number
  /** mission days in a week that unlock the weekly bonus */
  weeklyStreakThreshold: number
  /** hard ceiling on auto-earned stars per day */
  dailyCap: number
}

/** App-level star config: the shared prize list + earning table. */
export interface StarsConfig {
  prizes: Prize[]
  rates: StarRates
}

export interface Profile {
  id: string
  name: string
  grade: Grade
  /** 4-digit, kid-chosen. '' = not set yet (first sign-in creates it). */
  pin: string
  theme: ThemeId
  skills: Partial<Record<SkillId, SkillState>>
  missions: Record<ISODate, MissionDay>
  /** additive (M2): undefined = use the grade default template */
  template?: MissionTemplate
  streaks: Streaks
  createdAt: string
  // carried forward from v1 — the trainer still uses these
  placementDone: boolean
  totals: ProfileTotals
  lastPracticeDate?: ISODate
  /** additive (MA): fixed-form assessments. undefined = none assigned/taken yet. */
  assessments?: AssessmentState
  // ---- M4 (high-school mode) additive fields; undefined until first HS view ----
  /** per-unit HS practice stats, keyed by geometry-unit / algebra-topic id */
  hsStats?: Record<string, HsUnitStat>
  /** manual whole-year course progress checklists */
  courses?: CourseTrack[]
  /** senior's Dad-editable college-application task list */
  collegeTasks?: CollegeTask[]

  // ---------- MT-1 tutor (additive, all OPTIONAL, runtime defaults; no schemaVersion bump) ----------
  /** per-profile voice picker + rate; undefined = grade default (see tutor/tutorState). */
  tutor?: TutorPrefs
  /** skills flagged "Needs Dad" by the escalation rule; presence gates the skill from practice. */
  tutorFlags?: Partial<Record<SkillId, NeedsDadFlag>>
  /** rolling walkthrough events, used for the session/weekly escalation counts. Pruned by age. */
  walkthroughLog?: WalkthroughEvent[]

  // ---------- MS star economy (additive, OPTIONAL) ----------
  /** the kid's star wallet; undefined until her first star is earned. */
  stars?: StarState
  /** grade-6 "cool" opt-in: shows subtle star UI. Undefined/false = no stars. */
  coolStars?: boolean
}

/**
 * MT-V voice providers. `browser` = system speechSynthesis (always available, the
 * fallback). `elevenlabs` = premium REST voices. Azure may join later for the
 * `japanese` slot (see Voice-Addendum v2.5); the enum is intentionally open to grow.
 */
export type VoiceProviderId = 'elevenlabs' | 'browser'

/**
 * MT-V per-subject voice slots. `default` backs every unset slot (fall-through);
 * `japanese` exists now but is unused until the hiragana trainer ships.
 */
export type VoiceSlot = 'mathTutor' | 'mindset' | 'japanese' | 'default'

/** One mapped voice: which provider + its ref (ElevenLabs voice id, or a browser voiceURI) + a friendly label. */
export interface VoiceRef {
  provider: VoiceProviderId
  /** ElevenLabs voice id when provider==='elevenlabs'; SpeechSynthesisVoice.voiceURI when 'browser'. */
  ref: string
  /** Dad-facing label shown in the grid (e.g. "Rachel — warm"). */
  label: string
}

/** MT-1 per-profile voice settings. All optional so an old profile just uses defaults. */
export interface TutorPrefs {
  /** SpeechSynthesisVoice.voiceURI the family chose for this girl (MT-1 single voice). */
  voiceURI?: string
  /** playback rate; littles default slower. */
  rate?: number
  /** teens are text-first: voice only plays if they opt in. */
  voiceOptIn?: boolean
  /**
   * MT-V per-subject voice map (additive; no schema bump). Unset slots fall
   * through to `default`, then to the legacy `voiceURI` (browser), then the
   * browser default. An MT-1 single voice migrates into the `default` slot.
   */
  voiceMap?: Partial<Record<VoiceSlot, VoiceRef>>
}

/** One "Needs Dad" flag: the skill is gated from practice until Dad clears it. */
export interface NeedsDadFlag {
  since: ISODate
  /** why it tripped, for the parent dashboard. */
  reason: string
  /** counts at the moment it tripped (display only). */
  sessionCount: number
  weekCount: number
}

export interface WalkthroughEvent {
  skillId: SkillId
  /** epoch ms; used for "3+ this session" (>= session start) and "5+ this week". */
  ts: number
  day: ISODate
}

export interface AppState {
  /** bump on every breaking change; document in MIGRATIONS.md */
  schemaVersion: 2
  profiles: Record<string, Profile>
  activeProfileId: string | null
  /** gates the Grown-Ups panel. '' = not set yet. */
  parentPin: string
  /** MT-1: family-wide tutor voice mute (additive, optional; undefined = not muted). */
  tutorMuted?: boolean
  /** MS: shared prize list + earning table (additive, optional; undefined = defaults). */
  stars?: StarsConfig
}

// ---------- schema v1 (legacy, for migration only) ----------

export interface V1Profile {
  version: 1
  name: string
  createdAt: string
  placementDone: boolean
  skillStats: Partial<Record<SkillId, { attempts: number; correct: number; mastery: number }>>
  totals: ProfileTotals
  lastPracticeDate?: string
}
