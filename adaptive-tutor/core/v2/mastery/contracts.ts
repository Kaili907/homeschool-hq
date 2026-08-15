import { Type, type Static, type TSchema } from "../../schema/typebox.js";
import {
  AssistanceLevelSchema,
  ISODateTimeSchema,
  OpaqueReferenceSchema,
  PolicyCodeSchema,
} from "../contracts/index.js";

export const MasteryEvidenceRecommendationSchema = Type.Union([
  Type.Literal("insufficient-evidence"),
  Type.Literal("emerging-evidence"),
  Type.Literal("supported-evidence"),
  Type.Literal("conflicting-evidence"),
]);
export type MasteryEvidenceRecommendation = Static<
  typeof MasteryEvidenceRecommendationSchema
>;

export const StudyOutcomeCodeSchema = Type.Union([
  Type.Literal("demonstrated"),
  Type.Literal("not-demonstrated"),
  Type.Literal("inconclusive"),
]);
export type StudyOutcomeCode = Static<typeof StudyOutcomeCodeSchema>;

const StudyMasteryEvidenceItemRuntimeSchema = Type.Object(
  {
    evidenceRef: OpaqueReferenceSchema,
    issuer: Type.Literal("study"),
    learnerScopeRef: OpaqueReferenceSchema,
    conceptRef: OpaqueReferenceSchema,
    sessionRef: OpaqueReferenceSchema,
    instructionalContextRef: OpaqueReferenceSchema,
    opportunityRef: OpaqueReferenceSchema,
    outcome: StudyOutcomeCodeSchema,
    assistanceLevel: AssistanceLevelSchema,
    recency: Type.Union([Type.Literal("current"), Type.Literal("stale")]),
    spacing: Type.Union([Type.Literal("same-session"), Type.Literal("spaced")]),
    observedAt: ISODateTimeSchema,
  },
  { additionalProperties: false, $id: "TutorV2StudyMasteryEvidenceItem" },
);
export type StudyMasteryEvidenceItem = Static<
  typeof StudyMasteryEvidenceItemRuntimeSchema
>;

type CompositionCompatibleStudyMasteryEvidenceItem = Omit<
  StudyMasteryEvidenceItem,
  "sessionRef" | "instructionalContextRef" | "opportunityRef"
> &
  Partial<
    Pick<
      StudyMasteryEvidenceItem,
      "sessionRef" | "instructionalContextRef" | "opportunityRef"
    >
  >;

/**
 * Runtime-required provenance with a temporary optional static projection.
 * W2-09R2 must populate these fields in the adaptive composition before the
 * compatibility projection can be removed. Exact runtime validation already
 * rejects every item that omits them.
 */
export const StudyMasteryEvidenceItemSchema =
  StudyMasteryEvidenceItemRuntimeSchema as TSchema<
    CompositionCompatibleStudyMasteryEvidenceItem
  >;

const StudyMasteryEvidenceInputRuntimeSchema = Type.Object(
  {
    envelope: Type.Literal("study-issued-mastery-evidence"),
    learnerScopeRef: OpaqueReferenceSchema,
    conceptRef: OpaqueReferenceSchema,
    currentSessionRef: OpaqueReferenceSchema,
    currentInstructionalContextRef: OpaqueReferenceSchema,
    currentOpportunityRef: OpaqueReferenceSchema,
    currentOpportunityAssistanceLevel: AssistanceLevelSchema,
    evaluatedAt: ISODateTimeSchema,
    evidence: Type.Array(StudyMasteryEvidenceItemRuntimeSchema, { maxItems: 100 }),
  },
  { additionalProperties: false, $id: "TutorV2StudyMasteryEvidenceInput" },
);
export type StudyMasteryEvidenceInput = Static<
  typeof StudyMasteryEvidenceInputRuntimeSchema
>;

type CompositionCompatibleStudyMasteryEvidenceInput = Omit<
  StudyMasteryEvidenceInput,
  | "currentSessionRef"
  | "currentInstructionalContextRef"
  | "currentOpportunityRef"
  | "currentOpportunityAssistanceLevel"
  | "evidence"
> &
  Partial<
    Pick<
      StudyMasteryEvidenceInput,
      | "currentSessionRef"
      | "currentInstructionalContextRef"
      | "currentOpportunityRef"
      | "currentOpportunityAssistanceLevel"
    >
  > & {
    evidence: CompositionCompatibleStudyMasteryEvidenceItem[];
  };

/**
 * The runtime schema is deliberately stricter than this temporary static
 * composition projection. See StudyMasteryEvidenceItemSchema above.
 */
export const StudyMasteryEvidenceInputSchema =
  StudyMasteryEvidenceInputRuntimeSchema as TSchema<
    CompositionCompatibleStudyMasteryEvidenceInput
  >;

export const MasteryAssistanceProfileSchema = Type.Object(
  {
    independent: Type.Integer({ minimum: 0, maximum: 100 }),
    lightHint: Type.Integer({ minimum: 0, maximum: 100 }),
    guided: Type.Integer({ minimum: 0, maximum: 100 }),
    reteachRequired: Type.Integer({ minimum: 0, maximum: 100 }),
  },
  { additionalProperties: false },
);
export type MasteryAssistanceProfile = Static<typeof MasteryAssistanceProfileSchema>;

const AuthorityBoundarySchema = Type.Object(
  {
    studyDecisionRequired: Type.Literal(true),
    studyMutationAllowed: Type.Literal(false),
    authoritative: Type.Literal(false),
  },
  { additionalProperties: false },
);

export const MasteryEvidenceSummarySchema = Type.Composite(
  [
    AuthorityBoundarySchema,
    Type.Object(
      {
        envelope: Type.Literal("tutor-mastery-evidence-summary"),
        evaluationStatus: Type.Literal("summarized"),
        recommendation: MasteryEvidenceRecommendationSchema,
        learnerScopeRef: OpaqueReferenceSchema,
        conceptRef: OpaqueReferenceSchema,
        evaluatedAt: ISODateTimeSchema,
        sampleCount: Type.Integer({ minimum: 0, maximum: 100 }),
        demonstratedCount: Type.Integer({ minimum: 0, maximum: 100 }),
        notDemonstratedCount: Type.Integer({ minimum: 0, maximum: 100 }),
        inconclusiveCount: Type.Integer({ minimum: 0, maximum: 100 }),
        independentDemonstratedCount: Type.Integer({ minimum: 0, maximum: 100 }),
        currentEvidenceCount: Type.Integer({ minimum: 0, maximum: 100 }),
        staleEvidenceCount: Type.Integer({ minimum: 0, maximum: 100 }),
        spacedEvidenceCount: Type.Integer({ minimum: 0, maximum: 100 }),
        duplicateReplayCount: Type.Integer({ minimum: 0, maximum: 100 }),
        conflictingReplayCount: Type.Integer({ minimum: 0, maximum: 100 }),
        assistanceProfile: MasteryAssistanceProfileSchema,
        reasonCodes: Type.Array(PolicyCodeSchema, { maxItems: 16 }),
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false, $id: "TutorV2MasteryEvidenceSummary" },
);
export type MasteryEvidenceSummary = Static<typeof MasteryEvidenceSummarySchema>;

export const RejectedMasteryEvidenceSummarySchema = Type.Composite(
  [
    AuthorityBoundarySchema,
    Type.Object(
      {
        envelope: Type.Literal("tutor-mastery-evidence-summary"),
        evaluationStatus: Type.Literal("rejected"),
        recommendation: Type.Literal("insufficient-evidence"),
        reasonCodes: Type.Array(PolicyCodeSchema, { minItems: 1, maxItems: 8 }),
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false, $id: "TutorV2RejectedMasteryEvidenceSummary" },
);
export type RejectedMasteryEvidenceSummary = Static<
  typeof RejectedMasteryEvidenceSummarySchema
>;

export const MasteryEvidenceEvaluationSchema = Type.Union([
  MasteryEvidenceSummarySchema,
  RejectedMasteryEvidenceSummarySchema,
]);
export type MasteryEvidenceEvaluation = Static<typeof MasteryEvidenceEvaluationSchema>;
