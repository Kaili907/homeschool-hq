/**
 * STUDY-A1-PROD-TUTOR-WRAPPER — the narrow production Tutor adapter.
 *
 * The frozen `runSafeTutorBridge` in
 * adaptive-tutor/study-engine/runtime/src/tutor-bridge.ts already assembles a
 * Tutor Core turn, and this module deliberately does NOT call it, extend it, or
 * promote it. Three things baked into it are release-candidate assumptions
 * rather than production ones:
 *
 *  - its `studentId` is a hard-coded release-candidate sentinel — one literal
 *    string, the same for every child in every household. The literal is
 *    deliberately not repeated here: ./productionImportBoundary.test.ts scans
 *    this directory's production text for it, and that scan is one of the
 *    guards keeping the sentinel out of production.
 *  - it is reached through runtime/src/student.ts, whose sibling module
 *    runtime/src/health.ts reports `portable-non-production` — the mode
 *    `assertAcceptedStudyRuntime` in ../runtimeCompatibility.ts REQUIRES. That
 *    assertion is therefore unusable here, and calling it would be asserting
 *    that production is not production.
 *  - it returns no learner-facing prose at all, because the preview host writes
 *    its own two fixed sentences instead (runtimeFacade.ts:494).
 *
 * So this restates the assembly against the lower frozen primitives —
 * `orchestrateStudyCoreBridge`, the frozen Core engine and schemas, and the
 * subject registry — and changes exactly what production requires. Restating is
 * a drift surface, and it is closed the same way ../contracts/tutor/learnerText.ts
 * closes its restatement: ./tutorAdapterDrift.test.ts drives both this adapter
 * and the frozen bridge over one corpus and requires the fields that should
 * remain assembly-equivalent to agree exactly.
 *
 * What this module is NOT allowed to reach is pinned mechanically, before any
 * of it was written, by ./tutorAdapterImportClosure.test.ts.
 */
import {
  createGovernedIdRegistry,
  createStudySchemaRegistryPort,
  orchestrateStudyCoreBridge,
  sanitizeLearnerFacingText,
  type BridgeOutboxEventV1,
  type PrivacyActionCode,
  type StudyCoreOrchestrationResult,
  type StudyGradeBand,
  type StudyProjectionV1,
  type StudyRecommendationV1,
  type StudyTaskType,
  type UrgentSafetyGatewayConfiguration,
} from '../../../adaptive-tutor/study-engine/bridges/tutor-core/src/index.ts'
import {
  AdaptiveTutorEngine,
  ParentTeacherReviewSchema,
  SafetyDecisionSchema,
  TutorProgramSchema,
  TutorResponseSchema,
  validateSkillGraph,
  validateWithSchema,
  type TutorProgram,
} from '../../../adaptive-tutor/core/index.ts'
import { inspectContractVersion } from '../../../adaptive-tutor/study-engine/contracts/versioning.ts'
import {
  learningEvidenceSchema,
  validateLearningEvidence,
} from '../../../adaptive-tutor/study-engine/schemas/learning-evidence.schema.ts'
import type { AcceptedEventLedgerPort } from '../../../adaptive-tutor/study-engine/runtime/src/ledger.ts'
import { toLayeredSafetyConfiguration } from '../../../adaptive-tutor/study-engine/runtime/src/safety.ts'
import {
  resolveTutorSubjectRegistration,
  selectTutorProgram,
} from '../../../adaptive-tutor/study-engine/runtime/src/subject-registry.ts'

/**
 * D1 — the grade band this adapter sends, and the whole of what it means.
 *
 * `StudyContextV1.gradeBand` is a closed three-member union the bridge
 * validates for membership and folds into the accepted event's digest. For the
 * currently reviewed frozen Tutor content it is otherwise semantically inert:
 * nothing in `orchestrateStudyCoreBridge`, the Core engine, the projection or
 * the recommendation branches on it, and no program is selected by it — program
 * selection is by subject and routing id (see `selectTutorProgram`).
 *
 * It is therefore a CONTENT-COMPATIBILITY CONSTANT owned by this wrapper. It is
 * derived from what the reviewed frozen content declares, and it is not derived
 * from and does not describe any learner:
 *
 *  - it is NOT the learner's nominal grade,
 *  - it is NOT her working level,
 *  - it is NOT a browser-supplied or student-supplied grade,
 *  - it carries NO authority: it cannot place, promote, or hold back a child,
 *    and `STUDY_TUTOR_FORBIDDEN_KEYS` keeps every one of those vocabularies out
 *    of the contract in both directions.
 *
 * The reason no `gradeBand` field was added to `StudyTutorLaunch` or
 * `StudyTutorTurn` is exactly that. A field would be a channel, and the only
 * values a host could put in it are the learner's real grade or her working
 * level — the two things a Tutor must not be told.
 *
 * THE LIMIT OF THIS CONSTANT. It is compatible with the content reviewed as of
 * this card, and with nothing else. It says nothing about Grade 7 or Grade 8
 * material, and a later card that registers such a program MUST reopen this
 * constant rather than let it ride: `middle-6-8` content sent as `elementary-3-5`
 * would be a false statement about what a child is being taught, recorded in a
 * durable event digest. `assertReviewedV1GradeBand` below is what stops that
 * happening silently.
 */
export const STUDY_TUTOR_V1_GRADE_BAND: StudyGradeBand = 'elementary-3-5'

/**
 * The envelope the constant above was chosen against, read off the frozen
 * content rather than assumed.
 *
 * The frozen Math R1 manifest declares grades 4–6 and the English program
 * declares 4–6 with items from 3. Those are the two registrations
 * `resolveTutorSubjectRegistration` can return today, and `elementary-3-5` is
 * the legal union member that covers them.
 *
 * A program declaring anything outside this window is content this wrapper was
 * not reviewed for, and it fails closed rather than being relabelled.
 */
export const STUDY_TUTOR_V1_REVIEWED_GRADE_ENVELOPE = Object.freeze({
  minimumGrade: 3,
  maximumGrade: 6,
})

/**
 * Structural reason codes. Every one is operator vocabulary about the WRAPPER
 * or the CONTENT, and none of them says anything about a learner — they travel
 * to `quarantined`, which the host fails closed on without recording a safety
 * incident. Each satisfies `isStudyTutorReasonCode`: lower-case, hyphenated,
 * well inside 64 characters.
 */
export const STUDY_TUTOR_ADAPTER_REASON_CODES = Object.freeze({
  /** The selected program is outside the content D1's constant was reviewed for. */
  unreviewedContent: 'tutor-program-outside-reviewed-v1-content',
  /** An accepted turn carried adult-review or parent-control work V1 cannot route. */
  actionableProposal: 'tutor-adult-review-proposal-not-routable',
  /** The subject registry or the Core engine refused before any turn was evaluated. */
  assemblyFailed: 'tutor-adapter-assembly-failed',
  /** Tutor Core produced no learner-facing utterance this contract can show. */
  noVisibleText: 'tutor-core-produced-no-visible-text',
})

export interface StudyTutorAdapterRequest {
  /** The bridge's `eventId`; the host's per-turn idempotency reference. */
  readonly requestRef: string
  /** The bridge's `sessionId`; transport correlation only. */
  readonly sessionRef: string
  /**
   * D2 — the per-session pseudonym from ./tutorPseudonym.ts, and the ONLY
   * learner identity that crosses. Typed as a plain string here because that is
   * what `StudyContextV1` takes; that it is a pseudonym is enforced at the one
   * call site, in ./tutorRuntime.ts, which has no other value it could pass.
   */
  readonly learnerPseudonym: string
  readonly lessonRef: string
  readonly segmentRef: string
  readonly skillRef: string
  readonly subject: 'math' | 'english'
  readonly taskType: StudyTaskType
  readonly transientLearnerText: string
  readonly expectedAnswer: string
  readonly occurredAt: string
  readonly learnerLocalDate: string
  readonly householdTimeZone: string
}

export interface TutorOutputSafetyDecision {
  readonly classification: 'urgent' | 'uncertain' | 'clear' | 'invalid'
  readonly mayContinue: boolean
  readonly adultHelpState: 'not-needed' | 'proposed-not-delivered' | 'not-confirmed'
}

export interface StudyTutorAdapterDependencies {
  readonly eventLedger: AcceptedEventLedgerPort
  readonly safety: UrgentSafetyGatewayConfiguration
  readonly outputSafety: {
    classify(request: {
      readonly requestId: string
      readonly sessionId: string
      readonly transientTutorText: string
    }): Promise<TutorOutputSafetyDecision>
  }
}

export type StudyTutorAdapterResult =
  | {
      readonly status: 'accepted'
      readonly eventId: string
      readonly directive: 'continue' | 'reteach'
      readonly reasonCode: 'tutor-core-continue' | 'tutor-core-reteach'
      /**
       * The sanitized learner-facing utterance for this turn, and the one thing
       * this adapter returns that the frozen bridge does not.
       *
       * Transient. Nothing durable takes it — not the projection, not the
       * recommendation, not the event ledger — and there is no field in
       * `StudyTutorResult` for it to accumulate in.
       */
      readonly visibleText: string
      readonly privacyActions: readonly PrivacyActionCode[]
      readonly recommendation: StudyRecommendationV1
      readonly minimizedProjection: StudyProjectionV1
      readonly coreSubmitInvocations: 1
    }
  | {
      readonly status: 'stopped-or-quarantined'
      readonly result: Exclude<StudyCoreOrchestrationResult, { readonly status: 'accepted' }>
      readonly coreSubmitInvocations: 0 | 1
    }
  | {
      readonly status: 'output-blocked'
      readonly classification: 'urgent' | 'uncertain' | 'invalid'
      readonly adultHelpState: 'proposed-not-delivered' | 'not-confirmed'
      readonly coreSubmitInvocations: 1
    }
  /**
   * Structural, and this adapter's own. It is not a bridge status: it is this
   * wrapper saying it cannot vouch for, or cannot safely route, what came back.
   * The runtime maps it to `quarantined`, never to `stopped`.
   */
  | { readonly status: 'wrapper-quarantined'; readonly reasonCode: string }

const OUTPUT_BLOCKED = Symbol('tutor-output-blocked')

/**
 * D1's fail-closed half. Returns the compatibility constant only for content
 * inside the reviewed envelope, and `null` for anything else.
 *
 * `null` is not an error and not a stop: it is "this wrapper has not been
 * reviewed for this content", which is a statement about the CARD, not about
 * the child sitting in front of it.
 */
export function reviewedV1GradeBand(program: TutorProgram): StudyGradeBand | null {
  const band = program.gradeBand
  if (
    !Number.isSafeInteger(band.min) ||
    !Number.isSafeInteger(band.max) ||
    band.min < STUDY_TUTOR_V1_REVIEWED_GRADE_ENVELOPE.minimumGrade ||
    band.max > STUDY_TUTOR_V1_REVIEWED_GRADE_ENVELOPE.maximumGrade
  ) return null
  return STUDY_TUTOR_V1_GRADE_BAND
}

/**
 * Restated from the frozen bridge's unexported helper of the same shape. The
 * first diagnostic item becomes a short-answer item accepting the host's
 * expected answer; the rest are preserved so the engine still walks the full
 * diagnostic set.
 */
function adaptProgramToExpectedAnswer(baseProgram: TutorProgram, expectedAnswer: string): TutorProgram {
  const [sourceItem, ...remainingItems] = baseProgram.diagnosticItems
  if (!sourceItem) throw new Error('Tutor Core program has no diagnostic item.')
  return {
    ...baseProgram,
    diagnosticItems: [
      {
        id: sourceItem.id,
        skillId: sourceItem.skillId,
        purpose: sourceItem.purpose,
        subject: sourceItem.subject,
        gradeBand: sourceItem.gradeBand,
        locale: sourceItem.locale,
        prompt: sourceItem.prompt,
        maxAttempts: sourceItem.maxAttempts,
        estimatedSeconds: sourceItem.estimatedSeconds,
        tags: sourceItem.tags,
        noCameraRequired: sourceItem.noCameraRequired,
        identifyingInformationRequested: sourceItem.identifyingInformationRequested,
        kind: 'short-answer' as const,
        acceptedAnswers: [expectedAnswer],
        caseSensitive: false,
        trimWhitespace: true,
        normalization: 'basic-text' as const,
      },
      ...remainingItems,
    ],
  }
}

/**
 * Every string in the Core's response, for the OUTPUT safety classifier.
 *
 * Restated from the frozen bridge, and deliberately fed the RAW response rather
 * than the sanitized utterance: the classifier's job is to judge what the Tutor
 * actually said, and handing it text this wrapper had already cleaned would be
 * asking it to check its own answer.
 */
function collectTransientTutorText(value: unknown): string {
  const strings: string[] = []
  const active = new Set<object>()
  const visit = (entry: unknown): void => {
    if (typeof entry === 'string') {
      strings.push(entry)
      return
    }
    if (!entry || typeof entry !== 'object' || active.has(entry)) return
    active.add(entry)
    if (Array.isArray(entry)) entry.forEach(visit)
    else Object.keys(entry as Record<string, unknown>).sort().forEach((key) => visit((entry as Record<string, unknown>)[key]))
    active.delete(entry)
  }
  visit(value)
  return strings.join('\n')
}

function validOutputSafetyDecision(value: unknown): value is TutorOutputSafetyDecision {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 3 ||
    !['classification', 'mayContinue', 'adultHelpState'].every((key) => Object.hasOwn(record, key)) ||
    !['urgent', 'uncertain', 'clear', 'invalid'].includes(String(record.classification)) ||
    typeof record.mayContinue !== 'boolean'
  ) return false
  if (record.classification === 'clear') return record.mayContinue === true && record.adultHelpState === 'not-needed'
  if (record.classification === 'invalid') return record.mayContinue === false && record.adultHelpState === 'not-confirmed'
  return record.mayContinue === false && record.adultHelpState === 'proposed-not-delivered'
}

function frozenCorePort() {
  return {
    validateTutorResponse: (value: unknown) => validateWithSchema(TutorResponseSchema, value),
    validateTutorProgram: (value: unknown) => validateWithSchema(TutorProgramSchema, value),
    validateParentTeacherReview: (value: unknown) => validateWithSchema(ParentTeacherReviewSchema, value),
    validateSafetyDecision: (value: unknown) => validateWithSchema(SafetyDecisionSchema, value),
    validateSkillGraph,
    getMissingPrerequisites: (
      graph: Parameters<typeof validateSkillGraph>[0],
      skillId: string,
      demonstratedSkillIds: readonly string[],
    ) => {
      if (!validateSkillGraph(graph).valid) return []
      const record = graph as { edges: readonly { prerequisiteSkillId: string; dependentSkillId: string }[] }
      return record.edges
        .filter((edge) => edge.dependentSkillId === skillId && !demonstratedSkillIds.includes(edge.prerequisiteSkillId))
        .map((edge) => edge.prerequisiteSkillId)
    },
  }
}

function canonicalStudySchemas() {
  return createStudySchemaRegistryPort({
    inspectContractVersion,
    learningEvidenceSchema: {
      schemaVersion: learningEvidenceSchema.schemaVersion,
      validate: (value: unknown) => validateLearningEvidence(value) as never,
    },
  })
}

/**
 * The learner-facing utterance, read out of an UNTRUSTED Core response.
 *
 * The response has not been schema-validated at this point — validation happens
 * later, inside `adaptFrozenTutorCoreResult` — so nothing here may assume a
 * shape. A missing or non-string utterance yields `null` and the turn is
 * quarantined structurally rather than shown as an empty bubble.
 *
 * Nothing is coerced. `String(value)` would let an object whose `toString`
 * prints a sentence through, and it is the object, not the text it printed,
 * that would then travel.
 */
function learnerFacingUtterance(tutorResponse: unknown): string | null {
  if (!tutorResponse || typeof tutorResponse !== 'object' || Array.isArray(tutorResponse)) return null
  const spoken = (tutorResponse as Record<string, unknown>).spokenTurn
  if (!spoken || typeof spoken !== 'object' || Array.isArray(spoken)) return null
  const text = (spoken as Record<string, unknown>).text
  return typeof text === 'string' ? text : null
}

/**
 * PHASE 12 — the outbox fail-closed gate.
 *
 * `orchestrateStudyCoreBridge` returns up to three outbox proposals per
 * accepted turn: review-queue, calendar-placement and parent-control
 * enforcement. This wrapper routes NONE of them — there is no production
 * consumer for them yet — so it has to answer a question the frozen bridge
 * never had to: is it safe to drop these?
 *
 * For a routine turn, yes. A `continue-plan` recommendation whose proposals all
 * carry `adultReview.required === false` is bookkeeping, and discarding it
 * loses nothing a learner or an adult would ever have seen.
 *
 * For anything else, no, and the failure must be closed rather than quiet. A
 * proposal carrying `adult-review`, a required review, a raised urgency or a
 * parent override decision is WORK: it is the bridge saying an adult needs to
 * look at this, or that a parent control applies. Dropping it on the floor
 * would mean the system decided a grown-up should be told and then did not tell
 * them, with nothing anywhere recording that it happened.
 *
 * So an actionable proposal quarantines the turn. That is deliberately the
 * structural branch and not the safety branch: quarantine writes nothing
 * durable about the child, locks nothing, and blames nobody. The learner is not
 * flagged because the wrapper cannot deliver a message — she did nothing. The
 * turn simply does not complete, and an operator has a reason code that names
 * the wrapper's own missing capability.
 */
export function routableAsRoutineV1(
  recommendation: StudyRecommendationV1,
  proposals: readonly BridgeOutboxEventV1[],
): boolean {
  if (recommendation.action === 'adult-review') return false
  return proposals.every((proposal) =>
    proposal.payload.adultReview.required === false &&
    proposal.payload.adultReview.urgency === 'routine' &&
    proposal.payload.parentOverrideProvenance === null)
}

/**
 * One production Tutor turn.
 *
 * The safety ordering of the frozen bridge is preserved exactly, because it is
 * the frozen bridge's own: `orchestrateStudyCoreBridge` runs its pre-Core
 * urgent-safety gateway BEFORE the callback below, so a disclosure stops before
 * Tutor Core ever sees the learner's text, and the output classifier runs
 * inside the callback before any result is returned.
 */
export async function runProductionTutorTurn(
  request: StudyTutorAdapterRequest,
  dependencies: StudyTutorAdapterDependencies,
): Promise<StudyTutorAdapterResult> {
  let program: TutorProgram
  let hooks: ReturnType<typeof resolveTutorSubjectRegistration>['hooks']
  let gradeBand: StudyGradeBand
  try {
    const registration = resolveTutorSubjectRegistration(request.subject)
    const baseProgram = selectTutorProgram(registration, request.skillRef, request.lessonRef)
    const reviewed = reviewedV1GradeBand(baseProgram)
    if (reviewed === null) {
      return { status: 'wrapper-quarantined', reasonCode: STUDY_TUTOR_ADAPTER_REASON_CODES.unreviewedContent }
    }
    gradeBand = reviewed
    hooks = registration.hooks
    program = adaptProgramToExpectedAnswer(baseProgram, request.expectedAnswer)
  } catch {
    return { status: 'wrapper-quarantined', reasonCode: STUDY_TUTOR_ADAPTER_REASON_CODES.assemblyFailed }
  }

  const skillRegistry = createGovernedIdRegistry([
    { studyId: request.skillRef, tutorId: program.targetSkillId },
  ])
  let coreSubmitInvocations: 0 | 1 = 0
  let blockedOutput: Extract<StudyTutorAdapterResult, { status: 'output-blocked' }> | null = null
  let visibleText: string | null = null
  let privacyActions: readonly PrivacyActionCode[] = []

  const result = await orchestrateStudyCoreBridge(
    {
      transientLearnerText: request.transientLearnerText,
      eventId: request.requestRef,
      occurredAt: request.occurredAt,
      tutorInteractionId: `interaction-${request.requestRef
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(-100)}`,
      recommendationId: `recommendation:${request.requestRef.slice(-60)}`,
      study: {
        studentId: request.learnerPseudonym,
        sessionId: request.sessionRef,
        lessonId: request.lessonRef,
        segmentId: request.segmentRef,
        subjectId: request.subject,
        skillId: request.skillRef,
        taskType: request.taskType,
        gradeBand,
        learnerLocalDate: request.learnerLocalDate,
        householdTimeZone: request.householdTimeZone,
      },
      submitToTutorCore: async (transientLearnerText) => {
        coreSubmitInvocations = 1
        const engine = new AdaptiveTutorEngine(program, hooks)
        engine.start()
        const tutorResponse = engine.submit({ raw: transientLearnerText })

        // PHASE 10 — the output classifier judges the RAW response, before any
        // sanitization, and its verdict gates everything below.
        let decision: TutorOutputSafetyDecision
        try {
          const candidate = await dependencies.outputSafety.classify({
            requestId: `${request.requestRef}:tutor-output`,
            sessionId: request.sessionRef,
            transientTutorText: collectTransientTutorText(tutorResponse),
          })
          decision = validOutputSafetyDecision(candidate)
            ? candidate
            : { classification: 'invalid', mayContinue: false, adultHelpState: 'not-confirmed' }
        } catch {
          decision = { classification: 'invalid', mayContinue: false, adultHelpState: 'not-confirmed' }
        }
        if (decision.classification !== 'clear' || decision.mayContinue !== true) {
          blockedOutput = {
            status: 'output-blocked',
            classification: decision.classification === 'clear' ? 'invalid' : decision.classification,
            adultHelpState: decision.adultHelpState === 'not-needed' ? 'not-confirmed' : decision.adultHelpState,
            coreSubmitInvocations: 1,
          }
          throw OUTPUT_BLOCKED
        }

        // Only now, and only for a turn the classifier cleared, is the
        // utterance prepared for a learner's screen. Production is the first
        // path on which actual Tutor prose reaches a child, so length validation
        // alone is not the boundary: `sanitizeLearnerFacingText` is the reviewed
        // one, and its OUTPUT is what is kept — a caller that ran it and then
        // showed the original would have gained nothing from running it.
        const utterance = learnerFacingUtterance(tutorResponse)
        if (utterance !== null) {
          const safe = sanitizeLearnerFacingText(utterance)
          visibleText = safe.text
          privacyActions = safe.actions
        }
        return { tutorResponse, tutorProgram: program }
      },
    },
    {
      safety: toLayeredSafetyConfiguration(dependencies.safety),
      tutorCore: frozenCorePort(),
      skillRegistry,
      studySchemas: canonicalStudySchemas(),
      eventLedger: dependencies.eventLedger,
    },
  )

  if (blockedOutput) return blockedOutput
  if (result.status !== 'accepted') {
    return { status: 'stopped-or-quarantined', result, coreSubmitInvocations }
  }
  if (!routableAsRoutineV1(result.recommendation, result.outboxProposals)) {
    return { status: 'wrapper-quarantined', reasonCode: STUDY_TUTOR_ADAPTER_REASON_CODES.actionableProposal }
  }
  if (visibleText === null) {
    return { status: 'wrapper-quarantined', reasonCode: STUDY_TUTOR_ADAPTER_REASON_CODES.noVisibleText }
  }
  const directive = result.recommendation.action === 'reteach' ? 'reteach' : 'continue'
  return {
    status: 'accepted',
    eventId: result.eventId,
    directive,
    reasonCode: directive === 'continue' ? 'tutor-core-continue' : 'tutor-core-reteach',
    visibleText,
    privacyActions,
    recommendation: result.recommendation,
    minimizedProjection: result.projection,
    coreSubmitInvocations: 1,
  }
}
