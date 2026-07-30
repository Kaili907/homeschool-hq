import type { AssessmentItem, GradeBand, StableId, TutorResponse, VisualBoardCommand } from "../core/index.js";
export declare const demoGradeBand: GradeBand;
interface MultipleChoiceArgs {
    id: StableId;
    skillId: StableId;
    purpose: "diagnostic" | "guided-practice" | "independent-mastery" | "reassessment";
    subject: "math" | "english";
    prompt: string;
    options: Array<{
        id: StableId;
        text: string;
    }>;
    correctOptionId: StableId;
    tags?: StableId[];
}
export declare function multipleChoice(args: MultipleChoiceArgs): AssessmentItem;
interface ShortAnswerArgs {
    id: StableId;
    skillId: StableId;
    purpose: "diagnostic" | "guided-practice" | "independent-mastery" | "reassessment";
    subject: "math" | "english";
    prompt: string;
    acceptedAnswers: string[];
    tags?: StableId[];
}
export declare function shortAnswer(args: ShortAnswerArgs): AssessmentItem;
export declare function teachingTurn(args: {
    id: StableId;
    skillId: StableId;
    text: string;
    boardCommands: VisualBoardCommand[];
    asksLearnerToParticipate?: boolean;
}): TutorResponse;
export declare function boardBase(id: StableId, title: string): VisualBoardCommand[];
export {};
//# sourceMappingURL=builders.d.ts.map