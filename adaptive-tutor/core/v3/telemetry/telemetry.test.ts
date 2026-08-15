import assert from "node:assert/strict";
import test from "node:test";
import { Value } from "../../schema/value.js";
import {
  TutorCommercialTelemetryEventSchema,
  projectTutorCommercialTelemetry,
} from "./index.js";

function source(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: "success",
    eventRef: "event:tutor-operation-001",
    providerRef: "provider:opaque-001",
    modelRef: "model:opaque-001",
    actionFamily: "hint",
    routeClass: "hosted-standard",
    metrics: {
      inputTokenCount: 120,
      outputTokenCount: 45,
      latencyMs: 731,
      costMicros: 1_250,
    },
    cacheClass: "miss",
    fallbackClass: "none",
    policyRevisionRef: "policy:tutor-commercial-r7",
    configRevisionRef: "config:provider-routing-r4",
    ...overrides,
  };
}

function requireEvent(input: unknown) {
  const result = projectTutorCommercialTelemetry(input);
  assert.equal(result.status, "projected");
  if (result.status !== "projected") throw new Error("Expected a projected event");
  assert.equal(Value.Check(TutorCommercialTelemetryEventSchema, result.event), true);
  return result.event;
}

test("projects exact commercial measurements in micros and milliseconds", () => {
  const event = requireEvent(source());

  assert.deepEqual(event, {
    contractVersion: "3.0.0",
    eventKind: "tutor-commercial-operation",
    eventRef: "event:tutor-operation-001",
    providerRef: "provider:opaque-001",
    modelRef: "model:opaque-001",
    actionFamily: "hint",
    routeClass: "hosted-standard",
    inputTokenCount: 120,
    outputTokenCount: 45,
    latencyMs: 731,
    costMicros: 1_250,
    cacheClass: "miss",
    fallbackClass: "none",
    outcome: "success",
    reasonCode: "COMPLETED",
    policyRevisionRef: "policy:tutor-commercial-r7",
    configRevisionRef: "config:provider-routing-r4",
    authorityScope: "commercial-operations-only",
    instructionalUseAllowed: false,
    studyAuthority: false,
    studyMutationAllowed: false,
  });
  assert.equal(Object.isFrozen(event), true);
});

test("redacts learner, instructional, provider prose, and credential fields", () => {
  const canaries = [
    "LEARNER_ANSWER_CANARY",
    "TUTOR_TRANSCRIPT_CANARY",
    "PROMPT_TEXT_CANARY",
    "PROVIDER_PROSE_CANARY",
    "LEARNER_NAME_CANARY",
    "DIAGNOSIS_CANARY",
    "EMOTION_CANARY",
    "PERSONALITY_CANARY",
    "CREDENTIAL_CANARY",
  ];
  let forbiddenGetterReads = 0;
  const input = source({
    learnerAnswer: canaries[0],
    tutorTranscript: canaries[1],
    promptText: canaries[2],
    providerResponseProse: canaries[3],
    learnerName: canaries[4],
    diagnosis: canaries[5],
    emotion: canaries[6],
    personality: canaries[7],
    credentials: { bearerToken: canaries[8] },
    proposal: {
      instruction: "Try dividing both sides.",
      transcript: canaries[1],
    },
  });
  Object.defineProperty(input, "rawPrompt", {
    enumerable: true,
    get() {
      forbiddenGetterReads += 1;
      return canaries[2];
    },
  });

  const serialized = JSON.stringify(requireEvent(input));
  assert.equal(forbiddenGetterReads, 0);
  for (const canary of canaries) assert.equal(serialized.includes(canary), false);
  for (const forbiddenKey of [
    "learnerAnswer",
    "tutorTranscript",
    "promptText",
    "providerResponseProse",
    "learnerName",
    "diagnosis",
    "emotion",
    "personality",
    "credentials",
    "proposal",
  ]) {
    assert.equal(serialized.includes(forbiddenKey), false);
  }
});

test("unknown failure prose becomes a bounded reason code", () => {
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

test("known failure reason and fallback classes remain operationally observable", () => {
  const event = requireEvent(source({
    status: "failure",
    actionFamily: "none",
    reasonCode: "PROVIDER_TIMEOUT",
    fallbackClass: "alternate-provider",
  }));

  assert.equal(event.reasonCode, "PROVIDER_TIMEOUT");
  assert.equal(event.fallbackClass, "alternate-provider");
});

test("rejects numeric overflow instead of rounding or clamping", () => {
  for (const metric of ["inputTokenCount", "outputTokenCount", "latencyMs", "costMicros"]) {
    const result = projectTutorCommercialTelemetry(source({
      metrics: {
        inputTokenCount: 1,
        outputTokenCount: 1,
        latencyMs: 1,
        costMicros: 1,
        [metric]: Number.MAX_SAFE_INTEGER + 1,
      },
    }));
    assert.deepEqual(result, {
      status: "rejected",
      reasonCode: "INVALID_NUMERIC_METRIC",
    }, metric);
  }
});

test("rejects negative, fractional, non-finite, and non-number measurements", () => {
  for (const invalidValue of [-1, 0.5, Number.POSITIVE_INFINITY, Number.NaN, "1250", 1n]) {
    const result = projectTutorCommercialTelemetry(source({
      metrics: {
        inputTokenCount: 1,
        outputTokenCount: 1,
        latencyMs: 1,
        costMicros: invalidValue,
      },
    }));
    assert.equal(result.status, "rejected");
    if (result.status === "rejected") {
      assert.equal(result.reasonCode, "INVALID_NUMERIC_METRIC");
    }
  }
});

test("accepts the maximum safe integer without precision loss", () => {
  const event = requireEvent(source({
    metrics: {
      inputTokenCount: Number.MAX_SAFE_INTEGER,
      outputTokenCount: Number.MAX_SAFE_INTEGER,
      latencyMs: Number.MAX_SAFE_INTEGER,
      costMicros: Number.MAX_SAFE_INTEGER,
    },
  }));
  assert.equal(event.costMicros, Number.MAX_SAFE_INTEGER);
  assert.equal(event.latencyMs, Number.MAX_SAFE_INTEGER);
});

test("rejects malformed required references and never invents commercial identity", () => {
  const result = projectTutorCommercialTelemetry(source({
    providerRef: "provider ref containing prose and spaces",
  }));
  assert.deepEqual(result, {
    status: "rejected",
    reasonCode: "INVALID_OPERATIONAL_REFERENCE",
  });
});

test("optional unsafe revision data is omitted rather than copied", () => {
  const event = requireEvent(source({
    policyRevisionRef: "policy revision with prompt prose",
    configRevisionRef: { credential: "CREDENTIAL_CANARY" },
  }));
  assert.equal(event.policyRevisionRef, null);
  assert.equal(event.configRevisionRef, null);
  assert.equal(JSON.stringify(event).includes("CREDENTIAL_CANARY"), false);
});

test("closed schema rejects prose and any elevation of Tutor or Study authority", () => {
  const event = requireEvent(source());
  assert.equal(Value.Check(TutorCommercialTelemetryEventSchema, {
    ...event,
    promptText: "Tell the learner the next step.",
  }), false);
  assert.equal(Value.Check(TutorCommercialTelemetryEventSchema, {
    ...event,
    instructionalUseAllowed: true,
  }), false);
  assert.equal(Value.Check(TutorCommercialTelemetryEventSchema, {
    ...event,
    studyAuthority: true,
  }), false);
  assert.equal(Value.Check(TutorCommercialTelemetryEventSchema, {
    ...event,
    studyMutationAllowed: true,
  }), false);
});

test("allowed-field accessors are rejected without execution", () => {
  let reads = 0;
  const input = source();
  Object.defineProperty(input, "providerRef", {
    enumerable: true,
    get() {
      reads += 1;
      return "provider:accessor";
    },
  });

  const result = projectTutorCommercialTelemetry(input);
  assert.equal(result.status, "rejected");
  assert.equal(reads, 0);
});
