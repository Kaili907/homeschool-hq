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

/** ISO weekday number, Monday…Friday (school days). */
export type Weekday = 1 | 2 | 3 | 4 | 5

/**
 * SE-B: which in-app activity flips an `auto` mission item.
 *  - 'math'    — the daily math practice/placement session (legacy default; an
 *                `auto` item with no autoKind is treated as 'math' for back-compat).
 *  - 'typing'  — a finished 5-minute typing drill (SE-A trainer).
 *  - 'reading' / 'mindset' — LEAVE HOOKS for the MR/MM modules; the plumbing
 *    (autoCompleteReading / autoCompleteMindset in missions.ts) exists but is not
 *    wired from App until those modules land on master (see missions.ts item 4).
 */
export type AutoKind = 'math' | 'typing' | 'reading' | 'mindset'

export interface MissionItem {
  id: string
  label: string
  done: boolean
  /** auto items flip when the linked in-app activity completes */
  auto?: boolean
  /** which activity auto-checks this item; undefined + auto === 'math' (legacy). */
  autoKind?: AutoKind
}

export interface MissionDay {
  items: MissionItem[]
}

export interface MissionTemplateItem {
  id: string
  label: string
  auto?: boolean
  /** which activity auto-checks this item; undefined + auto === 'math' (legacy). */
  autoKind?: AutoKind
  // ---- SE-B cadence (all optional; absent = appears every school day) ----
  /** restrict this item to these weekdays of its base list (e.g. Handwriting [2,4] = Tue/Thu). */
  days?: Weekday[]
  /** show once per week, anchored mid-week (Current events 1×/wk). */
  weeklyOnce?: boolean
  /** only present in the fall term (Aug–Dec) — carries the senior SAT-prep block. */
  season?: 'fall'
}

/** Per-profile mission schedule. Friday is the light-day variant. */
export interface MissionTemplate {
  weekday: MissionTemplateItem[]
  friday: MissionTemplateItem[]
}

// ---------- SE-B attendance (additive, OPTIONAL; invisible to the kids) ----------

/** One recorded school day: the date it happened + the hours credited at that time. */
export interface AttendanceDay {
  date: ISODate
  /** hours credited for the day, snapshotted when the day was logged (append-only). */
  hours: number
}

/**
 * Per-profile attendance. Auto-recorded when a mission day completes; the log is
 * append-only (a school day that happened is never un-happened). MP absorbs this later.
 */
export interface AttendanceState {
  /** Dad's per-girl hours/day override; undefined = estimate from her template block count. */
  hoursPerDay?: number
  /** append-only, at most one row per calendar date. */
  log: AttendanceDay[]
}

// ---------- SE-B service hours (teens; additive, OPTIONAL) ----------

/** One logged community-service entry. Locked once Dad approves it. */
export interface ServiceEntry {
  id: string
  date: ISODate
  org: string
  hours: number
  note: string
  /** Dad-approved → the entry is locked (read-only to the teen) and counts as official. */
  approved: boolean
  createdAt: string
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

  // ---------- SE-A typing trainer "MK" (additive, OPTIONAL, runtime defaults; no schemaVersion bump) ----------
  /** per-profile typing-ladder progress; undefined = fresh (see typing/engine defaultTypingState). */
  typing?: TypingState

  // ---------- MR reading fluency (additive, OPTIONAL, runtime defaults; no schemaVersion bump) ----------
  /** per-profile read-aloud fluency log + calibration; undefined = fresh (see reading/fluency defaultReadingState). */
  reading?: ReadingState

  // ---------- SE-B attendance + service hours (additive, OPTIONAL; no schemaVersion bump) ----------
  /** auto-recorded school days; undefined until her first mission day completes. */
  attendance?: AttendanceState
  /** teens' community-service log; undefined until her first entry. */
  serviceLog?: ServiceEntry[]

  // ---------- MT-2/3 conversational tutor (additive, OPTIONAL, runtime defaults; no schemaVersion bump) ----------
  /** per-question tutor chat transcripts; undefined until her first chat. Auto-pruned after 60 days. */
  tutorChats?: TutorChat[]
  /** epoch-ms of each real Anthropic tutor call — backs the daily/monthly cap + usage meter. Pruned with chats. */
  tutorCalls?: number[]
  /** Dad-editable daily tutor-call cap; undefined = default (see tutorEngine.DEFAULT_DAILY_CAP). */
  tutorDailyCap?: number

  // ---------- MM mindset module (additive, OPTIONAL, runtime defaults; no schemaVersion bump) ----------
  /** per-week mindset progress; undefined until her first lesson view. PRIVATE to this profile. */
  mindset?: MindsetState
}

/**
 * MM — one week's mindset progress: COMPLETION SIGNALS ONLY. The reflection TEXT
 * (journal entries AND the littles' emoji/one-word answers) is deliberately NOT here —
 * it lives in a separate localStorage slot (journalStore.ts) that is never part of
 * AppState, so it cannot reach the panel, the export, or the sync payload. These fields
 * sync normally and back Dad's panel + the parent hub.
 */
export interface MindsetWeekState {
  /** she read the lesson to the end. */
  viewed?: boolean
  /** a reflection was submitted (emoji counts; a journal "Done" counts even if empty). */
  reflected?: boolean
  /** set once viewed && reflected — the completion signal the panel reads and syncs. */
  completedAt?: ISODate
}

/** MM — per-profile mindset state (completion only), keyed by week number (1-based). */
export interface MindsetState {
  weeks: Record<number, MindsetWeekState>
}

/** MT-2 one message in a tutor conversation. */
export interface TutorMessage {
  role: 'kid' | 'tutor'
  text: string
  ts: number
  /** how a tutor line was produced: 'api' = a real Anthropic call; 'scripted' = a local safety/cap line. */
  source?: 'api' | 'scripted'
}

/** MT-2 one question-scoped tutor conversation, logged for Dad. */
export interface TutorChat {
  id: string
  skillId: SkillId
  grade: Grade
  day: ISODate
  startedTs: number
  /** the exact problem, correct answer, and her answer the chat is locked to. */
  problem: string
  correctAnswer: string
  herAnswer: string
  messages: TutorMessage[]
  /** how it ended: 'flagged' = concerning/6-exchange → Needs-Dad; 'closed' = she left. */
  outcome?: 'flagged' | 'closed'
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

/** SE-A: best result a girl has reached on one typing lesson. */
export interface TypingLessonState {
  /** best accuracy % ever hit on this lesson (0–100). */
  bestAccuracy: number
  /** best words-per-minute ever hit on this lesson. */
  bestWpm: number
  /** true once she has cleared the 90%-accuracy mastery gate at least once. */
  passed: boolean
  lastSeen?: ISODate
}

/** SE-A: per-profile typing-trainer state. All fields default gracefully. */
export interface TypingState {
  /** highest unlocked lesson index (0-based); lessons 0..unlockedIndex are playable. */
  unlockedIndex: number
  /** best stats keyed by lesson id. */
  lessons: Record<string, TypingLessonState>
  /** total 5-minute drills finished (display only). */
  drillsCompleted: number
  lastPracticedDate?: ISODate
}

// ---------- MR reading fluency (additive, all OPTIONAL; no schemaVersion bump) ----------

/** How a reading's WCPM number was produced. */
export type ReadingMode =
  | 'estimated' // browser SpeechRecognition + sequence alignment (the everyday proxy)
  | 'assessed' // Azure Pronunciation Assessment (v2 seam; not wired this cycle)
  | 'manual' // offline: Dad counted words-correct by hand (ground-truth-ish)

/** One logged read-aloud session. `wcpm` is always an ESTIMATE unless mode==='manual'. */
export interface ReadingSessionLog {
  date: ISODate
  passageId: string
  mode: ReadingMode
  /** words-correct-per-minute; label as "estimated" everywhere unless mode==='manual'. */
  wcpm: number
  /** passage words flagged for gentle practice ("words we practiced", never "wrong"). */
  wordsPracticed: string[]
  /** active reading time in seconds. */
  durationSec: number
}

/** Dad's periodic manual 1-minute check — the ground-truth series the trend carries alongside estimates. */
export interface ReadingCalibration {
  date: ISODate
  /** the passage used, if a bank passage; optional for an ad-hoc book check. */
  passageId?: string
  /** Dad-counted words-correct in one minute. */
  wcpm: number
}

/** Per-profile reading-fluency state. All fields default gracefully (old profiles have none). */
export interface ReadingState {
  /** append-only session log, oldest first. */
  sessions: ReadingSessionLog[]
  /** passage ids already served, oldest first — drives the no-repeat spacing window. */
  seenPassageIds: string[]
  /** Dad's manual calibration checks (ground truth), oldest first. */
  calibrations: ReadingCalibration[]
  lastReadDate?: ISODate
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
  /** MM: Dad-set school-year start date; weeks unlock on the Fridays that follow. undefined = not set (all mindset weeks locked). */
  mindsetStartDate?: ISODate
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
