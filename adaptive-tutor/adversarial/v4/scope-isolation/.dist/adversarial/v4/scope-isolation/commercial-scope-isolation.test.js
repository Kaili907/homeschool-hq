import assert from "node:assert/strict";
import test from "node:test";
import { executeCommercialTutorInvocation, } from "../../../core/v3/commercial-operation/orchestrate.js";
import { ScriptedCommercialTransport, executionInput, successfulProviderResponse, } from "../../../tests/tutor-v3-convergence/fixtures.js";
function clone(value) {
    return structuredClone(value);
}
function successfulInput() {
    const transport = new ScriptedCommercialTransport([
        { status: "response", response: successfulProviderResponse() },
    ]);
    return { input: executionInput(transport), transport };
}
function expectContained(label, input, transport) {
    const result = executeCommercialTutorInvocation(input);
    assert.equal(transport.requests.length, 0, `${label}: foreign binding reached provider transport with status ${result.status}`);
    assert.equal(result.providerCalls, 0, `${label}: foreign binding was charged as a provider call`);
    assert.equal(result.telemetry.length, 0, `${label}: foreign binding produced attributable telemetry`);
}
test("baseline fixture exercises the real commercial provider boundary", () => {
    const { input, transport } = successfulInput();
    const result = executeCommercialTutorInvocation(input);
    assert.equal(result.status, "advisory");
    assert.equal(result.providerCalls, 1);
    assert.equal(transport.requests.length, 1);
    assert.equal(result.telemetry.length, 1);
});
test("deterministic combinations of household, learner, session, and interaction substitutions fail closed", async (t) => {
    const dimensions = [
        ["household", "householdScopeRef", "household-scope:family-two"],
        ["learner", "learnerScopeRef", "learner-scope:learner-b"],
        ["session", "sessionRef", "session:sibling-prior"],
        ["interaction", "interactionRef", "interaction:sibling-prior"],
    ];
    for (let mask = 1; mask < 1 << dimensions.length; mask += 1) {
        const selected = dimensions.filter((_dimension, index) => (mask & (1 << index)) !== 0);
        await t.test(selected.map(([label]) => label).join("+"), () => {
            const { input, transport } = successfulInput();
            const invocation = clone(input.invocation);
            for (const [, key, value] of selected)
                invocation[key] = value;
            expectContained(selected.map(([label]) => label).join("+"), { ...input, invocation }, transport);
        });
    }
});
test("same learner/session/interaction IDs under a different household fail closed", () => {
    const { input, transport } = successfulInput();
    const invocation = clone(input.invocation);
    invocation.householdScopeRef = "household-scope:family-two";
    expectContained("same IDs under foreign household", { ...input, invocation }, transport);
});
test("A session plus a fully valid sibling curriculum cannot influence a provider request", () => {
    const { input, transport } = successfulInput();
    const invocation = clone(input.invocation);
    const curriculum = invocation.curriculum;
    curriculum.releaseRef = "family-sibling-r1";
    curriculum.packageRef = "curriculum-package:family-sibling-r1";
    curriculum.version = "3.0.0";
    curriculum.digest = `sha256:${"b".repeat(64)}`;
    curriculum.courseRef = "ma-g5-mathematics-sibling";
    curriculum.unitRef = "ma-g5-mathematics-sibling-u01";
    curriculum.lessonRef = "ma-g5-mathematics-sibling-u01-l01";
    curriculum.conceptRef = "concept:sibling-fractions";
    curriculum.opportunityRef = "opportunity:sibling-fractions";
    const metadata = clone(input.curriculumMetadata);
    metadata.releaseRef = curriculum.releaseRef;
    metadata.packageRef = curriculum.packageRef;
    metadata.releaseVersion = curriculum.version;
    metadata.releaseDigest = curriculum.digest;
    metadata.courses = [{
            courseRef: curriculum.courseRef,
            subjectRef: "mathematics",
            grade: 5,
            unitRefs: [curriculum.unitRef],
            lessonBindings: [{ lessonRef: curriculum.lessonRef, unitRef: curriculum.unitRef }],
        }];
    const capability = clone(input.capabilityDeclaration);
    capability.supportedCourseRefs = [curriculum.courseRef];
    expectContained("A session + B curriculum", {
        ...input,
        invocation,
        curriculumMetadata: metadata,
        capabilityDeclaration: capability,
    }, transport);
});
test("A logical operation plus sibling physical-attempt refs cannot call, charge, or emit telemetry", () => {
    const { input, transport } = successfulInput();
    expectContained("A operation + B physical attempt", {
        ...input,
        routing: {
            ...input.routing,
            physicalAttemptRefs: [
                "physical-attempt:sibling-primary",
                "physical-attempt:sibling-failover",
            ],
        },
    }, transport);
});
test("sibling physical-attempt refs cannot receive A's cost or telemetry attribution", async (t) => {
    const run = () => {
        const { input } = successfulInput();
        const result = executeCommercialTutorInvocation({
            ...input,
            routing: {
                ...input.routing,
                physicalAttemptRefs: [
                    "physical-attempt:sibling-primary",
                    "physical-attempt:sibling-failover",
                ],
            },
        });
        assert.equal(result.status, "advisory");
        if (result.status !== "advisory")
            throw new Error("mixed-scope fixture did not execute");
        return result;
    };
    await t.test("cost receipt", () => {
        const result = run();
        assert.notEqual(result.usageReceipts[0]?.physicalAttemptRef, "physical-attempt:sibling-primary");
    });
    await t.test("telemetry", () => {
        const result = run();
        assert.notEqual(result.telemetry[0]?.physicalAttemptRef, "physical-attempt:sibling-primary");
    });
});
test("a sibling reservation ref cannot receive A's commercial settlement", () => {
    const { input } = successfulInput();
    const result = executeCommercialTutorInvocation({
        ...input,
        routing: { ...input.routing, reservationRef: "reservation:sibling-valid" },
    });
    assert.notEqual(result.status, "advisory", "foreign reservation received A's settlement");
    if (result.status === "advisory") {
        assert.notEqual(result.settlement.reservationRef, "reservation:sibling-valid");
    }
});
test("A reservation plus a sibling route cannot call, charge, or emit telemetry", () => {
    const { input, transport } = successfulInput();
    const siblingModels = input.routing.modelProfiles.map((profile) => ({
        ...profile,
        routeRef: `${profile.routeRef}-sibling`,
    }));
    expectContained("A reservation + B route", {
        ...input,
        routing: {
            ...input.routing,
            modelProfiles: siblingModels,
        },
    }, transport);
});
test("a sibling concept or opportunity cannot influence A", async (t) => {
    const mutations = [
        ["concept", "conceptRef", "concept:sibling-valid"],
        ["opportunity", "opportunityRef", "opportunity:sibling-valid"],
    ];
    for (const [label, key, value] of mutations) {
        await t.test(label, () => {
            const { input, transport } = successfulInput();
            const invocation = clone(input.invocation);
            invocation.curriculum[key] = value;
            expectContained(`A learner + B ${label}`, { ...input, invocation }, transport);
        });
    }
});
test("a valid sibling learner-stage binding cannot select A's provider route", () => {
    const { input, transport } = successfulInput();
    const invocation = clone(input.invocation);
    invocation.learnerStageRef = "learner-stage:secondary";
    const siblingStageModels = input.routing.modelProfiles.map((profile) => ({
        ...profile,
        learnerStages: ["SECONDARY"],
    }));
    expectContained("A learner + B learner-stage ref", {
        ...input,
        invocation,
        routing: { ...input.routing, modelProfiles: siblingStageModels },
    }, transport);
});
test("a stale prior-session grounding scope cannot reach transport", () => {
    const { input, transport } = successfulInput();
    const invocation = clone(input.invocation);
    const groundedContext = invocation.groundedContext;
    groundedContext.scopeRef = "interaction:prior-session";
    groundedContext.items = groundedContext.items.map((item) => ({
        ...item,
        scopeRef: "interaction:prior-session",
    }));
    invocation.groundingRequirements = invocation.groundingRequirements.map((requirement) => ({ ...requirement, scopeRef: "interaction:prior-session" }));
    expectContained("stale grounding scope", { ...input, invocation }, transport);
});
test("sibling reviewed presentation refs cannot influence A", () => {
    const { input, transport } = successfulInput();
    const invocation = clone(input.invocation);
    const requestedPresentation = invocation.requestedPresentation;
    requestedPresentation.mappingContext = {
        reviewedVisuals: [],
        requestSpeechAfterAcceptance: false,
        fallbackPresentation: {
            presentationRef: "presentation-fallback:sibling-valid",
            requestedDeliveryChannels: ["text"],
        },
    };
    expectContained("A learner + B presentation refs", { ...input, invocation }, transport);
});
test("foreign concept, opportunity, stage, and presentation refs never appear in A advisory/request", async (t) => {
    await t.test("provider request concept", () => {
        const { input, transport } = successfulInput();
        const invocation = clone(input.invocation);
        invocation.curriculum.conceptRef = "concept:sibling-valid";
        executeCommercialTutorInvocation({ ...input, invocation });
        const request = transport.requests[0];
        assert.notEqual(request?.academicScope?.conceptRef, "concept:sibling-valid");
    });
    await t.test("advisory opportunity", () => {
        const { input } = successfulInput();
        const invocation = clone(input.invocation);
        invocation.curriculum.opportunityRef = "opportunity:sibling-valid";
        const result = executeCommercialTutorInvocation({ ...input, invocation });
        assert.notEqual(result.status, "advisory");
        if (result.status === "advisory") {
            assert.notEqual(result.advisory.opportunityRef, "opportunity:sibling-valid");
        }
    });
    await t.test("stage-selected route", () => {
        const { input } = successfulInput();
        const invocation = clone(input.invocation);
        invocation.learnerStageRef = "learner-stage:secondary";
        const result = executeCommercialTutorInvocation({
            ...input,
            invocation,
            routing: {
                ...input.routing,
                modelProfiles: input.routing.modelProfiles.map((profile) => ({
                    ...profile,
                    learnerStages: ["SECONDARY"],
                })),
            },
        });
        assert.notEqual(result.status, "advisory");
    });
    await t.test("advisory fallback presentation", () => {
        const { input } = successfulInput();
        const invocation = clone(input.invocation);
        const requestedPresentation = invocation.requestedPresentation;
        requestedPresentation.mappingContext = {
            reviewedVisuals: [],
            requestSpeechAfterAcceptance: false,
            fallbackPresentation: {
                presentationRef: "presentation-fallback:sibling-valid",
                requestedDeliveryChannels: ["text"],
            },
        };
        const result = executeCommercialTutorInvocation({ ...input, invocation });
        assert.notEqual(result.status, "advisory");
        if (result.status === "advisory") {
            assert.notEqual(result.advisory.presentationIntent?.fallbackPresentation?.presentationRef, "presentation-fallback:sibling-valid");
        }
    });
});
