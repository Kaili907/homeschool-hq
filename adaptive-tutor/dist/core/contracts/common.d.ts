import { type Static } from "../schema/typebox.js";
export declare const StableIdSchema: import("../schema/typebox.js").TSchema<string>;
export type StableId = Static<typeof StableIdSchema>;
export declare const ISODateTimeSchema: import("../schema/typebox.js").TSchema<string>;
export declare const GradeBandSchema: import("../schema/typebox.js").TSchema<{
    min: number;
    max: number;
    label: string;
} & {}>;
export type GradeBand = Static<typeof GradeBandSchema>;
export declare const SubjectSchema: import("../schema/typebox.js").TSchema<"math" | "english" | "science" | "social-studies" | "general">;
export type Subject = Static<typeof SubjectSchema>;
export declare const LocaleSchema: import("../schema/typebox.js").TSchema<string>;
export declare const EvidenceSourceSchema: import("../schema/typebox.js").TSchema<"diagnostic" | "guided-practice" | "independent-attempt" | "reassessment" | "teacher-observation">;
export type EvidenceSource = Static<typeof EvidenceSourceSchema>;
export declare const ResponseOutcomeSchema: import("../schema/typebox.js").TSchema<"correct" | "partial" | "incorrect" | "unscored">;
export type ResponseOutcome = Static<typeof ResponseOutcomeSchema>;
export declare const LearnerInputSchema: import("../schema/typebox.js").TSchema<{
    raw: string;
} & {
    selectedOptionIds?: string[];
    orderedOptionIds?: string[];
}>;
export type LearnerInput = Static<typeof LearnerInputSchema>;
export declare const EvaluationResultSchema: import("../schema/typebox.js").TSchema<{
    matchedConceptIds: string[];
    evidenceTags: string[];
    outcome: "correct" | "partial" | "incorrect" | "unscored";
    score: number;
    feedback: string;
} & {}>;
export type EvaluationResult = Static<typeof EvaluationResultSchema>;
//# sourceMappingURL=common.d.ts.map