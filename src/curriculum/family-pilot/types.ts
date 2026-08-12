import type { AcademyGrade } from '../../types'

/**
 * FAMILY-PILOT-CURR-1 — the Family Pilot ships one course per published grade:
 * the reviewed, frozen Manuel Academy mathematics course (see
 * curriculum-content/manuel-academy/<release>/grades/grade-{5,7,8}/courses/mathematics).
 * Only refs and display metadata live here; full lesson bodies stay in the
 * existing curriculum-content source and the Study content pipeline that
 * already projects it (src/study/contracts/production/content.ts).
 */
export const FAMILY_PILOT_SUBJECT = 'mathematics' as const

export interface PilotStudentRef {
  readonly studentRef: string
  readonly grade: AcademyGrade
}

/** A single lesson's ref and display metadata. `courseDay` is the course's
 * own 1..N completion order — not renumbered or reinterpreted here. */
export interface PilotLessonRef {
  readonly lessonId: string
  readonly courseId: string
  readonly grade: AcademyGrade
  readonly unitId: string
  readonly unitNumber: number
  readonly dayInUnit: number
  readonly courseDay: number
  readonly title: string
}

export interface PilotUnitRef {
  readonly unitId: string
  readonly courseId: string
  readonly unitNumber: number
  readonly title: string
  readonly assessmentId: string | null
  /** Lesson ids in this unit, in completion order. */
  readonly lessonIds: readonly string[]
}

export interface PilotCourseRef {
  readonly courseId: string
  readonly grade: AcademyGrade
  readonly subject: typeof FAMILY_PILOT_SUBJECT
  readonly title: string
  readonly units: readonly PilotUnitRef[]
  /** Every lesson in the course, course_day-ordered end to end — the
   * completion order getPilotAssignments and getNextLesson walk. */
  readonly lessons: readonly PilotLessonRef[]
}

export interface FamilyPilotCatalog {
  readonly releaseVersion: string
  readonly courses: readonly PilotCourseRef[]
}
