import type { Grade } from '../../../types'
import type { StudyScope, StudySubject } from '../../types'

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
  readonly problem?: FamilyPilotHelpProblem
}

export type FamilyPilotHelpPath = 'tutor-core' | 'static-fallback'

export interface FamilyPilotHelpEligibility {
  readonly path: FamilyPilotHelpPath
  readonly reason: string
}
