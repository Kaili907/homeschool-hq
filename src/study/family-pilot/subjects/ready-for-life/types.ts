import type { AcademyGrade } from '../../../../types'

/**
 * FULL-FAMILY-READY-FOR-LIFE — the Family Pilot's life-skills subject lane,
 * over the reviewed, frozen Manuel Academy Ready for Life course (see
 * curriculum-content/manuel-academy/<release>/grades/grade-{5,7,8}/courses/ready-for-life).
 * Mirrors the shape of ../../../../curriculum/family-pilot/types.ts (the
 * mathematics lane) so the two subjects stay structurally comparable, without
 * editing that file — this lane owns its own types end to end.
 */
export const READY_FOR_LIFE_SUBJECT = 'ready-for-life' as const

export interface RflStudentRef {
  readonly studentRef: string
  readonly grade: AcademyGrade
}

export interface RflLessonFlowStep {
  readonly segment: string
  readonly minutes: string
  readonly teacherOrTutorAction: string
}

export interface RflAdaptiveTutorRoute {
  readonly signal: string
  readonly action: string
}

/** A single lesson's ref, display metadata, and the fields the safety /
 * tutor / completion adapters in this lane derive from. `courseDay` is the
 * course's own 1..N completion order — not renumbered or reinterpreted here. */
export interface RflLessonRef {
  readonly lessonId: string
  readonly courseId: string
  readonly grade: AcademyGrade
  readonly unitId: string
  readonly unitNumber: number
  readonly unitTitle: string
  readonly dayInUnit: number
  readonly courseDay: number
  readonly title: string
  readonly focus: string
  readonly estimatedMinutes: string
  readonly lessonFlow: readonly RflLessonFlowStep[]
  readonly studentActivity: string
  readonly formativeCheck: string
  readonly extension: string
  readonly masteryRule: string
  readonly safetyAndPrivacy: readonly string[]
  readonly parentOrGuardianVisibility: string
  readonly homeConnection: string
  readonly adaptiveTutorRoutes: readonly RflAdaptiveTutorRoute[]
}

export interface RflUnitRef {
  readonly unitId: string
  readonly courseId: string
  readonly unitNumber: number
  readonly title: string
  readonly performanceTask: string
  readonly assessmentId: string | null
  /** Lesson ids in this unit, in completion order. */
  readonly lessonIds: readonly string[]
}

export interface RflCourseRef {
  readonly courseId: string
  readonly grade: AcademyGrade
  readonly subject: typeof READY_FOR_LIFE_SUBJECT
  readonly title: string
  readonly units: readonly RflUnitRef[]
  /** Every lesson in the course, course_day-ordered end to end. */
  readonly lessons: readonly RflLessonRef[]
}

export interface RflCatalog {
  readonly releaseVersion: string
  readonly courses: readonly RflCourseRef[]
}
