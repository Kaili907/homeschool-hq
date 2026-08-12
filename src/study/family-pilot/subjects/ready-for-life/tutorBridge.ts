import type { RflLessonRef } from './types'

/**
 * FULL-FAMILY-READY-FOR-LIFE-TUTOR — coaching only, sourced from the
 * lesson's own authored adaptive_tutor_routes/extension/mastery_rule, never
 * invented. The Tutor may explain and coach a real-world task; it may never
 * claim the task itself was performed, checked, or confirmed — only a
 * guardian confirmation (completionEvidence.ts) can do that. This mirrors
 * ../../tutor/staticFallback.ts's "fixed copy, no model call" fallback
 * pattern for when live coaching isn't available.
 */

export interface RflTutorGuidance {
  readonly lessonId: string
  readonly coachingPrompts: readonly string[]
  readonly extensionIdea: string
  readonly masteryRule: string
  readonly staticFallbackMessage: string
}

/** Phrases that would falsely claim the real-world action itself happened,
 * was checked, or was confirmed — the one thing the Tutor is never allowed
 * to say. Coaching ("try wiping the counter first") is fine; certifying
 * ("I confirmed you finished") is not. Kept as separate, legible patterns
 * rather than one dense regex, each covering one shape of false claim. */
const COMPLETION_CLAIM_PATTERNS: readonly RegExp[] = [
  // First-person self-certification: "I confirmed/finished/did/performed/verified..."
  /\bi (?:have |)(?:completed|finished|did|performed|confirmed|verified)\b/i,
  // Stating the task/lesson/this/it as done, in any tense: "task is done", "this is now complete".
  /\b(?:this|it|task|lesson)(?:'s| is|'ve| have)? (?:now |all |)(?:done|complete|finished)\b/i,
  // "marked (this/it) (as) complete"
  /\bmarked (?:this |it |)(?:as |)complete\b/i,
  // "you've/you have finished/completed this/the task/lesson"
  /\byou(?:'ve| have) (?:finished|completed) (?:this|the) (?:task|lesson)\b/i,
  // "that/this counts as done/complete"
  /\b(?:that|this) counts as (?:done|complete)\b/i,
  // Any claim that a guardian's confirmation/sign-off/check already happened.
  /\bguardian[^.!?]{0,40}(?:confirmation|sign-off)[^.!?]{0,20}(?:recorded|received|given)\b/i,
  /\bguardian[^.!?]{0,40}(?:already |)(?:checked this|confirmed this|confirmed it|signed off)\b/i,
]

/** Guards Tutor output before it reaches a learner. Throws rather than
 * silently emitting a false real-world-action completion claim. */
export function assertNoCompletionClaim(tutorText: string): void {
  if (COMPLETION_CLAIM_PATTERNS.some((pattern) => pattern.test(tutorText))) {
    throw new Error('Tutor output must not claim a real-world action was performed or confirmed.')
  }
}

/** Fixed copy, no model call — always available, matches the Family Pilot
 * Tutor's static-fallback convention. Runs through the same completion-claim
 * guard as everything else this module emits, even though it's static copy
 * this module itself authored — no exception for "we wrote it ourselves". */
export function readyForLifeStaticFallback(lesson: RflLessonRef): string {
  const message = `Take it one step at a time: ${lesson.focus}. If any part involves heat, sharp tools, appliances, chemicals, medication, transportation, or online accounts, ask a parent or guardian to be there with you.`
  assertNoCompletionClaim(message)
  return message
}

/** Every string surfaced to a learner is routed through
 * assertNoCompletionClaim before this function returns — the guard is
 * enforced here, not left as something a caller has to remember to apply. */
export function buildReadyForLifeTutorGuidance(lesson: RflLessonRef): RflTutorGuidance {
  const coachingPrompts = lesson.adaptiveTutorRoutes.map((route) => route.action)
  const extensionIdea = lesson.extension
  const masteryRule = lesson.masteryRule
  const staticFallbackMessage = readyForLifeStaticFallback(lesson)

  for (const prompt of coachingPrompts) assertNoCompletionClaim(prompt)
  assertNoCompletionClaim(extensionIdea)
  assertNoCompletionClaim(masteryRule)

  return Object.freeze({
    lessonId: lesson.lessonId,
    coachingPrompts: Object.freeze(coachingPrompts) as readonly string[],
    extensionIdea,
    masteryRule,
    staticFallbackMessage,
  })
}
