import assert from "node:assert/strict";
import test from "node:test";
import { GROUNDING_CONTRACT_VERSION, evaluateGrounding, validateGroundedClaims, validateGroundedContextBundle, validateGroundingRequirements, } from "./index.js";
const DIGEST_A = `sha256:${"a".repeat(64)}`;
const DIGEST_B = `sha256:${"b".repeat(64)}`;
const DIGEST_FALLBACK = `sha256:${"f".repeat(64)}`;
function contextItem(contextRef = "content:reviewed-a", scopeRef = "scope:lesson-a", contentDigest = DIGEST_A) {
    return {
        contextRef,
        scopeRef,
        contentDigest,
        materialKind: "instructional",
        reviewAuthority: "study",
        reviewStatus: "study-reviewed",
        validity: "valid",
    };
}
function fallbackItem(scopeRef = "scope:lesson-a") {
    return {
        contextRef: "fallback:reviewed-static-a",
        scopeRef,
        contentDigest: DIGEST_FALLBACK,
        materialKind: "static-fallback",
        reviewAuthority: "study",
        reviewStatus: "study-reviewed",
        validity: "valid",
    };
}
function bundle(item = contextItem()) {
    return {
        contractVersion: GROUNDING_CONTRACT_VERSION,
        bundleRef: "bundle:grounding-a",
        source: "study-authority",
        scopeRef: item.scopeRef,
        assessmentPhase: "instruction-or-practice",
        items: [item, fallbackItem(item.scopeRef)],
        fallbackContextRef: "fallback:reviewed-static-a",
    };
}
function requirement(item = contextItem(), claimRef = "claim:material-a") {
    return {
        claimRef,
        scopeRef: item.scopeRef,
        claimKind: "instructional",
        requiredContext: [
            { contextRef: item.contextRef, contentDigest: item.contentDigest },
        ],
    };
}
function claim(item = contextItem(), claimRef = "claim:material-a") {
    return { claimRef, supportRefs: [item.contextRef] };
}
function issueCodes(decision) {
    return decision.assessment.issues.map((issue) => issue.code);
}
function assertNormativeRefusal(decision) {
    assert.equal(decision.status, "refused");
    if (decision.status !== "refused")
        return;
    assert.equal(decision.code, "INSUFFICIENT_GROUNDED_CONTEXT");
    assert.equal(decision.proposalAllowed, false);
    assert.equal(decision.providerOverrideAllowed, false);
    assert.equal(decision.studyMutationAllowed, false);
    assert.equal(decision.answerAuthorityExposed, false);
}
test("accepts an exact claim resolved to Study-reviewed context", () => {
    const item = contextItem();
    const decision = evaluateGrounding(bundle(item), [requirement(item)], [claim(item)]);
    assert.deepEqual(decision, {
        status: "grounded",
        proposalAllowed: true,
        providerOverrideAllowed: false,
        studyMutationAllowed: false,
        answerAuthorityExposed: false,
        assessment: {
            confidence: "sufficient",
            groundedClaimRefs: ["claim:material-a"],
            unsupportedClaimRefs: [],
            issues: [],
        },
    });
});
for (const shape of ["math", "language", "science", "humanities"]) {
    test(`uses the same opaque grounding rule for ${shape}-shaped context`, () => {
        const item = contextItem(`content:${shape}-unit-a`, `scope:${shape}-unit-a`, DIGEST_A);
        const decision = evaluateGrounding(bundle(item), [requirement(item, `claim:${shape}-material-a`)], [claim(item, `claim:${shape}-material-a`)]);
        assert.equal(decision.status, "grounded");
        assert.equal(decision.assessment.confidence, "sufficient");
    });
}
test("permits a proposal with no factual or instructional requirements", () => {
    const decision = evaluateGrounding(bundle(), [], []);
    assert.equal(decision.status, "grounded");
    assert.equal(decision.assessment.confidence, "sufficient");
});
test("refuses an unsupported material claim", () => {
    const item = contextItem();
    const decision = evaluateGrounding(bundle(item), [requirement(item)], []);
    assertNormativeRefusal(decision);
    assert.deepEqual(issueCodes(decision), ["unsupported-material-claim"]);
    assert.deepEqual(decision.assessment.unsupportedClaimRefs, ["claim:material-a"]);
});
test("refuses an unknown content reference", () => {
    const item = contextItem("content:unknown-a");
    const decision = evaluateGrounding(bundle(contextItem()), [requirement(item)], [claim(item)]);
    assertNormativeRefusal(decision);
    assert.ok(issueCodes(decision).includes("unknown-content-ref"));
});
test("refuses a context scope mismatch", () => {
    const item = contextItem();
    const inputBundle = bundle(item);
    inputBundle.items[0] = { ...item, scopeRef: "scope:different-unit" };
    const decision = evaluateGrounding(inputBundle, [requirement(item)], [claim(item)]);
    assertNormativeRefusal(decision);
    assert.ok(issueCodes(decision).includes("context-scope-mismatch"));
});
test("refuses a requirement bound to a different scope", () => {
    const item = contextItem();
    const required = requirement(item);
    required.scopeRef = "scope:different-unit";
    const decision = evaluateGrounding(bundle(item), [required], [claim(item)]);
    assertNormativeRefusal(decision);
    assert.ok(issueCodes(decision).includes("scope-binding-mismatch"));
});
for (const validity of ["stale", "invalid"]) {
    test(`refuses ${validity} reviewed context`, () => {
        const item = { ...contextItem(), validity };
        const decision = evaluateGrounding(bundle(item), [requirement(item)], [claim(item)]);
        assertNormativeRefusal(decision);
        assert.ok(issueCodes(decision).includes(`context-${validity}`));
    });
}
test("refuses a stale or invalid digest binding", () => {
    const item = contextItem();
    const required = requirement(item);
    required.requiredContext[0] = {
        contextRef: item.contextRef,
        contentDigest: DIGEST_B,
    };
    const decision = evaluateGrounding(bundle(item), [required], [claim(item)]);
    assertNormativeRefusal(decision);
    assert.ok(issueCodes(decision).includes("content-digest-mismatch"));
});
test("refuses context that Study has not reviewed", () => {
    const item = {
        ...contextItem(),
        reviewStatus: "not-reviewed",
    };
    const decision = evaluateGrounding(bundle(item), [requirement(item)], [claim(item)]);
    assertNormativeRefusal(decision);
    assert.ok(issueCodes(decision).includes("context-not-study-reviewed"));
});
test("provider cannot self-attest review status", () => {
    const item = contextItem();
    const untrustedClaim = {
        ...claim(item),
        reviewStatus: "study-reviewed",
    };
    const decision = evaluateGrounding(bundle(item), [requirement(item)], [untrustedClaim]);
    assertNormativeRefusal(decision);
    assert.deepEqual(issueCodes(decision), ["malformed-grounding-claims"]);
});
test("provider cannot upgrade insufficient grounding with confidence", () => {
    const item = contextItem();
    const untrustedClaim = {
        ...claim(item),
        supportRefs: ["content:invented-a"],
        confidence: "sufficient",
    };
    const decision = evaluateGrounding(bundle(item), [requirement(item)], [untrustedClaim]);
    assertNormativeRefusal(decision);
    assert.equal(decision.assessment.confidence, "insufficient");
    assert.deepEqual(issueCodes(decision), ["malformed-grounding-claims"]);
});
test("numeric model confidence is outside the closed claim contract", () => {
    const item = contextItem();
    assert.equal(validateGroundedClaims([{ ...claim(item), confidence: 0.999 }]), false);
});
test("active assessment remains anti-answer with exact reviewed support", () => {
    const item = contextItem();
    const inputBundle = bundle(item);
    inputBundle.assessmentPhase = "active-graded-or-mastery-check";
    const decision = evaluateGrounding(inputBundle, [requirement(item)], [claim(item)]);
    assertNormativeRefusal(decision);
    assert.ok(issueCodes(decision).includes("active-assessment-anti-answer"));
});
test("refusal selects only the Study-reviewed static fallback metadata", () => {
    const item = contextItem();
    const decision = evaluateGrounding(bundle(item), [requirement(item)], []);
    assertNormativeRefusal(decision);
    assert.deepEqual(decision.fallback, {
        kind: "reviewed-static-material",
        contextRef: "fallback:reviewed-static-a",
        scopeRef: "scope:lesson-a",
        contentDigest: DIGEST_FALLBACK,
        reviewAuthority: "study",
    });
});
for (const mutation of [
    { reviewStatus: "not-reviewed" },
    { validity: "stale" },
    { materialKind: "instructional" },
    { scopeRef: "scope:different-unit" },
]) {
    test(`does not use an ineligible static fallback: ${JSON.stringify(mutation)}`, () => {
        const item = contextItem();
        const inputBundle = bundle(item);
        inputBundle.items[1] = { ...fallbackItem(), ...mutation };
        const decision = evaluateGrounding(inputBundle, [requirement(item)], []);
        assertNormativeRefusal(decision);
        assert.equal(decision.fallback, null);
    });
}
test("refuses an unknown claim requirement", () => {
    const item = contextItem();
    const decision = evaluateGrounding(bundle(item), [requirement(item)], [claim(item, "claim:invented-a")]);
    assertNormativeRefusal(decision);
    assert.ok(issueCodes(decision).includes("unknown-claim-ref"));
    assert.ok(issueCodes(decision).includes("unsupported-material-claim"));
});
test("refuses an unexpected known support reference", () => {
    const item = contextItem();
    const untrustedClaim = {
        ...claim(item),
        supportRefs: [item.contextRef, "fallback:reviewed-static-a"],
    };
    const decision = evaluateGrounding(bundle(item), [requirement(item)], [untrustedClaim]);
    assertNormativeRefusal(decision);
    assert.ok(issueCodes(decision).includes("unexpected-content-ref"));
});
test("refuses duplicate provider support references as ambiguous", () => {
    const item = contextItem();
    const untrustedClaim = {
        ...claim(item),
        supportRefs: [item.contextRef, item.contextRef],
    };
    const decision = evaluateGrounding(bundle(item), [requirement(item)], [untrustedClaim]);
    assertNormativeRefusal(decision);
    assert.ok(issueCodes(decision).includes("duplicate-support-ref"));
});
test("refuses ambiguous duplicate context references", () => {
    const item = contextItem();
    const inputBundle = bundle(item);
    inputBundle.items.push({ ...item, contentDigest: DIGEST_B });
    const decision = evaluateGrounding(inputBundle, [requirement(item)], [claim(item)]);
    assertNormativeRefusal(decision);
    assert.ok(issueCodes(decision).includes("ambiguous-context-ref"));
});
test("uses partial only when at least one material claim is grounded", () => {
    const first = contextItem();
    const second = contextItem("content:reviewed-b", first.scopeRef, DIGEST_B);
    const inputBundle = bundle(first);
    inputBundle.items.splice(1, 0, second);
    const secondRequirement = requirement(second, "claim:material-b");
    secondRequirement.requiredContext[0] = {
        contextRef: second.contextRef,
        contentDigest: DIGEST_A,
    };
    const decision = evaluateGrounding(inputBundle, [requirement(first), secondRequirement], [claim(first), claim(second, "claim:material-b")]);
    assertNormativeRefusal(decision);
    assert.equal(decision.assessment.confidence, "partial");
    assert.deepEqual(decision.assessment.groundedClaimRefs, ["claim:material-a"]);
    assert.deepEqual(decision.assessment.unsupportedClaimRefs, ["claim:material-b"]);
});
test("raw transcript and other open context fields are rejected", () => {
    const item = contextItem();
    const openBundle = { ...bundle(item), rawTranscript: "unneeded learner prose" };
    const decision = evaluateGrounding(openBundle, [requirement(item)], [claim(item)]);
    assertNormativeRefusal(decision);
    assert.deepEqual(issueCodes(decision), ["malformed-context-bundle"]);
});
test("schemas validate the three closed boundary contracts", () => {
    const item = contextItem();
    assert.equal(validateGroundedContextBundle(bundle(item)), true);
    assert.equal(validateGroundingRequirements([requirement(item)]), true);
    assert.equal(validateGroundedClaims([claim(item)]), true);
});
test("evaluation is deterministic and does not mutate inputs", () => {
    const item = contextItem();
    const inputBundle = bundle(item);
    const requirements = [requirement(item)];
    const claims = [claim(item)];
    const before = structuredClone({ inputBundle, requirements, claims });
    const first = evaluateGrounding(inputBundle, requirements, claims);
    const second = evaluateGrounding(inputBundle, requirements, claims);
    assert.deepEqual(first, second);
    assert.deepEqual({ inputBundle, requirements, claims }, before);
});
test("hostile provider reflection fails closed", () => {
    const claims = new Proxy([claim()], {
        getPrototypeOf() {
            throw new Error("hostile reflection");
        },
    });
    assert.doesNotThrow(() => evaluateGrounding(bundle(), [requirement()], claims));
    const decision = evaluateGrounding(bundle(), [requirement()], claims);
    assertNormativeRefusal(decision);
    assert.deepEqual(issueCodes(decision), ["malformed-grounding-claims"]);
    assert.equal(validateGroundedClaims(claims), false);
});
