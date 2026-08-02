import {
  BRIDGE_CONTRACT_VERSION,
  TUTOR_CORE_VERSION,
  type AdultReviewFlagV1,
  type BridgeValidationResult,
  type CanonicalLearningEvidenceV1,
  type LearnerSafeProjectionV1,
  type PrivacyActionCode,
  type StudyCompletionReviewInputV1,
  type StudyConfidenceEvidenceV1,
  type StudyMisconceptionOutcomeV1,
  type StudyProjectionV1,
  type StudyRecommendationV1,
  type StudySchemaRegistryPort,
  type TutorBridgeEventV1,
} from "./contracts.ts";
import {
  isVerifiedTutorEvent,
  type VerifiedTutorEventV1,
} from "./core-adapter.ts";
import { mapTutorPhaseToBridgeDisposition } from "./mappings.ts";
import { assertPersistenceProjectionSafe } from "./privacy.ts";
import {
  isIanaTimeZone,
  isISODate,
  isRFC3339,
  makeQuarantineRecord,
  validateTutorBridgeEvent,
} from "./validation.ts";

const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function evidenceBasis(event: TutorBridgeEventV1): string[] {
  return unique([
    event.eventId,
    ...(event.tutor.assessment?.evidenceIds ?? []),
    ...(event.tutor.prerequisite?.evidenceIds ?? []),
  ]);
}

function accuracyFor(
  event: TutorBridgeEventV1,
): CanonicalLearningEvidenceV1["accuracy"] | undefined {
  const assessment = event.tutor.assessment;
  if (!assessment) return undefined;
  return {
    correctCount: assessment.correctCount,
    attemptedCount: assessment.attemptedCount,
    accuracyPercent:
      (assessment.correctCount / assessment.attemptedCount) * 100,
    scoringMethod: "tutor-core-aggregate-v0.2",
  };
}

function independenceFor(
  event: TutorBridgeEventV1,
): CanonicalLearningEvidenceV1["independence"] | undefined {
  const source = event.tutor.assessment?.source;
  if (!source) return undefined;
  const supportLevel =
    source === "guided-practice"
      ? "guided"
      : source === "teacher-observation"
        ? "minimal-support"
        : "independent";
  return { supportLevel, source: "system-measure" };
}

function interventionFor(
  event: TutorBridgeEventV1,
): CanonicalLearningEvidenceV1["tutorIntervention"] | undefined {
  const kinds: NonNullable<
    CanonicalLearningEvidenceV1["tutorIntervention"]
  >["kinds"][number][] = [];
  if (event.tutor.phase === "teach-visually") kinds.push("worked-example");
  if (event.tutor.phase === "guided-practice") kinds.push("prompt");
  if (event.tutor.phase === "reteach") kinds.push("reteaching");
  if (
    event.tutor.phase === "escalated" ||
    event.tutor.safety?.mustEscalateToAdult
  ) {
    kinds.push("adult-escalation");
  }
  return kinds.length === 0
    ? undefined
    : { count: 1, kinds: [...new Set(kinds)] };
}

function masteryOutcomeFor(
  event: TutorBridgeEventV1,
): NonNullable<CanonicalLearningEvidenceV1["masteryOutcome"]> {
  const basisEvidenceIds = evidenceBasis(event);
  if (event.tutor.phase === "advance") {
    return {
      status: "demonstrated",
      criterionId: "tutor-core-independent-mastery",
      algorithmVersion: TUTOR_CORE_VERSION,
      basisEvidenceIds,
    };
  }
  if (event.tutor.phase === "reteach") {
    return {
      status: "not-yet-demonstrated",
      criterionId: "tutor-core-independent-mastery",
      algorithmVersion: TUTOR_CORE_VERSION,
      basisEvidenceIds,
    };
  }
  if (event.tutor.phase === "escalated") {
    return { status: "insufficient-evidence", basisEvidenceIds };
  }
  return { status: "insufficient-evidence", basisEvidenceIds };
}

function confidenceFor(
  event: TutorBridgeEventV1,
): StudyConfidenceEvidenceV1 | undefined {
  const confidence = event.tutor.confidence;
  if (!confidence) return undefined;
  return {
    value: confidence.value,
    uncertainty: confidence.uncertainty,
    lowerBound: confidence.lowerBound,
    upperBound: confidence.upperBound,
    evidenceCount: confidence.evidenceCount,
    distinctContextCount: confidence.distinctContextCount,
    band: confidence.band,
    sourceAuthority: "tutor-core",
    placementDecisionAllowed: false,
  };
}

function misconceptionFor(
  event: TutorBridgeEventV1,
): StudyMisconceptionOutcomeV1 | undefined {
  const result = event.tutor.misconception;
  if (!result) return undefined;
  return {
    misconceptionId: result.selectedMisconceptionId,
    status: result.status,
    uncertainty: result.uncertainty,
    evidenceCount: result.evidenceCount,
    sourceAuthority: "tutor-core",
    diagnosticClaimMade: false,
  };
}

function adultReviewFor(event: TutorBridgeEventV1): AdultReviewFlagV1 {
  const safety = event.tutor.safety;
  const phaseAdultReview = event.tutor.phase === "escalated";
  const required =
    phaseAdultReview ||
    safety?.mustEscalateToAdult === true ||
    event.tutor.prerequisite?.nextAction === "adult-review";
  const urgency =
    safety?.severity === "urgent-escalation"
      ? "urgent"
      : required
        ? "priority"
        : "routine";
  const reasonCodes = unique([
    ...(phaseAdultReview ? ["tutor-phase-escalated"] : []),
    ...(safety
      ? [
          safety.category === "medical-or-disability-diagnosis"
            ? "tutor-safety-qualified-professional-review"
            : `tutor-safety-${safety.category}`,
        ]
      : []),
    ...(event.tutor.prerequisite?.nextAction === "adult-review"
      ? ["tutor-prerequisite-adult-review"]
      : []),
  ]);
  return {
    required,
    urgency,
    reasonCodes,
    visibility: "authorized-adults-only",
  };
}

const LEARNER_MESSAGES: Readonly<
  Record<string, Omit<LearnerSafeProjectionV1, "adultReviewPending">>
> = {
  advance: {
    messageCode: "evidence-supports-next-step",
    message:
      "You used the skill across several examples. Your next practice step is ready.",
    mayContinue: true,
  },
  reteach: {
    messageCode: "another-explanation-next",
    message:
      "This skill needs another explanation and more practice. That is a normal part of learning.",
    mayContinue: true,
  },
  escalated: {
    messageCode: "adult-review-next",
    message:
      "An adult should review the learning evidence and help choose the next support. You are not in trouble.",
    mayContinue: false,
  },
  default: {
    messageCode: "evidence-recorded",
    message:
      "Your work was recorded as one piece of learning evidence. It does not label you.",
    mayContinue: true,
  },
};

function learnerProjectionFor(
  event: TutorBridgeEventV1,
  adultReview: AdultReviewFlagV1,
): LearnerSafeProjectionV1 {
  const source =
    LEARNER_MESSAGES[event.tutor.phase] ?? LEARNER_MESSAGES.default;
  if (!source) throw new Error("Learner message registry is incomplete.");
  return { ...source, adultReviewPending: adultReview.required };
}

function invalidMasteryClaim(event: TutorBridgeEventV1): boolean {
  if (event.tutor.phase !== "advance") return false;
  const assessment = event.tutor.assessment;
  const confidence = event.tutor.confidence;
  return (
    !assessment ||
    !confidence ||
    assessment.independentResponseCount < 3 ||
    assessment.distinctContextCount < 2 ||
    confidence.evidenceCount < 3 ||
    confidence.distinctContextCount < 2
  );
}

function buildLearningEvidence(
  event: TutorBridgeEventV1,
): CanonicalLearningEvidenceV1 {
  const basis = evidenceBasis(event);
  const accuracy = accuracyFor(event);
  const independence = independenceFor(event);
  const intervention = interventionFor(event);
  const prerequisite = event.tutor.prerequisite;
  return {
    kind: "learning-evidence",
    schemaVersion: 1,
    id: event.eventId,
    revision: 1,
    createdAt: event.occurredAt,
    updatedAt: event.occurredAt,
    metadata: {
      source: "adaptive-engine",
      tags: [
        "tutor-core",
        `tutor-event-${event.kind}`,
        `tutor-phase-${event.tutor.phase}`,
      ],
      extensions: {
        "manuel:tutor-package-version": event.packageVersion,
        "manuel:tutor-interaction-id": event.tutor.tutorInteractionId,
        "manuel:source-event-version": event.eventVersion,
      },
    },
    studentId: event.study.studentId,
    sessionId: event.study.sessionId,
    subjectId: event.study.subjectId,
    skillIds: [event.study.skillId],
    capturedAt: event.occurredAt,
    ...(accuracy ? { accuracy } : {}),
    ...(independence ? { independence } : {}),
    ...(intervention ? { tutorIntervention: intervention } : {}),
    masteryOutcome: masteryOutcomeFor(event),
    ...(prerequisite
      ? {
          prerequisiteGapOutcome: {
            status: prerequisite.status,
            prerequisiteSkillIds: [...prerequisite.prerequisiteSkillIds],
            basisEvidenceIds: [...prerequisite.evidenceIds],
            nextAction: prerequisite.nextAction,
          },
        }
      : {}),
    engagementSupport: {
      status: "insufficient-evidence",
      supportingSignals: [],
      wording: "contextual-and-revisable",
    },
  };
}

export function projectTutorEventToStudy(
  input: VerifiedTutorEventV1,
  options: {
    readonly receivedAt?: string;
    readonly schemaRegistry: StudySchemaRegistryPort;
  },
): BridgeValidationResult<StudyProjectionV1> {
  const receivedAt = options.receivedAt ?? new Date().toISOString();
  if (!isVerifiedTutorEvent(input)) {
    return {
      status: "quarantined",
      quarantine: makeQuarantineRecord(
        "invalid-authority-claim",
        "tutor-core",
        receivedAt,
      ),
    };
  }
  const eventValidation = validateTutorBridgeEvent(input.event, {
    receivedAt,
  });
  if (eventValidation.status !== "accepted") {
    return {
      status: "quarantined",
      quarantine:
        eventValidation.status === "quarantined"
          ? eventValidation.quarantine
          : makeQuarantineRecord(
              "invalid-authority-claim",
              "tutor-core",
              receivedAt,
            ),
    };
  }
  const event = eventValidation.value;
  if (invalidMasteryClaim(event)) {
    return {
      status: "quarantined",
      quarantine: makeQuarantineRecord(
        "invalid-authority-claim",
        "tutor-core",
        receivedAt,
        event.eventId,
      ),
    };
  }
  const evidence = buildLearningEvidence(event);
  if (
    options.schemaRegistry.schemaVersion !== 1 ||
    options.schemaRegistry.inspectVersion(evidence) !== "current"
  ) {
    return {
      status: "quarantined",
      quarantine: makeQuarantineRecord(
        "unsupported-contract-version",
        "study-engine",
        receivedAt,
        event.eventId,
      ),
    };
  }
  const canonical = options.schemaRegistry.validateLearningEvidence(evidence);
  if (!canonical.ok) {
    return {
      status: "quarantined",
      quarantine: makeQuarantineRecord(
        "malformed-event",
        "study-engine",
        receivedAt,
        event.eventId,
      ),
    };
  }
  const adultReview = adultReviewFor(event);
  const confidence = confidenceFor(event);
  const misconception = misconceptionFor(event);
  const projection: StudyProjectionV1 = {
    contract: "study-core-bridge.study-projection.v1",
    contractVersion: BRIDGE_CONTRACT_VERSION,
    sourceEventId: event.eventId,
    sourceEventVersion: event.eventVersion,
    sourceTutorVersion: TUTOR_CORE_VERSION,
    evidence,
    ...(confidence ? { confidence } : {}),
    ...(misconception ? { misconception } : {}),
    instructionDisposition: mapTutorPhaseToBridgeDisposition(event.tutor.phase),
    learner: learnerProjectionFor(event, adultReview),
    adult: {
      evidenceId: evidence.id,
      tutorInteractionId: event.tutor.tutorInteractionId,
      adultReview,
      ...(confidence ? { confidence } : {}),
      ...(misconception ? { misconception } : {}),
      rawTextIncluded: false,
      transcriptIncluded: false,
      directIdentifiersIncluded: false,
      privateNoteBodyIncluded: false,
    },
    privacyActions: input.privacyActions,
  };
  assertPersistenceProjectionSafe(projection);
  return {
    status: "accepted",
    value: projection,
    privacyActions: input.privacyActions,
  };
}

export function recommendStudyAction(
  projection: StudyProjectionV1,
  context: {
    readonly recommendationId: string;
    readonly learnerLocalDate: string;
    readonly householdTimeZone: string;
  },
): StudyRecommendationV1 {
  if (
    !OPAQUE_ID.test(context.recommendationId) ||
    !isISODate(context.learnerLocalDate) ||
    !isIanaTimeZone(context.householdTimeZone) ||
    projection.contract !== "study-core-bridge.study-projection.v1" ||
    projection.contractVersion !== BRIDGE_CONTRACT_VERSION
  ) {
    throw new Error("Recommendation context failed the non-echoing boundary.");
  }
  const prerequisite = projection.evidence.prerequisiteGapOutcome;
  let action: StudyRecommendationV1["action"] = "none";
  const reasonCodes: string[] = [];
  if (projection.adult.adultReview.required) {
    action = "adult-review";
    reasonCodes.push(...projection.adult.adultReview.reasonCodes);
  } else if (
    prerequisite?.status === "confirmed" ||
    prerequisite?.nextAction === "remediate"
  ) {
    action = "prerequisite-remediation";
    reasonCodes.push("tutor-prerequisite-remediation");
  } else if (projection.instructionDisposition === "reteach") {
    action = "reteach";
    reasonCodes.push("tutor-core-reteach");
  } else if (projection.instructionDisposition === "advance") {
    action = "review";
    reasonCodes.push("tutor-core-review-after-advance");
  } else if (
    projection.confidence?.band === "very-low" ||
    projection.confidence?.band === "low" ||
    projection.confidence?.band === "insufficient-evidence"
  ) {
    action = "review";
    reasonCodes.push("tutor-core-low-or-insufficient-confidence");
  } else {
    action = "continue-plan";
    reasonCodes.push("tutor-core-cycle-in-progress");
  }
  const recommendation: StudyRecommendationV1 = {
    contract: "study-core-bridge.recommendation.v1",
    contractVersion: BRIDGE_CONTRACT_VERSION,
    recommendationId: context.recommendationId,
    sourceEvidenceId: projection.evidence.id,
    action,
    reasonCodes: unique(reasonCodes),
    learnerLocalDate: context.learnerLocalDate,
    householdTimeZone: context.householdTimeZone,
    masteryDecisionMade: false,
    pacingDecisionMade: false,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
    directIdentifiersIncluded: false,
  };
  assertPersistenceProjectionSafe(recommendation);
  return recommendation;
}

export interface StudyCompletionInput {
  readonly eventId: string;
  readonly eventVersion: 1;
  readonly sessionId: string;
  readonly lessonId: string;
  readonly segmentId: string;
  readonly tutorInteractionId: string;
  readonly completedAt: string;
  readonly completed: boolean;
  readonly approvedBreakOccurred: boolean;
  readonly technicalInterruptionOccurred: boolean;
  readonly evidenceIds: readonly string[];
}

export function mapStudyCompletionToTutorReview(
  input: StudyCompletionInput,
): StudyCompletionReviewInputV1 {
  if (
    ![
      input.eventId,
      input.sessionId,
      input.lessonId,
      input.segmentId,
      input.tutorInteractionId,
      ...input.evidenceIds,
    ].every((value) => OPAQUE_ID.test(value)) ||
    input.eventVersion !== BRIDGE_CONTRACT_VERSION ||
    !isRFC3339(input.completedAt) ||
    new Set(input.evidenceIds).size !== input.evidenceIds.length
  ) {
    throw new Error("Completion input failed the non-echoing boundary.");
  }
  const output: StudyCompletionReviewInputV1 = {
    contract: "study-core-bridge.study-completion-review-input.v1",
    contractVersion: BRIDGE_CONTRACT_VERSION,
    eventId: input.eventId,
    eventVersion: input.eventVersion,
    sessionId: input.sessionId,
    lessonId: input.lessonId,
    segmentId: input.segmentId,
    tutorInteractionId: input.tutorInteractionId,
    completedAt: input.completedAt,
    completed: input.completed,
    approvedBreakOccurred: input.approvedBreakOccurred,
    technicalInterruptionOccurred: input.technicalInterruptionOccurred,
    evidenceIds: unique(input.evidenceIds),
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  };
  assertPersistenceProjectionSafe(output);
  return output;
}

export function mergePrivacyActions(
  ...groups: readonly (readonly PrivacyActionCode[])[]
): readonly PrivacyActionCode[] {
  return unique(groups.flat()) as PrivacyActionCode[];
}
