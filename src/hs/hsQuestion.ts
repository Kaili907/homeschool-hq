// ---------- M4 high-school question shape (isolated from the kids' Question) ----------
//
// HS mode is a "different animal": numeric multiple-choice with an optional
// geometry figure. Keeping its own type means the grade-3/4/6 Question, the
// shared Visual union, and App's practice loop stay completely untouched.

import type { Difficulty } from '../types'
import type { GeoFigure } from './geoFigure'

export interface HsQuestion {
  /** geometry-unit or algebra-topic id (see hsCatalog) */
  unit: string
  difficulty: Difficulty
  prompt: string
  /** optional SVG diagram */
  figure?: GeoFigure
  choices: string[]
  answerIndex: number
}

export type HsGen = (d: Difficulty) => HsQuestion
