import {
  TUTOR_ACTION_KINDS,
  TutorActionProposalSchema,
  validateExact,
  type TutorActionProposal,
} from "../../contracts/index.js";
import type { ProviderFailureReason } from "./contracts.js";
import type {
  ProviderTransportRequest,
  ProviderTransportResponse,
} from "./transport.js";

export type ProviderResponseParseResult =
  | { readonly status: "success"; readonly proposal: TutorActionProposal }
  | {
      readonly status: "malformed-response" | "rejected-response" | "over-budget";
      readonly reason: ProviderFailureReason;
    };

export interface ProviderResponseParserPort {
  parse(
    request: ProviderTransportRequest,
    response: ProviderTransportResponse,
  ): ProviderResponseParseResult;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function containsUnsupportedAction(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.action)) return false;
  const kind = value.action.kind;
  return typeof kind === "string" && !TUTOR_ACTION_KINDS.some((allowed) => allowed === kind);
}

/** Canonical shape parsing only; allowed-action policy remains downstream of this parser. */
export class CanonicalProviderResponseParser implements ProviderResponseParserPort {
  parse(
    request: ProviderTransportRequest,
    response: ProviderTransportResponse,
  ): ProviderResponseParseResult {
    if (Buffer.byteLength(response.body, "utf8") > request.limits.maximumResponseBytes) {
      return { status: "over-budget", reason: "RESPONSE_TOO_LARGE" };
    }
    if (response.metrics.outputTokenCount > request.limits.maximumOutputTokens) {
      return { status: "over-budget", reason: "OUTPUT_TOKEN_LIMIT_EXCEEDED" };
    }
    if (response.metrics.costUnits > request.limits.maximumCostUnits) {
      return { status: "over-budget", reason: "COST_BUDGET_EXCEEDED" };
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(response.body) as unknown;
    } catch {
      return { status: "malformed-response", reason: "INVALID_JSON" };
    }

    if (containsUnsupportedAction(decoded)) {
      return { status: "rejected-response", reason: "UNSUPPORTED_ACTION" };
    }

    const validated = validateExact(TutorActionProposalSchema, decoded);
    if (validated.status === "rejected") {
      return { status: "malformed-response", reason: "SCHEMA_MISMATCH" };
    }
    if (validated.value.interactionRef !== request.context.interactionRef) {
      return { status: "rejected-response", reason: "RESPONSE_BINDING_MISMATCH" };
    }
    return { status: "success", proposal: validated.value };
  }
}
