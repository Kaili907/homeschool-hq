import type {
  KnownRetentionClass,
  ProviderEligibilityDecision,
  ProviderEligibilityReason,
  ProviderEligibilityRequirements,
  TrustedProviderProfile,
} from "./contracts.js";
import type { TrustedProviderProfileRegistry } from "./registry.js";

const CANONICAL_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function instantMilliseconds(value: string): number | null {
  if (!CANONICAL_INSTANT.test(value)) return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  return new Date(milliseconds).toISOString() === value ? milliseconds : null;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validRetentionClass(value: string): value is KnownRetentionClass {
  return value === "none" || value === "transient" || value === "bounded";
}

function requirementsAreValid(requirements: ProviderEligibilityRequirements): boolean {
  return nonEmpty(requirements.providerRef)
    && nonEmpty(requirements.requiredRegion)
    && nonEmpty(requirements.requiredContractPolicyRevision)
    && (requirements.modality === "text" || requirements.modality === "multimodal")
    && instantMilliseconds(requirements.evaluatedAt) !== null
    && Number.isSafeInteger(requirements.maximumRetentionHours)
    && requirements.maximumRetentionHours >= 0
    && requirements.allowedRetentionClasses.length > 0
    && requirements.allowedRetentionClasses.every(validRetentionClass);
}

function decision(
  kind: ProviderEligibilityDecision["decision"],
  providerRef: string,
  reasons: readonly ProviderEligibilityReason[],
): ProviderEligibilityDecision {
  return Object.freeze({
    decision: kind,
    providerRef,
    reasons: Object.freeze([...reasons]),
  });
}

function unknownOrUntrustedReasons(
  profile: TrustedProviderProfile,
  requirements: ProviderEligibilityRequirements,
): ProviderEligibilityReason[] {
  const reasons: ProviderEligibilityReason[] = [];
  if (
    profile.status !== "active"
    && profile.status !== "suspended"
    && profile.status !== "retired"
  ) {
    reasons.push("provider-status-unknown");
  }
  if (profile.trainingUse !== "prohibited" && profile.trainingUse !== "allowed") {
    reasons.push("training-use-unknown");
  }
  if (!validRetentionClass(profile.retention.class)) reasons.push("retention-class-unknown");
  if (
    profile.retention.maximumDurationHours === null
    || !Number.isSafeInteger(profile.retention.maximumDurationHours)
    || profile.retention.maximumDurationHours < 0
  ) {
    reasons.push("retention-duration-unknown");
  }
  if (
    profile.minorDataEligibility !== "supported"
    && profile.minorDataEligibility !== "unsupported"
  ) {
    reasons.push("minor-data-eligibility-unknown");
  }
  if (
    profile.dataResidency.approvedRegions === null
    || !profile.dataResidency.approvedRegions.every(nonEmpty)
  ) {
    reasons.push("data-residency-unknown");
  }
  if (
    profile.dataDeletionCapability !== "supported"
    && profile.dataDeletionCapability !== "unsupported"
  ) {
    reasons.push("data-deletion-capability-unknown");
  }
  if (
    requirements.modality === "multimodal"
    && profile.multimodalEligibility !== "approved"
    && profile.multimodalEligibility !== "not-approved"
  ) {
    reasons.push("multimodal-eligibility-unknown");
  }
  if (profile.contractPolicyRevision === null || !nonEmpty(profile.contractPolicyRevision)) {
    reasons.push("contract-policy-revision-unknown");
  }
  if (profile.policyEvidenceValidUntil === null) {
    reasons.push("policy-evidence-expiration-unknown");
  } else {
    const expiration = instantMilliseconds(profile.policyEvidenceValidUntil);
    const evaluatedAt = instantMilliseconds(requirements.evaluatedAt);
    if (expiration === null) {
      reasons.push("policy-evidence-expiration-invalid");
    } else if (evaluatedAt !== null && evaluatedAt >= expiration) {
      reasons.push("policy-evidence-expired");
    }
  }
  if (
    profile.contractPolicyRevision !== null
    && nonEmpty(profile.contractPolicyRevision)
    && profile.contractPolicyRevision !== requirements.requiredContractPolicyRevision
  ) {
    reasons.push("policy-revision-mismatch");
  }
  return reasons;
}

function explicitIneligibilityReasons(
  profile: TrustedProviderProfile,
  requirements: ProviderEligibilityRequirements,
): ProviderEligibilityReason[] {
  const reasons: ProviderEligibilityReason[] = [];
  if (profile.status !== "active" && profile.status !== "unknown") {
    reasons.push("provider-not-active");
  }
  if (profile.trainingUse === "allowed") reasons.push("training-use-allowed");
  if (
    profile.retention.class !== "unknown"
    && !requirements.allowedRetentionClasses.includes(profile.retention.class)
  ) {
    reasons.push("retention-class-not-approved");
  }
  if (
    profile.retention.maximumDurationHours !== null
    && Number.isSafeInteger(profile.retention.maximumDurationHours)
    && profile.retention.maximumDurationHours >= 0
    && profile.retention.maximumDurationHours > requirements.maximumRetentionHours
  ) {
    reasons.push("retention-duration-exceeds-bound");
  }
  if (profile.minorDataEligibility === "unsupported") reasons.push("minor-data-unsupported");
  if (
    profile.dataResidency.approvedRegions !== null
    && !profile.dataResidency.approvedRegions.includes(requirements.requiredRegion)
  ) {
    reasons.push("region-not-approved");
  }
  if (profile.dataDeletionCapability === "unsupported") {
    reasons.push("data-deletion-unsupported");
  }
  if (requirements.modality === "multimodal" && profile.multimodalEligibility === "not-approved") {
    reasons.push("multimodal-not-approved");
  }
  return reasons;
}

/**
 * Deterministically evaluates host-owned governance evidence. No provider
 * response or provider-declared eligibility value is accepted by this API.
 */
export function evaluateProviderEligibility(
  registry: TrustedProviderProfileRegistry,
  requirements: ProviderEligibilityRequirements,
): ProviderEligibilityDecision {
  if (!requirementsAreValid(requirements)) {
    return decision(
      "static-fallback-required",
      requirements.providerRef,
      ["invalid-eligibility-requirements"],
    );
  }

  const profile = registry.lookup(requirements.providerRef);
  if (profile === undefined) {
    return decision(
      "static-fallback-required",
      requirements.providerRef,
      ["trusted-profile-not-found"],
    );
  }

  const fallbackReasons = unknownOrUntrustedReasons(profile, requirements);
  if (fallbackReasons.length > 0) {
    return decision("static-fallback-required", requirements.providerRef, fallbackReasons);
  }

  const ineligibilityReasons = explicitIneligibilityReasons(profile, requirements);
  if (ineligibilityReasons.length > 0) {
    return decision("ineligible", requirements.providerRef, ineligibilityReasons);
  }

  return decision("eligible", requirements.providerRef, []);
}
