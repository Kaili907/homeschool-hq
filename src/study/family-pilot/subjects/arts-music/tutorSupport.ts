/**
 * ARTS-MUSIC-1 — Tutor/static-help capability for Arts & Music.
 *
 * Tutor Core (src/tutor/*) is written for math and is gated to it in
 * tutor/tutorBridge.ts's canHelp: `if (context.subject !== 'math') return
 * { path: 'static-fallback', ... }`. Every Arts & Music help request already
 * routes to that static fallback with no change needed here — this module
 * is what fills that fallback with subject-appropriate content instead of
 * the generic "take a breath" copy in tutor/staticFallback.ts.
 *
 * BOUNDARIES: the Tutor may teach concepts, critique against the unit's own
 * rubric, and suggest a revision — it must never author, complete, or
 * rewrite the learner's work. Every function below is a fixed template
 * filled in with short curriculum fields (a focus phrase, a rubric
 * dimension label) that are already part of the licensed curriculum
 * content; none accepts or echoes arbitrary external text, so there is
 * nothing here that could inject copyrighted lyrics, sheet music, or other
 * protected material. There is no model call and no free-form input.
 */

export interface ArtsMusicConceptGuidance {
  readonly lessonId: string
  readonly focus: string
  readonly guidance: string
}

export function artsMusicConceptGuidance(lesson: { readonly lessonId: string; readonly focus: string }): ArtsMusicConceptGuidance {
  return {
    lessonId: lesson.lessonId,
    focus: lesson.focus,
    guidance: `Focus on ${lesson.focus}. Explain the idea in your own words, give one example, and connect it to what you already know before you start creating or performing.`,
  }
}

export interface ArtsMusicRubricCritique {
  readonly dimension: string
  readonly prompt: string
}

/** Question prompts only — never a rewritten or completed version of the
 * learner's work. Keyed by the rubric_dimensions labels every unit
 * assessment already carries (accessments.json). */
const CRITIQUE_PROMPT_BY_DIMENSION: Readonly<Record<string, string>> = {
  'accuracy or fidelity': 'Does this match the technique or idea you were asked to show? Point to one specific detail that proves it.',
  'evidence and reasoning': 'What evidence or reasoning explains the choice you made? Could you explain it to someone who was not there?',
  'application or performance': 'Where does this apply the skill in a new or full way, not just a repeated example?',
  'checking and revision': 'What did you check or revise, and what would you change if you tried again?',
}

const DEFAULT_CRITIQUE_PROMPT = 'Compare your work to the success criteria for this lesson. What is strong, and what is one specific next step?'

export function artsMusicRubricCritique(rubricDimensions: readonly string[]): readonly ArtsMusicRubricCritique[] {
  return rubricDimensions.map((dimension) => ({
    dimension,
    prompt: CRITIQUE_PROMPT_BY_DIMENSION[dimension.toLowerCase()] ?? DEFAULT_CRITIQUE_PROMPT,
  }))
}

/** A prompt to revise, never a revision the Tutor performs for the learner. */
export function artsMusicRevisionSuggestion(dimension: string): string {
  return `Look again at ${dimension}. Name one specific change, make it, and compare the before and after.`
}

/**
 * The static Study-help fallback for Arts & Music — fixed copy, no model
 * call, used whenever a learner asks for help on this subject (Tutor Core
 * never takes this turn; see tutor/tutorBridge.ts's canHelp). Consistent
 * with tutor/staticFallback.ts's existing per-subject messages, but does
 * not modify that shared file.
 */
export function artsMusicStaticHelpMessage(): string {
  return 'Look back at the lesson steps and the success criteria. Try one small, specific revision, then compare it to the example — or ask a parent or teacher to look at it with you.'
}
