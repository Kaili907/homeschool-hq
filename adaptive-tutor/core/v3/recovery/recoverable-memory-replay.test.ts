import assert from "node:assert/strict";
import test from "node:test";
import { validateExact } from "../../v2/contracts/validation.js";
import {
  COMMERCIAL_EXECUTION_SCOPE_VERSION,
  type CommercialExecutionScope,
} from "../commercial-operation/index.js";
import {
  InstructionalMemoryDeltaSchema,
  InstructionalMemoryProjectionStore,
  createInstructionalMemoryDelta,
  type ApplyInstructionalMemoryDeltaResult,
  type InstructionalMemoryProjection,
  type InstructionalMemoryScope,
} from "../memory/index.js";
import {
  MinimizedAcceptedStudyEffectEventSchema,
  RecoverableInstructionalOperationCoordinator,
  type CanonicalStudyEffectAcceptCommand,
  type CanonicalStudyEffectAcceptResult,
  type CanonicalStudyEffectGateway,
  type CanonicalStudyEffectIdentity,
  type CanonicalStudyEffectLookupResult,
  type InstructionalMemoryDeltaPort,
  type MinimizedAcceptedStudyEffectEvent,
  type RecoverableInstructionalOperation,
} from "./index.js";

const scope = {
  scopeKind: "trusted-study-instructional-memory-scope",
  learnerScopeRef: "learner:child-a",
  sessionRef: "session:math-a",
  contextRef: "context:fractions-a",
  opportunityRef: "opportunity:practice-a",
} as const satisfies InstructionalMemoryScope;

const commercialScope = {
  scopeVersion: COMMERCIAL_EXECUTION_SCOPE_VERSION,
  scopeKind: "trusted-study-commercial-execution-scope",
  issuedBy: "study-engine",
  scopeRef: "commercial-scope:hint-a",
  householdScopeRef: "household-scope:family-a",
  learnerScopeRef: scope.learnerScopeRef,
  sessionRef: scope.sessionRef,
  interactionRef: scope.contextRef,
  logicalOperationRef: "logical-operation:hint-a",
  curriculumReleaseRef: "family-pilot-r1",
  curriculumPackageRef: "curriculum-package:family-pilot-r1",
  curriculumCourseRef: "ma-g5-mathematics",
  curriculumSubjectRef: "mathematics",
  curriculumUnitRef: "ma-g5-mathematics-u01",
  curriculumLessonRef: "ma-g5-mathematics-u01-l01",
  conceptRef: "concept:fractions",
  opportunityRef: scope.opportunityRef,
  learnerStageRef: "learner-stage:middle-grades",
  presentationRef: "presentation:hint-a",
  routingRequestRef: "routing-request:hint-a",
  routePlanRef: "route-plan:hint-a",
  reservationRef: "reservation:hint-a",
  physicalAttemptRefs: ["physical-attempt:hint-a"],
  allowedRouteRefs: ["route:hint-a"],
  telemetryEventRefs: ["telemetry-event:hint-a"],
} as const satisfies CommercialExecutionScope;

const effectDigest = `sha256:${"a".repeat(64)}`;

function makeOperation(options: {
  logicalOperationRef?: string;
  sourceEventRef?: string;
  memoryDeltaRef?: string;
  memoryRef?: string;
  operationScope?: InstructionalMemoryScope;
  prior?: InstructionalMemoryProjection | null;
  operations?: Parameters<typeof createInstructionalMemoryDelta>[0]["operations"];
  commercialExecutionScopeRef?: string;
  householdScopeRef?: string;
  conceptRef?: string;
} = {}): RecoverableInstructionalOperation {
  const operationScope = options.operationScope ?? scope;
  const logicalOperationRef = options.logicalOperationRef ?? "logical-operation:hint-a";
  const sourceEventRef = options.sourceEventRef ?? "study-event:hint-a-accepted";
  const conceptRef = options.conceptRef ?? commercialScope.conceptRef;
  const memoryDelta = createInstructionalMemoryDelta({
    commercialExecutionScopeRef:
      options.commercialExecutionScopeRef ?? commercialScope.scopeRef,
    householdScopeRef: options.householdScopeRef ?? commercialScope.householdScopeRef,
    logicalOperationRef,
    sourceEventRef,
    conceptRef,
    curriculumReleaseRef: commercialScope.curriculumReleaseRef,
    curriculumPackageRef: commercialScope.curriculumPackageRef,
    curriculumCourseRef: commercialScope.curriculumCourseRef,
    curriculumSubjectRef: commercialScope.curriculumSubjectRef,
    curriculumUnitRef: commercialScope.curriculumUnitRef,
    curriculumLessonRef: commercialScope.curriculumLessonRef,
    memoryDeltaRef: options.memoryDeltaRef ?? "memory-delta:hint-a",
    memoryRef: options.memoryRef ?? "memory:fractions-a",
    scope: operationScope,
    prior: options.prior ?? null,
    operations: options.operations ?? [
      { operationKind: "add", field: "conceptRefs", value: "concept:fractions" },
      {
        operationKind: "replace",
        field: "lastAssistanceLevel",
        value: "light-hint",
      },
      { operationKind: "replace", field: "lastHintLevel", value: "concept-cue" },
      {
        operationKind: "add",
        field: "recentActionReasonCodes",
        value: "hint-escalated",
      },
    ],
  });
  return {
    recoveryKind: "recoverable-instructional-operation",
    commercialExecutionScopeRef: memoryDelta.commercialExecutionScopeRef,
    householdScopeRef: memoryDelta.householdScopeRef,
    logicalOperationRef,
    sourceEventRef,
    effectRef: "study-effect:show-hint-a",
    effectDigest,
    conceptRef,
    curriculumReleaseRef: memoryDelta.curriculumReleaseRef,
    curriculumPackageRef: memoryDelta.curriculumPackageRef,
    curriculumCourseRef: memoryDelta.curriculumCourseRef,
    curriculumSubjectRef: memoryDelta.curriculumSubjectRef,
    curriculumUnitRef: memoryDelta.curriculumUnitRef,
    curriculumLessonRef: memoryDelta.curriculumLessonRef,
    scope: operationScope,
    memoryDelta,
  };
}

function acceptedEvent(
  operation: RecoverableInstructionalOperation,
): MinimizedAcceptedStudyEffectEvent {
  return {
    eventKind: "minimized-study-effect-accepted",
    commercialExecutionScopeRef: operation.commercialExecutionScopeRef,
    householdScopeRef: operation.householdScopeRef,
    logicalOperationRef: operation.logicalOperationRef,
    sourceEventRef: operation.sourceEventRef,
    effectRef: operation.effectRef,
    effectDigest: operation.effectDigest,
    conceptRef: operation.conceptRef,
    curriculumReleaseRef: operation.curriculumReleaseRef,
    curriculumPackageRef: operation.curriculumPackageRef,
    curriculumCourseRef: operation.curriculumCourseRef,
    curriculumSubjectRef: operation.curriculumSubjectRef,
    curriculumUnitRef: operation.curriculumUnitRef,
    curriculumLessonRef: operation.curriculumLessonRef,
    scope: structuredClone(operation.scope),
    memoryDelta: structuredClone(operation.memoryDelta),
    rawTranscriptIncluded: false,
    officialMasteryAuthority: false,
    gradeAuthority: false,
    placementAuthority: false,
    curriculumAuthority: false,
  };
}

type FailureMode = "none" | "before-acceptance" | "after-acceptance";

class FakeEffectGateway implements CanonicalStudyEffectGateway {
  readonly acceptCommands: CanonicalStudyEffectAcceptCommand[] = [];
  lookupCount = 0;
  failureMode: FailureMode;
  readonly #accepted = new Map<string, MinimizedAcceptedStudyEffectEvent>();

  constructor(failureMode: FailureMode = "none") {
    this.failureMode = failureMode;
  }

  seed(event: MinimizedAcceptedStudyEffectEvent): void {
    this.#accepted.set(event.logicalOperationRef, structuredClone(event));
  }

  lookup(identity: CanonicalStudyEffectIdentity): CanonicalStudyEffectLookupResult {
    this.lookupCount += 1;
    const event = this.#accepted.get(identity.logicalOperationRef);
    if (!event) return { status: "missing" };
    if (
      event.effectRef !== identity.effectRef ||
      event.effectDigest !== identity.effectDigest ||
      event.sourceEventRef !== identity.sourceEventRef
    ) {
      return { status: "conflict" };
    }
    return { status: "accepted", event: structuredClone(event) };
  }

  accept(command: CanonicalStudyEffectAcceptCommand): CanonicalStudyEffectAcceptResult {
    this.acceptCommands.push(structuredClone(command));
    if (this.failureMode === "before-acceptance") {
      this.failureMode = "none";
      throw new Error("simulated crash before canonical effect acceptance");
    }
    this.#accepted.set(
      command.logicalOperationRef,
      structuredClone(command.acceptedEvent),
    );
    if (this.failureMode === "after-acceptance") {
      this.failureMode = "none";
      throw new Error("simulated crash after canonical effect acceptance");
    }
    return { status: "accepted", event: structuredClone(command.acceptedEvent) };
  }
}

class FlakyMemoryPort implements InstructionalMemoryDeltaPort {
  applyCount = 0;

  constructor(
    readonly store: InstructionalMemoryProjectionStore,
    private failuresRemaining: number,
  ) {}

  apply(candidate: unknown): ApplyInstructionalMemoryDeltaResult {
    this.applyCount += 1;
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error("simulated memory write failure");
    }
    return this.store.apply(candidate);
  }
}

test("normal operation accepts one logical effect and applies one deterministic memory delta", () => {
  const gateway = new FakeEffectGateway();
  const memory = new InstructionalMemoryProjectionStore();
  const coordinator = new RecoverableInstructionalOperationCoordinator(gateway, memory);
  const operation = makeOperation();

  const result = coordinator.replay(commercialScope, operation);
  assert.equal(result.status, "complete");
  if (result.status !== "complete") return;
  assert.equal(result.effectDisposition, "executed");
  assert.equal(result.memoryDisposition, "applied");
  assert.deepEqual(result.record.stateHistory, [
    "unclaimed",
    "effect-pending",
    "effect-accepted",
    "memory-pending",
    "complete",
  ]);
  assert.equal(result.record.physicalAttempts.length, 1);
  assert.equal(gateway.acceptCommands.length, 1);
  assert.equal(memory.projectionCount, 1);
  assert.equal(result.projection.revisionRef, operation.memoryDelta.resultingRevisionRef);
  assert.equal(result.projection.digest, operation.memoryDelta.resultingDigest);
});

test("duplicate exact retry reuses the effect and the same memory entry", () => {
  const gateway = new FakeEffectGateway();
  const memory = new InstructionalMemoryProjectionStore();
  const coordinator = new RecoverableInstructionalOperationCoordinator(gateway, memory);
  const operation = makeOperation();
  const first = coordinator.replay(commercialScope, operation);
  const second = coordinator.replay(commercialScope, structuredClone(operation));

  assert.equal(first.status, "complete");
  assert.equal(second.status, "complete");
  if (first.status !== "complete" || second.status !== "complete") return;
  assert.equal(second.effectDisposition, "reused");
  assert.equal(second.memoryDisposition, "duplicate");
  assert.equal(second.projection.revisionRef, first.projection.revisionRef);
  assert.equal(second.projection.digest, first.projection.digest);
  assert.equal(gateway.acceptCommands.length, 1);
  assert.equal(memory.projectionCount, 1);
});

test("memory failure after effect acceptance remains memory-pending and retry repairs it", () => {
  const gateway = new FakeEffectGateway();
  const store = new InstructionalMemoryProjectionStore();
  const memory = new FlakyMemoryPort(store, 1);
  const coordinator = new RecoverableInstructionalOperationCoordinator(gateway, memory);
  const operation = makeOperation();

  const failed = coordinator.replay(commercialScope, operation);
  assert.equal(failed.status, "pending");
  if (failed.status !== "pending") return;
  assert.equal(failed.record.state, "memory-pending");
  assert.equal(gateway.acceptCommands.length, 1);
  assert.equal(store.projectionCount, 0);

  const repaired = coordinator.replay(commercialScope, operation);
  assert.equal(repaired.status, "complete");
  if (repaired.status !== "complete") return;
  assert.equal(repaired.effectDisposition, "reused");
  assert.equal(repaired.recoveredMemory, true);
  assert.equal(gateway.acceptCommands.length, 1);
  assert.equal(store.projectionCount, 1);
});

test("a fresh coordinator reconstructs missing memory from the accepted minimized event", () => {
  const operation = makeOperation();
  const gateway = new FakeEffectGateway();
  gateway.seed(acceptedEvent(operation));
  const memory = new InstructionalMemoryProjectionStore();
  const recovered = new RecoverableInstructionalOperationCoordinator(
    gateway,
    memory,
  ).replay(commercialScope, operation);

  assert.equal(recovered.status, "complete");
  if (recovered.status !== "complete") return;
  assert.equal(recovered.effectDisposition, "reused");
  assert.equal(recovered.recoveredMemory, true);
  assert.equal(recovered.record.physicalAttempts.length, 0);
  assert.equal(gateway.acceptCommands.length, 0);
  assert.equal(memory.projectionCount, 1);
});

test("crash before effect acceptance permits a new distinct physical attempt", () => {
  const gateway = new FakeEffectGateway("before-acceptance");
  const memory = new InstructionalMemoryProjectionStore();
  const coordinator = new RecoverableInstructionalOperationCoordinator(gateway, memory);
  const operation = makeOperation();

  const crashed = coordinator.replay(commercialScope, operation);
  assert.equal(crashed.status, "pending");
  if (crashed.status !== "pending") return;
  assert.equal(crashed.record.state, "effect-pending");
  assert.equal(memory.projectionCount, 0);

  const retried = coordinator.replay(commercialScope, operation);
  assert.equal(retried.status, "complete");
  if (retried.status !== "complete") return;
  assert.equal(gateway.acceptCommands.length, 2);
  assert.notEqual(
    gateway.acceptCommands[0]?.physicalAttemptRef,
    gateway.acceptCommands[1]?.physicalAttemptRef,
  );
  assert.equal(retried.record.physicalAttempts.length, 2);
});

test("crash after effect acceptance is resolved before memory without a second effect", () => {
  const gateway = new FakeEffectGateway("after-acceptance");
  const memory = new FlakyMemoryPort(new InstructionalMemoryProjectionStore(), 0);
  const coordinator = new RecoverableInstructionalOperationCoordinator(gateway, memory);
  const operation = makeOperation();

  const crashed = coordinator.replay(commercialScope, operation);
  assert.equal(crashed.status, "pending");
  if (crashed.status !== "pending") return;
  assert.equal(crashed.record.state, "effect-pending");
  assert.equal(memory.applyCount, 0);

  const retried = coordinator.replay(commercialScope, operation);
  assert.equal(retried.status, "complete");
  if (retried.status !== "complete") return;
  assert.equal(retried.effectDisposition, "reused");
  assert.equal(gateway.acceptCommands.length, 1);
  assert.equal(memory.applyCount, 1);
});

test("foreign learner, session, interaction, and opportunity are quarantined before effects", () => {
  const foreignScopes = [
    { ...commercialScope, learnerScopeRef: "learner:child-b" },
    { ...commercialScope, sessionRef: "session:math-b" },
    { ...commercialScope, interactionRef: "context:fractions-b" },
    { ...commercialScope, opportunityRef: "opportunity:practice-b" },
  ] as const;

  for (const trustedScope of foreignScopes) {
    const gateway = new FakeEffectGateway();
    const coordinator = new RecoverableInstructionalOperationCoordinator(
      gateway,
      new InstructionalMemoryProjectionStore(),
    );
    const result = coordinator.replay(trustedScope, makeOperation());
    assert.equal(result.status, "quarantined");
    if (result.status === "quarantined") assert.equal(result.code, "FOREIGN_SCOPE");
    assert.equal(gateway.acceptCommands.length, 0);
    assert.equal(gateway.lookupCount, 0);
  }
});

test("duplicate delta is idempotent and does not create a second projection", () => {
  const memory = new InstructionalMemoryProjectionStore();
  const delta = makeOperation().memoryDelta;
  const first = memory.apply(delta);
  const duplicate = memory.apply(structuredClone(delta));

  assert.equal(first.status, "applied");
  assert.equal(duplicate.status, "duplicate");
  assert.equal(memory.projectionCount, 1);
  assert.deepEqual(duplicate.projection, first.projection);
});

test("bounded add, remove, and replace operations advance one expected revision", () => {
  const memory = new InstructionalMemoryProjectionStore();
  const initial = makeOperation();
  const applied = memory.apply(initial.memoryDelta);
  assert.equal(applied.status, "applied");
  const next = makeOperation({
    logicalOperationRef: "logical-operation:hint-b",
    sourceEventRef: "study-event:hint-b-accepted",
    memoryDeltaRef: "memory-delta:hint-b",
    conceptRef: "concept:equivalence",
    prior: applied.projection,
    operations: [
      { operationKind: "remove", field: "conceptRefs", value: "concept:fractions" },
      {
        operationKind: "replace",
        field: "reviewedContentRefs",
        value: ["content:equivalent-fractions-example"],
      },
      { operationKind: "add", field: "conceptRefs", value: "concept:equivalence" },
    ],
  });
  const advanced = memory.apply(next.memoryDelta);
  assert.equal(advanced.status, "applied");
  assert.notEqual(advanced.projection.revisionRef, applied.projection.revisionRef);
  assert.deepEqual(advanced.projection.instructionalState.conceptRefs, [
    "concept:equivalence",
  ]);
  assert.deepEqual(advanced.projection.instructionalState.reviewedContentRefs, [
    "content:equivalent-fractions-example",
  ]);
  assert.equal(memory.projectionCount, 1);
});

test("conflicting delta for the same logical operation is rejected", () => {
  const memory = new InstructionalMemoryProjectionStore();
  const first = makeOperation().memoryDelta;
  const conflicting = makeOperation({
    sourceEventRef: "study-event:hint-a-conflict",
    memoryDeltaRef: "memory-delta:hint-a-conflict",
    conceptRef: "concept:decimals",
    operations: [
      { operationKind: "add", field: "conceptRefs", value: "concept:decimals" },
    ],
  }).memoryDelta;
  assert.equal(memory.apply(first).status, "applied");
  assert.deepEqual(memory.apply(conflicting), {
    status: "rejected",
    code: "CONFLICTING_LOGICAL_OPERATION",
    tutorMayUseMemory: false,
  });
});

test("stale expected memory revision is rejected without changing current memory", () => {
  const memory = new InstructionalMemoryProjectionStore();
  const first = makeOperation().memoryDelta;
  assert.equal(memory.apply(first).status, "applied");
  const stale = makeOperation({
    logicalOperationRef: "logical-operation:hint-b",
    sourceEventRef: "study-event:hint-b-accepted",
    memoryDeltaRef: "memory-delta:hint-b",
  }).memoryDelta;
  assert.deepEqual(memory.apply(stale), {
    status: "rejected",
    code: "STALE_MEMORY_REVISION",
    tutorMayUseMemory: false,
  });
  assert.equal(memory.projectionCount, 1);
});

test("delta creation is timestamp-free and identical construction is deterministic", () => {
  const first = makeOperation().memoryDelta;
  const second = makeOperation().memoryDelta;
  assert.deepEqual(second, first);
  for (const forbidden of ["createdAt", "updatedAt", "capturedAt", "timestamp"]) {
    assert.equal(Object.hasOwn(first, forbidden), false);
  }
});

test("raw transcript and unknown prose carriers are rejected by delta and event schemas", () => {
  const operation = makeOperation();
  assert.equal(
    validateExact(InstructionalMemoryDeltaSchema, {
      ...operation.memoryDelta,
      rawLearnerText: "verbatim private answer",
    }).status,
    "rejected",
  );
  assert.equal(
    validateExact(MinimizedAcceptedStudyEffectEventSchema, {
      ...acceptedEvent(operation),
      rawTranscript: "verbatim conversation",
    }).status,
    "rejected",
  );
  const coordinator = new RecoverableInstructionalOperationCoordinator(
    new FakeEffectGateway(),
    new InstructionalMemoryProjectionStore(),
  );
  assert.deepEqual(coordinator.replay(commercialScope, { ...operation, rawTutorText: "hidden" }), {
    status: "rejected",
    code: "INVALID_RECOVERY_REQUEST",
  });
});

test("authority mutations fail closed and projections remain non-authoritative", () => {
  const operation = makeOperation();
  const memory = new InstructionalMemoryProjectionStore();
  assert.deepEqual(
    memory.apply({ ...operation.memoryDelta, officialMasteryAuthority: true }),
    { status: "rejected", code: "INVALID_MEMORY_DELTA", tutorMayUseMemory: false },
  );
  assert.deepEqual(
    memory.apply({
      ...operation.memoryDelta,
      operations: [
        { operationKind: "replace", field: "masteryStatus", value: "mastered" },
      ],
    }),
    { status: "rejected", code: "INVALID_MEMORY_DELTA", tutorMayUseMemory: false },
  );
  const applied = memory.apply(operation.memoryDelta);
  assert.equal(applied.status, "applied");
  assert.equal(applied.projection.persistenceAllowed, false);
  assert.equal(applied.projection.officialMasteryAuthority, false);
  assert.equal(applied.projection.studyMutationAllowed, false);
  assert.equal(applied.projection.gradeMutationAllowed, false);
  assert.equal(applied.projection.placementMutationAllowed, false);
  assert.equal(applied.projection.curriculumMutationAllowed, false);
});

test("accepted event and retry payload disagreement quarantines the logical operation", () => {
  const operation = makeOperation();
  const gateway = new FakeEffectGateway();
  const event = acceptedEvent(operation);
  gateway.seed({
    ...event,
    memoryDelta: {
      ...event.memoryDelta,
      resultingDigest: `memory-digest:${"f".repeat(64)}`,
    },
  });
  const coordinator = new RecoverableInstructionalOperationCoordinator(
    gateway,
    new InstructionalMemoryProjectionStore(),
  );
  const result = coordinator.replay(commercialScope, operation);
  assert.equal(result.status, "quarantined");
  if (result.status === "quarantined") assert.equal(result.code, "INVALID_ACCEPTED_EVENT");
  assert.equal(gateway.acceptCommands.length, 0);
});
