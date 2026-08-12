import type { AcademyGrade } from '../../../../types'

/**
 * FF-M3 — the Family Pilot Social Studies lane covers exactly the published
 * grades: the reviewed, frozen Manuel Academy social studies course (see
 * curriculum-content/manuel-academy/<release>/grades/grade-{5,7,8}/courses/social-studies).
 * Only refs and display/evidence metadata live here; this module never
 * stores learner text and never runs a lesson state machine of its own — see
 * source.node.ts and studyAdapter.ts for how it reuses the existing Study
 * Engine instead of inventing one.
 */
export const SOCIAL_STUDIES_SUBJECT_DIR = 'social-studies' as const
export const SOCIAL_STUDIES_GRADES: readonly AcademyGrade[] = ['5', '7', '8']

/** Canonical expectation this lane is BLOCKed against — see CANONICAL EXPECTATION. */
export const SOCIAL_STUDIES_LESSONS_PER_GRADE = 108
export const SOCIAL_STUDIES_UNITS_PER_GRADE = 9
export const SOCIAL_STUDIES_TOTAL_LESSONS = SOCIAL_STUDIES_LESSONS_PER_GRADE * SOCIAL_STUDIES_GRADES.length
export const SOCIAL_STUDIES_TOTAL_UNITS = SOCIAL_STUDIES_UNITS_PER_GRADE * SOCIAL_STUDIES_GRADES.length

/**
 * The 12 recurring lesson phases every unit repeats, in day_in_unit order.
 * This is the deterministic backbone the Study adapter and the source
 * loader both validate against — an unrecognized or reordered phase is a
 * source-custody failure, not something to guess past.
 */
export const SOCIAL_STUDIES_PHASE_SEQUENCE = [
  'Launch and diagnostic',
  'Concept model A',
  'Guided practice A',
  'Independent application A',
  'Concept model B',
  'Guided practice B',
  'Investigation or close reading',
  'Reteach and varied practice',
  'Performance task build',
  'Synthesis and review',
  'Unit assessment',
  'Correction and reflection',
] as const

export type SocialStudiesPhase = (typeof SOCIAL_STUDIES_PHASE_SEQUENCE)[number]

/** A single lesson's ref and display/evidence metadata. `courseDay` is the
 * course's own 1..N completion order — not renumbered or reinterpreted. */
export interface SocialStudiesLessonRef {
  readonly lessonId: string
  readonly courseId: string
  readonly grade: AcademyGrade
  readonly unitId: string
  readonly unitNumber: number
  readonly dayInUnit: number
  readonly courseDay: number
  readonly title: string
  readonly phase: SocialStudiesPhase
  readonly focus: string
  readonly essentialQuestion: string
  readonly standards: readonly string[]
  readonly materials: readonly string[]
}

export interface SocialStudiesUnitRef {
  readonly unitId: string
  readonly courseId: string
  readonly grade: AcademyGrade
  readonly unitNumber: number
  readonly title: string
  readonly essentialQuestion: string
  readonly standards: readonly string[]
  readonly topics: readonly string[]
  readonly performanceTask: string
  readonly assessmentId: string | null
  /** Lesson ids in this unit, in completion order. */
  readonly lessonIds: readonly string[]
}

export interface SocialStudiesAssessmentRef {
  readonly assessmentId: string
  readonly courseId: string
  readonly grade: AcademyGrade
  readonly unitNumber: number
  readonly unitTitle: string
  readonly standards: readonly string[]
  readonly totalPoints: number
  readonly promptCount: number
}

export interface SocialStudiesCourseRef {
  readonly courseId: string
  readonly grade: AcademyGrade
  readonly title: string
  readonly units: readonly SocialStudiesUnitRef[]
  /** Every lesson in the course, course_day-ordered end to end. */
  readonly lessons: readonly SocialStudiesLessonRef[]
  readonly assessments: readonly SocialStudiesAssessmentRef[]
}

export interface SocialStudiesCatalog {
  readonly releaseVersion: string
  readonly courses: readonly SocialStudiesCourseRef[]
}

/** Evidence/source metadata projected for one lesson — preserved verbatim
 * from disk, never invented. See evidence.ts. */
export interface SocialStudiesEvidenceMetadata {
  readonly lessonId: string
  readonly focus: string
  readonly essentialQuestion: string
  readonly standards: readonly string[]
  readonly materials: readonly string[]
  readonly unitTopics: readonly string[]
  readonly performanceTask: string
  /** True only when the unit's own on-disk topics literally name primary or
   * secondary source work — a detector, never an inference beyond the text. */
  readonly citesPrimaryOrSecondarySources: boolean
  /** True only when the unit's own on-disk topics literally name maps or
   * spatial/geographic source work. */
  readonly citesMapsOrSpatialSources: boolean
}
