export {
  URGENT_SAFETY_CLASSIFICATION_VERSION,
  consumePreCoreProcessingPermit,
  evaluatePreCoreUrgentSafety,
  getBridgeUrgentCategoryCoverage,
  type PreCoreProcessingPermitV1,
  type PreCoreUrgentSafetyResult,
  type UrgentSafetyClassificationV1,
  type UrgentSafetyClassifierPort,
  type UrgentSafetyGatewayConfiguration,
} from "../../bridges/tutor-core/src/safety-gateway.ts";

import type {
  UrgentSafetyClassificationOutcome,
  UrgentSafetyClassifierPort,
  UrgentSafetyGatewayConfiguration,
} from "../../bridges/tutor-core/src/safety-gateway.ts";

export const LOCAL_DEMO_SAFETY_CONFIGURATION = Object.freeze({
  mode: "local-demo" as const,
});

const COMPOSITION_URGENT = [
  /\b(?:i|we)\s+(?:want|plan|intend|need)\s+to\s+(?:die|hurt\s+myself|kill\s+myself)\b/i,
  /\b(?:i|we)\s+(?:am|are|'m|'re)\s+going\s+to\s+(?:die|hurt\s+myself|kill\s+myself)\b/i,
  /\b(?:i|we)\s+will\s+(?:hurt\s+myself|kill\s+myself)\b/i,
] as const;

const COMPOSITION_UNCERTAIN = [
  /\b(?:i|we)\s+(?:might|may|could)\s+(?:hurt\s+myself|kill\s+myself|die)\b/i,
] as const;

function compositionOutcome(
  text: string,
): Exclude<UrgentSafetyClassificationOutcome, "invalid"> {
  if (COMPOSITION_URGENT.some((pattern) => pattern.test(text))) {
    return "urgent";
  }
  if (COMPOSITION_UNCERTAIN.some((pattern) => pattern.test(text))) {
    return "uncertain";
  }
  return "clear";
}

function severity(outcome: UrgentSafetyClassificationOutcome): number {
  return { clear: 0, uncertain: 1, urgent: 2, invalid: 3 }[outcome];
}

/**
 * Session 9's extra composition layer makes personal first-person signals
 * outrank surrounding academic/story markers. It also forces every public
 * call through an explicit classifier configuration.
 */
export function toLayeredSafetyConfiguration(
  configuration: UrgentSafetyGatewayConfiguration,
): UrgentSafetyGatewayConfiguration {
  if (
    configuration.mode === "production" &&
    (typeof configuration.classifier !== "object" ||
      configuration.classifier === null ||
      typeof configuration.classifier.classify !== "function")
  ) {
    return configuration;
  }
  const upstream =
    configuration.mode === "production"
      ? configuration.classifier
      : configuration.classifier;
  const classifier: UrgentSafetyClassifierPort = {
    classifierVersion: "session9-layered-safety-v1",
    classify(request) {
      const composition = compositionOutcome(
        request.normalizedTransientText,
      );
      const upstreamResult = upstream?.classify(request);
      const upstreamOutcome = upstreamResult?.outcome ?? "clear";
      const outcome =
        severity(composition) >= severity(upstreamOutcome)
          ? composition
          : upstreamOutcome;
      const categories =
        outcome === "clear"
          ? []
          : [
              ...new Set([
                ...(upstreamResult?.categories ?? []),
                "self-harm-or-immediate-danger" as const,
              ]),
            ];
      return {
        classificationVersion: 1,
        classifierVersion: "session9-layered-safety-v1",
        outcome,
        categories,
        reasonCodes: [
          ...(upstreamResult?.reasonCodes ?? []),
          ...(composition === "clear"
            ? ["session9-no-extra-signal"]
            : ["session9-personal-signal-outranks-context"]),
        ],
      };
    },
  };
  return {
    mode: "production",
    classifier,
    ...(configuration.permitTtlMs === undefined
      ? {}
      : { permitTtlMs: configuration.permitTtlMs }),
  };
}
