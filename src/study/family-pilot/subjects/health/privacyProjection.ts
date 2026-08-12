import { deriveGuardianVisibility } from './guardianVisibility'
import type { HealthLesson, HealthLessonFlowSegment, HealthUnit } from './types'

/**
 * Privacy/safety projection for Health.
 *
 * The canonical curriculum content is already written to be private-safe
 * (every lesson's own safety_and_privacy field says not to require body,
 * diagnosis, trauma, or family disclosure), so this module does two things:
 *
 *  1. Project a lesson down to the fields a student surface or a guardian
 *     surface should actually see, rather than passing the full authoring
 *     record through — scoring guidance and internal tutor routing stay
 *     server/adapter-side.
 *  2. Assert, as a defense-in-depth content-integrity check, that no lesson
 *     text asks for body measurements, a diagnosis, or sexual-history
 *     disclosure, and that no lesson requires media. This runs over the full
 *     108-lesson catalog in tests so a future content change that violates
 *     the boundary fails loudly instead of shipping.
 */

export interface HealthLessonStudentProjection {
  readonly lessonId: string
  readonly grade: HealthLesson['grade']
  readonly unitNumber: number
  readonly unitTitle: string
  readonly title: string
  readonly focus: string
  readonly essentialQuestion: string
  readonly learningObjectives: readonly string[]
  readonly successCriteria: readonly string[]
  readonly materials: readonly string[]
  readonly lessonFlow: readonly HealthLessonFlowSegment[]
  readonly studentActivity: string
  readonly formativeCheck: string
  readonly extension: string
  readonly accessibilityAndAccommodations: readonly string[]
  readonly safetyAndPrivacy: readonly string[]
  readonly mediaRequired: false
  readonly homeConnection: string
  /** Always false: this projection never carries learner-authored text. */
  readonly rawLearnerTextIncluded: false
  /** Always false: no body-measurement field exists in this projection. */
  readonly bodyMeasurementIncluded: false
}

export interface HealthLessonGuardianProjection {
  readonly lessonId: string
  readonly unitId: string
  readonly title: string
  readonly unitTitle: string
  readonly summary: string
  readonly safetyCritical: boolean
  readonly requiresGuardianConfirmation: boolean
  readonly rawLearnerTextIncluded: false
}

export function projectHealthLessonForStudy(lesson: HealthLesson): HealthLessonStudentProjection {
  return {
    lessonId: lesson.lessonId,
    grade: lesson.grade,
    unitNumber: lesson.unitNumber,
    unitTitle: lesson.unitTitle,
    title: lesson.title,
    focus: lesson.focus,
    essentialQuestion: lesson.essentialQuestion,
    learningObjectives: lesson.learningObjectives,
    successCriteria: lesson.successCriteria,
    materials: lesson.materials,
    lessonFlow: lesson.lessonFlow,
    studentActivity: lesson.studentActivity,
    formativeCheck: lesson.formativeCheck,
    extension: lesson.extension,
    accessibilityAndAccommodations: lesson.accessibilityAndAccommodations,
    safetyAndPrivacy: lesson.safetyAndPrivacy,
    mediaRequired: false,
    homeConnection: lesson.homeConnection,
    rawLearnerTextIncluded: false,
    bodyMeasurementIncluded: false,
  }
}

export function projectHealthLessonForGuardian(lesson: HealthLesson, unit: HealthUnit): HealthLessonGuardianProjection {
  const visibility = deriveGuardianVisibility(lesson, unit)
  return {
    lessonId: visibility.lessonId,
    unitId: visibility.unitId,
    title: lesson.title,
    unitTitle: lesson.unitTitle,
    summary: visibility.summary,
    safetyCritical: visibility.safetyCritical,
    requiresGuardianConfirmation: visibility.requiresGuardianConfirmation,
    rawLearnerTextIncluded: false,
  }
}

export class HealthPrivacyViolationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HealthPrivacyViolationError'
  }
}

/**
 * Narrow, high-precision patterns for actual disclosure/measurement
 * *requests*, not mere topic mentions — a lesson may educationally discuss
 * "reproductive health" or "substance use" without ever asking a learner to
 * disclose their own body, diagnosis, or sexual history.
 */
const DISALLOWED_TEXT_PATTERNS: readonly RegExp[] = [
  // Body measurement disclosure
  /how (much|many) (do you weigh|pounds|kilograms)/i,
  /what('?s| is) your (weight|height|bmi|body mass index)/i,
  /record your (weight|height|measurements|body)/i,
  /enter your (weight|height|measurements)/i,
  /your (weight|height) is/i,
  // Diagnosis disclosure or inference
  /have you (ever )?been diagnosed/i,
  /diagnosed with/i,
  /your diagnosis/i,
  /have you (ever )?felt suicidal/i,
  /(thoughts of|thinking about) (harming|hurting|killing) yourself/i,
  // Sexual-history / substance-use disclosure
  /have you (ever )?(had sex|used drugs|used alcohol|tried drugs|tried alcohol|tried (nicotine|cannabis))/i,
  /are you (currently )?sexually active/i,
  /do you (use|take|drink) (drugs|alcohol|nicotine|cannabis)/i,
  /describe your sexual (history|experience|partner)/i,
  // Photo / voice / camera capture
  /upload a photo/i,
  /take a (photo|picture|selfie)/i,
  /snap a (photo|picture|selfie)/i,
  /(send|post|share) (a |us )?(photo|picture|selfie) of yourself/i,
  /record (your|a video of) (yourself|your voice)/i,
  /turn on your camera/i,
]

function collectLessonText(lesson: HealthLesson): readonly string[] {
  return [
    lesson.title,
    lesson.focus,
    lesson.essentialQuestion,
    ...lesson.learningObjectives,
    ...lesson.successCriteria,
    ...lesson.materials,
    ...lesson.lessonFlow.map((segment) => segment.teacherOrTutorAction),
    lesson.studentActivity,
    lesson.formativeCheck,
    lesson.answerOrScoringGuidance,
    ...lesson.adaptiveTutorRoutes.map((route) => route.action),
    lesson.masteryRule,
    lesson.extension,
    ...lesson.accessibilityAndAccommodations,
    ...lesson.safetyAndPrivacy,
    lesson.media.suggestion,
    lesson.media.fallback,
    lesson.parentOrGuardianVisibility,
    lesson.homeConnection,
  ]
}

/**
 * Throws HealthPrivacyViolationError if the lesson requires media, or if any
 * of its text asks a learner to disclose body measurements, a diagnosis, or
 * sexual history. Intended to run over every lesson in the catalog as a
 * content-integrity test, not as a per-request runtime check.
 */
export function assertNoDisallowedHealthFields(lesson: HealthLesson): void {
  if (lesson.media.required !== false) {
    throw new HealthPrivacyViolationError(`${lesson.lessonId} marks media as required; Health must never require media.`)
  }
  for (const text of collectLessonText(lesson)) {
    for (const pattern of DISALLOWED_TEXT_PATTERNS) {
      if (pattern.test(text)) {
        throw new HealthPrivacyViolationError(
          `${lesson.lessonId} contains disallowed disclosure/measurement language matching ${pattern}: "${text}"`,
        )
      }
    }
  }
}
