import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { validateExact } from "../../../core/v2/contracts/index.js";
import {
  executeCommercialTutorInvocation,
} from "../../../core/v3/commercial-operation/orchestrate.js";
import {
  COMMERCIAL_EXECUTION_SCOPE_VERSION,
  evaluateWave3HardGates,
  type CommercialExecutionScope,
} from "../../../core/v3/commercial-operation/index.js";
import {
  STUDY_COMMERCIAL_TUTOR_ADVISORY_VERSION,
  StudyCommercialTutorAdvisorySchema,
  type StudyCommercialTutorAdvisory,
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
  type MultimodalPresentation,
  type MultimodalScopeLineage,
  type TrustedMultimodalPolicyContext,
} from "../../../core/v3/multimodal/index.js";
import {
  PRESENTATION_CONTRACT_VERSION,
  type PresentationIntent,
} from "../../../core/v3/presentation/index.js";
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

const SESSION = "STUDY-TUTOR-V2-W4-R8";
const STARTING_SHA = "27bf8d544f60a7024d0b4c3f47e3d0ee71ee9b76";
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
const CURRENT_PROJECTION_DIGEST = `sha256:${"a".repeat(64)}` as const;

const CURRENT_PROJECTION_SCOPE = {
  commercialExecutionScopeRef: "commercial-scope:w4-privacy",
  householdScopeRef: "household-scope:w4-privacy",
  learnerScopeRef: "learner-scope:w4-privacy",
  sessionRef: "session:w4-privacy",
  interactionRef: "interaction:w4-privacy",
  logicalOperationRef: "logical-operation:w4-privacy",
  conceptRef: "concept:w4-privacy",
  opportunityRef: "opportunity:w4-privacy",
  presentationRef: "presentation:w4-privacy",
} as const satisfies MultimodalScopeLineage;

const CURRENT_COMMERCIAL_SCOPE: CommercialExecutionScope = {
  scopeVersion: COMMERCIAL_EXECUTION_SCOPE_VERSION,
  scopeKind: "trusted-study-commercial-execution-scope",
  issuedBy: "study-engine",
  scopeRef: CURRENT_PROJECTION_SCOPE.commercialExecutionScopeRef,
  householdScopeRef: CURRENT_PROJECTION_SCOPE.householdScopeRef,
  learnerScopeRef: CURRENT_PROJECTION_SCOPE.learnerScopeRef,
  sessionRef: CURRENT_PROJECTION_SCOPE.sessionRef,
  interactionRef: CURRENT_PROJECTION_SCOPE.interactionRef,
  logicalOperationRef: CURRENT_PROJECTION_SCOPE.logicalOperationRef,
  curriculumReleaseRef: "release-w4-privacy",
  curriculumPackageRef: "package:w4-privacy",
  curriculumCourseRef: "course-w4-privacy",
  curriculumSubjectRef: "subject-w4-privacy",
  curriculumUnitRef: "unit-w4-privacy",
  curriculumLessonRef: "lesson-w4-privacy",
  conceptRef: CURRENT_PROJECTION_SCOPE.conceptRef,
  opportunityRef: CURRENT_PROJECTION_SCOPE.opportunityRef,
  learnerStageRef: "learner-stage:w4-privacy",
  presentationRef: CURRENT_PROJECTION_SCOPE.presentationRef,
  routingRequestRef: "routing-request:w4-privacy",
  routePlanRef: "route-plan:w4-privacy",
  reservationRef: "reservation:w4-privacy",
  physicalAttemptRefs: ["physical-attempt:w4-privacy"],
  allowedRouteRefs: ["route:w4-privacy"],
  telemetryEventRefs: ["telemetry-event:w4-privacy"],
};

const CURRENT_PRESENTATION_INTENT = {
  contractVersion: PRESENTATION_CONTRACT_VERSION,
  intentKind: "reference-only-presentation-intent",
  reviewedVisual: {
    kind: "image",
    contentRef: "reviewed-content:w4-privacy-image",
    contentDigest: CURRENT_PROJECTION_DIGEST,
    provenanceRef: "provenance:w4-privacy-image",
  },
  accessibilityCaptionRef: "caption:w4-privacy",
  requestedDeliveryChannels: ["visual"],
  fallbackPresentation: {
    presentationRef: CURRENT_PROJECTION_SCOPE.presentationRef,
    requestedDeliveryChannels: ["text"],
  },
} as const satisfies PresentationIntent;

const CURRENT_STUDY_ADVISORY: StudyCommercialTutorAdvisory = {
  contractVersion: STUDY_COMMERCIAL_TUTOR_ADVISORY_VERSION,
  advisoryKind: "study-commercial-tutor-advisory",
  invocationRef: CURRENT_COMMERCIAL_SCOPE.interactionRef,
  commercialScopeRef: CURRENT_COMMERCIAL_SCOPE.scopeRef,
  householdScopeRef: CURRENT_COMMERCIAL_SCOPE.householdScopeRef,
  learnerScopeRef: CURRENT_COMMERCIAL_SCOPE.learnerScopeRef,
  sessionRef: CURRENT_COMMERCIAL_SCOPE.sessionRef,
  interactionRef: CURRENT_COMMERCIAL_SCOPE.interactionRef,
  logicalOperationRef: CURRENT_COMMERCIAL_SCOPE.logicalOperationRef,
  opportunityRef: CURRENT_COMMERCIAL_SCOPE.opportunityRef,
  conceptRef: CURRENT_COMMERCIAL_SCOPE.conceptRef,
  learnerStageRef: CURRENT_COMMERCIAL_SCOPE.learnerStageRef,
  status: "proposed",
  proposedTutorAction: "hint",
  reasonCodes: ["COMMERCIAL_PROPOSAL_READY"],
  reviewedContentRefs: [CURRENT_PRESENTATION_INTENT.reviewedVisual.contentRef],
  groundingDecision: "sufficient",
  assistanceEvidenceRef: CURRENT_COMMERCIAL_SCOPE.opportunityRef,
  presentationIntent: CURRENT_PRESENTATION_INTENT,
  studyDecisionRequired: true,
  studyMutationAllowed: false,
  officialMasteryAuthority: false,
  officialWorkingLevelAuthority: false,
  nominalGradeAuthority: false,
  curriculumAuthority: false,
  segmentCompletionAuthority: false,
};

const CURRENT_REVIEWED_VISUAL = {
  visualRef: CURRENT_PRESENTATION_INTENT.reviewedVisual.contentRef,
  visualKind: CURRENT_PRESENTATION_INTENT.reviewedVisual.kind,
  contentDigest: CURRENT_PRESENTATION_INTENT.reviewedVisual.contentDigest,
  mimeType: "image/png",
  reviewStatus: "approved",
  reviewRef: "review:w4-privacy-image",
  provenanceRef: CURRENT_PRESENTATION_INTENT.reviewedVisual.provenanceRef,
  reviewedAt: "2026-08-15T16:00:00.000Z",
  learnerSafe: true,
} as const;

function currentMultimodalPresentation(): MultimodalPresentation {
  return {
    contractVersion: MULTIMODAL_CONTRACT_VERSION,
    envelope: "multimodal-presentation",
    scope: CURRENT_PROJECTION_SCOPE,
    interactionRef: CURRENT_PROJECTION_SCOPE.interactionRef,
    turnRef: "turn:w4-privacy",
    speaker: "tutor",
    content: { mode: "reviewed-image", visual: CURRENT_REVIEWED_VISUAL },
    caption: {
      captionRef: CURRENT_PRESENTATION_INTENT.accessibilityCaptionRef,
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
  };
}

function currentTrustedMultimodalContext(): TrustedMultimodalPolicyContext {
  const presentation = currentMultimodalPresentation();
  return {
    contextKind: "trusted-study-multimodal-policy-context",
    commercialExecutionScope: CURRENT_COMMERCIAL_SCOPE,
    studyAdvisory: CURRENT_STUDY_ADVISORY,
    scope: CURRENT_PROJECTION_SCOPE,
    captionBinding: {
      scope: CURRENT_PROJECTION_SCOPE,
      captionRef: presentation.caption.captionRef,
      text: presentation.caption.text,
      locale: presentation.caption.locale,
      use: "neutral-accessibility-metadata",
    },
    reviewedVisualBindings: [{
      scope: CURRENT_PROJECTION_SCOPE,
      visual: CURRENT_REVIEWED_VISUAL,
      provenanceStatus: "approved-content",
    }],
  };
}

interface SurfaceScan {
  readonly surface: string;
  readonly status: "PASS";
  readonly canariesScanned: number;
  readonly directMatches: 0;
  readonly normalizedMatches: 0;
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
    normalizedMatches: 0,
    encodedMatches: 0,
  };
}

export function runPrivacyDetectorNegativeControl(
  legitimateDurableProjection: unknown,
): {
  readonly mutation: "retain-raw-transcript-canary";
  readonly status: "DETECTED";
  readonly expectedDetector: "direct-canary-scan";
} {
  assert.equal(typeof legitimateDurableProjection, "object");
  assert.notEqual(legitimateDurableProjection, null);
  const disposableMutant = {
    ...(legitimateDurableProjection as Record<string, unknown>),
    rawTranscriptText: CANARIES.rawTranscript,
  };
  assert.throws(
    () => assertNoCanary("privacy-negative-control", disposableMutant),
    /privacy-negative-control leaked a direct canary/,
  );
  return {
    mutation: "retain-raw-transcript-canary",
    status: "DETECTED",
    expectedDetector: "direct-canary-scan",
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
    policyRevisionRef: "policy-revision:parent-reporting-v1-r4",
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
      reportRef: "report:w4-privacy",
      policyRef: "policy:parent-reporting-v1",
      policyRevisionRef: "policy-revision:parent-reporting-v1-r4",
      guardianRef: "guardian:synthetic-one",
      householdScopeRef: "household-scope:synthetic-one",
      learnerScopeRef: "learner-scope:synthetic-one",
      authorizationRevisionRef: "authorization-revision:w4-privacy-r1",
      currentAuthorizationRevisionRef: "authorization-revision:w4-privacy-r1",
      authorizationRevisionStatus: "current",
      authorizationIssuedEventRef: "event:w4-privacy-authorization-r1",
      authorizationIssuedAt: "2026-08-15T13:00:00.000Z",
      authorizationExpiresAt: "2026-08-15T18:00:00.000Z",
      visibility: "parent-report",
      consent: {
        policyRequirement: "not-required",
        consentState: "not-required",
        policyRef: "policy:parent-reporting-v1",
        policyRevisionRef: "policy-revision:parent-reporting-v1-r4",
        guardianRef: "guardian:synthetic-one",
        householdScopeRef: "household-scope:synthetic-one",
        learnerScopeRef: "learner-scope:synthetic-one",
        authorizationRef: "authorization:w4-privacy",
        authorizationRevisionRef: "authorization-revision:w4-privacy-r1",
        visibility: "parent-report",
        scopeKind: "session",
        sessionRef: "session:w4-privacy",
      },
      scopeKind: "session",
      sessionRef: "session:w4-privacy",
    },
    evidence: [],
  };
}

function parentReportTrustedAuthority(): unknown {
  const request = parentReportRequest() as {
    readonly guardianAuthorization: unknown;
  };
  return {
    authorityKind: "study-parent-report-trusted-authority",
    issuer: "study",
    reportRef: "report:w4-privacy",
    policy: {
      authorityKind: "study-parent-report-policy-authority",
      issuer: "study-policy",
      policyRef: "policy:parent-reporting-v1",
      policyRevisionRef: "policy-revision:parent-reporting-v1-r4",
      currentPolicyRevisionRef: "policy-revision:parent-reporting-v1-r4",
      policyRevisionStatus: "current",
      policyIssuedEventRef: "event:parent-reporting-policy-r4",
      consentRequirement: "not-required",
    },
    guardianAuthorization: request.guardianAuthorization,
    evidenceReceipts: [],
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
  const cleanExecutionInput = executionInput(cleanTransport);
  const cleanCommercial = executeCommercialTutorInvocation(cleanExecutionInput);
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

  const cleanCommercialTelemetry = cleanCommercial.telemetry[0];
  assert.ok(cleanCommercialTelemetry);
  const telemetrySource = {
    status: "success",
    eventRef: cleanCommercialTelemetry.eventRef,
    actionFamily: "hint",
    routeClass: "hosted-standard",
    metrics: {
      inputTokenCount: 100,
      outputTokenCount: 20,
      latencyMs: 50,
      costMicros: "100",
    },
    cacheClass: "miss",
    fallbackClass: "none",
  } as const;
  const telemetryLineage = {
    commercialScope: cleanExecutionInput.trustedScope,
    attempt: cleanCommercial.reservation.attempts[0],
    reservation: cleanCommercial.reservation,
  };
  const telemetryResult = projectTutorCommercialTelemetry(telemetrySource, telemetryLineage);
  assert.equal(telemetryResult.status, "projected");
  if (telemetryResult.status !== "projected") throw new Error("unreachable");
  const contaminatedTelemetryResult = projectTutorCommercialTelemetry({
    ...telemetrySource,
    metrics: { ...telemetrySource.metrics, syntheticCanaries: canaryPayload() },
    syntheticCanaries: canaryPayload(),
  }, telemetryLineage);
  assert.equal(contaminatedTelemetryResult.status, "projected");
  if (contaminatedTelemetryResult.status !== "projected") throw new Error("unreachable");
  assertNoCanary("contaminated-telemetry-projection", contaminatedTelemetryResult.event);

  const memoryScope: InstructionalMemoryScope = {
    scopeKind: "trusted-study-instructional-memory-scope",
    learnerScopeRef: "learner-scope:w4-privacy",
    sessionRef: "session:w4-privacy",
    contextRef: "interaction:w4-privacy",
    opportunityRef: "opportunity:w4-privacy",
  };
  const deltaInput = {
    commercialExecutionScopeRef: CURRENT_COMMERCIAL_SCOPE.scopeRef,
    householdScopeRef: CURRENT_COMMERCIAL_SCOPE.householdScopeRef,
    logicalOperationRef: "logical-operation:w4-privacy",
    sourceEventRef: "study-event:w4-privacy",
    conceptRef: CURRENT_COMMERCIAL_SCOPE.conceptRef,
    curriculumReleaseRef: CURRENT_COMMERCIAL_SCOPE.curriculumReleaseRef,
    curriculumPackageRef: CURRENT_COMMERCIAL_SCOPE.curriculumPackageRef,
    curriculumCourseRef: CURRENT_COMMERCIAL_SCOPE.curriculumCourseRef,
    curriculumSubjectRef: CURRENT_COMMERCIAL_SCOPE.curriculumSubjectRef,
    curriculumUnitRef: CURRENT_COMMERCIAL_SCOPE.curriculumUnitRef,
    curriculumLessonRef: CURRENT_COMMERCIAL_SCOPE.curriculumLessonRef,
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
  const recovered = coordinator.replay(CURRENT_COMMERCIAL_SCOPE, {
    recoveryKind: "recoverable-instructional-operation",
    commercialExecutionScopeRef: CURRENT_COMMERCIAL_SCOPE.scopeRef,
    householdScopeRef: CURRENT_COMMERCIAL_SCOPE.householdScopeRef,
    logicalOperationRef: "logical-operation:w4-privacy",
    sourceEventRef: "study-event:w4-privacy",
    effectRef: "study-effect:w4-privacy",
    effectDigest: `sha256:${"9".repeat(64)}`,
    conceptRef: CURRENT_COMMERCIAL_SCOPE.conceptRef,
    curriculumReleaseRef: CURRENT_COMMERCIAL_SCOPE.curriculumReleaseRef,
    curriculumPackageRef: CURRENT_COMMERCIAL_SCOPE.curriculumPackageRef,
    curriculumCourseRef: CURRENT_COMMERCIAL_SCOPE.curriculumCourseRef,
    curriculumSubjectRef: CURRENT_COMMERCIAL_SCOPE.curriculumSubjectRef,
    curriculumUnitRef: CURRENT_COMMERCIAL_SCOPE.curriculumUnitRef,
    curriculumLessonRef: CURRENT_COMMERCIAL_SCOPE.curriculumLessonRef,
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
    sessionRef: CURRENT_PROJECTION_SCOPE.sessionRef,
    presentation: currentMultimodalPresentation(),
    trustedContext: currentTrustedMultimodalContext(),
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
  for (const [field, expected] of Object.entries(CURRENT_PROJECTION_SCOPE)) {
    assert.equal(
      multimodalResult.evidence[field as keyof typeof CURRENT_PROJECTION_SCOPE],
      expected,
      `durable multimodal evidence lost ${field}`,
    );
  }
  assert.equal(multimodalResult.evidence.mode, "reviewed-image");
  assert.equal(multimodalResult.evidence.reviewedVisual?.contentDigest, CURRENT_PROJECTION_DIGEST);
  assert.equal(multimodalResult.evidence.reviewedVisual?.mimeType, "image/png");
  assert.equal(multimodalResult.evidence.reviewedVisual?.visualKind, "image");
  assert.equal(multimodalResult.evidence.reviewedVisual?.reviewStatus, "approved");
  assert.equal(multimodalResult.evidence.reviewedVisual?.provenanceRef, "provenance:w4-privacy-image");
  assert.equal(multimodalResult.evidence.transcriptPersisted, false);
  assert.equal(multimodalResult.evidence.rawMediaPersisted, false);
  const privacyNegativeControl = runPrivacyDetectorNegativeControl(multimodalResult.evidence);

  const cleanParentResult = buildMinimizedParentHubReport(
    parentReportRequest(),
    parentReportTrustedAuthority(),
  );
  assert.equal(cleanParentResult.status, "accepted");
  if (cleanParentResult.status !== "accepted") throw new Error("unreachable");
  const contaminatedParentResult = buildMinimizedParentHubReport({
    ...(parentReportRequest() as Record<string, unknown>),
    syntheticCanaries: canaryPayload(),
  }, parentReportTrustedAuthority());
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
  const releaseDirectories = ["tutor-v2-wave3-release", "tutor-v2-wave4-release"] as const;
  const staticScans: SurfaceScan[] = [];
  for (const directoryName of releaseDirectories) {
    const releaseDirectory = resolve(repoRoot, `adaptive-tutor/${directoryName}`);
    const releaseFiles = readdirSync(releaseDirectory)
      .filter((name) => name.endsWith(".json"))
      .sort();
    assert.equal(releaseFiles.length > 0, true);
    staticScans.push(...releaseFiles.map((name) =>
      assertNoCanary(
        `${directoryName}/${name}`,
        readFileSync(resolve(releaseDirectory, name), "utf8"),
      )
    ));
  }
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
    telemetry: contaminatedTelemetryResult.event,
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
    assertNoCanary("provider-policy-evidence", durableOutputs.providerPolicyEvidence),
  ];
  surfaceScans.push(...staticScans);

  const report = {
    session: SESSION,
    startingSha: STARTING_SHA,
    verdict: "W4_PRIVACY_CERTIFICATION_REPAIR_READY_FOR_RECONVERGENCE",
    syntheticOnly: true,
    productionStorageBuilt: false,
    liveNetworkCalls: 0,
    canaryCategories: CANARY_CATEGORIES,
    canaryCount: CANARY_VALUES.length,
    canaryCampaign: {
      status: "PASS",
      directLeakCount: 0,
      normalizedLeakCount: 0,
      encodedLeakCount: 0,
    },
    legitimateDurableProjection: {
      status: "accepted",
      scope: CURRENT_PROJECTION_SCOPE,
      reviewedVisual: {
        contentDigest: CURRENT_PROJECTION_DIGEST,
        mimeType: "image/png",
        visualKind: "image",
        reviewStatus: "approved",
        provenanceRef: "provenance:w4-privacy-image",
      },
      transcriptPersisted: multimodalResult.evidence.transcriptPersisted,
      rawMediaPersisted: multimodalResult.evidence.rawMediaPersisted,
    },
    privacyNegativeControl,
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
