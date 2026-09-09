import { Type, type Static } from "../../schema/typebox.js";
import { TutorActionSchema } from "./actions.js";
import { StudyAuthorityContextSchema } from "./context.js";
import {
  GroundingAssessmentSchema,
  INSUFFICIENT_GROUNDED_CONTEXT,
  InsufficientGroundingAssessmentSchema,
  ProviderGroundingClaimSchema,
} from "./grounding.js";
import {
  TutorBudgetRoutingContextSchema,
  TutorShortTermStateSchema,
} from "./operations.js";
import {
  AssistanceLevelSchema,
  HintLevelSchema,
  OpaqueReferenceSchema,
  PolicyCodeSchema,
} from "./primitives.js";
import { TutorV2VersionHeaderSchema } from "./version.js";

export const TutorRequestSchema = Type.Composite(
  [
    TutorV2VersionHeaderSchema,
    Type.Object(
      {
        envelope: Type.Literal("tutor-request"),
        requestRef: OpaqueReferenceSchema,
        requestIntent: Type.Literal("propose-next-teaching-action"),
        studyAuthorityContext: StudyAuthorityContextSchema,
        budgetRoutingContext: TutorBudgetRoutingContextSchema,
        shortTermState: TutorShortTermStateSchema,
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false, $id: "TutorV2Request" },
);
export type TutorRequest = Static<typeof TutorRequestSchema>;

export const TutorActionProposalSchema = Type.Composite(
  [
    TutorV2VersionHeaderSchema,
    Type.Object(
      {
        envelope: Type.Literal("tutor-action-proposal"),
        proposalRef: OpaqueReferenceSchema,
        interactionRef: OpaqueReferenceSchema,
        action: TutorActionSchema,
        groundingClaims: Type.Array(ProviderGroundingClaimSchema, { maxItems: 12 }),
        assistanceLevel: AssistanceLevelSchema,
        hintLevel: HintLevelSchema,
        authoritative: Type.Literal(false),
        requiresStudyValidation: Type.Literal(true),
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false, $id: "TutorV2ActionProposal" },
);
export type TutorActionProposal = Static<typeof TutorActionProposalSchema>;

export const TutorFailureCodeSchema = Type.Union([
  Type.Literal("PROVIDER_UNAVAILABLE"),
  Type.Literal("PROVIDER_TIMEOUT"),
  Type.Literal("MALFORMED_RESPONSE"),
  Type.Literal("UNSUPPORTED_ACTION"),
]);
export type TutorFailureCode = Static<typeof TutorFailureCodeSchema>;

export const TutorFailureOutcomeSchema = Type.Composite(
  [
    TutorV2VersionHeaderSchema,
    Type.Object(
      {
        envelope: Type.Literal("tutor-failure"),
        interactionRef: OpaqueReferenceSchema,
        code: TutorFailureCodeSchema,
        retryable: Type.Boolean(),
        reasonRef: OpaqueReferenceSchema,
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false, $id: "TutorV2FailureOutcome" },
);
export type TutorFailureOutcome = Static<typeof TutorFailureOutcomeSchema>;

export const TutorRefusalCodeSchema = Type.Union([
  Type.Literal(INSUFFICIENT_GROUNDED_CONTEXT),
  Type.Literal("POLICY_REJECTION"),
]);

export const TutorInsufficientGroundingRefusalOutcomeSchema = Type.Composite(
  [
    TutorV2VersionHeaderSchema,
    Type.Object(
      {
        envelope: Type.Literal("tutor-refusal"),
        interactionRef: OpaqueReferenceSchema,
        code: Type.Literal(INSUFFICIENT_GROUNDED_CONTEXT),
        reasonCode: PolicyCodeSchema,
        grounding: InsufficientGroundingAssessmentSchema,
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false },
);

export const TutorPolicyRefusalOutcomeSchema = Type.Composite(
  [
    TutorV2VersionHeaderSchema,
    Type.Object(
      {
        envelope: Type.Literal("tutor-refusal"),
        interactionRef: OpaqueReferenceSchema,
        code: Type.Literal("POLICY_REJECTION"),
        reasonCode: PolicyCodeSchema,
        grounding: GroundingAssessmentSchema,
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false },
);

export const TutorRefusalOutcomeSchema = Type.Union(
  [TutorInsufficientGroundingRefusalOutcomeSchema, TutorPolicyRefusalOutcomeSchema],
  { $id: "TutorV2RefusalOutcome" },
);
export type TutorRefusalOutcome = Static<typeof TutorRefusalOutcomeSchema>;

export const TutorStaticFallbackOutcomeSchema = Type.Composite(
  [
    TutorV2VersionHeaderSchema,
    Type.Object(
      {
        envelope: Type.Literal("tutor-static-fallback-required"),
        interactionRef: OpaqueReferenceSchema,
        code: Type.Literal("STATIC_FALLBACK_REQUIRED"),
        fallbackRef: OpaqueReferenceSchema,
        reasonCode: Type.Union([
          TutorFailureCodeSchema,
          TutorRefusalCodeSchema,
          Type.Literal("SAFETY_STOP"),
        ]),
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false, $id: "TutorV2StaticFallbackOutcome" },
);
export type TutorStaticFallbackOutcome = Static<typeof TutorStaticFallbackOutcomeSchema>;

export const TutorSafetyStopOutcomeSchema = Type.Composite(
  [
    TutorV2VersionHeaderSchema,
    Type.Object(
      {
        envelope: Type.Literal("tutor-safety-stop"),
        interactionRef: OpaqueReferenceSchema,
        code: Type.Literal("SAFETY_STOP"),
        safetyRef: OpaqueReferenceSchema,
        academicContinuationAllowed: Type.Literal(false),
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false, $id: "TutorV2SafetyStopOutcome" },
);
export type TutorSafetyStopOutcome = Static<typeof TutorSafetyStopOutcomeSchema>;

export const TutorResponseEnvelopeSchema = Type.Union(
  [
    TutorActionProposalSchema,
    TutorFailureOutcomeSchema,
    TutorRefusalOutcomeSchema,
    TutorStaticFallbackOutcomeSchema,
    TutorSafetyStopOutcomeSchema,
  ],
  { $id: "TutorV2ResponseEnvelope" },
);
export type TutorResponseEnvelope = Static<typeof TutorResponseEnvelopeSchema>;

export const ValidationIssueSchema = Type.Object(
  {
    path: Type.String({ minLength: 1, maxLength: 240 }),
    code: PolicyCodeSchema,
  },
  { additionalProperties: false },
);

export const TutorValidationResultSchema = Type.Union(
  [
    Type.Object(
      {
        status: Type.Literal("accepted"),
        proposal: TutorActionProposalSchema,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        status: Type.Literal("rejected"),
        code: Type.Union([
          TutorFailureCodeSchema,
          TutorRefusalCodeSchema,
        ]),
        issues: Type.Array(ValidationIssueSchema, { maxItems: 32 }),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        status: Type.Literal("fallback"),
        outcome: TutorStaticFallbackOutcomeSchema,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        status: Type.Literal("quarantined"),
        outcome: TutorSafetyStopOutcomeSchema,
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "TutorV2ValidationResult" },
);
export type TutorValidationResult = Static<typeof TutorValidationResultSchema>;
