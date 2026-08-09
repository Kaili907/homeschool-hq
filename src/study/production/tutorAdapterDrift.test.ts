/**
 * STUDY-A1-PROD-TUTOR-WRAPPER Phase 7 — the differential drift oracle.
 *
 * ./tutorAdapter.ts RESTATES assembly that `runSafeTutorBridge` already
 * performs: program selection, the expected-answer adaptation, the governed
 * skill registry, the frozen Core port, the canonical Study schemas, the
 * transient-text collection fed to the output classifier, and the mapping from
 * the orchestrator's recommendation to a host directive. A restatement is a
 * drift surface. Two implementations of the same assembly diverge the day one
 * of them is edited, and nothing about the edit announces which behaviours were
 * supposed to stay equal.
 *
 * So they are run side by side over a corpus and required to agree — the same
 * technique ../contracts/tutor/bridgeCompatibility.test.ts uses to close the
 * learner-text restatement against the real gateway.
 *
 * WHAT IS HELD EQUAL, and why each one matters:
 *
 *   status                        whether the turn was accepted at all
 *   eventId                       the accepted event's identity
 *   directive / reasonCode        what the host does next
 *   recommendation.action         what the bridge proposed
 *   outbox proposal shapes        route, adultReview, parent provenance
 *   eventLedgerIdempotencyKey     a SHA-256 over the canonical JSON of the
 *                                 VERIFIED event — so equality here means the
 *                                 two verified events are byte-identical,
 *                                 including the whole `study` context. This is
 *                                 the strongest assertion in the file and it is
 *                                 the one that would catch a silently different
 *                                 gradeBand, taskType, skill mapping or
 *                                 interaction id.
 *
 * WHAT IS DELIBERATELY NOT HELD EQUAL. Two divergences, each asserted as one
 * below rather than left to be noticed:
 *
 *   visibleText                   the production adapter returns the SANITIZED
 *                                 learner-facing utterance. The frozen bridge
 *                                 returns none at all — the preview host writes
 *                                 its own two fixed sentences instead — so
 *                                 there is nothing on that side to compare
 *                                 against. This is the intended difference the
 *                                 wrapper card names.
 *
 *   unmatched routing ids         STUDY-A1-TUTOR-CONTENT-ELIGIBILITY-CONTRACT.
 *                                 The frozen bridge's `selectTutorProgram` ends
 *                                 `matched ?? registration.programs[0]`, so
 *                                 content that routes to nothing is taught the
 *                                 subject default. The production adapter
 *                                 refuses. LEGACY SEMANTICS ARE UNCHANGED —
 *                                 the preview host depends on that fallback —
 *                                 so this oracle must not require agreement
 *                                 here, and the difference is pinned by driving
 *                                 both over one unmatched input.
 *
 * THE SENTINEL. The frozen bridge hard-codes a release-candidate learner
 * identifier. To compare assembly rather than identity, the harness hands the
 * adapter that same value as its `learnerPseudonym` — ONLY here, only inside
 * this comparison, and never anywhere production can reach: the adapter takes
 * the identifier as a parameter precisely so it has no opinion of its own, and
 * ./tutorAdapterImportClosure.test.ts proves the literal is absent from the
 * production closure. That the real pseudonym differs is asserted at the end.
 */
import { describe, expect, it } from 'vitest'
import {
  runSafeTutorBridge,
  type SafeTutorBridgeRequest,
  type SafeTutorBridgeResult,
} from '../../../adaptive-tutor/study-engine/runtime/src/tutor-bridge.ts'
import { LOCAL_DEMO_SAFETY_CONFIGURATION } from '../../../adaptive-tutor/study-engine/runtime/src/safety.ts'
import type { BridgeOutboxEventV1 } from '../../../adaptive-tutor/study-engine/bridges/tutor-core/src/index.ts'
import { STUDY_TUTOR_INELIGIBLE_REASONS, parseStudyTutorRef } from '../contracts/tutor'
import { runProductionTutorTurn, type StudyTutorAdapterResult } from './tutorAdapter'
import { studyTutorLearnerPseudonym } from './tutorPseudonym'

/** The frozen bridge's own hard-coded identifier, assembled rather than typed. */
const HARNESS_SENTINEL_LEARNER = ['learner', 'local-release-candidate'].join(':')

interface LedgerCall {
  readonly sessionId: string
  readonly eventId: string
  readonly eventVersion: number
  readonly idempotencyKey: string
}

/**
 * A ledger that records and accepts. One per run, so the two implementations
 * never see each other's appends and neither can be handed a duplicate.
 */
function recordingLedger(calls: LedgerCall[]) {
  return {
    appendAcceptedEvent: async (sessionId: string, eventId: string, eventVersion: number, idempotencyKey: string) => {
      calls.push({ sessionId, eventId, eventVersion, idempotencyKey })
      return { status: 'appended' as const }
    },
  }
}

const clearOutputSafety = {
  classify: async () => ({
    classification: 'clear' as const,
    mayContinue: true,
    adultHelpState: 'not-needed' as const,
  }),
}

/**
 * The compatibility corpus.
 *
 * A correct answer and a wrong one, in both registered subjects, so the
 * comparison covers both directive branches and both subject registrations
 * rather than one happy path.
 */
const CORPUS: readonly {
  readonly name: string
  readonly subject: 'math' | 'english'
  readonly taskType: SafeTutorBridgeRequest['taskType']
  readonly learnerText: string
  readonly expectedAnswer: string
}[] = [
  { name: 'math, matching answer', subject: 'math', taskType: 'guided-practice', learnerText: 'ready', expectedAnswer: 'ready' },
  { name: 'math, non-matching answer', subject: 'math', taskType: 'guided-practice', learnerText: 'not the answer', expectedAnswer: 'ready' },
  { name: 'math, mastery check', subject: 'math', taskType: 'mastery-check', learnerText: 'ready', expectedAnswer: 'ready' },
  { name: 'english, matching answer', subject: 'english', taskType: 'guided-practice', learnerText: 'ready', expectedAnswer: 'ready' },
  { name: 'english, retrieval practice', subject: 'english', taskType: 'retrieval-practice', learnerText: 'ready', expectedAnswer: 'ready' },
  { name: 'math, longer prose answer', subject: 'math', taskType: 'independent-practice', learnerText: 'I regrouped the tens and then added the ones column.', expectedAnswer: 'ready' },
]

/** Only the fields that must remain assembly-equivalent. */
function comparableProposal(proposal: BridgeOutboxEventV1) {
  return {
    route: proposal.route,
    contract: proposal.contract,
    action: proposal.payload.action,
    adultReviewRequired: proposal.payload.adultReview.required,
    adultReviewUrgency: proposal.payload.adultReview.urgency,
    adultReviewVisibility: proposal.payload.adultReview.visibility,
    parentOverrideProvenance: proposal.payload.parentOverrideProvenance,
    rawAnswerIncluded: proposal.payload.rawAnswerIncluded,
    transcriptIncluded: proposal.payload.transcriptIncluded,
    directIdentifiersIncluded: proposal.payload.directIdentifiersIncluded,
    adultPrivateNoteIncluded: proposal.payload.adultPrivateNoteIncluded,
  }
}

function frozenComparable(result: SafeTutorBridgeResult, ledger: readonly LedgerCall[]) {
  if (result.status !== 'accepted') return { status: result.status }
  return {
    status: result.status,
    eventId: result.eventId,
    directive: result.directive,
    reasonCode: result.reasonCode,
    recommendationAction: result.recommendation.action,
    recommendationReasonCodes: [...result.recommendation.reasonCodes],
    masteryDecisionMade: result.recommendation.masteryDecisionMade,
    proposals: result.outboxProposals.map(comparableProposal),
    evidenceSessionId: result.minimizedProjection.evidence.sessionId,
    evidenceStudentId: result.minimizedProjection.evidence.studentId,
    idempotencyKey: ledger.at(-1)?.idempotencyKey,
  }
}

function productionComparable(result: StudyTutorAdapterResult, ledger: readonly LedgerCall[]) {
  if (result.status !== 'accepted') return { status: result.status }
  return {
    status: result.status,
    eventId: result.eventId,
    directive: result.directive,
    reasonCode: result.reasonCode,
    recommendationAction: result.recommendation.action,
    recommendationReasonCodes: [...result.recommendation.reasonCodes],
    masteryDecisionMade: result.recommendation.masteryDecisionMade,
    proposals: [] as ReturnType<typeof comparableProposal>[],
    evidenceSessionId: result.minimizedProjection.evidence.sessionId,
    evidenceStudentId: result.minimizedProjection.evidence.studentId,
    idempotencyKey: ledger.at(-1)?.idempotencyKey,
  }
}

const SESSION_ID = 'study-session:drift-oracle'
const LESSON_ID = 'lesson:drift-oracle'
const SEGMENT_ID = 'segment:drift-oracle'

/**
 * STUDY-A1-TUTOR-CONTENT-ELIGIBILITY-CONTRACT — the oracle routes for real now.
 *
 * This was a single `skill:drift-oracle` used for both subjects, and it matched
 * nothing. The two sides agreed anyway, because both reached
 * `selectTutorProgram` and both got `registration.programs[0]` — so the whole
 * corpus below was comparing two implementations of the WRONG lesson, and
 * agreeing about it. That is the defect this card closed, sitting inside the
 * oracle meant to catch drift.
 *
 * These are ids the frozen content actually declares: sequence 01's first skill
 * id, and the English demonstration program's target skill. Both sides now
 * select the same real program by matching rather than by defaulting, and the
 * `eventLedgerIdempotencyKey` equality below — a SHA-256 over the whole
 * verified event — is what says so.
 *
 * `LESSON_ID` is deliberately left unroutable. The pair is what the adapter
 * routes on, so keeping one member unmatched keeps the oracle honest about
 * which id did the work.
 */
const ROUTING_SKILL_ID: Readonly<Record<'math' | 'english', string>> = {
  math: 'math-skill-pv-value-v1',
  english: 'english-complete-sentences',
}

describe('the narrow production adapter does not drift from the frozen bridge assembly', () => {
  for (const [index, entry] of CORPUS.entries()) {
    it(`agrees on ${entry.name}`, async () => {
      const requestId = `study-turn:drift-${index}`
      const frozenLedger: LedgerCall[] = []
      const productionLedger: LedgerCall[] = []

      const frozen = await runSafeTutorBridge(
        {
          requestId,
          sessionId: SESSION_ID,
          lessonId: LESSON_ID,
          segmentId: SEGMENT_ID,
          subject: entry.subject,
          skillId: ROUTING_SKILL_ID[entry.subject],
          transientLearnerText: entry.learnerText,
          expectedAnswer: entry.expectedAnswer,
          occurredAt: '2026-08-01T14:00:00.000Z',
          learnerLocalDate: '2026-08-01',
          householdTimeZone: 'America/Detroit',
          taskType: entry.taskType,
        },
        {
          eventLedger: recordingLedger(frozenLedger),
          safety: LOCAL_DEMO_SAFETY_CONFIGURATION,
          outputSafety: clearOutputSafety,
        },
      )

      const production = await runProductionTutorTurn(
        {
          requestRef: requestId,
          sessionRef: SESSION_ID,
          // Only here, and only to compare assembly rather than identity.
          learnerPseudonym: HARNESS_SENTINEL_LEARNER,
          lessonRef: LESSON_ID,
          segmentRef: SEGMENT_ID,
          skillRef: ROUTING_SKILL_ID[entry.subject],
          subject: entry.subject,
          taskType: entry.taskType,
          transientLearnerText: entry.learnerText,
          expectedAnswer: entry.expectedAnswer,
          occurredAt: '2026-08-01T14:00:00.000Z',
          learnerLocalDate: '2026-08-01',
          householdTimeZone: 'America/Detroit',
        },
        {
          eventLedger: recordingLedger(productionLedger),
          safety: LOCAL_DEMO_SAFETY_CONFIGURATION,
          outputSafety: clearOutputSafety,
        },
      )

      const frozenView = frozenComparable(frozen, frozenLedger)
      const productionView = productionComparable(production, productionLedger)
      // The production adapter routes no proposals, so it exposes none. The
      // frozen side's are compared as a shape statement rather than dropped:
      // every one must be the routine, non-actionable kind, which is exactly
      // the precondition ./tutorAdapter.ts asserts before discarding them.
      expect(frozenView.status).toBe('accepted')
      for (const proposal of frozenView.proposals ?? []) {
        expect(proposal.adultReviewRequired).toBe(false)
        expect(proposal.adultReviewUrgency).toBe('routine')
        expect(proposal.parentOverrideProvenance).toBeNull()
      }
      expect({ ...productionView, proposals: undefined })
        .toEqual({ ...frozenView, proposals: undefined })

      // The ledger saw the same accepted event on both sides, under the same
      // session and the same event version.
      expect(productionLedger).toEqual(frozenLedger)
    })
  }

  it('exposes sanitized learner-facing prose, which the frozen bridge does not', async () => {
    // The one intended divergence, asserted as one. The frozen result type has
    // no field for an utterance at all, so this is a capability the production
    // wrapper adds rather than a value the two disagree about.
    const productionLedger: LedgerCall[] = []
    const production = await runProductionTutorTurn(
      {
        requestRef: 'study-turn:drift-prose',
        sessionRef: SESSION_ID,
        learnerPseudonym: HARNESS_SENTINEL_LEARNER,
        lessonRef: LESSON_ID,
        segmentRef: SEGMENT_ID,
        skillRef: ROUTING_SKILL_ID.math,
        subject: 'math',
        taskType: 'guided-practice',
        transientLearnerText: 'ready',
        expectedAnswer: 'ready',
        occurredAt: '2026-08-01T14:00:00.000Z',
        learnerLocalDate: '2026-08-01',
        householdTimeZone: 'America/Detroit',
      },
      {
        eventLedger: recordingLedger(productionLedger),
        safety: LOCAL_DEMO_SAFETY_CONFIGURATION,
        outputSafety: clearOutputSafety,
      },
    )
    expect(production.status).toBe('accepted')
    if (production.status !== 'accepted') return
    expect(typeof production.visibleText).toBe('string')
    expect(production.visibleText.trim()).not.toBe('')
    // And it is within the bound the Tutor result contract enforces, so it can
    // actually reach a learner rather than being quarantined for length.
    expect(production.visibleText.length).toBeLessThanOrEqual(2_500)

    const frozenResult: SafeTutorBridgeResult = await runSafeTutorBridge(
      {
        requestId: 'study-turn:drift-prose-frozen',
        sessionId: SESSION_ID,
        lessonId: LESSON_ID,
        segmentId: SEGMENT_ID,
        subject: 'math',
        skillId: ROUTING_SKILL_ID.math,
        transientLearnerText: 'ready',
        expectedAnswer: 'ready',
        occurredAt: '2026-08-01T14:00:00.000Z',
        learnerLocalDate: '2026-08-01',
        householdTimeZone: 'America/Detroit',
        taskType: 'guided-practice',
      },
      { eventLedger: recordingLedger([]), safety: LOCAL_DEMO_SAFETY_CONFIGURATION, outputSafety: clearOutputSafety },
    )
    expect(frozenResult.status).toBe('accepted')
    expect(Object.keys(frozenResult)).not.toContain('visibleText')
  })

  it('diverges on unmatched content: the frozen bridge teaches the default, this one refuses', async () => {
    /**
     * THE PIN. One input, two answers, both driven for real.
     *
     * `lesson:fractions-week-3` and `skill:equivalent-fractions` are exactly the
     * Study-namespace ids subject-registry.ts says are deliberately unmapped.
     * The frozen bridge answers them with `registration.programs[0]` — sequence
     * 01, place value and regrouping — and returns `accepted`. A girl who sat
     * down to fractions is asked a place-value question and her session records
     * a normal accepted turn.
     *
     * This is not asserted as a bug to be fixed in the frozen tree. It is
     * load-bearing for the mounted preview host, which sends those very ids, and
     * the frozen tree's own suite pins it by name. What must not happen is the
     * production adapter inheriting it, and that is what the second half says.
     */
    const unmatched = {
      lessonRef: 'lesson:fractions-week-3',
      skillRef: 'skill:equivalent-fractions',
    }

    const frozenLedger: LedgerCall[] = []
    const frozen = await runSafeTutorBridge(
      {
        requestId: 'study-turn:divergence-frozen',
        sessionId: SESSION_ID,
        lessonId: unmatched.lessonRef,
        segmentId: SEGMENT_ID,
        subject: 'math',
        skillId: unmatched.skillRef,
        transientLearnerText: 'ready',
        expectedAnswer: 'ready',
        occurredAt: '2026-08-01T14:00:00.000Z',
        learnerLocalDate: '2026-08-01',
        householdTimeZone: 'America/Detroit',
        taskType: 'guided-practice',
      },
      { eventLedger: recordingLedger(frozenLedger), safety: LOCAL_DEMO_SAFETY_CONFIGURATION, outputSafety: clearOutputSafety },
    )
    // Legacy remains the fallback, and it is asserted rather than assumed.
    expect(frozen.status).toBe('accepted')

    const productionLedger: LedgerCall[] = []
    const production = await runProductionTutorTurn(
      {
        requestRef: 'study-turn:divergence-production',
        sessionRef: SESSION_ID,
        learnerPseudonym: HARNESS_SENTINEL_LEARNER,
        lessonRef: unmatched.lessonRef,
        segmentRef: SEGMENT_ID,
        skillRef: unmatched.skillRef,
        subject: 'math',
        taskType: 'guided-practice',
        transientLearnerText: 'ready',
        expectedAnswer: 'ready',
        occurredAt: '2026-08-01T14:00:00.000Z',
        learnerLocalDate: '2026-08-01',
        householdTimeZone: 'America/Detroit',
      },
      { eventLedger: recordingLedger(productionLedger), safety: LOCAL_DEMO_SAFETY_CONFIGURATION, outputSafety: clearOutputSafety },
    )
    expect(production).toEqual({
      status: 'wrapper-quarantined',
      reasonCode: STUDY_TUTOR_INELIGIBLE_REASONS.unmatchedLesson,
    })
    // And the refusal is total: Tutor Core was never asked, so no accepted event
    // reached the ledger for a lesson the learner was not doing.
    expect(productionLedger).toEqual([])
    expect(frozenLedger).toHaveLength(1)
  })

  it('sends a real per-session pseudonym, not the sentinel the harness compares against', async () => {
    // The harness above deliberately makes the two identities equal so that
    // assembly can be compared. This is the statement that production does not.
    const sessionRef = parseStudyTutorRef(SESSION_ID)!
    const pseudonym = await studyTutorLearnerPseudonym(sessionRef)
    expect(pseudonym).not.toBe(HARNESS_SENTINEL_LEARNER)
    expect(pseudonym).toMatch(/^learner:[0-9a-f]{32}$/)
  })
})
