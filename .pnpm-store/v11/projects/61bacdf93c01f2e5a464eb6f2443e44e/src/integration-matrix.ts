export type IntegrationClassification =
  | "PASS_DIRECT_CORE_V0_2"
  | "PASS_PROVISIONAL_ADAPTER"
  | "BLOCKED_CORE_CHANGE"
  | "NOT_TESTED";

export interface IntegrationArea {
  area: string;
  classification: IntegrationClassification;
  mapping: string;
}

export const integrationMatrix: IntegrationArea[] = [
  { area: "Stable lesson IDs", classification: "PASS_DIRECT_CORE_V0_2", mapping: "TutorProgram.id" },
  { area: "Stable skill IDs", classification: "PASS_DIRECT_CORE_V0_2", mapping: "TutorProgram.targetSkillId and skillGraph" },
  { area: "Grade-band metadata", classification: "PASS_DIRECT_CORE_V0_2", mapping: "TutorProgram.gradeBand and item gradeBand" },
  { area: "Prerequisites", classification: "PASS_DIRECT_CORE_V0_2", mapping: "PrerequisiteSkillGraphSchema" },
  { area: "Diagnostic assessment", classification: "PASS_DIRECT_CORE_V0_2", mapping: "TutorProgram.diagnosticItems" },
  { area: "Misconception evidence", classification: "PASS_DIRECT_CORE_V0_2", mapping: "MisconceptionDefinitionSchema.distinguishingEvidence" },
  { area: "Distinguishing probes", classification: "PASS_PROVISIONAL_ADAPTER", mapping: "English extension links diagnostic item IDs to Core evidence tags" },
  { area: "Visual explanation plan", classification: "PASS_DIRECT_CORE_V0_2", mapping: "TutorResponse.boardCommands validated by VisualBoardCommandSchema" },
  { area: "Spoken explanation", classification: "PASS_DIRECT_CORE_V0_2", mapping: "TutorResponse.spokenTurn" },
  { area: "Narration", classification: "PASS_DIRECT_CORE_V0_2", mapping: "NarrationTrackSchema" },
  { area: "Transcript", classification: "PASS_DIRECT_CORE_V0_2", mapping: "NarrationTrackSchema.transcript" },
  { area: "WebVTT captions", classification: "PASS_PROVISIONAL_ADAPTER", mapping: "Serialized from Core CaptionCue records by the English extension" },
  { area: "Show Me mode", classification: "PASS_PROVISIONAL_ADAPTER", mapping: "English mode label points to a Core TutorResponse" },
  { area: "Talk Me Through It mode", classification: "PASS_PROVISIONAL_ADAPTER", mapping: "English mode label points to a Core TutorResponse and SpokenTurn" },
  { area: "Let's Do One Together mode", classification: "PASS_PROVISIONAL_ADAPTER", mapping: "English mode label points to Core GuidedPractice and TutorResponse contracts" },
  { area: "Different Example mode", classification: "PASS_PROVISIONAL_ADAPTER", mapping: "English mode label points to an alternate Core teaching sequence" },
  { area: "Guided practice", classification: "PASS_DIRECT_CORE_V0_2", mapping: "GuidedPracticeContractSchema" },
  { area: "Independent mastery checks", classification: "PASS_DIRECT_CORE_V0_2", mapping: "IndependentMasteryContractSchema" },
  { area: "Reteaching branches", classification: "PASS_DIRECT_CORE_V0_2", mapping: "TutorProgram.teachingSequences keyed by misconception" },
  { area: "Prerequisite remediation", classification: "PASS_PROVISIONAL_ADAPTER", mapping: "English extension routes evidence back to Core skillGraph prerequisite IDs" },
  { area: "Parent/teacher notes", classification: "PASS_PROVISIONAL_ADAPTER", mapping: "English extension adds subject-specific observation guidance" },
  { area: "No-media fallback", classification: "PASS_DIRECT_CORE_V0_2", mapping: "MediaFallbackSchema plus text-only board commands" },
  { area: "Answer reasoning", classification: "PASS_PROVISIONAL_ADAPTER", mapping: "English extension links delayed reasoning to Core assessment item IDs" },
  { area: "TutorProgramSchema", classification: "PASS_DIRECT_CORE_V0_2", mapping: "Validated for all four programs" },
  { area: "AssessmentItemSchema", classification: "PASS_DIRECT_CORE_V0_2", mapping: "Validated for every diagnostic, guided, independent, and reassessment item" },
  { area: "TutorResponseSchema", classification: "PASS_DIRECT_CORE_V0_2", mapping: "Validated for every mode and teaching turn" },
  { area: "SpokenTurnSchema", classification: "PASS_DIRECT_CORE_V0_2", mapping: "Validated for every tutor response" },
  { area: "VisualBoardCommandSchema", classification: "PASS_DIRECT_CORE_V0_2", mapping: "Validated for every board command" },
  { area: "GuidedPracticeContractSchema", classification: "PASS_DIRECT_CORE_V0_2", mapping: "Validated once per module" },
  { area: "IndependentMasteryContractSchema", classification: "PASS_DIRECT_CORE_V0_2", mapping: "Validated once per module" },
  { area: "MediaFallbackSchema", classification: "PASS_DIRECT_CORE_V0_2", mapping: "Validated once per module" },
  { area: "Browser reading intervention", classification: "PASS_DIRECT_CORE_V0_2", mapping: "Demo consumes the decoding TutorProgram, TutorResponses, items, board commands, and narration" },
  { area: "Browser writing intervention", classification: "PASS_PROVISIONAL_ADAPTER", mapping: "Demo consumes the paragraph TutorProgram plus the English learner-authorship adapter" },
];

export const coreChangeRequests: string[] = [];
