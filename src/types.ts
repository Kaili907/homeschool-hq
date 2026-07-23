import type { SkillId } from './skills'

// ---------- questions (unchanged from v1) ----------

export type Difficulty = 1 | 2 | 3

export type Visual =
  | { kind: 'clock'; h: number; m: number }
  | { kind: 'fraction'; num: number; den: number }
  | { kind: 'fractionPair'; a: [number, number]; b: [number, number] }
  | { kind: 'rect'; w: number; h: number; labels: boolean }

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
