import type { PhysicalEducationCompletionEvidence } from './completionEvidence'
import type { PhysicalEducationLesson } from './types'

/**
 * FF-M5 — guardian/safety markers. RULES: parent/guardian visibility stays
 * available for safety-sensitive activity, but Study never exposes raw
 * private reflections. This projection is scoped to one household/learner
 * pair (never a cross-learner aggregate) and carries only what the lesson's
 * own `parent_or_guardian_visibility` policy allows: target, completion
 * state, evidence kind, and safety markers.
 */

export interface PhysicalEducationGuardianProjection {
  readonly householdRef: string
  readonly learnerRef: string
  readonly lessonRef: string
  readonly title: string
  readonly focus: string
  readonly completionState: 'not-started' | 'in-progress' | 'completed'
  readonly evidenceKind: 'self-reported-completion' | null
  readonly visibilityPolicy: string
  readonly safetyMarkers: readonly string[]
  readonly accessibleAlternativesAvailable: boolean
  /** No text, audio, or written reflection is ever exposed to a guardian. */
  readonly rawReflectionIncluded: false
}

export function buildGuardianProjection(input: {
  readonly householdRef: string
  readonly learnerRef: string
  readonly lesson: PhysicalEducationLesson
  readonly completionState: 'not-started' | 'in-progress' | 'completed'
  readonly latestEvidence?: PhysicalEducationCompletionEvidence | null
}): PhysicalEducationGuardianProjection {
  if (!input.householdRef.trim()) throw new Error('householdRef is required.')
  if (!input.learnerRef.trim()) throw new Error('learnerRef is required.')
  const evidence = input.latestEvidence ?? null
  return Object.freeze({
    householdRef: input.householdRef,
    learnerRef: input.learnerRef,
    lessonRef: input.lesson.lessonId,
    title: input.lesson.title,
    focus: input.lesson.focus,
    completionState: input.completionState,
    evidenceKind: evidence ? evidence.evidenceKind : null,
    visibilityPolicy: input.lesson.parentOrGuardianVisibility,
    safetyMarkers: input.lesson.safetyAndPrivacy,
    accessibleAlternativesAvailable: input.lesson.accessibilityAndAccommodations.length > 0,
    rawReflectionIncluded: false,
  })
}
