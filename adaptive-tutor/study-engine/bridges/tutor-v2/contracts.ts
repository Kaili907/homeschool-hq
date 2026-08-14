import { Type, type Static, type TSchema } from "../../../core/schema/typebox.js";
import type {
  TutorAction,
  TutorActionProposal,
  TutorRequest,
} from "../../../core/v2/contracts/index.js";
import {
  ISODateTimeSchema,
  OpaqueReferenceSchema,
  TutorActionKindSchema,
  TutorActionProposalSchema,
} from "../../../core/v2/contracts/index.js";
import {
  TrustedStudyAgePolicyBindingSchema,
  type AgeAwareTutorPolicyProfile,
  type TutorTurnPolicyPlan,
} from "../../../core/v2/policy/age/index.js";
import type { TutorSessionMemoryState } from "../../../core/v2/memory/index.js";
import type {
  ProviderExecutionResult,
  TutorProviderPort,
} from "../../../core/v2/providers/ports/index.js";
import {
  PrerequisiteReviewEvidenceSchema,
  type DurableTutorEvidence,
} from "../../tutor-v2/evidence/index.js";
import {
  ProviderContextDisclosurePolicySchema,
  type MinimizedProviderContext,
} from "../../tutor-v2/privacy/index.js";
import type { ReviewedTutorContentAuthorityPort } from "./reviewed-content.js";

export const TUTOR_V2_BRIDGE_VERSION = "1.0.0" as const;
export const TUTOR_V2_BRIDGE_EVENT_VERSION = 1 as const;
const UnknownJsonBoundarySchema = {} as TSchema<unknown>;

export const TutorInvocationPermissionSchema = Type.Object(
  {
    permissionKind: Type.Literal("study-issued-tutor-invocation"),
    permitRef: OpaqueReferenceSchema,
    invocationBindingRef: OpaqueReferenceSchema,
    authorizationRef: OpaqueReferenceSchema,
    authorizationRevision: Type.Integer({ minimum: 1 }),
    allowedActions: Type.Array(TutorActionKindSchema, { minItems: 1, maxItems: 9 }),
    issuedAt: ISODateTimeSchema,
    expiresAt: ISODateTimeSchema,
  },
  { additionalProperties: false, $id: "StudyTutorV2InvocationPermission" },
);
export type TutorInvocationPermission = Static<typeof TutorInvocationPermissionSchema>;

export const TutorV2BridgeMemoryAccessSchema = Type.Object(
  {
    memoryRef: OpaqueReferenceSchema,
    scope: Type.Object(
      {
        scopeKind: Type.Literal("trusted-study-tutor-scope"),
        householdScopeRef: OpaqueReferenceSchema,
        learnerScopeRef: OpaqueReferenceSchema,
        sessionRef: OpaqueReferenceSchema,
        interactionRef: OpaqueReferenceSchema,
        lessonRef: OpaqueReferenceSchema,
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false, $id: "StudyTutorV2BridgeMemoryAccess" },
);
export type TutorV2BridgeMemoryAccess = Static<typeof TutorV2BridgeMemoryAccessSchema>;

export const TutorV2BridgeEvidenceContextSchema = Type.Object(
  {
    evidenceRef: OpaqueReferenceSchema,
    observedAt: ISODateTimeSchema,
    currentSkillRef: OpaqueReferenceSchema,
    learnerResponseOutcome: Type.Union([
      Type.Literal("correct"),
      Type.Literal("partial"),
      Type.Literal("incorrect"),
      Type.Literal("not-evaluated"),
    ]),
    prerequisiteReview: PrerequisiteReviewEvidenceSchema,
  },
  { additionalProperties: false, $id: "StudyTutorV2BridgeEvidenceContext" },
);
export type TutorV2BridgeEvidenceContext = Static<
  typeof TutorV2BridgeEvidenceContextSchema
>;

export const ReviewedStaticFallbackSchema = Type.Object(
  {
    fallbackRef: OpaqueReferenceSchema,
    reviewApprovalRef: OpaqueReferenceSchema,
    proposal: TutorActionProposalSchema,
  },
  { additionalProperties: false, $id: "StudyTutorV2ReviewedStaticFallback" },
);
export type ReviewedStaticFallback = Static<typeof ReviewedStaticFallbackSchema>;

/**
 * The request remains unknown here so the bridge can validate its exact V2
 * contract separately and still retain a trusted, reviewed fallback when the
 * request itself is malformed.
 */
export const TutorV2BridgeInvocationSchema = Type.Object(
  {
    bridgeVersion: Type.Literal(TUTOR_V2_BRIDGE_VERSION),
    request: UnknownJsonBoundarySchema,
    invocationPermission: TutorInvocationPermissionSchema,
    agePolicyBinding: TrustedStudyAgePolicyBindingSchema,
    memoryAccess: TutorV2BridgeMemoryAccessSchema,
    disclosurePolicy: ProviderContextDisclosurePolicySchema,
    assessmentPolicy: Type.Object(
      { completedAssessmentReviewAllowed: Type.Boolean() },
      { additionalProperties: false },
    ),
    evidenceContext: TutorV2BridgeEvidenceContextSchema,
    reviewedFallback: ReviewedStaticFallbackSchema,
  },
  { additionalProperties: false, $id: "StudyTutorV2BridgeInvocation" },
);
export type TutorV2BridgeInvocation = Static<typeof TutorV2BridgeInvocationSchema>;

export type StudyPermitDecision =
  | { readonly status: "accepted" }
  | {
      readonly status: "rejected";
      readonly code: "INVOCATION_NOT_AUTHORIZED" | "INVOCATION_PERMISSION_REPLAYED";
    };

export interface StudyTutorInvocationPermissionPort {
  consume(
    permission: TutorInvocationPermission,
    request: TutorRequest,
  ): StudyPermitDecision | Promise<StudyPermitDecision>;
}

export type StudySafetyDecision =
  | { readonly status: "accepted" }
  | {
      readonly status: "rejected";
      readonly code:
        | "SAFETY_CLEARANCE_REJECTED"
        | "SAFETY_CLASSIFIER_UNAVAILABLE"
        | "SAFETY_CLEARANCE_REPLAYED";
      readonly adultReviewRequired: boolean;
    };

export interface StudyTutorSafetyPort {
  consume(input: {
    readonly safetyClearanceRef: string;
    readonly interactionRef: string;
    readonly safetyPolicyRef: string;
  }): StudySafetyDecision | Promise<StudySafetyDecision>;
}

export interface StudyTutorAgeTurnInspectorPort {
  inspect(input: {
    readonly proposal: TutorActionProposal;
    readonly profile: AgeAwareTutorPolicyProfile;
    readonly memory: TutorSessionMemoryState;
  }): unknown;
}

export interface StudyReviewedStaticFallbackPort {
  validate(
    fallback: ReviewedStaticFallback,
    request: TutorRequest,
  ):
    | { readonly status: "accepted" }
    | { readonly status: "rejected"; readonly code: "STATIC_FALLBACK_NOT_APPROVED" }
    | Promise<
        | { readonly status: "accepted" }
        | { readonly status: "rejected"; readonly code: "STATIC_FALLBACK_NOT_APPROVED" }
      >;
}

export interface TutorV2MemoryPort {
  read(input: unknown):
    | { readonly status: "accepted"; readonly state: TutorSessionMemoryState }
    | {
        readonly status: "rejected";
        readonly code: string;
        readonly tutorMayUseMemory: false;
      };
  update(input: unknown):
    | { readonly status: "accepted"; readonly state: TutorSessionMemoryState }
    | {
        readonly status: "rejected";
        readonly code: string;
        readonly tutorMayUseMemory: false;
      };
}

export interface TutorV2AcceptedEventLedgerPort {
  appendAcceptedEvent(
    sessionRef: string,
    eventRef: string,
    eventVersion: number,
    idempotencyKey: string,
  ): Promise<
    | { readonly status: "appended" }
    | { readonly status: "duplicate-ignored" }
    | { readonly status: "idempotency-collision" }
  >;
}

export interface TutorV2BridgeDependencies {
  readonly permission: StudyTutorInvocationPermissionPort;
  readonly safety: StudyTutorSafetyPort;
  readonly agePolicies: {
    resolve(binding: unknown):
      | { readonly status: "resolved"; readonly profile: AgeAwareTutorPolicyProfile }
      | {
          readonly status: "rejected";
          readonly code: string;
          readonly tutorMayProceed: false;
        };
  };
  readonly ageTurnInspector: StudyTutorAgeTurnInspectorPort;
  readonly staticFallback: StudyReviewedStaticFallbackPort;
  /**
   * Study-owned authority; this dependency is never disclosed to the provider.
   * Optional only for source compatibility with pre-B3 callers: omission fails
   * closed before provider execution and cannot authorize any content.
   */
  readonly reviewedContent?: ReviewedTutorContentAuthorityPort;
  readonly memory: TutorV2MemoryPort;
  readonly provider: TutorProviderPort;
  readonly eventLedger: TutorV2AcceptedEventLedgerPort;
  readonly now: () => number;
}

export interface LearnerSafeTutorActionProjection {
  readonly projectionKind: "learner-safe-tutor-action-proposal";
  readonly proposalRef: string;
  readonly interactionRef: string;
  readonly action: TutorAction;
  readonly assistanceLevel: TutorActionProposal["assistanceLevel"];
  readonly hintLevel: TutorActionProposal["hintLevel"];
  readonly groundingRefs: readonly string[];
  readonly authoritative: false;
  readonly requiresStudyValidation: true;
  readonly studyDecisionRequired: true;
}

export interface TutorAdultReviewHookProposal {
  readonly hookKind: "study-adult-review-proposal";
  readonly hookRef: string;
  readonly interactionRef: string;
  readonly reasonCode: string;
  readonly deliveryStatus: "proposed-not-delivered";
  readonly directIdentifiersIncluded: false;
  readonly rawTutorContentIncluded: false;
}

export type CanonicalBridgeFallbackReason =
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "MALFORMED_RESPONSE"
  | "UNSUPPORTED_ACTION"
  | "INSUFFICIENT_GROUNDED_CONTEXT"
  | "POLICY_REJECTION";

export interface ProviderFailureDetail {
  readonly status:
    | "unavailable"
    | "timeout"
    | "malformed-response"
    | "rejected-response"
    | "over-budget"
    | "transient-failure"
    | "permanent-failure";
  readonly reason: string;
  readonly retryable: boolean;
}

export type TutorV2BridgeResult =
  | {
      readonly status: "accepted";
      readonly requestRef: string;
      readonly proposal: LearnerSafeTutorActionProjection;
      readonly evidence: DurableTutorEvidence;
      readonly adultReviewHook: TutorAdultReviewHookProposal | null;
      readonly providerCallCount: 1;
      readonly studyMutationAllowed: false;
    }
  | {
      readonly status: "fallback";
      readonly requestRef: string | null;
      readonly reasonCode: CanonicalBridgeFallbackReason;
      readonly fallbackRef: string;
      readonly fallback: LearnerSafeTutorActionProjection | null;
      readonly evidence: DurableTutorEvidence | null;
      readonly providerDetail: ProviderFailureDetail | null;
      readonly providerCallCount: 0 | 1;
      readonly studyMutationAllowed: false;
    }
  | {
      readonly status: "duplicate-ignored";
      readonly requestRef: string;
      readonly evidenceReturned: false;
      readonly proposalReturned: false;
      readonly providerCallCount: 1;
      readonly studyMutationAllowed: false;
    }
  | {
      readonly status: "quarantined";
      readonly requestRef: string | null;
      readonly reasonCode: "EVENT_ID_COLLISION" | "LEDGER_FAILURE";
      readonly evidenceReturned: false;
      readonly proposalReturned: false;
      readonly providerCallCount: 0 | 1;
      readonly studyMutationAllowed: false;
    }
  | {
      readonly status: "safety-stop";
      readonly requestRef: string;
      readonly reasonCode:
        | "SAFETY_CLEARANCE_REJECTED"
        | "SAFETY_CLASSIFIER_UNAVAILABLE"
        | "SAFETY_CLEARANCE_REPLAYED";
      readonly adultReviewHook: TutorAdultReviewHookProposal | null;
      readonly providerCallCount: 0;
      readonly studyMutationAllowed: false;
    };

export interface NormalizedProviderOutcome {
  readonly result: ProviderExecutionResult | null;
  readonly detail: ProviderFailureDetail | null;
  readonly malformed: boolean;
}

export interface TutorV2BridgeResolvedContext {
  readonly invocation: TutorV2BridgeInvocation;
  readonly request: TutorRequest;
  readonly memory: TutorSessionMemoryState;
  readonly ageProfile: AgeAwareTutorPolicyProfile;
  readonly providerContext: MinimizedProviderContext;
  readonly inspectedTurnPlan?: TutorTurnPolicyPlan;
}
