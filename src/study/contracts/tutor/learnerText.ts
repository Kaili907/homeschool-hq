/**
 * STUDY-A1-TUTOR-CONTRACT-H3 — the learner's own words, bounded where the
 * bridge bounds them.
 *
 * H2 closed the reference fields (F2) and the accepted result's prose (F3), and
 * left one field still declared as a bare `string`: `transientLearnerText`. The
 * independent H2 review was right that this is a real remaining blocker, and it
 * is the same defect shape as STUDY-A1-SESSIONREF-C rather than a new one.
 *
 * What actually happens today. The bridge's pre-core gateway
 * (`evaluatePreCoreUrgentSafety`, the first thing `orchestrateStudyCoreBridge`
 * calls, reached from runtimeFacade.ts:346) refuses over-long learner text
 * BEFORE any classifier runs, and shapes that refusal as `stop-invalid-input`.
 * The host cannot tell that apart from a real safety stop: runtimeFacade turns a
 * non-accepted bridge result into `stoppedResult('invalid', ...)`, which the
 * mounted surface writes to the durable safety-stop event and locks behind.
 *
 * So a girl who pastes her worked-out long-division answer, or a chatty
 * paragraph, gets told to go and find a trusted adult, is locked across
 * refreshes, and her dad is shown a safety incident that never happened. She
 * wrote nothing wrong. The classifier never looked at her.
 *
 * The rule below is DERIVED from the bridge, not from the review report. Read
 * off `evaluatePreCoreUrgentSafety` and its `normalizeTransientText`:
 *
 *   typeof !== 'string'                        -> stop-invalid-input
 *   raw .length > 4000                         -> stop-invalid-input
 *   normalized form empty                      -> stop-invalid-input
 *   normalized form .length > 4000             -> stop-invalid-input
 *
 * and, deliberately, nothing else. Newlines are permitted. NUL and other
 * control characters are permitted. Punctuation-only input is permitted. Astral
 * characters, RTL text and combining marks are permitted, and the measure is
 * UTF-16 code units on both sides, so `.length` here and `.length` there cannot
 * disagree about a given string. Every one of those was checked against the
 * bridge rather than assumed, and each is pinned in ./bridgeCompatibility.test.ts.
 *
 * This restates the bridge rule instead of reusing it, which ./refs.ts was able
 * to do. That is forced: the contract may not import Tutor Core or the bridge
 * (PROD_TUTOR_WRAPPER_REMAINS_SEPARATE, held by the isolation test in
 * ./runtime.test.ts), and there is no Study-level statement of this rule the way
 * `isStudyBridgeOpaqueId` is one for opaque identifiers. A restatement is a
 * drift surface, so the drift is closed the only other honest way: a differential
 * test runs both this predicate and the real gateway over the same corpus and
 * requires them to agree exactly.
 */

/** The bridge's `MAX_TRANSIENT_INPUT_LENGTH`. Pinned against it in the tests. */
export const STUDY_TUTOR_LEARNER_TEXT_MAX_LENGTH = 4_000

declare const STUDY_TUTOR_LEARNER_TEXT_BRAND: unique symbol

/**
 * Learner text the bridge will accept.
 *
 * Branded with an unexported `unique symbol`, exactly like `StudyTutorRef`: it
 * cannot be written down, only produced by `parseStudyTutorLearnerText`. It
 * stays a primitive `string` at runtime, so nothing downstream unwraps it and
 * nothing has to remember it was validated.
 */
export type StudyTutorLearnerText = string & {
  readonly [STUDY_TUTOR_LEARNER_TEXT_BRAND]: 'study-tutor.learner-text'
}

/** The code points the bridge discards before deciding the text is empty. */
const BRIDGE_DISCARDED = /[\u200B-\u200D\u2060\uFEFF]/gu

/**
 * The form the bridge measures, and only the form it measures.
 *
 * `normalizeTransientText` also folds curly quotes to `'`, folds the dash block
 * to `-`, and — after the check this mirrors — collapses punctuation runs. None
 * of that is reproduced here, and none of it needs to be: the quote and dash
 * folds are one character to one character, so they cannot change a length or
 * empty a string, and the punctuation collapse happens after the bridge has
 * already decided. What is left is exactly the length and the emptiness the
 * bridge tests, with no content rule in it. This contract adds no censorship of
 * its own; it decides how much a learner may say, never what.
 *
 * `null` on a throw rather than a throw through the caller, per the same rule
 * `parseStudyTutorResult` follows: this sits on the path that builds a turn for
 * a child, and a validator that throws is a validator a caller routes around.
 */
function bridgeMeasuredForm(value: string): string | null {
  try {
    return value
      .normalize('NFKC')
      .replace(BRIDGE_DISCARDED, '')
      .replace(/\s+/gu, ' ')
      .trim()
      .toLowerCase()
  } catch {
    return null
  }
}

/**
 * Total, and coerces nothing.
 *
 * The `typeof` check is load-bearing for the same reason it is in ./refs.ts: a
 * boxed `String`, or an object whose `toString` prints a sentence, must be
 * refused rather than printed. It is the object that would travel, and
 * everything it closed over with it — and this is the field a learner's actual
 * words live in, so the object arriving here is the one most worth refusing.
 *
 * The raw-length check is separate from the measured one on purpose: the bridge
 * applies its bound to the raw string first, so a 5,000-character value that
 * only measures 3,000 after normalization is still refused there and must be
 * refused here.
 */
export function isStudyTutorLearnerText(value: unknown): value is StudyTutorLearnerText {
  if (typeof value !== 'string') return false
  if (value.length > STUDY_TUTOR_LEARNER_TEXT_MAX_LENGTH) return false
  const measured = bridgeMeasuredForm(value)
  return measured !== null &&
    measured.length > 0 &&
    measured.length <= STUDY_TUTOR_LEARNER_TEXT_MAX_LENGTH
}

/**
 * The only way to make a `StudyTutorLearnerText`.
 *
 * Over-long text is REJECTED, never truncated. Truncation would cut a child's
 * sentence off mid-word and send the stump to a Tutor as though she had written
 * it — and the Tutor would answer the stump. `null` lets the host say "that is
 * too long, try a shorter answer" in its own words, which is a thing a learner
 * can act on, instead of a safety stop that is a thing she cannot.
 *
 * `null` rather than a throw, and nothing is normalized on the way through: what
 * the learner typed is what the Tutor is given.
 */
export function parseStudyTutorLearnerText(value: unknown): StudyTutorLearnerText | null {
  return isStudyTutorLearnerText(value) ? value : null
}
