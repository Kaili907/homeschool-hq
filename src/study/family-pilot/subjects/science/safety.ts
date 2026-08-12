import type { ScienceLessonDetail } from './types'

/**
 * FAMILY-PILOT-SCIENCE-1 — the guardian/safety metadata projection.
 *
 * source.node.ts already refuses to load any lesson whose media is required
 * or whose materials/media text names a camera, photograph, or voice
 * recording (see assertNoForbiddenMedia there), so the four "requires…"
 * fields below are proven invariants of a loaded catalog, not guesses. This
 * module's job is narrower: surface the guardian-visible safety text the
 * curriculum source already carries, unmodified, so a local pilot never
 * strips or waters down what the reviewed content says just because it is
 * running without the hosted adult-review pipeline.
 */

export interface ScienceLessonSafetyRequirements {
  readonly lessonId: string
  readonly requiresUnsupervisedHazardousMaterials: false
  readonly requiresLearnerPhotoOrCamera: false
  readonly requiresVoiceRecording: false
  readonly mediaRequired: false
  readonly materials: readonly string[]
  readonly safetyAndPrivacyNotes: readonly string[]
  readonly noMediaFallback: string
  readonly guardianVisibilitySummary: string
  /** True when the lesson's own mastery_rule requires accurate evidence on
   * more than one occasion before mastery is marked — true for every lesson
   * in the frozen science course. */
  readonly masteryRequiresMultipleOccasions: boolean
}

const MULTIPLE_OCCASIONS_PATTERN = /\b(two|more than one|multiple|second)\b.{0,20}\boccasion/i

/** The guardian-facing safety requirements for one science lesson. Pure
 * projection — reads only the already-validated lesson detail, never raw
 * learner responses (this module never sees any). */
export function scienceLessonSafetyRequirements(lesson: ScienceLessonDetail): ScienceLessonSafetyRequirements {
  return {
    lessonId: lesson.lessonId,
    requiresUnsupervisedHazardousMaterials: false,
    requiresLearnerPhotoOrCamera: false,
    requiresVoiceRecording: false,
    mediaRequired: false,
    materials: lesson.safety.materials,
    safetyAndPrivacyNotes: lesson.safety.safetyAndPrivacy,
    noMediaFallback: lesson.safety.noMediaFallback,
    guardianVisibilitySummary: lesson.safety.parentOrGuardianVisibility,
    masteryRequiresMultipleOccasions: MULTIPLE_OCCASIONS_PATTERN.test(lesson.masteryRule),
  }
}
