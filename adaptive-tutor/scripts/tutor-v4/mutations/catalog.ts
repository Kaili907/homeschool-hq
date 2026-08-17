import type { Wave4HardGateFamily } from "../evidence.js";

export interface GuardedRewrite {
  readonly sourcePath: string;
  readonly before: string;
  readonly after: string;
}

export interface Wave4MutationDefinition {
  readonly mutationId: `W4-M${string}`;
  readonly family: Wave4HardGateFamily;
  readonly description: string;
  readonly semanticShape: string;
  readonly rewrites: readonly GuardedRewrite[];
  readonly javascriptSyntaxChecks?: readonly string[];
}

export const WAVE4_IMPLEMENTATION_MUTATIONS: readonly Wave4MutationDefinition[] = [
  {
    mutationId: "W4-M01-AUTHORITY-FIELD-WIDENING",
    family: "PROMPT_INJECTION_AUTHORITY_CONTAINMENT",
    description: "Widen the executable successful advisory's Study mutation authority field.",
    semanticShape: "M01 prompt-injection authority-field/hierarchy weakening",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/commercial-operation/orchestrate.ts",
      before: `    presentationIntent: proposal ? response.presentationIntent : null,\n    studyDecisionRequired: true,\n    studyMutationAllowed: false,\n`,
      after: `    presentationIntent: proposal ? response.presentationIntent : null,\n    studyDecisionRequired: true,\n    studyMutationAllowed: true as false,\n`,
    }],
  },
  {
    mutationId: "W4-M02-REMOVE-ASK-CHECK-PROTECTION",
    family: "ACTIVE_ASSESSMENT_ANSWER_EXTRACTION_RESISTANCE",
    description: "Remove ask-check from the structural active-assessment free-form rejection set.",
    semanticShape: "M02 structural active-assessment anti-answer weakening",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v2/policy/anti-answer/index.ts",
      before: `    "ask-check",\n`,
      after: "",
    }],
  },
  {
    mutationId: "W4-M03-REMOVE-CANONICAL-LEARNER-SCOPE",
    family: "CROSS_SCOPE_COMMERCIAL_ISOLATION",
    description: "Remove canonical learner-scope equality before commercial dispatch.",
    semanticShape: "M03 CommercialExecutionScope equality/reconciliation weakening",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/commercial-operation/orchestrate.ts",
      before: `    invocation.householdScopeRef !== input.trustedScope.householdScopeRef ||\n    invocation.learnerScopeRef !== input.trustedScope.learnerScopeRef ||\n    invocation.sessionRef !== input.trustedScope.sessionRef ||\n`,
      after: `    invocation.householdScopeRef !== input.trustedScope.householdScopeRef ||\n    invocation.sessionRef !== input.trustedScope.sessionRef ||\n`,
    }],
  },
  {
    mutationId: "W4-M04-REDISPATCH-EXISTING-ATTEMPT",
    family: "REPLAY_CRASH_IDEMPOTENCY",
    description: "Bypass reuse of an already observed provider physical attempt.",
    semanticShape: "M04 accepted-effect/provider replay idempotency weakening",
    rewrites: [{
      sourcePath: "adaptive-tutor/adversarial/v4/replay-crash/state-machine.ts",
      before: `    const existing = this.#dispatches.get(attempt.physicalAttemptRef);\n    if (existing) {\n`,
      after: `    const existing = this.#dispatches.get(attempt.physicalAttemptRef);\n    if (existing && false) {\n`,
    }],
  },
  {
    mutationId: "W4-M05-BYPASS-RESPONSE-STATE-REVALIDATION",
    family: "PROVIDER_CHAOS_CURRENT_STATE_REVALIDATION",
    description: "Bypass current trusted provider-state revalidation before response acceptance.",
    semanticShape: "M05 current trusted provider-state revalidation bypass",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/commercial-operation/orchestrate.ts",
      before: `      if (\n        validateCurrentCommercialExecutionEligibility(\n          responseEligibility,\n          responseEligibilityRequest,\n        ) === null\n      ) {\n        return {\n          status: "static-fallback",\n          advisory: staticAdvisory(invocation, "NO_ELIGIBLE_PROVIDER_ROUTE"),\n          providerCalls,\n          telemetry,\n        };\n      }\n`,
      after: `      if (\n        validateCurrentCommercialExecutionEligibility(\n          responseEligibility,\n          responseEligibilityRequest,\n        ) === null && false\n      ) {\n        return {\n          status: "static-fallback",\n          advisory: staticAdvisory(invocation, "NO_ELIGIBLE_PROVIDER_ROUTE"),\n          providerCalls,\n          telemetry,\n        };\n      }\n`,
    }],
  },
  {
    mutationId: "W4-M06-ALLOW-ALREADY-CLAIMED-DISPATCH",
    family: "RESOURCE_BOUNDS_AND_SINGLE_USE_DISPATCH",
    description: "Permit ALREADY_CLAIMED to continue into physical provider dispatch.",
    semanticShape: "M06 claimPhysicalAttemptDispatch / ALREADY_CLAIMED enforcement bypass",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/commercial-operation/orchestrate.ts",
      before: `    if (dispatchClaim !== "CLAIMED") break;\n    providerCalls += 1;\n`,
      after: `    if (dispatchClaim === "CONFLICT") break;\n    providerCalls += 1;\n`,
    }],
  },
  {
    mutationId: "W4-M07-PERSIST-RAW-TRANSCRIPT",
    family: "PRIVACY_RETENTION_MINIMIZATION",
    description: "Project a forbidden raw transcript canary into durable captionRef.",
    semanticShape: "M07 forbidden synthetic canary/raw field durable projection",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/multimodal/projection.ts",
      before: `    captionRef: source.presentation.caption.captionRef,\n`,
      after: `    captionRef: source.transient?.transcriptText === undefined\n      ? source.presentation.caption.captionRef\n      : \`transcript:\${source.transient.transcriptText}\`,\n`,
    }],
  },
  {
    mutationId: "W4-M08-REMOVE-VISUAL-DIGEST-BINDING",
    family: "MULTIMODAL_PRESENTATION_BOUNDARY_HARDENING",
    description: "Remove reviewed-visual digest equality from trusted media binding.",
    semanticShape: "M08 load-bearing digest validation removal",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/multimodal/policy.ts",
      before: `    && left.visualKind === right.visualKind\n    && left.contentDigest === right.contentDigest\n    && left.mimeType === right.mimeType\n`,
      after: `    && left.visualKind === right.visualKind\n    && left.mimeType === right.mimeType\n`,
    }],
  },
  {
    mutationId: "W4-M09-COMPENSATE-HARD-MULTILINGUAL-FAILURE",
    family: "MULTILINGUAL_HARD_BOUNDARY_PRESERVATION",
    description: "Allow a hard multilingual semantic failure to avoid the hard-gate decision.",
    semanticShape: "M09 hard semantic violation compensation",
    rewrites: [{
      sourcePath: "adaptive-tutor/adversarial/v4/multilingual-eval/src/scorer.mjs",
      before: `    decision: hardFailures.length > 0\n      ? "FAIL_HARD_GATE"\n`,
      after: `    decision: hardFailures.length > 0 && total < 0\n      ? "FAIL_HARD_GATE"\n`,
    }],
    javascriptSyntaxChecks: ["adaptive-tutor/adversarial/v4/multilingual-eval/src/scorer.mjs"],
  },
  {
    mutationId: "W4-M10-REMOVE-GUARDIAN-LEARNER-BINDING",
    family: "PARENT_GUARDIAN_AUTHORIZATION_TRUTHFULNESS",
    description: "Remove learner binding from guardian authorization scope matching.",
    semanticShape: "M10 consent/guardian binding requirement removal",
    rewrites: [{
      sourcePath: "adaptive-tutor/study-engine/tutor-v2/parent-reporting/parent-report.ts",
      before: `    authorization.guardianRef !== reportScope.guardianRef ||\n    authorization.householdScopeRef !== reportScope.householdScopeRef ||\n    authorization.learnerScopeRef !== reportScope.selectedLearnerRef ||\n    authorization.scopeKind !== reportScope.scopeKind\n`,
      after: `    authorization.guardianRef !== reportScope.guardianRef ||\n    authorization.householdScopeRef !== reportScope.householdScopeRef ||\n    authorization.scopeKind !== reportScope.scopeKind\n`,
    }, {
      sourcePath: "adaptive-tutor/study-engine/tutor-v2/parent-reporting/parent-report.ts",
      before: `    submitted.guardianRef === trusted.guardianRef &&\n    submitted.householdScopeRef === trusted.householdScopeRef &&\n    submitted.learnerScopeRef === trusted.learnerScopeRef &&\n    submitted.authorizationRevisionRef === trusted.authorizationRevisionRef &&\n`,
      after: `    submitted.guardianRef === trusted.guardianRef &&\n    submitted.householdScopeRef === trusted.householdScopeRef &&\n    submitted.authorizationRevisionRef === trusted.authorizationRevisionRef &&\n`,
    }],
  },
  {
    mutationId: "W4-M11-IGNORE-MODEL-CONFIG-DRIFT",
    family: "MODEL_DRIFT_CERTIFICATION_IDENTITY",
    description: "Exclude model revision and configuration digest from changed certification identity.",
    semanticShape: "M11 modelRevision/configuration drift certification retention",
    rewrites: [{
      sourcePath: "adaptive-tutor/certification/v4/model-drift/src/identity.ts",
      before: `  return CERTIFICATION_IDENTITY_FIELDS.filter((field) => certified[field] !== observed[field]);\n`,
      after: `  return CERTIFICATION_IDENTITY_FIELDS.filter((field) =>\n    field !== "modelRevisionRef"\n    && field !== "configurationDigest"\n    && certified[field] !== observed[field]\n  );\n`,
    }],
  },
  {
    mutationId: "W4-M12-CONTINUE-AFTER-HARD-VIOLATION",
    family: "OFFLINE_LIVE_CERT_RUNNER_HARD_FAIL",
    description: "Continue campaign execution after recording a hard violation.",
    semanticShape: "M12 hard violation non-failing campaign continuation",
    rewrites: [{
      sourcePath: "adaptive-tutor/certification/v4/live-runner/src/runner.ts",
      before: `        haltReason = "hard-violation";\n        break campaignLoop;\n      }\n`,
      after: `        haltReason = "hard-violation";\n      }\n`,
    }],
  },
  {
    mutationId: "W4-M13-ADD-LIVE-VENDOR-ENDPOINT",
    family: "SUPPLY_CHAIN_VENDOR_SECRET_ISOLATION",
    description: "Introduce a prohibited live vendor endpoint into scanned foundation source.",
    semanticShape: "M13 prohibited vendor/credential/live-endpoint foundation reference",
    rewrites: [{
      sourcePath: "adaptive-tutor/core/v3/index.ts",
      before: `export * from "./commercial-operation/index.js";\n`,
      after: `export const W4_MUTANT_LIVE_ENDPOINT = "https://api.openai.com/v1/responses";\n\nexport * from "./commercial-operation/index.js";\n`,
    }],
  },
] as const;
