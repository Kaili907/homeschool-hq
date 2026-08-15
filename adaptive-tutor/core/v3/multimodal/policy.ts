import { Value } from "../../schema/value.js";
import {
  MultimodalPresentationSchema,
  type MultimodalPresentation,
} from "./contracts.js";

export type MultimodalPolicyResult =
  | { readonly status: "accepted"; readonly presentation: MultimodalPresentation }
  | {
      readonly status: "rejected";
      readonly code:
        | "INVALID_MULTIMODAL_PRESENTATION"
        | "ACTIVE_ASSESSMENT_ANSWER_BLOCKED";
      readonly issues: readonly string[];
    };

/**
 * Enforces the same assessment disclosure rule after modality selection. A
 * caller cannot obtain different anti-answer behavior by switching channels.
 */
export function enforceMultimodalPresentationPolicy(
  candidate: unknown,
): MultimodalPolicyResult {
  if (typeof candidate === "object" && candidate !== null) {
    const disclosure = (candidate as { assessmentDisclosure?: unknown }).assessmentDisclosure;
    if (typeof disclosure === "object" && disclosure !== null) {
      const policy = disclosure as {
        phase?: unknown;
        answerExposure?: unknown;
        antiAnswerPolicy?: unknown;
        appliesToAllModalities?: unknown;
      };
      if (
        policy.phase === "active-assessment" &&
        (policy.answerExposure === "reviewed-answer" ||
          policy.antiAnswerPolicy !== "required" ||
          policy.appliesToAllModalities !== true)
      ) {
        return {
          status: "rejected",
          code: "ACTIVE_ASSESSMENT_ANSWER_BLOCKED",
          issues: ["Active-assessment answer disclosure is blocked for every modality."],
        };
      }
    }
  }

  if (!Value.Check(MultimodalPresentationSchema, candidate)) {
    return {
      status: "rejected",
      code: "INVALID_MULTIMODAL_PRESENTATION",
      issues: [...Value.Errors(MultimodalPresentationSchema, candidate)].map(
        (error) => `${error.path.length > 0 ? error.path : "$"}: ${error.message}`,
      ),
    };
  }

  const presentation = candidate as MultimodalPresentation;
  return { status: "accepted", presentation };
}
