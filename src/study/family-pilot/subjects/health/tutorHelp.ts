import { isSafetyCriticalUnit } from './guardianVisibility'
import type { HealthAdaptiveTutorSignal, HealthLesson, HealthUnit } from './types'

/**
 * Health's Tutor/static-help capability.
 *
 * This is deliberately static-only: no signature here accepts learner
 * free text, so nothing in this module can infer a health status, a
 * diagnosis, or anything else from what a learner wrote — there is no input
 * for that to come from. The only "signal" this module ever sees is a fixed
 * enum the caller selects (mirroring the curriculum's own
 * adaptive_tutor_routes signals), never learner-authored text.
 *
 * Health never routes to a grading/model-backed tutor (see
 * src/study/family-pilot/tutor/tutorBridge.ts's canHelp, which already
 * limits that path to math). healthCanHelp exists so a caller can confirm
 * that structurally rather than by convention.
 */

export type HealthHelpPath = 'static-fallback'

export interface HealthHelpEligibility {
  readonly path: HealthHelpPath
  readonly reason: string
}

/** Always static-fallback: Health has no code path to a grading or clinical tutor. */
export function healthCanHelp(): HealthHelpEligibility {
  return {
    path: 'static-fallback',
    reason: 'Health uses curriculum-grounded static help only; it never routes to a grading or clinical tutor.',
  }
}

const GENERIC_HELP = 'Take a breath and try the next small step.'
const TRUSTED_ADULT_NUDGE =
  "If any part of this feels confusing, upsetting, or personal, it's okay to pause and talk with a parent, guardian, or trusted adult."

/**
 * Student-facing static help text. Grounded in the lesson's own focus, never
 * model-generated, never phrased as a clinical opinion. Adds a trusted-adult
 * nudge whenever the lesson's unit is safety-critical (see
 * guardianVisibility.ts), regardless of which signal was passed.
 */
export function healthStaticHelp(input: {
  readonly lesson: HealthLesson
  readonly unit: HealthUnit
}): string {
  const base = `${GENERIC_HELP} This lesson is about ${input.lesson.focus} — try the guided example again, or ask a parent, guardian, or teacher to work through it with you.`
  return isSafetyCriticalUnit(input.unit) ? `${base} ${TRUSTED_ADULT_NUDGE}` : base
}

/**
 * The curriculum's own adaptive_tutor_routes guidance for one signal — meant
 * for the adult facilitating the lesson (parent, tutor, teacher), not as
 * student-facing chat copy. Returns null when the lesson has no route for
 * that signal; callers should fall back to healthStaticHelp in that case.
 */
export function healthTutorGuidanceForSignal(
  lesson: HealthLesson,
  signal: HealthAdaptiveTutorSignal,
): string | null {
  return lesson.adaptiveTutorRoutes.find((route) => route.signal === signal)?.action ?? null
}
