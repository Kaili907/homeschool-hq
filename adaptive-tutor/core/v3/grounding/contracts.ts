import { Type, type Static } from "../../schema/typebox.js";
import { validateExact } from "../../v2/contracts/validation.js";
import {
  AssessmentPhaseSchema,
  ContentDigestSchema,
  OpaqueReferenceSchema,
} from "../../v2/contracts/primitives.js";

export const GROUNDING_CONTRACT_VERSION =
  "study-tutor-v2.grounding.v3" as const;
export const INSUFFICIENT_GROUNDED_CONTEXT =
  "INSUFFICIENT_GROUNDED_CONTEXT" as const;

export const GROUNDING_CONFIDENCE_CLASSES = [
  "sufficient",
  "partial",
  "insufficient",
] as const;
export type GroundingConfidence =
  (typeof GROUNDING_CONFIDENCE_CLASSES)[number];

export const GroundedContextItemSchema = Type.Object(
  {
    contextRef: OpaqueReferenceSchema,
    scopeRef: OpaqueReferenceSchema,
    contentDigest: ContentDigestSchema,
    materialKind: Type.Union([
      Type.Literal("instructional"),
      Type.Literal("static-fallback"),
    ]),
    reviewAuthority: Type.Literal("study"),
    reviewStatus: Type.Union([
      Type.Literal("study-reviewed"),
      Type.Literal("not-reviewed"),
    ]),
    validity: Type.Union([
      Type.Literal("valid"),
      Type.Literal("stale"),
      Type.Literal("invalid"),
    ]),
  },
  { additionalProperties: false, $id: "TutorV3GroundedContextItem" },
);
export type GroundedContextItem = Static<typeof GroundedContextItemSchema>;

export const GroundedContextBundleSchema = Type.Object(
  {
    contractVersion: Type.Literal(GROUNDING_CONTRACT_VERSION),
    bundleRef: OpaqueReferenceSchema,
    source: Type.Literal("study-authority"),
    scopeRef: OpaqueReferenceSchema,
    assessmentPhase: AssessmentPhaseSchema,
    items: Type.Array(GroundedContextItemSchema, { maxItems: 64 }),
    fallbackContextRef: Type.Union([OpaqueReferenceSchema, Type.Null()]),
  },
  { additionalProperties: false, $id: "TutorV3GroundedContextBundle" },
);
export type GroundedContextBundle = Static<typeof GroundedContextBundleSchema>;

export const RequiredContextReferenceSchema = Type.Object(
  {
    contextRef: OpaqueReferenceSchema,
    contentDigest: ContentDigestSchema,
  },
  { additionalProperties: false },
);
export type RequiredContextReference = Static<
  typeof RequiredContextReferenceSchema
>;

/**
 * A trusted Study-side declaration of what must support one material claim.
 * The provider cannot author or weaken this requirement.
 */
export const GroundingRequirementSchema = Type.Object(
  {
    claimRef: OpaqueReferenceSchema,
    scopeRef: OpaqueReferenceSchema,
    claimKind: Type.Union([
      Type.Literal("factual"),
      Type.Literal("instructional"),
    ]),
    requiredContext: Type.Array(RequiredContextReferenceSchema, {
      minItems: 1,
      maxItems: 16,
    }),
  },
  { additionalProperties: false, $id: "TutorV3GroundingRequirement" },
);
export type GroundingRequirement = Static<typeof GroundingRequirementSchema>;

/**
 * The complete untrusted provider contribution. Review, validity, digest,
 * scope, and confidence attestations are intentionally absent.
 */
export const GroundedClaimSchema = Type.Object(
  {
    claimRef: OpaqueReferenceSchema,
    supportRefs: Type.Array(OpaqueReferenceSchema, {
      minItems: 1,
      maxItems: 16,
    }),
  },
  { additionalProperties: false, $id: "TutorV3GroundedClaim" },
);
export type GroundedClaim = Static<typeof GroundedClaimSchema>;

export const GroundingRequirementsSchema = Type.Array(
  GroundingRequirementSchema,
  { maxItems: 32 },
);
export const GroundedClaimsSchema = Type.Array(GroundedClaimSchema, {
  maxItems: 32,
});

export const GROUNDING_ISSUE_CODES = [
  "active-assessment-anti-answer",
  "ambiguous-context-ref",
  "content-digest-mismatch",
  "context-invalid",
  "context-not-study-reviewed",
  "context-scope-mismatch",
  "context-stale",
  "duplicate-claim-ref",
  "duplicate-required-context-ref",
  "duplicate-support-ref",
  "malformed-context-bundle",
  "malformed-grounding-claims",
  "malformed-grounding-requirements",
  "missing-required-context-ref",
  "scope-binding-mismatch",
  "unexpected-content-ref",
  "unknown-claim-ref",
  "unknown-content-ref",
  "unsupported-material-claim",
] as const;
export type GroundingIssueCode = (typeof GROUNDING_ISSUE_CODES)[number];

export interface GroundingIssue {
  readonly code: GroundingIssueCode;
  /** Opaque identifier only; provider-authored prose is never reflected. */
  readonly ref: string | null;
}

export interface GroundingAssessment {
  readonly confidence: GroundingConfidence;
  readonly groundedClaimRefs: readonly string[];
  readonly unsupportedClaimRefs: readonly string[];
  readonly issues: readonly GroundingIssue[];
}

export interface ReviewedStaticFallback {
  readonly kind: "reviewed-static-material";
  readonly contextRef: string;
  readonly scopeRef: string;
  readonly contentDigest: string;
  readonly reviewAuthority: "study";
}

export interface GroundingAcceptedDecision {
  readonly status: "grounded";
  readonly proposalAllowed: true;
  readonly providerOverrideAllowed: false;
  readonly studyMutationAllowed: false;
  readonly answerAuthorityExposed: false;
  readonly assessment: GroundingAssessment & {
    readonly confidence: "sufficient";
  };
}

export interface RefusalDecision {
  readonly status: "refused";
  readonly code: typeof INSUFFICIENT_GROUNDED_CONTEXT;
  readonly proposalAllowed: false;
  readonly providerOverrideAllowed: false;
  readonly studyMutationAllowed: false;
  readonly answerAuthorityExposed: false;
  readonly assessment: GroundingAssessment;
  readonly fallback: ReviewedStaticFallback | null;
}

export type GroundingDecision = GroundingAcceptedDecision | RefusalDecision;

export function validateGroundedContextBundle(
  value: unknown,
): value is GroundedContextBundle {
  try {
    return validateExact(GroundedContextBundleSchema, value).status === "accepted";
  } catch {
    return false;
  }
}

export function validateGroundingRequirements(
  value: unknown,
): value is readonly GroundingRequirement[] {
  try {
    return validateExact(GroundingRequirementsSchema, value).status === "accepted";
  } catch {
    return false;
  }
}

export function validateGroundedClaims(
  value: unknown,
): value is readonly GroundedClaim[] {
  try {
    return validateExact(GroundedClaimsSchema, value).status === "accepted";
  } catch {
    return false;
  }
}
