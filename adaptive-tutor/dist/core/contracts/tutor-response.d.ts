import { type Static } from "../schema/typebox.js";
export declare const TutorPhaseSchema: import("../schema/typebox.js").TSchema<"guided-practice" | "independent-attempt" | "assessment" | "identify-missing-concept" | "teach-visually" | "reassess" | "advance" | "reteach" | "escalated">;
export type TutorPhase = Static<typeof TutorPhaseSchema>;
export declare const TutorResponseSchema: import("../schema/typebox.js").TSchema<{
    id: string;
    skillId: string;
    uncertaintyStatement: string;
    boardCommands: (({
        id: string;
        durationMs: number;
        ariaLabel: string;
    } & {} & {
        kind: "clear-board";
    } & {}) | ({
        id: string;
        durationMs: number;
        ariaLabel: string;
    } & {} & {
        text: string;
        kind: "set-title";
    } & {}) | ({
        id: string;
        durationMs: number;
        ariaLabel: string;
    } & {} & {
        text: string;
        kind: "add-text";
        region: "top" | "center" | "bottom" | "side";
        emphasis: "strong" | "normal" | "muted";
    } & {}) | ({
        id: string;
        durationMs: number;
        ariaLabel: string;
    } & {} & {
        label: string;
        kind: "draw-fraction";
        representation: "bar" | "circle" | "set";
        numerator: number;
        denominator: number;
    } & {}) | ({
        id: string;
        durationMs: number;
        ariaLabel: string;
    } & {} & {
        min: number;
        max: number;
        kind: "draw-number-line";
        highlightedValues: number[];
        step: number;
    } & {}) | ({
        id: string;
        durationMs: number;
        ariaLabel: string;
    } & {} & {
        subject: string;
        kind: "show-sentence-parts";
        sentence: string;
        predicate: string;
    } & {
        dependentMarker?: string;
    }) | ({
        id: string;
        durationMs: number;
        ariaLabel: string;
    } & {} & {
        kind: "highlight";
        targetCommandId: string;
        token: string;
        reason: string;
    } & {}) | ({
        id: string;
        durationMs: number;
        ariaLabel: string;
    } & {} & {
        text: string;
        kind: "reveal-step";
        stepNumber: number;
    } & {}) | ({
        id: string;
        durationMs: number;
        ariaLabel: string;
    } & {} & {
        kind: "compare";
        relationship: "equal" | "not-equal" | "part-whole" | "complete-incomplete";
        leftLabel: string;
        rightLabel: string;
    } & {}) | ({
        id: string;
        durationMs: number;
        ariaLabel: string;
    } & {} & {
        text: string;
        kind: "aria-announce";
        priority: "polite" | "assertive";
    } & {}))[];
    assessmentItem: ({
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
    } & {}) | null;
    expectedInput: "none" | "continue" | "answer" | "adult-review";
    oneUsefulStepOnly: true;
    givesFinalGradedAnswer: false;
    confidence: ({
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
    } & {}) | null;
    escalationReason: string | null;
    jarvisClaimsHumanIdentity: false;
    phase: "guided-practice" | "independent-attempt" | "assessment" | "identify-missing-concept" | "teach-visually" | "reassess" | "advance" | "reteach" | "escalated";
    learnerMessage: string;
    spokenTurn: {
        id: string;
        text: string;
        locale: string;
        pace: "slow" | "normal" | "brisk";
        emphasisTokens: string[];
        captionsRequired: true;
        transcriptRequired: true;
        claimsHumanIdentity: false;
        canInterrupt: boolean;
        requireLearnerResponse: boolean;
        fallbackText: string;
    } & {};
    asksLearnerToParticipate: boolean;
    alternateExplanationAvailable: boolean;
} & {}>;
export type TutorResponse = Static<typeof TutorResponseSchema>;
//# sourceMappingURL=tutor-response.d.ts.map