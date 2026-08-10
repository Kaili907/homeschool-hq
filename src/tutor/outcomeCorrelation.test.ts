import { describe, expect, it } from 'vitest'
import {
  EVENTUAL_MASTERY_ELIGIBLE_ATTEMPT_LIMIT,
  TUTOR_ACCEPTED_TIME_AUTHORITY,
  TUTOR_OUTCOME_SCHEMA_VERSION,
  emptyTutorOutcomeLedger,
  projectTutorOutcomeAggregates,
  recordTutorInterventionReceipt,
  recordTutorMasteryEvidence,
  recordTutorOutcomeAttempt,
  serializeTutorOutcomeLedger,
  type TutorAttemptRef,
  type TutorCurriculumReleaseRef,
  type TutorEvidenceRef,
  type TutorInterventionReceiptV1,
  type TutorInterventionRef,
  type TutorMasteryEvidenceV1,
  type TutorOutcomeAttemptV1,
  type TutorOutcomeLedgerV1,
  type TutorSkillRef,
} from './outcomeCorrelation'

const interventionRef = 'intervention:opaque-1' as TutorInterventionRef
const skillRef = 'skill:opaque-math-1' as TutorSkillRef
const otherSkillRef = 'skill:opaque-reading-1' as TutorSkillRef
const originAttemptRef = 'attempt:opaque-origin' as TutorAttemptRef

const accepted = (acceptedSequence: number) => ({
  acceptedSequence,
  acceptedAt: `2026-08-09T12:00:${String(acceptedSequence).padStart(2, '0')}.000Z`,
  acceptedTimeAuthority: TUTOR_ACCEPTED_TIME_AUTHORITY,
})

const receipt = (overrides: Partial<TutorInterventionReceiptV1> = {}): TutorInterventionReceiptV1 => ({
  schemaVersion: TUTOR_OUTCOME_SCHEMA_VERSION,
  interventionRef,
  skillRef,
  originAttemptRef,
  interventionKind: 'guided-question',
  engine: { name: 'adaptive-tutor', version: 'engine-v1' },
  curriculumReleaseRef: 'curriculum:opaque-r1' as TutorCurriculumReleaseRef,
  adultEscalationState: 'not-requested',
  ...accepted(1),
  ...overrides,
})

const attempt = (
  attemptRef: string,
  acceptedSequence: number,
  overrides: Partial<TutorOutcomeAttemptV1> = {},
): TutorOutcomeAttemptV1 => ({
  schemaVersion: TUTOR_OUTCOME_SCHEMA_VERSION,
  attemptRef: attemptRef as TutorAttemptRef,
  skillRef,
  priorInterventionRef: null,
  attemptKind: 'practice',
  outcome: { correctness: 'incorrect', improvement: 'not-improved' },
  ...accepted(acceptedSequence),
  ...overrides,
} as TutorOutcomeAttemptV1)

const evidence = (
  attemptRef: TutorAttemptRef,
  acceptedSequence: number,
  overrides: Partial<TutorMasteryEvidenceV1> = {},
): TutorMasteryEvidenceV1 => ({
  schemaVersion: TUTOR_OUTCOME_SCHEMA_VERSION,
  evidenceRef: `evidence:opaque-${acceptedSequence}` as TutorEvidenceRef,
  evidenceKind: 'mastery_evidence',
  interventionRef,
  attemptRef,
  skillRef,
  ...accepted(acceptedSequence),
  ...overrides,
})

function recordReceipt(
  state = emptyTutorOutcomeLedger(),
  overrides: Partial<TutorInterventionReceiptV1> = {},
): TutorOutcomeLedgerV1 {
  const result = recordTutorInterventionReceipt(state, receipt(overrides))
  expect(result.status).toBe('recorded')
  return result.state
}

function recordNextAttempt(
  state: TutorOutcomeLedgerV1,
  attemptRef = 'attempt:opaque-next',
  acceptedSequence = 2,
): TutorOutcomeLedgerV1 {
  const result = recordTutorOutcomeAttempt(state, attempt(attemptRef, acceptedSequence, {
    priorInterventionRef: interventionRef,
    outcome: { correctness: 'correct', improvement: 'improved' },
  }))
  expect(result.status).toBe('recorded')
  return result.state
}

describe('Tutor intervention receipt contract', () => {
  it('creates a content-free receipt with opaque relationships and authority metadata', () => {
    const state = recordReceipt()
    expect(state.interventionReceipts).toEqual([receipt()])
    expect(state.interventionReceipts[0]).toMatchObject({
      interventionRef,
      skillRef,
      originAttemptRef,
      acceptedTimeAuthority: TUTOR_ACCEPTED_TIME_AUTHORITY,
      interventionKind: 'guided-question',
      engine: { name: 'adaptive-tutor', version: 'engine-v1' },
      curriculumReleaseRef: 'curriculum:opaque-r1',
    })
  })

  it('treats the same receipt as a duplicate replay and rejects a changed replay', () => {
    const state = recordReceipt()
    const duplicate = recordTutorInterventionReceipt(state, receipt())
    expect(duplicate).toEqual({ status: 'duplicate-replay', state })

    const conflict = recordTutorInterventionReceipt(state, receipt({ interventionKind: 'reteach' }))
    expect(conflict.status).toBe('conflict')
    if (conflict.status === 'conflict') expect(conflict.reason).toBe('intervention-ref-conflict')
    expect(conflict.state).toBe(state)
  })
})

describe('one intervention to its next eligible attempt', () => {
  it('correlates the explicitly linked next accepted same-skill scored attempt', () => {
    const state = recordNextAttempt(recordReceipt())
    expect(state.nextAttemptCorrelations).toEqual([{
      interventionRef,
      attemptRef: 'attempt:opaque-next',
    }])
  })

  it('skips unrelated and noneligible attempts without consuming the relationship', () => {
    let state = recordReceipt()
    let result = recordTutorOutcomeAttempt(state, attempt('attempt:unrelated', 2, {
      skillRef: otherSkillRef,
    }))
    expect(result.status).toBe('recorded')
    state = result.state

    result = recordTutorOutcomeAttempt(state, attempt('attempt:abandoned', 3, {
      attemptKind: 'abandoned',
      outcome: null,
    }))
    expect(result.status).toBe('recorded')
    state = result.state

    state = recordNextAttempt(state, 'attempt:eligible', 4)
    expect(state.nextAttemptCorrelations[0]?.attemptRef).toBe('attempt:eligible')
  })

  it('keeps an intervention pending when no eligible attempt has arrived', () => {
    const state = recordReceipt()
    expect(state.nextAttemptCorrelations).toHaveLength(0)
    expect(projectTutorOutcomeAggregates(state).nextAttemptEligibleDenominator).toBe(0)
  })

  it('rejects a missing explicit link when an eligible attempt would consume a pending receipt', () => {
    const state = recordReceipt()
    const result = recordTutorOutcomeAttempt(state, attempt('attempt:missing-link', 2))
    expect(result.status).toBe('conflict')
    if (result.status === 'conflict') expect(result.reason).toBe('missing-prior-intervention-ref')
  })

  it('rejects conflicting correlation and never assigns an attempt to two interventions', () => {
    let state = recordNextAttempt(recordReceipt())
    const otherInterventionRef = 'intervention:opaque-2' as TutorInterventionRef
    const secondReceipt = recordTutorInterventionReceipt(state, receipt({
      interventionRef: otherInterventionRef,
      acceptedSequence: 3,
      acceptedAt: accepted(3).acceptedAt,
    }))
    expect(secondReceipt.status).toBe('recorded')
    state = secondReceipt.state

    const reusedAttempt = recordTutorOutcomeAttempt(state, attempt('attempt:opaque-next', 4, {
      priorInterventionRef: otherInterventionRef,
    }))
    expect(reusedAttempt.status).toBe('conflict')
    if (reusedAttempt.status === 'conflict') expect(reusedAttempt.reason).toBe('attempt-ref-conflict')
  })

  it('does not let one intervention own multiple next attempts', () => {
    const state = recordNextAttempt(recordReceipt())
    const result = recordTutorOutcomeAttempt(state, attempt('attempt:second', 3, {
      priorInterventionRef: interventionRef,
    }))
    expect(result.status).toBe('conflict')
    if (result.status === 'conflict') expect(result.reason).toBe('intervention-already-correlated')
  })

  it('rejects a later candidate if an earlier eligible same-skill attempt was already accepted', () => {
    let state = recordReceipt()
    const first = recordTutorOutcomeAttempt(state, attempt('attempt:first', 2, {
      skillRef: otherSkillRef,
    }))
    expect(first.status).toBe('recorded')
    state = first.state

    const wrongSkillLink = recordTutorOutcomeAttempt(state, attempt('attempt:wrong-skill', 3, {
      skillRef: otherSkillRef,
      priorInterventionRef: interventionRef,
    }))
    expect(wrongSkillLink.status).toBe('conflict')
    if (wrongSkillLink.status === 'conflict') expect(wrongSkillLink.reason).toBe('skill-mismatch')
  })
})

describe('bounded subsequent mastery evidence', () => {
  it(`accepts mastery evidence within ${EVENTUAL_MASTERY_ELIGIBLE_ATTEMPT_LIMIT} eligible attempts`, () => {
    let state = recordNextAttempt(recordReceipt())
    let result = recordTutorOutcomeAttempt(state, attempt('attempt:eligible-2', 3))
    expect(result.status).toBe('recorded')
    state = result.state

    result = recordTutorMasteryEvidence(state, evidence('attempt:eligible-2' as TutorAttemptRef, 4))
    expect(result.status).toBe('recorded')
    expect(result.state.masteryEvidence).toHaveLength(1)
    expect(projectTutorOutcomeAggregates(result.state)).toMatchObject({
      eventualMasteryEvidenceDenominator: 1,
      eventualMasteryEvidenceNumerator: 1,
    })
  })

  it('rejects evidence outside the fixed eligible-attempt window', () => {
    let state = recordNextAttempt(recordReceipt())
    for (let ordinal = 2; ordinal <= 4; ordinal += 1) {
      const result = recordTutorOutcomeAttempt(
        state,
        attempt(`attempt:eligible-${ordinal}`, ordinal + 1),
      )
      expect(result.status).toBe('recorded')
      state = result.state
    }

    const result = recordTutorMasteryEvidence(
      state,
      evidence('attempt:eligible-4' as TutorAttemptRef, 6),
    )
    expect(result.status).toBe('conflict')
    if (result.status === 'conflict') expect(result.reason).toBe('evidence-outside-bounded-window')
  })
})

describe('privacy-safe projection and serialization', () => {
  it('derives aggregate numerators and denominators without learner identity', () => {
    let state = recordNextAttempt(recordReceipt(emptyTutorOutcomeLedger(), {
      adultEscalationState: 'requested',
    }))
    let result = recordTutorOutcomeAttempt(state, attempt('attempt:eligible-2', 3))
    expect(result.status).toBe('recorded')
    state = result.state
    result = recordTutorOutcomeAttempt(state, attempt('attempt:eligible-3', 4))
    expect(result.status).toBe('recorded')
    state = result.state
    result = recordTutorMasteryEvidence(
      state,
      evidence('attempt:eligible-2' as TutorAttemptRef, 5),
    )
    expect(result.status).toBe('recorded')
    state = result.state

    expect(projectTutorOutcomeAggregates(state)).toEqual({
      schemaVersion: 1,
      interventionCount: 1,
      nextAttemptEligibleDenominator: 1,
      nextAttemptImprovementNumerator: 1,
      nextAttemptCorrectNumerator: 1,
      eventualMasteryEvidenceDenominator: 1,
      eventualMasteryEvidenceNumerator: 1,
      adultEscalationCount: 1,
    })
    expect(projectTutorOutcomeAggregates(state)).not.toHaveProperty('learnerRef')
  })

  it('allow-list serialization cannot leak answers, chat text, problem text, or inference labels', () => {
    const unsafeReceipt = {
      ...receipt(),
      problem: 'SECRET PROBLEM',
      correctAnswer: 'SECRET CORRECT ANSWER',
      studentAnswer: 'SECRET STUDENT ANSWER',
      tutorResponse: 'SECRET TUTOR RESPONSE',
      conversationTranscript: 'SECRET TRANSCRIPT',
      audio: 'SECRET AUDIO',
      emotion: 'SECRET EMOTION',
      personality: 'SECRET PERSONALITY',
      learnerRef: 'SECRET LEARNER',
    } as TutorInterventionReceiptV1
    const admitted = recordTutorInterventionReceipt(emptyTutorOutcomeLedger(), unsafeReceipt)
    expect(admitted.status).toBe('recorded')
    const serialized = serializeTutorOutcomeLedger(admitted.state)

    for (const secret of [
      'SECRET PROBLEM',
      'SECRET CORRECT ANSWER',
      'SECRET STUDENT ANSWER',
      'SECRET TUTOR RESPONSE',
      'SECRET TRANSCRIPT',
      'SECRET AUDIO',
      'SECRET EMOTION',
      'SECRET PERSONALITY',
      'SECRET LEARNER',
    ]) expect(serialized).not.toContain(secret)

    expect(JSON.parse(serialized).privacy).toEqual({
      learnerIdentityIncluded: false,
      problemTextIncluded: false,
      answerTextIncluded: false,
      tutorResponseIncluded: false,
      transcriptIncluded: false,
      audioIncluded: false,
      emotionalOrPersonalityInferenceIncluded: false,
    })
  })
})
