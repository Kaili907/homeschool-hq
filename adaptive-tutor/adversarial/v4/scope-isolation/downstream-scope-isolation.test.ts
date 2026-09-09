import assert from "node:assert/strict";
import test from "node:test";
import {
  StudyCommercialEffectReceiptSchema,
  type StudyCommercialTutorAdvisory,
} from "../../../core/v3/contracts/index.js";
import {
  InstructionalMemoryProjectionStore,
  InstructionalMemoryScopeSchema,
  createInstructionalMemoryDelta,
  type InstructionalMemoryDelta,
} from "../../../core/v3/memory/index.js";
import {
  MinimizedAcceptedStudyEffectEventSchema,
  RecoverableInstructionalOperationCoordinator,
  type CanonicalStudyEffectAcceptCommand,
  type CanonicalStudyEffectGateway,
  type CanonicalStudyEffectIdentity,
  type CanonicalStudyEffectLookupResult,
  type MinimizedAcceptedStudyEffectEvent,
} from "../../../core/v3/recovery/index.js";
import {
  TrustedPresentationAcceptanceSchema,
  mapTrustedAcceptedIntentToW306PresentationPieces,
} from "../../../core/v3/presentation/index.js";
import {
  TutorCommercialTelemetryEventSchema,
} from "../../../core/v3/telemetry/index.js";
import {
  recoverAcceptedCommercialEffect,
} from "../../../study-engine/tutor-v2/wave3/index.js";
import {
  buildMinimizedParentHubReport,
} from "../../../study-engine/tutor-v2/parent-reporting/index.js";
import {
  executeCommercialTutorInvocation,
} from "../../../core/v3/commercial-operation/orchestrate.js";
import {
  executionInput,
} from "../../../tests/tutor-v3-convergence/fixtures.js";

const DIGEST = `sha256:${"e".repeat(64)}`;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function schemaCarriesScopeField(
  properties: Record<string, unknown>,
  field: string,
): boolean {
  if (Object.hasOwn(properties, field)) return true;
  const nestedScope = properties.scope;
  if (typeof nestedScope !== "object" || nestedScope === null) return false;
  const nestedProperties = (nestedScope as { properties?: unknown }).properties;
  return typeof nestedProperties === "object" && nestedProperties !== null &&
    Object.hasOwn(nestedProperties, field);
}

function baselineAdvisory(): StudyCommercialTutorAdvisory {
  const result = executeCommercialTutorInvocation(executionInput());
  assert.equal(result.status, "advisory");
  if (result.status !== "advisory") throw new Error("commercial fixture did not produce advisory");
  return result.advisory;
}

function effectReceipt(advisory: StudyCommercialTutorAdvisory): Record<string, unknown> {
  return {
    contractVersion: "study-tutor-v3.commercial-effect-receipt.v1",
    receiptKind: "trusted-study-commercial-effect-receipt",
    issuedBy: "study-engine",
    receiptRef: "study-event:commercial-one-accepted",
    invocationRef: advisory.invocationRef,
    logicalOperationRef: advisory.logicalOperationRef,
    learnerScopeRef: advisory.learnerScopeRef,
    sessionRef: advisory.sessionRef,
    interactionRef: advisory.interactionRef,
    opportunityRef: advisory.opportunityRef,
    decision: "accepted",
    effectRef: "study-effect:commercial-one",
    effectDigest: DIGEST,
    studyProgressCommitted: true,
    tutorMutationAuthorityGranted: false,
  };
}

function memoryDelta(
  receipt: Record<string, unknown>,
  conceptRef = "concept:fractions-one",
): InstructionalMemoryDelta {
  return createInstructionalMemoryDelta({
    logicalOperationRef: receipt.logicalOperationRef as string,
    sourceEventRef: receipt.receiptRef as string,
    memoryDeltaRef: "memory-delta:commercial-one",
    memoryRef: "memory:commercial-one",
    scope: {
      scopeKind: "trusted-study-instructional-memory-scope",
      learnerScopeRef: receipt.learnerScopeRef as string,
      sessionRef: receipt.sessionRef as string,
      contextRef: receipt.interactionRef as string,
      opportunityRef: receipt.opportunityRef as string,
    },
    prior: null,
    operations: [{ operationKind: "add", field: "conceptRefs", value: conceptRef }],
  });
}

class InMemoryAcceptedEffectGateway implements CanonicalStudyEffectGateway {
  accepted: MinimizedAcceptedStudyEffectEvent | null = null;

  lookup(_identity: CanonicalStudyEffectIdentity): CanonicalStudyEffectLookupResult {
    return this.accepted === null
      ? { status: "missing" }
      : { status: "accepted", event: clone(this.accepted) };
  }

  accept(command: CanonicalStudyEffectAcceptCommand) {
    this.accepted = clone(command.acceptedEvent);
    return { status: "accepted" as const, event: clone(command.acceptedEvent) };
  }
}

function recoveryHarness() {
  const gateway = new InMemoryAcceptedEffectGateway();
  const memory = new InstructionalMemoryProjectionStore();
  const coordinator = new RecoverableInstructionalOperationCoordinator(gateway, memory);
  return { gateway, memory, coordinator };
}

test("receipt, advisory, and memory delta exact-scope substitutions are rejected", async (t) => {
  const fields = [
    ["logical operation", "logicalOperationRef", "logical-operation:sibling"],
    ["learner", "learnerScopeRef", "learner-scope:learner-b"],
    ["session", "sessionRef", "session:sibling"],
    ["interaction", "interactionRef", "interaction:sibling"],
    ["opportunity", "opportunityRef", "opportunity:sibling"],
  ] as const;

  for (const [label, key, value] of fields) {
    await t.test(label, () => {
      const advisory = baselineAdvisory();
      const receipt = effectReceipt(advisory);
      receipt[key] = value;
      const delta = memoryDelta(receipt);
      const { coordinator, memory } = recoveryHarness();
      const result = recoverAcceptedCommercialEffect(receipt, advisory, delta, coordinator);
      assert.equal(result.status, "rejected");
      assert.equal(memory.projectionCount, 0);
    });
  }
});

test("A memory scope plus B accepted-effect scope is rejected without mutation", () => {
  const advisory = baselineAdvisory();
  const receipt = effectReceipt(advisory);
  const delta = memoryDelta(receipt);
  const foreignDelta = clone(delta) as unknown as Record<string, unknown>;
  (foreignDelta.scope as Record<string, unknown>).learnerScopeRef = "learner-scope:learner-b";
  const { coordinator, memory } = recoveryHarness();
  const result = recoverAcceptedCommercialEffect(receipt, advisory, foreignDelta, coordinator);
  assert.equal(result.status, "rejected");
  assert.equal(memory.projectionCount, 0);
});

test("accepted commercial effect cannot inject a sibling concept into A memory", () => {
  const advisory = baselineAdvisory();
  const receipt = effectReceipt(advisory);
  const delta = memoryDelta(receipt, "concept:sibling-private");
  const { coordinator, memory } = recoveryHarness();
  const result = recoverAcceptedCommercialEffect(receipt, advisory, delta, coordinator);
  assert.notEqual(
    result.status,
    "complete",
    "foreign concept was accepted into learner A instructional memory",
  );
  assert.equal(memory.projectionCount, 0, "foreign concept mutated learner A memory");
});

test("household scope is carried across effect receipt, memory, and accepted-event contracts", () => {
  const effectProperties = StudyCommercialEffectReceiptSchema.properties as Record<string, unknown>;
  const memoryProperties = InstructionalMemoryScopeSchema.properties as Record<string, unknown>;
  const acceptedProperties = MinimizedAcceptedStudyEffectEventSchema.properties as Record<string, unknown>;
  const contracts: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
    ["StudyCommercialEffectReceipt", effectProperties],
    ["InstructionalMemoryScope", memoryProperties],
    ["MinimizedAcceptedStudyEffectEvent", acceptedProperties],
  ];
  const missing = contracts.filter(([, properties]) =>
    !schemaCarriesScopeField(properties, "householdScopeRef")
  )
    .map(([name]) => name);
  assert.deepEqual(missing, [], `householdScopeRef absent from ${missing.join(", ")}`);
});

test("telemetry carries enough trusted scope to prevent cross-child attribution", () => {
  const properties = TutorCommercialTelemetryEventSchema.properties as Record<string, unknown>;
  const required = [
    "householdScopeRef",
    "learnerScopeRef",
    "sessionRef",
    "interactionRef",
  ];
  const missing = required.filter((field) => !schemaCarriesScopeField(properties, field));
  assert.deepEqual(missing, [], `scope fields absent from telemetry lineage: ${missing.join(", ")}`);
});

test("presentation acceptance is scope-bound before sibling refs can be rendered", () => {
  const properties = TrustedPresentationAcceptanceSchema.properties as Record<string, unknown>;
  const required = [
    "householdScopeRef",
    "learnerScopeRef",
    "sessionRef",
    "interactionRef",
  ];
  const missing = required.filter((field) => !schemaCarriesScopeField(properties, field));
  assert.deepEqual(missing, [], `scope fields absent from presentation acceptance: ${missing.join(", ")}`);
});

test("scope-free sibling presentation acceptance is rejected", () => {
  const foreignAcceptance = {
    acceptanceKind: "trusted-study-provider-output-acceptance",
    acceptanceRef: "presentation-acceptance:sibling",
    presentationIntent: {
      contractVersion: "study-tutor-v2.presentation-intent.v1",
      intentKind: "reference-only-presentation-intent",
      reviewedTextRef: "reviewed-content:sibling-private",
      requestedDeliveryChannels: ["text"],
    },
  };
  assert.notEqual(
    mapTrustedAcceptedIntentToW306PresentationPieces(foreignAcceptance).status,
    "accepted",
    "scope-free sibling presentation acceptance was rendered",
  );
});

function parentReportRequest(): Record<string, unknown> {
  return {
    requestKind: "parent-hub-report",
    reportRef: "report:learner-a-session-one",
    policyRef: "policy:parent-reporting-v1",
    generatedAt: "2026-08-16T15:00:00.000Z",
    scope: {
      scopeKind: "session",
      guardianRef: "guardian:family-one",
      householdScopeRef: "household-scope:family-one",
      selectedLearnerRef: "learner-scope:learner-a",
      sessionRef: "session:commercial-one",
    },
    guardianAuthorization: {
      guardianAuthorizationKind: "study-parent-report-guardian-authorization",
      issuer: "study",
      authorizationRef: "authorization:parent-report-a",
      policyRef: "policy:parent-reporting-v1",
      guardianRef: "guardian:family-one",
      householdScopeRef: "household-scope:family-one",
      learnerScopeRef: "learner-scope:learner-a",
      authorizationRevisionRef: "authorization-revision:parent-report-a-r3",
      currentAuthorizationRevisionRef: "authorization-revision:parent-report-a-r3",
      authorizationRevisionStatus: "current",
      visibility: "parent-report",
      consent: { policyRequirement: "not-required", consentState: "not-required" },
      scopeKind: "session",
      sessionRef: "session:commercial-one",
    },
    evidence: [{
      evidenceRef: "evidence:learner-a-practice",
      learnerRef: "learner-scope:learner-a",
      reasonCode: "practice-completed",
      decisionStatus: null,
      provenance: {
        producer: "study-engine",
        reportingApproval: "study-approved-for-parent-reporting",
        sourceEventRef: "study-event:learner-a-practice",
        policyRef: "policy:parent-reporting-v1",
        recordedAt: "2026-08-16T14:00:00.000Z",
        scope: {
          scopeKind: "session",
          householdScopeRef: "household-scope:family-one",
          learnerScopeRef: "learner-scope:learner-a",
          sessionRef: "session:commercial-one",
        },
      },
    }],
  };
}

test("canonical parent report is accepted only for its exact learner", () => {
  const result = buildMinimizedParentHubReport(parentReportRequest());
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  assert.equal(result.value.scope.householdScopeRef, "household-scope:family-one");
  assert.equal(result.value.scope.learnerScopeRef, "learner-scope:learner-a");
});

test("guardian, household, learner, session, and evidence substitutions cannot produce a Parent report", async (t) => {
  const attacks: ReadonlyArray<readonly [string, (request: Record<string, unknown>) => void]> = [
    ["A guardian + B learner authorization", (request) => {
      (request.guardianAuthorization as Record<string, unknown>).learnerScopeRef = "learner-scope:learner-b";
    }],
    ["foreign guardian", (request) => {
      (request.guardianAuthorization as Record<string, unknown>).guardianRef = "guardian:family-two";
    }],
    ["foreign household", (request) => {
      (request.guardianAuthorization as Record<string, unknown>).householdScopeRef = "household-scope:family-two";
    }],
    ["same IDs under foreign request household", (request) => {
      (request.scope as Record<string, unknown>).householdScopeRef = "household-scope:family-two";
    }],
    ["stale session authorization", (request) => {
      (request.guardianAuthorization as Record<string, unknown>).sessionRef = "session:prior";
    }],
    ["foreign evidence learner", (request) => {
      (request.evidence as Record<string, unknown>[])[0]!.learnerRef = "learner-scope:learner-b";
    }],
    ["foreign evidence household", (request) => {
      const evidence = (request.evidence as Record<string, unknown>[])[0]!;
      const provenance = evidence.provenance as Record<string, unknown>;
      (provenance.scope as Record<string, unknown>).householdScopeRef = "household-scope:family-two";
    }],
    ["foreign evidence session", (request) => {
      const evidence = (request.evidence as Record<string, unknown>[])[0]!;
      const provenance = evidence.provenance as Record<string, unknown>;
      (provenance.scope as Record<string, unknown>).sessionRef = "session:prior";
    }],
  ];

  for (const [label, mutate] of attacks) {
    await t.test(label, () => {
      const request = parentReportRequest();
      mutate(request);
      assert.equal(buildMinimizedParentHubReport(request).status, "rejected");
    });
  }
});
