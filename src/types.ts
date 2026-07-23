import type { SkillId } from './skills'

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

export interface SkillStat {
  attempts: number
  correct: number
  /** 0–100 rolling mastery estimate */
  mastery: number
}

export interface Profile {
  version: 1
  name: string
  createdAt: string
  placementDone: boolean
  skillStats: Partial<Record<SkillId, SkillStat>>
  totals: {
    questionsAnswered: number
    correct: number
    bestStreak: number
    sessions: number
  }
  lastPracticeDate?: string
}
