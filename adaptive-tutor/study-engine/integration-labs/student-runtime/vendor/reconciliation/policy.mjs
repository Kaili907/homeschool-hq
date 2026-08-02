const CURRENT_POLICY_VERSION = 1;

function finiteNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return value;
}

function activeValues(items, pick) {
  return (items ?? []).filter((item) => item?.active !== false).map(pick);
}

/**
 * Reconciliation-only reference policy.
 * It demonstrates the approved precedence and does not integrate production code.
 */
export function resolveDurationPolicy(input) {
  if (input?.policyVersion !== CURRENT_POLICY_VERSION) {
    return {
      status: "quarantine",
      reasonCode: "policy.unsupported-version",
      targetMinutes: null
    };
  }
  if (input.integrityValid !== true || input.actorAuthorized !== true) {
    return {
      status: "quarantine",
      reasonCode:
        input.integrityValid !== true
          ? "policy.integrity-failed"
          : "policy.actor-unauthorized",
      targetMinutes: null
    };
  }

  const applied = [];
  const lowerCandidates = [
    finiteNumber(input.safety?.minimumMinutes ?? 0, "safety.minimumMinutes"),
    ...activeValues(
      input.accommodations,
      (item) => finiteNumber(item.minimumMinutes ?? 0, "accommodation.minimumMinutes")
    )
  ];
  const upperCandidates = [
    finiteNumber(
      input.safety?.maximumMinutes ?? Number.MAX_SAFE_INTEGER,
      "safety.maximumMinutes"
    ),
    ...activeValues(input.accommodations, (item) =>
      finiteNumber(
        item.maximumMinutes ?? Number.MAX_SAFE_INTEGER,
        "accommodation.maximumMinutes"
      )
    ),
    ...activeValues(input.adultHardMaximums, (item) =>
      finiteNumber(item.minutes, "adultHardMaximum.minutes")
    )
  ];

  const lowerBound = Math.max(...lowerCandidates);
  const upperBound = Math.min(...upperCandidates);

  if (input.safety?.veto === true) {
    return {
      status: "manual-review",
      reasonCode: "policy.safety-veto",
      lowerBound,
      upperBound,
      targetMinutes: null,
      applied: ["safety-veto"]
    };
  }
  if (lowerBound > upperBound) {
    return {
      status: "manual-review",
      reasonCode: "policy.infeasible-constraints",
      lowerBound,
      upperBound,
      targetMinutes: null,
      applied: ["constraint-intersection-empty"]
    };
  }

  let candidate;
  let source;
  const override = input.manualOverride;
  if (override?.active === true) {
    if (override.mode === "target") {
      candidate = finiteNumber(override.targetMinutes, "manualOverride.targetMinutes");
      source = "manual-override";
    } else if (override.mode === "hold") {
      candidate = finiteNumber(input.currentMinutes, "currentMinutes");
      source = "manual-hold";
    } else if (override.mode === "reduce") {
      candidate = Math.min(
        finiteNumber(input.currentMinutes, "currentMinutes"),
        finiteNumber(override.targetMinutes, "manualOverride.targetMinutes")
      );
      source = "manual-reduce";
    } else {
      return {
        status: "quarantine",
        reasonCode: "policy.unknown-override-mode",
        targetMinutes: null
      };
    }
  } else if (
    input.recommendation?.state === "accepted" &&
    typeof input.recommendation.targetMinutes === "number"
  ) {
    candidate = finiteNumber(
      input.recommendation.targetMinutes,
      "recommendation.targetMinutes"
    );
    source = "accepted-engine-recommendation";
  } else if (typeof input.establishedTargetMinutes === "number") {
    candidate = finiteNumber(
      input.establishedTargetMinutes,
      "establishedTargetMinutes"
    );
    source = "established-target";
  } else {
    candidate = finiteNumber(input.gradeBandDefaultMinutes, "gradeBandDefaultMinutes");
    source = "grade-band-default";
  }

  const targetMinutes = Math.min(upperBound, Math.max(lowerBound, candidate));
  if (targetMinutes !== candidate) applied.push("hard-clamp");
  if (upperBound !== Number.MAX_SAFE_INTEGER) applied.push("upper-bound");
  if (lowerBound > 0) applied.push("lower-bound");

  return {
    status: "resolved",
    reasonCode: "policy.resolved",
    source,
    candidateMinutes: candidate,
    targetMinutes,
    lowerBound,
    upperBound,
    applied
  };
}

export const POLICY_VERSION = CURRENT_POLICY_VERSION;
