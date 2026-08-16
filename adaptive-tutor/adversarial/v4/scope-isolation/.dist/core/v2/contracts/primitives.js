import { Type } from "../../schema/typebox.js";
export const OpaqueReferenceSchema = Type.String({
    minLength: 3,
    maxLength: 160,
    pattern: "^[a-z][a-z0-9-]{1,31}:[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$",
});
export const ContentDigestSchema = Type.String({
    pattern: "^sha256:[a-f0-9]{64}$",
});
export const ISODateTimeSchema = Type.String({
    pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$",
});
export const PolicyCodeSchema = Type.String({
    minLength: 3,
    maxLength: 96,
    pattern: "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$",
});
export const TutorActionKindSchema = Type.Union([
    Type.Literal("explain"),
    Type.Literal("hint"),
    Type.Literal("ask-check"),
    Type.Literal("show-example"),
    Type.Literal("reteach"),
    Type.Literal("check-prerequisite"),
    Type.Literal("suggest-break"),
    Type.Literal("escalate"),
    Type.Literal("return-to-lesson"),
]);
export const TUTOR_ACTION_KINDS = [
    "explain",
    "hint",
    "ask-check",
    "show-example",
    "reteach",
    "check-prerequisite",
    "suggest-break",
    "escalate",
    "return-to-lesson",
];
export const AssessmentPhaseSchema = Type.Union([
    Type.Literal("instruction-or-practice"),
    Type.Literal("active-graded-or-mastery-check"),
    Type.Literal("completed-assessment-review"),
    Type.Literal("non-graded-review"),
]);
export const AssistanceLevelSchema = Type.Union([
    Type.Literal("independent"),
    Type.Literal("light-hint"),
    Type.Literal("guided"),
    Type.Literal("reteach-required"),
]);
export const HintLevelSchema = Type.Union([
    Type.Literal("none"),
    Type.Literal("nudge"),
    Type.Literal("concept-cue"),
    Type.Literal("guided-step"),
]);
export const ActiveHintLevelSchema = Type.Union([
    Type.Literal("nudge"),
    Type.Literal("concept-cue"),
    Type.Literal("guided-step"),
]);
