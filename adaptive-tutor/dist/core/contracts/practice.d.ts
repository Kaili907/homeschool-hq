import { type Static } from "../schema/typebox.js";
export declare const HintLevelSchema: import("../schema/typebox.js").TSchema<{
    prompt: string;
    visualSupportCommandIds: string[];
    level: number;
    revealsAnswer: boolean;
} & {}>;
export declare const GuidedPracticeContractSchema: import("../schema/typebox.js").TSchema<{
    items: (({
        id: string;
        tags: string[];
        noCameraRequired: true;
        identifyingInformationRequested: false;
        skillId: string;
        purpose: "diagnostic" | "guided-practice" | "reassessment" | "independent-mastery";
        subject: "math" | "english" | "science" | "social-studies" | "general";
        gradeBand: {
            min: number;
            max: number;
            label: string;
        } & {};
        locale: string;
        prompt: string;
        maxAttempts: number;
        estimatedSeconds: number;
    } & {
        directions?: string;
    } & {
        kind: "multiple-choice";
        options: ({
            id: string;
            text: string;
        } & {
            accessibleLabel?: string;
        })[];
        correctOptionIds: string[];
        allowMultiple: boolean;
        shuffle: boolean;
    } & {}) | ({
        id: string;
        tags: string[];
        noCameraRequired: true;
        identifyingInformationRequested: false;
        skillId: string;
        purpose: "diagnostic" | "guided-practice" | "reassessment" | "independent-mastery";
        subject: "math" | "english" | "science" | "social-studies" | "general";
        gradeBand: {
            min: number;
            max: number;
            label: string;
        } & {};
        locale: string;
        prompt: string;
        maxAttempts: number;
        estimatedSeconds: number;
    } & {
        directions?: string;
    } & {
        kind: "short-answer";
        acceptedAnswers: string[];
        normalization: "none" | "basic-text" | "numeric";
        caseSensitive: boolean;
        trimWhitespace: boolean;
    } & {}) | ({
        id: string;
        tags: string[];
        noCameraRequired: true;
        identifyingInformationRequested: false;
        skillId: string;
        purpose: "diagnostic" | "guided-practice" | "reassessment" | "independent-mastery";
        subject: "math" | "english" | "science" | "social-studies" | "general";
        gradeBand: {
            min: number;
            max: number;
            label: string;
        } & {};
        locale: string;
        prompt: string;
        maxAttempts: number;
        estimatedSeconds: number;
    } & {
        directions?: string;
    } & {
        kind: "sequencing";
        options: ({
            id: string;
            text: string;
        } & {
            accessibleLabel?: string;
        })[];
        correctOrder: string[];
    } & {}))[];
    id: string;
    skillId: string;
    hintLadder: ({
        prompt: string;
        visualSupportCommandIds: string[];
        level: number;
        revealsAnswer: boolean;
    } & {})[];
    alternateExplanationAllowed: true;
    feedbackPolicy: "immediate" | "after-second-attempt";
    maxSupportedAttemptsPerItem: number;
    askLearnerToExplain: boolean;
} & {}>;
export declare const IndependentMasteryContractSchema: import("../schema/typebox.js").TSchema<{
    items: (({
        id: string;
        tags: string[];
        noCameraRequired: true;
        identifyingInformationRequested: false;
        skillId: string;
        purpose: "diagnostic" | "guided-practice" | "reassessment" | "independent-mastery";
        subject: "math" | "english" | "science" | "social-studies" | "general";
        gradeBand: {
            min: number;
            max: number;
            label: string;
        } & {};
        locale: string;
        prompt: string;
        maxAttempts: number;
        estimatedSeconds: number;
    } & {
        directions?: string;
    } & {
        kind: "multiple-choice";
        options: ({
            id: string;
            text: string;
        } & {
            accessibleLabel?: string;
        })[];
        correctOptionIds: string[];
        allowMultiple: boolean;
        shuffle: boolean;
    } & {}) | ({
        id: string;
        tags: string[];
        noCameraRequired: true;
        identifyingInformationRequested: false;
        skillId: string;
        purpose: "diagnostic" | "guided-practice" | "reassessment" | "independent-mastery";
        subject: "math" | "english" | "science" | "social-studies" | "general";
        gradeBand: {
            min: number;
            max: number;
            label: string;
        } & {};
        locale: string;
        prompt: string;
        maxAttempts: number;
        estimatedSeconds: number;
    } & {
        directions?: string;
    } & {
        kind: "short-answer";
        acceptedAnswers: string[];
        normalization: "none" | "basic-text" | "numeric";
        caseSensitive: boolean;
        trimWhitespace: boolean;
    } & {}) | ({
        id: string;
        tags: string[];
        noCameraRequired: true;
        identifyingInformationRequested: false;
        skillId: string;
        purpose: "diagnostic" | "guided-practice" | "reassessment" | "independent-mastery";
        subject: "math" | "english" | "science" | "social-studies" | "general";
        gradeBand: {
            min: number;
            max: number;
            label: string;
        } & {};
        locale: string;
        prompt: string;
        maxAttempts: number;
        estimatedSeconds: number;
    } & {
        directions?: string;
    } & {
        kind: "sequencing";
        options: ({
            id: string;
            text: string;
        } & {
            accessibleLabel?: string;
        })[];
        correctOrder: string[];
    } & {}))[];
    id: string;
    skillId: string;
    placementDecisionAllowed: false;
    minimumEvidenceCount: number;
    reassessmentRequired: true;
    singleAnswerCanEstablishMastery: false;
    supportsTeacherOverride: true;
    minimumDistinctContexts: number;
    minimumMeanScore: number;
    maximumUncertainty: number;
} & {}>;
export type HintLevel = Static<typeof HintLevelSchema>;
export type GuidedPracticeContract = Static<typeof GuidedPracticeContractSchema>;
export type IndependentMasteryContract = Static<typeof IndependentMasteryContractSchema>;
//# sourceMappingURL=practice.d.ts.map