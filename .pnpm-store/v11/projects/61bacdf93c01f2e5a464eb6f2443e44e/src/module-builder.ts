import type {
  GradeBand,
  MisconceptionDefinition,
  SkillNode,
  StableId,
  TutorProgram,
  TutorRuntimeHooks,
  VisualBoardCommand,
} from "../../../core/index.js";
import { learnerSafetyLanguage } from "./policies.js";
import {
  multipleChoiceItem,
  narrationFromResponses,
  narrationToWebVtt,
  teachingResponse,
  type ItemSpec,
} from "./helpers.js";
import type {
  DistinguishingProbe,
  EnglishModulePackage,
  ParentTeacherNotes,
  PrerequisiteRemediation,
  VisualExplanationPlan,
} from "./types.js";

interface ModeSpec {
  text: string;
  boardCommands: VisualBoardCommand[];
}

export interface EnglishModuleSpec {
  lessonId: StableId;
  completedModuleName: string;
  category: "reading" | "writing";
  title: string;
  gradeBand: GradeBand;
  targetSkill: SkillNode;
  prerequisiteSkills: SkillNode[];
  misconceptions: MisconceptionDefinition[];
  diagnosticItems: ItemSpec[];
  guidedItems: ItemSpec[];
  independentItems: ItemSpec[];
  reassessmentItems: ItemSpec[];
  showMe: ModeSpec;
  talkMeThroughIt: ModeSpec;
  differentExample: ModeSpec;
  distinguishingProbes: DistinguishingProbe[];
  visualExplanationPlan: VisualExplanationPlan;
  prerequisiteRemediation: PrerequisiteRemediation[];
  parentTeacherNotes: ParentTeacherNotes;
  learnerAuthorshipPrompt: string;
}

const mediaFallback = {
  missingVisualText:
    "Use the visible words, separators, labels, and numbered steps. The English lesson does not depend on an image or video.",
  missingAudioText:
    "Audio is optional. Read the always-visible captions or open the complete transcript, then continue at your own pace.",
  visualAlternativeCommandsAllowed: true as const,
  captionsAlwaysVisible: true as const,
  transcriptAlwaysAvailable: true as const,
  lessonMayContinueWithoutMedia: true as const,
};

export function buildEnglishModule(spec: EnglishModuleSpec): EnglishModulePackage {
  const skillId = spec.targetSkill.id;
  const diagnosticItems = spec.diagnosticItems.map((item) =>
    multipleChoiceItem(skillId, spec.gradeBand, item),
  );
  const guidedItems = spec.guidedItems.map((item) =>
    multipleChoiceItem(skillId, spec.gradeBand, item),
  );
  const independentItems = spec.independentItems.map((item) =>
    multipleChoiceItem(skillId, spec.gradeBand, item),
  );
  const reassessmentItems = spec.reassessmentItems.map((item) =>
    multipleChoiceItem(skillId, spec.gradeBand, item),
  );

  const showMe = teachingResponse({
    id: `${spec.lessonId}-show-me`,
    skillId,
    text: spec.showMe.text,
    boardCommands: spec.showMe.boardCommands,
  });
  const talkMeThroughIt = teachingResponse({
    id: `${spec.lessonId}-talk-through`,
    skillId,
    text: spec.talkMeThroughIt.text,
    boardCommands: spec.talkMeThroughIt.boardCommands,
  });
  const togetherItem = guidedItems[0];
  if (!togetherItem) throw new Error(`${spec.lessonId} requires a guided item.`);
  const letsDoOneTogether = teachingResponse({
    id: `${spec.lessonId}-together`,
    skillId,
    text: `Let’s do one together. ${togetherItem.prompt}`,
    boardCommands: [
      {
        id: `${spec.lessonId}-together-step`,
        kind: "reveal-step",
        stepNumber: 1,
        text: "Try only the first useful step, then choose your answer.",
        durationMs: 250,
        ariaLabel: "Guided step one: try only the first useful step",
      },
    ],
    phase: "guided-practice",
    assessmentItem: togetherItem,
    expectedInput: "answer",
  });
  const differentExample = teachingResponse({
    id: `${spec.lessonId}-different-example`,
    skillId,
    text: spec.differentExample.text,
    boardCommands: spec.differentExample.boardCommands,
  });

  const program: TutorProgram = {
    id: spec.lessonId,
    version: "0.2.0",
    title: spec.title,
    subject: "english",
    gradeBand: spec.gradeBand,
    locale: "en-US",
    targetSkillId: skillId,
    skillGraph: {
      id: `${spec.lessonId}-skill-graph`,
      version: "0.2.0",
      nodes: [...spec.prerequisiteSkills, spec.targetSkill],
      edges: spec.prerequisiteSkills.map((skill) => ({
        prerequisiteSkillId: skill.id,
        dependentSkillId: skillId,
        strength: "required" as const,
        rationale: `${skill.title} supplies a smaller step used in ${spec.title}.`,
      })),
    },
    diagnosticItems,
    misconceptions: spec.misconceptions,
    teachingSequences: [
      ...spec.misconceptions.map((misconception, index) => ({
        misconceptionId: misconception.id,
        turns: index % 2 === 0 ? [showMe, talkMeThroughIt] : [talkMeThroughIt, showMe],
      })),
      { misconceptionId: "default" as const, turns: [showMe, talkMeThroughIt] },
      { misconceptionId: "default" as const, turns: [differentExample] },
    ],
    guidedPractice: {
      id: `${spec.lessonId}-guided-contract`,
      skillId,
      items: guidedItems,
      hintLadder: [
        {
          level: 1,
          prompt: "Use only the first step shown on the board, then pause and decide what you notice.",
          revealsAnswer: false,
          visualSupportCommandIds: spec.visualExplanationPlan.boardCommandIds.slice(0, 2),
        },
        {
          level: 2,
          prompt: "Compare the two most likely choices and explain which one follows the taught strategy.",
          revealsAnswer: false,
          visualSupportCommandIds: spec.visualExplanationPlan.boardCommandIds.slice(0, 4),
        },
      ],
      maxSupportedAttemptsPerItem: 3,
      askLearnerToExplain: true,
      alternateExplanationAllowed: true,
      feedbackPolicy: "immediate",
    },
    independentMastery: {
      id: `${spec.lessonId}-independent-contract`,
      skillId,
      items: independentItems,
      minimumEvidenceCount: 4,
      minimumDistinctContexts: 3,
      minimumMeanScore: 0.8,
      maximumUncertainty: 0.4,
      reassessmentRequired: true,
      singleAnswerCanEstablishMastery: false,
      supportsTeacherOverride: true,
      placementDecisionAllowed: false,
    },
    reassessmentItems,
    mediaFallback,
    persistentDifficultyCycleLimit: 2,
  };

  const allModeResponses = [showMe, talkMeThroughIt, letsDoOneTogether, differentExample];
  const narration = narrationFromResponses(`${spec.lessonId}-narration`, allModeResponses);
  const allSpecs = [
    ...spec.diagnosticItems,
    ...spec.guidedItems,
    ...spec.independentItems,
    ...spec.reassessmentItems,
  ];
  const choiceEvidence = new Map<StableId, StableId[]>();
  for (const item of allSpecs) {
    for (const choice of item.choices) {
      choiceEvidence.set(choice.id, choice.evidenceTags ?? []);
    }
  }

  const runtimeHooks: Partial<TutorRuntimeHooks> = {
    evidenceTagsFor: (item, input, evaluation) => {
      const selected = input.selectedOptionIds?.[0];
      const selectedTags = selected ? choiceEvidence.get(selected) ?? [] : [];
      return [
        item.id,
        evaluation.score === 1 ? "english-strategy-applied" : "english-strategy-needs-check",
        ...selectedTags,
      ];
    },
    feedbackFor: (_item, _input, evaluation) =>
      evaluation.score === 1
        ? "That choice follows the strategy. Explain the clue you used so we can gather another piece of evidence."
        : learnerSafetyLanguage.retry,
  };

  return {
    lessonId: spec.lessonId,
    completedModuleName: spec.completedModuleName,
    category: spec.category,
    coreProgram: program,
    coreV02Extension: {
      adapterId: `${spec.lessonId}-core-v02-adapter`,
      adapterVersion: "0.2.0",
      coreContractVersion: "0.2.0",
      lessonId: spec.lessonId,
      modeResponses: {
        "show-me": showMe,
        "talk-me-through-it": talkMeThroughIt,
        "lets-do-one-together": letsDoOneTogether,
        "different-example": differentExample,
      },
      distinguishingProbes: spec.distinguishingProbes,
      visualExplanationPlan: spec.visualExplanationPlan,
      narration,
      webVtt: narrationToWebVtt(narration),
      prerequisiteRemediation: spec.prerequisiteRemediation,
      parentTeacherNotes: spec.parentTeacherNotes,
      answerReasoning: allSpecs.map((item) => ({
        itemId: item.id,
        reasoning: item.reasoning,
        revealPolicy: "after-learner-attempt" as const,
        preservesLearnerAuthorship: true as const,
      })),
      learnerAuthorshipPrompt: spec.learnerAuthorshipPrompt,
      gradedAssignmentBoundary: learnerSafetyLanguage.gradedWork,
    },
    runtimeHooks,
  };
}
