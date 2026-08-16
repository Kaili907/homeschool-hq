import { Type } from "../../schema/typebox.js";
import { ActiveHintLevelSchema, OpaqueReferenceSchema, PolicyCodeSchema } from "./primitives.js";
const GroundingRefsSchema = Type.Array(OpaqueReferenceSchema, { minItems: 1, maxItems: 12 });
const TeachingContentSchema = Type.String({ minLength: 1, maxLength: 2400 });
export const ExplainActionSchema = Type.Object({
    kind: Type.Literal("explain"),
    content: TeachingContentSchema,
    groundingRefs: GroundingRefsSchema,
}, { additionalProperties: false });
export const HintActionSchema = Type.Object({
    kind: Type.Literal("hint"),
    content: TeachingContentSchema,
    hintLevel: ActiveHintLevelSchema,
    groundingRefs: GroundingRefsSchema,
}, { additionalProperties: false });
export const AskCheckActionSchema = Type.Object({
    kind: Type.Literal("ask-check"),
    question: Type.String({ minLength: 1, maxLength: 1200 }),
    checkKind: Type.Union([
        Type.Literal("comprehension"),
        Type.Literal("reflection"),
        Type.Literal("next-step"),
    ]),
    groundingRefs: GroundingRefsSchema,
}, { additionalProperties: false });
export const ShowExampleActionSchema = Type.Object({
    kind: Type.Literal("show-example"),
    content: TeachingContentSchema,
    exampleRef: OpaqueReferenceSchema,
    groundingRefs: GroundingRefsSchema,
    nonIsomorphicToActiveItem: Type.Literal(true),
}, { additionalProperties: false });
export const ReteachActionSchema = Type.Object({
    kind: Type.Literal("reteach"),
    content: TeachingContentSchema,
    conceptRef: OpaqueReferenceSchema,
    groundingRefs: GroundingRefsSchema,
}, { additionalProperties: false });
export const CheckPrerequisiteActionSchema = Type.Object({
    kind: Type.Literal("check-prerequisite"),
    prerequisiteConceptRef: OpaqueReferenceSchema,
    reasonCode: PolicyCodeSchema,
    groundingRefs: GroundingRefsSchema,
}, { additionalProperties: false });
export const SuggestBreakActionSchema = Type.Object({
    kind: Type.Literal("suggest-break"),
    reasonCode: PolicyCodeSchema,
    proposedDurationMinutes: Type.Integer({ minimum: 1, maximum: 30 }),
}, { additionalProperties: false });
export const EscalateActionSchema = Type.Object({
    kind: Type.Literal("escalate"),
    reasonCode: PolicyCodeSchema,
    escalationTarget: Type.Literal("study-adult-review-policy"),
    claimsDelivery: Type.Literal(false),
}, { additionalProperties: false });
export const ReturnToLessonActionSchema = Type.Object({
    kind: Type.Literal("return-to-lesson"),
    reasonCode: PolicyCodeSchema,
    resumeTarget: Type.Literal("study-selected-position"),
}, { additionalProperties: false });
export const TutorActionSchema = Type.Union([
    ExplainActionSchema,
    HintActionSchema,
    AskCheckActionSchema,
    ShowExampleActionSchema,
    ReteachActionSchema,
    CheckPrerequisiteActionSchema,
    SuggestBreakActionSchema,
    EscalateActionSchema,
    ReturnToLessonActionSchema,
], { $id: "TutorV2Action" });
