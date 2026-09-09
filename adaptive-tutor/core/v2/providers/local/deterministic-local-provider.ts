import type { TutorActionProposal } from "../../contracts/index.js";
import {
  TransportBackedTutorProvider,
  type ProviderExecutionRequest,
  type ProviderExecutionResult,
  type ProviderTransportMetrics,
  type ProviderTransportPort,
  type ProviderTransportRequest,
  type ProviderTransportResult,
  type TutorProviderPort,
} from "../ports/index.js";

export type DeterministicLocalProviderMode =
  | "valid-response"
  | "provider-outage"
  | "timeout"
  | "malformed-response"
  | "unknown-action"
  | "excessive-output";

export interface DeterministicLocalTutorProviderOptions {
  readonly mode?: DeterministicLocalProviderMode;
  readonly maximumResponseBytes?: number;
  readonly maximumOutputTokens?: number;
}

const LOCAL_METRICS: ProviderTransportMetrics = {
  inputTokenCount: 120,
  outputTokenCount: 48,
  latencyMs: 5,
  costUnits: 1,
};

function validProposal(request: ProviderTransportRequest): TutorActionProposal {
  const grounding = request.context.instruction.groundingReferences[0];
  if (!grounding) throw new Error("A canonical provider request always has grounding.");
  return {
    contractVersion: request.responseContract.contractVersion as TutorActionProposal["contractVersion"],
    actionSchemaVersion: request.responseContract.actionSchemaVersion as TutorActionProposal["actionSchemaVersion"],
    compatibilityId: request.responseContract.compatibilityId as TutorActionProposal["compatibilityId"],
    actionCompatibilityId: request.responseContract.actionCompatibilityId as TutorActionProposal["actionCompatibilityId"],
    envelope: "tutor-action-proposal",
    proposalRef: "proposal:deterministic-local",
    interactionRef: request.context.interactionRef,
    action: {
      kind: "explain",
      content: "Use the reviewed grounding to examine one small step at a time.",
      groundingRefs: [grounding.groundingRef],
    },
    groundingClaims: [{
      groundingRef: grounding.groundingRef,
      contentDigest: grounding.contentDigest,
      claimKind: "paraphrase-support",
    }],
    assistanceLevel: request.shortTermState.assistanceLevel,
    hintLevel: request.shortTermState.highestHintUsed,
    authoritative: false,
    requiresStudyValidation: true,
  };
}

export class DeterministicLocalProviderTransport implements ProviderTransportPort {
  readonly #mode: DeterministicLocalProviderMode;

  constructor(mode: DeterministicLocalProviderMode = "valid-response") {
    this.#mode = mode;
  }

  async send(request: ProviderTransportRequest): Promise<ProviderTransportResult> {
    if (this.#mode === "provider-outage") {
      return { status: "unavailable", metrics: LOCAL_METRICS };
    }
    if (this.#mode === "timeout") {
      return { status: "timeout", metrics: LOCAL_METRICS };
    }
    if (this.#mode === "malformed-response") {
      return { status: "response", body: "{not-json", metrics: LOCAL_METRICS };
    }
    if (this.#mode === "excessive-output") {
      return {
        status: "response",
        body: "x".repeat(request.limits.maximumResponseBytes + 1),
        metrics: LOCAL_METRICS,
      };
    }

    const proposal = validProposal(request);
    if (this.#mode === "unknown-action") {
      const unsupported = {
        ...proposal,
        action: { kind: "change-working-level", workingLevel: "grade:12" },
      };
      return { status: "response", body: JSON.stringify(unsupported), metrics: LOCAL_METRICS };
    }
    return { status: "response", body: JSON.stringify(proposal), metrics: LOCAL_METRICS };
  }
}
export class DeterministicLocalTutorProvider implements TutorProviderPort {
  readonly #adapter: TransportBackedTutorProvider;

  constructor(options: DeterministicLocalTutorProviderOptions = {}) {
    this.#adapter = new TransportBackedTutorProvider({
      transport: new DeterministicLocalProviderTransport(options.mode),
      ...(options.maximumResponseBytes === undefined
        ? {}
        : { maximumResponseBytes: options.maximumResponseBytes }),
      ...(options.maximumOutputTokens === undefined
        ? {}
        : { maximumOutputTokens: options.maximumOutputTokens }),
    });
  }

  execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResult> {
    return this.#adapter.execute(request);
  }
}
