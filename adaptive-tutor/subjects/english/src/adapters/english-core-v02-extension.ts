import {
  NarrationTrackSchema,
  StableIdSchema,
  TutorResponseSchema,
} from "../../../../core/index.js";
import { Type, type Static } from "../../../../core/schema/typebox.js";

const DistinguishingProbeSchema = Type.Object(
  {
    misconceptionId: StableIdSchema,
    assessmentItemIds: Type.Array(StableIdSchema, { minItems: 1, maxItems: 20 }),
    evidenceTags: Type.Array(StableIdSchema, { minItems: 1, maxItems: 20 }),
    interpretation: Type.String({ minLength: 1, maxLength: 1000 }),
  },
  { additionalProperties: false },
);

const VisualExplanationPlanSchema = Type.Object(
  {
    purpose: Type.String({ minLength: 1, maxLength: 1200 }),
    boardCommandIds: Type.Array(StableIdSchema, { minItems: 1, maxItems: 80 }),
    revealOrder: Type.Array(Type.String({ minLength: 1, maxLength: 500 }), {
      minItems: 1,
      maxItems: 20,
    }),
    noVisualFallback: Type.String({ minLength: 1, maxLength: 1600 }),
  },
  { additionalProperties: false },
);

const PrerequisiteRemediationSchema = Type.Object(
  {
    prerequisiteSkillId: StableIdSchema,
    trigger: Type.String({ minLength: 1, maxLength: 1000 }),
    learnerPrompt: Type.String({ minLength: 1, maxLength: 1600 }),
    completionEvidence: Type.Array(Type.String({ minLength: 1, maxLength: 600 }), {
      minItems: 1,
      maxItems: 20,
    }),
    returnsToTargetSkill: Type.Literal(true),
  },
  { additionalProperties: false },
);

const ParentTeacherNotesSchema = Type.Object(
  {
    lookFor: Type.Array(Type.String({ minLength: 1, maxLength: 600 }), { minItems: 1 }),
    supportiveLanguage: Type.Array(Type.String({ minLength: 1, maxLength: 600 }), {
      minItems: 1,
    }),
    avoid: Type.Array(Type.String({ minLength: 1, maxLength: 600 }), { minItems: 1 }),
    masteryReminder: Type.String({ minLength: 1, maxLength: 1000 }),
  },
  { additionalProperties: false },
);

const AnswerReasoningSchema = Type.Object(
  {
    itemId: StableIdSchema,
    reasoning: Type.String({ minLength: 1, maxLength: 1600 }),
    revealPolicy: Type.Literal("after-learner-attempt"),
    preservesLearnerAuthorship: Type.Literal(true),
  },
  { additionalProperties: false },
);

export const EnglishCoreV02ExtensionSchema = Type.Object(
  {
    adapterId: StableIdSchema,
    adapterVersion: Type.Literal("0.2.0"),
    coreContractVersion: Type.Literal("0.2.0"),
    lessonId: StableIdSchema,
    modeResponses: Type.Object(
      {
        "show-me": TutorResponseSchema,
        "talk-me-through-it": TutorResponseSchema,
        "lets-do-one-together": TutorResponseSchema,
        "different-example": TutorResponseSchema,
      },
      { additionalProperties: false },
    ),
    distinguishingProbes: Type.Array(DistinguishingProbeSchema, { minItems: 1, maxItems: 20 }),
    visualExplanationPlan: VisualExplanationPlanSchema,
    narration: NarrationTrackSchema,
    webVtt: Type.String({ minLength: 10, maxLength: 30000, pattern: "^WEBVTT" }),
    prerequisiteRemediation: Type.Array(PrerequisiteRemediationSchema, {
      minItems: 1,
      maxItems: 20,
    }),
    parentTeacherNotes: ParentTeacherNotesSchema,
    answerReasoning: Type.Array(AnswerReasoningSchema, { minItems: 1, maxItems: 100 }),
    learnerAuthorshipPrompt: Type.String({ minLength: 1, maxLength: 1600 }),
    gradedAssignmentBoundary: Type.String({ minLength: 1, maxLength: 1600 }),
  },
  { additionalProperties: false, $id: "EnglishCoreV02Extension" },
);

export type ValidatedEnglishCoreV02Extension = Static<typeof EnglishCoreV02ExtensionSchema>;
