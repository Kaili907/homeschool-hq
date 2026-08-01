import { Type, type Static } from "../schema/typebox.js";

export const StableIdSchema = Type.String({
  minLength: 3,
  maxLength: 120,
  pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
  description: "Lowercase ASCII stable content identifier.",
});
export type StableId = Static<typeof StableIdSchema>;

export const ISODateTimeSchema = Type.String({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$",
});

export const GradeBandSchema = Type.Object(
  {
    min: Type.Integer({ minimum: 0, maximum: 12 }),
    max: Type.Integer({ minimum: 0, maximum: 12 }),
    label: Type.String({ minLength: 1, maxLength: 40 }),
  },
  { additionalProperties: false },
);
export type GradeBand = Static<typeof GradeBandSchema>;

export const SubjectSchema = Type.Union([
  Type.Literal("math"),
  Type.Literal("english"),
  Type.Literal("science"),
  Type.Literal("social-studies"),
  Type.Literal("general"),
]);
export type Subject = Static<typeof SubjectSchema>;

export const LocaleSchema = Type.String({
  minLength: 2,
  maxLength: 20,
  pattern: "^[a-z]{2,3}(?:-[A-Z]{2})?$",
});

export const EvidenceSourceSchema = Type.Union([
  Type.Literal("diagnostic"),
  Type.Literal("guided-practice"),
  Type.Literal("independent-attempt"),
  Type.Literal("reassessment"),
  Type.Literal("teacher-observation"),
]);
export type EvidenceSource = Static<typeof EvidenceSourceSchema>;

export const ResponseOutcomeSchema = Type.Union([
  Type.Literal("correct"),
  Type.Literal("partial"),
  Type.Literal("incorrect"),
  Type.Literal("unscored"),
]);
export type ResponseOutcome = Static<typeof ResponseOutcomeSchema>;

export const LearnerInputSchema = Type.Object(
  {
    raw: Type.String({ maxLength: 2000 }),
    selectedOptionIds: Type.Optional(Type.Array(StableIdSchema, { maxItems: 20 })),
    orderedOptionIds: Type.Optional(Type.Array(StableIdSchema, { maxItems: 20 })),
  },
  { additionalProperties: false },
);
export type LearnerInput = Static<typeof LearnerInputSchema>;

export const EvaluationResultSchema = Type.Object(
  {
    outcome: ResponseOutcomeSchema,
    score: Type.Number({ minimum: 0, maximum: 1 }),
    feedback: Type.String({ minLength: 1, maxLength: 1200 }),
    matchedConceptIds: Type.Array(StableIdSchema, { maxItems: 20 }),
    evidenceTags: Type.Array(StableIdSchema, { maxItems: 30 }),
  },
  { additionalProperties: false },
);
export type EvaluationResult = Static<typeof EvaluationResultSchema>;
