import type { Wave3HardGateFamily } from "../../../core/v3/commercial-operation/index.js";

export interface GuardedRewrite {
  readonly sourcePath: string;
  readonly before: string | null;
  readonly after: string;
}

export interface MutationDefinition {
  readonly family: Wave3HardGateFamily;
  readonly invariant: string;
  readonly mutationId: string;
  readonly description: string;
  readonly method: "guarded-function-scoped-source-rewrite";
  readonly rewrites: readonly GuardedRewrite[];
  readonly focusedTestFile: string;
  readonly expectedFailingTests: readonly string[];
  readonly expectedFailedGate: Wave3HardGateFamily;
}

const commercialFlow = "scripts/tutor-v3/.dist/tests/tutor-v3-convergence/commercial-flow.test.js";

export const MUTATIONS: readonly MutationDefinition[] = [
  {
    family: "COMMERCIAL_PROVIDER_REQUEST_MINIMIZATION",
    invariant: "The executable provider request is allowlisted and never permits raw learner-attempt disclosure.",
    mutationId: "W3-M01-DISCLOSURE-TRUE",
    description: "Emit rawAttemptDisclosureAllowed=true through the executable provider request contract.",
    method: "guarded-function-scoped-source-rewrite",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/provider-request/contracts.ts",
      before: `    rawAttemptDisclosureAllowed: Type.Literal(false),\n`,
      after: `    rawAttemptDisclosureAllowed: Type.Boolean(),\n`,
    }, {
      sourcePath: "adaptive-tutor/core/v3/provider-request/contracts.ts",
      before: `export const COMMERCIAL_PROVIDER_RAW_ATTEMPT_DISCLOSURE_ALLOWED = false as const;\n`,
      after: `export const COMMERCIAL_PROVIDER_RAW_ATTEMPT_DISCLOSURE_ALLOWED = true as const;\n`,
    }],
    focusedTestFile: commercialFlow,
    expectedFailingTests: ["provider request is structurally minimized"],
    expectedFailedGate: "COMMERCIAL_PROVIDER_REQUEST_MINIMIZATION",
  },
  {
    family: "PROVIDER_POLICY_BEFORE_ROUTING",
    invariant: "Only providers with an eligible decision for the required policy revision enter the routing catalog.",
    mutationId: "W3-M02-BYPASS-POLICY-DECISION",
    description: "Allow a non-eligible trusted provider-policy decision into the routing catalog.",
    method: "guarded-function-scoped-source-rewrite",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/routing/provider-routing/catalog.ts",
      before: `      decision.decision !== "eligible" ||\n`,
      after: "",
    }],
    focusedTestFile: "scripts/tutor-v3/.dist/core/v3/routing/provider-routing/provider-routing.test.js",
    expectedFailingTests: ["provider-policy must be evaluated per provider and revision"],
    expectedFailedGate: "PROVIDER_POLICY_BEFORE_ROUTING",
  },
  {
    family: "IMMUTABLE_PROVIDER_MODEL_ROUTE_IDENTITY",
    invariant: "Every planned physical attempt pins immutable provider, model revision, configuration, capability, and policy evidence identity.",
    mutationId: "W3-M03-MUTABLE-MODEL-ALIAS",
    description: "Pin the planned attempt's modelRevisionRef to the mutable modelRef alias.",
    method: "guarded-function-scoped-source-rewrite",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/routing/provider-routing/router.ts",
      before: `    modelRevisionRef: candidate.model.modelRevisionRef,\n`,
      after: `    modelRevisionRef: candidate.model.modelRef,\n`,
    }],
    focusedTestFile: "scripts/tutor-v3/.dist/core/v3/routing/provider-routing/provider-routing.test.js",
    expectedFailingTests: ["selects a bounded provider-independent immutable attempt"],
    expectedFailedGate: "IMMUTABLE_PROVIDER_MODEL_ROUTE_IDENTITY",
  },
  {
    family: "INTEGER_MICROS_ATTEMPT_BUDGET",
    invariant: "Canonical decimal-string IntegerMicros are settled per physical attempt, and no attempt may exceed its own immutable reserve.",
    mutationId: "W3-M04-REMOVE-PER-ATTEMPT-COST-BOUND",
    description: "Remove per-physical-attempt cost bounds while retaining aggregate settlement.",
    method: "guarded-function-scoped-source-rewrite",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/commercial-operation/orchestrate.ts",
      before: `  try {\n    if (BigInt(receipt.actualCostMicros) > BigInt(attempt.reservedCostMicros)) return null;\n  } catch {\n    return null;\n  }\n`,
      after: "",
    }, {
      sourcePath: "adaptive-tutor/core/v3/routing/budget-resilience/policy.ts",
      before: `    if (actual > attemptReserved) {\n      return {\n        contractVersion: BUDGET_RESILIENCE_VERSION,\n        reservationRef: reservation.reservationRef,\n        logicalOperationRef: reservation.logicalOperationRef,\n        outcome: "rejected-over-reservation",\n        actualCostMicros: receipt.actualCostMicros,\n        consumedCostMicros: reservation.totalReservedMicros,\n        releasedCostMicros: "0",\n        accountingGap: true,\n        costAnomaly: true,\n      };\n    }\n`,
      after: "",
    }],
    focusedTestFile: commercialFlow,
    expectedFailingTests: ["a physical attempt cannot overrun its reserve using unused failover reserve"],
    expectedFailedGate: "INTEGER_MICROS_ATTEMPT_BUDGET",
  },
  {
    family: "END_TO_END_DEADLINE_BOUNDED_FAILOVER",
    invariant: "Trusted measured attempt and operation deadlines reject late success and permit failover only inside the remaining bounded window.",
    mutationId: "W3-M05-TRUST-PROVIDER-LATENCY",
    description: "Replace trusted measured success deadlines with provider-reported latency only.",
    method: "guarded-function-scoped-source-rewrite",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/commercial-operation/orchestrate.ts",
      before: `      const operationElapsedMs = Math.max(\n        attemptCompletedAtMs - operationStartedAtMs,\n        reportedCompletionElapsedMs ?? Number.MAX_SAFE_INTEGER,\n      );\n      const late =\n        observedAttemptMs > attempt.timeoutMs ||\n        reportedLatencyMs > attempt.timeoutMs ||\n        attemptCompletedAtMs > operationDeadlineAtMs ||\n        operationElapsedMs > input.routing.latencyCeilingMs;\n`,
      after: `      const late =\n        reportedLatencyMs > attempt.timeoutMs ||\n        reportedCompletionElapsedMs === null ||\n        reportedCompletionElapsedMs > input.routing.latencyCeilingMs;\n`,
    }],
    focusedTestFile: commercialFlow,
    expectedFailingTests: ["measured execution over attempt timeout rejects low reported latency"],
    expectedFailedGate: "END_TO_END_DEADLINE_BOUNDED_FAILOVER",
  },
  {
    family: "UNTRUSTED_MODEL_OUTPUT_BOUNDARY",
    invariant: "Provider output is parsed through a recursively closed bounded response contract before any advisory is constructed.",
    mutationId: "W3-M06-OPEN-PROVIDER-RESPONSE",
    description: "Permit unknown properties on the executable bounded provider-response schema.",
    method: "guarded-function-scoped-source-rewrite",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/contracts/commercial.ts",
      before: `  { additionalProperties: false, $id: "BoundedCommercialProviderResponse" },\n`,
      after: `  { additionalProperties: true, $id: "BoundedCommercialProviderResponse" },\n`,
    }],
    focusedTestFile: commercialFlow,
    expectedFailingTests: ["unknown and authority-bearing provider fields are rejected"],
    expectedFailedGate: "UNTRUSTED_MODEL_OUTPUT_BOUNDARY",
  },
  {
    family: "GROUNDED_CONTEXT_OR_REFUSAL",
    invariant: "Unsupported provider claims cannot become instructional advice and instead produce reviewed static fallback.",
    mutationId: "W3-M07-BYPASS-GROUNDING-REFUSAL",
    description: "Neutralize the insufficient-grounding refusal predicate.",
    method: "guarded-function-scoped-source-rewrite",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/commercial-operation/orchestrate.ts",
      before: `    if (grounding.status !== "grounded") {\n      return {\n        status: "static-fallback",\n        advisory: staticAdvisory(invocation, "INSUFFICIENT_GROUNDED_CONTEXT"),\n        providerCalls,\n        telemetry,\n      };\n    }\n`,
      after: `    if (grounding.status !== "grounded") {\n      grounding = null;\n    }\n`,
    }],
    focusedTestFile: commercialFlow,
    expectedFailingTests: ["unsupported grounded claim forces refusal/static fallback"],
    expectedFailedGate: "GROUNDED_CONTEXT_OR_REFUSAL",
  },
  {
    family: "CURRICULUM_TUTOR_ADMISSION",
    invariant: "The full trusted curriculum authority tuple, including digest and reconciled subject, must match before provider execution.",
    mutationId: "W3-M08-REMOVE-CURRICULUM-DIGEST-RECONCILIATION",
    description: "Remove only the trusted curriculum release-digest equality check.",
    method: "guarded-function-scoped-source-rewrite",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/commercial-operation/orchestrate.ts",
      before: `    metadata.releaseDigest !== invocation.curriculum.digest ||\n`,
      after: "",
    }],
    focusedTestFile: commercialFlow,
    expectedFailingTests: ["foreign trusted invocation curriculum digest fails before provider execution"],
    expectedFailedGate: "CURRICULUM_TUTOR_ADMISSION",
  },
  {
    family: "APPROVED_LEARNER_STAGE_CATALOG",
    invariant: "Unknown learner-stage bindings fail closed rather than defaulting to an approved routing profile.",
    mutationId: "W3-M09-DEFAULT-UNKNOWN-STAGE",
    description: "Default an unknown learner stage to the first approved profile and routing class.",
    method: "guarded-function-scoped-source-rewrite",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/learner-stage-policy/catalog.ts",
      before: `    const profile = profilesByStage.get(binding.learnerStageRef as SupportedLearnerStageRef);\n    const routingStageClass = routingByStage.get(\n      binding.learnerStageRef as SupportedLearnerStageRef,\n    );\n`,
      after: `    const profile = profilesByStage.get(binding.learnerStageRef as SupportedLearnerStageRef)\n      ?? profiles[2];\n    const routingStageClass = routingByStage.get(\n      binding.learnerStageRef as SupportedLearnerStageRef,\n    ) ?? "MIDDLE_GRADES";\n`,
    }],
    focusedTestFile: commercialFlow,
    expectedFailingTests: ["unknown learner stage fails closed before provider execution"],
    expectedFailedGate: "APPROVED_LEARNER_STAGE_CATALOG",
  },
  {
    family: "RECOVERABLE_EFFECT_MEMORY_REPLAY",
    invariant: "Accepted Study effects are recovered by canonical identity and memory replay remains idempotent after partial failure.",
    mutationId: "W3-M10-FORCE-ACCEPTED-EFFECT-MISSING",
    description: "Force canonical accepted-effect lookup results to behave as missing.",
    method: "guarded-function-scoped-source-rewrite",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/recovery/recoverable-memory-replay.ts",
      before: `      lookup = this.#effectGateway.lookup(identity);\n`,
      after: `      this.#effectGateway.lookup(identity);\n      lookup = { status: "missing" } as CanonicalStudyEffectLookupResult;\n`,
    }],
    focusedTestFile: "scripts/tutor-v3/.dist/core/v3/recovery/recoverable-memory-replay.test.js",
    expectedFailingTests: ["memory failure after effect acceptance remains memory-pending and retry repairs it"],
    expectedFailedGate: "RECOVERABLE_EFFECT_MEMORY_REPLAY",
  },
  {
    family: "TRANSIENT_MULTIMODAL_MINIMIZATION",
    invariant: "Raw media, transcripts, captions, and content remain transient and cannot enter durable multimodal evidence.",
    mutationId: "W3-M11-PERSIST-TRANSCRIPT-IN-CAPTION-REF",
    description: "Project transient transcript text into a durable schema-valid caption reference.",
    method: "guarded-function-scoped-source-rewrite",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/multimodal/projection.ts",
      before: `    captionRef: source.presentation.caption.captionRef,\n`,
      after: `    captionRef: source.transient?.transcriptText === undefined\n      ? source.presentation.caption.captionRef\n      : \`transcript:\${source.transient.transcriptText}\`,\n`,
    }],
    focusedTestFile: "scripts/tutor-v3/.dist/core/v3/multimodal/multimodal.test.js",
    expectedFailingTests: ["minimization projection cannot carry raw media, transcript, caption, or content"],
    expectedFailedGate: "TRANSIENT_MULTIMODAL_MINIMIZATION",
  },
  {
    family: "PARENT_REPORT_GUARDIAN_AUTHORIZATION",
    invariant: "Parent reporting requires exact guardian, household, learner, session, and reporting-period authorization scope.",
    mutationId: "W3-M12-REMOVE-PARENT-LEARNER-SCOPE",
    description: "Remove learner-scope equality from actual guardian authorization matching.",
    method: "guarded-function-scoped-source-rewrite",
    rewrites: [{
      sourcePath: "adaptive-tutor/study-engine/tutor-v2/parent-reporting/parent-report.ts",
      before: `    authorization.learnerScopeRef !== reportScope.selectedLearnerRef ||\n`,
      after: "",
    }],
    focusedTestFile: "scripts/tutor-v3/.dist/study-engine/tutor-v2/parent-reporting/parent-report.test.js",
    expectedFailingTests: ["wrong guardian, household, learner, session, or period authorization fails closed"],
    expectedFailedGate: "PARENT_REPORT_GUARDIAN_AUTHORIZATION",
  },
  {
    family: "TELEMETRY_OPERATION_ATTEMPT_LINEAGE",
    invariant: "Commercial telemetry preserves distinct logical-operation, physical-attempt, route-plan, and reservation lineage.",
    mutationId: "W3-M13-COLLAPSE-TELEMETRY-LINEAGE",
    description: "Emit physicalAttemptRef from logicalOperationRef in production telemetry.",
    method: "guarded-function-scoped-source-rewrite",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/telemetry/projection.ts",
      before: `    physicalAttemptRef: attempt.physicalAttemptRef,\n`,
      after: `    physicalAttemptRef: attempt.logicalOperationRef,\n`,
    }],
    focusedTestFile: "scripts/tutor-v3/.dist/core/v3/telemetry/telemetry.test.js",
    expectedFailingTests: ["projects exact commercial attempt and reservation lineage"],
    expectedFailedGate: "TELEMETRY_OPERATION_ATTEMPT_LINEAGE",
  },
  {
    family: "CLOSED_PRESENTATION_INTENT",
    invariant: "Presentation proposals must match the closed trusted intent contract and cannot carry authority fields.",
    mutationId: "W3-M14-BYPASS-PROPOSAL-INTENT-MATCH",
    description: "Remove actual proposal-to-presentation-intent consistency rejection.",
    method: "guarded-function-scoped-source-rewrite",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/presentation/presentation.ts",
      before: `    if (intentValidation.status === "rejected" || !proposalMatchesIntent(response)) {\n`,
      after: `    if (intentValidation.status === "rejected" || (!proposalMatchesIntent(response) && Boolean(0))) {\n`,
    }],
    focusedTestFile: "scripts/tutor-v3/.dist/core/v3/presentation/presentation.test.js",
    expectedFailingTests: ["authority fields are rejected from intent and commercial wrapper"],
    expectedFailedGate: "CLOSED_PRESENTATION_INTENT",
  },
  {
    family: "COMPOSED_EVALUATION_EXECUTION",
    invariant: "Only executed composed-system checks may pass; unreached hard gates remain explicitly not evaluated.",
    mutationId: "W3-M15-PREFILL-UNREACHED-GATES-PASS",
    description: "Prefill unreached composed-evaluation hard gates as executed/pass.",
    method: "guarded-function-scoped-source-rewrite",
    rewrites: [{
      sourcePath: "adaptive-tutor/evals/v3/src/containment.ts",
      before: `    checkExecuted: false,\n    evidenceSource: null,\n    modelBehavior: "not-evaluated",\n    composedSystem: "not-evaluated",\n`,
      after: `    checkExecuted: true,\n    evidenceSource: "policy-outcome",\n    modelBehavior: "pass",\n    composedSystem: "pass",\n`,
    }],
    focusedTestFile: "scripts/tutor-v3/.dist/evals/v3/tests/harness.test.js",
    expectedFailingTests: ["unreached hard gates remain not-evaluated instead of defaulting to pass"],
    expectedFailedGate: "COMPOSED_EVALUATION_EXECUTION",
  },
  {
    family: "CROSS_CHILD_COMMERCIAL_ISOLATION",
    invariant: "The trusted learner scope must exactly match the commercial invocation before any provider call.",
    mutationId: "W3-M16-REMOVE-COMMERCIAL-LEARNER-SCOPE",
    description: "Remove learner-scope equality from the trusted commercial invocation guard.",
    method: "guarded-function-scoped-source-rewrite",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/commercial-operation/orchestrate.ts",
      before: `    invocation.learnerScopeRef !== input.trustedScope.learnerScopeRef ||\n`,
      after: "",
    }],
    focusedTestFile: commercialFlow,
    expectedFailingTests: ["foreign learner scope cannot influence the invocation"],
    expectedFailedGate: "CROSS_CHILD_COMMERCIAL_ISOLATION",
  },
  {
    family: "ONE_STUDY_ENGINE_AUTHORITY",
    invariant: "Tutor output remains advisory and cannot mutate Study mastery, working level, curriculum, or segment completion.",
    mutationId: "W3-M17-GRANT-STUDY-MUTATION-AUTHORITY",
    description: "Emit an authority-bearing value in successful Study advisory behavior.",
    method: "guarded-function-scoped-source-rewrite",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/commercial-operation/orchestrate.ts",
      before: `    presentationIntent: proposal ? response.presentationIntent : null,\n    studyDecisionRequired: true,\n    studyMutationAllowed: false,\n`,
      after: `    presentationIntent: proposal ? response.presentationIntent : null,\n    studyDecisionRequired: true,\n    studyMutationAllowed: true as false,\n`,
    }],
    focusedTestFile: commercialFlow,
    expectedFailingTests: ["canonical commercial flow returns only a Study advisory"],
    expectedFailedGate: "ONE_STUDY_ENGINE_AUTHORITY",
  },
  {
    family: "NO_VENDOR_PRODUCTION_IMPORT",
    invariant: "Wave 3 foundation source contains no vendor SDK, deployment, credential, hosted-service, or production UI import.",
    mutationId: "W3-M18-ADD-VENDOR-IMPORT",
    description: "Add an executable vendor import with a controlled inert compile-time stub.",
    method: "guarded-function-scoped-source-rewrite",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/index.ts",
      before: `export * from "./commercial-operation/index.js";\n`,
      after: `import "@anthropic-ai/sdk";\n\nexport * from "./commercial-operation/index.js";\n`,
    }, {
      sourcePath: "adaptive-tutor/core/v3/mutation-vendor-stub.d.ts",
      before: null,
      after: `declare module "@anthropic-ai/sdk";\n`,
    }],
    focusedTestFile: commercialFlow,
    expectedFailingTests: ["Wave 3 foundation has no vendor, deployment, credential, or production UI imports"],
    expectedFailedGate: "NO_VENDOR_PRODUCTION_IMPORT",
  },
] as const;
