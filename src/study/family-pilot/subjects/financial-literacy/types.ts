import type { AcademyGrade } from '../../../../types'

/**
 * FAMILY-PILOT-FINLIT-1 — the Family Pilot financial-literacy lane ships the
 * reviewed, frozen Manuel Academy financial-literacy course (see
 * curriculum-content/manuel-academy/<release>/grades/grade-{5,7,8}/courses/financial-literacy).
 * Only refs and display metadata live here; full lesson bodies stay in the
 * existing curriculum-content source.
 */
export const FINANCIAL_LITERACY_SUBJECT = 'financial-literacy' as const

export interface FinLitStudentRef {
  readonly studentRef: string
  readonly grade: AcademyGrade
}

/** A single lesson's ref and display metadata. `courseDay` is the course's
 * own 1..N completion order — not renumbered or reinterpreted here. */
export interface FinLitLessonRef {
  readonly lessonId: string
  readonly courseId: string
  readonly grade: AcademyGrade
  readonly unitId: string
  readonly unitNumber: number
  readonly dayInUnit: number
  readonly courseDay: number
  readonly title: string
  /** Curriculum standard tags for this lesson, e.g. `['PF3 foundations']` or, for
   * grade 8, exactly one of `PF1`..`PF7` (plus the grade-8 capstone synthesis tag). */
  readonly standards: readonly string[]
  /** The lesson's own authored parent-facing summary, when the source lesson has one. */
  readonly parentVisibility: string | null
}

export interface FinLitUnitRef {
  readonly unitId: string
  readonly courseId: string
  readonly unitNumber: number
  readonly title: string
  readonly standards: readonly string[]
  readonly assessmentId: string | null
  /** Lesson ids in this unit, in completion order. */
  readonly lessonIds: readonly string[]
}

export interface FinLitCourseRef {
  readonly courseId: string
  readonly grade: AcademyGrade
  readonly subject: typeof FINANCIAL_LITERACY_SUBJECT
  readonly title: string
  readonly units: readonly FinLitUnitRef[]
  /** Every lesson in the course, course_day-ordered end to end — the
   * completion order getAssignments and getNextLesson walk. */
  readonly lessons: readonly FinLitLessonRef[]
}

export interface FinancialLiteracyCatalog {
  readonly releaseVersion: string
  readonly courses: readonly FinLitCourseRef[]
}
