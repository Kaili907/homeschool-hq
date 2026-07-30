import {
  BRIDGE_CONTRACT_VERSION,
  TUTOR_CORE_PACKAGE,
  TUTOR_CORE_VERSION,
  type BridgeValidationResult,
  type PrivacyActionCode,
  type StudyContextV1,
  type TutorAssessmentSummaryV1,
  type TutorBridgeEventV1,
  type TutorConfidenceV1,
  type TutorMediaStateV1,
  type TutorMisconceptionV1,
  type TutorPrerequisiteV1,
  type TutorSafetyV1,
  type TutorSpokenTurnV1,
} from "./contracts.ts";
import type { GovernedIdRegistry } from "./mappings.ts";
import {
  mapLearnerMedia,
  type LearnerMediaProjectionV1,
} from "./media.ts";
import { sanitizeLearnerFacingText } from "./privacy.ts";
import {
  consumePreCoreProcessingPermit,
  evaluatePreCoreUrgentSafety,
  type PreCoreProcessingPermitV1,
  type PreCoreUrgentSafetyResult,
} from "./safety-gateway.ts";
import {
  adaptTutorCoreValidationResult,
  type TutorCoreValidationResult,
} from "./schema-compatibility.ts";
import {
  makeQuarantineRecord,
  validateTutorBridgeEvent,
} from "./validation.ts";

const VERIFIED_TUTOR_EVENTS = new WeakSet<object>();

export interface VerifiedTutorEventV1 {
  readonly event: TutorBridgeEventV1;
  readonly privacyActions: readonly PrivacyActionCode[];
  readonly learnerMedia: LearnerMediaProjectionV1;
  readonly provenance: {
    readonly tutorResponseSchemaValidated: true;
    readonly tutorProgramSchemaValidated: true;
    readonly parentTeacherReviewSchemaValidated: boolean;
    readonly safetyDecisionSchemaValidated: boolean;
    readonly prerequisiteGraphRuntimeValidated: boolean;
    readonly prerequisiteResultEnvelopeValidated: false;
    readonly packageVersionPinned: typeof TUTOR_CORE_VERSION;
  };
}

export interface FrozenTutorCorePort {
  validateTutorResponse(value: unknown): TutorCoreValidationResult<unknown>;
  validateTutorProgram(value: unknown): TutorCoreValidationResult<unknown>;
  validateParentTeacherReview(
    value: unknown,
  ): TutorCoreValidationResult<unknown>;
  validateSafetyDecision(value: unknown): TutorCoreValidationResult<unknown>;
  validateSkillGraph(graph: unknown): {
    readonly valid: boolean;
    readonly errors: readonly string[];
  };
  getMissingPrerequisites(
    graph: unknown,
    skillId: string,
    demonstratedSkillIds: readonly string[],
  ): readonly string[];
}

export interface FrozenTutorCoreResultInput {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly tutorInteractionId: string;
  readonly study: StudyContextV1;
  readonly preCorePermit: PreCoreProcessingPermitV1;
  readonly tutorResponse: unknown;
  readonly tutorProgram: unknown;
  readonly parentTeacherReview?: unknown;
  readonly safetyDecision?: unknown;
  readonly mediaCapabilities?: TutorMediaStateV1;
}

export interface FrozenTutorCoreCallbackResult {
  readonly tutorResponse: unknown;
  readonly tutorProgram: unknown;
  readonly parentTeacherReview?: unknown;
  readonly safetyDecision?: unknown;
  readonly mediaCapabilities?: TutorMediaStateV1;
}

export interface StudyCoreBridgeCycleInput {
  readonly transientLearnerText: string;
  readonly eventId: string;
  readonly occurredAt: string;
  readonly tutorInteractionId: string;
  readonly study: StudyContextV1;
  readonly submitToTutorCore: (
    transientLearnerText: string,
  ) => FrozenTutorCoreCallbackResult;
}

export type StudyCoreBridgeCycleResult =
  | Exclude<
      PreCoreUrgentSafetyResult,
      { readonly status: "continue-to-tutor-core" }
    >
  | BridgeValidationResult<VerifiedTutorEventV1>;

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Frozen Core adapter received a non-record.");
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function validMediaCapabilities(value: unknown): value is TutorMediaStateV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }
  const media = value as Record<string, unknown>;
  return (
    Object.keys(media).length === 4 &&
    Object.hasOwn(media, "voiceAvailable") &&
    Object.hasOwn(media, "voiceReason") &&
    Object.hasOwn(media, "visualAvailable") &&
    Object.hasOwn(media, "visualReason") &&
    typeof media.voiceAvailable === "boolean" &&
    ["available", "missing-api", "disabled", "error"].includes(
      String(media.voiceReason),
    ) &&
    typeof media.visualAvailable === "boolean" &&
    [
      "available",
      "missing-media",
      "unsupported-command",
      "error",
    ].includes(String(media.visualReason))
  );
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child, seen);
  }
  return Object.freeze(value);
}

function consistentConfidenceBand(confidence: Record<string, unknown>): boolean {
  const value = Number(confidence.value);
  const uncertainty = Number(confidence.uncertainty);
  const count = Number(confidence.evidenceCount);
  const contexts = Number(confidence.distinctContextCount);
  const band = String(confidence.band);
  const expected =
    count < 3 || contexts < 2
      ? "insufficient-evidence"
      : value >= 0.85 && uncertainty <= 0.3
        ? "strong"
        : value >= 0.65
          ? "developing"
          : value >= 0.4
            ? "low"
            : "very-low";
  return band === expected;
}

function confidenceFromRecord(
  value: Record<string, unknown>,
): TutorConfidenceV1 | undefined {
  if (!consistentConfidenceBand(value)) return undefined;
  return {
    value: Number(value.value),
    uncertainty: Number(value.uncertainty),
    lowerBound: Number(value.lowerBound),
    upperBound: Number(value.upperBound),
    evidenceCount: Number(value.evidenceCount),
    effectiveEvidence: Number(value.effectiveEvidence),
    distinctContextCount: Number(value.distinctContextCount),
    band: String(value.band) as TutorConfidenceV1["band"],
    placementDecisionAllowed: false,
  };
}

function reviewEvidence(
  review: Record<string, unknown> | undefined,
  eventId: string,
): TutorAssessmentSummaryV1 | undefined {
  if (!review) return undefined;
  const evidence = asArray(review.evidence)
    .map((entry) => asRecord(entry))
    .filter((entry) =>
      ["independent-attempt", "reassessment"].includes(String(entry.source)),
    );
  const attemptedCount = evidence.reduce(
    (sum, item) => sum + Number(item.itemCount),
    0,
  );
  if (attemptedCount < 1) return undefined;
  const scoreTotal = evidence.reduce(
    (sum, item) => sum + Number(item.itemCount) * Number(item.meanScore),
    0,
  );
  const roundedCorrect = Math.round(scoreTotal);
  if (Math.abs(scoreTotal - roundedCorrect) > 1e-8) {
    return undefined;
  }
  const meanScore = scoreTotal / attemptedCount;
  return {
    source: "independent-attempt",
    outcome:
      meanScore === 1 ? "correct" : meanScore === 0 ? "incorrect" : "partial",
    correctCount: roundedCorrect,
    attemptedCount,
    meanScore,
    independentResponseCount: attemptedCount,
    distinctContextCount: Number(
      asRecord(review.confidence).distinctContextCount,
    ),
    evidenceIds: evidence.map(
      (item, index) =>
        `${eventId}-${String(item.source).replace(/[^a-z0-9-]/g, "-")}-${index + 1}`,
    ),
  };
}

function misconceptionFromReview(
  review: Record<string, unknown> | undefined,
): TutorMisconceptionV1 | undefined {
  if (!review) return undefined;
  const classification = asRecord(review.misconceptionClassification);
  const selected =
    classification.selectedMisconceptionId === null
      ? null
      : String(classification.selectedMisconceptionId);
  const hypotheses = asArray(classification.hypotheses).map(asRecord);
  const hypothesis = hypotheses.find(
    (entry) => entry.misconceptionId === selected,
  );
  return {
    selectedMisconceptionId: selected,
    status: hypothesis
      ? (String(hypothesis.status) as TutorMisconceptionV1["status"])
      : "insufficient-evidence",
    probability: hypothesis ? Number(hypothesis.probability) : 0,
    uncertainty: hypothesis ? Number(hypothesis.uncertainty) : 1,
    evidenceCount: hypothesis ? Number(hypothesis.evidenceCount) : 0,
    doNotDiagnose: true,
  };
}

function safetyFromDecision(
  safety: Record<string, unknown> | undefined,
): TutorSafetyV1 | undefined {
  if (!safety) return undefined;
  const triggers = asArray(safety.triggers).map(asRecord);
  if (triggers.length === 0) return undefined;
  if (
    triggers.some((trigger) =>
      [
        "self-harm-or-immediate-danger",
        "abuse-or-neglect-disclosure",
      ].includes(String(trigger.category)),
    )
  ) {
    return undefined;
  }
  const severityRank: Readonly<Record<string, number>> = {
    inform: 0,
    redirect: 1,
    escalate: 2,
    "urgent-escalation": 3,
  };
  const controlling = [...triggers].sort(
    (left, right) =>
      (severityRank[String(right.severity)] ?? -1) -
      (severityRank[String(left.severity)] ?? -1),
  )[0];
  if (!controlling) return undefined;
  return {
    category: String(controlling.category) as TutorSafetyV1["category"],
    severity: String(controlling.severity) as TutorSafetyV1["severity"],
    mustEscalateToAdult: Boolean(safety.mustEscalateToAdult),
    mustStopAcademicFlow: Boolean(safety.mustStopAcademicFlow),
    responseRuleIds: asArray(safety.responseRuleIds).map(String),
  };
}

function prerequisiteFromCore(
  port: FrozenTutorCorePort,
  program: Record<string, unknown>,
): {
  readonly ok: true;
  readonly value: TutorPrerequisiteV1;
} | {
  readonly ok: false;
  readonly reason: "invalid-authority-claim";
} {
  const graph = program.skillGraph;
  const graphResult = port.validateSkillGraph(graph);
  if (!graphResult.valid) {
    return { ok: false, reason: "invalid-authority-claim" };
  }
  return {
    ok: true,
    value: {
      prerequisiteSkillIds: [],
      status: "insufficient-evidence",
      evidenceIds: [],
      nextAction: "collect-more-evidence",
      tutorGraphValidated: true,
    },
  };
}

function coreAdvanceIsValid(
  response: Record<string, unknown>,
  program: Record<string, unknown>,
  review: Record<string, unknown> | undefined,
  assessment: TutorAssessmentSummaryV1 | undefined,
  confidence: TutorConfidenceV1 | undefined,
): boolean {
  if (response.phase !== "advance") return true;
  if (!review || !assessment || !confidence) return false;
  const mastery = asRecord(program.independentMastery);
  return (
    assessment.independentResponseCount >= Number(mastery.minimumEvidenceCount) &&
    assessment.distinctContextCount >= Number(mastery.minimumDistinctContexts) &&
    assessment.meanScore >= Number(mastery.minimumMeanScore) &&
    confidence.uncertainty <= Number(mastery.maximumUncertainty) &&
    confidence.evidenceCount >= 3 &&
    confidence.distinctContextCount >= 2 &&
    consistentConfidenceBand(asRecord(review.confidence))
  );
}

export function isVerifiedTutorEvent(
  value: unknown,
): value is VerifiedTutorEventV1 {
  return (
    typeof value === "object" &&
    value !== null &&
    VERIFIED_TUTOR_EVENTS.has(value)
  );
}

/**
 * The only authority-granting constructor for persistence-bound Tutor events.
 * It validates actual frozen Core contracts through injected Core runtime
 * validators, cross-checks program/review thresholds, and brands the result.
 */
export function adaptFrozenTutorCoreResult(
  input: FrozenTutorCoreResultInput,
  port: FrozenTutorCorePort,
  skillRegistry: GovernedIdRegistry,
): BridgeValidationResult<VerifiedTutorEventV1> {
  const receivedAt = input.occurredAt;
  const runtimeInput = input as unknown as Record<string, unknown>;
  const runtimeStudy =
    typeof runtimeInput.study === "object" &&
    runtimeInput.study !== null &&
    !Array.isArray(runtimeInput.study)
      ? (runtimeInput.study as Record<string, unknown>)
      : {};
  // Presentation is the use: revoke the capability before every other
  // authority-adapter check so rejected inputs cannot be repaired and retried.
  const permitConsumption = consumePreCoreProcessingPermit(
    runtimeInput.preCorePermit as PreCoreProcessingPermitV1,
    {
      eventId:
        typeof runtimeInput.eventId === "string" ? runtimeInput.eventId : "",
      sessionId:
        typeof runtimeStudy.sessionId === "string"
          ? runtimeStudy.sessionId
          : "",
      occurredAt:
        typeof runtimeInput.occurredAt === "string"
          ? runtimeInput.occurredAt
          : "",
    },
  );
  if (permitConsumption.status !== "consumed") {
    return {
      status: "quarantined",
      quarantine: makeQuarantineRecord(
        "invalid-authority-claim",
        "tutor-core",
        receivedAt,
        input.eventId,
      ),
    };
  }
  const allowedInputKeys = new Set([
    "eventId",
    "occurredAt",
    "tutorInteractionId",
    "study",
    "preCorePermit",
    "tutorResponse",
    "tutorProgram",
    "parentTeacherReview",
    "safetyDecision",
    "mediaCapabilities",
  ]);
  if (Object.keys(input).some((key) => !allowedInputKeys.has(key))) {
    return {
      status: "quarantined",
      quarantine: makeQuarantineRecord(
        "unknown-field",
        "tutor-core",
        receivedAt,
        input.eventId,
      ),
    };
  }
  const responseValidation = adaptTutorCoreValidationResult(
    port.validateTutorResponse(input.tutorResponse),
  );
  const programValidation = adaptTutorCoreValidationResult(
    port.validateTutorProgram(input.tutorProgram),
  );
  if (!responseValidation.ok || !programValidation.ok) {
    return {
      status: "quarantined",
      quarantine: makeQuarantineRecord(
        "malformed-event",
        "tutor-core",
        receivedAt,
        input.eventId,
      ),
    };
  }
  let review: Record<string, unknown> | undefined;
  if (input.parentTeacherReview !== undefined) {
    const result = adaptTutorCoreValidationResult(
      port.validateParentTeacherReview(input.parentTeacherReview),
    );
    if (!result.ok) {
      return {
        status: "quarantined",
        quarantine: makeQuarantineRecord(
          "malformed-event",
          "tutor-core",
          receivedAt,
          input.eventId,
        ),
      };
    }
    review = asRecord(result.value);
  }
  let safetyDecision: Record<string, unknown> | undefined;
  if (input.safetyDecision !== undefined) {
    const result = adaptTutorCoreValidationResult(
      port.validateSafetyDecision(input.safetyDecision),
    );
    if (!result.ok) {
      return {
        status: "quarantined",
        quarantine: makeQuarantineRecord(
          "malformed-event",
          "tutor-core",
          receivedAt,
          input.eventId,
        ),
      };
    }
    safetyDecision = asRecord(result.value);
  }
  const response = asRecord(responseValidation.value);
  const program = asRecord(programValidation.value);
  const mappedSkill = skillRegistry.toTutor(input.study.skillId);
  if (
    mappedSkill.status !== "mapped" ||
    response.skillId !== mappedSkill.value ||
    program.targetSkillId !== mappedSkill.value
  ) {
    return {
      status: "quarantined",
      quarantine: makeQuarantineRecord(
        mappedSkill.status === "mapped"
          ? "invalid-authority-claim"
          : "unmapped-identifier",
        "tutor-core",
        receivedAt,
        input.eventId,
      ),
    };
  }
  const responseConfidence =
    response.confidence === null || response.confidence === undefined
      ? undefined
      : confidenceFromRecord(asRecord(response.confidence));
  const reviewConfidence =
    review === undefined
      ? undefined
      : confidenceFromRecord(asRecord(review.confidence));
  const confidence = responseConfidence ?? reviewConfidence;
  if (
    (response.confidence !== null && response.confidence !== undefined) &&
    !responseConfidence
  ) {
    return {
      status: "quarantined",
      quarantine: makeQuarantineRecord(
        "invalid-authority-claim",
        "tutor-core",
        receivedAt,
        input.eventId,
      ),
    };
  }
  const assessment = reviewEvidence(review, input.eventId);
  if (!coreAdvanceIsValid(response, program, review, assessment, confidence)) {
    return {
      status: "quarantined",
      quarantine: makeQuarantineRecord(
        "invalid-authority-claim",
        "tutor-core",
        receivedAt,
        input.eventId,
      ),
    };
  }
  const safety = safetyFromDecision(safetyDecision);
  if (
    safetyDecision &&
    !safety &&
    asArray(safetyDecision.triggers).length > 0
  ) {
    return {
      status: "quarantined",
      quarantine: makeQuarantineRecord(
        "invalid-authority-claim",
        "tutor-core",
        receivedAt,
        input.eventId,
      ),
    };
  }
  const spoken = asRecord(response.spokenTurn);
  const safeText = sanitizeLearnerFacingText(String(spoken.text));
  const safeFallback = sanitizeLearnerFacingText(String(spoken.fallbackText));
  const mediaCapabilities = input.mediaCapabilities ?? {
    voiceAvailable: false,
    voiceReason: "missing-api",
    visualAvailable: true,
    visualReason: "available",
  };
  if (!validMediaCapabilities(mediaCapabilities)) {
    return {
      status: "quarantined",
      quarantine: makeQuarantineRecord(
        "malformed-event",
        "tutor-core",
        receivedAt,
        input.eventId,
      ),
    };
  }
  const learnerMedia = mapLearnerMedia(
    spoken as unknown as TutorSpokenTurnV1,
    mediaCapabilities,
    { boardCommands: asArray(response.boardCommands) },
  );
  const misconception = misconceptionFromReview(review);
  const prerequisiteResult = prerequisiteFromCore(
    port,
    program,
  );
  if (!prerequisiteResult.ok) {
    return {
      status: "quarantined",
      quarantine: makeQuarantineRecord(
        prerequisiteResult.reason,
        "tutor-core",
        receivedAt,
        input.eventId,
      ),
    };
  }
  const prerequisite = prerequisiteResult.value;
  const event: TutorBridgeEventV1 = {
    contract: "study-core-bridge.tutor-event.v1",
    contractVersion: BRIDGE_CONTRACT_VERSION,
    packageName: TUTOR_CORE_PACKAGE,
    packageVersion: TUTOR_CORE_VERSION,
    eventVersion: BRIDGE_CONTRACT_VERSION,
    eventId: input.eventId,
    occurredAt: input.occurredAt,
    kind: safety ? "safety-decision" : "tutor-response",
    study: input.study,
    tutor: {
      phase: String(response.phase) as TutorBridgeEventV1["tutor"]["phase"],
      tutorInteractionId: input.tutorInteractionId,
      programId: String(program.id),
      responseId: String(response.id),
      ...(assessment ? { assessment } : {}),
      ...(confidence ? { confidence } : {}),
      ...(misconception ? { misconception } : {}),
      ...(prerequisite ? { prerequisite } : {}),
      ...(safety ? { safety } : {}),
    },
  };
  const bridgeValidation = validateTutorBridgeEvent(event, { receivedAt });
  if (bridgeValidation.status !== "accepted") return bridgeValidation;
  const privacyActions = [
    ...new Set([
      ...safeText.actions,
      ...safeFallback.actions,
      ...learnerMedia.privacyActions,
    ]),
  ];
  const verified = deepFreeze<VerifiedTutorEventV1>({
    event: structuredClone(bridgeValidation.value),
    privacyActions,
    learnerMedia,
    provenance: {
      tutorResponseSchemaValidated: true,
      tutorProgramSchemaValidated: true,
      parentTeacherReviewSchemaValidated: review !== undefined,
      safetyDecisionSchemaValidated: safetyDecision !== undefined,
      prerequisiteGraphRuntimeValidated: true,
      prerequisiteResultEnvelopeValidated: false,
      packageVersionPinned: TUTOR_CORE_VERSION,
    },
  });
  VERIFIED_TUTOR_EVENTS.add(verified);
  return {
    status: "accepted",
    value: verified,
    privacyActions,
  };
}

/**
 * Legacy local-demo compatibility helper retained for the R1 adapter surface.
 *
 * @deprecated Production integrations must use `orchestrateStudyCoreBridge`,
 * which requires explicit production safety configuration and enforces the
 * accepted-event ledger before projection or outbox proposal construction.
 */
export function executeLocalDemoStudyCoreBridgeCycle(
  input: StudyCoreBridgeCycleInput,
  port: FrozenTutorCorePort,
  skillRegistry: GovernedIdRegistry,
): StudyCoreBridgeCycleResult {
  const gateway = evaluatePreCoreUrgentSafety(input.transientLearnerText, {
    eventId: input.eventId,
    sessionId: input.study.sessionId,
    occurredAt: input.occurredAt,
  });
  if (gateway.status !== "continue-to-tutor-core") return gateway;
  const coreResult = input.submitToTutorCore(input.transientLearnerText);
  return adaptFrozenTutorCoreResult(
    {
      ...coreResult,
      eventId: input.eventId,
      occurredAt: input.occurredAt,
      tutorInteractionId: input.tutorInteractionId,
      study: input.study,
      preCorePermit: gateway.permit,
    },
    port,
    skillRegistry,
  );
}
