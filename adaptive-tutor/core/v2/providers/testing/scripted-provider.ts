import {
  TransportBackedTutorProvider,
  type ProviderExecutionRequest,
  type ProviderExecutionResult,
  type ProviderTransportPort,
  type ProviderTransportRequest,
  type ProviderTransportResult,
  type TutorProviderPort,
} from "../ports/index.js";

export type ScriptRepeatBehavior = "none" | "last" | "cycle";

export interface DeterministicTestTutorProviderOptions {
  readonly steps: readonly ProviderTransportResult[];
  readonly repeat?: ScriptRepeatBehavior;
  readonly maximumResponseBytes?: number;
  readonly maximumOutputTokens?: number;
}

const EXHAUSTED_RESULT: ProviderTransportResult = {
  status: "permanent-failure",
  metrics: {
    inputTokenCount: 0,
    outputTokenCount: 0,
    latencyMs: 0,
    costUnits: 0,
  },
};

export class ScriptedProviderTransport implements ProviderTransportPort {
  readonly #steps: readonly ProviderTransportResult[];
  readonly #repeat: ScriptRepeatBehavior;
  #callCount = 0;
  #lastRequest: ProviderTransportRequest | null = null;

  constructor(
    steps: readonly ProviderTransportResult[],
    repeat: ScriptRepeatBehavior = "none",
  ) {
    this.#steps = structuredClone(steps);
    this.#repeat = repeat;
  }

  get callCount(): number {
    return this.#callCount;
  }

  get lastRequest(): ProviderTransportRequest | null {
    return this.#lastRequest === null ? null : structuredClone(this.#lastRequest);
  }

  async send(request: ProviderTransportRequest): Promise<ProviderTransportResult> {
    this.#lastRequest = structuredClone(request);
    const callIndex = this.#callCount;
    this.#callCount += 1;
    if (this.#steps.length === 0) return structuredClone(EXHAUSTED_RESULT);
    if (callIndex < this.#steps.length) {
      return structuredClone(this.#steps[callIndex] ?? EXHAUSTED_RESULT);
    }
    if (this.#repeat === "last") {
      return structuredClone(this.#steps[this.#steps.length - 1] ?? EXHAUSTED_RESULT);
    }
    if (this.#repeat === "cycle") {
      return structuredClone(this.#steps[callIndex % this.#steps.length] ?? EXHAUSTED_RESULT);
    }
    return structuredClone(EXHAUSTED_RESULT);
  }
}
export class DeterministicTestTutorProvider implements TutorProviderPort {
  readonly transport: ScriptedProviderTransport;
  readonly #adapter: TransportBackedTutorProvider;

  constructor(options: DeterministicTestTutorProviderOptions) {
    this.transport = new ScriptedProviderTransport(options.steps, options.repeat);
    this.#adapter = new TransportBackedTutorProvider({
      transport: this.transport,
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
