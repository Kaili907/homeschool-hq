import type { AcademyGrade } from '../../../../types'
import type { HostStudyLessonKind } from '../../../curriculumAdapter'

/**
 * FAMILY-PILOT-SUBJECT-ELA — English Language Arts subject lane.
 *
 * This mirrors src/curriculum/family-pilot/types.ts's mathematics shape
 * (PilotLessonRef/PilotUnitRef/PilotCourseRef) so the ELA lane reads the same
 * way to every future caller. It is not a second Study Engine and not a
 * second mastery/progress store: refs and display metadata live here, and
 * every ref flows through the existing src/study/curriculumAdapter.ts to
 * become a StudyLessonPlan. The frozen Grade 5 Adaptive English intervention
 * package (a5-adaptive-english-mvp-v0.2.0) is a separate, unmounted overlay
 * referenced by curriculum-content/manuel-academy/1.0.0's course guides — this
 * lane does not read, copy, or alter it.
 */
export const ELA_SUBJECT = 'english-language-arts' as const

export interface ElaLessonRef {
  readonly lessonId: string
  readonly courseId: string
  readonly grade: AcademyGrade
  readonly unitId: string
  readonly unitNumber: number
  readonly dayInUnit: number
  /** The course's own 1..N completion order — not renumbered or reinterpreted here. */
  readonly courseDay: number
  readonly title: string
  readonly phase: string
  /** Precomputed at load time so every downstream consumer sees one answer. */
  readonly studyKind: HostStudyLessonKind
}

export interface ElaUnitRef {
  readonly unitId: string
  readonly courseId: string
  readonly unitNumber: number
  readonly title: string
  readonly assessmentId: string | null
  /** Lesson ids in this unit, in completion order. */
  readonly lessonIds: readonly string[]
}

export interface ElaCourseRef {
  readonly courseId: string
  readonly grade: AcademyGrade
  readonly subject: typeof ELA_SUBJECT
  readonly title: string
  readonly units: readonly ElaUnitRef[]
  /** Every lesson in the course, course_day-ordered end to end. */
  readonly lessons: readonly ElaLessonRef[]
}

export interface ElaCatalog {
  readonly releaseVersion: string
  readonly courses: readonly ElaCourseRef[]
}
