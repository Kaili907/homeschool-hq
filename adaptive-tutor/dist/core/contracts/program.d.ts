import { type Static } from "../schema/typebox.js";
export declare const TeachingSequenceSchema: import("../schema/typebox.js").TSchema<{
    misconceptionId: string;
    turns: ({
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
    } & {})[];
} & {}>;
export declare const TutorProgramSchema: import("../schema/typebox.js").TSchema<{
    id: string;
    subject: "math" | "english" | "science" | "social-studies" | "general";
    gradeBand: {
        min: number;
        max: number;
        label: string;
    } & {};
    locale: string;
    title: string;
    version: string;
    diagnosticItems: (({
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
    misconceptions: ({
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
    } & {})[];
    teachingSequences: ({
        misconceptionId: string;
        turns: ({
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
        } & {})[];
    } & {})[];
    reassessmentItems: (({
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
    targetSkillId: string;
    skillGraph: {
        id: string;
        nodes: ({
            description: string;
            id: string;
            subject: "math" | "english" | "science" | "social-studies" | "general";
            gradeBand: {
                min: number;
                max: number;
                label: string;
            } & {};
            observableEvidence: string[];
            title: string;
        } & {})[];
        edges: ({
            strength: "required" | "recommended" | "supporting";
            prerequisiteSkillId: string;
            dependentSkillId: string;
            rationale: string;
        } & {})[];
        version: string;
    } & {};
    guidedPractice: {
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
    } & {};
    independentMastery: {
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
    } & {};
    mediaFallback: {
        visualAlternativeCommandsAllowed: true;
        captionsAlwaysVisible: true;
        transcriptAlwaysAvailable: true;
        lessonMayContinueWithoutMedia: true;
        missingVisualText: string;
        missingAudioText: string;
    } & {};
    persistentDifficultyCycleLimit: number;
} & {}>;
export type TeachingSequence = Static<typeof TeachingSequenceSchema>;
export type TutorProgram = Static<typeof TutorProgramSchema>;
//# sourceMappingURL=program.d.ts.map