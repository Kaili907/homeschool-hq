import assert from "node:assert/strict";
import test from "node:test";
import { APPROVED_LEARNER_STAGE_ROUTING_MAPPING, LEARNER_ROUTING_STAGE_CLASSES, LEARNER_STAGE_CATALOG_APPROVAL_REF, LEARNER_STAGE_CATALOG_BINDING_VERSION, LEARNER_STAGE_CATALOG_VERSION, LEARNER_STAGE_POLICY_REVISION_REF, SUPPORTED_LEARNER_STAGE_REFS, createCommercialLearnerStagePolicyCatalog, listApprovedLearnerStageCatalogProfiles, validateApprovedLearnerStageCatalogProfile, validateApprovedLearnerStageRoutingMapping, } from "./index.js";
function bindingFor(learnerStageRef, overrides = {}) {
    return {
        contractVersion: LEARNER_STAGE_CATALOG_BINDING_VERSION,
        bindingKind: "trusted-study-learner-stage-catalog-binding",
        bindingSource: "study-runtime",
        catalogVersion: LEARNER_STAGE_CATALOG_VERSION,
        policyRevisionRef: LEARNER_STAGE_POLICY_REVISION_REF,
        learnerStageRef,
        ...overrides,
    };
}
test("every committed catalog entry validates with every required policy dimension", () => {
    const profiles = listApprovedLearnerStageCatalogProfiles();
    assert.equal(profiles.length, SUPPORTED_LEARNER_STAGE_REFS.length);
    for (const profile of profiles) {
        assert.equal(validateApprovedLearnerStageCatalogProfile(profile), true);
        assert.equal(profile.catalogVersion, LEARNER_STAGE_CATALOG_VERSION);
        assert.equal(profile.policyRevisionRef, LEARNER_STAGE_POLICY_REVISION_REF);
        assert.equal(profile.approvalRef, LEARNER_STAGE_CATALOG_APPROVAL_REF);
        assert.ok(profile.profileRef.length > 0);
        assert.ok(profile.maximumResponseWords > 0);
        assert.ok(profile.maximumStepCount > 0);
        assert.ok(profile.maximumHintDepth.length > 0);
        assert.ok(profile.maximumInstructionalDensity.length > 0);
        assert.ok(profile.maximumVisualStepComplexity.length > 0);
        assert.ok(profile.breakPolicy.mode.length > 0);
        assert.ok(profile.multimodalAllowance.allowedModalities.length > 0);
        assert.ok(profile.adultReviewThreshold.maximumUnresolvedAttempts > 0);
        assert.ok(profile.adultReviewThreshold.maximumConsecutiveTutorTurnsWithoutResolution > 0);
    }
    const unapproved = structuredClone(profiles[0]);
    unapproved.maximumResponseWords = 61;
    assert.equal(validateApprovedLearnerStageCatalogProfile(unapproved), false);
});
test("every supported Study learner stage resolves through the canonical catalog", () => {
    const catalog = createCommercialLearnerStagePolicyCatalog();
    assert.equal(catalog.profileCount, SUPPORTED_LEARNER_STAGE_REFS.length);
    for (const learnerStageRef of SUPPORTED_LEARNER_STAGE_REFS) {
        const resolution = catalog.resolve(bindingFor(learnerStageRef));
        assert.equal(resolution.status, "resolved");
        if (resolution.status !== "resolved")
            continue;
        assert.equal(resolution.profile.learnerStageRef, learnerStageRef);
        assert.equal(resolution.profile.profileRef, resolution.policyProfile.policyProfileRef);
        assert.equal(resolution.profile.approvalRef, resolution.policyProfile.approvalRef);
        assert.equal(resolution.source, "study-canonical-catalog");
        assert.equal(resolution.authority.providerOverrideAllowed, false);
    }
});
test("unknown learner stage fails closed to reviewed static content", () => {
    const result = createCommercialLearnerStagePolicyCatalog().resolve(bindingFor("learner-stage:not-approved"));
    assert.equal(result.status, "static-fallback");
    if (result.status !== "static-fallback")
        return;
    assert.equal(result.reason, "UNKNOWN_LEARNER_STAGE");
    assert.equal(result.adaptiveTutorAllowed, false);
    assert.equal(result.providerInvocationAllowed, false);
    assert.equal(result.tutorMayProceed, false);
    assert.equal(result.fallback.approvalRef, LEARNER_STAGE_CATALOG_APPROVAL_REF);
});
test("catalog and policy revision mismatches fail closed", () => {
    const catalog = createCommercialLearnerStagePolicyCatalog();
    const catalogMismatch = catalog.resolve(bindingFor(SUPPORTED_LEARNER_STAGE_REFS[0], {
        catalogVersion: "study-tutor-v2.learner-stage-catalog.v0",
    }));
    const revisionMismatch = catalog.resolve(bindingFor(SUPPORTED_LEARNER_STAGE_REFS[0], {
        policyRevisionRef: "policy-revision:unapproved-v2",
    }));
    assert.equal(catalogMismatch.status, "static-fallback");
    assert.equal(revisionMismatch.status, "static-fallback");
    if (catalogMismatch.status === "static-fallback") {
        assert.equal(catalogMismatch.reason, "LEARNER_STAGE_CATALOG_VERSION_MISMATCH");
    }
    if (revisionMismatch.status === "static-fallback") {
        assert.equal(revisionMismatch.reason, "LEARNER_STAGE_POLICY_REVISION_MISMATCH");
    }
});
test("nominal grade, official working level, and curriculum grade are not learner stage", () => {
    const catalog = createCommercialLearnerStagePolicyCatalog();
    const trustedStage = SUPPORTED_LEARNER_STAGE_REFS[1];
    const authorityFields = [
        { nominalGrade: "grade:3" },
        { grade: "grade:3" },
        { officialWorkingLevel: "working-level:grade-1" },
        { workingLevel: "working-level:grade-1" },
        { curriculumGrade: "curriculum-grade:5" },
    ];
    for (const authorityField of authorityFields) {
        const result = catalog.resolve({ ...bindingFor(trustedStage), ...authorityField });
        assert.equal(result.status, "static-fallback");
        if (result.status === "static-fallback") {
            assert.equal(result.reason, "INVALID_LEARNER_STAGE_CATALOG_BINDING");
        }
    }
});
test("prose, voice, image, and behavior cannot infer or replace learner stage", () => {
    const catalog = createCommercialLearnerStagePolicyCatalog();
    const inferenceFields = [
        { learnerProse: "please make this easy" },
        { voice: "young-sounding" },
        { image: "image:learner-supplied" },
        { behavior: "hesitated" },
    ];
    for (const inferenceField of inferenceFields) {
        const result = catalog.resolve({
            ...bindingFor("learner-stage:not-approved"),
            ...inferenceField,
        });
        assert.equal(result.status, "static-fallback");
        if (result.status === "static-fallback") {
            assert.equal(result.reason, "INVALID_LEARNER_STAGE_CATALOG_BINDING");
        }
    }
});
test("provider-supplied profile and routing overrides cannot replace canonical policy", () => {
    const catalog = createCommercialLearnerStagePolicyCatalog();
    const stage = SUPPORTED_LEARNER_STAGE_REFS[0];
    const overrideAttempts = [
        { providerProfileRef: "stage-profile:secondary-v1" },
        { providerPolicyRevisionRef: "policy-revision:provider-selected" },
        { providerMaximumResponseWords: 1_200 },
        { providerRoutingStageClass: "SECONDARY" },
    ];
    for (const override of overrideAttempts) {
        const result = catalog.resolve({ ...bindingFor(stage), ...override });
        assert.equal(result.status, "static-fallback");
        if (result.status === "static-fallback") {
            assert.equal(result.reason, "INVALID_LEARNER_STAGE_CATALOG_BINDING");
            assert.equal(result.providerInvocationAllowed, false);
        }
    }
    const resolved = catalog.resolve(bindingFor(stage));
    assert.equal(resolved.status, "resolved");
    if (resolved.status === "resolved") {
        assert.equal(resolved.profile.maximumResponseWords, 60);
        assert.equal(resolved.routingStageClass, "EARLY_ELEMENTARY");
    }
});
test("reviewed learner-stage routing mapping is complete, unique, and deterministic", () => {
    assert.equal(APPROVED_LEARNER_STAGE_ROUTING_MAPPING.length, SUPPORTED_LEARNER_STAGE_REFS.length);
    assert.equal(APPROVED_LEARNER_STAGE_ROUTING_MAPPING.every(validateApprovedLearnerStageRoutingMapping), true);
    assert.deepEqual(APPROVED_LEARNER_STAGE_ROUTING_MAPPING.map((entry) => entry.learnerStageRef), SUPPORTED_LEARNER_STAGE_REFS);
    assert.deepEqual(APPROVED_LEARNER_STAGE_ROUTING_MAPPING.map((entry) => entry.routingStageClass), LEARNER_ROUTING_STAGE_CLASSES);
    assert.equal(new Set(APPROVED_LEARNER_STAGE_ROUTING_MAPPING.map((entry) => entry.learnerStageRef))
        .size, SUPPORTED_LEARNER_STAGE_REFS.length);
    const catalog = createCommercialLearnerStagePolicyCatalog();
    for (const entry of APPROVED_LEARNER_STAGE_ROUTING_MAPPING) {
        const first = catalog.resolve(bindingFor(entry.learnerStageRef));
        const second = catalog.resolve(bindingFor(entry.learnerStageRef));
        assert.deepEqual(first, second);
        assert.equal(first.status, "resolved");
        if (first.status === "resolved") {
            assert.equal(first.routingStageClass, entry.routingStageClass);
        }
    }
});
test("commercial evaluation uses committed W3-11 bounds", () => {
    const result = createCommercialLearnerStagePolicyCatalog().evaluate(bindingFor("learner-stage:early-elementary"), {
        measurementKind: "study-measured-tutor-turn",
        responseWordCount: 61,
        stepCount: 2,
        hintDepth: "nudge",
        instructionalDensity: "sparse",
        visualStepComplexity: "single-focus",
        modalitiesUsed: ["text", "image"],
        suggestsBreak: false,
        requestsParentReview: false,
        breakContext: {
            completedTutorTurns: 1,
            suggestionsAlreadyMade: 0,
            turnsSinceLastSuggestion: null,
        },
        parentReviewContext: {
            unresolvedAttemptCount: 0,
            consecutiveTutorTurnsWithoutResolution: 0,
        },
    });
    assert.equal(result.status, "evaluated");
    if (result.status !== "evaluated")
        return;
    assert.equal(result.profileRef, "stage-profile:early-elementary-v1");
    assert.equal(result.evaluation.status, "rejected");
    if (result.evaluation.status === "rejected") {
        assert.deepEqual(result.evaluation.issues, [
            { code: "RESPONSE_LENGTH_LIMIT_EXCEEDED" },
        ]);
    }
});
test("catalog results are defensive copies and caller mutation cannot change commercial mode", () => {
    const catalog = createCommercialLearnerStagePolicyCatalog();
    const profiles = catalog.listProfiles();
    profiles[0].maximumResponseWords = 1_200;
    profiles[0].multimodalAllowance.allowedModalities.push("video");
    const resolution = catalog.resolve(bindingFor(SUPPORTED_LEARNER_STAGE_REFS[0]));
    assert.equal(resolution.status, "resolved");
    if (resolution.status === "resolved") {
        assert.equal(resolution.profile.maximumResponseWords, 60);
        assert.deepEqual(resolution.profile.multimodalAllowance.allowedModalities, [
            "text",
            "image",
        ]);
    }
});
