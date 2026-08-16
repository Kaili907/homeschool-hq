import { Type } from "../../schema/typebox.js";
import { OpaqueReferenceSchema, TutorActionKindSchema, } from "../../v2/contracts/index.js";
export const PROVIDER_MODEL_OUTPUT_PROPOSAL_REASON_CODES = [
    "needs-explanation",
    "needs-hint",
    "needs-check",
    "needs-example",
    "needs-reteach",
    "needs-prerequisite-check",
    "break-suggested",
    "adult-review-suggested",
    "return-to-lesson-suggested",
];
export const PROVIDER_MODEL_OUTPUT_REFUSAL_REASON_CODES = [
    "insufficient-grounding",
    "unreviewed-content-required",
    "safety-restriction",
    "assessment-answer-risk",
    "unsupported-request",
    "provider-declined",
];
export const INSTRUCTIONAL_DISPLAY_MODES = [
    "reviewed-text",
    "reviewed-visual",
    "reviewed-text-and-visual",
    "structured-check",
];
const ProposalReasonCodeSchema = Type.Union(PROVIDER_MODEL_OUTPUT_PROPOSAL_REASON_CODES.map((code) => Type.Literal(code)));
const RefusalReasonCodeSchema = Type.Union(PROVIDER_MODEL_OUTPUT_REFUSAL_REASON_CODES.map((code) => Type.Literal(code)));
export const InstructionalDisplayModeSchema = Type.Union(INSTRUCTIONAL_DISPLAY_MODES.map((mode) => Type.Literal(mode)));
const ReviewedContentRefsSchema = Type.Array(OpaqueReferenceSchema, {
    minItems: 1,
    maxItems: 12,
});
const GroundingRefsSchema = Type.Array(OpaqueReferenceSchema, {
    minItems: 1,
    maxItems: 12,
});
/**
 * A provider may only propose a reference-bound Tutor action. It cannot emit
 * learner-facing prose or any Study, safety, guardian, curriculum, or tool
 * authority.
 */
export const ProviderModelProposalEnvelopeSchema = Type.Object({
    responseKind: Type.Literal("proposal"),
    reviewedContentRefs: ReviewedContentRefsSchema,
    groundingRefs: GroundingRefsSchema,
    reasonCodes: Type.Array(ProposalReasonCodeSchema, { minItems: 1, maxItems: 6 }),
    requestedTutorAction: TutorActionKindSchema,
    instructionalDisplayMode: InstructionalDisplayModeSchema,
    refusalState: Type.Literal("not-refused"),
}, { additionalProperties: false, $id: "TutorV3ProviderModelProposalEnvelope" });
export const ProviderModelRefusalEnvelopeSchema = Type.Object({
    responseKind: Type.Literal("refusal"),
    reviewedContentRefs: Type.Array(OpaqueReferenceSchema, { maxItems: 0 }),
    groundingRefs: Type.Array(OpaqueReferenceSchema, { maxItems: 0 }),
    reasonCodes: Type.Array(RefusalReasonCodeSchema, { minItems: 1, maxItems: 6 }),
    requestedTutorAction: Type.Null(),
    instructionalDisplayMode: Type.Literal("none"),
    refusalState: Type.Literal("refused"),
}, { additionalProperties: false, $id: "TutorV3ProviderModelRefusalEnvelope" });
/** The complete provider/model output vocabulary. Unknown fields fail closed. */
export const ProviderModelOutputEnvelopeSchema = Type.Union([ProviderModelProposalEnvelopeSchema, ProviderModelRefusalEnvelopeSchema], { $id: "TutorV3ProviderModelOutputEnvelope" });
