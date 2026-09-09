import type { ProviderExecutionRequest } from "./contracts.js";

export type ProviderModelClass = "fast" | "balanced" | "reasoning";
export type ProviderCostClass = "low" | "standard" | "premium";

export interface ProviderCapability {
  readonly capabilityRef: string;
  readonly modelClass: ProviderModelClass;
  readonly costClass: ProviderCostClass;
  readonly maximumOutputTokens: number;
  readonly supportsClosedStructuredOutput: true;
}

export interface ProviderRouteCandidate {
  readonly routeRef: string;
  readonly providerRef: string;
  readonly modelRef: string;
  readonly modelClass: ProviderModelClass;
  readonly costClass: ProviderCostClass;
  readonly timeoutMs: number;
}

export interface ProviderRoutePlan {
  readonly primary: ProviderRouteCandidate;
  readonly fallback: ProviderRouteCandidate | null;
}

/** Future routing seam. Wave 1 intentionally supplies no commercial implementation. */
export interface TutorProviderRoutePort {
  selectRoute(request: ProviderExecutionRequest): Promise<ProviderRoutePlan>;
}
