import type {
  AssessmentItem,
  GradeBand,
  StableId,
  TutorResponse,
  VisualBoardCommand,
} from "../core/index.js";

export const demoGradeBand: GradeBand = { min: 4, max: 6, label: "Grades 4–6" };

interface MultipleChoiceArgs {
  id: StableId;
  skillId: StableId;
  purpose: "diagnostic" | "guided-practice" | "independent-mastery" | "reassessment";
  subject: "math" | "english";
  prompt: string;
  options: Array<{ id: StableId; text: string }>;
  correctOptionId: StableId;
  tags?: StableId[];
}

export function multipleChoice(args: MultipleChoiceArgs): AssessmentItem {
  return {
    id: args.id,
    skillId: args.skillId,
    purpose: args.purpose,
    subject: args.subject,
    gradeBand: demoGradeBand,
    locale: "en-US",
    prompt: args.prompt,
    maxAttempts: args.purpose === "guided-practice" ? 3 : 1,
    estimatedSeconds: 45,
    tags: args.tags ?? [],
    noCameraRequired: true,
    identifyingInformationRequested: false,
    kind: "multiple-choice",
    options: args.options,
    correctOptionIds: [args.correctOptionId],
    allowMultiple: false,
    shuffle: false,
  };
}

interface ShortAnswerArgs {
  id: StableId;
  skillId: StableId;
  purpose: "diagnostic" | "guided-practice" | "independent-mastery" | "reassessment";
  subject: "math" | "english";
  prompt: string;
  acceptedAnswers: string[];
  tags?: StableId[];
}

export function shortAnswer(args: ShortAnswerArgs): AssessmentItem {
  return {
    id: args.id,
    skillId: args.skillId,
    purpose: args.purpose,
    subject: args.subject,
    gradeBand: demoGradeBand,
    locale: "en-US",
    prompt: args.prompt,
    maxAttempts: args.purpose === "guided-practice" ? 3 : 1,
    estimatedSeconds: 75,
    tags: args.tags ?? [],
    noCameraRequired: true,
    identifyingInformationRequested: false,
    kind: "short-answer",
    acceptedAnswers: args.acceptedAnswers,
    caseSensitive: false,
    trimWhitespace: true,
    normalization: "basic-text",
  };
}

export function teachingTurn(args: {
  id: StableId;
  skillId: StableId;
  text: string;
  boardCommands: VisualBoardCommand[];
  asksLearnerToParticipate?: boolean;
}): TutorResponse {
  return {
    id: args.id,
    phase: "teach-visually",
    skillId: args.skillId,
    learnerMessage: args.text,
    spokenTurn: {
      id: `${args.id}-spoken` as StableId,
      text: args.text,
      locale: "en-US",
      pace: "normal",
      emphasisTokens: [],
      canInterrupt: true,
      requireLearnerResponse: args.asksLearnerToParticipate ?? true,
      fallbackText: args.text,
      captionsRequired: true,
      transcriptRequired: true,
      claimsHumanIdentity: false,
    },
    boardCommands: args.boardCommands,
    assessmentItem: null,
    expectedInput: "continue",
    oneUsefulStepOnly: true,
    givesFinalGradedAnswer: false,
    asksLearnerToParticipate: args.asksLearnerToParticipate ?? true,
    uncertaintyStatement: "This explanation is a teaching choice based on limited response evidence, not a diagnosis.",
    confidence: null,
    alternateExplanationAvailable: true,
    escalationReason: null,
    jarvisClaimsHumanIdentity: false,
  };
}

export function boardBase(id: StableId, title: string): VisualBoardCommand[] {
  return [
    { id: `${id}-clear` as StableId, kind: "clear-board", durationMs: 0, ariaLabel: "Clear teaching board" },
    { id: `${id}-title` as StableId, kind: "set-title", text: title, durationMs: 0, ariaLabel: `Teaching board title: ${title}` },
  ];
}
