import type { AcademyLesson, AcademyProtectedUnitChunk } from '../contentTypes'

/**
 * CURR-1 — versioned adapter between the curriculum release and Tutor Core.
 * ADAPTER CONTRACT v1 (documented, additive-only): the curriculum stays the
 * content authority and the tutor stays the conversation authority; this
 * projection is the only bridge. It is NOT yet mounted in a tutor surface —
 * tutor-math host integration is parked (PARKED.md §D) — but the contract is
 * fixed and tested now so mounting later cannot silently reshape either side.
 *
 * Safety invariants (tested):
 *  - scoring guidance is passed for tutoring judgement but the context never
 *    includes fixed assessment answers (the release has none by design), and
 *    `revealsAnswers` is hard-false so a tutor surface can assert it.
 *  - the tutor must not complete graded work: `gradedWorkPolicy` is fixed.
 */

export const ACADEMY_TUTOR_ADAPTER_VERSION = 1 as const

export interface AcademyTutorContext {
  adapterVersion: typeof ACADEMY_TUTOR_ADAPTER_VERSION
  releaseVersion: string
  lessonRef: string
  courseRef: string
  grade: number
  subject: string
  title: string
  focus: string
  learningObjectives: string[]
  successCriteria: string[]
  masteryRule: string
  /** adaptive routes authored for this lesson (signal → tutoring action). */
  adaptiveRoutes: { signal: string; action: string }[]
  /** adult scoring guidance — tutor-side judgement only, never student-rendered. */
  scoringGuidance: string | null
  /** hard invariants a tutor surface must enforce. */
  revealsAnswers: false
  gradedWorkPolicy: 'never-complete-graded-work'
}

export function buildAcademyTutorContext(
  lesson: AcademyLesson,
  protectedChunk: AcademyProtectedUnitChunk,
): AcademyTutorContext {
  const guarded = protectedChunk.lessons[lesson.lesson_id]
  return {
    adapterVersion: ACADEMY_TUTOR_ADAPTER_VERSION,
    releaseVersion: protectedChunk.releaseVersion,
    lessonRef: lesson.lesson_id,
    courseRef: lesson.course_id,
    grade: lesson.grade,
    subject: lesson.subject,
    title: lesson.title,
    focus: lesson.focus,
    learningObjectives: lesson.learning_objectives,
    successCriteria: lesson.success_criteria,
    masteryRule: lesson.mastery_rule,
    adaptiveRoutes: guarded?.adaptive_tutor_routes ?? [],
    scoringGuidance: guarded?.answer_or_scoring_guidance ?? null,
    revealsAnswers: false,
    gradedWorkPolicy: 'never-complete-graded-work',
  }
}
