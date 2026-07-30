import { type Static } from "../schema/typebox.js";
import { LearnerInputSchema } from "./common.js";
export declare const AssessmentPurposeSchema: import("../schema/typebox.js").TSchema<"diagnostic" | "guided-practice" | "reassessment" | "independent-mastery">;
export declare const AssessmentOptionSchema: import("../schema/typebox.js").TSchema<{
    id: string;
    text: string;
} & {
    accessibleLabel?: string;
}>;
export declare const MultipleChoiceItemSchema: import("../schema/typebox.js").TSchema<{
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
} & {}>;
export declare const ShortAnswerItemSchema: import("../schema/typebox.js").TSchema<{
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
} & {}>;
export declare const SequencingItemSchema: import("../schema/typebox.js").TSchema<{
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
} & {}>;
export declare const AssessmentItemSchema: import("../schema/typebox.js").TSchema<({
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
} & {})>;
export type AssessmentItem = Static<typeof AssessmentItemSchema>;
export type MultipleChoiceItem = Static<typeof MultipleChoiceItemSchema>;
export type ShortAnswerItem = Static<typeof ShortAnswerItemSchema>;
export type SequencingItem = Static<typeof SequencingItemSchema>;
export type AssessmentEvaluator = (item: AssessmentItem, input: Static<typeof LearnerInputSchema>) => {
    score: number;
    isCorrect: boolean;
    normalizedAnswer: string;
};
//# sourceMappingURL=assessment.d.ts.map