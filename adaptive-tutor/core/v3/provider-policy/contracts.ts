export type ProviderEligibilityDecisionKind =
  | "eligible"
  | "ineligible"
  | "static-fallback-required";

export type TrainingUsePolicy = "prohibited" | "allowed" | "unknown";
export type RetentionClass = "none" | "transient" | "bounded" | "unknown";
export type KnownRetentionClass = Exclude<RetentionClass, "unknown">;
export type MinorDataEligibility = "supported" | "unsupported" | "unknown";
export type DataDeletionCapability = "supported" | "unsupported" | "unknown";
export type MultimodalEligibility = "approved" | "not-approved" | "unknown";
export type ProviderStatus = "active" | "suspended" | "retired" | "unknown";

/**
 * Host-owned governance evidence. Provider responses must never be accepted as
 * this profile or as an eligibility decision.
 */
export interface TrustedProviderProfile {
  readonly providerRef: string;
  readonly trainingUse: TrainingUsePolicy;
  readonly retention: {
    readonly class: RetentionClass;
    /** A null bound is unknown and therefore cannot authorize minor data. */
    readonly maximumDurationHours: number | null;
  };
  readonly minorDataEligibility: MinorDataEligibility;
  readonly dataResidency: {
    /** Null means capability evidence is unknown; an empty list means no approved region. */
    readonly approvedRegions: readonly string[] | null;
  };
  readonly dataDeletionCapability: DataDeletionCapability;
  readonly multimodalEligibility: MultimodalEligibility;
  /** Jointly pins the reviewed provider contract and privacy-policy revision. */
  readonly contractPolicyRevision: string | null;
  /** Exclusive validity boundary, expressed as a canonical ISO-8601 instant. */
  readonly policyEvidenceValidUntil: string | null;
  readonly status: ProviderStatus;
}

export interface ProviderEligibilityRequirements {
  readonly providerRef: string;
  readonly allowedRetentionClasses: readonly KnownRetentionClass[];
  readonly maximumRetentionHours: number;
  readonly requiredRegion: string;
  readonly modality: "text" | "multimodal";
  readonly requiredContractPolicyRevision: string;
  /** Caller-supplied canonical instant; evaluation never reads the system clock. */
  readonly evaluatedAt: string;
}

export type ProviderEligibilityReason =
  | "invalid-eligibility-requirements"
  | "trusted-profile-not-found"
  | "provider-status-unknown"
  | "training-use-unknown"
  | "retention-class-unknown"
  | "retention-duration-unknown"
  | "minor-data-eligibility-unknown"
  | "data-residency-unknown"
  | "data-deletion-capability-unknown"
  | "multimodal-eligibility-unknown"
  | "contract-policy-revision-unknown"
  | "policy-evidence-expiration-unknown"
  | "policy-evidence-expiration-invalid"
  | "policy-evidence-expired"
  | "policy-revision-mismatch"
  | "provider-not-active"
  | "training-use-allowed"
  | "retention-class-not-approved"
  | "retention-duration-exceeds-bound"
  | "minor-data-unsupported"
  | "region-not-approved"
  | "data-deletion-unsupported"
  | "multimodal-not-approved";

export interface ProviderEligibilityDecision {
  readonly decision: ProviderEligibilityDecisionKind;
  readonly providerRef: string;
  readonly reasons: readonly ProviderEligibilityReason[];
}
