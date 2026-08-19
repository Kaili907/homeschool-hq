import { MAXIMUM_ALLOWED_RETENTION_CLASSES, MAXIMUM_PROVIDER_POLICY_REQUIREMENTS, } from "./contracts.js";
const CANONICAL_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const OPAQUE_REFERENCE = /^[a-z][a-z0-9-]{1,31}:[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/;
function instantMilliseconds(value) {
    if (!CANONICAL_INSTANT.test(value))
        return null;
    const milliseconds = Date.parse(value);
    if (!Number.isFinite(milliseconds))
        return null;
    return new Date(milliseconds).toISOString() === value ? milliseconds : null;
}
function nonEmpty(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function validRetentionClass(value) {
    return value === "none" || value === "transient" || value === "bounded";
}
function requirementsAreValid(requirements) {
    return nonEmpty(requirements.providerRef)
        && requirements.providerRef.length <= 160
        && nonEmpty(requirements.requiredRegion)
        && requirements.requiredRegion.length <= 80
        && nonEmpty(requirements.requiredContractPolicyRevision)
        && requirements.requiredContractPolicyRevision.length <= 160
        && (requirements.modality === "text" || requirements.modality === "multimodal")
        && instantMilliseconds(requirements.evaluatedAt) !== null
        && Number.isSafeInteger(requirements.maximumRetentionHours)
        && requirements.maximumRetentionHours >= 0
        && requirements.allowedRetentionClasses.length > 0
        && requirements.allowedRetentionClasses.length <= MAXIMUM_ALLOWED_RETENTION_CLASSES
        && new Set(requirements.allowedRetentionClasses).size ===
            requirements.allowedRetentionClasses.length
        && requirements.allowedRetentionClasses.every(validRetentionClass);
}
/** Cheap cardinality gate that runs before any map/filter traversal. */
export function providerEligibilityRequirementsAreBounded(candidate) {
    if (!Array.isArray(candidate) ||
        candidate.length > MAXIMUM_PROVIDER_POLICY_REQUIREMENTS) {
        return false;
    }
    const providerRefs = new Set();
    for (const value of candidate) {
        if (typeof value !== "object" || value === null)
            return false;
        const requirement = value;
        if (!Array.isArray(requirement.allowedRetentionClasses))
            return false;
        if (!requirementsAreValid(requirement) || providerRefs.has(requirement.providerRef)) {
            return false;
        }
        providerRefs.add(requirement.providerRef);
    }
    return true;
}
function decision(kind, providerRef, reasons, profile, evaluatedAt) {
    return Object.freeze({
        decision: kind,
        providerRef,
        providerPolicyRevisionRef: profile?.contractPolicyRevision ?? null,
        providerPolicyEvidenceRef: profile?.policyEvidenceRef ?? null,
        evaluatedAt,
        reasons: Object.freeze([...reasons]),
    });
}
function unknownOrUntrustedReasons(profile, requirements) {
    const reasons = [];
    if (profile.status !== "active"
        && profile.status !== "suspended"
        && profile.status !== "retired") {
        reasons.push("provider-status-unknown");
    }
    if (profile.trainingUse !== "prohibited" && profile.trainingUse !== "allowed") {
        reasons.push("training-use-unknown");
    }
    if (!validRetentionClass(profile.retention.class))
        reasons.push("retention-class-unknown");
    if (profile.retention.maximumDurationHours === null
        || !Number.isSafeInteger(profile.retention.maximumDurationHours)
        || profile.retention.maximumDurationHours < 0) {
        reasons.push("retention-duration-unknown");
    }
    if (profile.minorDataEligibility !== "supported"
        && profile.minorDataEligibility !== "unsupported") {
        reasons.push("minor-data-eligibility-unknown");
    }
    if (profile.dataResidency.approvedRegions === null
        || !profile.dataResidency.approvedRegions.every(nonEmpty)) {
        reasons.push("data-residency-unknown");
    }
    if (profile.dataDeletionCapability !== "supported"
        && profile.dataDeletionCapability !== "unsupported") {
        reasons.push("data-deletion-capability-unknown");
    }
    if (requirements.modality === "multimodal"
        && profile.multimodalEligibility !== "approved"
        && profile.multimodalEligibility !== "not-approved") {
        reasons.push("multimodal-eligibility-unknown");
    }
    if (profile.contractPolicyRevision === null || !nonEmpty(profile.contractPolicyRevision)) {
        reasons.push("contract-policy-revision-unknown");
    }
    if (profile.policyEvidenceRef === null ||
        profile.policyEvidenceRef.length > 160 ||
        !OPAQUE_REFERENCE.test(profile.policyEvidenceRef)) {
        reasons.push("policy-evidence-ref-unknown");
    }
    if (profile.policyEvidenceValidUntil === null) {
        reasons.push("policy-evidence-expiration-unknown");
    }
    else {
        const expiration = instantMilliseconds(profile.policyEvidenceValidUntil);
        const evaluatedAt = instantMilliseconds(requirements.evaluatedAt);
        if (expiration === null) {
            reasons.push("policy-evidence-expiration-invalid");
        }
        else if (evaluatedAt !== null && evaluatedAt >= expiration) {
            reasons.push("policy-evidence-expired");
        }
    }
    if (profile.contractPolicyRevision !== null
        && nonEmpty(profile.contractPolicyRevision)
        && profile.contractPolicyRevision !== requirements.requiredContractPolicyRevision) {
        reasons.push("policy-revision-mismatch");
    }
    return reasons;
}
function explicitIneligibilityReasons(profile, requirements) {
    const reasons = [];
    if (profile.status !== "active" && profile.status !== "unknown") {
        reasons.push("provider-not-active");
    }
    if (profile.trainingUse === "allowed")
        reasons.push("training-use-allowed");
    if (profile.retention.class !== "unknown"
        && !requirements.allowedRetentionClasses.includes(profile.retention.class)) {
        reasons.push("retention-class-not-approved");
    }
    if (profile.retention.maximumDurationHours !== null
        && Number.isSafeInteger(profile.retention.maximumDurationHours)
        && profile.retention.maximumDurationHours >= 0
        && profile.retention.maximumDurationHours > requirements.maximumRetentionHours) {
        reasons.push("retention-duration-exceeds-bound");
    }
    if (profile.minorDataEligibility === "unsupported")
        reasons.push("minor-data-unsupported");
    if (profile.dataResidency.approvedRegions !== null
        && !profile.dataResidency.approvedRegions.includes(requirements.requiredRegion)) {
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
export function evaluateProviderEligibility(registry, requirements) {
    if (!requirementsAreValid(requirements)) {
        return decision("static-fallback-required", requirements.providerRef, ["invalid-eligibility-requirements"], null, null);
    }
    const profile = registry.lookup(requirements.providerRef);
    if (profile === undefined) {
        return decision("static-fallback-required", requirements.providerRef, ["trusted-profile-not-found"], null, requirements.evaluatedAt);
    }
    const fallbackReasons = unknownOrUntrustedReasons(profile, requirements);
    if (fallbackReasons.length > 0) {
        return decision("static-fallback-required", requirements.providerRef, fallbackReasons, profile, requirements.evaluatedAt);
    }
    const ineligibilityReasons = explicitIneligibilityReasons(profile, requirements);
    if (ineligibilityReasons.length > 0) {
        return decision("ineligible", requirements.providerRef, ineligibilityReasons, profile, requirements.evaluatedAt);
    }
    return decision("eligible", requirements.providerRef, [], profile, requirements.evaluatedAt);
}
