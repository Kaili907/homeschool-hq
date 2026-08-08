/**
 * STUDY-A1-PROD-TUTOR-WRAPPER — the one seam Tutor prose crosses to reach a
 * learner's screen.
 *
 * Production is the first path on which actual Tutor Core prose is shown to a
 * child. On the preview path it never was: `runtimeFacade.submit` throws the
 * Core's utterance away and substitutes one of two fixed host sentences
 * (runtimeFacade.ts:494), so nothing a Tutor wrote had ever been rendered.
 *
 * React already escapes a string child, so the risk being closed here is not
 * that a `<script>` in Tutor prose executes — it does not. The risk is the
 * TYPE. `ReactNode` is far wider than `string`: an element, an array of
 * elements, an object with `$$typeof`. A value of that shape is not escaped,
 * because there is nothing to escape — it is rendered as structure. The moment
 * the presentation path accepts `ReactNode`, an out-of-process Tutor's output
 * is a component tree with a props object, and `dangerouslySetInnerHTML` is one
 * such prop.
 *
 * So the seam is narrowed to `string` and closed on both sides:
 *
 *  - at compile time, because the parameter is `string` and `ReactNode`,
 *    `object` and `unknown` do not fit it. ./tutorPresentation.test.tsx pins
 *    that with `@ts-expect-error`, which fails the typecheck if the narrowing is
 *    ever widened.
 *  - at runtime, because a compile-time bound is exactly as strong as the
 *    weakest `as any` on the path to it, and an `as any` is a single word. The
 *    check below is what a cast cannot get past.
 *
 * The existing `StudyTutorSafetySurface` in
 * src/components/study/StudySessionContainer.tsx already declares
 * `visibleText: string`, so it is not widened here — it is pinned, per this
 * card's Phase 11.
 */

/**
 * Transient learner-facing presentation for one Tutor turn.
 *
 * Deliberately a string and not a node, and deliberately not persisted: nothing
 * durable takes this value, and `StudyTutorResult` has no transcript field for
 * it to accumulate in. It lives in mount-local surface state for as long as the
 * mount lasts and no longer.
 */
export interface StudyTutorLearnerPresentation {
  readonly visibleText: string
}

/**
 * The runtime half of the narrowing.
 *
 * `null` means "not presentable", which the caller turns into a structural
 * quarantine. It is returned for anything that is not a primitive string —
 * including a boxed `String`, a React element, and an object whose `toString`
 * would print a sentence. Nothing is coerced: `String(value)` would let that
 * last one through, and it is the object, with everything it closed over, that
 * would then be handed to the surface.
 */
export function studyTutorLearnerPresentation(visibleText: string): StudyTutorLearnerPresentation | null {
  // Typed `string`, and checked anyway. The parameter type stops every caller
  // that is honest about what it holds; this stops the one that wrote `as any`.
  if (typeof visibleText !== 'string') return null
  if (visibleText.trim() === '') return null
  return Object.freeze({ visibleText })
}
