import type { PhysicalEducationLesson } from './types'

/**
 * FF-M5 — Tutor/static explanation capability. PE assignments are
 * completion-only and subject 'other' (see studyAdapter.ts), so
 * familyPilotTutorBridgeAvailable() is always false for them: there is no
 * adaptive Tutor Core turn to bridge to. This is the static substitute —
 * plain curriculum-authored explanatory text, not an AI-adaptive quiz loop,
 * matching the RULES against turning physical activity into a fake online
 * quiz course.
 */

export interface PhysicalEducationStaticExplanationStep {
  readonly title: string
  readonly guidance: string
}

export interface PhysicalEducationStaticExplanation {
  readonly lessonRef: string
  readonly essentialQuestion: string
  readonly focus: string
  readonly steps: readonly PhysicalEducationStaticExplanationStep[]
  readonly source: 'static-curriculum-content'
}

export function staticTutorExplanation(lesson: PhysicalEducationLesson): PhysicalEducationStaticExplanation {
  return Object.freeze({
    lessonRef: lesson.lessonId,
    essentialQuestion: lesson.essentialQuestion,
    focus: lesson.focus,
    steps: Object.freeze(lesson.lessonFlow.map((phase) => Object.freeze({
      title: phase.segment,
      guidance: phase.guidance,
    }))),
    source: 'static-curriculum-content',
  })
}
