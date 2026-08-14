import { Type, type Static } from "../../../schema/typebox.js";
import {
  AllowedGroundingReferenceSchema,
  ApprovedEvidenceSummarySchema,
  AssessmentPhaseSchema,
  HintLevelSchema,
  LearnerSafeItemSchema,
  OpaqueReferenceSchema,
  PolicyCodeSchema,
  TutorActionKindSchema,
  TutorBudgetRoutingContextSchema,
  TutorSafetyConstraintsSchema,
  TutorShortTermStateSchema,
  TutorV2VersionHeaderSchema,
  type TutorActionProposal,
  type TutorStaticFallbackOutcome,
  type TutorTelemetryEnvelope,
} from "../../contracts/index.js";

const ProviderEphemeralLearnerAttemptSchema = Type.Object(
  {
    itemRef: OpaqueReferenceSchema,
    responseFormat: PolicyCodeSchema,
    learnerResponse: Type.String({ minLength: 1, maxLength: 4000 }),
    policyPermissionRef: OpaqueReferenceSchema,
    persistenceAllowed: Type.Literal(false),
  },
  { additionalProperties: false },
);

const ProviderAgePolicyParametersSchema = Type.Object(
  {
    agePolicyRef: OpaqueReferenceSchema,
    learnerStageRef: OpaqueReferenceSchema,
    responseStyleCode: PolicyCodeSchema,
    maximumResponseWords: Type.Integer({ minimum: 1, maximum: 1000 }),
  },
  { additionalProperties: false },
);

export const ProviderExecutionInstructionSchema = Type.Object(
  {
    subjectRef: OpaqueReferenceSchema,
    conceptRef: OpaqueReferenceSchema,
    workingLevelInstructionRef: Type.Optional(Type.Union([OpaqueReferenceSchema])),
    learnerStageRef: OpaqueReferenceSchema,
    learnerSafeItem: Type.Union([LearnerSafeItemSchema, Type.Null()]),
    currentLearnerAttempt: Type.Optional(Type.Union([ProviderEphemeralLearnerAttemptSchema])),
    assessmentPhase: AssessmentPhaseSchema,
    approvedEvidenceSummary: ApprovedEvidenceSummarySchema,
    allowedActions: Type.Array(TutorActionKindSchema, { minItems: 1, maxItems: 9 }),
    hintCeiling: HintLevelSchema,
    agePolicyParameters: Type.Optional(Type.Union([ProviderAgePolicyParametersSchema])),
    safetyConstraints: TutorSafetyConstraintsSchema,
    groundingReferences: Type.Array(AllowedGroundingReferenceSchema, {
      minItems: 1,
      maxItems: 12,
    }),
  },
  { additionalProperties: false },
);

export const ProviderExecutionContextSchema = Type.Composite(
  [
    TutorV2VersionHeaderSchema,
    Type.Object(
      {
        contextKind: Type.Literal("provider"),
        interactionRef: OpaqueReferenceSchema,
        instruction: ProviderExecutionInstructionSchema,
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false, $id: "TutorV2ProviderExecutionContext" },
);
export type ProviderExecutionContext = Static<typeof ProviderExecutionContextSchema>;

/**
 * The only input accepted by a Tutor provider implementation. Study authority
 * is structurally absent; the bridge must adapt its minimized projection into
 * this closed execution envelope.
 */
export const ProviderExecutionRequestSchema = Type.Composite(
  [
    TutorV2VersionHeaderSchema,
    Type.Object(
      {
        envelope: Type.Literal("provider-execution-request"),
        requestRef: OpaqueReferenceSchema,
        context: ProviderExecutionContextSchema,
        shortTermState: TutorShortTermStateSchema,
        budgetRoutingContext: TutorBudgetRoutingContextSchema,
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false, $id: "TutorV2ProviderExecutionRequest" },
);
export type ProviderExecutionRequest = Static<typeof ProviderExecutionRequestSchema>;
/** @deprecated Use ProviderExecutionRequest. This alias no longer denotes TutorRequest. */
export type ClosedStructuredTutorRequest = ProviderExecutionRequest;

export interface TutorProviderPort {
  execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResult>;
}

export type ProviderFailureStatus =
  | "unavailable"
  | "timeout"
  | "malformed-response"
  | "rejected-response"
  | "over-budget"
  | "transient-failure"
  | "permanent-failure";

export type ProviderFailureReason =
  | "PROVIDER_OUTAGE"
  | "PROVIDER_TIMEOUT"
  | "INVALID_JSON"
  | "SCHEMA_MISMATCH"
  | "UNSUPPORTED_ACTION"
  | "RESPONSE_BINDING_MISMATCH"
  | "RESPONSE_TOO_LARGE"
  | "OUTPUT_TOKEN_LIMIT_EXCEEDED"
  | "COST_BUDGET_EXCEEDED"
  | "NO_ACTION_BUDGET"
  | "PROVIDER_REJECTED"
  | "TRANSPORT_EXCEPTION"
  | "PERMANENT_TRANSPORT_FAILURE"
  | "INVALID_CLOSED_REQUEST";

export interface ProviderSuccessResult {
  readonly status: "success";
  readonly proposal: TutorActionProposal;
  readonly fallbackRequired: false;
  readonly telemetry: TutorTelemetryEnvelope;
}

export interface ProviderFailureResult {
  readonly status: ProviderFailureStatus;
  readonly reason: ProviderFailureReason;
  readonly retryable: boolean;
  readonly fallbackRequired: true;
  /** A canonical instruction for Study to use reviewed static curriculum. */
  readonly fallback: TutorStaticFallbackOutcome;
  readonly telemetry: TutorTelemetryEnvelope;
}

export type ProviderExecutionResult = ProviderSuccessResult | ProviderFailureResult;
