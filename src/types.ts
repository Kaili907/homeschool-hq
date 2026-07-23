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
}

export interface AppState {
  /** bump on every breaking change; document in MIGRATIONS.md */
  schemaVersion: 2
  profiles: Record<string, Profile>
  activeProfileId: string | null
  /** gates the Grown-Ups panel. '' = not set yet. */
  parentPin: string
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
