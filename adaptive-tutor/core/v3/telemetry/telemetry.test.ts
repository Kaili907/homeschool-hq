import assert from "node:assert/strict";
import test from "node:test";
import { Value } from "../../schema/value.js";
import {
  COMMERCIAL_EXECUTION_SCOPE_VERSION,
  type CommercialAttempt,
} from "../commercial-operation/index.js";
import {
  BUDGET_RESILIENCE_VERSION,
  type BudgetReservation,
} from "../routing/budget-resilience/index.js";
import {
  TutorCommercialTelemetryEventSchema,
  projectTutorCommercialTelemetry,
} from "./index.js";

const CONFIG_DIGEST = `sha256:${"a".repeat(64)}`;
const PROFILE_DIGEST = `sha256:${"b".repeat(64)}`;

function attempt(overrides: Partial<CommercialAttempt> = {}): CommercialAttempt {
  return {
    commercialScopeRef: "commercial-scope:telemetry-001",
    logicalOperationRef: "logical-operation:telemetry-001",
    physicalAttemptRef: "physical-attempt:telemetry-001-primary",
    attemptIndex: 0,
    role: "primary",
    routeRef: "route:telemetry-primary-r1",
    providerRef: "provider:opaque-001",
    modelRef: "model:opaque-001",
    modelRevisionRef: "model-revision:opaque-001-r7",
    configurationDigest: CONFIG_DIGEST,
    capabilityProfileRevisionRef: "capability-profile:opaque-001-r4",
    capabilityProfileDigest: PROFILE_DIGEST,
    providerPolicyRevisionRef: "provider-policy-revision:commercial-r7",
    providerPolicyEvidenceRef: "provider-policy-evidence:commercial-r7",
    reservedCostMicros: "9007199254740992",
    timeoutMs: 2_000,
    ...overrides,
  };
}

function reservation(
  reservedAttempt = attempt(),
  overrides: Partial<BudgetReservation> = {},
): BudgetReservation {
  return {
    contractVersion: BUDGET_RESILIENCE_VERSION,
    reservationRef: "reservation:telemetry-001",
    commercialScopeRef: reservedAttempt.commercialScopeRef,
    logicalOperationRef: reservedAttempt.logicalOperationRef,
    status: "reserved",
    totalReservedMicros: reservedAttempt.reservedCostMicros,
    attempts: [reservedAttempt],
    ...overrides,
  };
}

function commercialScope() {
  return {
    scopeVersion: COMMERCIAL_EXECUTION_SCOPE_VERSION,
    scopeKind: "trusted-study-commercial-execution-scope" as const,
    issuedBy: "study-engine" as const,
    scopeRef: "commercial-scope:telemetry-001",
    householdScopeRef: "household-scope:telemetry-001",
    learnerScopeRef: "learner-scope:telemetry-001",
    sessionRef: "session:telemetry-001",
    interactionRef: "interaction:telemetry-001",
    logicalOperationRef: "logical-operation:telemetry-001",
    curriculumReleaseRef: "telemetry-r1",
    curriculumPackageRef: "curriculum-package:telemetry-001",
    curriculumCourseRef: "telemetry-course",
    curriculumSubjectRef: "mathematics",
    curriculumUnitRef: "telemetry-unit",
    curriculumLessonRef: "telemetry-lesson",
    conceptRef: "concept:telemetry-001",
    opportunityRef: "opportunity:telemetry-001",
    learnerStageRef: "learner-stage:middle-grades",
    presentationRef: "presentation-fallback:telemetry-001",
    routingRequestRef: "routing-request:telemetry-001",
    routePlanRef: "route-plan:telemetry-001",
    reservationRef: "reservation:telemetry-001",
    physicalAttemptRefs: [
      "physical-attempt:telemetry-001-primary",
      "physical-attempt:telemetry-001-failover",
    ],
    allowedRouteRefs: ["route:telemetry-primary-r1", "route:telemetry-failover-r1"],
    telemetryEventRefs: ["event:tutor-operation-001", "event:tutor-operation-002"],
  };
}

function lineage(currentAttempt = attempt(), currentReservation = reservation(currentAttempt)) {
  return { commercialScope: commercialScope(), attempt: currentAttempt, reservation: currentReservation };
}

function source(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: "success",
    eventRef: "event:tutor-operation-001",
    actionFamily: "hint",
    routeClass: "hosted-standard",
    metrics: {
      inputTokenCount: 120,
      outputTokenCount: 45,
      latencyMs: 731,
      costMicros: "1250",
    },
    cacheClass: "miss",
    fallbackClass: "none",
    ...overrides,
  };
}

function requireEvent(input: unknown, commercialLineage: unknown = lineage()) {
  const result = projectTutorCommercialTelemetry(input, commercialLineage);
  assert.equal(result.status, "projected");
  if (result.status !== "projected") throw new Error("Expected a projected event");
  assert.equal(Value.Check(TutorCommercialTelemetryEventSchema, result.event), true);
  return result.event;
}

test("projects exact commercial attempt and reservation lineage", () => {
  const event = requireEvent(source());
  assert.deepEqual(event, {
    contractVersion: "3.1.0",
    eventKind: "tutor-commercial-operation",
    eventRef: "event:tutor-operation-001",
    commercialScopeRef: "commercial-scope:telemetry-001",
    householdScopeRef: "household-scope:telemetry-001",
    learnerScopeRef: "learner-scope:telemetry-001",
    sessionRef: "session:telemetry-001",
    interactionRef: "interaction:telemetry-001",
    conceptRef: "concept:telemetry-001",
    opportunityRef: "opportunity:telemetry-001",
    logicalOperationRef: "logical-operation:telemetry-001",
    physicalAttemptRef: "physical-attempt:telemetry-001-primary",
    reservationRef: "reservation:telemetry-001",
    routeRef: "route:telemetry-primary-r1",
    providerRef: "provider:opaque-001",
    modelRef: "model:opaque-001",
    modelRevisionRef: "model-revision:opaque-001-r7",
    configurationDigest: CONFIG_DIGEST,
    capabilityProfileRevisionRef: "capability-profile:opaque-001-r4",
    capabilityProfileDigest: PROFILE_DIGEST,
    providerPolicyRevisionRef: "provider-policy-revision:commercial-r7",
    providerPolicyEvidenceRef: "provider-policy-evidence:commercial-r7",
    attemptIndex: 0,
    role: "primary",
    actionFamily: "hint",
    routeClass: "hosted-standard",
    inputTokenCount: 120,
    outputTokenCount: 45,
    latencyMs: 731,
    costMicros: "1250",
    cacheClass: "miss",
    fallbackClass: "none",
    outcome: "success",
    reasonCode: "COMPLETED",
    authorityScope: "commercial-operations-only",
    instructionalUseAllowed: false,
    studyAuthority: false,
    studyMutationAllowed: false,
  });
  assert.equal(Object.isFrozen(event), true);
});

test("correlates primary and failover attempts under one logical operation", () => {
  const failover = attempt({
    physicalAttemptRef: "physical-attempt:telemetry-001-failover",
    attemptIndex: 1,
    role: "failover",
    routeRef: "route:telemetry-failover-r1",
    providerRef: "provider:opaque-002",
    modelRef: "model:opaque-002",
    modelRevisionRef: "model-revision:opaque-002-r2",
    providerPolicyEvidenceRef: "provider-policy-evidence:commercial-failover-r2",
    reservedCostMicros: "2000",
  });
  const primary = attempt();
  const sharedReservation = reservation(primary, {
    totalReservedMicros: "9007199254742992",
    attempts: [primary, failover],
  });
  const primaryEvent = requireEvent(source(), lineage(primary, sharedReservation));
  const failoverEvent = requireEvent(
    source({ eventRef: "event:tutor-operation-002", fallbackClass: "alternate-provider" }),
    lineage(failover, sharedReservation),
  );
  assert.equal(primaryEvent.logicalOperationRef, failoverEvent.logicalOperationRef);
  assert.notEqual(primaryEvent.physicalAttemptRef, failoverEvent.physicalAttemptRef);
  assert.equal(primaryEvent.reservationRef, failoverEvent.reservationRef);
  assert.equal(failoverEvent.role, "failover");
});

test("rejects physical-attempt and logical-operation lineage mismatches", () => {
  const reserved = attempt();
  const wrongPhysical = attempt({ physicalAttemptRef: "physical-attempt:not-reserved" });
  assert.deepEqual(
    projectTutorCommercialTelemetry(source(), lineage(wrongPhysical, reservation(reserved))),
    { status: "rejected", reasonCode: "INVALID_COMMERCIAL_LINEAGE" },
  );

  const wrongLogical = reservation(reserved, {
    logicalOperationRef: "logical-operation:different",
  });
  assert.deepEqual(
    projectTutorCommercialTelemetry(source(), lineage(reserved, wrongLogical)),
    { status: "rejected", reasonCode: "INVALID_COMMERCIAL_LINEAGE" },
  );
});

test("redacts learner, prompt, response, provider prose, and credentials", () => {
  const canaries = [
    "LEARNER_ANSWER_CANARY",
    "TUTOR_TRANSCRIPT_CANARY",
    "PROMPT_TEXT_CANARY",
    "PROVIDER_PROSE_CANARY",
    "LEARNER_NAME_CANARY",
    "CREDENTIAL_CANARY",
  ];
  let forbiddenGetterReads = 0;
  const input = source({
    learnerAnswer: canaries[0],
    tutorTranscript: canaries[1],
    promptText: canaries[2],
    providerResponse: canaries[3],
    learnerName: canaries[4],
    credentials: { bearerToken: canaries[5] },
    providerRef: "provider:caller-cannot-override-lineage",
    modelRef: "model:caller-cannot-override-lineage",
  });
  Object.defineProperty(input, "rawPrompt", {
    enumerable: true,
    get() {
      forbiddenGetterReads += 1;
      return canaries[2];
    },
  });

  const event = requireEvent(input);
  const serialized = JSON.stringify(event);
  assert.equal(forbiddenGetterReads, 0);
  for (const canary of canaries) assert.equal(serialized.includes(canary), false);
  assert.equal(event.providerRef, "provider:opaque-001");
  assert.equal(event.modelRef, "model:opaque-001");
});

test("unknown failure prose becomes bounded outcome and fallback codes", () => {
  const secretFailure = "provider said CREDENTIAL_CANARY while answering learner prose";
  const event = requireEvent(source({
    status: "failure",
    reasonCode: secretFailure,
    actionFamily: "not-a-safe-family",
    routeClass: "provider-secret-route",
    cacheClass: "learner-name-cache",
    fallbackClass: "transcript-backed-fallback",
  }));
  assert.equal(event.outcome, "failure");
  assert.equal(event.reasonCode, "UNKNOWN_FAILURE");
  assert.equal(event.actionFamily, "none");
  assert.equal(event.routeClass, "unknown");
  assert.equal(event.cacheClass, "not-applicable");
  assert.equal(event.fallbackClass, "unknown");
  assert.equal(JSON.stringify(event).includes(secretFailure), false);
});

test("known failure reason and alternate-provider fallback remain observable", () => {
  const event = requireEvent(source({
    status: "failure",
    actionFamily: "none",
    reasonCode: "PROVIDER_TIMEOUT",
    fallbackClass: "alternate-provider",
  }));
  assert.equal(event.reasonCode, "PROVIDER_TIMEOUT");
  assert.equal(event.fallbackClass, "alternate-provider");
});

test("money remains a canonical decimal string beyond Number.MAX_SAFE_INTEGER", () => {
  const value = "9007199254740992";
  const event = requireEvent(source({
    metrics: { inputTokenCount: 1, outputTokenCount: 1, latencyMs: 1, costMicros: value },
  }));
  assert.equal(event.costMicros, value);
  assert.equal(typeof event.costMicros, "string");
});

test("rejects malformed, negative, decimal, overflowing, and JS-number money", () => {
  for (const invalidValue of ["-1", "1.0", "01", "9223372036854775808", 1250, 1n]) {
    const result = projectTutorCommercialTelemetry(source({
      metrics: { inputTokenCount: 1, outputTokenCount: 1, latencyMs: 1, costMicros: invalidValue },
    }), lineage());
    assert.deepEqual(result, { status: "rejected", reasonCode: "INVALID_NUMERIC_METRIC" });
  }
});

test("rejects unsafe counter and latency measurements without narrowing money", () => {
  for (const metric of ["inputTokenCount", "outputTokenCount", "latencyMs"]) {
    const result = projectTutorCommercialTelemetry(source({
      metrics: {
        inputTokenCount: 1,
        outputTokenCount: 1,
        latencyMs: 1,
        costMicros: "1",
        [metric]: Number.MAX_SAFE_INTEGER + 1,
      },
    }), lineage());
    assert.deepEqual(result, { status: "rejected", reasonCode: "INVALID_NUMERIC_METRIC" }, metric);
  }
});

test("closed schema rejects prose and Tutor or Study authority elevation", () => {
  const event = requireEvent(source());
  assert.equal(Value.Check(TutorCommercialTelemetryEventSchema, { ...event, promptText: "prose" }), false);
  assert.equal(Value.Check(TutorCommercialTelemetryEventSchema, { ...event, instructionalUseAllowed: true }), false);
  assert.equal(Value.Check(TutorCommercialTelemetryEventSchema, { ...event, studyAuthority: true }), false);
  assert.equal(Value.Check(TutorCommercialTelemetryEventSchema, { ...event, studyMutationAllowed: true }), false);
});

test("allowed-field accessors are rejected without execution", () => {
  let reads = 0;
  const input = source();
  Object.defineProperty(input, "eventRef", {
    enumerable: true,
    get() {
      reads += 1;
      return "event:accessor";
    },
  });
  const result = projectTutorCommercialTelemetry(input, lineage());
  assert.equal(result.status, "rejected");
  assert.equal(reads, 0);
});
