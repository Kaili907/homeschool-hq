import { detached } from "./canonical.ts";
import { HARD_VIOLATIONS } from "./contracts.ts";
import type {
  CertificationTransport,
  CertificationTransportObservation,
  CertificationTransportRequest,
  HardGateObservation,
  RunnerClock,
  Sha256Digest,
} from "./contracts.ts";

export class DeterministicMockClock implements RunnerClock {
  #epochMs: number;

  public constructor(initialEpochMs = Date.UTC(2026, 0, 1)) {
    this.#epochMs = initialEpochMs;
  }

  public nowEpochMs(): number {
    return this.#epochMs;
  }

  public advance(milliseconds: number): void {
    if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) throw new TypeError("milliseconds must be a non-negative integer");
    this.#epochMs += milliseconds;
  }
}

export interface MockTransportScript {
  readonly scenarioRef: string;
  readonly observations: readonly CertificationTransportObservation[];
  readonly durationMs: number;
}

export interface MockRequestAudit {
  readonly campaignId: string;
  readonly caseId: string;
  readonly trialId: string;
  readonly trialIndex: number;
  readonly seed: number | null;
  readonly scenarioRef: string;
  readonly ephemeralInputDigest: Sha256Digest;
  readonly providerId: string;
  readonly modelId: string;
  readonly configurationDigest: Sha256Digest;
}

/** Offline-only transport. Request audits intentionally omit ephemeralInput. */
export class DeterministicMockTransport implements CertificationTransport {
  public readonly transportRef: string;
  public readonly liveNetworkEnabled = false as const;
  public readonly requestAudits: MockRequestAudit[] = [];
  readonly #clock: DeterministicMockClock;
  readonly #scripts: ReadonlyMap<string, MockTransportScript>;

  public constructor(input: {
    readonly transportRef?: string;
    readonly clock: DeterministicMockClock;
    readonly scripts: readonly MockTransportScript[];
  }) {
    this.transportRef = input.transportRef ?? "deterministic-mock-transport:v1";
    this.#clock = input.clock;
    this.#scripts = new Map(input.scripts.map((script) => [script.scenarioRef, detached(script)]));
  }

  public async execute(request: CertificationTransportRequest): Promise<CertificationTransportObservation> {
    this.requestAudits.push({
      campaignId: request.campaignId,
      caseId: request.caseId,
      trialId: request.trialId,
      trialIndex: request.trialIndex,
      seed: request.seed,
      scenarioRef: request.scenarioRef,
      ephemeralInputDigest: request.ephemeralInputDigest,
      providerId: request.providerModel.providerId,
      modelId: request.providerModel.modelId,
      configurationDigest: request.providerModel.configurationDigest,
    });
    const script = this.#scripts.get(request.scenarioRef);
    const observation = script?.observations[request.trialIndex - 1];
    if (script === undefined || observation === undefined) throw new Error("mock script exhausted");
    this.#clock.advance(script.durationMs);
    return detached(observation);
  }
}

export function passingHardGates(): readonly HardGateObservation[] {
  return HARD_VIOLATIONS.map((gate) => ({ gate, outcome: "pass", reasonCodes: [] }));
}

