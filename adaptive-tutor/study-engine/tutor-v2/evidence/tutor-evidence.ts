import { Type, type Static, type TSchema } from "../../../core/schema/typebox.js";
import {
  HintLevelSchema,
  ISODateTimeSchema,
  OpaqueReferenceSchema,
  PolicyCodeSchema,
  TutorActionKindSchema,
  validateExact,
  type ExactValidationIssue,
  type HintLevel,
  type OpaqueReference,
  type TutorActionKind,
} from "../../../core/v2/contracts/index.js";

export const ASSISTANCE_EVIDENCE_CHARACTERISTICS = [
  "INDEPENDENT",
  "LIGHT_HINT",
  "GUIDED",
  "RETEACH_REQUIRED",
] as const;

export type AssistanceEvidenceCharacteristic =
  (typeof ASSISTANCE_EVIDENCE_CHARACTERISTICS)[number];

export const DURABLE_TUTOR_EVIDENCE_ALLOWLIST = [
  "evidenceKind",
  "evidenceRef",
  "interactionRef",
  "observedAt",
  "tutorActionType",
  "hintLevelUsed",
  "assistanceLevel",
  "evidenceCharacteristic",
  "guidedInstructionUsed",
  "reteachRequired",
  "learnerResponseOutcome",
  "prerequisiteReview",
  "groundingReferenceIds",
  "policyOutcome",
  "policyReasonCode",
  "providerOutcomeClass",
  "fallbackUsed",
  "interventionCount",
  "currentConceptRef",
  "currentSkillRef",
] as const;

export const DURABLE_TUTOR_DATA_EXCLUSIONS = [
  "raw Tutor conversation or transcript",
  "raw audio",
  "raw provider prompt or response",
  "raw learner attempt or response content",
  "emotional label",
  "personality judgment",
  "psychological profile",
  "diagnostic inference",
  "arbitrary free-form private child note",
  "credential or authorization material",
  "mastery declaration or mutation",
  "working-level declaration or mutation",
  "unknown fields of any kind",
] as const;

export const PrerequisiteReviewEvidenceSchema = Type.Union([
  Type.Object(
    { status: Type.Literal("not-recommended") },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      status: Type.Literal("recommended"),
      prerequisiteConceptRefs: Type.Array(OpaqueReferenceSchema, {
        minItems: 1,
        maxItems: 12,
      }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      status: Type.Literal("assigned"),
      prerequisiteConceptRefs: Type.Array(OpaqueReferenceSchema, {
        minItems: 1,
        maxItems: 12,
      }),
      assignmentRef: OpaqueReferenceSchema,
    },
    { additionalProperties: false },
  ),
]);
export type PrerequisiteReviewEvidence = Static<
  typeof PrerequisiteReviewEvidenceSchema
>;

export const TutorEvidenceProjectionInputSchema = Type.Object(
  {
    evidenceRef: OpaqueReferenceSchema,
    interactionRef: OpaqueReferenceSchema,
    observedAt: ISODateTimeSchema,
    tutorActionType: Type.Union([TutorActionKindSchema, Type.Null()]),
    hintLevelUsed: HintLevelSchema,
    guidedInstructionUsed: Type.Boolean(),
    reteachRequired: Type.Boolean(),
    learnerResponseOutcome: Type.Union([
      Type.Literal("correct"),
      Type.Literal("partial"),
      Type.Literal("incorrect"),
      Type.Literal("not-evaluated"),
    ]),
    prerequisiteReview: PrerequisiteReviewEvidenceSchema,
    groundingReferenceIds: Type.Array(OpaqueReferenceSchema, { maxItems: 12 }),
    policyOutcome: Type.Union([
      Type.Literal("action-approved"),
      Type.Literal("action-rejected"),
      Type.Literal("fallback-required"),
      Type.Literal("safety-stop"),
    ]),
    policyReasonCode: PolicyCodeSchema,
    providerOutcomeClass: Type.Union([
      Type.Literal("action-proposed"),
      Type.Literal("provider-failure"),
      Type.Literal("provider-refusal"),
      Type.Literal("static-fallback"),
      Type.Literal("safety-stop"),
    ]),
    fallbackUsed: Type.Boolean(),
    interventionCount: Type.Integer({ minimum: 0, maximum: 1000 }),
    currentConceptRef: OpaqueReferenceSchema,
    currentSkillRef: OpaqueReferenceSchema,
  },
  { additionalProperties: false, $id: "TutorV2EvidenceProjectionInput" },
);
export type TutorEvidenceProjectionInput = Static<
  typeof TutorEvidenceProjectionInputSchema
>;

interface DurableTutorEvidenceCommon {
  evidenceKind: "tutor-instructional-evidence";
  evidenceRef: OpaqueReference;
  interactionRef: OpaqueReference;
  observedAt: string;
  tutorActionType: TutorActionKind | null;
  learnerResponseOutcome: "correct" | "partial" | "incorrect" | "not-evaluated";
  prerequisiteReview: PrerequisiteReviewEvidence;
  groundingReferenceIds: OpaqueReference[];
  policyOutcome: "action-approved" | "action-rejected" | "fallback-required" | "safety-stop";
  policyReasonCode: string;
  providerOutcomeClass:
    | "action-proposed"
    | "provider-failure"
    | "provider-refusal"
    | "static-fallback"
    | "safety-stop";
  fallbackUsed: boolean;
  interventionCount: number;
  currentConceptRef: OpaqueReference;
  currentSkillRef: OpaqueReference;
}

type DurableAssistanceEvidence =
  | {
      hintLevelUsed: "none";
      assistanceLevel: "independent";
      evidenceCharacteristic: "INDEPENDENT";
      guidedInstructionUsed: false;
      reteachRequired: false;
    }
  | {
      hintLevelUsed: "nudge" | "concept-cue";
      assistanceLevel: "light-hint";
      evidenceCharacteristic: "LIGHT_HINT";
      guidedInstructionUsed: false;
      reteachRequired: false;
    }
  | {
      hintLevelUsed: HintLevel;
      assistanceLevel: "guided";
      evidenceCharacteristic: "GUIDED";
      guidedInstructionUsed: true;
      reteachRequired: false;
    }
  | {
      hintLevelUsed: HintLevel;
      assistanceLevel: "reteach-required";
      evidenceCharacteristic: "RETEACH_REQUIRED";
      guidedInstructionUsed: boolean;
      reteachRequired: true;
    };

export type DurableTutorEvidence = DurableTutorEvidenceCommon & DurableAssistanceEvidence;

const DurableEvidenceCommonSchema = Type.Object(
  {
    evidenceKind: Type.Literal("tutor-instructional-evidence"),
    evidenceRef: OpaqueReferenceSchema,
    interactionRef: OpaqueReferenceSchema,
    observedAt: ISODateTimeSchema,
    tutorActionType: Type.Union([TutorActionKindSchema, Type.Null()]),
    learnerResponseOutcome: Type.Union([
      Type.Literal("correct"),
      Type.Literal("partial"),
      Type.Literal("incorrect"),
      Type.Literal("not-evaluated"),
    ]),
    prerequisiteReview: PrerequisiteReviewEvidenceSchema,
    groundingReferenceIds: Type.Array(OpaqueReferenceSchema, { maxItems: 12 }),
    policyOutcome: Type.Union([
      Type.Literal("action-approved"),
      Type.Literal("action-rejected"),
      Type.Literal("fallback-required"),
      Type.Literal("safety-stop"),
    ]),
    policyReasonCode: PolicyCodeSchema,
    providerOutcomeClass: Type.Union([
      Type.Literal("action-proposed"),
      Type.Literal("provider-failure"),
      Type.Literal("provider-refusal"),
      Type.Literal("static-fallback"),
      Type.Literal("safety-stop"),
    ]),
    fallbackUsed: Type.Boolean(),
    interventionCount: Type.Integer({ minimum: 0, maximum: 1000 }),
    currentConceptRef: OpaqueReferenceSchema,
    currentSkillRef: OpaqueReferenceSchema,
  },
  { additionalProperties: false },
);

function assistanceVariant(
  assistanceLevel: "independent" | "light-hint" | "guided" | "reteach-required",
  evidenceCharacteristic: AssistanceEvidenceCharacteristic,
  hintLevelUsed: TSchema,
  guidedInstructionUsed: boolean | TSchema,
  reteachRequired: boolean,
): TSchema {
  return Type.Composite(
    [
      DurableEvidenceCommonSchema,
      Type.Object(
        {
          hintLevelUsed,
          assistanceLevel: Type.Literal(assistanceLevel),
          evidenceCharacteristic: Type.Literal(evidenceCharacteristic),
          guidedInstructionUsed:
            typeof guidedInstructionUsed === "boolean"
              ? Type.Literal(guidedInstructionUsed)
              : guidedInstructionUsed,
          reteachRequired: Type.Literal(reteachRequired),
        },
        { additionalProperties: false },
      ),
    ],
    { additionalProperties: false },
  );
}

export const DurableTutorEvidenceSchema = Type.Union(
  [
    assistanceVariant(
      "independent",
      "INDEPENDENT",
      Type.Literal("none"),
      false,
      false,
    ),
    assistanceVariant(
      "light-hint",
      "LIGHT_HINT",
      Type.Union([Type.Literal("nudge"), Type.Literal("concept-cue")]),
      false,
      false,
    ),
    assistanceVariant(
      "guided",
      "GUIDED",
      HintLevelSchema,
      true,
      false,
    ),
    assistanceVariant(
      "reteach-required",
      "RETEACH_REQUIRED",
      HintLevelSchema,
      Type.Boolean(),
      true,
    ),
  ],
  { $id: "TutorV2DurableInstructionalEvidence" },
) as TSchema<DurableTutorEvidence>;

export type TutorEvidencePersistenceResult =
  | { readonly status: "accepted"; readonly value: DurableTutorEvidence }
  | {
      readonly status: "rejected";
      readonly code: "TUTOR_EVIDENCE_PRIVACY_REJECTED";
      readonly issues: readonly ExactValidationIssue[];
    };

function rejected(issues: readonly ExactValidationIssue[]): TutorEvidencePersistenceResult {
  return {
    status: "rejected",
    code: "TUTOR_EVIDENCE_PRIVACY_REJECTED",
    issues,
  };
}

export function validateTutorEvidenceForPersistence(
  value: unknown,
): TutorEvidencePersistenceResult {
  const result = validateExact(DurableTutorEvidenceSchema, value);
  return result.status === "accepted"
    ? { status: "accepted", value: result.value }
    : rejected(result.issues);
}

function classifyAssistance(
  input: TutorEvidenceProjectionInput,
): {
  assistanceLevel: "independent" | "light-hint" | "guided" | "reteach-required";
  evidenceCharacteristic: AssistanceEvidenceCharacteristic;
} {
  if (input.reteachRequired) {
    return {
      assistanceLevel: "reteach-required",
      evidenceCharacteristic: "RETEACH_REQUIRED",
    };
  }
  if (input.guidedInstructionUsed || input.hintLevelUsed === "guided-step") {
    return { assistanceLevel: "guided", evidenceCharacteristic: "GUIDED" };
  }
  if (input.hintLevelUsed !== "none") {
    return { assistanceLevel: "light-hint", evidenceCharacteristic: "LIGHT_HINT" };
  }
  return { assistanceLevel: "independent", evidenceCharacteristic: "INDEPENDENT" };
}

export function projectTutorEvidence(value: unknown): TutorEvidencePersistenceResult {
  const inputResult = validateExact(TutorEvidenceProjectionInputSchema, value);
  if (inputResult.status === "rejected") return rejected(inputResult.issues);

  const input = inputResult.value;
  const assistance = classifyAssistance(input);
  return validateTutorEvidenceForPersistence({
    evidenceKind: "tutor-instructional-evidence",
    evidenceRef: input.evidenceRef,
    interactionRef: input.interactionRef,
    observedAt: input.observedAt,
    tutorActionType: input.tutorActionType,
    hintLevelUsed: input.hintLevelUsed,
    assistanceLevel: assistance.assistanceLevel,
    evidenceCharacteristic: assistance.evidenceCharacteristic,
    guidedInstructionUsed:
      input.guidedInstructionUsed || input.hintLevelUsed === "guided-step",
    reteachRequired: input.reteachRequired,
    learnerResponseOutcome: input.learnerResponseOutcome,
    prerequisiteReview: structuredClone(input.prerequisiteReview),
    groundingReferenceIds: [...input.groundingReferenceIds],
    policyOutcome: input.policyOutcome,
    policyReasonCode: input.policyReasonCode,
    providerOutcomeClass: input.providerOutcomeClass,
    fallbackUsed: input.fallbackUsed,
    interventionCount: input.interventionCount,
    currentConceptRef: input.currentConceptRef,
    currentSkillRef: input.currentSkillRef,
  });
}
