/**
 * STUDY-A1-TUTOR-CONTENT-ELIGIBILITY-CONTRACT — can the reviewed Tutor content
 * teach this block at all?
 *
 * THE DEFECT THIS EXISTS FOR, reproduced before it was closed.
 *
 * `selectTutorProgram` in
 * adaptive-tutor/study-engine/runtime/src/subject-registry.ts ends:
 *
 *   const entry = matched ?? registration.programs[0]
 *
 * When no frozen routing id matches the requested lesson or skill reference,
 * the subject's DEFAULT program is returned. For math that is sequence 01,
 * place value and regrouping. Driven at this card's base, a turn carrying
 * `lessonRef: 'lesson:fractions-week-3'` and `skillRef: 'skill:equivalent-fractions'`
 * came back `accepted`, teaching "Which comparison is true?" from the
 * place-value program. A girl sits down to fractions and is tutored on place
 * value, and nothing anywhere reports a mismatch.
 *
 * The already-known failure — unsupported content discovered on submit — is the
 * BENIGN one: it at least produces a quarantine. The common case is worse and
 * silent, because a wrongly-selected program is still a reviewed, in-band,
 * schema-valid program, so every downstream check it passes is answering a
 * question about the wrong lesson.
 *
 * WHAT THIS MODULE IS. The vocabulary and the parsers for a fail-closed answer
 * to "is this content routable to reviewed Tutor content", and nothing else. It
 * evaluates nothing: deciding requires the frozen subject registry, and this
 * module deliberately cannot see it. ../../production/tutorContentEligibility.ts
 * is where the decision is made, and the split is not cosmetic — the frozen Math
 * R1 content is 250 KB of lesson prose that must never reach a production
 * bundle, and everything in this directory is measured content-free. A future
 * server eligibility check answers over the wire; this is the shape of the
 * question it is asked and of the answer the host will admit.
 *
 * ELIGIBILITY IS ABOUT CONTENT, NOT ABOUT A CHILD.
 *
 * The request below carries a subject, a lesson reference, skill/routing
 * references and the task types a block's segments declare. That is reviewed
 * CONTENT METADATA, all of it, and the omissions are the point:
 *
 *  - NO nominal grade. A learner's official grade is host authority and a Tutor
 *    is never told it (STUDY_TUTOR_FORBIDDEN_KEYS in ./runtime.ts).
 *  - NO working level. Placement is not an eligibility input and never becomes
 *    one; a check that read it would be a Tutor deciding what a child is ready
 *    for, which is the boundary inverted.
 *  - NO learner reference, session grant or bearer. Eligibility is a property of
 *    a lesson, and the same lesson is equally eligible for every child.
 *
 * `gradeBand` appears on the ELIGIBLE result and only there. It is what the
 * reviewed CONTENT declares, travelling outward, not a claim about a learner
 * travelling inward — the same constant D1 already owns in
 * ../../production/tutorContentEligibility.ts.
 *
 * REFUSE, NEVER TRIM. Every bound below rejects. Trimming an over-long
 * reference would silently answer a question nobody asked: `lesson:...` cut at
 * 128 characters is a DIFFERENT lesson reference, and one that might well match
 * a reviewed program. The whole defect above is a wrong lesson being taught
 * confidently, so a parser that manufactures references is the same bug with a
 * new entrance.
 */
import { isStudyBridgeOpaqueId } from '../../studyRequestRef'
import { parseStudyTutorRef, type StudyTutorRef } from './refs'
import type { CanonicalStudyTaskType, StudySubject } from '../../types'

/** Mirrors the `study-tutor.v1` convention in ./runtime.ts. */
export const STUDY_TUTOR_ELIGIBILITY_CONTRACT_VERSION = 'study-tutor-eligibility.v1' as const

/**
 * Why content was refused, and the whole closed set.
 *
 * Every one is operator vocabulary about CONTENT or about this contract, and
 * none says anything about a learner. Each satisfies `isStudyTutorReasonCode`
 * in ./results.ts — lower-case, hyphenated, well inside 64 characters — because
 * a wrapper hands these straight to `quarantined`, and a reason code the result
 * parser rejects would be re-quarantined as a parse failure with the real reason
 * lost. ./eligibility.test.ts checks that against the real predicate rather than
 * by eye.
 */
export const STUDY_TUTOR_INELIGIBLE_REASONS = Object.freeze({
  /** The block's subject has no reviewed Tutor subject at all. */
  unsupportedSubject: 'tutor-content-subject-not-supported',
  /** A segment's task type is one the Tutor bridge maps to no teaching phase. */
  unsupportedTaskType: 'tutor-content-task-type-not-supported',
  /**
   * No registered program declares any of the requested routing ids. THE
   * defect: this is the case that used to return `programs[0]`.
   */
  unmatchedLesson: 'tutor-content-lesson-not-routable',
  /**
   * The matched program declares a grade band outside the reviewed V1 envelope.
   * The string is unchanged from the wrapper's own pre-eligibility code so that
   * anything already matching on it keeps working.
   */
  unreviewedGradeBand: 'tutor-program-outside-reviewed-v1-content',
  /** The request itself did not parse: a malformed or over-long reference. */
  malformedRequest: 'tutor-eligibility-request-malformed',
  /**
   * No decision this contract can vouch for. Two producers, one meaning:
   * `acceptStudyTutorEligibility` below when a transport's answer fails to
   * parse, and the production evaluator when the subject registry itself
   * refuses. Both mean "there is no trustworthy YES", which fails closed.
   */
  unvouchedDecision: 'tutor-eligibility-decision-not-vouched-for',
} as const)

export type StudyTutorIneligibleReason =
  (typeof STUDY_TUTOR_INELIGIBLE_REASONS)[keyof typeof STUDY_TUTOR_INELIGIBLE_REASONS]

const INELIGIBLE_REASONS: ReadonlySet<string> = new Set(Object.values(STUDY_TUTOR_INELIGIBLE_REASONS))

/**
 * The grade band the reviewed CONTENT declares, stated here rather than
 * imported from the Tutor Core bridge.
 *
 * Importing `StudyGradeBand` would be a type-only edge and would emit nothing,
 * but this directory's whole value is that its import closure is content-free
 * and measured, and a type import is one refactor away from a value import. The
 * two unions are held identical by a compile-time assertion in
 * ../../production/tutorContentEligibility.ts, which may see both — so they
 * cannot drift, and the drift alarm lives on the side that is allowed to look.
 */
export const STUDY_TUTOR_CONTENT_GRADE_BANDS = Object.freeze([
  'elementary-3-5',
  'middle-6-8',
  'high-9-12',
] as const)

export type StudyTutorContentGradeBand = (typeof STUDY_TUTOR_CONTENT_GRADE_BANDS)[number]

const CONTENT_GRADE_BANDS: ReadonlySet<string> = new Set(STUDY_TUTOR_CONTENT_GRADE_BANDS)

/** Compiles only when its argument is `never`; the drift alarm. */
type Exhaustive<T extends never> = T

/**
 * The host vocabularies a request may use, as runtime values.
 *
 * These are what a request may SAY, not what the Tutor can teach. Whether a
 * subject has a reviewed registration and whether a task type maps to a
 * teaching phase are content questions, and they are answered by the production
 * evaluator against the frozen registry and the bridge's own mapping — never by
 * a list kept here, which would be a second copy of the answer.
 *
 * Both tuples are audited against their unions in both directions by the
 * unreferenced aliases below, so neither can drift from src/study/types.ts.
 */
export const STUDY_TUTOR_ELIGIBILITY_SUBJECTS = Object.freeze([
  'math',
  'reading',
  'writing',
  'other',
] as const)

export const STUDY_TUTOR_ELIGIBILITY_TASK_TYPES = Object.freeze([
  'retrieval-practice',
  'direct-instruction',
  'worked-example',
  'guided-practice',
  'independent-practice',
  'prerequisite-remediation',
  'reading',
  'writing',
  'project-work',
  'problem-solving',
  'discussion',
  'reflection',
  'mastery-check',
  'custom',
] as const)

/** A subject the union declares and the tuple omits. */
type _EverySubjectEnumerated =
  Exhaustive<Exclude<StudySubject, (typeof STUDY_TUTOR_ELIGIBILITY_SUBJECTS)[number]>>
/** A subject the tuple invents and the union does not declare. */
type _NoSubjectInvented =
  Exhaustive<Exclude<(typeof STUDY_TUTOR_ELIGIBILITY_SUBJECTS)[number], StudySubject>>
/** A task type the union declares and the tuple omits. */
type _EveryTaskTypeEnumerated =
  Exhaustive<Exclude<CanonicalStudyTaskType, (typeof STUDY_TUTOR_ELIGIBILITY_TASK_TYPES)[number]>>
/** A task type the tuple invents and the union does not declare. */
type _NoTaskTypeInvented =
  Exhaustive<Exclude<(typeof STUDY_TUTOR_ELIGIBILITY_TASK_TYPES)[number], CanonicalStudyTaskType>>

const ELIGIBILITY_SUBJECTS: ReadonlySet<string> = new Set(STUDY_TUTOR_ELIGIBILITY_SUBJECTS)
const ELIGIBILITY_TASK_TYPES: ReadonlySet<string> = new Set(STUDY_TUTOR_ELIGIBILITY_TASK_TYPES)

/**
 * A block presents one lesson and the skills that lesson declares.
 *
 * The bound is a transport bound rather than a derived one, and saying so is
 * more useful than a false derivation: this shape is destined for a pre-launch
 * server check, where an unbounded array is unbounded work per request.
 * Sixteen is comfortably above the four skill ids the largest reviewed frozen
 * sequence declares and the five segments the largest host lesson mapping
 * produces, so no content that exists today comes near it. A request over the
 * bound is REFUSED, not truncated — see the module header.
 */
export const STUDY_TUTOR_ELIGIBILITY_MAX_SKILL_REFS = 16

/**
 * The question, and the whole of it.
 *
 * Every reference is a `StudyTutorRef`, so it cannot be written down — only
 * `parseStudyTutorRef` produces one, and it applies the bridge's own
 * 128-character opaque-id rule. A host cannot assemble this request out of
 * unchecked strings and a server cannot receive one.
 */
export interface StudyTutorEligibilityRequest {
  /** Host vocabulary. Which reviewed Tutor subject it maps to, if any, is content. */
  readonly subject: StudySubject
  /** The block's lesson, and the primary routing reference. */
  readonly lessonRef: StudyTutorRef
  /** The lesson's skill/routing references. Non-empty and distinct. */
  readonly skillRefs: readonly StudyTutorRef[]
  /** The task types the block's segments declare. Non-empty and distinct. */
  readonly taskTypes: readonly CanonicalStudyTaskType[]
}

/**
 * The answer.
 *
 * `programRef` and `gradeBand` exist on the eligible branch ONLY. An ineligible
 * answer carries no program and no band, because there is no program — which is
 * exactly what the `programs[0]` fallback got wrong by having one to hand.
 */
export type StudyTutorEligibility =
  | {
      readonly eligible: true
      /**
       * The reviewed program this content routes to, opaque and bounded by the
       * same rule as every other bridge-facing reference. It is the evidence
       * behind the YES: a decision that named no program would be
       * indistinguishable from the fallback it replaces.
       */
      readonly programRef: string
      /** What the reviewed CONTENT declares. Never a statement about a learner. */
      readonly gradeBand: StudyTutorContentGradeBand
    }
  | {
      readonly eligible: false
      readonly reason: StudyTutorIneligibleReason
    }

declare const STUDY_TUTOR_VALIDATED_ELIGIBILITY_BRAND: unique symbol

/**
 * A decision this contract has actually seen, branded exactly as
 * `ValidatedStudyTutorResult` in ./results.ts is and for the same reason.
 *
 * `StudyTutorEligibility` describes the SHAPE of a decision. A wrapper could
 * satisfy it by writing `{ eligible: true, programRef: 'x', gradeBand: '...' }`,
 * or by asserting its transport's output to be one, and never validate
 * anything — and a forged YES here is not a shrug, it is durable work started
 * for content the Tutor cannot teach. The brand is an unexported `unique
 * symbol`, so the only expressions of this type are the ones the parsers below
 * returned.
 *
 * The residual is the same single explicit type assertion F4 records honestly
 * in ./wrapperObligations.ts. What the brand removes is every bypass that reads
 * as correct code.
 */
export type ValidatedStudyTutorEligibility = StudyTutorEligibility & {
  readonly [STUDY_TUTOR_VALIDATED_ELIGIBILITY_BRAND]: 'study-tutor.validated-eligibility'
}

/**
 * Module-private, and the only place the brand is applied.
 *
 * Takes a `StudyTutorEligibility`, not an `unknown`, so nothing external can be
 * laundered through it — and the only such values in this module are the frozen
 * ones rebuilt field by field below.
 */
function validated(decision: StudyTutorEligibility): ValidatedStudyTutorEligibility {
  return decision as ValidatedStudyTutorEligibility
}

/** Exact per shape. An extra key — including any forbidden one — is a rejection. */
export const STUDY_TUTOR_ELIGIBILITY_KEYS = Object.freeze({
  request: Object.freeze(['subject', 'lessonRef', 'skillRefs', 'taskTypes']),
  eligible: Object.freeze(['eligible', 'programRef', 'gradeBand']),
  ineligible: Object.freeze(['eligible', 'reason']),
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * `Reflect.ownKeys`, not `Object.keys`, for the reason ./results.ts gives: own
 * keys that are non-enumerable or symbol-keyed are invisible to `Object.keys`,
 * so a request could carry a `workingLevel` or a `gradeLevel` past a check that
 * never saw it. The rebuild below means it could not have travelled anyway, but
 * a shape this contract cannot vouch for is a rejection.
 */
function hasExactKeys(candidate: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Reflect.ownKeys(candidate)
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(candidate, key))
}

/**
 * Non-empty, distinct, within the bound, and every member admissible.
 *
 * Distinctness is checked on the VALUES that were kept, so a duplicate cannot
 * be smuggled past by an accessor that answers differently on the second read —
 * the array is materialised once and never re-indexed.
 */
function narrowedList<T extends string>(
  value: unknown,
  limit: number,
  admit: (entry: unknown) => T | null,
): readonly T[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > limit) return null
  const kept: T[] = []
  for (const entry of value) {
    const admitted = admit(entry)
    if (admitted === null || kept.includes(admitted)) return null
    kept.push(admitted)
  }
  return Object.freeze(kept)
}

function admittedTaskType(value: unknown): CanonicalStudyTaskType | null {
  return typeof value === 'string' && ELIGIBILITY_TASK_TYPES.has(value)
    ? (value as CanonicalStudyTaskType)
    : null
}

/**
 * The only way to make a `StudyTutorEligibilityRequest`.
 *
 * Total, and coerces nothing: a throwing accessor on a hostile or simply broken
 * caller's object is a rejection rather than an exception thrown through, and
 * `String(...)` appears nowhere — an object whose `toString` prints an approved
 * lesson reference must be refused, because it is the object that would travel.
 *
 * `null` means "not an eligibility request". The caller decides whether that is
 * a refusal, a quarantine or a host bug; it is deliberately not a throw,
 * because this sits on the path that decides whether a child's session starts
 * and a validator that throws is a validator a caller routes around.
 */
export function parseStudyTutorEligibilityRequest(
  value: unknown,
): StudyTutorEligibilityRequest | null {
  try {
    if (!isRecord(value)) return null
    if (!hasExactKeys(value, STUDY_TUTOR_ELIGIBILITY_KEYS.request)) return null

    const subject = value.subject
    if (typeof subject !== 'string' || !ELIGIBILITY_SUBJECTS.has(subject)) return null

    // Refused, never trimmed. `parseStudyTutorRef` applies the bridge's own
    // opaque-id rule, so an over-long or malformed reference yields `null` here
    // and no shortened reference is ever manufactured.
    const lessonRef = parseStudyTutorRef(value.lessonRef)
    if (lessonRef === null) return null

    const skillRefs = narrowedList(
      value.skillRefs,
      STUDY_TUTOR_ELIGIBILITY_MAX_SKILL_REFS,
      parseStudyTutorRef,
    )
    if (skillRefs === null) return null

    const taskTypes = narrowedList(
      value.taskTypes,
      STUDY_TUTOR_ELIGIBILITY_TASK_TYPES.length,
      admittedTaskType,
    )
    if (taskTypes === null) return null

    return Object.freeze({
      subject: subject as StudySubject,
      lessonRef,
      skillRefs,
      taskTypes,
    })
  } catch {
    return null
  }
}

/**
 * The only way a Tutor eligibility decision enters the host.
 *
 * Validate and rebuild in ONE pass, per ./results.ts: each field is read exactly
 * once and the value KEPT is the value that was CHECKED, so an own accessor
 * cannot answer the check with an approved program reference and hand something
 * else to what is built afterwards. Only primitives and frozen rebuilt objects
 * leave here.
 */
export function parseStudyTutorEligibility(value: unknown): ValidatedStudyTutorEligibility | null {
  try {
    if (!isRecord(value)) return null
    const eligible = value.eligible

    if (eligible === true) {
      if (!hasExactKeys(value, STUDY_TUTOR_ELIGIBILITY_KEYS.eligible)) return null
      const programRef = value.programRef
      const gradeBand = value.gradeBand
      if (typeof programRef !== 'string' || !isStudyBridgeOpaqueId(programRef)) return null
      if (typeof gradeBand !== 'string' || !CONTENT_GRADE_BANDS.has(gradeBand)) return null
      return validated(Object.freeze({
        eligible: true as const,
        programRef,
        gradeBand: gradeBand as StudyTutorContentGradeBand,
      }))
    }

    if (eligible === false) {
      if (!hasExactKeys(value, STUDY_TUTOR_ELIGIBILITY_KEYS.ineligible)) return null
      const reason = value.reason
      if (typeof reason !== 'string' || !INELIGIBLE_REASONS.has(reason)) return null
      return validated(Object.freeze({
        eligible: false as const,
        reason: reason as StudyTutorIneligibleReason,
      }))
    }

    return null
  } catch {
    return null
  }
}

/**
 * The whole crossing, in one call, with the fail-closed branch already chosen.
 *
 * The asymmetry here is the point and it is not the same as ./results.ts's. A
 * result that fails to parse costs a turn; an eligibility decision that fails to
 * parse decides whether a Study session starts at all, so the fallback must be
 * INELIGIBLE and never a shrug. Over-refusing costs a retry. Under-refusing
 * starts durable work for content the Tutor cannot teach — which is the defect
 * this contract exists for, arriving through the transport instead of through
 * the registry.
 *
 * Total, like the parser it wraps.
 */
export function acceptStudyTutorEligibility(raw: unknown): ValidatedStudyTutorEligibility {
  return parseStudyTutorEligibility(raw) ?? validated(Object.freeze({
    eligible: false as const,
    reason: STUDY_TUTOR_INELIGIBLE_REASONS.unvouchedDecision,
  }))
}
