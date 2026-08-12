import type { AcademyGrade } from '../../../../types'

/**
 * FAMILY-PILOT-SCIENCE-1 — the Family Pilot Science subject lane ships one
 * course per published grade: the reviewed, frozen Manuel Academy science
 * course (see
 * curriculum-content/manuel-academy/<release>/grades/grade-{5,7,8}/courses/science).
 * This module owns discovery, the Study adapter, the Tutor capability
 * projection and the guardian-safety projection for that course only. It does
 * not define a new Study engine: adaptScienceLessonToStudy (see
 * studyAdapter.ts) produces the same StudyLessonPlan/StudyPlanSegment shape
 * every other subject produces, from src/study/types.ts.
 */
export const SCIENCE_SUBJECT = 'science' as const

export const SCIENCE_GRADES: readonly AcademyGrade[] = ['5', '7', '8']

export interface ScienceLessonRef {
  readonly lessonId: string
  readonly courseId: string
  readonly grade: AcademyGrade
  readonly unitId: string
  readonly unitNumber: number
  readonly dayInUnit: number
  /** The course's own 1..N completion order — not renumbered or reinterpreted here. */
  readonly courseDay: number
  readonly title: string
}

/** One step of a lesson's fixed five-part instructional flow. */
export interface ScienceLessonFlowStep {
  readonly segment: string
  readonly minutes: string
  readonly teacherOrTutorAction: string
}

/** The lesson's guardian-visible safety and media posture, preserved from the
 * curriculum source rather than derived or summarized. */
export interface ScienceLessonSafety {
  readonly materials: readonly string[]
  readonly safetyAndPrivacy: readonly string[]
  readonly mediaSuggestion: string
  /** Always false in the frozen science curriculum: no lesson requires a
   * photo, camera, or voice recording to complete. */
  readonly mediaRequired: false
  readonly noMediaFallback: string
  readonly parentOrGuardianVisibility: string
}

export interface ScienceLessonDetail extends ScienceLessonRef {
  readonly phase: string
  readonly focus: string
  readonly essentialQuestion: string
  readonly standards: readonly string[]
  readonly learningObjectives: readonly string[]
  readonly successCriteria: readonly string[]
  readonly lessonFlow: readonly ScienceLessonFlowStep[]
  readonly masteryRule: string
  readonly safety: ScienceLessonSafety
}

export interface ScienceUnitRef {
  readonly unitId: string
  readonly courseId: string
  readonly grade: AcademyGrade
  readonly unitNumber: number
  readonly title: string
  readonly essentialQuestion: string
  readonly standards: readonly string[]
  readonly assessmentId: string | null
  /** Lesson ids in this unit, in completion order. */
  readonly lessonIds: readonly string[]
}

export interface ScienceAssessmentPrompt {
  readonly type: string
  readonly prompt: string
  readonly points: number
}

export interface ScienceUnitAssessment {
  readonly assessmentId: string
  readonly unitNumber: number
  readonly unitTitle: string
  readonly standards: readonly string[]
  readonly totalPoints: number
  readonly prompts: readonly ScienceAssessmentPrompt[]
}

export interface ScienceCourseRef {
  readonly courseId: string
  readonly grade: AcademyGrade
  readonly subject: typeof SCIENCE_SUBJECT
  readonly title: string
  readonly units: readonly ScienceUnitRef[]
  /** Every lesson in the course, course_day-ordered end to end. */
  readonly lessons: readonly ScienceLessonRef[]
  readonly lessonDetailById: ReadonlyMap<string, ScienceLessonDetail>
  readonly assessmentsById: ReadonlyMap<string, ScienceUnitAssessment>
}

export interface ScienceCatalog {
  readonly releaseVersion: string
  readonly courses: readonly ScienceCourseRef[]
}
