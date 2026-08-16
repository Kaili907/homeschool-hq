import { Type, type Static, type TSchema } from "../../schema/typebox.js";
import {
  AssessmentPhaseSchema,
  AssistanceLevelSchema,
  ContentDigestSchema,
  OpaqueReferenceSchema,
} from "../../v2/contracts/primitives.js";

export const COMMERCIAL_PROVIDER_REQUEST_VERSION =
  "study-tutor-v2.commercial-provider-request.v1" as const;

export const COMMERCIAL_ACTION_FAMILIES = [
  "EXPLANATION",
  "HINT",
  "GUIDING_QUESTION",
  "GROUNDED_EXAMPLE",
  "PREREQUISITE_RECOMMENDATION",
  "PARENT_SAFE_DRAFT",
] as const;
export type CommercialActionFamily = (typeof COMMERCIAL_ACTION_FAMILIES)[number];

export const COMMERCIAL_ACADEMIC_SIGNAL_CODES = [
  "NO_ATTEMPT_EVIDENCE",
  "ATTEMPT_INCORRECT",
  "ATTEMPT_PARTIAL",
  "ATTEMPT_CORRECT",
  "MISCONCEPTION_IDENTIFIED",
  "RECHECK_NEEDED",
  "RECHECK_COMPLETED",
  "ASSISTANCE_USED",
] as const;
export type CommercialAcademicSignalCode =
  (typeof COMMERCIAL_ACADEMIC_SIGNAL_CODES)[number];

export const COMMERCIAL_COMPLETION_SIGNALS = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
] as const;
export type CommercialCompletionSignal = (typeof COMMERCIAL_COMPLETION_SIGNALS)[number];

export const COMMERCIAL_RECHECK_SIGNALS = [
  "NOT_REQUESTED",
  "REQUESTED",
  "COMPLETED",
] as const;
export type CommercialRecheckSignal = (typeof COMMERCIAL_RECHECK_SIGNALS)[number];

export const COMMERCIAL_PRESENTATION_REQUIREMENTS = [
  "TEXT_ONLY",
  "REVIEWED_VISUAL_REFERENCE",
] as const;
export type CommercialPresentationRequirement =
  (typeof COMMERCIAL_PRESENTATION_REQUIREMENTS)[number];

function literalUnion<const Values extends readonly string[]>(
  values: Values,
): TSchema<Values[number]> {
  return Type.Union(values.map((value) => Type.Literal(value))) as TSchema<Values[number]>;
}

const CommercialActionFamilySchema = literalUnion(COMMERCIAL_ACTION_FAMILIES);
const CommercialAcademicSignalCodeSchema = literalUnion(COMMERCIAL_ACADEMIC_SIGNAL_CODES);
const CommercialCompletionSignalSchema = literalUnion(COMMERCIAL_COMPLETION_SIGNALS);
const CommercialRecheckSignalSchema = literalUnion(COMMERCIAL_RECHECK_SIGNALS);
const CommercialPresentationRequirementSchema = literalUnion(
  COMMERCIAL_PRESENTATION_REQUIREMENTS,
);

const AttemptOrdinalSchema = Type.Integer({ minimum: 1, maximum: 100 });
const AttemptCountSchema = Type.Integer({ minimum: 1, maximum: 100 });

export const CommercialAcademicScopeSchema = Type.Object(
  {
    subjectRef: OpaqueReferenceSchema,
    courseRef: Type.Optional(Type.Union([OpaqueReferenceSchema])),
    conceptRef: OpaqueReferenceSchema,
  },
  { additionalProperties: false },
);
export type CommercialAcademicScope = Static<typeof CommercialAcademicScopeSchema>;

export const CommercialStructuredAttemptEvidenceSchema = Type.Object(
  {
    attemptRef: OpaqueReferenceSchema,
    attemptOrdinal: AttemptOrdinalSchema,
    attemptCount: AttemptCountSchema,
    assistanceLevel: AssistanceLevelSchema,
    academicSignalCodes: Type.Array(CommercialAcademicSignalCodeSchema, {
      minItems: 1,
      maxItems: 8,
    }),
    misconceptionRefs: Type.Array(OpaqueReferenceSchema, { maxItems: 4 }),
    completionSignal: CommercialCompletionSignalSchema,
    recheckSignal: CommercialRecheckSignalSchema,
  },
  { additionalProperties: false },
);
export type CommercialStructuredAttemptEvidence = Static<
  typeof CommercialStructuredAttemptEvidenceSchema
>;

export const CommercialReviewedContentEvidenceSchema = Type.Object(
  {
    contentRef: OpaqueReferenceSchema,
    contentDigest: ContentDigestSchema,
  },
  { additionalProperties: false },
);
export type CommercialReviewedContentEvidence = Static<
  typeof CommercialReviewedContentEvidenceSchema
>;

export const CommercialGroundingEvidenceSchema = Type.Object(
  {
    groundingRef: OpaqueReferenceSchema,
    contentDigest: ContentDigestSchema,
  },
  { additionalProperties: false },
);
export type CommercialGroundingEvidence = Static<typeof CommercialGroundingEvidenceSchema>;

export const CommercialProviderPolicyReferencesSchema = Type.Object(
  {
    learnerStagePolicyRef: OpaqueReferenceSchema,
    providerPolicyRef: OpaqueReferenceSchema,
    configurationRef: OpaqueReferenceSchema,
    safetyPolicyRef: OpaqueReferenceSchema,
    presentationPolicyRef: OpaqueReferenceSchema,
  },
  { additionalProperties: false },
);
export type CommercialProviderPolicyReferences = Static<
  typeof CommercialProviderPolicyReferencesSchema
>;

/**
 * Trusted means that Study, rather than a provider, authored these facts. The
 * runtime boundary still validates this exact shape before projecting it.
 */
export const TrustedStudyCommercialInvocationFactsSchema = Type.Object(
  {
    factsKind: Type.Literal("trusted-study-commercial-invocation-facts"),
    invocationRef: OpaqueReferenceSchema,
    logicalOperationRef: OpaqueReferenceSchema,
    academicScope: CommercialAcademicScopeSchema,
    actionFamily: CommercialActionFamilySchema,
    assessmentPhase: AssessmentPhaseSchema,
    attemptEvidence: Type.Optional(
      Type.Union([CommercialStructuredAttemptEvidenceSchema]),
    ),
    reviewedContentEvidence: Type.Array(CommercialReviewedContentEvidenceSchema, {
      minItems: 1,
      maxItems: 12,
    }),
    groundingEvidence: Type.Array(CommercialGroundingEvidenceSchema, {
      minItems: 1,
      maxItems: 12,
    }),
    presentationRequirement: CommercialPresentationRequirementSchema,
    policyRefs: CommercialProviderPolicyReferencesSchema,
  },
  { additionalProperties: false, $id: "TrustedStudyCommercialInvocationFacts" },
);
export type TrustedStudyCommercialInvocationFacts = Static<
  typeof TrustedStudyCommercialInvocationFactsSchema
>;

/**
 * The sole commercial-provider-visible request. It has no prose-bearing
 * property and carries no answer, transcript, media payload, or credential.
 */
export const BoundedCommercialProviderRequestSchema = Type.Object(
  {
    requestVersion: Type.Literal(COMMERCIAL_PROVIDER_REQUEST_VERSION),
    requestKind: Type.Literal("bounded-commercial-provider-request"),
    invocationRef: OpaqueReferenceSchema,
    logicalOperationRef: OpaqueReferenceSchema,
    academicScope: CommercialAcademicScopeSchema,
    learnerStagePolicyRef: OpaqueReferenceSchema,
    actionFamily: CommercialActionFamilySchema,
    assessmentPhase: AssessmentPhaseSchema,
    attemptEvidence: Type.Optional(
      Type.Union([CommercialStructuredAttemptEvidenceSchema]),
    ),
    reviewedContentEvidence: Type.Array(CommercialReviewedContentEvidenceSchema, {
      minItems: 1,
      maxItems: 12,
    }),
    groundingEvidence: Type.Array(CommercialGroundingEvidenceSchema, {
      minItems: 1,
      maxItems: 12,
    }),
    presentationRequirement: CommercialPresentationRequirementSchema,
    providerPolicyRef: OpaqueReferenceSchema,
    configurationRef: OpaqueReferenceSchema,
    safetyPolicyRef: OpaqueReferenceSchema,
    presentationPolicyRef: OpaqueReferenceSchema,
    disclosureBoundary: Type.Literal("STUDY_DERIVED_STRUCTURED_EVIDENCE_ONLY"),
    rawAttemptDisclosureAllowed: Type.Literal(false),
  },
  { additionalProperties: false, $id: "BoundedCommercialProviderRequest" },
);
export type BoundedCommercialProviderRequest = Static<
  typeof BoundedCommercialProviderRequestSchema
>;

export const COMMERCIAL_PROVIDER_REQUEST_REJECTION_REASON_CODES = [
  "INVALID_TRUSTED_STUDY_FACTS",
  "INCONSISTENT_ATTEMPT_EVIDENCE",
  "DUPLICATE_STRUCTURED_REFERENCE",
  "INVALID_COMMERCIAL_PROVIDER_REQUEST",
] as const;
export type CommercialProviderRequestRejectionReasonCode =
  (typeof COMMERCIAL_PROVIDER_REQUEST_REJECTION_REASON_CODES)[number];

export interface AcceptedCommercialProviderRequest {
  readonly status: "accepted-commercial-provider-request";
  readonly request: BoundedCommercialProviderRequest;
}

export interface CommercialProviderRequestRejected {
  readonly status: "provider-request-rejected";
  readonly reasonCode: CommercialProviderRequestRejectionReasonCode;
  readonly providerCallAllowed: false;
}

export type CommercialProviderRequestResult =
  | AcceptedCommercialProviderRequest
  | CommercialProviderRequestRejected;

export const COMMERCIAL_PROVIDER_RAW_ATTEMPT_DISCLOSURE_ALLOWED = false as const;
