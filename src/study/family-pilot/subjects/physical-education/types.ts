import type { AcademyGrade } from '../../../../types'

/**
 * FF-M5 — Full Family Physical Education. Domain types for the canonical
 * Manuel Academy PE curriculum (grades 5, 7, 8; 9 units / 108 lessons each).
 *
 * Deliberately excluded from every type below: `answer_or_scoring_guidance`
 * and `adaptive_tutor_routes`. Those are Tutor Core mastery-authority
 * artifacts; Physical Education is completion-only (see studyAdapter.ts), so
 * nothing here ever carries scoring or adaptive-routing content, matching the
 * platform's own learner-safe projection stance (src/study/contracts/production/content.ts).
 */

export interface PhysicalEducationLessonFlowPhase {
  readonly segment: string
  readonly minutes: string
  readonly guidance: string
}

export interface PhysicalEducationMedia {
  readonly suggestion: string
  /** Always false in the canonical PE curriculum: no lesson requires media. */
  readonly required: false
  readonly fallback: string
}

export interface PhysicalEducationLesson {
  readonly lessonId: string
  readonly courseId: string
  readonly grade: AcademyGrade
  readonly unitId: string
  readonly unitNumber: number
  readonly unitTitle: string
  readonly dayInUnit: number
  readonly courseDay: number
  readonly title: string
  readonly phase: string
  readonly focus: string
  readonly estimatedMinutes: string
  readonly standards: readonly string[]
  readonly essentialQuestion: string
  readonly learningObjectives: readonly string[]
  readonly successCriteria: readonly string[]
  readonly materials: readonly string[]
  readonly lessonFlow: readonly PhysicalEducationLessonFlowPhase[]
  readonly studentActivity: string
  readonly formativeCheck: string
  readonly masteryRule: string
  readonly extension: string
  /** Inclusive/adapted movement alternatives. Never empty; never dropped. */
  readonly accessibilityAndAccommodations: readonly string[]
  /** Safety cues and privacy limits, e.g. "stop for pain ... tell an adult". */
  readonly safetyAndPrivacy: readonly string[]
  readonly media: PhysicalEducationMedia
  readonly parentOrGuardianVisibility: string
  readonly homeConnection: string
}

export interface PhysicalEducationUnit {
  readonly unitId: string
  readonly courseId: string
  readonly grade: AcademyGrade
  readonly unitNumber: number
  readonly title: string
  readonly essentialQuestion: string
  readonly assessmentId: string | null
  /** Lesson ids in this unit, day-in-unit order. */
  readonly lessonIds: readonly string[]
}

export interface PhysicalEducationCourse {
  readonly courseId: string
  readonly grade: AcademyGrade
  readonly subject: 'physical-education'
  readonly title: string
  readonly units: readonly PhysicalEducationUnit[]
  /** Every lesson in the course, course_day-ordered end to end. */
  readonly lessons: readonly PhysicalEducationLesson[]
}

export interface PhysicalEducationCatalog {
  readonly releaseVersion: string
  readonly courses: readonly PhysicalEducationCourse[]
}
