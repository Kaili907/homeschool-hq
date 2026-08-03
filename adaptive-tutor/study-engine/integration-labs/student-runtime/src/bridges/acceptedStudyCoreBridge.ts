import {
  orchestrateStudyCoreBridge,
  createGovernedIdRegistry,
  createStudySchemaRegistryPort,
  type StudyCoreOrchestrationResult,
} from "../../vendor/study-core-bridge/src/index.ts";
import {
  AdaptiveTutorEngine,
  ParentTeacherReviewSchema,
  SafetyDecisionSchema,
  TutorProgramSchema,
  TutorResponseSchema,
  validateSkillGraph,
  validateWithSchema,
} from "../../vendor/adaptive-tutor-core/core/index.ts";
import { mathTutorProgram, mathRuntimeHooks } from "../../vendor/adaptive-tutor-core/examples/math-interaction.ts";
import { englishTutorProgram, englishRuntimeHooks } from "../../vendor/adaptive-tutor-core/examples/english-interaction.ts";
import {
  inspectContractVersion,
  type SegmentId,
  type SessionId,
} from "@study-contracts";
import { learningEvidenceSchema, validateLearningEvidence } from "@study-schemas";
import type { RuntimeSubjectId, TutorCoreBoundaryReceipt } from "../runtimeTypes";

export const ACCEPTED_STUDY_CORE_BRIDGE_VERSION = "1.0.1" as const;
export const ACCEPTED_STUDY_CORE_BRIDGE_CONTRACT_VERSION = 1 as const;

export interface AcceptedBridgeRequest {
  readonly requestId: string;
  readonly sessionId: SessionId;
  readonly lessonId: string;
  readonly taskRef: SegmentId;
  readonly subjectId: RuntimeSubjectId;
  readonly skillId: string;
  readonly responseRef: string;
  readonly submissionRevision: number;
  readonly localResponse: string;
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
  readonly priorAcceptedEvents: readonly {
    readonly eventId: string;
    readonly idempotencyKey: string;
  }[];
}

function corePort() {
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

export async function runAcceptedStudyCoreBridge(
  request: AcceptedBridgeRequest,
): Promise<
  | { readonly ok: true; readonly receipt: TutorCoreBoundaryReceipt }
  | { readonly ok: false; readonly result: StudyCoreOrchestrationResult }
> {
  const baseProgram =
    request.subjectId === "math" ? mathTutorProgram : englishTutorProgram;
  const hooks =
    request.subjectId === "math" ? mathRuntimeHooks : englishRuntimeHooks;
  const sourceItem = baseProgram.diagnosticItems[0];
  if (!sourceItem) throw new Error("Tutor Core program has no diagnostic item.");
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
    identifyingInformationRequested: sourceItem.identifyingInformationRequested,
    kind: "short-answer" as const,
    acceptedAnswers: [request.expectedAnswer],
    caseSensitive: false,
    trimWhitespace: true,
    normalization: "basic-text" as const,
  };
  const program = { ...baseProgram, diagnosticItems: [adaptedItem] };
  const engine = new AdaptiveTutorEngine(program, hooks);
  const openingResponse = engine.start();
  const response = engine.submit({
    raw: request.localResponse,
  });
  const ledger = new Map(
    request.priorAcceptedEvents.map((entry) => [
      `${request.sessionId}:${entry.eventId}`,
      entry.idempotencyKey,
    ]),
  );
  const registry = createGovernedIdRegistry([
    { studyId: request.skillId, tutorId: program.targetSkillId },
  ]);
  const studySchemas = createStudySchemaRegistryPort({
    inspectContractVersion,
    learningEvidenceSchema: {
      schemaVersion: learningEvidenceSchema.schemaVersion,
      validate: (value: unknown) =>
        validateLearningEvidence(value) as ReturnType<
          typeof studySchemasValidateLearningEvidence
        >,
    },
  });
  const result = await orchestrateStudyCoreBridge(
    {
      transientLearnerText: request.localResponse,
      eventId: request.requestId,
      occurredAt: request.occurredAt,
      tutorInteractionId: `interaction-${request.requestId
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(-100)}`,
      recommendationId: `rec:${request.requestId.slice(-60)}`,
      study: {
        studentId: "learner_local_demo",
        sessionId: request.sessionId,
        lessonId: request.lessonId,
        segmentId: request.taskRef,
        subjectId: request.subjectId,
        skillId: request.skillId,
        taskType: request.taskType,
        gradeBand: "elementary-3-5",
        learnerLocalDate: request.learnerLocalDate,
        householdTimeZone: request.householdTimeZone,
      },
      submitToTutorCore: () => ({
        tutorResponse: response,
        tutorProgram: program,
        mediaCapabilities: {
          voiceAvailable: false,
          voiceReason: "missing-api",
          visualAvailable: true,
          visualReason: "available",
        },
      }),
    },
    {
      safety: { mode: "local-demo" },
      tutorCore: corePort(),
      skillRegistry: registry,
      studySchemas,
      eventLedger: {
        appendAcceptedEvent: async (sessionId, eventId, _version, key) => {
          const ledgerKey = `${sessionId}:${eventId}`;
          const previous = ledger.get(ledgerKey);
          if (previous === key) return { status: "duplicate-ignored" as const };
          if (previous !== undefined) {
            return { status: "idempotency-collision" as const };
          }
          ledger.set(ledgerKey, key);
          return { status: "appended" as const };
        },
      },
    },
  );
  if (result.status !== "accepted") return { ok: false, result };
  const coreScore = engine.getSnapshot().observations.at(-1)?.score;
  const directive =
    request.taskType === "reflection" || coreScore === 1
      ? "continue"
      : "reteach";
  return {
    ok: true,
    receipt: {
      bridgeVersion: ACCEPTED_STUDY_CORE_BRIDGE_VERSION,
      bridgeContractVersion: ACCEPTED_STUDY_CORE_BRIDGE_CONTRACT_VERSION,
      requestId: request.requestId,
      eventId: result.eventId,
      eventLedgerIdempotencyKey: result.eventLedgerIdempotencyKey,
      sessionId: request.sessionId,
      taskRef: request.taskRef,
      responseRef: request.responseRef,
      submissionRevision: request.submissionRevision,
      directive,
      reasonCode:
        directive === "reteach"
          ? "tutor-core-reteach"
          : "tutor-core-continue",
      occurredAt: request.occurredAt,
      ledgerAccepted: true,
      outboxProposalCount: result.outboxProposals.length,
    },
  };
}

function studySchemasValidateLearningEvidence(value: unknown) {
  return validateLearningEvidence(value) as unknown as import("../../vendor/study-core-bridge/src/index.ts").CanonicalValidationResult<
    import("../../vendor/study-core-bridge/src/index.ts").CanonicalLearningEvidenceV1
  >;
}
