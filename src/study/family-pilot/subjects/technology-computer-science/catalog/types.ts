import type { AcademyGrade } from '../../../../../types'

/**
 * FF-M7 — the Technology / Computer Science subject lane ships one course per
 * published grade: the reviewed Manuel Academy technology course (see
 * curriculum-content/manuel-academy/<release>/grades/grade-{5,7,8}/courses/technology).
 * Only refs and display metadata live here, mirroring the existing frozen
 * mathematics catalog (src/curriculum/family-pilot/types.ts) — full lesson
 * scripts (lesson_flow, adaptive_tutor_routes, answer/scoring guidance) stay
 * in the curriculum source and are never copied into this module.
 */
export const TECH_CS_SUBJECT = 'technology' as const

/**
 * The within-lesson pedagogical position. day_in_unit 1..6 maps to the same
 * phase across every grade and unit in the canonical content, so this is a
 * closed, deterministic set rather than free text.
 */
export type TechCsDayPhase =
  | 'launch-diagnostic'
  | 'explicit-model'
  | 'guided-practice'
  | 'application-project'
  | 'mastery-check'
  | 'correction-reflection'

export interface TechCsLessonRef {
  readonly lessonId: string
  readonly courseId: string
  readonly grade: AcademyGrade
  readonly unitId: string
  readonly unitNumber: number
  readonly dayInUnit: number
  readonly courseDay: number
  readonly title: string
  readonly focus: string
  readonly dayPhase: TechCsDayPhase
  readonly standards: readonly string[]
  readonly accessibilityAndAccommodations: readonly string[]
  readonly safetyAndPrivacy: readonly string[]
}

export interface TechCsUnitRef {
  readonly unitId: string
  readonly courseId: string
  readonly unitNumber: number
  readonly title: string
  readonly topics: readonly string[]
  readonly performanceTask: string
  readonly assessmentId: string | null
  /** Lesson ids in this unit, in completion order. */
  readonly lessonIds: readonly string[]
}

export interface TechCsCourseRef {
  readonly courseId: string
  readonly grade: AcademyGrade
  readonly subject: typeof TECH_CS_SUBJECT
  readonly title: string
  readonly units: readonly TechCsUnitRef[]
  /** Every lesson in the course, course_day-ordered end to end. */
  readonly lessons: readonly TechCsLessonRef[]
}

export interface TechCsCatalog {
  readonly releaseVersion: string
  readonly courses: readonly TechCsCourseRef[]
}
