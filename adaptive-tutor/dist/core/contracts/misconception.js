import { Type } from "../schema/typebox.js";
import { StableIdSchema } from "./common.js";
export const EvidenceSignalSchema = Type.Object({
    tag: StableIdSchema,
    direction: Type.Union([
        Type.Literal("supports"),
        Type.Literal("contradicts"),
        Type.Literal("neutral"),
    ]),
    weight: Type.Number({ minimum: 0, maximum: 1 }),
    explanation: Type.String({ minLength: 1, maxLength: 600 }),
}, { additionalProperties: false });
export const MisconceptionDefinitionSchema = Type.Object({
    id: StableIdSchema,
    skillId: StableIdSchema,
    label: Type.String({ minLength: 1, maxLength: 160 }),
    learnerSafeDescription: Type.String({ minLength: 1, maxLength: 800 }),
    distinguishingEvidence: Type.Array(EvidenceSignalSchema, { minItems: 1, maxItems: 50 }),
    alternateExplanations: Type.Array(Type.String({ minLength: 1, maxLength: 600 }), {
        maxItems: 20,
    }),
    minimumEvidenceCount: Type.Integer({ minimum: 1, maximum: 20 }),
    escalationAfterRepeatedCycles: Type.Integer({ minimum: 1, maximum: 20 }),
}, { additionalProperties: false });
export const MisconceptionHypothesisSchema = Type.Object({
    misconceptionId: StableIdSchema,
    probability: Type.Number({ minimum: 0, maximum: 1 }),
    uncertainty: Type.Number({ minimum: 0, maximum: 1 }),
    evidenceCount: Type.Integer({ minimum: 0 }),
    supportingTags: Type.Array(StableIdSchema, { maxItems: 50 }),
    contradictingTags: Type.Array(StableIdSchema, { maxItems: 50 }),
    status: Type.Union([
        Type.Literal("possible"),
        Type.Literal("probable"),
        Type.Literal("unlikely"),
        Type.Literal("insufficient-evidence"),
    ]),
}, { additionalProperties: false });
export const MisconceptionClassificationSchema = Type.Object({
    skillId: StableIdSchema,
    hypotheses: Type.Array(MisconceptionHypothesisSchema, { maxItems: 20 }),
    selectedMisconceptionId: Type.Union([StableIdSchema, Type.Null()]),
    uncertaintyStatement: Type.String({ minLength: 1, maxLength: 1000 }),
    doNotDiagnose: Type.Literal(true),
}, { additionalProperties: false, $id: "MisconceptionClassification" });
//# sourceMappingURL=misconception.js.map