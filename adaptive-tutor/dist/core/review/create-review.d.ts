import type { ConfidenceEstimate, MisconceptionClassification, ParentTeacherReview, StableId } from "../contracts/index.js";
export interface ReviewInput {
    skillId: StableId;
    confidence: ConfidenceEstimate;
    misconceptionClassification: MisconceptionClassification;
    diagnosticScores: number[];
    guidedScores: number[];
    independentScores: number[];
    reassessmentScores: number[];
    disputedGrading?: boolean;
    persistentDifficulty?: boolean;
}
export declare function createParentTeacherReview(input: ReviewInput): ParentTeacherReview;
//# sourceMappingURL=create-review.d.ts.map