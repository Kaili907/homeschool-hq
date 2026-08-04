import {
  createGovernedIdRegistry,
  createStudySchemaRegistryPort,
  orchestrateStudyCoreBridge,
  type BridgeOutboxEventV1,
  type StudyProjectionV1,
  type StudyRecommendationV1,
  type StudyCoreOrchestrationResult,
  type UrgentSafetyGatewayConfiguration,
} from "../../bridges/tutor-core/src/index.ts";
import {
  AdaptiveTutorEngine,
  ParentTeacherReviewSchema,
  SafetyDecisionSchema,
  TutorProgramSchema,
  TutorResponseSchema,
  validateSkillGraph,
  validateWithSchema,
  type TutorProgram,
} from "../../../core/index.ts";
import { inspectContractVersion } from "../../contracts/versioning.ts";
import {
  learningEvidenceSchema,
  validateLearningEvidence,
} from "../../schemas/learning-evidence.schema.ts";
import type { AcceptedEventLedgerPort } from "./ledger.ts";
import { toLayeredSafetyConfiguration } from "./safety.ts";
import {
  resolveTutorSubjectRegistration,
  selectTutorProgram,
} from "./subject-registry.ts";

export interface SafeTutorBridgeRequest {
  readonly requestId: string;
  readonly sessionId: string;
  readonly lessonId: string;
  readonly segmentId: string;
  readonly subject: "math" | "english";
  readonly skillId: string;
  readonly transientLearnerText: string;
  readonly expectedAnswer: string;
  readonly occurredAt: string;
  readonly learnerLocalDate: string;
  readonly householdTimeZone: string;
  readonly taskType:
    | "retrieval-practice"
    | "direct-instruction"
    | "guided-practice"
    | "independent-practice"
    | "reflection"
    | "mastery-check";
}

export interface SafeTutorBridgeDependencies {
  readonly eventLedger: AcceptedEventLedgerPort;
  readonly safety: UrgentSafetyGatewayConfiguration;
}

export type SafeTutorBridgeResult =
  | {
      readonly status: "accepted";
      readonly bridgeVersion: "1.0.1";
      readonly bridgeContractVersion: 1;
      readonly eventId: string;
      readonly directive: "continue" | "reteach";
      readonly reasonCode: "tutor-core-continue" | "tutor-core-reteach";
      readonly eventLedgerIdempotencyKey: string;
      readonly outboxProposals: readonly BridgeOutboxEventV1[];
      readonly minimizedProjection: StudyProjectionV1;
      readonly recommendation: StudyRecommendationV1;
      readonly coreSubmitInvocations: 1;
    }
  | {
      readonly status: "stopped-or-quarantined";
      readonly result: Exclude<
        StudyCoreOrchestrationResult,
        { readonly status: "accepted" }
      >;
      readonly coreSubmitInvocations: 0 | 1;
    };

function frozenCorePort() {
  return {
    validateTutorResponse: (value: unknown) =>
      validateWithSchema(TutorResponseSchema, value),
    validateTutorProgram: (value: unknown) =>
      validateWithSchema(TutorProgramSchema, value),
    validateParentTeacherReview: (value: unknown) =>
      validateWithSchema(ParentTeacherReviewSchema, value),
    validateSafetyDecision: (value: unknown) =>
      validateWithSchema(SafetyDecisionSchema, value),
    validateSkillGraph,
    getMissingPrerequisites: (
      graph: Parameters<typeof validateSkillGraph>[0],
      skillId: string,
      demonstratedSkillIds: readonly string[],
    ) => {
      if (!validateSkillGraph(graph).valid) return [];
      const record = graph as {
        edges: readonly {
          prerequisiteSkillId: string;
          dependentSkillId: string;
        }[];
      };
      return record.edges
        .filter(
          (edge) =>
            edge.dependentSkillId === skillId &&
            !demonstratedSkillIds.includes(edge.prerequisiteSkillId),
        )
        .map((edge) => edge.prerequisiteSkillId);
    },
  };
}

function canonicalStudySchemas() {
  return createStudySchemaRegistryPort({
    inspectContractVersion,
    learningEvidenceSchema: {
      schemaVersion: learningEvidenceSchema.schemaVersion,
      validate: (value: unknown) =>
        validateLearningEvidence(value) as ReturnType<
          typeof bridgeLearningEvidenceValidation
        >,
    },
  });
}

function bridgeLearningEvidenceValidation(value: unknown) {
  return validateLearningEvidence(value) as unknown as import("../../bridges/tutor-core/src/index.ts").CanonicalValidationResult<
    import("../../bridges/tutor-core/src/index.ts").CanonicalLearningEvidenceV1
  >;
}

/**
 * Adapts a registered program to the caller's expected answer: the first
 * diagnostic item becomes a short-answer item accepting the caller-supplied
 * answer, and the remaining diagnostic items are preserved so the engine can
 * still walk the full diagnostic set before classifying misconceptions.
 */
export function adaptProgramToExpectedAnswer(
  baseProgram: TutorProgram,
  expectedAnswer: string,
): TutorProgram {
  const [sourceItem, ...remainingItems] = baseProgram.diagnosticItems;
  if (!sourceItem) {
    throw new Error("Tutor Core program has no diagnostic item.");
  }
  const adaptedItem = {
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
    identifyingInformationRequested:
      sourceItem.identifyingInformationRequested,
    kind: "short-answer" as const,
    acceptedAnswers: [expectedAnswer],
    caseSensitive: false,
    trimWhitespace: true,
    normalization: "basic-text" as const,
  };
  return {
    ...baseProgram,
    diagnosticItems: [adaptedItem, ...remainingItems],
  };
}

/**
 * Session 9's sole public Tutor bridge.
 *
 * Tutor Core construction, start, and submit all occur inside the callback
 * authorized by the accepted bridge. Urgent and uncertain disclosures
 * therefore stop before Tutor Core sees the transient learner text.
 */
export async function runSafeTutorBridge(
  request: SafeTutorBridgeRequest,
  dependencies: SafeTutorBridgeDependencies,
): Promise<SafeTutorBridgeResult> {
  const registration = resolveTutorSubjectRegistration(request.subject);
  const baseProgram = selectTutorProgram(
    registration,
    request.skillId,
    request.lessonId,
  );
  const hooks = registration.hooks;
  const program = adaptProgramToExpectedAnswer(
    baseProgram,
    request.expectedAnswer,
  );
  const skillRegistry = createGovernedIdRegistry([
    { studyId: request.skillId, tutorId: program.targetSkillId },
  ]);
  let coreSubmitInvocations = 0;

  const result = await orchestrateStudyCoreBridge(
    {
      transientLearnerText: request.transientLearnerText,
      eventId: request.requestId,
      occurredAt: request.occurredAt,
      tutorInteractionId: `interaction-${request.requestId
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(-100)}`,
      recommendationId: `recommendation:${request.requestId.slice(-60)}`,
      study: {
        studentId: "learner:local-release-candidate",
        sessionId: request.sessionId,
        lessonId: request.lessonId,
        segmentId: request.segmentId,
        subjectId: request.subject,
        skillId: request.skillId,
        taskType: request.taskType,
        gradeBand: "elementary-3-5",
        learnerLocalDate: request.learnerLocalDate,
        householdTimeZone: request.householdTimeZone,
      },
      submitToTutorCore: (transientLearnerText) => {
        coreSubmitInvocations += 1;
        const engine = new AdaptiveTutorEngine(program, hooks);
        engine.start();
        const tutorResponse = engine.submit({ raw: transientLearnerText });
        return {
          tutorResponse,
          tutorProgram: program,
        };
      },
    },
    {
      safety: toLayeredSafetyConfiguration(dependencies.safety),
      tutorCore: frozenCorePort(),
      skillRegistry,
      studySchemas: canonicalStudySchemas(),
      eventLedger: dependencies.eventLedger,
    },
  );

  if (result.status !== "accepted") {
    return {
      status: "stopped-or-quarantined",
      result,
      coreSubmitInvocations: coreSubmitInvocations as 0 | 1,
    };
  }
  const directive =
    result.recommendation.action === "reteach" ? "reteach" : "continue";
  return {
    status: "accepted",
    bridgeVersion: "1.0.1",
    bridgeContractVersion: 1,
    eventId: result.eventId,
    directive,
    reasonCode:
      directive === "continue"
        ? "tutor-core-continue"
        : "tutor-core-reteach",
    eventLedgerIdempotencyKey: result.eventLedgerIdempotencyKey,
    outboxProposals: result.outboxProposals,
    minimizedProjection: result.projection,
    recommendation: result.recommendation,
    coreSubmitInvocations: 1,
  };
}
