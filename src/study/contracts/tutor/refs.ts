/**
 * STUDY-A1-TUTOR-CONTRACT-H2 — the reference a Tutor may be given.
 *
 * Review finding F2: every Tutor-facing reference was declared as plain
 * `string` and its bound lived in a comment. A comment does not stop a host
 * from passing the durable Study session reference straight through, and that
 * exact mistake is a reproduced defect: the bridge refuses an identifier over
 * 128 characters *before* its classifier runs, shaped as `stop-invalid-input`,
 * and the host records that as a durable learner safety stop. A girl who typed
 * "ready" is locked across refreshes and her dad is shown a safety incident
 * that never happened (STUDY-A1-SESSIONREF-C).
 *
 * So the bound is made structural here. A `StudyTutorRef` cannot be written
 * down; it can only be produced by `parseStudyTutorRef`, which is the single
 * place the rule is applied.
 *
 * The rule itself is NOT restated. `isStudyBridgeOpaqueId` in
 * src/study/studyRequestRef.ts is the approved Study-level statement of the
 * bridge's `validOpaqueId`, it is already inside this contract's import
 * boundary (../results.ts uses it for `eventRef`), and reusing it is what makes
 * drift impossible rather than merely tested for. Nothing here reaches into the
 * bridge implementation: PROD_TUTOR_WRAPPER_REMAINS_SEPARATE.
 *
 * Which fields this type covers was derived, not assumed. Each one below is
 * validated by the bridge against that same rule, and each failure mode was
 * read off the bridge rather than guessed:
 *
 *   sessionRef  bridge `sessionId`  validOpaqueId + isStudyId  -> stop-invalid-input
 *   requestRef  bridge `eventId`    validOpaqueId              -> stop-invalid-input
 *   lessonRef   bridge `lessonId`   isStudyId                  -> quarantine
 *   segmentRef  bridge `segmentId`  isStudyId                  -> quarantine
 *   skillRef    bridge `skillId`    isStudyId                  -> quarantine
 *
 * `lessonRef` was checked for a bound of its own and does not have one: the
 * bridge validates it with the identical 128-character rule, so it is not being
 * forced into the wrong shape. The first two are the severe pair — a refusal
 * there becomes a durable safety stop about a child — and the last three fail
 * closed as quarantine. All five are bounded because all five are bridge-facing
 * and the rule is one rule.
 *
 * `eventRef` on an accepted result is deliberately NOT this type. A result
 * arrives from outside and is established by parsing, which
 * `parseStudyTutorResult` already does against the same rule; branding it would
 * invite a wrapper to mint the brand by hand instead of parsing.
 */
import { STUDY_BRIDGE_OPAQUE_ID_MAX_LENGTH, isStudyBridgeOpaqueId } from '../../studyRequestRef'

/** The bridge's own bound, re-exported so a caller need not reach past this module. */
export const STUDY_TUTOR_REF_MAX_LENGTH = STUDY_BRIDGE_OPAQUE_ID_MAX_LENGTH

declare const STUDY_TUTOR_REF_BRAND: unique symbol

/**
 * A string the bridge will accept as an opaque identifier.
 *
 * The brand is an unexported `unique symbol`, so this type cannot be produced
 * by writing an object literal — only by `parseStudyTutorRef`. It stays a
 * primitive `string` at runtime, so it needs no unwrapping and nothing
 * downstream has to know it was validated.
 */
export type StudyTutorRef = string & { readonly [STUDY_TUTOR_REF_BRAND]: 'study-tutor.ref' }

/**
 * Total, and coerces nothing.
 *
 * The `typeof` check is the whole reason this is not just the bridge predicate:
 * a boxed `String`, or an object whose `toString` prints an approved reference,
 * must be refused rather than printed. It is the object that would travel, and
 * everything it closed over with it.
 */
export function isStudyTutorRef(value: unknown): value is StudyTutorRef {
  return typeof value === 'string' && isStudyBridgeOpaqueId(value)
}

/**
 * The only way to make a `StudyTutorRef`.
 *
 * `null` means "not admissible as a Tutor reference" — the caller decides
 * whether that is a refusal, a quarantine, or a host bug. Deliberately not a
 * throw: this sits on the path that builds a turn for a child, and a validator
 * that throws is a validator a caller routes around.
 */
export function parseStudyTutorRef(value: unknown): StudyTutorRef | null {
  return isStudyTutorRef(value) ? value : null
}
