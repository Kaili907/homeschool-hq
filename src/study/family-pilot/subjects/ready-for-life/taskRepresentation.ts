import type { RflGuardianRequirement } from './guardianRequirement'
import type { RflLessonRef } from './types'

/**
 * FULL-FAMILY-READY-FOR-LIFE-SAFE-TASK — the "safe action" this lesson asks a
 * learner to do, opaque and structured. It never carries free learner text
 * (no forced private disclosure): studentActivity and homeConnection are the
 * course's own authored instructions, not learner-submitted content. The
 * course's own home_connection field states "No purchase, account creation,
 * photograph, or private disclosure is required" verbatim on every one of
 * the 108 lessons (confirmed at load time by content.node.ts's field
 * validation) — this module surfaces that as a checked structural guarantee
 * rather than re-deriving it by guesswork.
 */

export type RflTaskMode = 'household-task' | 'guardian-supervised-task'

export interface RflTaskRepresentation {
  readonly lessonId: string
  readonly mode: RflTaskMode
  /** Course-authored instructions for what the learner does — never
   * learner-submitted text. */
  readonly studentActivity: string
  readonly homeConnection: string
  /** Always false: no Ready for Life task ever asks for a real credential,
   * password, or account signup. */
  readonly requiresRealCredentials: false
  /** Always false: hazardous steps (heat, sharp tools, appliances,
   * chemicals, medication, transportation, online accounts) are guardian-
   * supervised by policy, never assigned for unsupervised completion. */
  readonly requiresUnsupervisedHazard: false
  /** Always false: no photograph, purchase, account creation, or private
   * disclosure is ever required to complete a lesson. */
  readonly requiresPrivateDisclosure: false
  readonly safetyAndPrivacy: readonly string[]
}

const FORBIDDEN_HOME_CONNECTION_CLAUSE =
  'No purchase, account creation, photograph, or private disclosure is required'

/** Throws if a lesson's own authored content doesn't uphold the safe-task
 * guarantee this adapter promises callers — a precise blocker rather than a
 * silently wrong `false`. */
function assertNoForcedDisclosure(lesson: RflLessonRef): void {
  if (!lesson.homeConnection.includes(FORBIDDEN_HOME_CONNECTION_CLAUSE)) {
    throw new Error(
      `Lesson ${lesson.lessonId} home_connection does not carry the required no-forced-disclosure clause`,
    )
  }
}

export function deriveTaskRepresentation(
  lesson: RflLessonRef,
  guardianRequirement: RflGuardianRequirement,
): RflTaskRepresentation {
  assertNoForcedDisclosure(lesson)
  const mode: RflTaskMode = guardianRequirement.requiresGuardianSignoffBeforeCompletion
    ? 'guardian-supervised-task'
    : 'household-task'
  return Object.freeze({
    lessonId: lesson.lessonId,
    mode,
    studentActivity: lesson.studentActivity,
    homeConnection: lesson.homeConnection,
    requiresRealCredentials: false,
    requiresUnsupervisedHazard: false,
    requiresPrivateDisclosure: false,
    safetyAndPrivacy: lesson.safetyAndPrivacy,
  })
}
