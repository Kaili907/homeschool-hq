import { Type } from "../schema/typebox.js";
import { ConfidenceEstimateSchema } from "./confidence.js";
import { MisconceptionClassificationSchema } from "./misconception.js";
import { ISODateTimeSchema, StableIdSchema } from "./common.js";
export const ReviewEvidenceSummarySchema = Type.Object({
    source: Type.Union([
        Type.Literal("diagnostic"),
        Type.Literal("guided-practice"),
        Type.Literal("independent-attempt"),
        Type.Literal("reassessment"),
    ]),
    itemCount: Type.Integer({ minimum: 0 }),
    meanScore: Type.Number({ minimum: 0, maximum: 1 }),
    note: Type.String({ minLength: 1, maxLength: 1000 }),
}, { additionalProperties: false });
export const ParentTeacherReviewSchema = Type.Object({
    id: StableIdSchema,
    createdAt: ISODateTimeSchema,
    skillId: StableIdSchema,
    learnerDisplayLabel: Type.String({ minLength: 1, maxLength: 80 }),
    evidence: Type.Array(ReviewEvidenceSummarySchema, { maxItems: 20 }),
    confidence: ConfidenceEstimateSchema,
    misconceptionClassification: MisconceptionClassificationSchema,
    strengths: Type.Array(Type.String({ minLength: 1, maxLength: 600 }), { maxItems: 20 }),
    needsSupport: Type.Array(Type.String({ minLength: 1, maxLength: 600 }), { maxItems: 20 }),
    suggestedNextSteps: Type.Array(Type.String({ minLength: 1, maxLength: 600 }), { maxItems: 20 }),
    disputedGrading: Type.Boolean(),
    persistentDifficulty: Type.Boolean(),
    escalationRecommended: Type.Boolean(),
    uncertaintyStatement: Type.String({ minLength: 1, maxLength: 1200 }),
    diagnosticClaimMade: Type.Literal(false),
    highStakesPlacementDecisionMade: Type.Literal(false),
    identifyingInformationRequested: Type.Literal(false),
}, { additionalProperties: false, $id: "ParentTeacherReview" });
//# sourceMappingURL=review.js.map