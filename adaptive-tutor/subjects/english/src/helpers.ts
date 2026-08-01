import type {
  AssessmentItem,
  GradeBand,
  NarrationTrack,
  StableId,
  TutorResponse,
  VisualBoardCommand,
} from "../../../core/index.js";
import { learnerSafetyLanguage } from "./policies.js";

export interface ChoiceSpec {
  id: StableId;
  text: string;
  correct?: boolean;
  evidenceTags?: StableId[];
}

export interface ItemSpec {
  id: StableId;
  purpose: "diagnostic" | "guided-practice" | "independent-mastery" | "reassessment";
  prompt: string;
  choices: ChoiceSpec[];
  reasoning: string;
}

export function multipleChoiceItem(
  skillId: StableId,
  gradeBand: GradeBand,
  spec: ItemSpec,
): AssessmentItem {
  const options = spec.choices.map(({ id, text }) => ({ id, text }));
  return {
    id: spec.id,
    skillId,
    purpose: spec.purpose,
    subject: "english",
    gradeBand,
    locale: "en-US",
    prompt: spec.prompt,
    directions: "Choose the response that best shows the strategy. You may ask for another explanation during teaching.",
    maxAttempts: spec.purpose === "guided-practice" ? 3 : 1,
    estimatedSeconds: 60,
    tags: ["english", spec.purpose],
    noCameraRequired: true,
    identifyingInformationRequested: false,
    kind: "multiple-choice",
    options,
    correctOptionIds: spec.choices.filter((choice) => choice.correct).map((choice) => choice.id),
    allowMultiple: false,
    shuffle: false,
  };
}

export function boardBase(prefix: StableId, title: string): VisualBoardCommand[] {
  return [
    {
      id: `${prefix}-clear`,
      kind: "clear-board",
      durationMs: 0,
      ariaLabel: "Clear the English teaching board",
    },
    {
      id: `${prefix}-title`,
      kind: "set-title",
      text: title,
      durationMs: 0,
      ariaLabel: `Teaching board title: ${title}`,
    },
  ];
}

export function teachingResponse(args: {
  id: StableId;
  skillId: StableId;
  text: string;
  boardCommands: VisualBoardCommand[];
  phase?: "teach-visually" | "guided-practice";
  assessmentItem?: AssessmentItem | null;
  expectedInput?: "continue" | "answer";
}): TutorResponse {
  const phase = args.phase ?? "teach-visually";
  const expectedInput = args.expectedInput ?? "continue";
  return {
    id: args.id,
    phase,
    skillId: args.skillId,
    learnerMessage: args.text,
    spokenTurn: {
      id: `${args.id}-spoken`,
      text: args.text,
      locale: "en-US",
      pace: "slow",
      emphasisTokens: [],
      canInterrupt: true,
      requireLearnerResponse: expectedInput === "answer",
      fallbackText: args.text,
      captionsRequired: true,
      transcriptRequired: true,
      claimsHumanIdentity: false,
    },
    boardCommands: args.boardCommands,
    assessmentItem: args.assessmentItem ?? null,
    expectedInput,
    oneUsefulStepOnly: true,
    givesFinalGradedAnswer: false,
    asksLearnerToParticipate: true,
    uncertaintyStatement: learnerSafetyLanguage.uncertainty,
    confidence: null,
    alternateExplanationAvailable: true,
    escalationReason: null,
    jarvisClaimsHumanIdentity: false,
  };
}

export function narrationFromResponses(
  id: StableId,
  responses: TutorResponse[],
): NarrationTrack {
  let cursor = 0;
  const captions = responses.map((response, index) => {
    const startMs = cursor;
    const duration = Math.max(2500, Math.min(12000, response.spokenTurn.text.length * 55));
    cursor += duration;
    return {
      id: `${id}-caption-${index + 1}`,
      startMs,
      endMs: cursor,
      text: response.spokenTurn.text,
      speaker: "jarvis" as const,
    };
  });
  return {
    id,
    locale: "en-US",
    text: responses.map((response) => response.spokenTurn.text).join(" "),
    audioUri: null,
    captions,
    transcript: responses.map((response, index) => ({
      id: `${id}-transcript-${index + 1}`,
      speaker: "jarvis" as const,
      text: response.spokenTurn.text,
      visibleToLearner: true,
      containsIdentifyingInformation: false,
    })),
    voiceRequired: false,
    mediaRequired: false,
  };
}

function cueTime(milliseconds: number): string {
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":") + `.${String(millis).padStart(3, "0")}`;
}

export function narrationToWebVtt(narration: NarrationTrack): string {
  return `WEBVTT\n\n${narration.captions
    .map((cue) => `${cue.id}\n${cueTime(cue.startMs)} --> ${cueTime(cue.endMs)}\n${cue.text}`)
    .join("\n\n")}\n`;
}
