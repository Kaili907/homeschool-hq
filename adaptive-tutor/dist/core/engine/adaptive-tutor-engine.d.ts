import type { AssessmentItem, ConfidenceObservation, EvaluationResult, LearnerInput, ParentTeacherReview, StableId, TutorPhase, TutorProgram, TutorResponse } from "../contracts/index.js";
import { type ClassificationEvidence } from "./misconception-classifier.js";
export interface TutorRuntimeHooks {
    evidenceTagsFor: (item: AssessmentItem, input: LearnerInput, evaluation: EvaluationResult) => StableId[];
    feedbackFor: (item: AssessmentItem, input: LearnerInput, evaluation: EvaluationResult, attempt: number) => string;
}
export interface TutorEngineSnapshot {
    programId: StableId;
    phase: TutorPhase;
    cycleCount: number;
    currentItemId: StableId | null;
    currentItemIndex: number;
    teachingTurnIndex: number;
    selectedMisconceptionId: StableId | null;
    observations: ConfidenceObservation[];
    misconceptionEvidence: ClassificationEvidence[];
    responseCount: number;
    transcript: Array<{
        speaker: "jarvis" | "learner" | "system";
        text: string;
    }>;
}
export declare class AdaptiveTutorEngine {
    readonly program: TutorProgram;
    private readonly hooks;
    private phase;
    private cycleCount;
    private currentItemIndex;
    private teachingTurnIndex;
    private selectedMisconceptionId;
    private observations;
    private misconceptionEvidence;
    private responseCount;
    private attemptsByItem;
    private transcript;
    private scores;
    constructor(program: TutorProgram, hooks?: Partial<TutorRuntimeHooks>);
    start(): TutorResponse;
    submit(input: LearnerInput): TutorResponse;
    continue(): TutorResponse;
    requestAlternateExplanation(): TutorResponse;
    getSnapshot(): TutorEngineSnapshot;
    getReview(): ParentTeacherReview;
    private recordEvidence;
    private afterDiagnostic;
    private afterGuided;
    private afterIndependent;
    private afterReassessment;
    private presentCurrentItem;
    private currentTeachingTurn;
    private selectedTeachingSequence;
    private classification;
    private currentItem;
    private safeCurrentItem;
}
//# sourceMappingURL=adaptive-tutor-engine.d.ts.map