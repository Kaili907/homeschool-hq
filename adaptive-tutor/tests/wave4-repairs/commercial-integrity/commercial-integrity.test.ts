import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryPhysicalAttemptDispatchClaimStore,
  type CommercialAttempt,
  type CommercialExecutionScope,
} from "../../../core/v3/commercial-operation/index.js";
import {
  executeCommercialTutorInvocation,
  type CommercialAttemptExecutionContext,
  type CommercialProviderTransport,
  type CommercialProviderTransportResult,
  type CommercialTutorExecutionInput,
} from "../../../core/v3/commercial-operation/orchestrate.js";
import {
  MAXIMUM_ALLOWED_RETENTION_CLASSES,
  MAXIMUM_PROVIDER_POLICY_REQUIREMENTS,
} from "../../../core/v3/provider-policy/index.js";
import { createEligibleRouteCatalog } from "../../../core/v3/routing/provider-routing/index.js";
import {
  ManualCommercialOperationClock,
  MutableCommercialExecutionEligibilityResolver,
  ScriptedCommercialTransport,
  commercialUsageReceipt,
  executionInput,
  successfulProviderResponse,
} from "../../tutor-v3-convergence/fixtures.js";

type MutableRecord = Record<string, unknown>;

function trustedScope(input: CommercialTutorExecutionInput): MutableRecord {
  return input.trustedScope as MutableRecord;
}

function expectZeroDispatch(input: CommercialTutorExecutionInput): void {
  const result = executeCommercialTutorInvocation(input);
  assert.equal(result.providerCalls, 0);
  assert.equal(result.telemetry.length, 0);
}

test("canonical commercial flow preserves exact learner attribution", () => {
  const result = executeCommercialTutorInvocation(executionInput());
  assert.equal(result.status, "advisory");
  if (result.status !== "advisory") return;
  assert.equal(result.providerCalls, 1);
  assert.equal(result.reservation.commercialScopeRef, "commercial-scope:commercial-one");
  assert.equal(result.usageReceipts[0]?.commercialScopeRef, "commercial-scope:commercial-one");
  assert.deepEqual(
    [
      result.telemetry[0]?.householdScopeRef,
      result.telemetry[0]?.learnerScopeRef,
      result.telemetry[0]?.sessionRef,
      result.telemetry[0]?.interactionRef,
      result.telemetry[0]?.conceptRef,
      result.telemetry[0]?.opportunityRef,
    ],
    [
      "household-scope:family-one",
      "learner-scope:learner-a",
      "session:commercial-one",
      "interaction:commercial-one",
      "concept:fractions-one",
      "opportunity:fractions-one",
    ],
  );
});

test("sibling household, learner, session, and interaction fail before influence", async (t) => {
  const attacks = [
    ["householdScopeRef", "household-scope:family-two"],
    ["learnerScopeRef", "learner-scope:learner-b"],
    ["sessionRef", "session:sibling"],
    ["interactionRef", "interaction:sibling"],
  ] as const;
  for (const [field, value] of attacks) {
    await t.test(field, () => {
      const input = executionInput();
      const invocation = structuredClone(input.invocation) as MutableRecord;
      invocation[field] = value;
      expectZeroDispatch({ ...input, invocation });
    });
  }
});

test("sibling curriculum tuple fails even when independently valid metadata agrees", () => {
  const input = executionInput();
  const invocation = structuredClone(input.invocation) as MutableRecord;
  const curriculum = invocation.curriculum as MutableRecord;
  curriculum.releaseRef = "family-sibling-r1";
  curriculum.packageRef = "curriculum-package:family-sibling-r1";
  curriculum.version = "3.0.0";
  curriculum.digest = `sha256:${"b".repeat(64)}`;
  curriculum.courseRef = "sibling-mathematics";
  curriculum.unitRef = "sibling-mathematics-u01";
  curriculum.lessonRef = "sibling-mathematics-u01-l01";
  curriculum.conceptRef = "concept:sibling";
  curriculum.opportunityRef = "opportunity:sibling";
  const metadata = structuredClone(input.curriculumMetadata) as MutableRecord;
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
  expectZeroDispatch({ ...input, invocation, curriculumMetadata: metadata });
});

test("sibling route, reservation, and physical-attempt identities fail before dispatch", async (t) => {
  await t.test("route", () => {
    const input = executionInput();
    expectZeroDispatch({
      ...input,
      routing: {
        ...input.routing,
        modelProfiles: input.routing.modelProfiles.map((profile) => ({
          ...profile,
          routeRef: `${profile.routeRef}-sibling`,
        })),
      },
    });
  });
  await t.test("reservation", () => {
    const input = executionInput();
    expectZeroDispatch({
      ...input,
      routing: { ...input.routing, reservationRef: "reservation:sibling" },
    });
  });
  await t.test("physical attempt", () => {
    const input = executionInput();
    expectZeroDispatch({
      ...input,
      routing: {
        ...input.routing,
        physicalAttemptRefs: ["physical-attempt:sibling-one", "physical-attempt:sibling-two"],
      },
    });
  });
});

test("sibling stage, concept, opportunity, and presentation refs fail before dispatch", async (t) => {
  const attacks = [
    ["stage", (invocation: MutableRecord) => {
      invocation.learnerStageRef = "learner-stage:secondary";
    }],
    ["concept", (invocation: MutableRecord) => {
      (invocation.curriculum as MutableRecord).conceptRef = "concept:sibling";
    }],
    ["opportunity", (invocation: MutableRecord) => {
      (invocation.curriculum as MutableRecord).opportunityRef = "opportunity:sibling";
    }],
    ["presentation", (invocation: MutableRecord) => {
      const presentation = invocation.requestedPresentation as MutableRecord;
      const mapping = presentation.mappingContext as MutableRecord;
      mapping.fallbackPresentation = {
        presentationRef: "presentation-fallback:sibling",
        requestedDeliveryChannels: ["text"],
      };
    }],
  ] as const;
  for (const [label, mutate] of attacks) {
    await t.test(label, () => {
      const input = executionInput();
      const invocation = structuredClone(input.invocation) as MutableRecord;
      mutate(invocation);
      expectZeroDispatch({ ...input, invocation });
    });
  }
});

class IdentityReceiptTransport implements CommercialProviderTransport {
  readonly clock = new ManualCommercialOperationClock();
  calls = 0;

  constructor(
    readonly forgedField: "modelRevisionRef" | "configurationDigest",
    readonly forgedValue: string,
  ) {}

  execute(
    _request: unknown,
    attempt: CommercialAttempt,
    context: CommercialAttemptExecutionContext,
  ): CommercialProviderTransportResult {
    this.calls += 1;
    const receipt = commercialUsageReceipt(attempt, context.reservationRef, "100") as MutableRecord;
    receipt[this.forgedField] = this.forgedValue;
    return {
      status: "response",
      response: successfulProviderResponse(),
      usageReceipt: receipt,
    };
  }
}

test("forged model revision and configuration digest never produce advisory", async (t) => {
  const attacks = [
    ["modelRevisionRef", "model-revision:provider-forged"],
    ["configurationDigest", `sha256:${"e".repeat(64)}`],
  ] as const;
  for (const [field, value] of attacks) {
    await t.test(field, () => {
      const transport = new IdentityReceiptTransport(field, value);
      const fixture = executionInput();
      const result = executeCommercialTutorInvocation({
        ...fixture,
        clock: transport.clock,
        transport,
      });
      assert.equal(result.status, "static-fallback");
      assert.equal(result.providerCalls, 1);
    });
  }
});

class StateTransitionTransport implements CommercialProviderTransport {
  readonly clock = new ManualCommercialOperationClock();
  calls = 0;

  constructor(
    readonly resolver: MutableCommercialExecutionEligibilityResolver,
    readonly transition: () => void,
    readonly firstResult: "response" | "failure",
  ) {}

  execute(
    _request: unknown,
    attempt: CommercialAttempt,
    context: CommercialAttemptExecutionContext,
  ): CommercialProviderTransportResult {
    this.calls += 1;
    this.transition();
    if (this.firstResult === "failure") {
      return {
        status: "failure",
        kind: "provider-outage",
        metrics: { inputTokenCount: 0, outputTokenCount: 0, latencyMs: 1, costMicros: "0" },
        usageReceipt: commercialUsageReceipt(attempt, context.reservationRef, "0"),
      };
    }
    return {
      status: "response",
      response: successfulProviderResponse(),
      usageReceipt: commercialUsageReceipt(attempt, context.reservationRef, "100"),
    };
  }
}

test("current availability and circuit state block stale failover authorization", async (t) => {
  const transitions = [
    ["availability", { availabilityState: "OUTAGE" as const }],
    ["circuit", { circuitState: "open" as const }],
  ] as const;
  for (const [label, state] of transitions) {
    await t.test(label, () => {
      const resolver = new MutableCommercialExecutionEligibilityResolver();
      const transport = new StateTransitionTransport(
        resolver,
        () => resolver.setProviderState("provider-profile:beta", state),
        "failure",
      );
      const fixture = executionInput();
      const result = executeCommercialTutorInvocation({
        ...fixture,
        clock: transport.clock,
        transport,
        executionEligibilityResolver: resolver,
      });
      assert.equal(result.status, "static-fallback");
      assert.equal(result.providerCalls, 1);
      assert.equal(transport.calls, 1);
    });
  }
});

test("provider policy revoked during execution invalidates response acceptance", () => {
  const resolver = new MutableCommercialExecutionEligibilityResolver();
  const transport = new StateTransitionTransport(
    resolver,
    () => resolver.setProviderState("provider-profile:alpha", { providerPolicyState: "revoked" }),
    "response",
  );
  const fixture = executionInput();
  const result = executeCommercialTutorInvocation({
    ...fixture,
    clock: transport.clock,
    transport,
    executionEligibilityResolver: resolver,
  });
  assert.equal(result.status, "static-fallback");
  assert.equal(result.providerCalls, 1);
  assert.equal(result.telemetry.length, 0);
});

test("policy requirement cardinality accepts exact max and rejects max+1 or malicious lists", () => {
  const input = executionInput();
  const base = input.routing.providerPolicyRequirements[0];
  assert.ok(base);
  const exact = Array.from({ length: MAXIMUM_PROVIDER_POLICY_REQUIREMENTS }, (_, index) => ({
    ...base,
    providerRef: index < 2
      ? `provider-profile:${index === 0 ? "alpha" : "beta"}`
      : `provider-profile:bounded-${index}`,
  }));
  const catalogInput = {
    providerProfiles: input.routing.providerProfiles,
    modelProfiles: input.routing.modelProfiles,
    providerPolicyRegistry: input.routing.providerPolicyRegistry,
  };
  assert.ok(createEligibleRouteCatalog({ ...catalogInput, providerPolicyRequirements: exact }));
  assert.equal(
    createEligibleRouteCatalog({
      ...catalogInput,
      providerPolicyRequirements: [...exact, { ...base, providerRef: "provider-profile:overflow" }],
    }),
    null,
  );
  assert.equal(
    createEligibleRouteCatalog({
      ...catalogInput,
      providerPolicyRequirements: Array.from({ length: 4_096 }, (_, index) => ({
        ...base,
        providerRef: `provider-profile:malicious-${index}`,
      })),
    }),
    null,
  );
});

test("nested retention lists are bounded and duplicate policy requirements reject", () => {
  const input = executionInput();
  const alpha = input.routing.providerPolicyRequirements[0];
  const beta = input.routing.providerPolicyRequirements[1];
  assert.ok(alpha && beta);
  const catalogInput = {
    providerProfiles: input.routing.providerProfiles,
    modelProfiles: input.routing.modelProfiles,
    providerPolicyRegistry: input.routing.providerPolicyRegistry,
  };
  assert.equal(MAXIMUM_ALLOWED_RETENTION_CLASSES, 3);
  assert.ok(createEligibleRouteCatalog({
    ...catalogInput,
    providerPolicyRequirements: [
      { ...alpha, allowedRetentionClasses: ["none", "transient", "bounded"] },
      beta,
    ],
  }));
  assert.equal(createEligibleRouteCatalog({
    ...catalogInput,
    providerPolicyRequirements: [{
      ...alpha,
      allowedRetentionClasses: Array.from({ length: 4_096 }, () => "none" as const),
    }],
  }), null);
  assert.equal(createEligibleRouteCatalog({
    ...catalogInput,
    providerPolicyRequirements: [alpha, { ...alpha }],
  }), null);
});

test("exact reservation + physical attempt + logical operation dispatches once", () => {
  const claims = new InMemoryPhysicalAttemptDispatchClaimStore();
  const firstTransport = new ScriptedCommercialTransport([
    { status: "response", response: successfulProviderResponse() },
  ]);
  const replayTransport = new ScriptedCommercialTransport([
    { status: "response", response: successfulProviderResponse() },
  ]);
  const first = executeCommercialTutorInvocation(executionInput(firstTransport, {
    dispatchClaims: claims,
  }));
  const replay = executeCommercialTutorInvocation(executionInput(replayTransport, {
    dispatchClaims: claims,
  }));
  assert.equal(first.status, "advisory");
  assert.equal(first.providerCalls, 1);
  assert.equal(replay.status, "static-fallback");
  assert.equal(replay.providerCalls, 0);
  assert.equal(replayTransport.requests.length, 0);
});

test("a newly preplanned physical attempt in the same logical operation remains single-use", () => {
  const claims = new InMemoryPhysicalAttemptDispatchClaimStore();
  const first = executionInput(undefined, { dispatchClaims: claims });
  assert.equal(executeCommercialTutorInvocation(first).status, "advisory");

  const secondTransport = new ScriptedCommercialTransport([
    { status: "response", response: successfulProviderResponse() },
  ]);
  const second = executionInput(secondTransport, { dispatchClaims: claims });
  const secondScope = { ...trustedScope(second) } as CommercialExecutionScope;
  secondScope.scopeRef = "commercial-scope:commercial-one-replan";
  secondScope.physicalAttemptRefs = [
    "physical-attempt:commercial-replan-primary",
    "physical-attempt:commercial-replan-failover",
  ];
  const result = executeCommercialTutorInvocation({
    ...second,
    trustedScope: secondScope,
    routing: {
      ...second.routing,
      physicalAttemptRefs: secondScope.physicalAttemptRefs,
      executionBudget: {
        ...second.routing.executionBudget,
        commercialScopeRef: secondScope.scopeRef,
      },
    },
  });
  assert.equal(result.status, "advisory");
  assert.equal(result.providerCalls, 1);
});
