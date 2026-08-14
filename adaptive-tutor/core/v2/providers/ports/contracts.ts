import type {
  TutorActionProposal,
  TutorRequest,
  TutorStaticFallbackOutcome,
  TutorTelemetryEnvelope,
} from "../../contracts/index.js";

/** The only request accepted by a production Tutor provider boundary. */
export type ClosedStructuredTutorRequest = TutorRequest;

export interface TutorProviderPort {
  execute(request: ClosedStructuredTutorRequest): Promise<ProviderExecutionResult>;
}

export type ProviderFailureStatus =
  | "unavailable"
  | "timeout"
  | "malformed-response"
  | "rejected-response"
  | "over-budget"
  | "transient-failure"
  | "permanent-failure";

export type ProviderFailureReason =
  | "PROVIDER_OUTAGE"
  | "PROVIDER_TIMEOUT"
  | "INVALID_JSON"
  | "SCHEMA_MISMATCH"
  | "UNSUPPORTED_ACTION"
  | "RESPONSE_BINDING_MISMATCH"
  | "RESPONSE_TOO_LARGE"
  | "OUTPUT_TOKEN_LIMIT_EXCEEDED"
  | "COST_BUDGET_EXCEEDED"
  | "NO_ACTION_BUDGET"
  | "PROVIDER_REJECTED"
  | "TRANSPORT_EXCEPTION"
  | "PERMANENT_TRANSPORT_FAILURE"
  | "INVALID_CLOSED_REQUEST";

export interface ProviderSuccessResult {
  readonly status: "success";
  readonly proposal: TutorActionProposal;
  readonly fallbackRequired: false;
  readonly telemetry: TutorTelemetryEnvelope;
}

export interface ProviderFailureResult {
  readonly status: ProviderFailureStatus;
  readonly reason: ProviderFailureReason;
  readonly retryable: boolean;
  readonly fallbackRequired: true;
  /** A canonical instruction for Study to use reviewed static curriculum. */
  readonly fallback: TutorStaticFallbackOutcome;
  readonly telemetry: TutorTelemetryEnvelope;
}

export type ProviderExecutionResult = ProviderSuccessResult | ProviderFailureResult;
