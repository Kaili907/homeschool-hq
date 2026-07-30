import { type Static } from "../schema/typebox.js";
export declare const EvidenceSignalSchema: import("../schema/typebox.js").TSchema<{
    weight: number;
    explanation: string;
    direction: "supports" | "contradicts" | "neutral";
    tag: string;
} & {}>;
export declare const MisconceptionDefinitionSchema: import("../schema/typebox.js").TSchema<{
    label: string;
    id: string;
    skillId: string;
    distinguishingEvidence: ({
        weight: number;
        explanation: string;
        direction: "supports" | "contradicts" | "neutral";
        tag: string;
    } & {})[];
    alternateExplanations: string[];
    learnerSafeDescription: string;
    minimumEvidenceCount: number;
    escalationAfterRepeatedCycles: number;
} & {}>;
export declare const MisconceptionHypothesisSchema: import("../schema/typebox.js").TSchema<{
    uncertainty: number;
    evidenceCount: number;
    supportingTags: string[];
    contradictingTags: string[];
    status: "insufficient-evidence" | "possible" | "probable" | "unlikely";
    misconceptionId: string;
    probability: number;
} & {}>;
export declare const MisconceptionClassificationSchema: import("../schema/typebox.js").TSchema<{
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
} & {}>;
export type EvidenceSignal = Static<typeof EvidenceSignalSchema>;
export type MisconceptionDefinition = Static<typeof MisconceptionDefinitionSchema>;
export type MisconceptionHypothesis = Static<typeof MisconceptionHypothesisSchema>;
export type MisconceptionClassification = Static<typeof MisconceptionClassificationSchema>;
//# sourceMappingURL=misconception.d.ts.map