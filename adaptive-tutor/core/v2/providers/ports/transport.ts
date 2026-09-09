import type {
  TutorShortTermState,
} from "../../contracts/index.js";
import type { ProviderExecutionContext } from "./contracts.js";
import type { ProviderCostClass, ProviderModelClass } from "./routing.js";

export interface ProviderTransportRequest {
  readonly requestRef: string;
  readonly context: ProviderExecutionContext;
  readonly shortTermState: TutorShortTermState;
  readonly route: {
    readonly routeRef: string;
    readonly providerRef: string;
    readonly modelRef: string;
    readonly modelClass: ProviderModelClass;
    readonly costClass: ProviderCostClass;
  };
  readonly limits: {
    readonly timeoutMs: number;
    readonly maximumCostUnits: number;
    readonly maximumOutputTokens: number;
    readonly maximumResponseBytes: number;
  };
  readonly responseContract: {
    readonly envelope: "tutor-action-proposal";
    readonly contractVersion: string;
    readonly actionSchemaVersion: number;
    readonly compatibilityId: string;
    readonly actionCompatibilityId: string;
  };
}

export interface ProviderTransportMetrics {
  readonly inputTokenCount: number;
  readonly outputTokenCount: number;
  readonly latencyMs: number;
  readonly costUnits: number;
}

export interface ProviderTransportResponse {
  readonly status: "response";
  /** Closed JSON response body. It is bounded before parsing and never logged. */
  readonly body: string;
  readonly metrics: ProviderTransportMetrics;
}

export type ProviderTransportFailureStatus =
  | "unavailable"
  | "timeout"
  | "rejected"
  | "transient-failure"
  | "permanent-failure";

export type ProviderTransportFailure = {
  readonly [Status in ProviderTransportFailureStatus]: {
    readonly status: Status;
    readonly metrics: ProviderTransportMetrics;
  };
}[ProviderTransportFailureStatus];

export type ProviderTransportResult = ProviderTransportResponse | ProviderTransportFailure;

/** Transport only. It does not parse, validate Tutor policy, or mutate Study state. */
export interface ProviderTransportPort {
  send(request: ProviderTransportRequest): Promise<ProviderTransportResult>;
}
