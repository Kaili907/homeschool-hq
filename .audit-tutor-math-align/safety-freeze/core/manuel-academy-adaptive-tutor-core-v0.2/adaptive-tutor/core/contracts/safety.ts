import { Type, type Static } from "../schema/typebox.js";
import { StableIdSchema } from "./common.js";

export const SafetyTriggerSchema = Type.Object(
  {
    id: StableIdSchema,
    category: Type.Union([
      Type.Literal("academic-integrity"),
      Type.Literal("identifying-information"),
      Type.Literal("medical-or-disability-diagnosis"),
      Type.Literal("disputed-grading"),
      Type.Literal("persistent-difficulty"),
      Type.Literal("high-stakes-placement"),
      Type.Literal("self-harm-or-immediate-danger"),
      Type.Literal("abuse-or-neglect-disclosure"),
      Type.Literal("unsupported-subject-risk"),
    ]),
    severity: Type.Union([
      Type.Literal("inform"),
      Type.Literal("redirect"),
      Type.Literal("escalate"),
      Type.Literal("urgent-escalation"),
    ]),
    matchedText: Type.String({ maxLength: 500 }),
    learnerSafeMessage: Type.String({ minLength: 1, maxLength: 1200 }),
    parentTeacherMessage: Type.String({ minLength: 1, maxLength: 1600 }),
    continueTutoringAllowed: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const SafetyDecisionSchema = Type.Object(
  {
    allowed: Type.Boolean(),
    triggers: Type.Array(SafetyTriggerSchema, { maxItems: 20 }),
    redactedInput: Type.String({ maxLength: 4000 }),
    responseRuleIds: Type.Array(StableIdSchema, { maxItems: 50 }),
    mustEscalateToAdult: Type.Boolean(),
    mustStopAcademicFlow: Type.Boolean(),
  },
  { additionalProperties: false, $id: "SafetyDecision" },
);
export type SafetyTrigger = Static<typeof SafetyTriggerSchema>;
export type SafetyDecision = Static<typeof SafetyDecisionSchema>;
