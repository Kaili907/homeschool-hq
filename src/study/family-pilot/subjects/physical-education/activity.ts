import type { AcademyGrade } from '../../../../types'
import type { PhysicalEducationLesson } from './types'

/**
 * FF-M5 — the activity/task representation. A PE lesson is presented to the
 * host as a physical activity with phases, not as a quiz with questions: no
 * field here carries a correct answer, a score, or a question bank.
 */

export interface PhysicalEducationActivityPhase {
  readonly phaseRef: string
  readonly title: string
  readonly estimatedMinutes: string
  readonly guidance: string
}

export interface PhysicalEducationActivity {
  readonly activityRef: string
  readonly title: string
  readonly grade: AcademyGrade
  readonly unitTitle: string
  readonly focus: string
  readonly essentialQuestion: string
  readonly estimatedMinutes: string
  readonly materials: readonly string[]
  readonly phases: readonly PhysicalEducationActivityPhase[]
  /** Inclusive/adapted movement alternatives, always present. */
  readonly accessibleAlternatives: readonly string[]
  readonly safetyMarkers: readonly string[]
  readonly requiresMediaProof: false
  readonly requiresBodyMeasurement: false
  readonly requiresPublicPerformance: false
}

export function toActivity(lesson: PhysicalEducationLesson): PhysicalEducationActivity {
  return Object.freeze({
    activityRef: lesson.lessonId,
    title: lesson.title,
    grade: lesson.grade,
    unitTitle: lesson.unitTitle,
    focus: lesson.focus,
    essentialQuestion: lesson.essentialQuestion,
    estimatedMinutes: lesson.estimatedMinutes,
    materials: lesson.materials,
    phases: Object.freeze(lesson.lessonFlow.map((phase, index) => Object.freeze({
      phaseRef: `${lesson.lessonId}:phase:${index + 1}`,
      title: phase.segment,
      estimatedMinutes: phase.minutes,
      guidance: phase.guidance,
    }))),
    accessibleAlternatives: lesson.accessibilityAndAccommodations,
    safetyMarkers: lesson.safetyAndPrivacy,
    requiresMediaProof: false,
    requiresBodyMeasurement: false,
    requiresPublicPerformance: false,
  })
}
