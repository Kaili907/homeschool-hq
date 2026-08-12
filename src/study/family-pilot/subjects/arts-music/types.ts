import type { AcademyGrade } from '../../../../types'

/**
 * ARTS-MUSIC-1 — the Family Pilot Arts & Music subject lane ships one course
 * per published grade: the reviewed, frozen Manuel Academy Arts & Music
 * course (see curriculum-content/manuel-academy/<release>/grades/grade-{5,7,8}/courses/arts-and-music).
 * Only refs and display metadata live here; full lesson bodies stay in the
 * frozen curriculum-content source, mirroring src/curriculum/family-pilot's
 * mathematics catalog. This subject lane is self-contained: it does not
 * modify that math catalog or the shared Study engine
 * (src/study/curriculumAdapter.ts, src/study/types.ts) — see
 * studyAdapter.ts and curriculumPort.ts for how it fits without touching
 * either.
 */
export const ARTS_MUSIC_SUBJECT = 'arts-and-music' as const

export interface ArtsMusicStudentRef {
  readonly studentRef: string
  readonly grade: AcademyGrade
}

/** One step of a lesson's flow, verbatim from the frozen content. */
export interface ArtsMusicLessonSegment {
  readonly segment: string
  readonly minutes: string
  readonly teacherOrTutorAction: string
}

/** A single lesson's ref and display metadata. `courseDay` is the course's
 * own 1..N completion order — not renumbered or reinterpreted here. */
export interface ArtsMusicLessonRef {
  readonly lessonId: string
  readonly courseId: string
  readonly grade: AcademyGrade
  readonly unitId: string
  readonly unitNumber: number
  readonly dayInUnit: number
  readonly courseDay: number
  readonly title: string
  readonly focus: string
  readonly estimatedMinutes: string
  /** Ordered teaching steps, source for studyAdapter.ts's segment preview. */
  readonly lessonFlow: readonly ArtsMusicLessonSegment[]
}

export interface ArtsMusicUnitRef {
  readonly unitId: string
  readonly courseId: string
  readonly unitNumber: number
  readonly title: string
  /** The unit's portfolio/project task, e.g. "Create an observation
   * portfolio showing purposeful use of visual elements." Descriptive only —
   * no submission content is modeled here (see portfolio.ts). */
  readonly performanceTask: string
  readonly assessmentId: string | null
  /** Lesson ids in this unit, in completion order. */
  readonly lessonIds: readonly string[]
}

export interface ArtsMusicMasteryInterpretation {
  readonly secure: string
  readonly developing: string
  readonly notYet: string
}

/** Rubric metadata for a unit's assessment — used by tutorSupport.ts to
 * frame critique questions against the unit's own rubric dimensions rather
 * than inventing generic feedback. */
export interface ArtsMusicAssessmentRef {
  readonly assessmentId: string
  readonly unitNumber: number
  readonly totalPoints: number
  readonly rubricDimensions: readonly string[]
  readonly masteryInterpretation: ArtsMusicMasteryInterpretation
}

export interface ArtsMusicCourseRef {
  readonly courseId: string
  readonly grade: AcademyGrade
  readonly subject: typeof ARTS_MUSIC_SUBJECT
  readonly title: string
  readonly units: readonly ArtsMusicUnitRef[]
  readonly assessments: readonly ArtsMusicAssessmentRef[]
  /** Every lesson in the course, course_day-ordered end to end — the
   * completion order catalog.ts walks. */
  readonly lessons: readonly ArtsMusicLessonRef[]
}

export interface ArtsMusicCatalog {
  readonly releaseVersion: string
  readonly courses: readonly ArtsMusicCourseRef[]
}
