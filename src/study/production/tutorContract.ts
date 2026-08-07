import type { StudyRuntimeInterruption } from '../types'

/**
 * STUDY-PROD-TUTOR-CONTRACT-C — the host-side contract a future production
 * Tutor wrapper must implement.
 *
 * This module is types plus two narrow constructors. It mounts nothing, calls
 * nothing, and imports nothing from `adaptive-tutor/**`. The correspondence to
 * the frozen lower-level bridge surface
 * (`bridges/tutor-core/src/{orchestrator,core-adapter,safety-gateway}.ts`) is
 * documented per declaration and enforced structurally, so the host never takes
 * a compile-time dependency on the release-candidate convenience wrapper.
 *
 * Two invariants shape everything below.
 *
 * Tutor is ADVISORY. It never owns official grade, working level, curriculum
 * selection, permissions, session authorization, safety authority, or parent
 * decisions. Those fields are absent from this contract by construction, and
 * `ProductionTutorAuthorityLeak` proves their absence at compile time.
 *
 * Learner-facing content crosses an EXPLICIT boundary. The production forensic
 * found that lower-level sanitization is computed but not uniformly carried
 * through every media/presentation mapping, so no raw bridge string may be
 * rendered. `ProductionTutorSafeText` is nominal: the only way to obtain one is
 * `createProductionTutorSafeText`, which requires the wrapper to attest which
 * sanitizer produced it. A wrapper that forgets does not type-check.
 */

// ---------------------------------------------------------------------------
// Learner-facing text boundary (Phase 8)
// ---------------------------------------------------------------------------

declare const LEARNER_SAFE_TEXT: unique symbol

/**
 * Text the host is permitted to render to a learner.
 *
 * Nominal, not structural: a plain `string` is not assignable here, so a raw
 * spoken turn, board-command label, caption or narration string cannot reach a
 * learner surface by being passed along. It carries no formatting authority —
 * it is a checked string and nothing more.
 */
export type ProductionTutorSafeText = string & {
  readonly [LEARNER_SAFE_TEXT]: 'learner-safe'
}

/**
 * What the wrapper must state about text it is about to make renderable.
 *
 * The literal types are the point. A wrapper cannot widen `transcriptIncluded`
 * to `boolean` and pass `true`, and it cannot invent a sanitizer name: the only
 * accepted value names the frozen bridge's learner-safe projection, which is
 * built from bridge-authored message constants rather than from Tutor Core's
 * own text.
 */
export interface ProductionTutorSanitizationAttestation {
  readonly sanitizedBy: 'study-bridge-learner-safe-projection'
  readonly transcriptIncluded: false
  readonly rawLearnerTextIncluded: false
}

/** Matches the frozen bridge's own bound on learner-visible text. */
const MAXIMUM_SAFE_TEXT_LENGTH = 2_500

/**
 * C0 controls and DEL, newline and tab included.
 *
 * Every learner message the frozen bridge authors is a single-line constant, so
 * rejecting the whole range costs nothing today and fails in the safe direction:
 * control characters are how text smuggles structure past a renderer. Widening
 * this later is a deliberate contract change, not an oversight.
 */
function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/**
 * The single constructor for renderable learner text.
 *
 * Structural checks only. It deliberately does NOT re-implement the bridge's
 * privacy scan: duplicating that logic here would create a second, drifting
 * copy of a reviewed boundary. What it enforces is that some named sanitizer
 * ran, and that what came back is a bounded, single-line, control-character-free
 * string — the shape every bridge-authored learner message already has.
 *
 * Throws rather than returning a result: there is no safe partial render, and a
 * caller that ignored a returned `null` would render nothing while believing it
 * had rendered a message. The thrown message is a fixed code and never echoes
 * the candidate, so a rejected string is not copied into a log or a stack.
 */
export function createProductionTutorSafeText(
  candidate: string,
  attestation: ProductionTutorSanitizationAttestation,
): ProductionTutorSafeText {
  if (
    attestation?.sanitizedBy !== 'study-bridge-learner-safe-projection' ||
    attestation.transcriptIncluded !== false ||
    attestation.rawLearnerTextIncluded !== false
  ) {
    throw new Error('production_tutor_presentation_attestation_invalid')
  }
  if (
    typeof candidate !== 'string' ||
    candidate.length < 1 ||
    candidate.length > MAXIMUM_SAFE_TEXT_LENGTH ||
    hasControlCharacter(candidate)
  ) {
    throw new Error('production_tutor_presentation_text_invalid')
  }
  return candidate as ProductionTutorSafeText
}

// ---------------------------------------------------------------------------
// Session correlation (Phase 6)
// ---------------------------------------------------------------------------

declare const TUTOR_SESSION_CORRELATION: unique symbol

/**
 * The opaque value that correlates Tutor work for one Study session.
 *
 * Nominal for the same reason as the text brand: the host's own `sessionRef` is
 * a readable `${blockRef}:session` string derived from a calendar block, and a
 * readable reference is a weak pseudonym. Making this a distinct type means the
 * durable Study reference cannot be handed to Tutor by accident.
 *
 * The digest that produces it is NOT implemented here. This card owns the shape
 * and the admission rule; the production wrapper owns the derivation.
 */
export type ProductionTutorSessionCorrelationRef = string & {
  readonly [TUTOR_SESSION_CORRELATION]: 'pseudonymous'
}

export interface ProductionTutorCorrelationAttestation {
  readonly derivation: 'server-verified-pseudonymous-digest'
  readonly reversibleToLearnerIdentity: false
  readonly containsLearnerIdentifier: false
}

/**
 * Lowercase hex, 32–64 characters.
 *
 * Chosen so the accepted value is simultaneously (a) shaped like a digest and
 * not like anything human-readable, and (b) a strict subset of the frozen
 * bridge's opaque-identifier bound `^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$`. A
 * value admitted here is therefore guaranteed to survive the bridge's own
 * `sessionId` validation, which is what makes the wrapper fit provable.
 */
const CORRELATION_REF = /^[0-9a-f]{32,64}$/

export function createProductionTutorSessionCorrelationRef(
  candidate: string,
  attestation: ProductionTutorCorrelationAttestation,
): ProductionTutorSessionCorrelationRef {
  if (
    attestation?.derivation !== 'server-verified-pseudonymous-digest' ||
    attestation.reversibleToLearnerIdentity !== false ||
    attestation.containsLearnerIdentifier !== false
  ) {
    throw new Error('production_tutor_correlation_attestation_invalid')
  }
  if (typeof candidate !== 'string' || !CORRELATION_REF.test(candidate)) {
    throw new Error('production_tutor_correlation_ref_invalid')
  }
  return candidate as ProductionTutorSessionCorrelationRef
}

// ---------------------------------------------------------------------------
// Host-established session facts (Phase 5)
// ---------------------------------------------------------------------------

/** Mirrors the frozen `StudyGradeBand`. Host-owned; Tutor may never set it. */
export type ProductionTutorGradeBand =
  | 'elementary-3-5'
  | 'middle-6-8'
  | 'high-9-12'

/**
 * Everything Tutor is told about a session, and nothing else.
 *
 * Every field here is a fact the HOST established before Tutor was reached.
 * Absent by construction: learner identity, household identity, official grade,
 * working level, permissions, authorization state, and safety permission. The
 * verified server identity that backs `sessionCorrelationRef` stays inside the
 * wrapper — it is bound once, at construction, and never travels per turn.
 *
 * `gradeBand` is present because the frozen `StudyContextV1` requires it. It is
 * a coarse host-owned band, not a working level and not a placement: Tutor
 * receives it and cannot change it.
 */
export interface ProductionTutorSessionInput {
  readonly sessionCorrelationRef: ProductionTutorSessionCorrelationRef
  readonly lessonRef: string
  readonly segmentRef: string
  readonly subjectRef: string
  readonly gradeBand: ProductionTutorGradeBand
  readonly learnerLocalDate: string
  readonly householdTimeZone: string
}

/**
 * One learner turn.
 *
 * `transientLearnerText` is transient in the strict sense the frozen bridge
 * uses: it is passed to the safety boundary and to Tutor Core, and is never
 * returned, fingerprinted, persisted, or placed in an adult hook. It appears in
 * the input type and in no result type, which is the contract.
 */
export interface ProductionTutorTurnInput {
  readonly sessionCorrelationRef: ProductionTutorSessionCorrelationRef
  readonly turnRef: string
  readonly occurredAt: string
  readonly lessonRef: string
  readonly segmentRef: string
  readonly skillRef: string
  readonly transientLearnerText: string
}

// ---------------------------------------------------------------------------
// Checkpoint / resume (Phases 6 and 9)
// ---------------------------------------------------------------------------

/** Mirrors the frozen `TutorPhase`. Reported, never commanded by the host. */
export type ProductionTutorPhase =
  | 'assessment'
  | 'identify-missing-concept'
  | 'teach-visually'
  | 'guided-practice'
  | 'independent-attempt'
  | 'reassess'
  | 'advance'
  | 'reteach'
  | 'escalated'

/**
 * Where instruction stands — position only.
 *
 * Structural counters and a phase label. No attempts, no scores, no responses,
 * no observations: those live behind `protectedTutorStateRef`, exactly as the
 * frozen `SafeInstructionalCursorV1` arranges it.
 */
export interface ProductionTutorInstructionalCursor {
  readonly phase: ProductionTutorPhase
  readonly cycleNumber: number
  readonly itemIndex: number
  readonly teachingTurnIndex: number
}

/**
 * The minimized state needed to resume, and nothing that describes the child.
 *
 * `protectedTutorStateRef` is an opaque handle to Tutor-owned recovery state
 * held behind a sidecar; the checkpoint never carries the snapshot itself. The
 * two `false` literals are load-bearing — they cannot be widened, so a future
 * wrapper cannot resume by rehydrating a transcript or a stored answer.
 */
export interface ProductionTutorCheckpoint {
  readonly checkpointRef: string
  readonly revision: number
  readonly capturedAt: string
  readonly sessionCorrelationRef: ProductionTutorSessionCorrelationRef
  readonly lessonRef: string
  readonly segmentRef: string
  readonly instructionalCursor: ProductionTutorInstructionalCursor
  readonly protectedTutorStateRef: string
  readonly lastAcceptedEventRef: string | null
  readonly rawAnswerIncluded: false
  readonly transcriptIncluded: false
}

export interface ProductionTutorSessionEstablished {
  readonly sessionCorrelationRef: ProductionTutorSessionCorrelationRef
  readonly checkpoint: ProductionTutorCheckpoint
}

// ---------------------------------------------------------------------------
// Advisory output (Phases 7, 8 and 10)
// ---------------------------------------------------------------------------

/**
 * What Tutor SUGGESTS the plan do next. Structurally identical to the frozen
 * `StudyRecommendationV1["action"]`.
 *
 * A directive is a recommendation the host is free to ignore. Note what is not
 * expressible: there is no `set-working-level`, no `set-grade`, no
 * `change-curriculum`, and no value that clears a stop. `adult-review` raises a
 * flag for an adult; it does not decide anything.
 */
export type ProductionTutorDirective =
  | 'continue-plan'
  | 'review'
  | 'reteach'
  | 'prerequisite-remediation'
  | 'adult-review'
  | 'none'

/**
 * The only thing the host may render.
 *
 * `visibleText` is branded, so this object cannot be built from raw bridge
 * output. `mayContinue` and `adultReviewPending` mirror the frozen
 * `LearnerSafeProjectionV1` and are advisory display state — the host's own
 * safety boundary, not this field, decides whether work actually proceeds.
 */
export interface ProductionTutorPresentation {
  readonly messageCode: string
  readonly visibleText: ProductionTutorSafeText
  readonly mayContinue: boolean
  readonly adultReviewPending: boolean
  readonly captionsAlwaysVisible: true
  readonly lessonMayContinueWithoutMedia: true
  readonly transcriptIncluded: false
}

/**
 * Instructional escalation only.
 *
 * Tutor may report that an adult should look at the learning evidence. It may
 * not clear, downgrade, or override a Study safety stop: the mounted Study
 * safety boundary stays authoritative, and this contract gives Tutor no field
 * through which to reach it. `stopped` results are reported BY the host's
 * boundary, not decided by Tutor.
 */
export type ProductionTutorSafetyClassification =
  | 'urgent'
  | 'uncertain'
  | 'invalid'

export type ProductionTutorAdultHelpState =
  | 'proposed-not-delivered'
  | 'not-confirmed'

/**
 * The result of one turn.
 *
 * Deliberately NOT the frozen `StudyProjectionV1`. That projection echoes the
 * `studentId` the bridge was given and carries the full canonical evidence
 * record; the host surface needs neither, so neither is here. What the host
 * gets is an event reference for its own ledger, an advisory directive, and a
 * presentation it is allowed to render.
 */
export type ProductionTutorTurnResult =
  | {
      readonly status: 'accepted'
      readonly eventRef: string
      readonly directive: ProductionTutorDirective
      readonly reasonCode: string
      readonly presentation: ProductionTutorPresentation
      readonly checkpoint: ProductionTutorCheckpoint
    }
  | {
      readonly status: 'stopped'
      readonly reasonCode: string
      readonly classification: ProductionTutorSafetyClassification
      readonly adultHelpState: ProductionTutorAdultHelpState
      readonly presentation: ProductionTutorPresentation
      readonly coreSubmitInvocations: 0 | 1
    }
  /**
   * The turn could not be evaluated and the reason was never the learner.
   * Carries no classification, no reason code and no message, because there is
   * nothing about this child to record. Mirrors the host's existing
   * `StudyRuntimeInterruption` handling.
   */
  | {
      readonly status: 'interrupted'
      readonly interruption: StudyRuntimeInterruption
      readonly coreSubmitInvocations: 0 | 1
    }
  | {
      readonly status: 'quarantined'
      readonly reasonCode: string
    }

/**
 * The injectable a future `StudySessionContainer` receives as a dependency.
 *
 * Three methods, matching what the container actually does today: establish a
 * session on mount, submit a turn on completion, restore after a break. The
 * container is NOT wired to this in this card.
 */
export interface ProductionTutorRuntime {
  beginSession(
    input: ProductionTutorSessionInput,
  ): Promise<ProductionTutorSessionEstablished>
  submitTurn(
    input: ProductionTutorTurnInput,
  ): Promise<ProductionTutorTurnResult>
  resumeSession(
    checkpoint: ProductionTutorCheckpoint,
  ): Promise<ProductionTutorSessionEstablished>
}

// ---------------------------------------------------------------------------
// Compile-time negative proofs (Phases 7, 9 and 10)
// ---------------------------------------------------------------------------

/**
 * Data field names that would hand Tutor an authority it must not hold.
 *
 * Nouns only, and deliberately so. The obvious companion list — the mutator
 * names a wrapper might expose as methods — is NOT written here, for two
 * reasons.
 *
 * The host already guards the working-level setter by name: a repository test
 * treats any non-test module mentioning it as a module that can write one. That
 * guard cannot distinguish a denylist from a caller, and spelling the token here
 * to forbid it would have trip-wired a real safety check. Weakening the check to
 * accommodate this file would have been the wrong trade.
 *
 * More importantly, a mutator denylist is the weaker instrument anyway. It only
 * catches names someone thought to list. `ProductionTutorAssertExactKeys` below
 * pins each output surface to its complete key set, so ANY unlisted method or
 * field — a mutator nobody anticipated included — fails the build. The exact
 * assertions are the real proof; this list is defence in depth for data that
 * could otherwise hide inside a nested object.
 */
export type ProductionTutorForbiddenAuthorityKey =
  | 'workingLevel'
  | 'grade'
  | 'permission'
  | 'permissions'
  | 'authorization'
  | 'authorizationState'
  | 'curriculum'
  | 'curriculumSelection'
  | 'parentSettings'
  | 'parentDecision'
  | 'safetyOverride'
  | 'safetyStopCleared'
  | 'masteryDecision'

/**
 * Names that would make the contract require something it must never persist.
 *
 * `studentId` and friends appear here as well as in the authority list's
 * spirit: the production contract requires no raw learner UUID anywhere, in
 * either direction.
 */
export type ProductionTutorForbiddenPrivacyKey =
  | 'transcript'
  | 'rawTranscript'
  | 'rawAnswer'
  | 'rawResponse'
  | 'rawLearnerResponse'
  | 'rawText'
  | 'matchedText'
  | 'audio'
  | 'audioUri'
  | 'audioBlob'
  | 'emotion'
  | 'emotionalState'
  | 'personality'
  | 'personalityLabel'
  | 'diagnosis'
  | 'diagnosisLabel'
  | 'studentId'
  | 'studentUuid'
  | 'learnerId'
  | 'learnerUuid'
  | 'householdId'

/**
 * Every property name reachable from `T`, to a bounded depth.
 *
 * Primitives are matched BEFORE objects so the two branded string types
 * terminate here instead of contributing their brand symbol. The depth bound
 * exists only to guarantee termination; the contract's shapes are far shallower.
 */
export type ProductionTutorDeepKey<
  T,
  Depth extends readonly unknown[] = [],
> = Depth['length'] extends 8
  ? never
  : T extends string | number | boolean | bigint | symbol | null | undefined
    ? never
    : T extends readonly (infer Element)[]
      ? ProductionTutorDeepKey<Element, [...Depth, 0]>
      : T extends object
        ? {
            [Key in keyof T]-?:
              | (Key & string)
              | ProductionTutorDeepKey<T[Key], [...Depth, 0]>
          }[keyof T]
        : never

/** Resolves to the offending key names, or to `never` when the shape is clean. */
export type ProductionTutorAuthorityLeak<T> = Extract<
  ProductionTutorDeepKey<T>,
  ProductionTutorForbiddenAuthorityKey
>

export type ProductionTutorPrivacyLeak<T> = Extract<
  ProductionTutorDeepKey<T>,
  ProductionTutorForbiddenPrivacyKey
>

/**
 * Compiles only when `T` is `never`.
 *
 * Used in the contract tests as `ProductionTutorAssertNoLeak<...Leak<Shape>>`,
 * so a future edit that adds an authority or transcript field to any contract
 * type fails `npm run typecheck` rather than a review.
 */
export type ProductionTutorAssertNoLeak<T extends never> = T

/**
 * The symmetric difference between an actual key set and the expected one.
 *
 * Empty exactly when the two agree, so wrapping it in
 * `ProductionTutorAssertNoLeak` closes a surface: a missing key shows up in one
 * half, an added key in the other. This is what makes the output surfaces
 * closed rather than merely screened — a future edit cannot add a mutator, a
 * transcript, or any other field to a result without failing
 * `npm run typecheck`, whether or not anyone predicted the name.
 */
export type ProductionTutorKeyDifference<
  Actual extends string,
  Expected extends string,
> = Exclude<Actual, Expected> | Exclude<Expected, Actual>
