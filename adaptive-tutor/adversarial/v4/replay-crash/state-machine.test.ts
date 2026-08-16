import assert from "node:assert/strict";
import test from "node:test";
import {
  DeterministicFailureInjector,
  EphemeralReplayCrashCertificationState,
  REPLAY_CRASH_BOUNDARIES,
  ReplayCrashCertificationMachine,
  type AuthorityFreeTelemetryEvent,
  type ReplayCrashOperationRecord,
} from "./state-machine.js";
import { makeReplayCrashRequest } from "./fixtures.js";

function assertFullyRecorded(record: ReplayCrashOperationRecord): void {
  let currentState: ReplayCrashOperationRecord["state"] = "received";
  let previousSequence = 0;
  for (const transition of record.transitions) {
    assert.ok(transition.sequence > previousSequence, "transition sequence must be monotonic");
    assert.equal(transition.stateBefore, currentState, "transition must name its real source state");
    currentState = transition.stateAfter;
    previousSequence = transition.sequence;
  }
  assert.equal(currentState, record.state);
}

function completeWithoutFailure() {
  const state = new EphemeralReplayCrashCertificationState();
  const machine = new ReplayCrashCertificationMachine(state);
  const request = makeReplayCrashRequest();
  const result = machine.run(request);
  assert.equal(result.status, "complete");
  if (result.status !== "complete") throw new Error("expected complete certification fixture");
  return { state, machine, request, result };
}

test("every required commercial boundary crashes deterministically and exact replay converges", async (t) => {
  const baseline = completeWithoutFailure().result.summary;

  for (const boundary of REPLAY_CRASH_BOUNDARIES) {
    await t.test(boundary, () => {
      const state = new EphemeralReplayCrashCertificationState();
      const request = makeReplayCrashRequest();
      const firstProcess = new ReplayCrashCertificationMachine(state);
      const crashed = firstProcess.run(request, new DeterministicFailureInjector(boundary));
      assert.equal(crashed.status, "crashed");
      if (crashed.status !== "crashed") return;
      assert.equal(crashed.boundary, boundary);
      assert.ok(
        crashed.record.transitions.some(
          (transition) =>
            transition.eventKind === "boundary-entered" && transition.boundary === boundary,
        ),
      );
      assert.ok(
        crashed.record.transitions.some(
          (transition) =>
            transition.eventKind === "failure-injected" && transition.boundary === boundary,
        ),
      );

      // A new coordinator instance reuses only the explicit ephemeral certification state.
      const restarted = new ReplayCrashCertificationMachine(state);
      const recovered = restarted.run(request);
      assert.equal(recovered.status, "complete");
      if (recovered.status !== "complete") return;
      assert.deepEqual(recovered.summary, baseline);
      assert.equal(state.study.executionCount, 1, "Study effect must execute at most once");
      assert.equal(state.provider.physicalExecutionCount(), 1);
      assert.equal(state.memory.projectionCount, 1);
      assert.equal(state.telemetry.eventCount, 1);
      assert.equal(state.parent.projectionCount, 1);
      assertFullyRecorded(recovered.record);
    });
  }
});

test("exact replay is a no-op over all accepted commercial side effects", () => {
  const { state, machine, request, result: first } = completeWithoutFailure();
  const counts = {
    provider: state.provider.physicalExecutionCount(),
    study: state.study.executionCount,
    memory: state.memory.projectionCount,
    telemetry: state.telemetry.eventCount,
    parent: state.parent.projectionCount,
  };
  const replayed = machine.run(structuredClone(request));
  assert.equal(replayed.status, "complete");
  if (replayed.status !== "complete") return;
  assert.deepEqual(replayed.summary, first.summary);
  assert.deepEqual(
    {
      provider: state.provider.physicalExecutionCount(),
      study: state.study.executionCount,
      memory: state.memory.projectionCount,
      telemetry: state.telemetry.eventCount,
      parent: state.parent.projectionCount,
    },
    counts,
  );
  assertFullyRecorded(replayed.record);
});

test("changed payload under the same logical operation fails closed", () => {
  const { state, machine } = completeWithoutFailure();
  const conflicting = makeReplayCrashRequest({ contentRef: "content:decimal-fractions" });
  const result = machine.run(conflicting);
  assert.equal(result.status, "quarantined");
  if (result.status !== "quarantined") return;
  assert.equal(result.code, "CONFLICTING_REPLAY");
  assert.equal(state.study.executionCount, 1);
  assert.equal(state.parent.projectionCount, 1);
});

test("same payload cannot introduce an unplanned new physical attempt", () => {
  const { state, machine } = completeWithoutFailure();
  const changedPlan = makeReplayCrashRequest({
    primaryPhysicalAttemptRef: "physical-attempt:replay-001-unplanned",
  });
  const result = machine.run(changedPlan);
  assert.equal(result.status, "quarantined");
  if (result.status !== "quarantined") return;
  assert.equal(result.code, "IMMUTABLE_PLAN_CONFLICT");
  assert.equal(state.provider.physicalExecutionCount(), 1);
  assert.equal(state.study.executionCount, 1);
});

test("same payload may use a new physical attempt only when the immutable plan pre-reserved it", () => {
  const state = new EphemeralReplayCrashCertificationState();
  const request = makeReplayCrashRequest();
  const primary = request.routePlan.attempts[0];
  const failover = request.routePlan.attempts[1];
  assert.ok(primary && failover);
  state.provider.setBehavior(primary.physicalAttemptRef, "confirmed-not-dispatched");
  const machine = new ReplayCrashCertificationMachine(state);
  const result = machine.run(request);
  assert.equal(result.status, "complete");
  if (result.status !== "complete") return;
  assert.equal(result.summary.selectedPhysicalAttemptRef, failover.physicalAttemptRef);
  assert.deepEqual(state.provider.dispatchLog, [
    primary.physicalAttemptRef,
    failover.physicalAttemptRef,
  ]);
  assert.equal(state.provider.physicalExecutionCount(primary.physicalAttemptRef), 0);
  assert.equal(state.provider.physicalExecutionCount(failover.physicalAttemptRef), 1);
  assert.equal(state.study.executionCount, 1);
});

test("provider timeout with unknown dispatch status retains lineage and late response cannot replace failover", () => {
  const state = new EphemeralReplayCrashCertificationState();
  const request = makeReplayCrashRequest();
  const primary = request.routePlan.attempts[0];
  const failover = request.routePlan.attempts[1];
  assert.ok(primary && failover);
  state.provider.setBehavior(primary.physicalAttemptRef, "timeout-unknown");
  const machine = new ReplayCrashCertificationMachine(state);
  const result = machine.run(request);
  assert.equal(result.status, "complete");
  if (result.status !== "complete") return;
  assert.equal(result.summary.selectedPhysicalAttemptRef, failover.physicalAttemptRef);
  assert.deepEqual(result.record.indeterminateAttemptRefs, [primary.physicalAttemptRef]);
  assert.equal(state.provider.physicalExecutionCount(), 2);
  assert.equal(state.study.executionCount, 1);

  const late = state.provider.deliverLateResponse(primary.physicalAttemptRef);
  assert.equal(machine.ingestProviderResponse(request.logicalOperationRef, late), "ignored-late");
  assert.equal(state.study.executionCount, 1);
  assert.equal(state.memory.projectionCount, 1);
  assert.equal(state.parent.projectionCount, 1);
  assert.deepEqual(
    state.parent.read(request.parentProjectionRef),
    result.record.parentProjection,
  );
});

test("unknown dispatch without a pre-reserved failover remains pending and is never redispatched", () => {
  const state = new EphemeralReplayCrashCertificationState();
  const request = makeReplayCrashRequest({ failoverPhysicalAttemptRef: null });
  const primary = request.routePlan.attempts[0];
  assert.ok(primary);
  state.provider.setBehavior(primary.physicalAttemptRef, "timeout-unknown");
  const machine = new ReplayCrashCertificationMachine(state);
  const first = machine.run(request);
  assert.equal(first.status, "pending-dispatch-reconciliation");
  const replay = new ReplayCrashCertificationMachine(state).run(request);
  assert.equal(replay.status, "pending-dispatch-reconciliation");
  assert.equal(state.provider.physicalExecutionCount(primary.physicalAttemptRef), 1);
  assert.deepEqual(state.provider.dispatchLog, [primary.physicalAttemptRef]);
  assert.equal(state.study.executionCount, 0);
});

test("duplicate physical response, effect receipt, memory delta, and telemetry are idempotent", () => {
  const { state, machine, request, result } = completeWithoutFailure();
  const envelope = result.record.providerEnvelope;
  assert.ok(envelope);
  assert.equal(machine.ingestProviderResponse(request.logicalOperationRef, envelope), "duplicate");
  assert.equal(machine.replayStudyEffectReceipt(request.logicalOperationRef), "duplicate");
  assert.equal(machine.replayMemoryDelta(request.logicalOperationRef).status, "duplicate");
  assert.equal(machine.replayTelemetry(request.logicalOperationRef), "duplicate");
  assert.equal(state.provider.physicalExecutionCount(), 1);
  assert.equal(state.study.executionCount, 1);
  assert.equal(state.memory.projectionCount, 1);
  assert.equal(state.telemetry.eventCount, 1);
  assert.equal(state.parent.projectionCount, 1);
});

test("stale memory revision is rejected without mutating accepted state", () => {
  const { state } = completeWithoutFailure();
  const stale = makeReplayCrashRequest({
    logicalOperationRef: "logical-operation:replay-002",
    memoryRef: "memory:replay-001",
  });
  const result = state.memory.apply(stale.memoryDelta);
  assert.deepEqual(result, {
    status: "rejected",
    code: "STALE_MEMORY_REVISION",
    tutorMayUseMemory: false,
  });
  assert.equal(state.memory.projectionCount, 1);
  assert.equal(state.study.executionCount, 1);
});

test("a crash after accepted Study effect repairs memory without repeating the effect", () => {
  const state = new EphemeralReplayCrashCertificationState();
  const request = makeReplayCrashRequest();
  const crashed = new ReplayCrashCertificationMachine(state).run(
    request,
    new DeterministicFailureInjector("after-study-effect-accepted"),
  );
  assert.equal(crashed.status, "crashed");
  assert.equal(state.study.executionCount, 1);
  assert.equal(state.memory.projectionCount, 0);
  const recovered = new ReplayCrashCertificationMachine(state).run(request);
  assert.equal(recovered.status, "complete");
  assert.equal(state.study.executionCount, 1);
  assert.equal(state.memory.projectionCount, 1);
});

test("a crash during memory apply observes duplicate delta on repair", () => {
  const state = new EphemeralReplayCrashCertificationState();
  const request = makeReplayCrashRequest();
  const crashed = new ReplayCrashCertificationMachine(state).run(
    request,
    new DeterministicFailureInjector("during-memory-delta"),
  );
  assert.equal(crashed.status, "crashed");
  assert.equal(state.memory.projectionCount, 1, "the memory store committed before observation failed");
  const recovered = new ReplayCrashCertificationMachine(state).run(request);
  assert.equal(recovered.status, "complete");
  if (recovered.status !== "complete") return;
  assert.ok(
    recovered.record.transitions.some(
      (transition) =>
        transition.eventKind === "idempotent-reuse" &&
        transition.detail === "duplicate memory delta reused",
    ),
  );
  assert.equal(state.study.executionCount, 1);
  assert.equal(state.memory.projectionCount, 1);
});

test("telemetry duplication or forged authority cannot create Study authority", () => {
  const { state, machine, request, result } = completeWithoutFailure();
  const parentBefore = state.parent.read(request.parentProjectionRef);
  assert.equal(machine.replayTelemetry(request.logicalOperationRef), "duplicate");
  const malicious = {
    eventRef: "telemetry-event:forged-authority",
    logicalOperationRef: request.logicalOperationRef,
    physicalAttemptRef: result.summary.selectedPhysicalAttemptRef,
    studyAuthority: true,
    studyMutationAllowed: true,
    instructionalUseAllowed: true,
  } as unknown as AuthorityFreeTelemetryEvent;
  assert.deepEqual(state.telemetry.emit(malicious), { status: "rejected-authority" });
  assert.equal(state.study.executionCount, 1);
  assert.equal(state.telemetry.eventCount, 1);
  assert.deepEqual(state.parent.read(request.parentProjectionRef), parentBefore);
});

test("Parent projection is absent before its boundary and derived only from accepted state on replay", () => {
  const state = new EphemeralReplayCrashCertificationState();
  const request = makeReplayCrashRequest();
  const crashed = new ReplayCrashCertificationMachine(state).run(
    request,
    new DeterministicFailureInjector("before-parent-projection"),
  );
  assert.equal(crashed.status, "crashed");
  assert.equal(state.telemetry.eventCount, 1);
  assert.equal(state.parent.projectionCount, 0);
  assert.equal(state.study.executionCount, 1);
  const completed = new ReplayCrashCertificationMachine(state).run(request);
  assert.equal(completed.status, "complete");
  if (completed.status !== "complete") return;
  assert.equal(state.parent.projectionCount, 1);
  assert.deepEqual(completed.record.parentProjection, {
    projectionRef: request.parentProjectionRef,
    logicalOperationRef: request.logicalOperationRef,
    acceptedStudyReceiptRef: request.studyReceiptRef,
    effectRef: request.effectRef,
    memoryRevisionRef: request.memoryDelta.resultingRevisionRef,
    status: "accepted-state",
  });
});
