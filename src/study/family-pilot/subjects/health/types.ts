/**
 * Family Pilot — Health subject domain types.
 *
 * These types mirror the canonical curriculum content at
 * curriculum-content/manuel-academy/<release>/grades/grade-{5,7,8}/courses/health
 * field-for-field (camelCased), plus a small set of derived types this subject
 * module adds on top (guardian visibility, tutor-help). Nothing here models a
 * learner's private health status, body measurements, or free-text response —
 * the curriculum itself is content-only, and this subject module never adds a
 * field for learner-supplied health data.
 */

/** The only grades the canonical Health course is published for. */
export type HealthGrade = '5' | '7' | '8'

export interface HealthLessonFlowSegment {
  readonly segment: string
  readonly minutes: string
  readonly teacherOrTutorAction: string
}

export interface HealthAdaptiveTutorRoute {
  readonly signal: string
  readonly action: string
}

/** Media is always optional in canonical Health content; `required` is always false. */
export interface HealthLessonMedia {
  readonly suggestion: string
  readonly required: boolean
  readonly fallback: string
}

/** One lesson, in the shape the canonical content authors it. */
export interface HealthLesson {
  readonly schemaVersion: string
  readonly lessonId: string
  readonly courseId: string
  readonly grade: HealthGrade
  readonly subject: 'health'
  readonly courseDay: number
  readonly unitNumber: number
  readonly unitTitle: string
  readonly dayInUnit: number
  readonly title: string
  readonly phase: string
  readonly focus: string
  readonly estimatedMinutes: string
  readonly standards: readonly string[]
  readonly essentialQuestion: string
  readonly learningObjectives: readonly string[]
  readonly successCriteria: readonly string[]
  readonly materials: readonly string[]
  readonly lessonFlow: readonly HealthLessonFlowSegment[]
  readonly studentActivity: string
  readonly formativeCheck: string
  readonly answerOrScoringGuidance: string
  readonly adaptiveTutorRoutes: readonly HealthAdaptiveTutorRoute[]
  readonly masteryRule: string
  readonly extension: string
  readonly accessibilityAndAccommodations: readonly string[]
  readonly safetyAndPrivacy: readonly string[]
  readonly media: HealthLessonMedia
  readonly parentOrGuardianVisibility: string
  readonly homeConnection: string
}

export interface HealthUnit {
  readonly unitId: string
  readonly courseId: string
  readonly grade: HealthGrade
  readonly unitNumber: number
  readonly title: string
  readonly days: number
  readonly standards: readonly string[]
  readonly essentialQuestion: string
  readonly topics: readonly string[]
  readonly performanceTask: string
  readonly assessmentId: string | null
  /** Lesson ids in this unit, in completion order. */
  readonly lessonIds: readonly string[]
}

export interface HealthCourse {
  readonly courseId: string
  readonly grade: HealthGrade
  readonly title: string
  readonly description: string
  readonly units: readonly HealthUnit[]
  /** Every lesson in the course, course_day-ordered end to end. */
  readonly lessons: readonly HealthLesson[]
}

export interface HealthCatalog {
  readonly releaseVersion: string
  /** One course per published grade, in grade order. */
  readonly courses: readonly HealthCourse[]
}

/** Signals the canonical content's own adaptive_tutor_routes are written against. */
export type HealthAdaptiveTutorSignal =
  | 'prerequisite gap'
  | 'procedure without understanding'
  | 'correct but low confidence'
  | 'repeated error pattern'
  | 'mastery evidence'

/** A guardian-facing marker derived from a lesson and its unit. Never carries learner text. */
export interface HealthGuardianVisibility {
  readonly lessonId: string
  readonly unitId: string
  /** The curriculum's own guardian-visibility guidance for this lesson. */
  readonly summary: string
  /** True when the unit covers a safety-, consent-, substance-, or sexual-health-adjacent topic. */
  readonly safetyCritical: boolean
  /** True when a guardian confirmation should be recorded before this lesson is treated as complete. */
  readonly requiresGuardianConfirmation: boolean
}
