import { type Static } from "../schema/typebox.js";
export declare const ReviewEvidenceSummarySchema: import("../schema/typebox.js").TSchema<{
    source: "diagnostic" | "guided-practice" | "independent-attempt" | "reassessment";
    itemCount: number;
    meanScore: number;
    note: string;
} & {}>;
export declare const ParentTeacherReviewSchema: import("../schema/typebox.js").TSchema<{
    id: string;
    identifyingInformationRequested: false;
    skillId: string;
    uncertaintyStatement: string;
    confidence: {
        skillId: string;
        band: "very-low" | "low" | "developing" | "strong" | "insufficient-evidence";
        placementDecisionAllowed: false;
        value: number;
        uncertainty: number;
        lowerBound: number;
        upperBound: number;
        evidenceCount: number;
        effectiveEvidence: number;
        distinctContextCount: number;
        explanation: string;
    } & {};
    evidence: ({
        source: "diagnostic" | "guided-practice" | "independent-attempt" | "reassessment";
        itemCount: number;
        meanScore: number;
        note: string;
    } & {})[];
    strengths: string[];
    needsSupport: string[];
    suggestedNextSteps: string[];
    diagnosticClaimMade: false;
    highStakesPlacementDecisionMade: false;
    createdAt: string;
    learnerDisplayLabel: string;
    misconceptionClassification: {
        skillId: string;
        hypotheses: ({
            uncertainty: number;
            evidenceCount: number;
            supportingTags: string[];
            contradictingTags: string[];
            status: "insufficient-evidence" | "possible" | "probable" | "unlikely";
            misconceptionId: string;
            probability: number;
        } & {})[];
        selectedMisconceptionId: string | null;
        doNotDiagnose: true;
        uncertaintyStatement: string;
    } & {};
    disputedGrading: boolean;
    persistentDifficulty: boolean;
    escalationRecommended: boolean;
} & {}>;
export type ParentTeacherReview = Static<typeof ParentTeacherReviewSchema>;
//# sourceMappingURL=review.d.ts.map