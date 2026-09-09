import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { validateExact } from "../../core/v2/contracts/validation.js";
import {
  executeCommercialTutorInvocation,
} from "../../core/v3/commercial-operation/orchestrate.js";
import {
  StudyCommercialTutorAdvisorySchema,
  StudyCommercialTutorInvocationSchema,
} from "../../core/v3/contracts/index.js";
import {
  ScriptedCommercialTransport,
  executionInput,
  successfulProviderResponse,
} from "./fixtures.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

test("canonical commercial flow returns only a Study advisory", () => {
  const transport = new ScriptedCommercialTransport([
    { status: "response", response: successfulProviderResponse() },
  ]);
  const result = executeCommercialTutorInvocation(executionInput(transport));
  assert.equal(result.status, "advisory");
  if (result.status !== "advisory") return;
  assert.equal(result.providerCalls, 1);
  assert.equal(result.advisory.status, "proposed");
  assert.equal(result.advisory.proposedTutorAction, "hint");
  assert.equal(result.advisory.studyDecisionRequired, true);
  assert.equal(result.advisory.studyMutationAllowed, false);
  assert.equal(result.advisory.segmentCompletionAuthority, false);
  assert.equal(validateExact(StudyCommercialTutorAdvisorySchema, result.advisory).status, "accepted");
  assert.equal(result.telemetry.length, 1);
  assert.equal(result.telemetry[0]?.logicalOperationRef, "logical-operation:commercial-one");
  assert.equal(result.telemetry[0]?.physicalAttemptRef, "physical-attempt:commercial-primary");
  assert.equal(result.usageReceipts.length, 1);
  assert.equal(result.usageReceipts[0]?.physicalAttemptRef, "physical-attempt:commercial-primary");
  assert.equal(result.settlement.actualCostMicros, "100");
  assert.equal(result.settlement.releasedCostMicros, "100");
  assert.deepEqual(transport.contexts[0], {
    reservationRef: "reservation:commercial-one",
    operationStartedAtMs: 0,
    operationDeadlineAtMs: 2_000,
    attemptStartedAtMs: 0,
    attemptDeadlineAtMs: 700,
    attemptTimeoutMs: 700,
    remainingOperationMs: 2_000,
  });
});

test("provider request is structurally minimized", () => {
  const transport = new ScriptedCommercialTransport([
    { status: "response", response: successfulProviderResponse() },
  ]);
  const result = executeCommercialTutorInvocation(executionInput(transport));
  assert.equal(result.status, "advisory");
  const serialized = JSON.stringify(transport.requests[0]);
  for (const forbidden of [
    "learnerResponse", "studentAnswer", "correctAnswer", "answerIndex",
    "transcript", "conversationHistory", "audio", "imageBytes", "credential",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  assert.equal((transport.requests[0] as { rawAttemptDisclosureAllowed?: unknown }).rawAttemptDisclosureAllowed, false);
  assert.deepEqual(
    (transport.requests[0] as { academicScope?: unknown }).academicScope,
    {
      subjectRef: "subject:mathematics",
      courseRef: "course:ma-g5-mathematics",
      conceptRef: "concept:fractions-one",
    },
  );
});

test("curriculum admission happens before provider execution", () => {
  const transport = new ScriptedCommercialTransport([]);
  const input = executionInput(transport);
  const invocation = clone(input.invocation as Record<string, unknown>);
  (invocation.curriculum as Record<string, unknown>).courseRef = "ma-g6-mathematics";
  const result = executeCommercialTutorInvocation({ ...input, invocation });
  assert.equal(result.status, "static-fallback");
  assert.equal(transport.requests.length, 0);
});

test("foreign trusted invocation curriculum digest fails before provider execution", () => {
  const transport = new ScriptedCommercialTransport([
    { status: "response", response: successfulProviderResponse() },
  ]);
  const input = executionInput(transport);
  const invocation = clone(input.invocation as Record<string, unknown>);
  (invocation.curriculum as Record<string, unknown>).digest = `sha256:${"e".repeat(64)}`;
  const result = executeCommercialTutorInvocation({ ...input, invocation });
  assert.equal(result.status, "static-fallback");
  assert.equal(transport.requests.length, 0);
});

test("top-level science subject cannot execute admitted mathematics curriculum", () => {
  const transport = new ScriptedCommercialTransport([
    { status: "response", response: successfulProviderResponse() },
  ]);
  const input = executionInput(transport);
  const invocation = clone(input.invocation as Record<string, unknown>);
  invocation.subjectRef = "subject:science";
  const result = executeCommercialTutorInvocation({ ...input, invocation });
  assert.equal(result.status, "static-fallback");
  assert.equal(transport.requests.length, 0);
});

test("every trusted curriculum authority tuple field reconciles before transport", () => {
  const attacks: Array<{
    name: string;
    mutate: (input: ReturnType<typeof executionInput>, invocation: Record<string, unknown>) => void;
  }> = [
    {
      name: "release ref",
      mutate: (_input, invocation) => {
        (invocation.curriculum as Record<string, unknown>).releaseRef = "foreign-release";
      },
    },
    {
      name: "package ref",
      mutate: (_input, invocation) => {
        (invocation.curriculum as Record<string, unknown>).packageRef = "curriculum-package:foreign";
      },
    },
    {
      name: "release version",
      mutate: (_input, invocation) => {
        (invocation.curriculum as Record<string, unknown>).version = "2.0.1";
      },
    },
    {
      name: "release digest",
      mutate: (_input, invocation) => {
        (invocation.curriculum as Record<string, unknown>).digest = `sha256:${"e".repeat(64)}`;
      },
    },
    {
      name: "subject",
      mutate: (_input, invocation) => {
        (invocation.curriculum as Record<string, unknown>).subjectId = "science";
      },
    },
    {
      name: "course",
      mutate: (_input, invocation) => {
        (invocation.curriculum as Record<string, unknown>).courseRef = "ma-g5-science";
      },
    },
    {
      name: "unit",
      mutate: (_input, invocation) => {
        (invocation.curriculum as Record<string, unknown>).unitRef = "ma-g5-mathematics-u99";
      },
    },
    {
      name: "lesson",
      mutate: (_input, invocation) => {
        (invocation.curriculum as Record<string, unknown>).lessonRef = "ma-g5-mathematics-u01-l99";
      },
    },
  ];

  for (const attack of attacks) {
    const transport = new ScriptedCommercialTransport([
      { status: "response", response: successfulProviderResponse() },
    ]);
    const input = executionInput(transport);
    const invocation = clone(input.invocation as Record<string, unknown>);
    attack.mutate(input, invocation);
    const result = executeCommercialTutorInvocation({ ...input, invocation });
    assert.equal(result.status, "static-fallback", attack.name);
    assert.equal(transport.requests.length, 0, attack.name);
  }
});

test("active assessment remains static-only and cannot expose answers", () => {
  const transport = new ScriptedCommercialTransport([]);
  const input = executionInput(transport);
  const invocation = clone(input.invocation as Record<string, unknown>);
  invocation.assessmentPhase = "active-graded-or-mastery-check";
  (invocation.groundedContext as Record<string, unknown>).assessmentPhase = "active-graded-or-mastery-check";
  const result = executeCommercialTutorInvocation({ ...input, invocation });
  assert.equal(result.status, "static-fallback");
  assert.equal(transport.requests.length, 0);
});

test("unknown learner stage fails closed before provider execution", () => {
  const transport = new ScriptedCommercialTransport([]);
  const input = executionInput(transport);
  const invocation = clone(input.invocation as Record<string, unknown>);
  invocation.learnerStageRef = "learner-stage:not-approved";
  const result = executeCommercialTutorInvocation({ ...input, invocation });
  assert.equal(result.status, "static-fallback");
  assert.equal(transport.requests.length, 0);
});

test("provider policy revision mismatch fails before routing", () => {
  const transport = new ScriptedCommercialTransport([]);
  const input = executionInput(transport);
  const requirements = input.routing.providerPolicyRequirements.map((item) => ({
    ...item,
    requiredContractPolicyRevision: "provider-policy-revision:foreign",
  }));
  const result = executeCommercialTutorInvocation({
    ...input,
    routing: { ...input.routing, providerPolicyRequirements: requirements },
  });
  assert.equal(result.status, "static-fallback");
  assert.equal(transport.requests.length, 0);
});

test("route and reservation preserve immutable model identity and integer micros", () => {
  const result = executeCommercialTutorInvocation(executionInput());
  assert.equal(result.status, "advisory");
  if (result.status !== "advisory") return;
  const attempt = result.reservation.attempts[0];
  assert.match(attempt?.modelRevisionRef ?? "", /^model-revision:/);
  assert.match(attempt?.configurationDigest ?? "", /^sha256:[a-f0-9]{64}$/);
  assert.match(attempt?.capabilityProfileDigest ?? "", /^sha256:[a-f0-9]{64}$/);
  assert.match(attempt?.reservedCostMicros ?? "", /^(0|[1-9][0-9]*)$/);
  assert.equal(typeof attempt?.reservedCostMicros, "string");
});

test("one preplanned failover is used after a retryable primary failure", () => {
  const transport = new ScriptedCommercialTransport([
    {
      status: "failure",
      kind: "provider-timeout",
      metrics: { inputTokenCount: 50, outputTokenCount: 0, latencyMs: 100, costMicros: "0" },
    },
    { status: "response", response: successfulProviderResponse() },
  ]);
  const result = executeCommercialTutorInvocation(executionInput(transport));
  assert.equal(result.status, "advisory");
  assert.equal(result.providerCalls, 2);
  assert.equal(transport.requests.length, 2);
  assert.equal(result.telemetry.length, 2);
  assert.equal(result.telemetry[1]?.role, "failover");
  if (result.status === "advisory") {
    assert.equal(result.settlement.outcome, "indeterminate-hold");
    assert.equal(result.settlement.consumedCostMicros, "200");
    assert.equal(result.settlement.releasedCostMicros, "0");
  }
});

test("deadline exhaustion blocks failover and returns reviewed static fallback", () => {
  const transport = new ScriptedCommercialTransport([
    {
      status: "failure",
      kind: "provider-timeout",
      metrics: { inputTokenCount: 50, outputTokenCount: 0, latencyMs: 1_300, costMicros: "0" },
    },
  ]);
  const result = executeCommercialTutorInvocation(executionInput(transport));
  assert.equal(result.status, "static-fallback");
  assert.equal(result.providerCalls, 1);
});

test("a 10,000 ms successful response cannot bypass 2,000/700 ms deadlines", () => {
  const transport = new ScriptedCommercialTransport([{
    status: "response",
    response: successfulProviderResponse({
      metrics: {
        inputTokenCount: 120,
        outputTokenCount: 30,
        latencyMs: 10_000,
        costMicros: "100",
      },
    }),
  }]);
  const result = executeCommercialTutorInvocation(executionInput(transport));
  assert.equal(result.status, "static-fallback");
});

test("measured execution over attempt timeout rejects low reported latency", () => {
  const transport = new ScriptedCommercialTransport([{
    status: "response",
    observedExecutionMs: 800,
    response: successfulProviderResponse(),
  }]);
  const result = executeCommercialTutorInvocation(executionInput(transport));
  assert.equal(result.status, "static-fallback");
});

test("measured operation time blocks failover despite low reported latency", () => {
  const transport = new ScriptedCommercialTransport([{
    status: "failure",
    kind: "provider-timeout",
    observedExecutionMs: 1_300,
    metrics: { inputTokenCount: 50, outputTokenCount: 0, latencyMs: 100, costMicros: "0" },
  }]);
  const result = executeCommercialTutorInvocation(executionInput(transport));
  assert.equal(result.status, "static-fallback");
  assert.equal(result.providerCalls, 1);
});

test("an attempt is not dispatched when its bounded window crosses the operation deadline", () => {
  const transport = new ScriptedCommercialTransport([{
    status: "response",
    response: successfulProviderResponse(),
  }]);
  const input = executionInput(transport);
  const readings = [0, 1_300];
  const result = executeCommercialTutorInvocation({
    ...input,
    clock: { nowMs: () => readings.shift() ?? 1_300 },
  });
  assert.equal(result.status, "static-fallback");
  assert.equal(result.providerCalls, 0);
});

test("late successful failover cannot become a Study advisory", () => {
  const transport = new ScriptedCommercialTransport([
    {
      status: "failure",
      kind: "provider-outage",
      metrics: { inputTokenCount: 20, outputTokenCount: 0, latencyMs: 100, costMicros: "20" },
    },
    {
      status: "response",
      observedExecutionMs: 800,
      response: successfulProviderResponse(),
    },
  ]);
  const result = executeCommercialTutorInvocation(executionInput(transport));
  assert.equal(result.status, "static-fallback");
  assert.equal(result.providerCalls, 2);
});

test("a physical attempt cannot overrun its reserve using unused failover reserve", () => {
  const transport = new ScriptedCommercialTransport([{
    status: "response",
    response: successfulProviderResponse({
      metrics: {
        inputTokenCount: 120,
        outputTokenCount: 30,
        latencyMs: 100,
        costMicros: "150",
      },
    }),
  }]);
  const result = executeCommercialTutorInvocation(executionInput(transport));
  assert.equal(result.status, "static-fallback");
});

test("failover cannot overrun its own reserve", () => {
  const transport = new ScriptedCommercialTransport([
    {
      status: "failure",
      kind: "provider-timeout",
      metrics: { inputTokenCount: 50, outputTokenCount: 0, latencyMs: 100, costMicros: "0" },
    },
    {
      status: "response",
      response: successfulProviderResponse({
        metrics: {
          inputTokenCount: 120,
          outputTokenCount: 30,
          latencyMs: 100,
          costMicros: "101",
        },
      }),
    },
  ]);
  const result = executeCommercialTutorInvocation(executionInput(transport));
  assert.equal(result.status, "static-fallback");
  assert.equal(result.providerCalls, 2);
});

test("both executed attempts settle when each stays within its own reserve", () => {
  const transport = new ScriptedCommercialTransport([
    {
      status: "failure",
      kind: "provider-outage",
      metrics: { inputTokenCount: 20, outputTokenCount: 0, latencyMs: 100, costMicros: "20" },
    },
    {
      status: "response",
      response: successfulProviderResponse({
        metrics: {
          inputTokenCount: 120,
          outputTokenCount: 30,
          latencyMs: 100,
          costMicros: "80",
        },
      }),
    },
  ]);
  const result = executeCommercialTutorInvocation(executionInput(transport));
  assert.equal(result.status, "advisory");
  assert.equal(result.providerCalls, 2);
  if (result.status === "advisory") {
    assert.equal(result.usageReceipts.length, 2);
    assert.equal(result.settlement.actualCostMicros, "100");
    assert.equal(result.settlement.releasedCostMicros, "100");
  }
});

test("usage receipt physical-attempt and reservation identities are authoritative", () => {
  for (const [field, value] of [
    ["physicalAttemptRef", "physical-attempt:foreign"],
    ["reservationRef", "reservation:foreign"],
  ] as const) {
    const transport = new ScriptedCommercialTransport([{
      status: "response",
      response: successfulProviderResponse(),
      usageReceipt: {
        contractVersion: "study-tutor-v3.commercial-attempt-usage-receipt.v1",
        receiptKind: "commercial-attempt-usage-receipt",
        logicalOperationRef: "logical-operation:commercial-one",
        physicalAttemptRef: "physical-attempt:commercial-primary",
        reservationRef: "reservation:commercial-one",
        routeRef: "route-profile:alpha",
        attemptIndex: 0,
        role: "primary",
        reservedCostMicros: "100",
        actualCostMicros: "100",
        [field]: value,
      },
    }]);
    const result = executeCommercialTutorInvocation(executionInput(transport));
    assert.equal(result.status, "static-fallback", field);
  }
});

test("unknown and authority-bearing provider fields are rejected", () => {
  const authorityOutput = successfulProviderResponse({ officialMastery: true });
  const result = executeCommercialTutorInvocation(executionInput(
    new ScriptedCommercialTransport([{ status: "response", response: authorityOutput }]),
  ));
  assert.equal(result.status, "static-fallback");
  if (result.status === "static-fallback") {
    assert.deepEqual(result.advisory.reasonCodes, ["UNTRUSTED_MODEL_OUTPUT_REJECTED"]);
  }
});

test("unsupported grounded claim forces refusal/static fallback", () => {
  const response = successfulProviderResponse({ groundedClaims: [] });
  const result = executeCommercialTutorInvocation(executionInput(
    new ScriptedCommercialTransport([{ status: "response", response }]),
  ));
  assert.equal(result.status, "static-fallback");
  if (result.status === "static-fallback") {
    assert.deepEqual(result.advisory.reasonCodes, ["INSUFFICIENT_GROUNDED_CONTEXT"]);
  }
});

test("closed presentation intent rejects provider-custom modes", () => {
  const response = successfulProviderResponse();
  ((response as { output: Record<string, unknown> }).output).instructionalDisplayMode = "custom-rich-media";
  const result = executeCommercialTutorInvocation(executionInput(
    new ScriptedCommercialTransport([{ status: "response", response }]),
  ));
  assert.equal(result.status, "static-fallback");
});

test("foreign learner scope cannot influence the invocation", () => {
  const input = executionInput();
  const invocation = clone(input.invocation as Record<string, unknown>);
  invocation.learnerScopeRef = "learner-scope:learner-b";
  const result = executeCommercialTutorInvocation({ ...input, invocation });
  assert.equal(result.status, "static-fallback");
});

test("invalid Study invocation cannot be replaced by browser/provider assertions", () => {
  const input = executionInput();
  const invocation = clone(input.invocation as Record<string, unknown>);
  invocation.issuedBy = "browser";
  invocation.providerSaysEligible = true;
  assert.equal(validateExact(StudyCommercialTutorInvocationSchema, invocation).status, "rejected");
  const result = executeCommercialTutorInvocation({ ...input, invocation });
  assert.deepEqual(result, {
    status: "rejected",
    reasonCode: "INVALID_STUDY_COMMERCIAL_INVOCATION",
    providerCalls: 0,
    telemetry: [],
  });
});

test("Wave 3 foundation has no vendor, deployment, credential, or production UI imports", () => {
  const tutorRoot = process.cwd().endsWith("adaptive-tutor")
    ? process.cwd()
    : resolve("adaptive-tutor");
  const roots = [
    "core/v3",
    "tests/tutor-v3-convergence",
  ];
  const forbidden = [
    "@anthropic-ai", "openai", "elevenlabs", "netlify/functions",
    "supabase", "process.env", "fetch(", "https://", "credentials",
  ];
  for (const root of roots) {
    const files = readdirSync(resolve(tutorRoot, root), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .map((entry) => resolve(entry.parentPath, entry.name));
    for (const file of files) {
      const imports = [...readFileSync(file, "utf8").matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)]
        .map((match) => match[1] ?? "")
        .join("\n")
        .toLowerCase();
      for (const token of forbidden) assert.equal(imports.includes(token.toLowerCase()), false, `${file}: ${token}`);
      for (const specifier of imports.split("\n")) {
        assert.equal(resolve(file, "..", specifier).startsWith(resolve(tutorRoot, "../src")), false, `${file}: production UI import`);
      }
    }
  }
});
