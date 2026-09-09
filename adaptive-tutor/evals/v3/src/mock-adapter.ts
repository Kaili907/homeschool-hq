import type {
  DeterministicProviderAdapter,
  ProviderEvalRequest,
  RawProviderResult,
} from "./contracts.js";

function detached<T>(value: T): T {
  return structuredClone(value);
}

export class ScriptedMockProviderAdapter implements DeterministicProviderAdapter {
  public readonly transportKind = "in-memory-mock" as const;
  public readonly liveNetworkEnabled = false as const;
  public readonly adapterRef: string;
  public readonly requests: ProviderEvalRequest[] = [];
  readonly #scripts: ReadonlyMap<string, RawProviderResult>;

  public constructor(adapterRef: string, scripts: ReadonlyMap<string, RawProviderResult>) {
    this.adapterRef = adapterRef;
    this.#scripts = new Map([...scripts].map(([caseId, result]) => [caseId, detached(result)]));
  }

  public async execute(request: ProviderEvalRequest): Promise<RawProviderResult> {
    this.requests.push(detached(request));
    const result = this.#scripts.get(request.caseRef);
    return result ? detached(result) : { kind: "fault" };
  }

  public callsFor(caseId: string): number {
    return this.requests.filter((request) => request.caseRef === caseId).length;
  }
}
