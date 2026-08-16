import assert from "node:assert/strict";
import test from "node:test";

import {
  CampaignDefinitionError,
  DeterministicMockClock,
  DeterministicMockTransport,
  HARD_VIOLATIONS,
  campaignIdentityFor,
  passingHardGates,
  runCertificationCampaign,
  sha256,
  type CampaignPlan,
  type CertificationTransport,
  type CertificationTransportObservation,
  type HardViolation,
} from "../src/index.ts";

const privateConversationMarker = "LEARNER_RAW_CONVERSATION_MUST_NOT_PERSIST";

function dimensions(overrides: Partial<CampaignPlan["cases"][number]["dimensions"]> = {}) {
  return {
    subjectCourseCategory: "math.pre-algebra",
    learnerStageProfile: "middle-school-supported",
    locale: "en-US",
    actionFamily: "hint",
    assessmentPhase: "active-check",
    adversarialFamily: "prompt-injection",
    faultMode: "none",
    ...overrides,
  };
}

function plan(cases: CampaignPlan["cases"] = [{
  scenarioRef: "synthetic.safe-hint",
  dimensions: dimensions(),
  trialCount: 2,
  seed: { kind: "deterministic", baseSeed: 4100 },
  ephemeralInput: { syntheticTurn: privateConversationMarker },
}]): CampaignPlan {
  return {
    schemaVersion: "tutor-v2-live-certification-plan/4",
    campaignRef: "w4-certification-candidate-001",
    harnessRevision: "live-runner-r1",
    policyRevision: "tutor-policy-r17",
    providerModel: {
      providerId: "provider-fixture",
      modelId: "model-fixture",
      providerModelRevision: "2026-08-01",
      configuration: { temperature: 0, max_tokens: 256, mode: "certification" },
      adapterRevision: "adapter-contract-r1",
    },
    cases,
    qualityThresholds: [{
      metric: "instructional-quality",
      statistic: "mean",
      operator: "gte",
      value: 0.8,
      minimumSamples: 2,
    }],
  };
}

function observation(input: {
  score?: number;
  latency?: number;
  costMicros?: string;
  violation?: HardViolation;
} = {}): CertificationTransportObservation {
  const hardGates = passingHardGates().map((gate) => gate.gate === input.violation
    ? { ...gate, outcome: "violation" as const, reasonCodes: [`detected:${gate.gate}`] }
    : gate);
  return {
    hardGates,
    qualityMetrics: { "instructional-quality": input.score ?? 0.9 },
    providerLatencyMs: input.latency ?? 12,
    usage: { inputUnits: 10, outputUnits: 5, totalUnits: 15 },
    cost: { currency: "USD", amountMicros: input.costMicros ?? "25" },
    providerRequestRefDigest: sha256({ request: "synthetic" }),
  };
}

function mock(inputPlan: CampaignPlan, clock: DeterministicMockClock, observations?: readonly CertificationTransportObservation[]) {
  return new DeterministicMockTransport({
    clock,
    scripts: inputPlan.cases.map((campaignCase) => ({
      scenarioRef: campaignCase.scenarioRef,
      durationMs: 7,
      observations: observations ?? Array.from({ length: campaignCase.trialCount }, (_, index) => observation({
        score: index % 2 === 0 ? 0.8 : 1,
        latency: 10 + index,
        costMicros: String(20 + index),
      })),
    })),
  });
}

test("offline mock executes the exact matrix with deterministic identity, provenance, seeds, and metadata", async () => {
  const inputPlan = plan([
    {
      scenarioRef: "synthetic.no-seed-review",
      dimensions: dimensions({
        subjectCourseCategory: "science.life-science",
        learnerStageProfile: "elementary-independent",
        locale: "es-MX",
        actionFamily: "reteach",
        assessmentPhase: "completed-review",
        adversarialFamily: "multilingual",
        faultMode: "provider-delay",
      }),
      trialCount: 1,
      seed: { kind: "not-applicable" },
      ephemeralInput: { fixture: "reviewed-static-only" },
    },
    {
      scenarioRef: "synthetic.safe-hint",
      dimensions: dimensions(),
      trialCount: 2,
      seed: { kind: "deterministic", baseSeed: 4100 },
      ephemeralInput: { syntheticTurn: privateConversationMarker },
    },
  ]);
  const firstClock = new DeterministicMockClock();
  const firstTransport = mock(inputPlan, firstClock);
  const first = await runCertificationCampaign({ plan: inputPlan, transport: firstTransport, clock: firstClock });
  const secondClock = new DeterministicMockClock();
  const second = await runCertificationCampaign({ plan: inputPlan, transport: mock(inputPlan, secondClock), clock: secondClock });

  assert.deepEqual(first, second);
  assert.equal(first.classification, "PASS");
  assert.equal(first.productionAuthorized, false);
  assert.equal(first.executedTrialCount, 3);
  assert.equal(first.plannedTrialCount, 3);
  assert.equal(first.durationMs, 21);
  assert.equal(first.aggregateMetrics.providerLatencyMs.count, 3);
  assert.equal(first.aggregateMetrics.costMicrosByCurrency.USD, "61");
  assert.deepEqual(first.aggregateMetrics.usage, { inputUnits: 30, outputUnits: 15, totalUnits: 45 });
  assert.deepEqual(first.trials.filter(({ seed }) => seed !== null).map(({ seed }) => seed).sort(), [4100, 4101]);
  assert.equal(first.trials.filter(({ seed }) => seed === null).length, 1);
  assert.equal(new Set(first.trials.map(({ trialId }) => trialId)).size, 3);
  assert.equal(first.providerModelProvenance.configurationDigest, sha256(inputPlan.providerModel.configuration));
  assert.ok(first.trials.every((trial) => trial.policyRevision === inputPlan.policyRevision));
  assert.ok(first.trials.every((trial) => trial.providerModelProvenance.configurationDigest === first.providerModelProvenance.configurationDigest));
  assert.ok(firstTransport.requestAudits.every((audit) => audit.providerId === "provider-fixture" && audit.modelId === "model-fixture"));
  assert.equal(JSON.stringify(first).includes(privateConversationMarker), false);
  assert.equal(JSON.stringify(firstTransport.requestAudits).includes(privateConversationMarker), false);

  const reversedPlan = { ...inputPlan, cases: [...inputPlan.cases].reverse() };
  assert.equal(campaignIdentityFor(reversedPlan), first.campaignId);
});

for (const hardViolation of HARD_VIOLATIONS) {
  test(`hard violation ${hardViolation} fails and stops before the next trial`, async () => {
    const inputPlan = plan();
    const clock = new DeterministicMockClock();
    const transport = mock(inputPlan, clock, [observation({ score: 100, violation: hardViolation }), observation()]);
    const report = await runCertificationCampaign({ plan: inputPlan, transport, clock });

    assert.equal(report.classification, "FAIL");
    assert.equal(report.haltedEarly, true);
    assert.equal(report.haltReason, "hard-violation");
    assert.equal(report.executedTrialCount, 1);
    assert.equal(transport.requestAudits.length, 1);
    assert.deepEqual(report.hardFailures.map(({ gate }) => gate), [hardViolation]);
    assert.equal(report.trials[0]?.qualityMetrics["instructional-quality"], 100);
  });
}

test("non-hard quality thresholds are evaluated statistically only after all trials", async () => {
  const inputPlan = plan();
  const clock = new DeterministicMockClock();
  const report = await runCertificationCampaign({
    plan: inputPlan,
    transport: mock(inputPlan, clock, [observation({ score: 0.5 }), observation({ score: 0.7 })]),
    clock,
  });

  assert.equal(report.haltedEarly, false);
  assert.equal(report.executedTrialCount, 2);
  assert.equal(report.classification, "FAIL");
  assert.deepEqual(report.qualityThresholds, [{
    metric: "instructional-quality",
    statistic: "mean",
    operator: "gte",
    value: 0.8,
    minimumSamples: 2,
    sampleCount: 2,
    observedValue: 0.6,
    outcome: "fail",
  }]);
});

test("transport errors stop the campaign as incomplete without persisting error or ephemeral text", async () => {
  const inputPlan = plan();
  const transport: CertificationTransport = {
    transportRef: "throwing-offline-fixture:v1",
    execute: async () => { throw new Error(privateConversationMarker); },
  };
  const report = await runCertificationCampaign({ plan: inputPlan, transport, clock: new DeterministicMockClock() });

  assert.equal(report.classification, "INCOMPLETE");
  assert.equal(report.haltReason, "transport-error");
  assert.equal(report.executedTrialCount, 1);
  assert.ok(report.trials[0]?.hardGates.every(({ outcome }) => outcome === "not-evaluated"));
  assert.equal(JSON.stringify(report).includes(privateConversationMarker), false);
});

test("extra raw output fields make the observation incomplete and are never copied", async () => {
  const inputPlan = plan();
  const unsafeObservation = {
    ...observation(),
    rawCompletion: privateConversationMarker,
  };
  const transport: CertificationTransport = {
    transportRef: "unsafe-shape-fixture:v1",
    execute: async () => unsafeObservation as CertificationTransportObservation,
  };
  const report = await runCertificationCampaign({ plan: inputPlan, transport, clock: new DeterministicMockClock() });

  assert.equal(report.classification, "INCOMPLETE");
  assert.equal(report.haltReason, "invalid-observation");
  assert.equal(report.trials[0]?.executionOutcome, "invalid-observation");
  assert.equal(JSON.stringify(report).includes(privateConversationMarker), false);
});

test("invalid plans reject credentials, hard-gate thresholds, duplicate cases, and overflowing seeds", () => {
  const base = plan();
  const baseCase = base.cases[0] as CampaignPlan["cases"][number];
  const invalid = {
    ...base,
    providerModel: {
      ...base.providerModel,
      configuration: { api_key: "forbidden" },
    },
    cases: [
      { ...baseCase, seed: { kind: "deterministic" as const, baseSeed: 0xffff_ffff } },
      { ...baseCase, seed: { kind: "deterministic" as const, baseSeed: 0xffff_ffff } },
    ],
    qualityThresholds: [{
      metric: "privacy-leak",
      statistic: "mean" as const,
      operator: "gte" as const,
      value: 0.99,
      minimumSamples: 1,
    }],
  };

  assert.throws(() => campaignIdentityFor(invalid), (error: unknown) => {
    assert.ok(error instanceof CampaignDefinitionError);
    assert.ok(error.issues.some((issue) => issue.includes("credentials and secrets")));
    assert.ok(error.issues.some((issue) => issue.includes("hard gates cannot be statistical thresholds")));
    assert.ok(error.issues.some((issue) => issue.includes("uint32")));
    return true;
  });

  const duplicateOnly = { ...base, cases: [baseCase, baseCase] };
  assert.equal(campaignIdentityFor(duplicateOnly).startsWith("campaign_"), true);
  const clock = new DeterministicMockClock();
  assert.rejects(
    runCertificationCampaign({ plan: duplicateOnly, transport: mock(duplicateOnly, clock), clock }),
    /duplicate semantic cases/,
  );
});
