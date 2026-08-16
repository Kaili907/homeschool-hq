import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { validateExact } from "../../../core/v2/contracts/index.js";
import {
  executeCommercialTutorInvocation,
} from "../../../core/v3/commercial-operation/orchestrate.js";
import {
  evaluateWave3HardGates,
} from "../../../core/v3/commercial-operation/index.js";
import {
  StudyCommercialTutorAdvisorySchema,
} from "../../../core/v3/contracts/index.js";
import {
  InstructionalMemoryDeltaSchema,
  InstructionalMemoryProjectionSchema,
  InstructionalMemoryProjectionStore,
  BoundedInstructionalMemoryStore,
  MinimizedInstructionalMemorySnapshotSchema,
  createInstructionalMemoryDelta,
  type CreateInstructionalMemoryDeltaInput,
  type InstructionalMemoryScope,
} from "../../../core/v3/memory/index.js";
import {
  DurableMultimodalEvidenceSchema,
  MULTIMODAL_CONTRACT_VERSION,
  projectDurableMultimodalEvidence,
  type MultimodalEvidenceProjectionSource,
} from "../../../core/v3/multimodal/index.js";
import {
  validateProviderModelOutput,
  type ModelOutputValidationContext,
} from "../../../core/v3/model-output/index.js";
import {
  createTrustedProviderProfileRegistry,
  evaluateProviderEligibility,
  type ProviderEligibilityDecisionKind,
  type ProviderEligibilityReason,
  type TrustedProviderProfile,
} from "../../../core/v3/provider-policy/index.js";
import {
  validateBoundedCommercialProviderRequest,
} from "../../../core/v3/provider-request/index.js";
import {
  MinimizedAcceptedStudyEffectEventSchema,
  RecoverableInstructionalOperationCoordinator,
  type CanonicalStudyEffectAcceptCommand,
  type CanonicalStudyEffectGateway,
  type CanonicalStudyEffectIdentity,
  type MinimizedAcceptedStudyEffectEvent,
} from "../../../core/v3/recovery/index.js";
import {
  projectTutorCommercialTelemetry,
  TutorCommercialTelemetryEventSchema,
} from "../../../core/v3/telemetry/index.js";
import {
  DETERMINISTIC_FIXTURES,
  MOCK_PROVENANCE,
} from "../../../evals/v3/fixtures/certification-fixtures.js";
import {
  runDeterministicFixtures,
  type DeterministicFixture,
  type RawProviderResult,
} from "../../../evals/v3/src/index.js";
import {
  ParentReportSchema,
  buildMinimizedParentHubReport,
} from "../../../study-engine/tutor-v2/parent-reporting/index.js";
import {
  ScriptedCommercialTransport,
  executionInput,
  successfulProviderResponse,
} from "../../../tests/tutor-v3-convergence/fixtures.js";
import { collectWave3HardGateEvidence } from "../../../tests/tutor-v3-convergence/gate-evidence.js";

const SESSION = "STUDY-TUTOR-V2-W4-07";
const STARTING_SHA = "a2fdf1858cd50c998f5da53970d36ee6c90ff31a";
const EVALUATED_AT = "2026-08-15T16:00:00.000Z";

const CANARIES = {
  learnerAnswer: "W4PRIVACY!LEARNER-ANSWER!8f17c2a1",
  learnerFreeFormAttempt: "W4PRIVACY!FREE-FORM-ATTEMPT!39d84be6",
  tutorProse: "W4PRIVACY!TUTOR-PROSE!c41a907d",
  providerPrompt: "W4PRIVACY!PROVIDER-PROMPT!2ab6e510",
  providerResponse: "W4PRIVACY!PROVIDER-RESPONSE!e79d30f4",
  rawTranscript: "W4PRIVACY!RAW-TRANSCRIPT!5c02b8da",
  audioMetadata: "W4PRIVACY!AUDIO-METADATA!a63e71c9",
  rawImageMetadata: "W4PRIVACY!RAW-IMAGE-METADATA!d9054f2b",
  learnerName: "W4PRIVACY!LEARNER-NAME!71be03ac",
  email: "W4PRIVACY!EMAIL!4d29c8f0@example.invalid",
  credentialLikeSecret: "sk-synthetic-W4PRIVACY-SECRET-9e145c7b",
  diagnosticText: "W4PRIVACY!DIAGNOSTIC-TEXT!0b62adf9",
  emotionLabel: "W4PRIVACY!EMOTION-LABEL!f31c806e",
  personalityJudgment: "W4PRIVACY!PERSONALITY-JUDGMENT!67a0d5c2",
} as const;

type CanaryCategory = keyof typeof CANARIES;

const CANARY_CATEGORIES = Object.freeze(Object.keys(CANARIES) as CanaryCategory[]);
const CANARY_VALUES = Object.freeze(Object.values(CANARIES));

interface SurfaceScan {
  readonly surface: string;
  readonly status: "PASS";
  readonly canariesScanned: number;
  readonly directMatches: 0;
  readonly encodedMatches: 0;
}

interface PolicyScenarioResult {
  readonly scenario: string;
  readonly status: "PASS";
  readonly expectedDecision: ProviderEligibilityDecisionKind;
  readonly expectedReason: ProviderEligibilityReason;
  readonly providerCalls: 0;
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

function encodedVariants(value: string): readonly string[] {
  return [
    encodeURIComponent(value),
    Buffer.from(value, "utf8").toString("base64"),
    Buffer.from(value, "utf8").toString("hex"),
  ];
}

function assertNoCanary(surface: string, value: unknown): SurfaceScan {
  const serialized = typeof value === "string" ? value : json(value);
  const lower = serialized.toLowerCase();
  for (const canary of CANARY_VALUES) {
    assert.equal(serialized.includes(canary), false, `${surface} leaked a direct canary`);
    assert.equal(lower.includes(canary.toLowerCase()), false, `${surface} leaked a normalized canary`);
    for (const encoded of encodedVariants(canary)) {
      assert.equal(serialized.includes(encoded), false, `${surface} leaked an encoded canary`);
    }
  }
  return {
    surface,
    status: "PASS",
    canariesScanned: CANARY_VALUES.length,
    directMatches: 0,
    encodedMatches: 0,
  };
}

function canaryPayload(): Readonly<Record<CanaryCategory, string>> {
  return Object.freeze({ ...CANARIES });
}

function addCanaryField(value: unknown): unknown {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
  return { ...(structuredClone(value) as Record<string, unknown>), syntheticForbidden: CANARIES.learnerAnswer };
}

function assertSchemaRejectsCanary(
  name: string,
  schema: Parameters<typeof validateExact>[0],
  value: unknown,
): { readonly mutation: string; readonly status: "PASS" } {
  assert.equal(validateExact(schema, addCanaryField(value)).status, "rejected", `${name} accepted a canary field`);
  return { mutation: `${name}-unknown-field`, status: "PASS" };
}

function trustedProviderProfile(suffix: "alpha" | "beta"): TrustedProviderProfile {
  return {
    providerRef: `provider-profile:${suffix}`,
    trainingUse: "prohibited",
    retention: { class: "none", maximumDurationHours: 0 },
    minorDataEligibility: "supported",
    dataResidency: { approvedRegions: ["us-east"] },
    dataDeletionCapability: "supported",
    multimodalEligibility: "approved",
    contractPolicyRevision: "provider-policy-revision:commercial-r1",
    policyEvidenceRef: `provider-policy-evidence:${suffix}-commercial-r1`,
    policyEvidenceValidUntil: "2027-01-01T00:00:00.000Z",
    status: "active",
  };
}

function policyScenarios(): readonly {
  readonly scenario: string;
  readonly mutate: (profile: TrustedProviderProfile) => TrustedProviderProfile;
  readonly expectedDecision: ProviderEligibilityDecisionKind;
  readonly expectedReason: ProviderEligibilityReason;
}[] {
  return [
    {
      scenario: "unknown-retention",
      mutate: (profile) => ({ ...profile, retention: { class: "unknown", maximumDurationHours: 0 } }),
      expectedDecision: "static-fallback-required",
      expectedReason: "retention-class-unknown",
    },
    {
      scenario: "training-enabled",
      mutate: (profile) => ({ ...profile, trainingUse: "allowed" }),
      expectedDecision: "ineligible",
      expectedReason: "training-use-allowed",
    },
    {
      scenario: "minor-data-unsupported",
      mutate: (profile) => ({ ...profile, minorDataEligibility: "unsupported" }),
      expectedDecision: "ineligible",
      expectedReason: "minor-data-unsupported",
    },
    {
      scenario: "wrong-region",
      mutate: (profile) => ({ ...profile, dataResidency: { approvedRegions: ["eu-west"] } }),
      expectedDecision: "ineligible",
      expectedReason: "region-not-approved",
    },
    {
      scenario: "expired-evidence",
      mutate: (profile) => ({ ...profile, policyEvidenceValidUntil: EVALUATED_AT }),
      expectedDecision: "static-fallback-required",
      expectedReason: "policy-evidence-expired",
    },
    {
      scenario: "policy-revision-drift",
      mutate: (profile) => ({ ...profile, contractPolicyRevision: "provider-policy-revision:drifted-r2" }),
      expectedDecision: "static-fallback-required",
      expectedReason: "policy-revision-mismatch",
    },
  ];
}

function certifyProviderPolicy(): {
  readonly results: readonly PolicyScenarioResult[];
  readonly decisions: readonly unknown[];
} {
  const decisions: unknown[] = [];
  const results = policyScenarios().map((scenario): PolicyScenarioResult => {
    const transport = new ScriptedCommercialTransport([
      { status: "response", response: successfulProviderResponse() },
    ]);
    const baseInput = executionInput(transport);
    const registry = createTrustedProviderProfileRegistry([
      scenario.mutate(trustedProviderProfile("alpha")),
      scenario.mutate(trustedProviderProfile("beta")),
    ]);
    const firstRequirement = baseInput.routing.providerPolicyRequirements[0];
    assert.ok(firstRequirement);
    const decision = evaluateProviderEligibility(registry, firstRequirement);
    decisions.push(decision);
    assert.equal(decision.decision, scenario.expectedDecision);
    assert.equal(decision.reasons.includes(scenario.expectedReason), true);

    const routed = executeCommercialTutorInvocation({
      ...baseInput,
      routing: { ...baseInput.routing, providerPolicyRegistry: registry },
    });
    assert.equal(routed.status, "static-fallback");
    assert.equal(routed.providerCalls, 0);
    assert.equal(transport.requests.length, 0);
    return {
      scenario: scenario.scenario,
      status: "PASS",
      expectedDecision: scenario.expectedDecision,
      expectedReason: scenario.expectedReason,
      providerCalls: 0,
    };
  });
  return { results, decisions };
}

function parentReportRequest(): unknown {
  return {
    requestKind: "parent-hub-report",
    reportRef: "report:w4-privacy",
    policyRef: "policy:parent-reporting-v1",
    generatedAt: "2026-08-15T17:00:00.000Z",
    scope: {
      scopeKind: "session",
      guardianRef: "guardian:synthetic-one",
      householdScopeRef: "household-scope:synthetic-one",
      selectedLearnerRef: "learner-scope:synthetic-one",
      sessionRef: "session:w4-privacy",
    },
    guardianAuthorization: {
      guardianAuthorizationKind: "study-parent-report-guardian-authorization",
      issuer: "study",
      authorizationRef: "authorization:w4-privacy",
      policyRef: "policy:parent-reporting-v1",
      guardianRef: "guardian:synthetic-one",
      householdScopeRef: "household-scope:synthetic-one",
      learnerScopeRef: "learner-scope:synthetic-one",
      authorizationRevisionRef: "authorization-revision:w4-privacy-r1",
      currentAuthorizationRevisionRef: "authorization-revision:w4-privacy-r1",
      authorizationRevisionStatus: "current",
      visibility: "parent-report",
      consent: { policyRequirement: "not-required", consentState: "not-required" },
      scopeKind: "session",
      sessionRef: "session:w4-privacy",
    },
    evidence: [{
      evidenceRef: "evidence:w4-privacy",
      learnerRef: "learner-scope:synthetic-one",
      reasonCode: "practice-completed",
      decisionStatus: null,
      provenance: {
        producer: "study-engine",
        reportingApproval: "study-approved-for-parent-reporting",
        sourceEventRef: "event:w4-privacy",
        policyRef: "policy:parent-reporting-v1",
        recordedAt: "2026-08-15T16:30:00.000Z",
        scope: {
          scopeKind: "session",
          householdScopeRef: "household-scope:synthetic-one",
          learnerScopeRef: "learner-scope:synthetic-one",
          sessionRef: "session:w4-privacy",
        },
      },
    }],
  };
}

function contaminatedEvalFixture(): DeterministicFixture {
  const source = DETERMINISTIC_FIXTURES[0];
  assert.ok(source);
  assert.equal(source.rawProviderResult.kind, "output");
  const raw = structuredClone(source.rawProviderResult) as Extract<RawProviderResult, { kind: "output" }>;
  assert.equal(typeof raw.modelOutput, "object");
  assert.notEqual(raw.modelOutput, null);
  assert.equal(Array.isArray(raw.modelOutput), false);
  return {
    evalCase: {
      ...structuredClone(source.evalCase),
      caseId: "commercial.w4-privacy-canary-containment.v1",
      description: "Synthetic forbidden fields are contained without retaining raw provider material.",
      family: "malformed-output",
      sealedOracle: {
        ...structuredClone(source.evalCase.sealedOracle),
        expectedDisposition: "fallback",
        requiredHardGates: ["MALFORMED_OUTPUT"],
        academicDimensions: [],
      },
      trialPlan: { deterministicReplays: 1, stochasticTrials: 100 },
    },
    rawProviderResult: {
      ...raw,
      modelOutput: {
        ...(raw.modelOutput as Record<string, unknown>),
        syntheticCanaries: canaryPayload(),
      },
    },
    academicScores: [],
  };
}

async function main(): Promise<void> {
  const cleanTransport = new ScriptedCommercialTransport([
    { status: "response", response: successfulProviderResponse() },
  ]);
  const cleanCommercial = executeCommercialTutorInvocation(executionInput(cleanTransport));
  assert.equal(cleanCommercial.status, "advisory");
  if (cleanCommercial.status !== "advisory") throw new Error("unreachable");
  const providerRequest = cleanTransport.requests[0];
  assert.ok(providerRequest);

  const contaminatedRequestResult = validateBoundedCommercialProviderRequest({
    ...(providerRequest as Record<string, unknown>),
    syntheticCanaries: canaryPayload(),
  });
  assert.equal(contaminatedRequestResult.status, "provider-request-rejected");
  if (contaminatedRequestResult.status === "provider-request-rejected") {
    assert.equal(contaminatedRequestResult.providerCallAllowed, false);
  }

  const modelContext: ModelOutputValidationContext = {
    assessmentPhase: "instruction-or-practice",
    reviewedContentRefs: ["reviewed-content:text-one"],
    groundingRefs: ["grounding:lesson-one"],
    allowedTutorActions: ["hint"],
    allowedInstructionalDisplayModes: ["reviewed-text"],
  };
  const cleanProviderResponse = successfulProviderResponse() as {
    readonly output: Record<string, unknown>;
  };
  const cleanNormalization = validateProviderModelOutput(cleanProviderResponse.output, modelContext);
  assert.equal(cleanNormalization.status, "accepted-proposal");
  const contaminatedNormalization = validateProviderModelOutput({
    ...cleanProviderResponse.output,
    syntheticCanaries: canaryPayload(),
  }, modelContext);
  assert.equal(contaminatedNormalization.status, "malformed");

  const contaminatedResponse = structuredClone(successfulProviderResponse()) as Record<string, unknown>;
  const contaminatedOutput = contaminatedResponse.output as Record<string, unknown>;
  contaminatedOutput.syntheticCanaries = canaryPayload();
  const contaminatedTransport = new ScriptedCommercialTransport([
    { status: "response", response: contaminatedResponse },
  ]);
  const contaminatedCommercial = executeCommercialTutorInvocation(executionInput(contaminatedTransport));
  assert.equal(contaminatedCommercial.status, "static-fallback");
  assert.deepEqual(contaminatedCommercial.advisory.reasonCodes, ["UNTRUSTED_MODEL_OUTPUT_REJECTED"]);

  const telemetryResult = projectTutorCommercialTelemetry({
    status: "success",
    eventRef: "telemetry-event:w4-privacy",
    actionFamily: "hint",
    routeClass: "hosted-standard",
    metrics: {
      inputTokenCount: 100,
      outputTokenCount: 20,
      latencyMs: 50,
      costMicros: "100",
      syntheticCanaries: canaryPayload(),
    },
    cacheClass: "miss",
    fallbackClass: "none",
    syntheticCanaries: canaryPayload(),
  }, {
    attempt: cleanCommercial.reservation.attempts[0],
    reservation: cleanCommercial.reservation,
  });
  assert.equal(telemetryResult.status, "projected");
  if (telemetryResult.status !== "projected") throw new Error("unreachable");

  const memoryScope: InstructionalMemoryScope = {
    scopeKind: "trusted-study-instructional-memory-scope",
    learnerScopeRef: "learner-scope:w4-privacy",
    sessionRef: "session:w4-privacy",
    contextRef: "interaction:w4-privacy",
    opportunityRef: "opportunity:w4-privacy",
  };
  const deltaInput = {
    logicalOperationRef: "logical-operation:w4-privacy",
    sourceEventRef: "study-event:w4-privacy",
    memoryDeltaRef: "memory-delta:w4-privacy",
    memoryRef: "memory:w4-privacy",
    scope: memoryScope,
    prior: null,
    operations: [{
      operationKind: "add",
      field: "conceptRefs",
      value: "concept:w4-privacy",
    }],
    syntheticCanaries: canaryPayload(),
  } as unknown as CreateInstructionalMemoryDeltaInput;
  const memoryDelta = createInstructionalMemoryDelta(deltaInput);
  const projectionStore = new InstructionalMemoryProjectionStore();
  let acceptedEvent: MinimizedAcceptedStudyEffectEvent | null = null;
  const effectGateway: CanonicalStudyEffectGateway = {
    lookup(_identity: CanonicalStudyEffectIdentity) {
      return acceptedEvent === null
        ? { status: "missing" as const }
        : { status: "accepted" as const, event: structuredClone(acceptedEvent) };
    },
    accept(command: CanonicalStudyEffectAcceptCommand) {
      acceptedEvent = structuredClone(command.acceptedEvent);
      return { status: "accepted" as const, event: structuredClone(command.acceptedEvent) };
    },
  };
  const coordinator = new RecoverableInstructionalOperationCoordinator(effectGateway, projectionStore);
  const recovered = coordinator.replay(memoryScope, {
    recoveryKind: "recoverable-instructional-operation",
    logicalOperationRef: "logical-operation:w4-privacy",
    sourceEventRef: "study-event:w4-privacy",
    effectRef: "study-effect:w4-privacy",
    effectDigest: `sha256:${"9".repeat(64)}`,
    scope: memoryScope,
    memoryDelta,
  });
  assert.equal(recovered.status, "complete");
  assert.notEqual(acceptedEvent, null);
  if (recovered.status !== "complete" || acceptedEvent === null) throw new Error("unreachable");

  const ephemeralStore = new BoundedInstructionalMemoryStore({
    now: () => Date.parse("2026-08-15T16:00:00.000Z"),
  });
  const rememberRequest = {
    memoryRef: "memory:w4-privacy-snapshot",
    scope: memoryScope,
    instructionalState: {
      conceptRefs: ["concept:w4-privacy"],
      lastAssistanceLevel: "light-hint",
      lastHintLevel: "concept-cue",
      reviewedContentRefs: ["reviewed-content:w4-privacy"],
      studyApprovedState: null,
      recentActionReasonCodes: ["needs-hint"],
    },
  };
  const contaminatedRemember = ephemeralStore.remember({
    ...rememberRequest,
    syntheticCanaries: canaryPayload(),
  });
  assert.equal(contaminatedRemember.status, "rejected");
  assert.equal(ephemeralStore.remember(rememberRequest).status, "accepted");
  const snapshotResult = ephemeralStore.snapshot({
    memoryRef: rememberRequest.memoryRef,
    scope: memoryScope,
  });
  assert.equal(snapshotResult.status, "snapshotted");
  if (snapshotResult.status !== "snapshotted") throw new Error("unreachable");

  const rawBytes = new TextEncoder().encode(CANARY_VALUES.join("|"));
  const multimodalSource = {
    evidenceRef: "evidence:w4-privacy-multimodal",
    sessionRef: "session:w4-privacy",
    presentation: {
      contractVersion: MULTIMODAL_CONTRACT_VERSION,
      envelope: "multimodal-presentation",
      interactionRef: "interaction:w4-privacy",
      turnRef: "turn:w4-privacy",
      speaker: "tutor",
      content: {
        mode: "speech",
        audio: {
          mediaRef: "media:w4-privacy-audio",
          mediaKind: "raw-audio",
          mimeType: "audio/wav",
          byteLength: rawBytes.byteLength,
          capturedAt: "2026-08-15T16:00:00.000Z",
          disposition: "transient-memory-only",
          persistenceAllowed: false,
          inferenceRestrictions: {
            biometricInferenceAllowed: false,
            emotionInferenceAllowed: false,
            faceIdentityAllowed: false,
            personalityClassificationAllowed: false,
            diagnosticClassificationAllowed: false,
          },
        },
        transcript: {
          transcriptRef: "transcript:w4-privacy",
          text: CANARIES.rawTranscript,
          locale: "en-US",
          persistence: "disabled",
          expiresWithTurn: true,
        },
      },
      caption: {
        captionRef: "caption:w4-privacy",
        text: CANARIES.tutorProse,
        locale: "en-US",
        availability: "available",
        persistence: "transient-session-only",
      },
      assessmentDisclosure: {
        phase: "instruction-or-practice",
        antiAnswerPolicy: "not-active",
        answerExposure: "bounded-hint",
        appliesToAllModalities: true,
      },
    },
    outcome: "inconclusive",
    assistanceLevel: "light-hint",
    observedAt: "2026-08-15T16:01:00.000Z",
    transient: {
      rawAudio: rawBytes,
      rawLearnerImage: rawBytes,
      transcriptText: CANARIES.rawTranscript,
      captionText: CANARIES.tutorProse,
      audioMetadata: CANARIES.audioMetadata,
      rawImageMetadata: CANARIES.rawImageMetadata,
      syntheticCanaries: canaryPayload(),
    },
  } as unknown as MultimodalEvidenceProjectionSource;
  const multimodalResult = projectDurableMultimodalEvidence(multimodalSource);
  assert.equal(multimodalResult.status, "accepted");
  if (multimodalResult.status !== "accepted") throw new Error("unreachable");

  const cleanParentResult = buildMinimizedParentHubReport(parentReportRequest());
  assert.equal(cleanParentResult.status, "accepted");
  if (cleanParentResult.status !== "accepted") throw new Error("unreachable");
  const contaminatedParentResult = buildMinimizedParentHubReport({
    ...(parentReportRequest() as Record<string, unknown>),
    syntheticCanaries: canaryPayload(),
  });
  assert.equal(contaminatedParentResult.status, "rejected");

  const evalExecution = await runDeterministicFixtures({
    runId: "w4-privacy-retention-canary-run",
    harnessRevision: "w4-07-privacy-retention:r1",
    provenance: MOCK_PROVENANCE,
    fixtures: [contaminatedEvalFixture()],
  });
  assert.equal(evalExecution.run.attempts.length, 1);
  assert.equal(evalExecution.run.attempts[0]?.disposition, "fallback");
  assert.equal(evalExecution.run.attempts[0]?.retainedEvidence.rawPromptRetained, false);
  assert.equal(evalExecution.run.attempts[0]?.retainedEvidence.rawCompletionRetained, false);
  assert.equal(evalExecution.run.attempts[0]?.retainedEvidence.rawClaimSidecarRetained, false);

  const mutationResults = [
    (() => {
      const result = validateBoundedCommercialProviderRequest(addCanaryField(providerRequest));
      assert.equal(result.status, "provider-request-rejected");
      return { mutation: "provider-request-unknown-field", status: "PASS" as const };
    })(),
    assertSchemaRejectsCanary("advisory", StudyCommercialTutorAdvisorySchema, cleanCommercial.advisory),
    assertSchemaRejectsCanary("accepted-effect", MinimizedAcceptedStudyEffectEventSchema, acceptedEvent),
    assertSchemaRejectsCanary("memory-delta", InstructionalMemoryDeltaSchema, memoryDelta),
    assertSchemaRejectsCanary("memory-projection", InstructionalMemoryProjectionSchema, recovered.projection),
    assertSchemaRejectsCanary("memory-snapshot", MinimizedInstructionalMemorySnapshotSchema, snapshotResult.snapshot),
    assertSchemaRejectsCanary("telemetry", TutorCommercialTelemetryEventSchema, telemetryResult.event),
    assertSchemaRejectsCanary("multimodal-evidence", DurableMultimodalEvidenceSchema, multimodalResult.evidence),
    assertSchemaRejectsCanary("parent-report", ParentReportSchema, cleanParentResult.value),
  ];

  const providerPolicy = certifyProviderPolicy();
  const wave3Evidence = await collectWave3HardGateEvidence();
  const wave3Gates = evaluateWave3HardGates(wave3Evidence);
  assert.equal(wave3Gates.length, 18);
  assert.equal(wave3Gates.every((gate) => gate.status === "PASS"), true);

  const repoRoot = process.cwd().endsWith("adaptive-tutor")
    ? resolve(process.cwd(), "..")
    : process.cwd();
  const releaseDirectory = resolve(repoRoot, "adaptive-tutor/tutor-v2-wave3-release");
  const releaseFiles = readdirSync(releaseDirectory)
    .filter((name) => name.endsWith(".json"))
    .sort();
  assert.equal(releaseFiles.length > 0, true);
  const staticScans: SurfaceScan[] = releaseFiles.map((name) =>
    assertNoCanary(`wave3-release/${name}`, readFileSync(resolve(releaseDirectory, name), "utf8"))
  );
  const mutationCampaignPath = resolve(
    repoRoot,
    "docs/study-tutor-v2/wave3/repairs/w3-b3-real-mutation/CAMPAIGN-EVIDENCE.json",
  );
  staticScans.push(assertNoCanary(
    "wave3-mutation/CAMPAIGN-EVIDENCE.json",
    readFileSync(mutationCampaignPath, "utf8"),
  ));

  const durableOutputs = {
    providerRequest: { accepted: providerRequest, contaminated: contaminatedRequestResult },
    providerResponseNormalization: { clean: cleanNormalization, contaminated: contaminatedNormalization },
    advisory: contaminatedCommercial.advisory,
    acceptedEffectEvent: acceptedEvent,
    memory: {
      delta: memoryDelta,
      projection: recovered.projection,
      snapshot: snapshotResult.snapshot,
    },
    telemetry: telemetryResult.event,
    multimodalDurableEvidence: multimodalResult.evidence,
    parentReport: { clean: cleanParentResult.value, contaminated: contaminatedParentResult },
    evalEvidence: evalExecution.run,
    mutationEvidence: mutationResults,
    releaseEvidence: wave3Gates,
    providerPolicyEvidence: providerPolicy.decisions,
  };
  const surfaceScans: SurfaceScan[] = [
    assertNoCanary("provider-request", durableOutputs.providerRequest),
    assertNoCanary("provider-response-normalization", durableOutputs.providerResponseNormalization),
    assertNoCanary("advisory", durableOutputs.advisory),
    assertNoCanary("accepted-effect-event", durableOutputs.acceptedEffectEvent),
    assertNoCanary("memory-delta-and-snapshot", durableOutputs.memory),
    assertNoCanary("telemetry", durableOutputs.telemetry),
    assertNoCanary("multimodal-durable-evidence", durableOutputs.multimodalDurableEvidence),
    assertNoCanary("parent-report", durableOutputs.parentReport),
    assertNoCanary("eval-evidence", durableOutputs.evalEvidence),
    assertNoCanary("mutation-evidence", durableOutputs.mutationEvidence),
    assertNoCanary("release-evidence", durableOutputs.releaseEvidence),
  ];
  surfaceScans.push(...staticScans);

  const report = {
    session: SESSION,
    startingSha: STARTING_SHA,
    verdict: "W4_PRIVACY_RETENTION_READY_FOR_CONVERGENCE",
    syntheticOnly: true,
    productionStorageBuilt: false,
    liveNetworkCalls: 0,
    canaryCategories: CANARY_CATEGORIES,
    canaryCount: CANARY_VALUES.length,
    scans: surfaceScans,
    providerPolicy: providerPolicy.results,
    mutationChecks: mutationResults,
    wave3HardGates: {
      total: wave3Gates.length,
      passed: wave3Gates.filter((gate) => gate.status === "PASS").length,
      failed: wave3Gates.filter((gate) => gate.status === "FAIL").length,
    },
    opaqueReferencePolicy: {
      status: "PASS",
      rule: "Only fields admitted by the current closed Wave 3 schemas may carry opaque references or digests.",
    },
  } as const;
  assertNoCanary("certification-report", report);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

await main();
