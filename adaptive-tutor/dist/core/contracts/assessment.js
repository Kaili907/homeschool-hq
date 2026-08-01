import { Type } from "../schema/typebox.js";
import { GradeBandSchema, LocaleSchema, StableIdSchema, SubjectSchema, } from "./common.js";
export const AssessmentPurposeSchema = Type.Union([
    Type.Literal("diagnostic"),
    Type.Literal("guided-practice"),
    Type.Literal("independent-mastery"),
    Type.Literal("reassessment"),
]);
export const AssessmentOptionSchema = Type.Object({
    id: StableIdSchema,
    text: Type.String({ minLength: 1, maxLength: 500 }),
    accessibleLabel: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
}, { additionalProperties: false });
const AssessmentItemBaseSchema = Type.Object({
    id: StableIdSchema,
    skillId: StableIdSchema,
    purpose: AssessmentPurposeSchema,
    subject: SubjectSchema,
    gradeBand: GradeBandSchema,
    locale: LocaleSchema,
    prompt: Type.String({ minLength: 1, maxLength: 2500 }),
    directions: Type.Optional(Type.String({ maxLength: 1200 })),
    maxAttempts: Type.Integer({ minimum: 1, maximum: 10 }),
    estimatedSeconds: Type.Integer({ minimum: 5, maximum: 1800 }),
    tags: Type.Array(StableIdSchema, { maxItems: 30 }),
    noCameraRequired: Type.Literal(true),
    identifyingInformationRequested: Type.Literal(false),
}, { additionalProperties: false });
export const MultipleChoiceItemSchema = Type.Composite([
    AssessmentItemBaseSchema,
    Type.Object({
        kind: Type.Literal("multiple-choice"),
        options: Type.Array(AssessmentOptionSchema, { minItems: 2, maxItems: 8 }),
        correctOptionIds: Type.Array(StableIdSchema, { minItems: 1, maxItems: 8 }),
        allowMultiple: Type.Boolean(),
        shuffle: Type.Boolean(),
    }, { additionalProperties: false }),
]);
export const ShortAnswerItemSchema = Type.Composite([
    AssessmentItemBaseSchema,
    Type.Object({
        kind: Type.Literal("short-answer"),
        acceptedAnswers: Type.Array(Type.String({ minLength: 1, maxLength: 300 }), {
            minItems: 1,
            maxItems: 30,
        }),
        caseSensitive: Type.Boolean(),
        trimWhitespace: Type.Boolean(),
        normalization: Type.Union([
            Type.Literal("none"),
            Type.Literal("basic-text"),
            Type.Literal("numeric"),
        ]),
    }, { additionalProperties: false }),
]);
export const SequencingItemSchema = Type.Composite([
    AssessmentItemBaseSchema,
    Type.Object({
        kind: Type.Literal("sequencing"),
        options: Type.Array(AssessmentOptionSchema, { minItems: 2, maxItems: 10 }),
        correctOrder: Type.Array(StableIdSchema, { minItems: 2, maxItems: 10 }),
    }, { additionalProperties: false }),
]);
export const AssessmentItemSchema = Type.Union([
    MultipleChoiceItemSchema,
    ShortAnswerItemSchema,
    SequencingItemSchema,
], {
    $id: "AssessmentItem",
});
//# sourceMappingURL=assessment.js.map