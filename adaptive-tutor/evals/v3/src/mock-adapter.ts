import type {
  DeterministicModelAdapter,
  MockModelResult,
  ProviderEvalRequest,
} from "./contracts.ts";

function detached<T>(value: T): T {
  return structuredClone(value);
}

export class ScriptedMockModelAdapter implements DeterministicModelAdapter {
  public readonly transportKind = "in-memory-mock" as const;
  public readonly liveNetworkEnabled = false as const;
  public readonly adapterRef: string;
  public readonly requests: ProviderEvalRequest[] = [];
  readonly #scripts: ReadonlyMap<string, MockModelResult>;

  public constructor(adapterRef: string, scripts: ReadonlyMap<string, MockModelResult>) {
    this.adapterRef = adapterRef;
    this.#scripts = new Map([...scripts].map(([caseId, result]) => [caseId, detached(result)]));
  }

  public async execute(request: ProviderEvalRequest): Promise<MockModelResult> {
    this.requests.push(detached(request));
    const result = this.#scripts.get(request.caseRef);
    if (!result) return { kind: "malformed" };
    return detached(result);
  }

  public callsFor(caseId: string): number {
    return this.requests.filter((request) => request.caseRef === caseId).length;
  }
}
