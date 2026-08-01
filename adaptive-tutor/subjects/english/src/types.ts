import type {
  NarrationTrack,
  StableId,
  TutorProgram,
  TutorResponse,
  TutorRuntimeHooks,
} from "../../../core/index.js";

export type EnglishTutorMode =
  | "show-me"
  | "talk-me-through-it"
  | "lets-do-one-together"
  | "different-example";

export interface AnswerReasoning {
  itemId: StableId;
  reasoning: string;
  revealPolicy: "after-learner-attempt";
  preservesLearnerAuthorship: true;
}

export interface DistinguishingProbe {
  misconceptionId: StableId;
  assessmentItemIds: StableId[];
  evidenceTags: StableId[];
  interpretation: string;
}

export interface PrerequisiteRemediation {
  prerequisiteSkillId: StableId;
  trigger: string;
  learnerPrompt: string;
  completionEvidence: string[];
  returnsToTargetSkill: true;
}

export interface ParentTeacherNotes {
  lookFor: string[];
  supportiveLanguage: string[];
  avoid: string[];
  masteryReminder: string;
}

export interface VisualExplanationPlan {
  purpose: string;
  boardCommandIds: StableId[];
  revealOrder: string[];
  noVisualFallback: string;
}

export interface EnglishCoreV02Extension {
  adapterId: StableId;
  adapterVersion: "0.2.0";
  coreContractVersion: "0.2.0";
  lessonId: StableId;
  modeResponses: Record<EnglishTutorMode, TutorResponse>;
  distinguishingProbes: DistinguishingProbe[];
  visualExplanationPlan: VisualExplanationPlan;
  narration: NarrationTrack;
  webVtt: string;
  prerequisiteRemediation: PrerequisiteRemediation[];
  parentTeacherNotes: ParentTeacherNotes;
  answerReasoning: AnswerReasoning[];
  learnerAuthorshipPrompt: string;
  gradedAssignmentBoundary: string;
}

export interface EnglishModulePackage {
  lessonId: StableId;
  completedModuleName: string;
  category: "reading" | "writing";
  coreProgram: TutorProgram;
  coreV02Extension: EnglishCoreV02Extension;
  runtimeHooks: Partial<TutorRuntimeHooks>;
}
