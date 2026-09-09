import { Type, type Static } from "../../schema/typebox.js";
import {
  OpaqueReferenceSchema,
  TutorActionKindSchema,
  type AssessmentPhase,
  type OpaqueReference,
  type TutorActionKind,
} from "../../v2/contracts/index.js";

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
] as const;

export const PROVIDER_MODEL_OUTPUT_REFUSAL_REASON_CODES = [
  "insufficient-grounding",
  "unreviewed-content-required",
  "safety-restriction",
  "assessment-answer-risk",
  "unsupported-request",
  "provider-declined",
] as const;

export const INSTRUCTIONAL_DISPLAY_MODES = [
  "reviewed-text",
  "reviewed-visual",
  "reviewed-text-and-visual",
  "structured-check",
] as const;

const ProposalReasonCodeSchema = Type.Union(
  PROVIDER_MODEL_OUTPUT_PROPOSAL_REASON_CODES.map((code) => Type.Literal(code)),
);

const RefusalReasonCodeSchema = Type.Union(
  PROVIDER_MODEL_OUTPUT_REFUSAL_REASON_CODES.map((code) => Type.Literal(code)),
);

export const InstructionalDisplayModeSchema = Type.Union(
  INSTRUCTIONAL_DISPLAY_MODES.map((mode) => Type.Literal(mode)),
);
export type InstructionalDisplayMode = Static<typeof InstructionalDisplayModeSchema>;

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
export const ProviderModelProposalEnvelopeSchema = Type.Object(
  {
    responseKind: Type.Literal("proposal"),
    reviewedContentRefs: ReviewedContentRefsSchema,
    groundingRefs: GroundingRefsSchema,
    reasonCodes: Type.Array(ProposalReasonCodeSchema, { minItems: 1, maxItems: 6 }),
    requestedTutorAction: TutorActionKindSchema,
    instructionalDisplayMode: InstructionalDisplayModeSchema,
    refusalState: Type.Literal("not-refused"),
  },
  { additionalProperties: false, $id: "TutorV3ProviderModelProposalEnvelope" },
);
export type ProviderModelProposalEnvelope = Static<
  typeof ProviderModelProposalEnvelopeSchema
>;

export const ProviderModelRefusalEnvelopeSchema = Type.Object(
  {
    responseKind: Type.Literal("refusal"),
    reviewedContentRefs: Type.Array(OpaqueReferenceSchema, { maxItems: 0 }),
    groundingRefs: Type.Array(OpaqueReferenceSchema, { maxItems: 0 }),
    reasonCodes: Type.Array(RefusalReasonCodeSchema, { minItems: 1, maxItems: 6 }),
    requestedTutorAction: Type.Null(),
    instructionalDisplayMode: Type.Literal("none"),
    refusalState: Type.Literal("refused"),
  },
  { additionalProperties: false, $id: "TutorV3ProviderModelRefusalEnvelope" },
);
export type ProviderModelRefusalEnvelope = Static<
  typeof ProviderModelRefusalEnvelopeSchema
>;

/** The complete provider/model output vocabulary. Unknown fields fail closed. */
export const ProviderModelOutputEnvelopeSchema = Type.Union(
  [ProviderModelProposalEnvelopeSchema, ProviderModelRefusalEnvelopeSchema],
  { $id: "TutorV3ProviderModelOutputEnvelope" },
);
export type ProviderModelOutputEnvelope = Static<
  typeof ProviderModelOutputEnvelopeSchema
>;

/** Trusted, non-model policy inputs used to constrain a provider proposal. */
export interface ModelOutputValidationContext {
  readonly assessmentPhase: AssessmentPhase;
  readonly reviewedContentRefs: readonly OpaqueReference[];
  readonly groundingRefs: readonly OpaqueReference[];
  readonly allowedTutorActions: readonly TutorActionKind[];
  readonly allowedInstructionalDisplayModes: readonly InstructionalDisplayMode[];
}

export type StaticFallbackReasonCode =
  | "FORBIDDEN_MODEL_AUTHORITY"
  | "ACTIVE_ASSESSMENT_ANSWER_BEARING_OUTPUT"
  | "UNREVIEWED_CONTENT_REFERENCE"
  | "UNKNOWN_GROUNDING_REFERENCE"
  | "REQUESTED_TUTOR_ACTION_NOT_ALLOWED"
  | "INSTRUCTIONAL_DISPLAY_MODE_NOT_ALLOWED";

type DeepReadonly<T> = T extends readonly (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : T extends object
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
    : T;

export type NormalizedModelProposal = DeepReadonly<ProviderModelProposalEnvelope>;
export type NormalizedModelRefusal = DeepReadonly<ProviderModelRefusalEnvelope>;

export interface AcceptedModelProposalResult {
  readonly status: "accepted-proposal";
  readonly proposal: NormalizedModelProposal;
  readonly staticFallbackRequired: false;
}

export interface RefusedModelOutputResult {
  readonly status: "refused";
  readonly refusal: NormalizedModelRefusal;
  readonly staticFallbackRequired: true;
}

export interface MalformedModelOutputResult {
  readonly status: "malformed";
  readonly reasonCode: "MODEL_OUTPUT_SCHEMA_REJECTED";
  readonly staticFallbackRequired: true;
}

export interface StaticFallbackRequiredResult {
  readonly status: "static-fallback-required";
  readonly reasonCode: StaticFallbackReasonCode;
  readonly staticFallbackRequired: true;
}

export type NormalizedModelOutputResult =
  | AcceptedModelProposalResult
  | RefusedModelOutputResult
  | MalformedModelOutputResult
  | StaticFallbackRequiredResult;
