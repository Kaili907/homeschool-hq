import { TutorProgramSchema } from "../contracts/index.js";
import { assertValid } from "../utils/validation.js";
import { evaluateAssessmentItem } from "./assessment-evaluator.js";
import { estimateConfidence } from "./confidence-model.js";
import { classifyMisconceptions } from "./misconception-classifier.js";
import { evaluateSafety } from "../safety/guard.js";
import { createParentTeacherReview } from "../review/create-review.js";
import { validateSkillGraph } from "./skill-graph.js";
const defaultHooks = {
    evidenceTagsFor: (item, _input, evaluation) => [
        `${item.id}-${evaluation.outcome}`,
        `${item.skillId}-${evaluation.outcome}`,
    ],
    feedbackFor: (_item, _input, evaluation) => evaluation.feedback,
};
function nowId(prefix, count) {
    return `${prefix}-${String(count).padStart(3, "0")}`;
}
function spoken(id, text, requireLearnerResponse) {
    return {
        id: `${id}-spoken`,
        text,
        locale: "en-US",
        pace: "normal",
        emphasisTokens: [],
        canInterrupt: true,
        requireLearnerResponse,
        fallbackText: text,
        captionsRequired: true,
        transcriptRequired: true,
        claimsHumanIdentity: false,
    };
}
function baseResponse(args) {
    return {
        id: args.id,
        phase: args.phase,
        skillId: args.skillId,
        learnerMessage: args.learnerMessage,
        spokenTurn: spoken(args.id, args.learnerMessage, args.expectedInput === "answer"),
        boardCommands: args.boardCommands ?? [],
        assessmentItem: args.assessmentItem ?? null,
        expectedInput: args.expectedInput,
        oneUsefulStepOnly: true,
        givesFinalGradedAnswer: false,
        asksLearnerToParticipate: args.asksLearnerToParticipate,
        uncertaintyStatement: args.uncertaintyStatement,
        confidence: args.confidence ?? null,
        alternateExplanationAvailable: args.alternateExplanationAvailable ?? false,
        escalationReason: args.escalationReason ?? null,
        jarvisClaimsHumanIdentity: false,
    };
}
function sourceForPhase(phase) {
    if (phase === "assessment")
        return "diagnostic";
    if (phase === "guided-practice")
        return "guided-practice";
    if (phase === "independent-attempt")
        return "independent-attempt";
    return "reassessment";
}
function weightForPhase(phase) {
    if (phase === "guided-practice")
        return 0.45;
    if (phase === "assessment")
        return 0.65;
    if (phase === "independent-attempt")
        return 1;
    return 1;
}
export class AdaptiveTutorEngine {
    program;
    hooks;
    phase = "assessment";
    cycleCount = 0;
    currentItemIndex = 0;
    teachingTurnIndex = 0;
    selectedMisconceptionId = null;
    observations = [];
    misconceptionEvidence = [];
    responseCount = 0;
    attemptsByItem = new Map();
    transcript = [];
    scores = {
        diagnostic: [],
        guided: [],
        independent: [],
        reassessment: [],
    };
    constructor(program, hooks = {}) {
        this.program = assertValid(TutorProgramSchema, program, "Tutor program");
        const graphResult = validateSkillGraph(this.program.skillGraph);
        if (!graphResult.valid) {
            throw new Error(`Invalid prerequisite graph:\n${graphResult.errors.join("\n")}`);
        }
        this.hooks = { ...defaultHooks, ...hooks };
    }
    start() {
        this.phase = "assessment";
        this.currentItemIndex = 0;
        return this.presentCurrentItem("assessment", "Let’s begin with one quick check. Your answer helps me choose what to teach; it does not label you.");
    }
    submit(input) {
        const safety = evaluateSafety(input.raw);
        if (safety.triggers.length > 0) {
            const message = safety.triggers.map((trigger) => trigger.learnerSafeMessage).join(" ");
            this.transcript.push({ speaker: "learner", text: safety.redactedInput });
            this.transcript.push({ speaker: "jarvis", text: message });
            if (safety.mustStopAcademicFlow)
                this.phase = "escalated";
            return baseResponse({
                id: nowId("safety-response", ++this.responseCount),
                phase: safety.mustStopAcademicFlow ? "escalated" : this.phase,
                skillId: this.program.targetSkillId,
                learnerMessage: message,
                expectedInput: safety.mustStopAcademicFlow ? "adult-review" : "answer",
                asksLearnerToParticipate: !safety.mustStopAcademicFlow,
                uncertaintyStatement: "Safety routing is based on a text pattern and may need adult review.",
                escalationReason: safety.mustEscalateToAdult ? safety.triggers[0]?.category ?? "adult-review" : null,
            });
        }
        if (!["assessment", "guided-practice", "independent-attempt", "reassess"].includes(this.phase)) {
            throw new Error(`Cannot submit an answer during phase ${this.phase}.`);
        }
        const item = this.currentItem();
        const evaluationBase = evaluateAssessmentItem(item, input);
        const evaluation = {
            outcome: evaluationBase.isCorrect ? "correct" : "incorrect",
            score: evaluationBase.score,
            feedback: evaluationBase.isCorrect
                ? "That response matches the item’s success criteria."
                : "That response gives us useful information about the next teaching step.",
            matchedConceptIds: [item.skillId],
            evidenceTags: [],
        };
        const tags = this.hooks.evidenceTagsFor(item, input, evaluation);
        evaluation.evidenceTags = tags;
        const attempt = (this.attemptsByItem.get(item.id) ?? 0) + 1;
        this.attemptsByItem.set(item.id, attempt);
        this.recordEvidence(item, input, evaluation, tags);
        this.transcript.push({ speaker: "learner", text: safety.redactedInput || input.selectedOptionIds?.join(", ") || "[response]" });
        if (this.phase === "assessment")
            return this.afterDiagnostic(evaluation);
        if (this.phase === "guided-practice")
            return this.afterGuided(item, input, evaluation, attempt);
        if (this.phase === "independent-attempt")
            return this.afterIndependent(evaluation);
        return this.afterReassessment(evaluation);
    }
    continue() {
        if (this.phase === "identify-missing-concept" || this.phase === "reteach") {
            this.phase = "teach-visually";
            this.teachingTurnIndex = 0;
            return this.currentTeachingTurn();
        }
        if (this.phase === "teach-visually") {
            const sequence = this.selectedTeachingSequence();
            if (this.teachingTurnIndex + 1 < sequence.turns.length) {
                this.teachingTurnIndex += 1;
                return this.currentTeachingTurn();
            }
            this.phase = "guided-practice";
            this.currentItemIndex = 0;
            return this.presentCurrentItem("guided-practice", "Now let’s do one together. You can use a hint, and mistakes are part of the practice.");
        }
        if (this.phase === "advance") {
            return baseResponse({
                id: nowId("transfer-response", ++this.responseCount),
                phase: "advance",
                skillId: this.program.targetSkillId,
                learnerMessage: "The evidence is strong enough to move to a new example, but a parent or teacher can still review the summary.",
                expectedInput: "adult-review",
                asksLearnerToParticipate: false,
                uncertaintyStatement: estimateConfidence(this.program.targetSkillId, this.observations).explanation,
                confidence: estimateConfidence(this.program.targetSkillId, this.observations),
            });
        }
        throw new Error(`Cannot continue during phase ${this.phase}.`);
    }
    requestAlternateExplanation() {
        const sequences = this.program.teachingSequences.filter((sequence) => sequence.misconceptionId === this.selectedMisconceptionId || sequence.misconceptionId === "default");
        const sequence = sequences[1] ?? sequences[0] ?? this.program.teachingSequences[0];
        if (!sequence)
            throw new Error("No teaching sequence is available.");
        const turn = sequence.turns[0];
        if (!turn)
            throw new Error("Alternate teaching sequence is empty.");
        this.phase = "teach-visually";
        this.teachingTurnIndex = 0;
        this.transcript.push({ speaker: "jarvis", text: turn.learnerMessage });
        return { ...turn, alternateExplanationAvailable: sequences.length > 1 };
    }
    getSnapshot() {
        return {
            programId: this.program.id,
            phase: this.phase,
            cycleCount: this.cycleCount,
            currentItemId: this.safeCurrentItem()?.id ?? null,
            currentItemIndex: this.currentItemIndex,
            teachingTurnIndex: this.teachingTurnIndex,
            selectedMisconceptionId: this.selectedMisconceptionId,
            observations: structuredClone(this.observations),
            misconceptionEvidence: structuredClone(this.misconceptionEvidence),
            responseCount: this.responseCount,
            transcript: structuredClone(this.transcript),
        };
    }
    getReview() {
        const confidence = estimateConfidence(this.program.targetSkillId, this.observations);
        const classification = this.classification();
        return createParentTeacherReview({
            skillId: this.program.targetSkillId,
            confidence,
            misconceptionClassification: classification,
            diagnosticScores: this.scores.diagnostic,
            guidedScores: this.scores.guided,
            independentScores: this.scores.independent,
            reassessmentScores: this.scores.reassessment,
            persistentDifficulty: this.cycleCount >= this.program.persistentDifficultyCycleLimit,
        });
    }
    recordEvidence(item, _input, evaluation, tags) {
        const source = sourceForPhase(this.phase);
        const observation = {
            id: `evidence-${String(this.observations.length + 1).padStart(3, "0")}`,
            skillId: item.skillId,
            source,
            score: evaluation.score,
            weight: weightForPhase(this.phase),
            independence: this.phase === "guided-practice" ? 0.45 : 1,
            contextId: item.id,
            evidenceTags: tags,
        };
        this.observations.push(observation);
        this.misconceptionEvidence.push({ tags });
        if (source === "diagnostic")
            this.scores.diagnostic.push(evaluation.score);
        else if (source === "guided-practice")
            this.scores.guided.push(evaluation.score);
        else if (source === "independent-attempt")
            this.scores.independent.push(evaluation.score);
        else
            this.scores.reassessment.push(evaluation.score);
    }
    afterDiagnostic(evaluation) {
        if (this.currentItemIndex + 1 < this.program.diagnosticItems.length) {
            this.currentItemIndex += 1;
            return this.presentCurrentItem("assessment", evaluation.score === 1
                ? "That is one useful piece of evidence. Here is the next check."
                : "Thanks for trying. That response helps narrow the concept; here is one more check.");
        }
        const classification = this.classification();
        this.selectedMisconceptionId = classification.selectedMisconceptionId;
        this.phase = "identify-missing-concept";
        const definition = this.program.misconceptions.find((item) => item.id === this.selectedMisconceptionId);
        const message = definition
            ? `I may have found the missing idea: ${definition.learnerSafeDescription} We will test that idea, not treat it as a label.`
            : "I do not have enough evidence to name one exact misconception, so I’ll use a neutral visual explanation and keep checking.";
        return baseResponse({
            id: nowId("identify-response", ++this.responseCount),
            phase: this.phase,
            skillId: this.program.targetSkillId,
            learnerMessage: message,
            expectedInput: "continue",
            asksLearnerToParticipate: true,
            uncertaintyStatement: classification.uncertaintyStatement,
            alternateExplanationAvailable: true,
            boardCommands: [
                {
                    id: nowId("identify-title", this.responseCount),
                    kind: "set-title",
                    text: "What we will learn next",
                    durationMs: 0,
                    ariaLabel: "Teaching board title: What we will learn next",
                },
                {
                    id: nowId("identify-text", this.responseCount),
                    kind: "add-text",
                    text: message,
                    region: "center",
                    emphasis: "normal",
                    durationMs: 250,
                    ariaLabel: message,
                },
            ],
        });
    }
    afterGuided(item, input, evaluation, attempt) {
        if (evaluation.score < 1 && attempt < this.program.guidedPractice.maxSupportedAttemptsPerItem) {
            const hint = this.program.guidedPractice.hintLadder[Math.min(attempt - 1, this.program.guidedPractice.hintLadder.length - 1)];
            const feedback = this.hooks.feedbackFor(item, input, evaluation, attempt);
            const message = `${feedback} ${hint?.prompt ?? "Try the smallest next step."}`;
            return baseResponse({
                id: nowId("guided-hint", ++this.responseCount),
                phase: "guided-practice",
                skillId: this.program.targetSkillId,
                learnerMessage: message,
                assessmentItem: item,
                expectedInput: "answer",
                asksLearnerToParticipate: true,
                uncertaintyStatement: "A guided response is lower-weight evidence because help is available.",
                alternateExplanationAvailable: true,
                boardCommands: hint
                    ? [{
                            id: nowId("guided-step", this.responseCount),
                            kind: "reveal-step",
                            stepNumber: hint.level,
                            text: hint.prompt,
                            durationMs: 250,
                            ariaLabel: `Hint ${hint.level}: ${hint.prompt}`,
                        }]
                    : [],
            });
        }
        if (this.currentItemIndex + 1 < this.program.guidedPractice.items.length) {
            this.currentItemIndex += 1;
            return this.presentCurrentItem("guided-practice", evaluation.score === 1
                ? "You used the idea correctly with support. Let’s try another guided example."
                : "We finished that supported example. Let’s try a different one and look for the same idea.");
        }
        this.phase = "independent-attempt";
        this.currentItemIndex = 0;
        return this.presentCurrentItem("independent-attempt", "Now try independently. I will not give hints during these items, and one answer will not be treated as mastery.");
    }
    afterIndependent(evaluation) {
        if (this.currentItemIndex + 1 < this.program.independentMastery.items.length) {
            this.currentItemIndex += 1;
            return this.presentCurrentItem("independent-attempt", evaluation.score === 1
                ? "Recorded. Here is a different independent example."
                : "Recorded. I will not label the mistake; here is a different independent example.");
        }
        this.phase = "reassess";
        this.currentItemIndex = 0;
        return this.presentCurrentItem("reassess", "Let’s reassess with a fresh item. This checks whether the idea transfers after teaching.");
    }
    afterReassessment(_evaluation) {
        if (this.currentItemIndex + 1 < this.program.reassessmentItems.length) {
            this.currentItemIndex += 1;
            return this.presentCurrentItem("reassess", "Here is one more fresh check in a different context.");
        }
        const confidence = estimateConfidence(this.program.targetSkillId, this.observations);
        const contract = this.program.independentMastery;
        const independentAndReassessmentCount = this.scores.independent.length + this.scores.reassessment.length;
        const independentAndReassessmentMean = independentAndReassessmentCount === 0
            ? 0
            : [...this.scores.independent, ...this.scores.reassessment].reduce((sum, score) => sum + score, 0) / independentAndReassessmentCount;
        const advance = independentAndReassessmentCount >= contract.minimumEvidenceCount &&
            confidence.distinctContextCount >= contract.minimumDistinctContexts &&
            independentAndReassessmentMean >= contract.minimumMeanScore &&
            confidence.uncertainty <= contract.maximumUncertainty;
        if (advance) {
            this.phase = "advance";
            return baseResponse({
                id: nowId("advance-response", ++this.responseCount),
                phase: "advance",
                skillId: this.program.targetSkillId,
                learnerMessage: "You applied the skill across several items and contexts. The evidence supports advancing, with the uncertainty shown for adult review.",
                expectedInput: "adult-review",
                asksLearnerToParticipate: false,
                uncertaintyStatement: confidence.explanation,
                confidence,
                boardCommands: [{
                        id: nowId("advance-board", this.responseCount),
                        kind: "add-text",
                        text: `Evidence band: ${confidence.band}. This is not a placement decision.`,
                        region: "center",
                        emphasis: "strong",
                        durationMs: 250,
                        ariaLabel: `Evidence band ${confidence.band}. This is not a placement decision.`,
                    }],
            });
        }
        this.cycleCount += 1;
        if (this.cycleCount >= this.program.persistentDifficultyCycleLimit) {
            this.phase = "escalated";
            return baseResponse({
                id: nowId("persistent-escalation", ++this.responseCount),
                phase: "escalated",
                skillId: this.program.targetSkillId,
                learnerMessage: "This concept is still difficult after repeated teaching cycles. That does not mean you are incapable. A parent or teacher should review the evidence and choose the next support.",
                expectedInput: "adult-review",
                asksLearnerToParticipate: false,
                uncertaintyStatement: confidence.explanation,
                confidence,
                escalationReason: "persistent-difficulty",
            });
        }
        this.phase = "reteach";
        return baseResponse({
            id: nowId("reteach-response", ++this.responseCount),
            phase: "reteach",
            skillId: this.program.targetSkillId,
            learnerMessage: "The evidence is not strong enough to advance yet. We will use a different explanation, then try new examples.",
            expectedInput: "continue",
            asksLearnerToParticipate: true,
            uncertaintyStatement: confidence.explanation,
            confidence,
            alternateExplanationAvailable: true,
        });
    }
    presentCurrentItem(phase, introduction) {
        this.phase = phase;
        const item = this.currentItem();
        const message = `${introduction} ${item.prompt}`;
        const response = baseResponse({
            id: nowId(`${phase}-response`, ++this.responseCount),
            phase,
            skillId: item.skillId,
            learnerMessage: message,
            assessmentItem: item,
            expectedInput: "answer",
            asksLearnerToParticipate: true,
            uncertaintyStatement: "The tutor is collecting evidence and has not made a mastery claim.",
            alternateExplanationAvailable: phase !== "independent-attempt" && phase !== "reassess",
            boardCommands: [
                {
                    id: nowId(`${phase}-title`, this.responseCount),
                    kind: "set-title",
                    text: phase.replace(/-/g, " "),
                    durationMs: 0,
                    ariaLabel: `Teaching board phase: ${phase.replace(/-/g, " ")}`,
                },
                {
                    id: nowId(`${phase}-prompt`, this.responseCount),
                    kind: "add-text",
                    text: item.prompt,
                    region: "center",
                    emphasis: "strong",
                    durationMs: 200,
                    ariaLabel: item.prompt,
                },
            ],
        });
        this.transcript.push({ speaker: "jarvis", text: message });
        return response;
    }
    currentTeachingTurn() {
        const sequence = this.selectedTeachingSequence();
        const turn = sequence.turns[this.teachingTurnIndex];
        if (!turn)
            throw new Error("Teaching turn index is out of range.");
        const response = {
            ...turn,
            alternateExplanationAvailable: this.program.teachingSequences.length > 1,
        };
        this.transcript.push({ speaker: "jarvis", text: response.learnerMessage });
        return response;
    }
    selectedTeachingSequence() {
        const selected = this.program.teachingSequences.find((sequence) => sequence.misconceptionId === this.selectedMisconceptionId) ??
            this.program.teachingSequences.find((sequence) => sequence.misconceptionId === "default") ??
            this.program.teachingSequences[0];
        if (!selected)
            throw new Error("No teaching sequence is available.");
        return selected;
    }
    classification() {
        return classifyMisconceptions(this.program.targetSkillId, this.program.misconceptions, this.misconceptionEvidence);
    }
    currentItem() {
        const item = this.safeCurrentItem();
        if (!item)
            throw new Error(`No item is available for phase ${this.phase}.`);
        return item;
    }
    safeCurrentItem() {
        if (this.phase === "assessment")
            return this.program.diagnosticItems[this.currentItemIndex];
        if (this.phase === "guided-practice")
            return this.program.guidedPractice.items[this.currentItemIndex];
        if (this.phase === "independent-attempt")
            return this.program.independentMastery.items[this.currentItemIndex];
        if (this.phase === "reassess")
            return this.program.reassessmentItems[this.currentItemIndex];
        return undefined;
    }
}
//# sourceMappingURL=adaptive-tutor-engine.js.map