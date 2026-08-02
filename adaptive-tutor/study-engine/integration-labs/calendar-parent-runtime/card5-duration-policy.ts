/*
 * Typed Card 8 adapter over the verified Card 5 reconciliation probe.
 *
 * Card 5 intentionally ships as JavaScript. This wrapper is the only untyped
 * import point; every input and result is checked/projected into a closed
 * TypeScript boundary before the parent runtime consumes it.
 */
// @ts-expect-error -- verified Card 5 JavaScript has no declaration metadata.
import * as card5Runtime from "../../reconciliation/probes/policy.mjs";

const {
  POLICY_VERSION: CARD5_RUNTIME_POLICY_VERSION,
  resolveDurationPolicy: resolveCard5DurationPolicy,
} = card5Runtime as {
  readonly POLICY_VERSION: number;
  readonly resolveDurationPolicy: (input: unknown) => unknown;
};

export const CARD5_POLICY_VERSION = 1 as const;
export const CARD5_POLICY_ID = "card5.resolve-duration-policy.v1" as const;

export type Card5DurationStatus = "resolved" | "manual-review" | "quarantine";

export type Card5DurationReasonCode =
  | "policy.resolved"
  | "policy.safety-veto"
  | "policy.infeasible-constraints"
  | "policy.unsupported-version"
  | "policy.integrity-failed"
  | "policy.actor-unauthorized"
  | "policy.unknown-override-mode"
  | "policy.adapter-invalid-input"
  | "policy.adapter-unrecognized-result";

export type Card5CandidateSource =
  | "manual-override"
  | "manual-hold"
  | "manual-reduce"
  | "accepted-engine-recommendation"
  | "established-target"
  | "grade-band-default";

export interface Card5SafetyConstraint {
  readonly constraintId: string;
  readonly minimumMinutes?: number;
  readonly maximumMinutes?: number;
  readonly veto?: boolean;
}

export interface Card5AccommodationConstraint {
  readonly accommodationId: string;
  readonly active: boolean;
  readonly minimumMinutes?: number;
  readonly maximumMinutes?: number;
}

export interface Card5AdultHardMaximum {
  readonly hardMaximumId: string;
  readonly active: boolean;
  readonly minutes: number;
}

export type Card5ManualOverride =
  | {
      readonly overrideId: string;
      readonly active: true;
      readonly mode: "target" | "reduce";
      readonly targetMinutes: number;
    }
  | {
      readonly overrideId: string;
      readonly active: true;
      readonly mode: "hold";
    }
  | {
      readonly overrideId: string;
      readonly active: false;
      readonly mode: "target" | "hold" | "reduce";
      readonly targetMinutes?: number;
    };

export interface Card5RecommendationCandidate {
  readonly recommendationId: string;
  readonly state: "accepted" | "rejected";
  readonly targetMinutes?: number;
}

export interface Card5DurationAdapterInput {
  readonly policyVersion: number;
  readonly integrityValid: boolean;
  readonly actorAuthorized: boolean;
  readonly safety: Card5SafetyConstraint;
  readonly accommodations: readonly Card5AccommodationConstraint[];
  readonly adultHardMaximums: readonly Card5AdultHardMaximum[];
  readonly manualOverride?: Card5ManualOverride;
  readonly recommendation?: Card5RecommendationCandidate;
  readonly establishedTargetMinutes?: number;
  readonly currentMinutes: number;
  readonly gradeBandDefaultMinutes: number;
}

export interface Card5CandidateProvenance {
  readonly source: Card5CandidateSource;
  readonly label: string;
  readonly referenceId: string;
  readonly configured: boolean;
  readonly eligible: boolean;
  readonly minutes: number | undefined;
  readonly explanation: string;
}

export interface Card5AppliedConstraint {
  readonly constraintId: string;
  readonly source: "safety" | "required-accommodation" | "adult-hard-maximum";
  readonly label: string;
  readonly kind: "minimum" | "maximum" | "veto";
  readonly minutes: number | undefined;
  readonly active: boolean;
  readonly binding: boolean;
}

export interface Card5DurationWinner {
  readonly source: Card5CandidateSource | "manual-review" | "quarantine";
  readonly label: string;
  readonly value: number | null;
  readonly reason: string;
}

export interface Card5DurationResolution {
  readonly field: "maximum-work-duration-minutes";
  readonly policyId: typeof CARD5_POLICY_ID;
  readonly policyVersion: typeof CARD5_POLICY_VERSION;
  readonly status: Card5DurationStatus;
  readonly reasonCode: Card5DurationReasonCode;
  readonly source: Card5CandidateSource | undefined;
  readonly candidateMinutes: number | undefined;
  readonly targetMinutes: number | null;
  readonly lowerBound: number | undefined;
  readonly upperBound: number | undefined;
  readonly applied: readonly string[];
  readonly candidateProvenance: readonly Card5CandidateProvenance[];
  readonly appliedConstraints: readonly Card5AppliedConstraint[];
  /**
   * Compatibility and UI field: this is the effective outcome after Card 5
   * constraint reduction, not merely the pre-clamp candidate.
   */
  readonly winner: Card5DurationWinner;
}

interface RawResolvedResult {
  readonly status: "resolved";
  readonly reasonCode: "policy.resolved";
  readonly source: Card5CandidateSource;
  readonly candidateMinutes: number;
  readonly targetMinutes: number;
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly applied: readonly string[];
}

interface RawManualReviewResult {
  readonly status: "manual-review";
  readonly reasonCode: "policy.safety-veto" | "policy.infeasible-constraints";
  readonly targetMinutes: null;
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly applied: readonly string[];
}

interface RawQuarantineResult {
  readonly status: "quarantine";
  readonly reasonCode:
    | "policy.unsupported-version"
    | "policy.integrity-failed"
    | "policy.actor-unauthorized"
    | "policy.unknown-override-mode";
  readonly targetMinutes: null;
}

type RawCard5Result =
  | RawResolvedResult
  | RawManualReviewResult
  | RawQuarantineResult;

const SOURCE_LABELS: Readonly<Record<Card5CandidateSource, string>> = {
  "manual-override": "Parent explicit manual override",
  "manual-hold": "Parent manual hold",
  "manual-reduce": "Parent manual reduction",
  "accepted-engine-recommendation": "Accepted engine recommendation",
  "established-target": "Established focus target",
  "grade-band-default": "Grade-band default",
};

const REASON_TEXT: Readonly<Record<Card5DurationReasonCode, string>> = {
  "policy.resolved":
    "Card 5 selected an eligible candidate and constrained it to the feasible interval.",
  "policy.safety-veto":
    "An active safety veto requires an authorized adult to review the setting.",
  "policy.infeasible-constraints":
    "The active safety, accommodation, and adult constraints do not share a feasible duration.",
  "policy.unsupported-version":
    "The duration policy version is not supported and was quarantined.",
  "policy.integrity-failed":
    "The duration policy input did not pass integrity verification and was quarantined.",
  "policy.actor-unauthorized":
    "The actor is not authorized to resolve this duration policy input.",
  "policy.unknown-override-mode":
    "The manual override mode is not recognized and was quarantined.",
  "policy.adapter-invalid-input":
    "The Card 5 policy rejected an invalid numeric input; no duration was applied.",
  "policy.adapter-unrecognized-result":
    "The Card 5 policy returned an unrecognized result; no duration was applied.",
};

function candidateProvenance(
  input: Card5DurationAdapterInput,
): readonly Card5CandidateProvenance[] {
  const override = input.manualOverride;
  const overrideSource: Card5CandidateSource =
    override?.mode === "hold"
      ? "manual-hold"
      : override?.mode === "reduce"
        ? "manual-reduce"
        : "manual-override";
  const overrideMinutes =
    override?.mode === "hold" ? input.currentMinutes : override?.targetMinutes;
  const recommendation = input.recommendation;

  return [
    {
      source: overrideSource,
      label: SOURCE_LABELS[overrideSource],
      referenceId: override?.overrideId ?? "manual-override:none",
      configured: override !== undefined,
      eligible: override?.active === true,
      minutes: overrideMinutes,
      explanation:
        override === undefined
          ? "No explicit manual duration override is configured."
          : override.active
            ? `Manual ${override.mode} is active and has first candidate precedence.`
            : "The explicit manual duration override is inactive.",
    },
    {
      source: "accepted-engine-recommendation",
      label: SOURCE_LABELS["accepted-engine-recommendation"],
      referenceId: recommendation?.recommendationId ?? "recommendation:none",
      configured: recommendation !== undefined,
      eligible:
        recommendation?.state === "accepted" &&
        recommendation.targetMinutes !== undefined,
      minutes: recommendation?.targetMinutes,
      explanation:
        recommendation === undefined
          ? "No recommendation decision is available."
          : recommendation.state === "accepted"
            ? "The parent accepted this recommendation."
            : "The parent rejected this recommendation, so it is retained in history but is not eligible.",
    },
    {
      source: "established-target",
      label: SOURCE_LABELS["established-target"],
      referenceId: "focus-target:established",
      configured: input.establishedTargetMinutes !== undefined,
      eligible: input.establishedTargetMinutes !== undefined,
      minutes: input.establishedTargetMinutes,
      explanation:
        input.establishedTargetMinutes === undefined
          ? "No established focus target is available."
          : "The established target is eligible after manual and accepted recommendation candidates.",
    },
    {
      source: "grade-band-default",
      label: SOURCE_LABELS["grade-band-default"],
      referenceId: "duration-default:grade-band",
      configured: true,
      eligible: true,
      minutes: input.gradeBandDefaultMinutes,
      explanation: "The grade-band default is the final candidate fallback.",
    },
  ];
}

function appliedConstraints(
  input: Card5DurationAdapterInput,
  lowerBound: number | undefined,
  upperBound: number | undefined,
): readonly Card5AppliedConstraint[] {
  const safety = [
    ...(input.safety.minimumMinutes === undefined
      ? []
      : [
          {
            constraintId: input.safety.constraintId,
            source: "safety" as const,
            label: "Safety minimum",
            kind: "minimum" as const,
            minutes: input.safety.minimumMinutes,
            active: true,
            binding: input.safety.minimumMinutes === lowerBound,
          },
        ]),
    ...(input.safety.maximumMinutes === undefined
      ? []
      : [
          {
            constraintId: input.safety.constraintId,
            source: "safety" as const,
            label: "Safety maximum",
            kind: "maximum" as const,
            minutes: input.safety.maximumMinutes,
            active: true,
            binding: input.safety.maximumMinutes === upperBound,
          },
        ]),
    ...(input.safety.veto === true
      ? [
          {
            constraintId: input.safety.constraintId,
            source: "safety" as const,
            label: "Safety veto",
            kind: "veto" as const,
            minutes: undefined,
            active: true,
            binding: true,
          },
        ]
      : []),
  ];
  const accommodations = input.accommodations.flatMap((item) => [
    ...(item.minimumMinutes === undefined
      ? []
      : [
          {
            constraintId: item.accommodationId,
            source: "required-accommodation" as const,
            label: "Required accommodation minimum",
            kind: "minimum" as const,
            minutes: item.minimumMinutes,
            active: item.active,
            binding: item.active && item.minimumMinutes === lowerBound,
          },
        ]),
    ...(item.maximumMinutes === undefined
      ? []
      : [
          {
            constraintId: item.accommodationId,
            source: "required-accommodation" as const,
            label: "Required accommodation maximum",
            kind: "maximum" as const,
            minutes: item.maximumMinutes,
            active: item.active,
            binding: item.active && item.maximumMinutes === upperBound,
          },
        ]),
  ]);
  const hardMaximums = input.adultHardMaximums.map((item) => ({
    constraintId: item.hardMaximumId,
    source: "adult-hard-maximum" as const,
    label: "Authorized adult hard maximum",
    kind: "maximum" as const,
    minutes: item.minutes,
    active: item.active,
    binding: item.active && item.minutes === upperBound,
  }));
  return [...safety, ...accommodations, ...hardMaximums];
}

function resolvedWinner(
  result: RawResolvedResult,
  constraints: readonly Card5AppliedConstraint[],
): Card5DurationWinner {
  const binding = constraints.filter(({ binding }) => binding);
  const clamped = result.targetMinutes !== result.candidateMinutes;
  const clampText =
    clamped && binding.length > 0
      ? ` It was clamped by ${binding.map(({ label, constraintId }) => `${label} (${constraintId})`).join(", ")}.`
      : "";
  return {
    source: result.source,
    label: clamped
      ? `${SOURCE_LABELS[result.source]} within required bounds`
      : SOURCE_LABELS[result.source],
    value: result.targetMinutes,
    reason: `${SOURCE_LABELS[result.source]} supplied ${result.candidateMinutes} minutes; the effective duration is ${result.targetMinutes} minutes within ${result.lowerBound}–${result.upperBound}.${clampText}`,
  };
}

function fallbackResolution(
  reasonCode:
    | "policy.adapter-invalid-input"
    | "policy.adapter-unrecognized-result",
  input: Card5DurationAdapterInput,
): Card5DurationResolution {
  return {
    field: "maximum-work-duration-minutes",
    policyId: CARD5_POLICY_ID,
    policyVersion: CARD5_POLICY_VERSION,
    status: "quarantine",
    reasonCode,
    source: undefined,
    candidateMinutes: undefined,
    targetMinutes: null,
    lowerBound: undefined,
    upperBound: undefined,
    applied: [],
    candidateProvenance: candidateProvenance(input),
    appliedConstraints: appliedConstraints(input, undefined, undefined),
    winner: {
      source: "quarantine",
      label: "Quarantined duration policy",
      value: null,
      reason: REASON_TEXT[reasonCode],
    },
  };
}

/**
 * Calls Card 5 POLICY_VERSION=1 and enriches its canonical result with stable
 * Card 8 provenance and user-facing explanation. It never invents a target for
 * manual-review or quarantine outcomes.
 */
export function resolveCard5Duration(
  input: Card5DurationAdapterInput,
): Card5DurationResolution {
  if (CARD5_RUNTIME_POLICY_VERSION !== CARD5_POLICY_VERSION) {
    return fallbackResolution("policy.adapter-unrecognized-result", input);
  }

  let raw: unknown;
  try {
    raw = resolveCard5DurationPolicy({
      policyVersion: input.policyVersion,
      integrityValid: input.integrityValid,
      actorAuthorized: input.actorAuthorized,
      safety: {
        ...(input.safety.minimumMinutes === undefined
          ? {}
          : { minimumMinutes: input.safety.minimumMinutes }),
        ...(input.safety.maximumMinutes === undefined
          ? {}
          : { maximumMinutes: input.safety.maximumMinutes }),
        ...(input.safety.veto === undefined ? {} : { veto: input.safety.veto }),
      },
      accommodations: input.accommodations.map((item) => ({
        active: item.active,
        ...(item.minimumMinutes === undefined
          ? {}
          : { minimumMinutes: item.minimumMinutes }),
        ...(item.maximumMinutes === undefined
          ? {}
          : { maximumMinutes: item.maximumMinutes }),
      })),
      adultHardMaximums: input.adultHardMaximums.map((item) => ({
        active: item.active,
        minutes: item.minutes,
      })),
      ...(input.manualOverride === undefined
        ? {}
        : {
            manualOverride: {
              active: input.manualOverride.active,
              mode: input.manualOverride.mode,
              ...(!("targetMinutes" in input.manualOverride) ||
              input.manualOverride.targetMinutes === undefined
                ? {}
                : { targetMinutes: input.manualOverride.targetMinutes }),
            },
          }),
      ...(input.recommendation === undefined
        ? {}
        : {
            recommendation: {
              state: input.recommendation.state,
              ...(input.recommendation.targetMinutes === undefined
                ? {}
                : { targetMinutes: input.recommendation.targetMinutes }),
            },
          }),
      ...(input.establishedTargetMinutes === undefined
        ? {}
        : { establishedTargetMinutes: input.establishedTargetMinutes }),
      currentMinutes: input.currentMinutes,
      gradeBandDefaultMinutes: input.gradeBandDefaultMinutes,
    });
  } catch {
    return fallbackResolution("policy.adapter-invalid-input", input);
  }

  if (
    typeof raw !== "object" ||
    raw === null ||
    !["resolved", "manual-review", "quarantine"].includes(
      String((raw as { readonly status?: unknown }).status),
    )
  ) {
    return fallbackResolution("policy.adapter-unrecognized-result", input);
  }

  const result = raw as RawCard5Result;
  const provenance = candidateProvenance(input);
  const lowerBound = "lowerBound" in result ? result.lowerBound : undefined;
  const upperBound = "upperBound" in result ? result.upperBound : undefined;
  const constraints = appliedConstraints(input, lowerBound, upperBound);

  if (result.status === "resolved") {
    return {
      field: "maximum-work-duration-minutes",
      policyId: CARD5_POLICY_ID,
      policyVersion: CARD5_POLICY_VERSION,
      status: result.status,
      reasonCode: result.reasonCode,
      source: result.source,
      candidateMinutes: result.candidateMinutes,
      targetMinutes: result.targetMinutes,
      lowerBound: result.lowerBound,
      upperBound: result.upperBound,
      applied: [...result.applied],
      candidateProvenance: provenance,
      appliedConstraints: constraints,
      winner: resolvedWinner(result, constraints),
    };
  }

  if (result.status === "manual-review") {
    return {
      field: "maximum-work-duration-minutes",
      policyId: CARD5_POLICY_ID,
      policyVersion: CARD5_POLICY_VERSION,
      status: result.status,
      reasonCode: result.reasonCode,
      source: undefined,
      candidateMinutes: undefined,
      targetMinutes: null,
      lowerBound: result.lowerBound,
      upperBound: result.upperBound,
      applied: [...result.applied],
      candidateProvenance: provenance,
      appliedConstraints: constraints,
      winner: {
        source: "manual-review",
        label: "Manual review required",
        value: null,
        reason: REASON_TEXT[result.reasonCode],
      },
    };
  }

  return {
    field: "maximum-work-duration-minutes",
    policyId: CARD5_POLICY_ID,
    policyVersion: CARD5_POLICY_VERSION,
    status: result.status,
    reasonCode: result.reasonCode,
    source: undefined,
    candidateMinutes: undefined,
    targetMinutes: null,
    lowerBound: undefined,
    upperBound: undefined,
    applied: [],
    candidateProvenance: provenance,
    appliedConstraints: constraints,
    winner: {
      source: "quarantine",
      label: "Quarantined duration policy",
      value: null,
      reason: REASON_TEXT[result.reasonCode],
    },
  };
}
