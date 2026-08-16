import assert from "node:assert/strict";
import test from "node:test";
import {
  STUDY_COMMERCIAL_EFFECT_RECEIPT_VERSION,
  type StudyCommercialEffectReceipt,
  type StudyCommercialTutorAdvisory,
} from "../../../core/v3/contracts/index.js";
import type { CommercialExecutionScope } from "../../../core/v3/commercial-operation/index.js";
import { executeCommercialTutorInvocation } from "../../../core/v3/commercial-operation/orchestrate.js";
import {
  InstructionalMemoryProjectionStore,
  createInstructionalMemoryDelta,
  type ApplyInstructionalMemoryDeltaResult,
  type InstructionalMemoryDelta,
  type InstructionalMemoryScope,
} from "../../../core/v3/memory/index.js";
import {
  RecoverableInstructionalOperationCoordinator,
  type CanonicalStudyEffectAcceptCommand,
  type CanonicalStudyEffectAcceptResult,
  type CanonicalStudyEffectGateway,
  type CanonicalStudyEffectIdentity,
  type CanonicalStudyEffectLookupResult,
  type InstructionalMemoryDeltaPort,
  type MinimizedAcceptedStudyEffectEvent,
} from "../../../core/v3/recovery/index.js";
import { recoverAcceptedCommercialEffect } from "../../../study-engine/tutor-v2/wave3/index.js";
import { executionInput } from "../../tutor-v3-convergence/fixtures.js";

const EFFECT_DIGEST = `sha256:${"a".repeat(64)}`;

interface Fixture {
  readonly commercialScope: CommercialExecutionScope;
  readonly advisory: StudyCommercialTutorAdvisory;
  readonly receipt: StudyCommercialEffectReceipt;
  readonly memoryScope: InstructionalMemoryScope;
  readonly memoryDelta: InstructionalMemoryDelta;
}

function makeDelta(
  receipt: StudyCommercialEffectReceipt,
  memoryScope: InstructionalMemoryScope,
  conceptRef = receipt.conceptRef,
): InstructionalMemoryDelta {
  return createInstructionalMemoryDelta({
    commercialExecutionScopeRef: receipt.commercialExecutionScopeRef,
    householdScopeRef: receipt.householdScopeRef,
    logicalOperationRef: receipt.logicalOperationRef,
    sourceEventRef: receipt.receiptRef,
    conceptRef,
    curriculumReleaseRef: receipt.curriculumReleaseRef,
    curriculumPackageRef: receipt.curriculumPackageRef,
    curriculumCourseRef: receipt.curriculumCourseRef,
    curriculumSubjectRef: receipt.curriculumSubjectRef,
    curriculumUnitRef: receipt.curriculumUnitRef,
    curriculumLessonRef: receipt.curriculumLessonRef,
    memoryDeltaRef: `memory-delta:${conceptRef.split(":").at(-1) ?? "unknown"}`,
    memoryRef: "memory:learner-a-commercial-one",
    scope: memoryScope,
    prior: null,
    operations: [{ operationKind: "add", field: "conceptRefs", value: conceptRef }],
  });
}

function fixture(): Fixture {
  const execution = executionInput();
  if (!("scopeRef" in execution.trustedScope)) {
    throw new Error("W4-R4 requires canonical CommercialExecutionScope");
  }
  const result = executeCommercialTutorInvocation(execution);
  if (result.status !== "advisory") throw new Error("commercial fixture did not produce advisory");
  const commercialScope = structuredClone(execution.trustedScope);
  const receipt: StudyCommercialEffectReceipt = {
    contractVersion: STUDY_COMMERCIAL_EFFECT_RECEIPT_VERSION,
    receiptKind: "trusted-study-commercial-effect-receipt",
    issuedBy: "study-engine",
    receiptRef: "study-receipt:commercial-one",
    invocationRef: result.advisory.invocationRef,
    commercialExecutionScopeRef: commercialScope.scopeRef,
    householdScopeRef: commercialScope.householdScopeRef,
    logicalOperationRef: commercialScope.logicalOperationRef,
    learnerScopeRef: commercialScope.learnerScopeRef,
    sessionRef: commercialScope.sessionRef,
    interactionRef: commercialScope.interactionRef,
    conceptRef: commercialScope.conceptRef,
    opportunityRef: commercialScope.opportunityRef,
    curriculumReleaseRef: commercialScope.curriculumReleaseRef,
    curriculumPackageRef: commercialScope.curriculumPackageRef,
    curriculumCourseRef: commercialScope.curriculumCourseRef,
    curriculumSubjectRef: commercialScope.curriculumSubjectRef,
    curriculumUnitRef: commercialScope.curriculumUnitRef,
    curriculumLessonRef: commercialScope.curriculumLessonRef,
    decision: "accepted",
    effectRef: "study-effect:commercial-one",
    effectDigest: EFFECT_DIGEST,
    studyProgressCommitted: true,
    tutorMutationAuthorityGranted: false,
  };
  const memoryScope = {
    scopeKind: "trusted-study-instructional-memory-scope",
    learnerScopeRef: receipt.learnerScopeRef,
    sessionRef: receipt.sessionRef,
    contextRef: receipt.interactionRef,
    opportunityRef: receipt.opportunityRef,
  } as const satisfies InstructionalMemoryScope;
  return {
    commercialScope,
    advisory: result.advisory,
    receipt,
    memoryScope,
    memoryDelta: makeDelta(receipt, memoryScope),
  };
}

function acceptedEvent(
  receipt: StudyCommercialEffectReceipt,
  delta: InstructionalMemoryDelta,
): MinimizedAcceptedStudyEffectEvent {
  return {
    eventKind: "minimized-study-effect-accepted",
    commercialExecutionScopeRef: receipt.commercialExecutionScopeRef,
    householdScopeRef: receipt.householdScopeRef,
    logicalOperationRef: receipt.logicalOperationRef,
    sourceEventRef: receipt.receiptRef,
    effectRef: receipt.effectRef,
    effectDigest: receipt.effectDigest,
    conceptRef: delta.conceptRef,
    curriculumReleaseRef: delta.curriculumReleaseRef,
    curriculumPackageRef: delta.curriculumPackageRef,
    curriculumCourseRef: delta.curriculumCourseRef,
    curriculumSubjectRef: delta.curriculumSubjectRef,
    curriculumUnitRef: delta.curriculumUnitRef,
    curriculumLessonRef: delta.curriculumLessonRef,
    scope: structuredClone(delta.scope),
    memoryDelta: structuredClone(delta),
    rawTranscriptIncluded: false,
    officialMasteryAuthority: false,
    gradeAuthority: false,
    placementAuthority: false,
    curriculumAuthority: false,
  };
}

class StudyEffectGateway implements CanonicalStudyEffectGateway {
  acceptCount = 0;
  lookupCount = 0;
  accepted: MinimizedAcceptedStudyEffectEvent | null = null;

  lookup(_identity: CanonicalStudyEffectIdentity): CanonicalStudyEffectLookupResult {
    this.lookupCount += 1;
    return this.accepted
      ? { status: "accepted", event: structuredClone(this.accepted) }
      : { status: "missing" };
  }

  accept(command: CanonicalStudyEffectAcceptCommand): CanonicalStudyEffectAcceptResult {
    this.acceptCount += 1;
    this.accepted = structuredClone(command.acceptedEvent);
    return { status: "accepted", event: structuredClone(command.acceptedEvent) };
  }
}

class FailOnceMemoryPort implements InstructionalMemoryDeltaPort {
  applyCount = 0;

  constructor(
    readonly store: InstructionalMemoryProjectionStore,
    private failuresRemaining = 1,
  ) {}

  apply(candidate: unknown): ApplyInstructionalMemoryDeltaResult {
    this.applyCount += 1;
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error("disposable memory write failure");
    }
    return this.store.apply(candidate);
  }
}

function recover(
  value: Fixture,
  coordinator: RecoverableInstructionalOperationCoordinator,
) {
  return recoverAcceptedCommercialEffect(
    value.receipt,
    value.advisory,
    value.memoryDelta,
    value.commercialScope,
    coordinator,
  );
}

test("accepted effect survives memory failure and exact replay repairs memory exactly once", () => {
  const value = fixture();
  const gateway = new StudyEffectGateway();
  const store = new InstructionalMemoryProjectionStore();
  const memory = new FailOnceMemoryPort(store);
  const coordinator = new RecoverableInstructionalOperationCoordinator(gateway, memory);

  const failed = recover(value, coordinator);
  assert.equal(failed.status, "pending");
  assert.equal(gateway.acceptCount, 1);
  assert.equal(store.projectionCount, 0);

  const repaired = recover(value, coordinator);
  assert.equal(repaired.status, "complete");
  if (repaired.status !== "complete") return;
  assert.equal(repaired.effectDisposition, "reused");
  assert.equal(repaired.memoryDisposition, "applied");
  assert.equal(repaired.recoveredMemory, true);
  assert.equal(gateway.acceptCount, 1);
  assert.equal(store.projectionCount, 1);
  assert.deepEqual(repaired.projection.instructionalState.conceptRefs, [
    value.commercialScope.conceptRef,
  ]);

  const duplicate = recover(value, coordinator);
  assert.equal(duplicate.status, "complete");
  if (duplicate.status === "complete") assert.equal(duplicate.memoryDisposition, "duplicate");
  assert.equal(gateway.acceptCount, 1);
  assert.equal(store.projectionCount, 1);
});

test("sibling concept operation cannot enter learner A memory", () => {
  const value = fixture();
  const gateway = new StudyEffectGateway();
  const store = new InstructionalMemoryProjectionStore();
  const coordinator = new RecoverableInstructionalOperationCoordinator(gateway, store);
  const attack = {
    ...value,
    memoryDelta: {
      ...value.memoryDelta,
      operations: [
        { operationKind: "add", field: "conceptRefs", value: "concept:sibling" },
      ],
    } as InstructionalMemoryDelta,
  };

  assert.deepEqual(recover(attack, coordinator), {
    status: "rejected",
    code: "COMMERCIAL_EFFECT_SCOPE_MISMATCH",
  });
  assert.equal(gateway.lookupCount, 0);
  assert.equal(gateway.acceptCount, 0);
  assert.equal(store.projectionCount, 0);
});

test("sibling opportunity delta cannot enter learner A memory", () => {
  const value = fixture();
  const gateway = new StudyEffectGateway();
  const store = new InstructionalMemoryProjectionStore();
  const coordinator = new RecoverableInstructionalOperationCoordinator(gateway, store);
  const attack = {
    ...value,
    memoryDelta: {
      ...value.memoryDelta,
      scope: { ...value.memoryDelta.scope, opportunityRef: "opportunity:sibling" },
    } as InstructionalMemoryDelta,
  };

  assert.deepEqual(recover(attack, coordinator), {
    status: "rejected",
    code: "COMMERCIAL_EFFECT_SCOPE_MISMATCH",
  });
  assert.equal(gateway.lookupCount, 0);
  assert.equal(store.projectionCount, 0);
});

test("syntactically valid sibling accepted effect cannot be reused for learner A", () => {
  const value = fixture();
  const siblingScope = {
    ...value.memoryScope,
    learnerScopeRef: "learner-scope:learner-b",
    opportunityRef: "opportunity:sibling",
  };
  const siblingReceipt = {
    ...value.receipt,
    learnerScopeRef: siblingScope.learnerScopeRef,
    conceptRef: "concept:sibling",
    opportunityRef: siblingScope.opportunityRef,
  };
  const siblingDelta = makeDelta(siblingReceipt, siblingScope, siblingReceipt.conceptRef);
  const gateway = new StudyEffectGateway();
  gateway.accepted = acceptedEvent(siblingReceipt, siblingDelta);
  const store = new InstructionalMemoryProjectionStore();
  const result = recover(
    value,
    new RecoverableInstructionalOperationCoordinator(gateway, store),
  );

  assert.equal(result.status, "quarantined");
  if (result.status === "quarantined") assert.equal(result.code, "INVALID_ACCEPTED_EVENT");
  assert.equal(gateway.acceptCount, 0);
  assert.equal(store.projectionCount, 0);
});

type ConflictMutation = (value: {
  scope: CommercialExecutionScope;
  advisory: StudyCommercialTutorAdvisory;
  receipt: StudyCommercialEffectReceipt;
  memoryScope: InstructionalMemoryScope;
}) => void;

function expectConflictingReplay(mutate: ConflictMutation): void {
  const value = fixture();
  const gateway = new StudyEffectGateway();
  const store = new InstructionalMemoryProjectionStore();
  const coordinator = new RecoverableInstructionalOperationCoordinator(gateway, store);
  assert.equal(recover(value, coordinator).status, "complete");

  const foreign = {
    scope: structuredClone(value.commercialScope),
    advisory: structuredClone(value.advisory),
    receipt: structuredClone(value.receipt),
    memoryScope: structuredClone(value.memoryScope),
  };
  mutate(foreign);
  const attack: Fixture = {
    commercialScope: foreign.scope,
    advisory: foreign.advisory,
    receipt: foreign.receipt,
    memoryScope: foreign.memoryScope,
    memoryDelta: makeDelta(foreign.receipt, foreign.memoryScope),
  };
  const result = recover(attack, coordinator);
  assert.equal(result.status, "quarantined");
  if (result.status === "quarantined") {
    assert.equal(result.code, "CONFLICTING_LOGICAL_OPERATION");
  }
  assert.equal(gateway.acceptCount, 1);
  assert.equal(store.projectionCount, 1);
}

test("same logical operation with a foreign household is a conflict", () => {
  expectConflictingReplay(({ scope, advisory, receipt }) => {
    scope.householdScopeRef = "household-scope:family-b";
    advisory.householdScopeRef = scope.householdScopeRef;
    receipt.householdScopeRef = scope.householdScopeRef;
  });
});

test("same logical operation with a foreign learner is a conflict", () => {
  expectConflictingReplay(({ scope, advisory, receipt, memoryScope }) => {
    scope.learnerScopeRef = "learner-scope:learner-b";
    advisory.learnerScopeRef = scope.learnerScopeRef;
    receipt.learnerScopeRef = scope.learnerScopeRef;
    memoryScope.learnerScopeRef = scope.learnerScopeRef;
  });
});

test("same logical operation with a foreign commercial scope is a conflict", () => {
  expectConflictingReplay(({ scope, advisory, receipt }) => {
    scope.scopeRef = "commercial-scope:commercial-two";
    advisory.commercialScopeRef = scope.scopeRef;
    receipt.commercialExecutionScopeRef = scope.scopeRef;
  });
});

test("session substitution fails before accepted-effect lookup", () => {
  const value = fixture();
  const gateway = new StudyEffectGateway();
  const coordinator = new RecoverableInstructionalOperationCoordinator(
    gateway,
    new InstructionalMemoryProjectionStore(),
  );
  const receipt = { ...value.receipt, sessionRef: "session:sibling" };
  const attack = { ...value, receipt };
  assert.deepEqual(recover(attack, coordinator), {
    status: "rejected",
    code: "COMMERCIAL_EFFECT_SCOPE_MISMATCH",
  });
  assert.equal(gateway.lookupCount, 0);
});

test("durable lineage boundaries reject raw learner and Tutor prose", () => {
  const value = fixture();
  const gateway = new StudyEffectGateway();
  const coordinator = new RecoverableInstructionalOperationCoordinator(
    gateway,
    new InstructionalMemoryProjectionStore(),
  );
  const result = recoverAcceptedCommercialEffect(
    { ...value.receipt, learnerName: "Private Learner" },
    value.advisory,
    { ...value.memoryDelta, tutorTranscript: "private transcript" },
    value.commercialScope,
    coordinator,
  );
  assert.deepEqual(result, { status: "rejected", code: "INVALID_STUDY_EFFECT_RECEIPT" });
  assert.equal(gateway.lookupCount, 0);
});
