import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  type Wave3HardGateEvidence,
} from "../../core/v3/commercial-operation/index.js";
import { executeCommercialTutorInvocation } from "../../core/v3/commercial-operation/orchestrate.js";
import {
  InstructionalMemoryProjectionStore,
  createInstructionalMemoryDelta,
  type ApplyInstructionalMemoryDeltaResult,
} from "../../core/v3/memory/index.js";
import {
  RecoverableInstructionalOperationCoordinator,
  type CanonicalStudyEffectAcceptCommand,
  type CanonicalStudyEffectAcceptResult,
  type CanonicalStudyEffectGateway,
  type CanonicalStudyEffectIdentity,
  type CanonicalStudyEffectLookupResult,
  type InstructionalMemoryDeltaPort,
  type MinimizedAcceptedStudyEffectEvent,
} from "../../core/v3/recovery/index.js";
import { buildMinimizedParentHubReport } from "../../study-engine/tutor-v2/parent-reporting/index.js";
import { decideCertification, runDeterministicFixtures } from "../../evals/v3/src/index.js";
import {
  DETERMINISTIC_FIXTURES,
  MOCK_PROVENANCE,
} from "../../evals/v3/fixtures/certification-fixtures.js";
import {
  ScriptedCommercialTransport,
  executionInput,
  successfulProviderResponse,
} from "./fixtures.js";

function forbiddenImportsAbsent(): boolean {
  const tutorRoot = process.cwd().endsWith("adaptive-tutor")
    ? process.cwd()
    : resolve("adaptive-tutor");
  const roots = ["core/v3", "study-engine/tutor-v2/wave3", "tests/tutor-v3-convergence"];
  const forbidden = ["@anthropic-ai", "openai", "elevenlabs", "netlify/functions", "supabase"];
  return roots.every((root) => readdirSync(resolve(tutorRoot, root), {
    recursive: true,
    withFileTypes: true,
  }).filter((entry) => entry.isFile() && entry.name.endsWith(".ts")).every((entry) => {
    const source = readFileSync(resolve(entry.parentPath, entry.name), "utf8");
    const imports = [...source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)]
      .map((match) => (match[1] ?? "").toLowerCase());
    return imports.every((specifier) =>
      forbidden.every((token) => !specifier.includes(token)) &&
      !resolve(entry.parentPath, specifier).startsWith(resolve(tutorRoot, "../src"))
    );
  }));
}

function recoveryProbe(): boolean {
  const commercialScope = executionInput().trustedScope;
  if (!("scopeRef" in commercialScope)) return false;
  const scope = {
    scopeKind: "trusted-study-instructional-memory-scope" as const,
    learnerScopeRef: "learner-scope:learner-a",
    sessionRef: "session:commercial-one",
    contextRef: "interaction:commercial-one",
    opportunityRef: "opportunity:fractions-one",
  };
  const memoryDelta = createInstructionalMemoryDelta({
    commercialExecutionScopeRef: commercialScope.scopeRef,
    householdScopeRef: commercialScope.householdScopeRef,
    logicalOperationRef: "logical-operation:commercial-one",
    sourceEventRef: "study-event:commercial-one-accepted",
    conceptRef: commercialScope.conceptRef,
    curriculumReleaseRef: commercialScope.curriculumReleaseRef,
    curriculumPackageRef: commercialScope.curriculumPackageRef,
    curriculumCourseRef: commercialScope.curriculumCourseRef,
    curriculumSubjectRef: commercialScope.curriculumSubjectRef,
    curriculumUnitRef: commercialScope.curriculumUnitRef,
    curriculumLessonRef: commercialScope.curriculumLessonRef,
    memoryDeltaRef: "memory-delta:commercial-one",
    memoryRef: "memory:commercial-one",
    scope,
    prior: null,
    operations: [{ operationKind: "add", field: "conceptRefs", value: "concept:fractions-one" }],
  });
  let accepted: MinimizedAcceptedStudyEffectEvent | null = null;
  let acceptCount = 0;
  const gateway: CanonicalStudyEffectGateway = {
    lookup(_identity: CanonicalStudyEffectIdentity): CanonicalStudyEffectLookupResult {
      return accepted ? { status: "accepted", event: structuredClone(accepted) } : { status: "missing" };
    },
    accept(command: CanonicalStudyEffectAcceptCommand): CanonicalStudyEffectAcceptResult {
      acceptCount += 1;
      accepted = structuredClone(command.acceptedEvent);
      return { status: "accepted", event: structuredClone(command.acceptedEvent) };
    },
  };
  const store = new InstructionalMemoryProjectionStore();
  let failures = 1;
  const memory: InstructionalMemoryDeltaPort = {
    apply(candidate: unknown): ApplyInstructionalMemoryDeltaResult {
      if (failures > 0) {
        failures -= 1;
        throw new Error("disposable memory failure");
      }
      return store.apply(candidate);
    },
  };
  const coordinator = new RecoverableInstructionalOperationCoordinator(gateway, memory);
  const operation = {
    recoveryKind: "recoverable-instructional-operation" as const,
    commercialExecutionScopeRef: commercialScope.scopeRef,
    householdScopeRef: commercialScope.householdScopeRef,
    logicalOperationRef: "logical-operation:commercial-one",
    sourceEventRef: "study-event:commercial-one-accepted",
    effectRef: "study-effect:commercial-one",
    effectDigest: `sha256:${"e".repeat(64)}`,
    conceptRef: commercialScope.conceptRef,
    curriculumReleaseRef: commercialScope.curriculumReleaseRef,
    curriculumPackageRef: commercialScope.curriculumPackageRef,
    curriculumCourseRef: commercialScope.curriculumCourseRef,
    curriculumSubjectRef: commercialScope.curriculumSubjectRef,
    curriculumUnitRef: commercialScope.curriculumUnitRef,
    curriculumLessonRef: commercialScope.curriculumLessonRef,
    scope,
    memoryDelta,
  };
  const first = coordinator.replay(commercialScope, operation);
  const second = coordinator.replay(commercialScope, operation);
  return first.status === "pending" && second.status === "complete" &&
    second.effectDisposition === "reused" && acceptCount === 1 && store.projectionCount === 1;
}

export async function collectWave3HardGateEvidence(): Promise<Wave3HardGateEvidence> {
  const successTransport = new ScriptedCommercialTransport([
    { status: "response", response: successfulProviderResponse() },
  ]);
  const success = executeCommercialTutorInvocation(executionInput(successTransport));
  const requestText = JSON.stringify(successTransport.requests[0] ?? {});

  const policyInput = executionInput(new ScriptedCommercialTransport([]));
  const policyResult = executeCommercialTutorInvocation({
    ...policyInput,
    routing: {
      ...policyInput.routing,
      providerPolicyRequirements: policyInput.routing.providerPolicyRequirements.map((value) => ({
        ...value,
        requiredContractPolicyRevision: "provider-policy-revision:foreign",
      })),
    },
  });

  const failoverTransport = new ScriptedCommercialTransport([
    {
      status: "failure",
      kind: "provider-timeout",
      metrics: { inputTokenCount: 1, outputTokenCount: 0, latencyMs: 100, costMicros: "0" },
    },
    { status: "response", response: successfulProviderResponse() },
  ]);
  const failover = executeCommercialTutorInvocation(executionInput(failoverTransport));

  const overReservationTransport = new ScriptedCommercialTransport([{
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
  const overReservation = executeCommercialTutorInvocation(
    executionInput(overReservationTransport),
  );

  const reportedLateTransport = new ScriptedCommercialTransport([{
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
  const reportedLate = executeCommercialTutorInvocation(
    executionInput(reportedLateTransport),
  );
  const measuredLateTransport = new ScriptedCommercialTransport([{
    status: "response",
    observedExecutionMs: 800,
    response: successfulProviderResponse(),
  }]);
  const measuredLate = executeCommercialTutorInvocation(
    executionInput(measuredLateTransport),
  );
  const insufficientDeadlineTransport = new ScriptedCommercialTransport([{
    status: "failure",
    kind: "provider-timeout",
    observedExecutionMs: 1_300,
    metrics: { inputTokenCount: 1, outputTokenCount: 0, latencyMs: 100, costMicros: "0" },
  }]);
  const insufficientDeadline = executeCommercialTutorInvocation(
    executionInput(insufficientDeadlineTransport),
  );

  const authorityResponse = successfulProviderResponse();
  (authorityResponse as Record<string, unknown>).officialMastery = true;
  const authorityRejected = executeCommercialTutorInvocation(executionInput(
    new ScriptedCommercialTransport([{ status: "response", response: authorityResponse }]),
  ));
  const groundingRejected = executeCommercialTutorInvocation(executionInput(
    new ScriptedCommercialTransport([{
      status: "response",
      response: successfulProviderResponse({ groundedClaims: [] }),
    }]),
  ));

  const curriculumInput = executionInput(new ScriptedCommercialTransport([]));
  const unknownCurriculum = structuredClone(curriculumInput.invocation) as Record<string, unknown>;
  (unknownCurriculum.curriculum as Record<string, unknown>).courseRef = "ma-g6-mathematics";
  const curriculumRejected = executeCommercialTutorInvocation({
    ...curriculumInput,
    invocation: unknownCurriculum,
  });
  const foreignDigest = structuredClone(curriculumInput.invocation) as Record<string, unknown>;
  (foreignDigest.curriculum as Record<string, unknown>).digest = `sha256:${"e".repeat(64)}`;
  const foreignDigestRejected = executeCommercialTutorInvocation({
    ...curriculumInput,
    invocation: foreignDigest,
  });
  const foreignSubject = structuredClone(curriculumInput.invocation) as Record<string, unknown>;
  foreignSubject.subjectRef = "subject:science";
  const foreignSubjectRejected = executeCommercialTutorInvocation({
    ...curriculumInput,
    invocation: foreignSubject,
  });
  const unknownStage = structuredClone(curriculumInput.invocation) as Record<string, unknown>;
  unknownStage.learnerStageRef = "learner-stage:not-approved";
  const stageRejected = executeCommercialTutorInvocation({ ...curriculumInput, invocation: unknownStage });

  const foreignScope = structuredClone(curriculumInput.invocation) as Record<string, unknown>;
  foreignScope.learnerScopeRef = "learner-scope:learner-b";
  const isolationRejected = executeCommercialTutorInvocation({ ...curriculumInput, invocation: foreignScope });

  const presentationResponse = successfulProviderResponse();
  ((presentationResponse as { output: Record<string, unknown> }).output).instructionalDisplayMode = "custom";
  const presentationRejected = executeCommercialTutorInvocation(executionInput(
    new ScriptedCommercialTransport([{ status: "response", response: presentationResponse }]),
  ));

  const parentRejected = buildMinimizedParentHubReport({}).status === "rejected";
  const evalResult = await runDeterministicFixtures({
    runId: "wave3-gate-composed-eval",
    harnessRevision: "tutor-v2-eval-harness:v3-composed-r1",
    provenance: MOCK_PROVENANCE,
    fixtures: DETERMINISTIC_FIXTURES,
  });
  const certification = decideCertification(evalResult.run);
  const composed = evalResult.adapter.requests.length > 0 &&
    evalResult.grader.invocations.length === evalResult.run.attempts.length &&
    evalResult.run.attempts.some((attempt) =>
      attempt.pipelineTrace.includes("model-output-validator") &&
      attempt.pipelineTrace.includes("grounding-evaluator") &&
      attempt.pipelineTrace.includes("academic-grader")
    ) && evalResult.run.attempts.every((attempt) =>
      attempt.pipelineTrace.includes("academic-grader") &&
      attempt.hardGates.some((gate) => gate.checkExecuted) &&
      attempt.hardGates.every((gate) => !gate.checkExecuted || gate.composedSystem === "pass")
    ) && certification.containmentPassed;

  const advisory = success.status === "advisory" ? success.advisory : null;
  const attempt = success.status === "advisory" ? success.reservation.attempts[0] : undefined;
  return {
    COMMERCIAL_PROVIDER_REQUEST_MINIMIZATION:
      success.status === "advisory" &&
      (successTransport.requests[0] as { rawAttemptDisclosureAllowed?: unknown }).rawAttemptDisclosureAllowed === false &&
      !/(learnerResponse|studentAnswer|correctAnswer|transcript|audio|imageBytes|credential)/.test(requestText),
    PROVIDER_POLICY_BEFORE_ROUTING: policyResult.status === "static-fallback" && policyResult.providerCalls === 0,
    IMMUTABLE_PROVIDER_MODEL_ROUTE_IDENTITY:
      Boolean(attempt?.modelRevisionRef && attempt.configurationDigest && attempt.capabilityProfileDigest && attempt.providerPolicyEvidenceRef),
    INTEGER_MICROS_ATTEMPT_BUDGET:
      success.status === "advisory" && success.reservation.attempts.every((item) =>
        typeof item.reservedCostMicros === "string" && /^(0|[1-9][0-9]*)$/.test(item.reservedCostMicros)
      ) && overReservation.status === "static-fallback" &&
      overReservationTransport.requests.length === 1,
    END_TO_END_DEADLINE_BOUNDED_FAILOVER:
      failover.status === "advisory" && failover.providerCalls === 2 &&
      failoverTransport.attempts.length === 2 &&
      reportedLate.status === "static-fallback" &&
      measuredLate.status === "static-fallback" &&
      insufficientDeadline.status === "static-fallback" &&
      insufficientDeadline.providerCalls === 1,
    UNTRUSTED_MODEL_OUTPUT_BOUNDARY: authorityRejected.status === "static-fallback",
    GROUNDED_CONTEXT_OR_REFUSAL: groundingRejected.status === "static-fallback",
    CURRICULUM_TUTOR_ADMISSION:
      curriculumRejected.status === "static-fallback" && curriculumRejected.providerCalls === 0 &&
      foreignDigestRejected.status === "static-fallback" && foreignDigestRejected.providerCalls === 0 &&
      foreignSubjectRejected.status === "static-fallback" && foreignSubjectRejected.providerCalls === 0,
    APPROVED_LEARNER_STAGE_CATALOG: stageRejected.status === "static-fallback" && stageRejected.providerCalls === 0,
    RECOVERABLE_EFFECT_MEMORY_REPLAY: recoveryProbe(),
    TRANSIENT_MULTIMODAL_MINIMIZATION:
      readFileSync(resolve(process.cwd().endsWith("adaptive-tutor") ? process.cwd() : "adaptive-tutor", "core/v3/multimodal/contracts.ts"), "utf8")
        .includes("rawMediaPersisted: Type.Literal(false)"),
    PARENT_REPORT_GUARDIAN_AUTHORIZATION: parentRejected,
    TELEMETRY_OPERATION_ATTEMPT_LINEAGE:
      success.status === "advisory" && success.telemetry.length === 1 &&
      success.telemetry[0]?.logicalOperationRef === success.reservation.logicalOperationRef &&
      success.telemetry[0]?.physicalAttemptRef === success.reservation.attempts[0]?.physicalAttemptRef,
    CLOSED_PRESENTATION_INTENT: presentationRejected.status === "static-fallback",
    COMPOSED_EVALUATION_EXECUTION: composed,
    CROSS_CHILD_COMMERCIAL_ISOLATION: isolationRejected.status === "static-fallback" && isolationRejected.providerCalls === 0,
    ONE_STUDY_ENGINE_AUTHORITY:
      advisory !== null && advisory.studyDecisionRequired && !advisory.studyMutationAllowed &&
      !advisory.officialMasteryAuthority && !advisory.officialWorkingLevelAuthority &&
      !advisory.segmentCompletionAuthority,
    NO_VENDOR_PRODUCTION_IMPORT: forbiddenImportsAbsent(),
  };
}
