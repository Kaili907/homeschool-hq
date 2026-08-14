import {
  TUTOR_V2_ACTION_COMPATIBILITY_ID,
  TUTOR_V2_ACTION_SCHEMA_VERSION,
  TUTOR_V2_COMPATIBILITY_ID,
  TUTOR_V2_CONTRACT_VERSION,
  TutorRequestSchema,
  validateExact,
  type ProviderContext,
  type TutorFailureCode,
  type TutorRequest,
  type TutorTelemetryEnvelope,
} from "../../contracts/index.js";
import {
  type ClosedStructuredTutorRequest,
  type ProviderExecutionResult,
  type ProviderFailureReason,
  type ProviderFailureStatus,
  type TutorProviderPort,
} from "./contracts.js";
import {
  CanonicalProviderResponseParser,
  type ProviderResponseParserPort,
} from "./parser.js";
import type { ProviderCostClass, ProviderModelClass } from "./routing.js";
import type {
  ProviderTransportMetrics,
  ProviderTransportPort,
  ProviderTransportRequest,
} from "./transport.js";

const DEFAULT_MAXIMUM_RESPONSE_BYTES = 16_384;
const DEFAULT_MAXIMUM_OUTPUT_TOKENS = 2_048;
const STATIC_FALLBACK_REF = "fallback:reviewed-static-curriculum";

export interface TransportBackedTutorProviderOptions {
  readonly transport: ProviderTransportPort;
  readonly parser?: ProviderResponseParserPort;
  readonly modelClass?: ProviderModelClass;
  readonly costClass?: ProviderCostClass;
  readonly maximumResponseBytes?: number;
  readonly maximumOutputTokens?: number;
}

interface NormalizationContext {
  readonly request: TutorRequest;
  readonly metrics: ProviderTransportMetrics;
}

const ZERO_METRICS: ProviderTransportMetrics = {
  inputTokenCount: 0,
  outputTokenCount: 0,
  latencyMs: 0,
  costUnits: 0,
};

function boundedMetric(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function telemetry(
  request: TutorRequest,
  metrics: ProviderTransportMetrics,
  outcomeCode: TutorTelemetryEnvelope["outcomeCode"],
  action: TutorTelemetryEnvelope["action"],
): TutorTelemetryEnvelope {
  return {
    contractVersion: request.contractVersion,
    actionSchemaVersion: request.actionSchemaVersion,
    compatibilityId: request.compatibilityId,
    actionCompatibilityId: request.actionCompatibilityId,
    telemetryKind: "minimized-operation",
    interactionRef: request.studyAuthorityContext.interactionRef,
    action,
    providerRef: request.budgetRoutingContext.route.providerRef,
    modelRef: request.budgetRoutingContext.route.modelRef,
    inputTokenCount: boundedMetric(metrics.inputTokenCount),
    outputTokenCount: boundedMetric(metrics.outputTokenCount),
    latencyMs: boundedMetric(metrics.latencyMs),
    costUnits: boundedMetric(metrics.costUnits),
    outcomeCode,
  };
}

function canonicalFailureCode(
  status: ProviderFailureStatus,
  reason: ProviderFailureReason,
): TutorFailureCode {
  if (status === "timeout") return "PROVIDER_TIMEOUT";
  if (reason === "UNSUPPORTED_ACTION") return "UNSUPPORTED_ACTION";
  if (status === "malformed-response" || status === "rejected-response" || status === "over-budget") {
    return "MALFORMED_RESPONSE";
  }
  return "PROVIDER_UNAVAILABLE";
}

function retryable(status: ProviderFailureStatus): boolean {
  return status === "unavailable" || status === "timeout" || status === "transient-failure";
}

function failure(
  context: NormalizationContext,
  status: ProviderFailureStatus,
  reason: ProviderFailureReason,
): ProviderExecutionResult {
  const code = canonicalFailureCode(status, reason);
  return {
    status,
    reason,
    retryable: retryable(status),
    fallbackRequired: true,
    fallback: {
      contractVersion: context.request.contractVersion,
      actionSchemaVersion: context.request.actionSchemaVersion,
      compatibilityId: context.request.compatibilityId,
      actionCompatibilityId: context.request.actionCompatibilityId,
      envelope: "tutor-static-fallback-required",
      interactionRef: context.request.studyAuthorityContext.interactionRef,
      code: "STATIC_FALLBACK_REQUIRED",
      fallbackRef: STATIC_FALLBACK_REF,
      reasonCode: code,
    },
    telemetry: telemetry(context.request, context.metrics, code, null),
  };
}

function projectProviderContext(request: TutorRequest): ProviderContext {
  const authority = request.studyAuthorityContext;
  const instruction = authority.instructionContext;
  return {
    contractVersion: request.contractVersion,
    actionSchemaVersion: request.actionSchemaVersion,
    compatibilityId: request.compatibilityId,
    actionCompatibilityId: request.actionCompatibilityId,
    contextKind: "provider",
    interactionRef: authority.interactionRef,
    instruction: {
      subjectRef: instruction.subjectRef,
      conceptRef: instruction.conceptRef,
      learnerStageRef: instruction.learnerStageRef,
      learnerSafeItem: instruction.learnerSafeItem,
      assessmentPhase: instruction.assessmentPhase,
      approvedEvidenceSummary: instruction.approvedEvidenceSummary,
      allowedActions: instruction.allowedActions,
      hintCeiling: instruction.hintCeiling,
      safetyConstraints: instruction.safetyConstraints,
      groundingReferences: instruction.groundingReferences,
    },
  };
}

function invalidRequestShell(): TutorRequest {
  return {
    contractVersion: TUTOR_V2_CONTRACT_VERSION,
    actionSchemaVersion: TUTOR_V2_ACTION_SCHEMA_VERSION,
    compatibilityId: TUTOR_V2_COMPATIBILITY_ID,
    actionCompatibilityId: TUTOR_V2_ACTION_COMPATIBILITY_ID,
    envelope: "tutor-request",
    requestRef: "request:invalid-closed-request",
    requestIntent: "propose-next-teaching-action",
    studyAuthorityContext: {
      contractVersion: TUTOR_V2_CONTRACT_VERSION,
      actionSchemaVersion: TUTOR_V2_ACTION_SCHEMA_VERSION,
      compatibilityId: TUTOR_V2_COMPATIBILITY_ID,
      actionCompatibilityId: TUTOR_V2_ACTION_COMPATIBILITY_ID,
      contextKind: "study-authority",
      interactionRef: "interaction:invalid-provider-request",
      invocationBindingRef: "invocation:invalid-provider-request",
      authorizationRef: "authorization:invalid-provider-request",
      authorizationRevision: 1,
      safetyClearanceRef: "safety:invalid-provider-request",
      policyRefs: {
        authorityPolicyRef: "policy:invalid-authority",
        assessmentPolicyRef: "policy:invalid-assessment",
        answerPolicyRef: "policy:invalid-answer",
        safetyPolicyRef: "policy:invalid-safety",
        privacyPolicyRef: "policy:invalid-privacy",
      },
      instructionContext: {
        contextKind: "tutor-instruction",
        subjectRef: "subject:invalid",
        conceptRef: "concept:invalid",
        workingLevelInstructionRef: "working-level:invalid",
        learnerStageRef: "learner-stage:invalid",
        learnerSafeItem: null,
        assessmentPhase: "instruction-or-practice",
        approvedEvidenceSummary: {
          summaryRef: "summary:invalid",
          evidenceCode: "invalid-request",
          attemptCount: 0,
          assistanceLevel: "independent",
          observationRefs: [],
        },
        allowedActions: ["return-to-lesson"],
        hintCeiling: "none",
        safetyConstraints: {
          safetyMode: "restricted",
          mayContinueAcademicFlow: false,
          learnerSafeLanguageRequired: true,
          disallowedContentCodes: [],
        },
        groundingReferences: [{
          groundingRef: "grounding:invalid",
          kind: "static-fallback",
          contentDigest: `sha256:${"0".repeat(64)}`,
          learnerSafeContent: null,
        }],
      },
      issuedAt: "1970-01-01T00:00:00.000Z",
      expiresAt: "1970-01-01T00:00:00.000Z",
    },
    budgetRoutingContext: {
      actionBudget: { remainingActions: 0 },
      timeoutBudgetMs: 50,
      retryBudget: { remainingRetries: 0 },
      route: {
        routeRef: "route:invalid",
        providerRef: "provider:invalid",
        modelRef: "model:invalid",
      },
      costBudget: { unit: "integer-cost-unit", maximumCostUnits: 0 },
    },
    shortTermState: {
      contractVersion: TUTOR_V2_CONTRACT_VERSION,
      actionSchemaVersion: TUTOR_V2_ACTION_SCHEMA_VERSION,
      compatibilityId: TUTOR_V2_COMPATIBILITY_ID,
      actionCompatibilityId: TUTOR_V2_ACTION_COMPATIBILITY_ID,
      stateKind: "ephemeral-interaction-state",
      interactionRef: "interaction:invalid-provider-request",
      turnCount: 0,
      assistanceLevel: "independent",
      highestHintUsed: "none",
      lastAction: null,
      usedGroundingRefs: [],
      expiresAt: "1970-01-01T00:00:00.000Z",
      persistenceAllowed: false,
    },
  };
}

export class TransportBackedTutorProvider implements TutorProviderPort {
  readonly #transport: ProviderTransportPort;
  readonly #parser: ProviderResponseParserPort;
  readonly #modelClass: ProviderModelClass;
  readonly #costClass: ProviderCostClass;
  readonly #maximumResponseBytes: number;
  readonly #maximumOutputTokens: number;

  constructor(options: TransportBackedTutorProviderOptions) {
    this.#transport = options.transport;
    this.#parser = options.parser ?? new CanonicalProviderResponseParser();
    this.#modelClass = options.modelClass ?? "balanced";
    this.#costClass = options.costClass ?? "standard";
    this.#maximumResponseBytes = options.maximumResponseBytes ?? DEFAULT_MAXIMUM_RESPONSE_BYTES;
    this.#maximumOutputTokens = options.maximumOutputTokens ?? DEFAULT_MAXIMUM_OUTPUT_TOKENS;
  }

  async execute(request: ClosedStructuredTutorRequest): Promise<ProviderExecutionResult> {
    const validation = validateExact(TutorRequestSchema, request);
    if (validation.status === "rejected") {
      return failure(
        { request: invalidRequestShell(), metrics: ZERO_METRICS },
        "permanent-failure",
        "INVALID_CLOSED_REQUEST",
      );
    }
    const closedRequest = validation.value;
    const context = { request: closedRequest, metrics: ZERO_METRICS };
    if (closedRequest.budgetRoutingContext.actionBudget.remainingActions === 0) {
      return failure(context, "over-budget", "NO_ACTION_BUDGET");
    }
    if (closedRequest.budgetRoutingContext.costBudget.maximumCostUnits === 0) {
      return failure(context, "over-budget", "COST_BUDGET_EXCEEDED");
    }

    const transportRequest: ProviderTransportRequest = {
      requestRef: closedRequest.requestRef,
      context: projectProviderContext(closedRequest),
      shortTermState: closedRequest.shortTermState,
      route: {
        ...closedRequest.budgetRoutingContext.route,
        modelClass: this.#modelClass,
        costClass: this.#costClass,
      },
      limits: {
        timeoutMs: closedRequest.budgetRoutingContext.timeoutBudgetMs,
        maximumCostUnits: closedRequest.budgetRoutingContext.costBudget.maximumCostUnits,
        maximumOutputTokens: this.#maximumOutputTokens,
        maximumResponseBytes: this.#maximumResponseBytes,
      },
      responseContract: {
        envelope: "tutor-action-proposal",
        contractVersion: closedRequest.contractVersion,
        actionSchemaVersion: closedRequest.actionSchemaVersion,
        compatibilityId: closedRequest.compatibilityId,
        actionCompatibilityId: closedRequest.actionCompatibilityId,
      },
    };

    let transported;
    try {
      transported = await this.#transport.send(transportRequest);
    } catch {
      return failure(context, "transient-failure", "TRANSPORT_EXCEPTION");
    }
    const failureContext = { request: closedRequest, metrics: transported.metrics };
    if (transported.status === "unavailable") {
      return failure(failureContext, "unavailable", "PROVIDER_OUTAGE");
    }
    if (transported.status === "timeout") {
      return failure(failureContext, "timeout", "PROVIDER_TIMEOUT");
    }
    if (transported.status === "rejected") {
      return failure(failureContext, "rejected-response", "PROVIDER_REJECTED");
    }
    if (transported.status === "transient-failure") {
      return failure(failureContext, "transient-failure", "TRANSPORT_EXCEPTION");
    }
    if (transported.status === "permanent-failure") {
      return failure(failureContext, "permanent-failure", "PERMANENT_TRANSPORT_FAILURE");
    }

    const parsed = this.#parser.parse(transportRequest, transported);
    if (parsed.status !== "success") {
      return failure(failureContext, parsed.status, parsed.reason);
    }
    return {
      status: "success",
      proposal: parsed.proposal,
      fallbackRequired: false,
      telemetry: telemetry(closedRequest, transported.metrics, "ACTION_PROPOSED", parsed.proposal.action.kind),
    };
  }
}
