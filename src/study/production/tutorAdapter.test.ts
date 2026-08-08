/**
 * STUDY-A1-PROD-TUTOR-WRAPPER Phases 9, 10 and 12 — the narrow adapter's own
 * decisions.
 *
 * The drift oracle in ./tutorAdapterDrift.test.ts holds this adapter to the
 * frozen bridge everywhere the two are supposed to agree. This file is the
 * other half: the three places the production adapter deliberately does
 * something the frozen bridge does not, each tested on its own so a failure
 * names which one broke.
 *
 *   Phase 9   the grade band is a reviewed-content compatibility constant, and
 *             unreviewed content fails closed rather than being relabelled.
 *   Phase 10  learner-facing prose goes through the reviewed sanitizer, and the
 *             sanitizer's OUTPUT is what is kept.
 *   Phase 12  an accepted turn carrying adult-review or parent-control work is
 *             quarantined rather than silently discarded.
 */
import { describe, expect, it } from 'vitest'
import { LOCAL_DEMO_SAFETY_CONFIGURATION } from '../../../adaptive-tutor/study-engine/runtime/src/safety.ts'
import {
  resolveTutorSubjectRegistration,
  selectTutorProgram,
} from '../../../adaptive-tutor/study-engine/runtime/src/subject-registry.ts'
import {
  sanitizeLearnerFacingText,
  type BridgeOutboxEventV1,
  type ParentOverrideProvenanceV1,
  type StudyRecommendationV1,
} from '../../../adaptive-tutor/study-engine/bridges/tutor-core/src/index.ts'
import type { TutorProgram } from '../../../adaptive-tutor/core/index.ts'
import {
  STUDY_TUTOR_ADAPTER_REASON_CODES,
  STUDY_TUTOR_V1_GRADE_BAND,
  STUDY_TUTOR_V1_REVIEWED_GRADE_ENVELOPE,
  reviewedV1GradeBand,
  routableAsRoutineV1,
  runProductionTutorTurn,
} from './tutorAdapter'
import { isStudyTutorReasonCode } from '../contracts/tutor'

const acceptingLedger = {
  appendAcceptedEvent: async () => ({ status: 'appended' as const }),
}

const clearOutputSafety = {
  classify: async () => ({
    classification: 'clear' as const,
    mayContinue: true,
    adultHelpState: 'not-needed' as const,
  }),
}

function turnRequest(overrides: Partial<Parameters<typeof runProductionTutorTurn>[0]> = {}) {
  return {
    requestRef: 'study-turn:adapter-test',
    sessionRef: 'study-session:adapter-test',
    learnerPseudonym: 'learner:00112233445566778899aabbccddeeff',
    lessonRef: 'lesson:adapter-test',
    segmentRef: 'segment:adapter-test',
    skillRef: 'skill:adapter-test',
    subject: 'math' as const,
    taskType: 'guided-practice' as const,
    transientLearnerText: 'ready',
    expectedAnswer: 'ready',
    occurredAt: '2026-08-01T14:00:00.000Z',
    learnerLocalDate: '2026-08-01',
    householdTimeZone: 'America/Detroit',
    ...overrides,
  }
}

function programWithBand(min: number, max: number): TutorProgram {
  const base = selectTutorProgram(resolveTutorSubjectRegistration('math'), 'skill:none')
  return { ...base, gradeBand: { min, max, label: `Grades ${min}–${max}` } }
}

const ROUTINE_RECOMMENDATION: StudyRecommendationV1 = {
  contract: 'study-core-bridge.recommendation.v1',
  contractVersion: 1,
  recommendationId: 'recommendation:routine',
  sourceEvidenceId: 'evidence:routine',
  action: 'continue-plan',
  reasonCodes: ['tutor-core-continue'],
  learnerLocalDate: '2026-08-01',
  householdTimeZone: 'America/Detroit',
  masteryDecisionMade: false,
  pacingDecisionMade: false,
  rawAnswerIncluded: false,
  transcriptIncluded: false,
  directIdentifiersIncluded: false,
}

const PARENT_PROVENANCE: ParentOverrideProvenanceV1 = {
  decisionId: 'decision:parent-1',
  controlSetId: 'controls:household-1',
  controlRevision: 3,
  decidedByRole: 'parent',
  actorRef: 'actor:parent-1',
  decision: 'accepted',
  decidedAt: '2026-08-01T13:00:00.000Z',
}

function proposal(overrides: {
  readonly required?: boolean
  readonly urgency?: 'routine' | 'priority' | 'urgent'
  readonly provenance?: ParentOverrideProvenanceV1 | null
} = {}): BridgeOutboxEventV1 {
  return {
    contract: 'study-core-bridge.outbox-event.v1',
    contractVersion: 1,
    eventId: 'recommendation:routine-review-queue',
    eventVersion: 1,
    idempotencyKey: 'recommendation:routine:review-queue:v1',
    occurredAt: '2026-08-01T14:00:00.000Z',
    learnerLocalDate: '2026-08-01',
    householdTimeZone: 'America/Detroit',
    route: 'review-queue',
    retry: {
      maximumAttempts: 8,
      initialBackoffSeconds: 5,
      backoffMultiplier: 2,
      maximumBackoffSeconds: 900,
      terminalBehavior: 'quarantine',
    },
    quarantineOn: 'retry-exhausted',
    payload: {
      sourceEventId: 'event:routine',
      evidenceId: 'evidence:routine',
      recommendationId: 'recommendation:routine',
      sessionId: 'study-session:adapter-test',
      lessonId: 'lesson:adapter-test',
      segmentId: 'segment:adapter-test',
      action: 'continue-plan',
      reasonCodes: ['tutor-core-continue'],
      adultReview: {
        required: overrides.required ?? false,
        urgency: overrides.urgency ?? 'routine',
        reasonCodes: [],
        visibility: 'authorized-adults-only',
      },
      parentOverrideProvenance: overrides.provenance ?? null,
      rawAnswerIncluded: false,
      transcriptIncluded: false,
      directIdentifiersIncluded: false,
      adultPrivateNoteIncluded: false,
    },
  }
}

describe('Phase 9 — the grade band is a reviewed-content compatibility constant', () => {
  it('is the one legal member the reviewed frozen content is covered by', () => {
    expect(STUDY_TUTOR_V1_GRADE_BAND).toBe('elementary-3-5')
  })

  it('covers every program the frozen subject registry can actually return', () => {
    // Derived rather than asserted: the registrations are asked what they
    // declare, so registering content outside the envelope fails HERE as well
    // as at the adapter's own gate.
    for (const subject of ['math', 'english'] as const) {
      const registration = resolveTutorSubjectRegistration(subject)
      for (const entry of registration.programs) {
        expect(reviewedV1GradeBand(entry.program)).toBe(STUDY_TUTOR_V1_GRADE_BAND)
        expect(entry.program.gradeBand.min).toBeGreaterThanOrEqual(STUDY_TUTOR_V1_REVIEWED_GRADE_ENVELOPE.minimumGrade)
        expect(entry.program.gradeBand.max).toBeLessThanOrEqual(STUDY_TUTOR_V1_REVIEWED_GRADE_ENVELOPE.maximumGrade)
      }
    }
  })

  it('fails closed on Grade 7/8 content rather than labelling it elementary', () => {
    // The case D1 names explicitly. A middle-school program relabelled
    // `elementary-3-5` would be a false statement about what a child is being
    // taught, folded into a durable event digest.
    expect(reviewedV1GradeBand(programWithBand(7, 8))).toBeNull()
    expect(reviewedV1GradeBand(programWithBand(6, 7))).toBeNull()
    expect(reviewedV1GradeBand(programWithBand(9, 12))).toBeNull()
  })

  it('fails closed below the envelope too', () => {
    expect(reviewedV1GradeBand(programWithBand(1, 2))).toBeNull()
    expect(reviewedV1GradeBand(programWithBand(2, 5))).toBeNull()
  })

  it('fails closed on a nonsense band rather than coercing it', () => {
    expect(reviewedV1GradeBand(programWithBand(Number.NaN, 5))).toBeNull()
    expect(reviewedV1GradeBand(programWithBand(3, Number.POSITIVE_INFINITY))).toBeNull()
    expect(reviewedV1GradeBand(programWithBand(3.5, 5))).toBeNull()
  })

  it('takes no grade from any caller: the adapter request has no grade field', () => {
    // Phase 9's other half. There is no `grade`, `gradeLevel`, `workingLevel`
    // or `gradeBand` key on the request, so a browser-supplied or
    // student-supplied grade has nowhere to enter.
    const request = turnRequest()
    for (const forbidden of ['grade', 'gradeLevel', 'gradeBand', 'workingLevel', 'officialGrade']) {
      expect(Object.hasOwn(request, forbidden)).toBe(false)
    }
  })
})

describe('Phase 12 — an actionable adult-review proposal is never silently discarded', () => {
  it('admits the routine, non-actionable case', () => {
    expect(routableAsRoutineV1(ROUTINE_RECOMMENDATION, [proposal(), proposal(), proposal()])).toBe(true)
    expect(routableAsRoutineV1(ROUTINE_RECOMMENDATION, [])).toBe(true)
  })

  it('refuses an adult-review recommendation', () => {
    expect(routableAsRoutineV1({ ...ROUTINE_RECOMMENDATION, action: 'adult-review' }, [proposal()])).toBe(false)
  })

  it('refuses a proposal that requires adult review', () => {
    expect(routableAsRoutineV1(ROUTINE_RECOMMENDATION, [proposal({ required: true })])).toBe(false)
  })

  it('refuses a proposal whose urgency was raised', () => {
    expect(routableAsRoutineV1(ROUTINE_RECOMMENDATION, [proposal({ urgency: 'priority' })])).toBe(false)
    expect(routableAsRoutineV1(ROUTINE_RECOMMENDATION, [proposal({ urgency: 'urgent' })])).toBe(false)
  })

  it('refuses a proposal carrying a parent override decision', () => {
    expect(routableAsRoutineV1(ROUTINE_RECOMMENDATION, [proposal({ provenance: PARENT_PROVENANCE })])).toBe(false)
  })

  it('refuses when only ONE proposal in the batch is actionable', () => {
    // The failure mode a `some`/`every` slip would produce: two routine
    // proposals either side of a real one, and the real one dropped.
    expect(routableAsRoutineV1(ROUTINE_RECOMMENDATION, [
      proposal(),
      proposal({ required: true }),
      proposal(),
    ])).toBe(false)
    expect(routableAsRoutineV1(ROUTINE_RECOMMENDATION, [
      proposal(),
      proposal(),
      proposal({ provenance: PARENT_PROVENANCE }),
    ])).toBe(false)
  })

  it('quarantines with a structural code that blames nobody', () => {
    const code = STUDY_TUTOR_ADAPTER_REASON_CODES.actionableProposal
    // Admissible to the contract, so the quarantine actually reaches the host
    // rather than being rejected for its own reason code.
    expect(isStudyTutorReasonCode(code)).toBe(true)
    // Operator vocabulary about the wrapper's missing capability. It names no
    // learner, no classification and nothing she wrote.
    expect(code).toBe('tutor-adult-review-proposal-not-routable')
    for (const reasonCode of Object.values(STUDY_TUTOR_ADAPTER_REASON_CODES)) {
      expect(isStudyTutorReasonCode(reasonCode)).toBe(true)
      expect(reasonCode).not.toMatch(/learner|student|child|unsafe|wrote/i)
    }
  })
})

describe('Phase 10 — learner-facing prose crosses the reviewed sanitizer', () => {
  it('returns the sanitizer OUTPUT for an accepted turn, not the raw utterance', async () => {
    const result = await runProductionTutorTurn(turnRequest(), {
      eventLedger: acceptingLedger,
      safety: LOCAL_DEMO_SAFETY_CONFIGURATION,
      outputSafety: clearOutputSafety,
    })
    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') return
    // The whole point of running the sanitizer is that its output travels. A
    // caller that ran it and then showed the original would gain nothing, so
    // the returned text must be a fixed point of the sanitizer.
    expect(sanitizeLearnerFacingText(result.visibleText).text).toBe(result.visibleText)
    expect(result.visibleText.trim()).not.toBe('')
    expect(result.visibleText.length).toBeLessThanOrEqual(2_500)
  })

  it('reports the sanitizer actions rather than swallowing them', async () => {
    const result = await runProductionTutorTurn(turnRequest(), {
      eventLedger: acceptingLedger,
      safety: LOCAL_DEMO_SAFETY_CONFIGURATION,
      outputSafety: clearOutputSafety,
    })
    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') return
    expect(Array.isArray(result.privacyActions)).toBe(true)
  })

  it('carries the learner text back nowhere', async () => {
    const learnerText = 'my-private-answer-sentinel-9f2c1'
    const result = await runProductionTutorTurn(
      turnRequest({ transientLearnerText: learnerText, expectedAnswer: 'ready' }),
      { eventLedger: acceptingLedger, safety: LOCAL_DEMO_SAFETY_CONFIGURATION, outputSafety: clearOutputSafety },
    )
    // Whatever the outcome, the learner's own words are not in it.
    expect(JSON.stringify(result)).not.toContain(learnerText)
  })

  it('blocks the turn when the output classifier refuses, before any prose is prepared', async () => {
    const result = await runProductionTutorTurn(turnRequest(), {
      eventLedger: acceptingLedger,
      safety: LOCAL_DEMO_SAFETY_CONFIGURATION,
      outputSafety: {
        classify: async () => ({
          classification: 'uncertain' as const,
          mayContinue: false,
          adultHelpState: 'proposed-not-delivered' as const,
        }),
      },
    })
    expect(result.status).toBe('output-blocked')
    if (result.status !== 'output-blocked') return
    expect(result.classification).toBe('uncertain')
    expect(result.adultHelpState).toBe('proposed-not-delivered')
    expect(Object.keys(result)).not.toContain('visibleText')
  })

  it('fails closed when the output classifier throws', async () => {
    const result = await runProductionTutorTurn(turnRequest(), {
      eventLedger: acceptingLedger,
      safety: LOCAL_DEMO_SAFETY_CONFIGURATION,
      outputSafety: { classify: async () => { throw new Error('classifier unreachable') } },
    })
    expect(result.status).toBe('output-blocked')
    if (result.status !== 'output-blocked') return
    expect(result.classification).toBe('invalid')
  })

  it('quarantines an unteachable subject registration rather than guessing', async () => {
    const result = await runProductionTutorTurn(
      // A subject the registry has no registration for. Typed through the
      // adapter's own union, so this is the runtime half of a check the type
      // system already makes at the one production call site.
      turnRequest({ subject: 'science' as unknown as 'math' }),
      { eventLedger: acceptingLedger, safety: LOCAL_DEMO_SAFETY_CONFIGURATION, outputSafety: clearOutputSafety },
    )
    expect(result.status).toBe('wrapper-quarantined')
    if (result.status !== 'wrapper-quarantined') return
    expect(result.reasonCode).toBe(STUDY_TUTOR_ADAPTER_REASON_CODES.assemblyFailed)
  })
})
