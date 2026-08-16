import assert from "node:assert/strict";
import test from "node:test";
import { validateExact } from "../../v2/contracts/validation.js";
import { BoundedInstructionalMemoryStore, InstructionalMemoryEntrySchema, MAXIMUM_INSTRUCTIONAL_MEMORY_ENTRIES, MAXIMUM_INSTRUCTIONAL_MEMORY_TTL_MS, MAXIMUM_MEMORY_CONCEPT_REFERENCES, MAXIMUM_RECENT_ACTION_REASON_CODES, MAXIMUM_REVIEWED_CONTENT_REFERENCES, MinimizedInstructionalMemorySnapshotSchema, } from "./index.js";
const baseScope = {
    scopeKind: "trusted-study-instructional-memory-scope",
    learnerScopeRef: "learner:opaque-child-a",
    sessionRef: "session:math-a",
    contextRef: "context:fraction-lesson-a",
    opportunityRef: "opportunity:practice-a",
};
const baseInstructionalState = {
    conceptRefs: ["concept:equivalent-fractions"],
    lastAssistanceLevel: "light-hint",
    lastHintLevel: "concept-cue",
    reviewedContentRefs: ["content:number-line-example"],
    studyApprovedState: {
        approvalKind: "study-approved-instructional-state",
        stateRef: "instructional-state:review-fractions",
        approvalRef: "study-approval:opaque-a",
    },
    recentActionReasonCodes: ["reviewed-prerequisite", "hint-escalated"],
};
function rememberRequest(memoryRef = "memory:instruction-a", scope = baseScope, instructionalState = baseInstructionalState) {
    return { memoryRef, scope, instructionalState, ttlMs: 60_000 };
}
function accessRequest(memoryRef = "memory:instruction-a", scope = baseScope) {
    return { memoryRef, scope };
}
test("stores only bounded Study-approved instructional continuity state", () => {
    const store = new BoundedInstructionalMemoryStore({
        now: () => Date.parse("2026-08-15T16:00:00.000Z"),
    });
    const result = store.remember(rememberRequest());
    assert.equal(result.status, "accepted");
    if (result.status !== "accepted")
        return;
    assert.equal(validateExact(InstructionalMemoryEntrySchema, result.state).status, "accepted");
    assert.deepEqual(result.state.scope, baseScope);
    assert.deepEqual(result.state.instructionalState, baseInstructionalState);
    assert.equal(result.state.expiresAtOpportunityEnd, true);
    assert.equal(result.state.persistenceAllowed, false);
    assert.equal(result.state.officialMasteryAuthority, false);
    assert.equal(result.state.studyMutationAllowed, false);
    assert.equal(result.state.gradeMutationAllowed, false);
    assert.equal(result.state.workingLevelMutationAllowed, false);
});
test("rejects every forbidden raw, sensitive, provider, and judgment field", () => {
    const forbiddenFields = [
        ["rawLearnerText", "private learner words"],
        ["rawTutorText", "generated tutor words"],
        ["audio", "audio:raw-recording"],
        ["image", "image:raw-frame"],
        ["emotionLabel", "anxious"],
        ["personalityJudgment", "lazy"],
        ["diagnosis", "private diagnosis"],
        ["providerPrompt", "hidden prompt"],
        ["providerResponse", "hidden response"],
        ["credential", "secret"],
    ];
    for (const [field, value] of forbiddenFields) {
        const store = new BoundedInstructionalMemoryStore();
        const result = store.remember(rememberRequest("memory:forbidden", baseScope, {
            ...baseInstructionalState,
            [field]: value,
        }));
        assert.deepEqual(result, {
            status: "rejected",
            code: "INVALID_MEMORY_REQUEST",
            tutorMayUseMemory: false,
        });
    }
});
test("rejects official mastery and grade or working-level mutation claims", () => {
    for (const forbiddenState of [
        { ...baseInstructionalState, officialMastery: true },
        { ...baseInstructionalState, masteryStatus: "mastered" },
        { ...baseInstructionalState, gradeLevel: 8 },
        { ...baseInstructionalState, workingLevel: "grade-9" },
        { ...baseInstructionalState, gradeMutationAllowed: true },
    ]) {
        const store = new BoundedInstructionalMemoryStore();
        assert.equal(store.remember(rememberRequest("memory:authority", baseScope, forbiddenState)).status, "rejected");
    }
});
test("fails closed for cross-child and every other scope mismatch", () => {
    const store = new BoundedInstructionalMemoryStore();
    assert.equal(store.remember(rememberRequest()).status, "accepted");
    const mismatchedScopes = [
        { ...baseScope, learnerScopeRef: "learner:opaque-child-b" },
        { ...baseScope, sessionRef: "session:math-b" },
        { ...baseScope, contextRef: "context:fraction-lesson-b" },
        { ...baseScope, opportunityRef: "opportunity:practice-b" },
    ];
    for (const scope of mismatchedScopes) {
        assert.deepEqual(store.read(accessRequest("memory:instruction-a", scope)), {
            status: "rejected",
            code: "MEMORY_SCOPE_MISMATCH",
            tutorMayUseMemory: false,
        });
        assert.deepEqual(store.clear(accessRequest("memory:instruction-a", scope)), {
            status: "rejected",
            code: "MEMORY_SCOPE_MISMATCH",
            tutorMayUseMemory: false,
        });
        assert.deepEqual(store.remember(rememberRequest("memory:instruction-a", scope)), {
            status: "rejected",
            code: "MEMORY_SCOPE_MISMATCH",
            tutorMayUseMemory: false,
        });
    }
    assert.equal(store.read(accessRequest()).status, "accepted");
});
test("enforces hard entry and structured-list bounds", () => {
    assert.equal(MAXIMUM_INSTRUCTIONAL_MEMORY_ENTRIES, 24);
    const tooManyConcepts = Array.from({ length: MAXIMUM_MEMORY_CONCEPT_REFERENCES + 1 }, (_, index) => `concept:c-${index}`);
    const tooManyReviewed = Array.from({ length: MAXIMUM_REVIEWED_CONTENT_REFERENCES + 1 }, (_, index) => `content:r-${index}`);
    const tooManyReasons = Array.from({ length: MAXIMUM_RECENT_ACTION_REASON_CODES + 1 }, (_, index) => `reason-${index}`);
    for (const instructionalState of [
        { ...baseInstructionalState, conceptRefs: tooManyConcepts },
        { ...baseInstructionalState, reviewedContentRefs: tooManyReviewed },
        { ...baseInstructionalState, recentActionReasonCodes: tooManyReasons },
    ]) {
        const store = new BoundedInstructionalMemoryStore();
        assert.deepEqual(store.remember(rememberRequest("memory:too-many", baseScope, instructionalState)), {
            status: "rejected",
            code: "INVALID_MEMORY_REQUEST",
            tutorMayUseMemory: false,
        });
    }
});
test("rejects duplicate references and reason codes", () => {
    for (const instructionalState of [
        { ...baseInstructionalState, conceptRefs: ["concept:a", "concept:a"] },
        { ...baseInstructionalState, reviewedContentRefs: ["content:a", "content:a"] },
        { ...baseInstructionalState, recentActionReasonCodes: ["same-reason", "same-reason"] },
    ]) {
        const store = new BoundedInstructionalMemoryStore();
        assert.deepEqual(store.remember(rememberRequest("memory:duplicate", baseScope, instructionalState)), {
            status: "rejected",
            code: "INVALID_MEMORY_STATE",
            tutorMayUseMemory: false,
        });
    }
});
test("evicts the least-recent successful write deterministically", () => {
    const store = new BoundedInstructionalMemoryStore({ maximumEntries: 2 });
    const scopeTwo = { ...baseScope, opportunityRef: "opportunity:practice-two" };
    const scopeThree = { ...baseScope, opportunityRef: "opportunity:practice-three" };
    assert.equal(store.remember(rememberRequest("memory:one")).status, "accepted");
    assert.equal(store.remember(rememberRequest("memory:two", scopeTwo)).status, "accepted");
    assert.equal(store.remember(rememberRequest("memory:one")).status, "accepted");
    const inserted = store.remember(rememberRequest("memory:three", scopeThree));
    assert.equal(inserted.status, "accepted");
    if (inserted.status === "accepted")
        assert.equal(inserted.evictionOccurred, true);
    assert.equal(store.read(accessRequest("memory:one")).status, "accepted");
    assert.deepEqual(store.read(accessRequest("memory:two", scopeTwo)), {
        status: "rejected",
        code: "MEMORY_NOT_FOUND",
        tutorMayUseMemory: false,
    });
    assert.equal(store.read(accessRequest("memory:three", scopeThree)).status, "accepted");
    assert.equal(store.activeEntryCount, 2);
});
test("expires at the TTL boundary and validates TTL ceilings", () => {
    let now = Date.parse("2026-08-15T16:00:00.000Z");
    const store = new BoundedInstructionalMemoryStore({ now: () => now });
    assert.equal(store.remember({ ...rememberRequest(), ttlMs: 1_000 }).status, "accepted");
    now += 999;
    assert.equal(store.read(accessRequest()).status, "accepted");
    now += 1;
    assert.deepEqual(store.read(accessRequest()), {
        status: "rejected",
        code: "MEMORY_EXPIRED",
        tutorMayUseMemory: false,
    });
    assert.equal(store.activeEntryCount, 0);
    assert.deepEqual(store.remember({
        ...rememberRequest("memory:ttl-too-long"),
        ttlMs: MAXIMUM_INSTRUCTIONAL_MEMORY_TTL_MS + 1,
    }), { status: "rejected", code: "INVALID_MEMORY_REQUEST", tutorMayUseMemory: false });
});
test("rejects a clock rollback without replacing valid memory", () => {
    let now = Date.parse("2026-08-15T16:00:00.000Z");
    const store = new BoundedInstructionalMemoryStore({ now: () => now });
    assert.equal(store.remember(rememberRequest()).status, "accepted");
    now -= 1_000;
    assert.deepEqual(store.remember(rememberRequest()), {
        status: "rejected",
        code: "INVALID_MEMORY_STATE",
        tutorMayUseMemory: false,
    });
    now += 1_000;
    assert.equal(store.read(accessRequest()).status, "accepted");
});
test("opportunity expiration removes only the exact learner/session/context/opportunity scope", () => {
    const store = new BoundedInstructionalMemoryStore();
    const siblingOpportunity = {
        ...baseScope,
        opportunityRef: "opportunity:practice-b",
    };
    assert.equal(store.remember(rememberRequest("memory:a-one")).status, "accepted");
    assert.equal(store.remember(rememberRequest("memory:a-two")).status, "accepted");
    assert.equal(store.remember(rememberRequest("memory:b-one", siblingOpportunity)).status, "accepted");
    assert.deepEqual(store.expireOpportunity(baseScope), {
        status: "opportunity-expired",
        removedCount: 2,
    });
    assert.equal(store.read(accessRequest("memory:a-one")).status, "rejected");
    assert.equal(store.read(accessRequest("memory:a-two")).status, "rejected");
    assert.equal(store.read(accessRequest("memory:b-one", siblingOpportunity)).status, "accepted");
});
test("clear and scope reset remove memory without touching adjacent scopes", () => {
    const store = new BoundedInstructionalMemoryStore();
    const adjacentScope = { ...baseScope, contextRef: "context:adjacent" };
    assert.equal(store.remember(rememberRequest("memory:clear-one")).status, "accepted");
    assert.deepEqual(store.clear(accessRequest("memory:clear-one")), { status: "cleared" });
    assert.equal(store.read(accessRequest("memory:clear-one")).status, "rejected");
    assert.equal(store.remember(rememberRequest("memory:reset-one")).status, "accepted");
    assert.equal(store.remember(rememberRequest("memory:reset-two")).status, "accepted");
    assert.equal(store.remember(rememberRequest("memory:adjacent", adjacentScope)).status, "accepted");
    assert.deepEqual(store.resetScope(baseScope), { status: "reset", removedCount: 2 });
    assert.equal(store.read(accessRequest("memory:reset-one")).status, "rejected");
    assert.equal(store.read(accessRequest("memory:adjacent", adjacentScope)).status, "accepted");
});
test("produces a minimized non-persistable snapshot and defensive copies", () => {
    const store = new BoundedInstructionalMemoryStore({
        now: () => Date.parse("2026-08-15T16:00:00.000Z"),
    });
    assert.equal(store.remember(rememberRequest()).status, "accepted");
    const result = store.snapshot(accessRequest());
    assert.equal(result.status, "snapshotted");
    if (result.status !== "snapshotted")
        return;
    assert.equal(validateExact(MinimizedInstructionalMemorySnapshotSchema, result.snapshot).status, "accepted");
    for (const omittedField of ["memoryRef", "createdAt", "updatedAt", "expiresAt"]) {
        assert.equal(Object.hasOwn(result.snapshot, omittedField), false);
    }
    assert.equal(result.snapshot.persistenceAllowed, false);
    result.snapshot.instructionalState.conceptRefs.push("concept:mutated-copy");
    const reread = store.read(accessRequest());
    assert.equal(reread.status, "accepted");
    if (reread.status === "accepted") {
        assert.deepEqual(reread.state.instructionalState.conceptRefs, [
            "concept:equivalent-fractions",
        ]);
    }
});
test("does not persist memory by default across store instances", () => {
    const first = new BoundedInstructionalMemoryStore();
    assert.equal(first.remember(rememberRequest()).status, "accepted");
    const second = new BoundedInstructionalMemoryStore();
    assert.deepEqual(second.read(accessRequest()), {
        status: "rejected",
        code: "MEMORY_NOT_FOUND",
        tutorMayUseMemory: false,
    });
});
