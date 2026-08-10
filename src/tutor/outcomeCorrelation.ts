/**
 * Privacy-minimized Tutor outcome-correlation foundation.
 *
 * This module is deliberately isolated from TutorChat and persistence. It records
 * only opaque references, trusted ordering metadata, and categorical outcomes. It
 * supports statements about post-intervention outcomes; it does not establish that
 * a Tutor intervention caused an outcome.
 */

declare const tutorOutcomeRefBrand: unique symbol

type OpaqueRef<Kind extends string> = string & {
  readonly [tutorOutcomeRefBrand]: Kind
}

export type TutorInterventionRef = OpaqueRef<'TutorInterventionRef'>
export type TutorAttemptRef = OpaqueRef<'TutorAttemptRef'>
export type TutorSkillRef = OpaqueRef<'TutorSkillRef'>
export type TutorEvidenceRef = OpaqueRef<'TutorEvidenceRef'>
export type TutorCurriculumReleaseRef = OpaqueRef<'TutorCurriculumReleaseRef'>

export const TUTOR_OUTCOME_SCHEMA_VERSION = 1 as const

/**
 * Contract placeholder only. A future production boundary must replace client
 * clock/order claims with a durable, trusted server receipt before admission.
 */
export const TUTOR_ACCEPTED_TIME_AUTHORITY = 'trusted-server-receipt-required' as const

/** Three accepted, same-skill, scored attempts form the bounded observation window. */
export const EVENTUAL_MASTERY_ELIGIBLE_ATTEMPT_LIMIT = 3 as const

export type TutorInterventionKind =
  | 'hint'
  | 'guided-question'
  | 'worked-example'
  | 'reteach'
  | 'adult-escalation'

export type TutorAdultEscalationState = 'not-requested' | 'requested' | 'acknowledged'

interface AcceptedFact {
  /** Trusted global order; production must allocate this monotonically. */
  readonly acceptedSequence: number
  readonly acceptedAt: string
  readonly acceptedTimeAuthority: typeof TUTOR_ACCEPTED_TIME_AUTHORITY
}

export interface TutorInterventionReceiptV1 extends AcceptedFact {
  readonly schemaVersion: typeof TUTOR_OUTCOME_SCHEMA_VERSION
  readonly interventionRef: TutorInterventionRef
  readonly skillRef: TutorSkillRef
  /** Attempt that prompted help, when one exists. No problem or answer content. */
  readonly originAttemptRef: TutorAttemptRef | null
  readonly interventionKind: TutorInterventionKind
  readonly engine: Readonly<{
    readonly name: string
    readonly version: string
  }>
  readonly curriculumReleaseRef: TutorCurriculumReleaseRef
  readonly adultEscalationState: TutorAdultEscalationState
}

export type TutorEligibleAttemptKind = 'practice' | 'mastery-check' | 'reassessment'
export type TutorIneligibleAttemptKind = 'unscored' | 'abandoned' | 'unsupported'

export interface TutorAttemptOutcomeCategory {
  readonly correctness: 'incorrect' | 'correct'
  readonly improvement: 'not-improved' | 'improved'
}

interface TutorAttemptBaseV1 extends AcceptedFact {
  readonly schemaVersion: typeof TUTOR_OUTCOME_SCHEMA_VERSION
  readonly attemptRef: TutorAttemptRef
  readonly skillRef: TutorSkillRef
  /** Explicit correlation; never inferred from timestamp proximity. */
  readonly priorInterventionRef: TutorInterventionRef | null
}

export type TutorOutcomeAttemptV1 =
  | (TutorAttemptBaseV1 & {
      readonly attemptKind: TutorEligibleAttemptKind
      readonly outcome: TutorAttemptOutcomeCategory
    })
  | (TutorAttemptBaseV1 & {
      readonly attemptKind: TutorIneligibleAttemptKind
      readonly outcome: null
    })

export interface TutorMasteryEvidenceV1 extends AcceptedFact {
  readonly schemaVersion: typeof TUTOR_OUTCOME_SCHEMA_VERSION
  readonly evidenceRef: TutorEvidenceRef
  readonly evidenceKind: 'mastery_evidence'
  readonly interventionRef: TutorInterventionRef
  readonly attemptRef: TutorAttemptRef
  readonly skillRef: TutorSkillRef
}

export interface TutorNextAttemptCorrelationV1 {
  readonly interventionRef: TutorInterventionRef
  readonly attemptRef: TutorAttemptRef
}

export interface TutorOutcomeLedgerV1 {
  readonly schemaVersion: typeof TUTOR_OUTCOME_SCHEMA_VERSION
  readonly interventionReceipts: readonly TutorInterventionReceiptV1[]
  readonly attempts: readonly TutorOutcomeAttemptV1[]
  readonly nextAttemptCorrelations: readonly TutorNextAttemptCorrelationV1[]
  readonly masteryEvidence: readonly TutorMasteryEvidenceV1[]
}

export type TutorOutcomeConflictReason =
  | 'invalid-accepted-order'
  | 'out-of-order-fact'
  | 'intervention-ref-conflict'
  | 'pending-same-skill-intervention'
  | 'attempt-ref-conflict'
  | 'unknown-intervention'
  | 'attempt-not-eligible'
  | 'skill-mismatch'
  | 'attempt-not-after-intervention'
  | 'missing-prior-intervention-ref'
  | 'intervention-already-correlated'
  | 'attempt-already-correlated'
  | 'not-next-eligible-attempt'
  | 'evidence-ref-conflict'
  | 'unknown-attempt'
  | 'missing-next-attempt-correlation'
  | 'evidence-not-after-attempt'
  | 'evidence-outside-bounded-window'
  | 'attempt-evidence-already-assigned'

export type TutorOutcomeAdmission =
  | Readonly<{ status: 'recorded'; state: TutorOutcomeLedgerV1 }>
  | Readonly<{ status: 'duplicate-replay'; state: TutorOutcomeLedgerV1 }>
  | Readonly<{
      status: 'conflict'
      reason: TutorOutcomeConflictReason
      state: TutorOutcomeLedgerV1
    }>

export interface TutorOutcomeAggregateProjectionV1 {
  readonly schemaVersion: typeof TUTOR_OUTCOME_SCHEMA_VERSION
  readonly interventionCount: number
  readonly nextAttemptEligibleDenominator: number
  readonly nextAttemptImprovementNumerator: number
  readonly nextAttemptCorrectNumerator: number
  /** Includes windows closed by evidence or by exhausting three eligible attempts. */
  readonly eventualMasteryEvidenceDenominator: number
  readonly eventualMasteryEvidenceNumerator: number
  readonly adultEscalationCount: number
}

export function emptyTutorOutcomeLedger(): TutorOutcomeLedgerV1 {
  return {
    schemaVersion: TUTOR_OUTCOME_SCHEMA_VERSION,
    interventionReceipts: [],
    attempts: [],
    nextAttemptCorrelations: [],
    masteryEvidence: [],
  }
}

export function isEligibleTutorAttempt(
  attempt: TutorOutcomeAttemptV1,
): attempt is Extract<TutorOutcomeAttemptV1, { attemptKind: TutorEligibleAttemptKind }> {
  return attempt.attemptKind === 'practice'
    || attempt.attemptKind === 'mastery-check'
    || attempt.attemptKind === 'reassessment'
}

const conflict = (
  state: TutorOutcomeLedgerV1,
  reason: TutorOutcomeConflictReason,
): TutorOutcomeAdmission => ({ status: 'conflict', reason, state })

const isAcceptedOrderValid = (fact: AcceptedFact): boolean =>
  Number.isSafeInteger(fact.acceptedSequence)
  && fact.acceptedSequence > 0
  && Number.isFinite(Date.parse(fact.acceptedAt))
  && fact.acceptedTimeAuthority === TUTOR_ACCEPTED_TIME_AUTHORITY

const latestAcceptedSequence = (state: TutorOutcomeLedgerV1): number => Math.max(
  0,
  ...state.interventionReceipts.map((item) => item.acceptedSequence),
  ...state.attempts.map((item) => item.acceptedSequence),
  ...state.masteryEvidence.map((item) => item.acceptedSequence),
)

const sameInterventionReceipt = (
  left: TutorInterventionReceiptV1,
  right: TutorInterventionReceiptV1,
): boolean =>
  left.schemaVersion === right.schemaVersion
  && left.interventionRef === right.interventionRef
  && left.skillRef === right.skillRef
  && left.originAttemptRef === right.originAttemptRef
  && left.interventionKind === right.interventionKind
  && left.engine.name === right.engine.name
  && left.engine.version === right.engine.version
  && left.curriculumReleaseRef === right.curriculumReleaseRef
  && left.adultEscalationState === right.adultEscalationState
  && left.acceptedSequence === right.acceptedSequence
  && left.acceptedAt === right.acceptedAt
  && left.acceptedTimeAuthority === right.acceptedTimeAuthority

const sameAttempt = (left: TutorOutcomeAttemptV1, right: TutorOutcomeAttemptV1): boolean =>
  left.schemaVersion === right.schemaVersion
  && left.attemptRef === right.attemptRef
  && left.skillRef === right.skillRef
  && left.priorInterventionRef === right.priorInterventionRef
  && left.attemptKind === right.attemptKind
  && left.outcome?.correctness === right.outcome?.correctness
  && left.outcome?.improvement === right.outcome?.improvement
  && left.acceptedSequence === right.acceptedSequence
  && left.acceptedAt === right.acceptedAt
  && left.acceptedTimeAuthority === right.acceptedTimeAuthority

const sameEvidence = (left: TutorMasteryEvidenceV1, right: TutorMasteryEvidenceV1): boolean =>
  left.schemaVersion === right.schemaVersion
  && left.evidenceRef === right.evidenceRef
  && left.evidenceKind === right.evidenceKind
  && left.interventionRef === right.interventionRef
  && left.attemptRef === right.attemptRef
  && left.skillRef === right.skillRef
  && left.acceptedSequence === right.acceptedSequence
  && left.acceptedAt === right.acceptedAt
  && left.acceptedTimeAuthority === right.acceptedTimeAuthority

const isInterventionCorrelated = (
  state: TutorOutcomeLedgerV1,
  interventionRef: TutorInterventionRef,
): boolean => state.nextAttemptCorrelations.some((item) => item.interventionRef === interventionRef)

const eligibleAttemptsAfter = (
  state: TutorOutcomeLedgerV1,
  receipt: TutorInterventionReceiptV1,
): TutorOutcomeAttemptV1[] => state.attempts
  .filter((attempt) =>
    isEligibleTutorAttempt(attempt)
    && attempt.skillRef === receipt.skillRef
    && attempt.acceptedSequence > receipt.acceptedSequence)
  .sort((left, right) => left.acceptedSequence - right.acceptedSequence)

export function recordTutorInterventionReceipt(
  state: TutorOutcomeLedgerV1,
  receipt: TutorInterventionReceiptV1,
): TutorOutcomeAdmission {
  const existing = state.interventionReceipts.find(
    (item) => item.interventionRef === receipt.interventionRef,
  )
  if (existing) {
    return sameInterventionReceipt(existing, receipt)
      ? { status: 'duplicate-replay', state }
      : conflict(state, 'intervention-ref-conflict')
  }
  if (!isAcceptedOrderValid(receipt)) return conflict(state, 'invalid-accepted-order')
  if (receipt.acceptedSequence <= latestAcceptedSequence(state)) return conflict(state, 'out-of-order-fact')

  const pendingSameSkill = state.interventionReceipts.some((item) =>
    item.skillRef === receipt.skillRef && !isInterventionCorrelated(state, item.interventionRef))
  if (pendingSameSkill) return conflict(state, 'pending-same-skill-intervention')

  return {
    status: 'recorded',
    state: {
      ...state,
      interventionReceipts: [...state.interventionReceipts, receipt],
    },
  }
}

export function recordTutorOutcomeAttempt(
  state: TutorOutcomeLedgerV1,
  attempt: TutorOutcomeAttemptV1,
): TutorOutcomeAdmission {
  const existing = state.attempts.find((item) => item.attemptRef === attempt.attemptRef)
  if (existing) {
    return sameAttempt(existing, attempt)
      ? { status: 'duplicate-replay', state }
      : conflict(state, 'attempt-ref-conflict')
  }
  if (!isAcceptedOrderValid(attempt)) return conflict(state, 'invalid-accepted-order')
  if (attempt.acceptedSequence <= latestAcceptedSequence(state)) return conflict(state, 'out-of-order-fact')

  const eligible = isEligibleTutorAttempt(attempt)
  const priorRef = attempt.priorInterventionRef
  if (priorRef === null) {
    const missingCorrelation = eligible && state.interventionReceipts.some((receipt) =>
      receipt.skillRef === attempt.skillRef
      && receipt.acceptedSequence < attempt.acceptedSequence
      && !isInterventionCorrelated(state, receipt.interventionRef))
    if (missingCorrelation) return conflict(state, 'missing-prior-intervention-ref')
    return {
      status: 'recorded',
      state: { ...state, attempts: [...state.attempts, attempt] },
    }
  }

  const receipt = state.interventionReceipts.find((item) => item.interventionRef === priorRef)
  if (!receipt) return conflict(state, 'unknown-intervention')
  if (!eligible) return conflict(state, 'attempt-not-eligible')
  if (attempt.skillRef !== receipt.skillRef) return conflict(state, 'skill-mismatch')
  if (attempt.acceptedSequence <= receipt.acceptedSequence) {
    return conflict(state, 'attempt-not-after-intervention')
  }
  if (isInterventionCorrelated(state, priorRef)) {
    return conflict(state, 'intervention-already-correlated')
  }
  if (state.nextAttemptCorrelations.some((item) => item.attemptRef === attempt.attemptRef)) {
    return conflict(state, 'attempt-already-correlated')
  }
  if (eligibleAttemptsAfter(state, receipt).length > 0) {
    return conflict(state, 'not-next-eligible-attempt')
  }

  return {
    status: 'recorded',
    state: {
      ...state,
      attempts: [...state.attempts, attempt],
      nextAttemptCorrelations: [
        ...state.nextAttemptCorrelations,
        { interventionRef: priorRef, attemptRef: attempt.attemptRef },
      ],
    },
  }
}

export function recordTutorMasteryEvidence(
  state: TutorOutcomeLedgerV1,
  evidence: TutorMasteryEvidenceV1,
): TutorOutcomeAdmission {
  const existing = state.masteryEvidence.find((item) => item.evidenceRef === evidence.evidenceRef)
  if (existing) {
    return sameEvidence(existing, evidence)
      ? { status: 'duplicate-replay', state }
      : conflict(state, 'evidence-ref-conflict')
  }
  if (!isAcceptedOrderValid(evidence)) return conflict(state, 'invalid-accepted-order')
  if (evidence.acceptedSequence <= latestAcceptedSequence(state)) return conflict(state, 'out-of-order-fact')

  const receipt = state.interventionReceipts.find(
    (item) => item.interventionRef === evidence.interventionRef,
  )
  if (!receipt) return conflict(state, 'unknown-intervention')
  const attempt = state.attempts.find((item) => item.attemptRef === evidence.attemptRef)
  if (!attempt) return conflict(state, 'unknown-attempt')
  if (receipt.skillRef !== evidence.skillRef || attempt.skillRef !== evidence.skillRef) {
    return conflict(state, 'skill-mismatch')
  }
  if (!isInterventionCorrelated(state, evidence.interventionRef)) {
    return conflict(state, 'missing-next-attempt-correlation')
  }
  if (evidence.acceptedSequence <= attempt.acceptedSequence) {
    return conflict(state, 'evidence-not-after-attempt')
  }

  const ordinal = eligibleAttemptsAfter(state, receipt)
    .findIndex((item) => item.attemptRef === evidence.attemptRef) + 1
  if (ordinal < 1 || ordinal > EVENTUAL_MASTERY_ELIGIBLE_ATTEMPT_LIMIT) {
    return conflict(state, 'evidence-outside-bounded-window')
  }
  const assignedElsewhere = state.masteryEvidence.some((item) =>
    item.attemptRef === evidence.attemptRef
    && item.interventionRef !== evidence.interventionRef)
  if (assignedElsewhere) return conflict(state, 'attempt-evidence-already-assigned')

  return {
    status: 'recorded',
    state: { ...state, masteryEvidence: [...state.masteryEvidence, evidence] },
  }
}

export function projectTutorOutcomeAggregates(
  state: TutorOutcomeLedgerV1,
): TutorOutcomeAggregateProjectionV1 {
  const nextAttempts = state.nextAttemptCorrelations
    .map((link) => state.attempts.find((attempt) => attempt.attemptRef === link.attemptRef))
    .filter((attempt): attempt is TutorOutcomeAttemptV1 => attempt !== undefined)

  const observedMasteryRefs = new Set(
    state.masteryEvidence.map((evidence) => evidence.interventionRef),
  )
  const completedWindows = state.interventionReceipts.filter(
    (receipt) =>
      isInterventionCorrelated(state, receipt.interventionRef)
      && (
        observedMasteryRefs.has(receipt.interventionRef)
        || eligibleAttemptsAfter(state, receipt).length >= EVENTUAL_MASTERY_ELIGIBLE_ATTEMPT_LIMIT
      ),
  )
  const completedWindowRefs = new Set(completedWindows.map((receipt) => receipt.interventionRef))
  const masteryEvidenceRefs = new Set(
    state.masteryEvidence
      .filter((evidence) => completedWindowRefs.has(evidence.interventionRef))
      .map((evidence) => evidence.interventionRef),
  )

  return {
    schemaVersion: TUTOR_OUTCOME_SCHEMA_VERSION,
    interventionCount: state.interventionReceipts.length,
    nextAttemptEligibleDenominator: nextAttempts.length,
    nextAttemptImprovementNumerator: nextAttempts.filter(
      (attempt) => attempt.outcome?.improvement === 'improved',
    ).length,
    nextAttemptCorrectNumerator: nextAttempts.filter(
      (attempt) => attempt.outcome?.correctness === 'correct',
    ).length,
    eventualMasteryEvidenceDenominator: completedWindows.length,
    eventualMasteryEvidenceNumerator: masteryEvidenceRefs.size,
    adultEscalationCount: state.interventionReceipts.filter(
      (receipt) => receipt.adultEscalationState !== 'not-requested',
    ).length,
  }
}

/**
 * Exact allow-list serialization. Even if an untrusted caller supplies extra
 * runtime properties, problem text, answers, chat text, audio, identity, and
 * diagnostic/personality fields cannot cross this boundary.
 */
export function serializeTutorOutcomeLedger(state: TutorOutcomeLedgerV1): string {
  return JSON.stringify({
    schemaVersion: TUTOR_OUTCOME_SCHEMA_VERSION,
    privacy: {
      learnerIdentityIncluded: false,
      problemTextIncluded: false,
      answerTextIncluded: false,
      tutorResponseIncluded: false,
      transcriptIncluded: false,
      audioIncluded: false,
      emotionalOrPersonalityInferenceIncluded: false,
    },
    interventionReceipts: state.interventionReceipts.map((receipt) => ({
      schemaVersion: receipt.schemaVersion,
      interventionRef: receipt.interventionRef,
      skillRef: receipt.skillRef,
      originAttemptRef: receipt.originAttemptRef,
      interventionKind: receipt.interventionKind,
      engine: { name: receipt.engine.name, version: receipt.engine.version },
      curriculumReleaseRef: receipt.curriculumReleaseRef,
      adultEscalationState: receipt.adultEscalationState,
      acceptedSequence: receipt.acceptedSequence,
      acceptedAt: receipt.acceptedAt,
      acceptedTimeAuthority: receipt.acceptedTimeAuthority,
    })),
    attempts: state.attempts.map((attempt) => ({
      schemaVersion: attempt.schemaVersion,
      attemptRef: attempt.attemptRef,
      skillRef: attempt.skillRef,
      priorInterventionRef: attempt.priorInterventionRef,
      attemptKind: attempt.attemptKind,
      outcome: attempt.outcome === null ? null : {
        correctness: attempt.outcome.correctness,
        improvement: attempt.outcome.improvement,
      },
      acceptedSequence: attempt.acceptedSequence,
      acceptedAt: attempt.acceptedAt,
      acceptedTimeAuthority: attempt.acceptedTimeAuthority,
    })),
    nextAttemptCorrelations: state.nextAttemptCorrelations.map((correlation) => ({
      interventionRef: correlation.interventionRef,
      attemptRef: correlation.attemptRef,
    })),
    masteryEvidence: state.masteryEvidence.map((evidence) => ({
      schemaVersion: evidence.schemaVersion,
      evidenceRef: evidence.evidenceRef,
      evidenceKind: evidence.evidenceKind,
      interventionRef: evidence.interventionRef,
      attemptRef: evidence.attemptRef,
      skillRef: evidence.skillRef,
      acceptedSequence: evidence.acceptedSequence,
      acceptedAt: evidence.acceptedAt,
      acceptedTimeAuthority: evidence.acceptedTimeAuthority,
    })),
    aggregate: projectTutorOutcomeAggregates(state),
  })
}
