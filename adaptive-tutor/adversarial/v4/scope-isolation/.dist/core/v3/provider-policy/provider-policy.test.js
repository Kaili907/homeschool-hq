import assert from "node:assert/strict";
import test from "node:test";
import { createTrustedProviderProfileRegistry, evaluateProviderEligibility, } from "./index.js";
function approvedProfile() {
    return {
        providerRef: "provider:approved-fixture",
        trainingUse: "prohibited",
        retention: { class: "transient", maximumDurationHours: 24 },
        minorDataEligibility: "supported",
        dataResidency: { approvedRegions: ["us-east"] },
        dataDeletionCapability: "supported",
        multimodalEligibility: "approved",
        contractPolicyRevision: "contract-policy:2026-08-r1",
        policyEvidenceRef: "provider-policy-evidence:approved-fixture-r1",
        policyEvidenceValidUntil: "2027-01-01T00:00:00.000Z",
        status: "active",
    };
}
function requirements() {
    return {
        providerRef: "provider:approved-fixture",
        allowedRetentionClasses: ["none", "transient"],
        maximumRetentionHours: 24,
        requiredRegion: "us-east",
        modality: "multimodal",
        requiredContractPolicyRevision: "contract-policy:2026-08-r1",
        evaluatedAt: "2026-08-15T16:00:00.000Z",
    };
}
function evaluate(profile, policy = requirements()) {
    return evaluateProviderEligibility(createTrustedProviderProfileRegistry([profile]), policy);
}
test("unknown retention requires static fallback", () => {
    const profile = {
        ...approvedProfile(),
        retention: { class: "unknown", maximumDurationHours: null },
    };
    const result = evaluate(profile);
    assert.equal(result.decision, "static-fallback-required");
    assert.deepEqual(result.reasons, ["retention-class-unknown", "retention-duration-unknown"]);
});
test("training enabled is ineligible", () => {
    const profile = { ...approvedProfile(), trainingUse: "allowed" };
    const result = evaluate(profile);
    assert.equal(result.decision, "ineligible");
    assert.deepEqual(result.reasons, ["training-use-allowed"]);
});
test("minor data unsupported is ineligible", () => {
    const profile = {
        ...approvedProfile(),
        minorDataEligibility: "unsupported",
    };
    const result = evaluate(profile);
    assert.equal(result.decision, "ineligible");
    assert.deepEqual(result.reasons, ["minor-data-unsupported"]);
});
test("wrong data-residency region is ineligible", () => {
    const profile = {
        ...approvedProfile(),
        dataResidency: { approvedRegions: ["us-west"] },
    };
    const result = evaluate(profile);
    assert.equal(result.decision, "ineligible");
    assert.deepEqual(result.reasons, ["region-not-approved"]);
});
test("expired policy evidence requires static fallback", () => {
    const profile = {
        ...approvedProfile(),
        policyEvidenceValidUntil: requirements().evaluatedAt,
    };
    const result = evaluate(profile);
    assert.equal(result.decision, "static-fallback-required");
    assert.deepEqual(result.reasons, ["policy-evidence-expired"]);
});
test("multimodal not approved is ineligible", () => {
    const profile = {
        ...approvedProfile(),
        multimodalEligibility: "not-approved",
    };
    const result = evaluate(profile);
    assert.equal(result.decision, "ineligible");
    assert.deepEqual(result.reasons, ["multimodal-not-approved"]);
});
test("policy revision mismatch requires static fallback", () => {
    const profile = {
        ...approvedProfile(),
        contractPolicyRevision: "contract-policy:2026-07-r9",
    };
    const result = evaluate(profile);
    assert.equal(result.decision, "static-fallback-required");
    assert.deepEqual(result.reasons, ["policy-revision-mismatch"]);
});
test("all requirements satisfied is eligible", () => {
    const result = evaluate(approvedProfile());
    assert.deepEqual(result, {
        decision: "eligible",
        providerRef: "provider:approved-fixture",
        providerPolicyRevisionRef: "contract-policy:2026-08-r1",
        providerPolicyEvidenceRef: "provider-policy-evidence:approved-fixture-r1",
        evaluatedAt: "2026-08-15T16:00:00.000Z",
        reasons: [],
    });
});
test("unknown trusted profile defaults to static fallback", () => {
    const registry = createTrustedProviderProfileRegistry([]);
    const result = evaluateProviderEligibility(registry, requirements());
    assert.equal(result.decision, "static-fallback-required");
    assert.deepEqual(result.reasons, ["trusted-profile-not-found"]);
});
test("every unknown required profile field requires static fallback", () => {
    const profiles = [
        { ...approvedProfile(), status: "unknown" },
        { ...approvedProfile(), trainingUse: "unknown" },
        { ...approvedProfile(), minorDataEligibility: "unknown" },
        { ...approvedProfile(), dataResidency: { approvedRegions: null } },
        { ...approvedProfile(), dataDeletionCapability: "unknown" },
        { ...approvedProfile(), multimodalEligibility: "unknown" },
        { ...approvedProfile(), contractPolicyRevision: null },
        { ...approvedProfile(), policyEvidenceRef: null },
        { ...approvedProfile(), policyEvidenceValidUntil: null },
    ];
    for (const profile of profiles) {
        assert.equal(evaluate(profile).decision, "static-fallback-required");
    }
});
test("retention duration over the request bound is ineligible", () => {
    const profile = {
        ...approvedProfile(),
        retention: { class: "transient", maximumDurationHours: 25 },
    };
    const result = evaluate(profile);
    assert.equal(result.decision, "ineligible");
    assert.deepEqual(result.reasons, ["retention-duration-exceeds-bound"]);
});
test("deletion unsupported and suspended status are explicit ineligibility", () => {
    const profile = {
        ...approvedProfile(),
        dataDeletionCapability: "unsupported",
        status: "suspended",
    };
    const result = evaluate(profile);
    assert.equal(result.decision, "ineligible");
    assert.deepEqual(result.reasons, ["provider-not-active", "data-deletion-unsupported"]);
});
test("registry snapshots profiles so later provider-shaped mutation cannot self-authorize", () => {
    const profile = {
        ...approvedProfile(),
        trainingUse: "allowed",
    };
    const registry = createTrustedProviderProfileRegistry([profile]);
    profile.trainingUse = "prohibited";
    const result = evaluateProviderEligibility(registry, requirements());
    assert.equal(result.decision, "ineligible");
    assert.deepEqual(result.reasons, ["training-use-allowed"]);
});
