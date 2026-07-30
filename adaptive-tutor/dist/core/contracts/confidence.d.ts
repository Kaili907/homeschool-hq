import { type Static } from "../schema/typebox.js";
export declare const ConfidenceObservationSchema: import("../schema/typebox.js").TSchema<{
    evidenceTags: string[];
    score: number;
    id: string;
    skillId: string;
    source: "diagnostic" | "guided-practice" | "independent-attempt" | "reassessment" | "teacher-observation";
    weight: number;
    independence: number;
    contextId: string;
} & {}>;
export declare const ConfidenceEstimateSchema: import("../schema/typebox.js").TSchema<{
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
} & {}>;
export type ConfidenceObservation = Static<typeof ConfidenceObservationSchema>;
export type ConfidenceEstimate = Static<typeof ConfidenceEstimateSchema>;
//# sourceMappingURL=confidence.d.ts.map