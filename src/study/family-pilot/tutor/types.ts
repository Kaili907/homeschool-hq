import type { Grade } from '../../../types'
import type { StudyScope, StudySubject } from '../../types'

/**
 * Family Pilot Tutor bridge — local-only. This gives a Family Pilot Study
 * session a help path backed by the existing, reviewed Tutor Core
 * (src/tutor/*) when the current content fits it, and a static fallback
 * otherwise. It does not read or write the Server Tutor approved-mapping
 * system (src/study/production/**); that stays out of scope by design, not
 * omission — see the mission note in tutorBridge.ts.
 */

/** The exact grade set src/tutor/tutorEngine.ts is written for. */
export const TUTOR_CORE_GRADES: readonly Grade[] = ['3', '4', '5', '6', '7', '8', '10', '12']

export interface FamilyPilotHelpProblem {
  readonly prompt: string
  readonly correctAnswer: string
  readonly studentAnswer: string
}

export interface FamilyPilotHelpContext {
  readonly scope: StudyScope
  readonly subject: StudySubject
  readonly grade: number
  readonly noAudio: boolean
  readonly mediaAvailable: boolean
  /** Present only when the active segment is a single answer-checked math problem. */
  readonly problem?: FamilyPilotHelpProblem
}

export type FamilyPilotHelpPath = 'tutor-core' | 'static-fallback'

export interface FamilyPilotHelpEligibility {
  readonly path: FamilyPilotHelpPath
  readonly reason: string
}
