import { Type, type Static } from "../schema/typebox.js";
import { AssessmentItemSchema } from "./assessment.js";
import { StableIdSchema } from "./common.js";

export const HintLevelSchema = Type.Object(
  {
    level: Type.Integer({ minimum: 1, maximum: 5 }),
    prompt: Type.String({ minLength: 1, maxLength: 1200 }),
    revealsAnswer: Type.Boolean(),
    visualSupportCommandIds: Type.Array(StableIdSchema, { maxItems: 20 }),
  },
  { additionalProperties: false },
);

export const GuidedPracticeContractSchema = Type.Object(
  {
    id: StableIdSchema,
    skillId: StableIdSchema,
    items: Type.Array(AssessmentItemSchema, { minItems: 1, maxItems: 30 }),
    hintLadder: Type.Array(HintLevelSchema, { minItems: 1, maxItems: 5 }),
    maxSupportedAttemptsPerItem: Type.Integer({ minimum: 1, maximum: 10 }),
    askLearnerToExplain: Type.Boolean(),
    alternateExplanationAllowed: Type.Literal(true),
    feedbackPolicy: Type.Union([
      Type.Literal("immediate"),
      Type.Literal("after-second-attempt"),
    ]),
  },
  { additionalProperties: false, $id: "GuidedPractice" },
);

export const IndependentMasteryContractSchema = Type.Object(
  {
    id: StableIdSchema,
    skillId: StableIdSchema,
    items: Type.Array(AssessmentItemSchema, { minItems: 3, maxItems: 50 }),
    minimumEvidenceCount: Type.Integer({ minimum: 3, maximum: 50 }),
    minimumDistinctContexts: Type.Integer({ minimum: 2, maximum: 20 }),
    minimumMeanScore: Type.Number({ minimum: 0.5, maximum: 1 }),
    maximumUncertainty: Type.Number({ minimum: 0, maximum: 0.8 }),
    reassessmentRequired: Type.Literal(true),
    singleAnswerCanEstablishMastery: Type.Literal(false),
    supportsTeacherOverride: Type.Literal(true),
    placementDecisionAllowed: Type.Literal(false),
  },
  { additionalProperties: false, $id: "IndependentMastery" },
);

export type HintLevel = Static<typeof HintLevelSchema>;
export type GuidedPracticeContract = Static<typeof GuidedPracticeContractSchema>;
export type IndependentMasteryContract = Static<typeof IndependentMasteryContractSchema>;
