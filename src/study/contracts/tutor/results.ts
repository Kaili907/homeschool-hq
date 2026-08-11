/**
 * STUDY-A1-TUTOR-CONTRACT — runtime validation of a Tutor result.
 *
 * A production Tutor wrapper is out-of-process work the host does not own, so
 * its output is untrusted the moment it crosses this boundary. This module is
 * where that output stops being unknown.
 *
 * Validate and rebuild in ONE pass, per the pattern that
 * `narrowedInterruption` in src/study/runtimeFacade.ts settled: each field is
 * read exactly once and the value that is KEPT is the value that was CHECKED,
 * so an own accessor cannot answer the check with an approved string and then
 * hand something else to whatever is built afterwards. Only primitives and
 * frozen rebuilt objects leave here, so the caller's object never travels on.
 *
 * Nothing is coerced. A `String(...)` around a check lets an object whose
 * `toString` prints an approved value through, and it is the object — not the
 * text it printed — that then travels, along with everything it closed over.
 *
 * `null` means "not a Tutor result". It is not an error and it is not a stop:
 * the host fails the turn closed and records nothing about the learner, which
 * is the safe direction. Over-rejecting costs a retry; under-rejecting lets an
 * unvouched-for shape reach durable Study state.
 */
import { isStudyBridgeOpaqueId } from '../../studyRequestRef'
import type { StudyRuntimeInterruption } from '../../types'
import type { StudyTutorAdultHelpDelivery, StudyTutorResult } from './runtime'

/**
 * Short, lower-case, machine vocabulary: no spaces, no capitals, no sentence
 * punctuation. The host writes a stop's code straight into the durable
 * safety-stop event, so this is what keeps a learner's words out of it. Every
 * code the preview emits already satisfies it — `mounted-input-safety-urgent`,
 * `bridge-stop-for-uncertain-adult-review`, `identity-binding-mismatch`.
 */
export const STUDY_TUTOR_REASON_CODE_MAX_LENGTH = 64
const REASON_CODE = /^[a-z0-9]+(?:[-:][a-z0-9]+)*$/

export function isStudyTutorReasonCode(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length <= STUDY_TUTOR_REASON_CODE_MAX_LENGTH &&
    REASON_CODE.test(value)
}

/**
 * The upper bound on one turn's learner-facing prose (review finding F3).
 *
 * Derived, not invented. The approved Tutor Core event validation already bounds
 * the learner-facing utterance — `spokenTurn.text` and its `fallbackText` — at
 * 2500 characters (`validateSpokenTurn` in the tutor-core bridge's
 * validation.ts), and `visibleText` is exactly that value's role on the host
 * side: what the surface renders as `currentUtterance` for one turn. The bridge
 * counts UTF-16 code units, so `.length` here is the same unit and the two
 * bounds cannot disagree about a given string.
 *
 * Below, this field was bounded only from beneath: non-empty, and nothing else.
 * A Tutor could return two million characters and the host would hold every one
 * of them in surface state and render them to a ten-year-old.
 *
 * Oversized output is REJECTED, never truncated. Truncation would cut a Tutor's
 * sentence in half in front of a learner, and — worse — would launder an
 * output the host had already decided it could not vouch for into a shorter one
 * it then treats as accepted. `null` here lets the host quarantine instead.
 */
export const STUDY_TUTOR_VISIBLE_TEXT_MAX_LENGTH = 2_500

declare const STUDY_TUTOR_VALIDATED_RESULT_BRAND: unique symbol

/**
 * STUDY-A1-TUTOR-CONTRACT-H3 Phase 8 — a result this contract has actually seen.
 *
 * H2 made the fail-closed crossing short (`acceptStudyTutorResult`) but left
 * using it a convention: `StudyTutorResult` is a structural type, so a wrapper
 * could declare its transport's output to be one, or build an object literal
 * that happens to fit, and hand the host a value nothing had validated. Every
 * sentence in the contract would still have been true.
 *
 * This is that shape plus a brand, and the brand is an unexported `unique
 * symbol`. `StudyTutorRuntime.submit` returns THIS type, so a wrapper cannot
 * express its result without a value one of the two parsers below returned —
 * not by writing a literal, and not by a single `as` from its transport's
 * output, because an `unknown` and an object literal alike are missing a
 * property no module outside this one can name.
 *
 * Deliberately not solved by widening the return to `unknown` or `any`, and
 * deliberately no exported cast: those would each move the problem rather than
 * close it. The brand distributes over the union, so all four branches still
 * narrow on `status` exactly as before.
 */
export type ValidatedStudyTutorResult = StudyTutorResult & {
  readonly [STUDY_TUTOR_VALIDATED_RESULT_BRAND]: 'study-tutor.validated-result'
}

/**
 * Module-private, and the only place the brand is applied.
 *
 * This is not a general cast helper and could not be used as one: it takes a
 * `StudyTutorResult`, not an `unknown`, so nothing external can be laundered
 * through it — the caller would have to have produced a contract-shaped value
 * first, and the only such values in this module are the frozen ones rebuilt
 * field by field below. Exporting it would hand a wrapper exactly the bypass
 * the brand exists to remove, so it is not exported.
 */
function validated(result: StudyTutorResult): ValidatedStudyTutorResult {
  return result as ValidatedStudyTutorResult
}

/** Exact per branch. An extra key — including any forbidden one — is a rejection. */
export const STUDY_TUTOR_RESULT_KEYS = Object.freeze({
  accepted: Object.freeze(['status', 'eventRef', 'visibleText']),
  stopped: Object.freeze(['status', 'reasonCode', 'deliveryStatus']),
  interrupted: Object.freeze(['status', 'interruption']),
  quarantined: Object.freeze(['status', 'reasonCode']),
})

const DELIVERY_STATUSES: ReadonlySet<string> =
  new Set<StudyTutorAdultHelpDelivery>(['proposed-not-delivered', 'not-confirmed'])

const SESSION_AUTHORIZATION_REASONS: ReadonlySet<string> =
  new Set<Extract<StudyRuntimeInterruption, { kind: 'session-authorization' }>['reason']>([
    'adult-authentication-rejected',
    'study-session-rejected',
  ])

/**
 * STUDY-A1-TUTOR-CONTRACT-H4 — the interruption set, derived from the type
 * rather than remembered.
 *
 * `narrowedInterruption` used to enumerate two kinds by hand. When
 * STUDY-A1-AUTH-INFRA-BOUNDARY added a third — `authorization-infrastructure`,
 * raised when the gateway's learner-authorization verifier cannot be reached —
 * nothing here noticed, and the parser turned a valid Study interruption into
 * `null`. `null` is not a silent failure at this boundary; it is a REJECTION,
 * so `acceptStudyTutorResult` converted an honest "the verifier was
 * unreachable, retry" into `quarantined` with a contract-parse failure code.
 * The host would then have shown a learner a structural fault where the true
 * state was a retryable outage — the very confusion the auth-infra card split
 * the kinds apart to prevent.
 *
 * A hand-written list is what allowed it, so this stops being hand-written. The
 * tuple below is the single canonical runtime statement of the kind set, and
 * the two assertions under it make `StudyRuntimeInterruption` its authority in
 * BOTH directions: a kind added to the union and not to the tuple fails to
 * compile, and a kind in the tuple that the union does not declare fails to
 * compile. Neither list can drift, because there is only one list and the type
 * audits it.
 *
 * It lives here rather than beside the type in src/study/types.ts deliberately.
 * That module is pure types today — it emits nothing — and giving it a runtime
 * value would put a new module in the App's bundle for every consumer of a type
 * import. This card owns src/study/contracts/tutor/** and changes nothing
 * outside it. The drift protection that proximity to the type would have bought
 * is bought instead by the assertions, which read the type directly.
 */
export const STUDY_TUTOR_INTERRUPTION_KINDS = Object.freeze([
  'session-authorization',
  'rate-limit',
  'authorization-infrastructure',
] as const)

type InterruptionKind = StudyRuntimeInterruption['kind']

/**
 * The kinds whose entire value is the kind — no reason, no payload — computed
 * from the union rather than listed. If a field is ever added to `rate-limit`
 * or `authorization-infrastructure`, that kind drops out of this type and the
 * assertion below fails, so the generic single-key branch can never silently
 * start accepting a member that has since grown a field.
 */
type BareInterruptionKind = {
  [K in InterruptionKind]: keyof Extract<StudyRuntimeInterruption, { kind: K }> extends 'kind' ? K : never
}[InterruptionKind]

const BARE_INTERRUPTION_KINDS = Object.freeze(['rate-limit', 'authorization-infrastructure'] as const)

/** Compiles only when its argument is `never`; the drift alarm. */
type Exhaustive<T extends never> = T

/*
 * The four aliases below are never referenced, and that is what they are for:
 * each one is a claim that its `Exclude` is empty, checked when the file is
 * typechecked. Nothing reads them at runtime and nothing should; deleting one
 * silently removes a guard, so each names precisely what it would catch.
 */
/** A kind the union declares and the tuple omits. */
type _EveryKindEnumerated =
  Exhaustive<Exclude<InterruptionKind, (typeof STUDY_TUTOR_INTERRUPTION_KINDS)[number]>>
/** A kind the tuple invents and the union does not declare. */
type _NoKindInvented =
  Exhaustive<Exclude<(typeof STUDY_TUTOR_INTERRUPTION_KINDS)[number], InterruptionKind>>
/** A payload-free kind the bare tuple omits. */
type _EveryBareKindEnumerated =
  Exhaustive<Exclude<BareInterruptionKind, (typeof BARE_INTERRUPTION_KINDS)[number]>>
/** A kind the bare tuple claims is payload-free when the union gives it fields. */
type _NoBareKindInvented =
  Exhaustive<Exclude<(typeof BARE_INTERRUPTION_KINDS)[number], BareInterruptionKind>>

const BARE_INTERRUPTION_KIND_SET: ReadonlySet<string> = new Set(BARE_INTERRUPTION_KINDS)

function isBareInterruptionKind(value: string): value is BareInterruptionKind {
  return BARE_INTERRUPTION_KIND_SET.has(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * `Reflect.ownKeys`, not `Object.keys`: own keys that are non-enumerable or
 * symbol-keyed are invisible to `Object.keys`, so a result could carry a
 * `transcript` or a `bearer` past an exact-key check that never saw it. The
 * rebuild below means such a field could not have travelled anyway, but a
 * result carrying one is not a result this contract admits — the shape is
 * wrong, and a shape this contract cannot vouch for is a rejection.
 *
 * It does not read values, so a getter cannot fire here and cannot count a
 * read against the single-read rule.
 */
function hasExactKeys(candidate: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Reflect.ownKeys(candidate)
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(candidate, key))
}

/**
 * The host's interruption set, narrowed and rebuilt. Closed on both sides: an
 * unrecognised kind, an unrecognised reason, a missing reason and any extra
 * field are all rejected.
 *
 * Every kind the union declares round-trips; nothing else does. The membership
 * test is `BARE_INTERRUPTION_KIND_SET`, derived above from the type, so adding
 * a payload-free kind to `StudyRuntimeInterruption` is enough to make it
 * round-trip here — and adding one that carries a payload fails to compile
 * rather than falling through to the single-key branch.
 *
 * Deliberately re-stated here rather than shared with the preview facade, whose
 * copy is module-private and belongs to a runtime this contract must not know
 * about.
 *
 * The single-read rule from the module header still holds exactly: `kind` and
 * `reason` are each read once, and the value REBUILT is the value that was
 * CHECKED, so an accessor cannot answer the check with one string and hand the
 * rebuild another.
 */
function narrowedInterruption(value: unknown): StudyRuntimeInterruption | null {
  if (!isRecord(value)) return null
  const keys = Reflect.ownKeys(value)
  const kind = value.kind
  if (typeof kind !== 'string') return null

  // Payload-free kinds: the kind IS the whole value, so an exact one-key shape
  // is the entire check. `rate-limit` and `authorization-infrastructure` are
  // both here, and a future one arrives without touching this function.
  if (isBareInterruptionKind(kind)) {
    return keys.length === 1 ? Object.freeze({ kind }) : null
  }

  if (kind !== 'session-authorization' || keys.length !== 2 || !Object.hasOwn(value, 'reason')) return null
  const reason = value.reason
  return typeof reason === 'string' && SESSION_AUTHORIZATION_REASONS.has(reason)
    ? Object.freeze({ kind, reason: reason as 'adult-authentication-rejected' | 'study-session-rejected' })
    : null
}

/**
 * The only way a Tutor result enters the host.
 *
 * Total: a throwing accessor on a hostile or simply broken implementation's
 * output is a rejection, not an exception thrown through the caller. That class
 * is not hypothetical here — a throwing getter has already once kept a stale
 * Study session authorizing — and a validator that can itself throw gives a
 * wrapper a way out of being validated.
 */
export function parseStudyTutorResult(value: unknown): ValidatedStudyTutorResult | null {
  try {
    if (!isRecord(value)) return null
    const status = value.status

    if (status === 'accepted') {
      if (!hasExactKeys(value, STUDY_TUTOR_RESULT_KEYS.accepted)) return null
      const eventRef = value.eventRef
      const visibleText = value.visibleText
      if (typeof eventRef !== 'string' || !isStudyBridgeOpaqueId(eventRef)) return null
      if (
        typeof visibleText !== 'string' ||
        visibleText.trim() === '' ||
        visibleText.length > STUDY_TUTOR_VISIBLE_TEXT_MAX_LENGTH
      ) return null
      return validated(Object.freeze({ status: 'accepted' as const, eventRef, visibleText }))
    }

    if (status === 'stopped') {
      if (!hasExactKeys(value, STUDY_TUTOR_RESULT_KEYS.stopped)) return null
      const reasonCode = value.reasonCode
      const deliveryStatus = value.deliveryStatus
      if (!isStudyTutorReasonCode(reasonCode)) return null
      if (typeof deliveryStatus !== 'string' || !DELIVERY_STATUSES.has(deliveryStatus)) return null
      return validated(Object.freeze({
        status: 'stopped' as const,
        reasonCode,
        deliveryStatus: deliveryStatus as StudyTutorAdultHelpDelivery,
      }))
    }

    if (status === 'interrupted') {
      if (!hasExactKeys(value, STUDY_TUTOR_RESULT_KEYS.interrupted)) return null
      const interruption = narrowedInterruption(value.interruption)
      return interruption === null
        ? null
        : validated(Object.freeze({ status: 'interrupted' as const, interruption }))
    }

    if (status === 'quarantined') {
      if (!hasExactKeys(value, STUDY_TUTOR_RESULT_KEYS.quarantined)) return null
      const reasonCode = value.reasonCode
      return isStudyTutorReasonCode(reasonCode)
        ? validated(Object.freeze({ status: 'quarantined' as const, reasonCode }))
        : null
    }

    return null
  } catch {
    return null
  }
}

/**
 * The reason code a result that failed the contract carries into quarantine.
 *
 * Structural and operator-facing, like every other quarantine code: it says the
 * Tutor's output could not be vouched for, and says nothing whatever about the
 * learner.
 */
export const STUDY_TUTOR_UNPARSED_RESULT_REASON_CODE = 'tutor-result-failed-contract-parse'

/**
 * STUDY-A1-TUTOR-CONTRACT-H2 Phase 5 — the whole crossing, in one call.
 *
 * Review finding F4: `parseStudyTutorResult` was opt-in. A wrapper could type
 * its own return as `StudyTutorResult` and hand the host an unvalidated object,
 * and nothing in the contract would have been violated on the way.
 *
 * This is the same validation with the fail-closed branch already chosen, so
 * the correct thing is also the short thing: a wrapper's `submit` can
 * `return acceptStudyTutorResult(raw)` and is then, by construction, incapable
 * of returning an unparsed result. Choosing `parseStudyTutorResult` and handling
 * `null` yourself remains available and is equally correct — what is no longer
 * available is an excuse that parsing was inconvenient.
 *
 * It invents no production behaviour. `quarantined` is the branch the contract
 * already defines for "this output could not be vouched for", and the host
 * already fails closed on it. Total, like the parser it wraps.
 *
 * See ./wrapperObligations.ts for the landing requirement this satisfies.
 */
export function acceptStudyTutorResult(raw: unknown): ValidatedStudyTutorResult {
  return parseStudyTutorResult(raw) ?? validated(Object.freeze({
    status: 'quarantined' as const,
    reasonCode: STUDY_TUTOR_UNPARSED_RESULT_REASON_CODE,
  }))
}
