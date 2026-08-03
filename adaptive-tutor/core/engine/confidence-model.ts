import type { ConfidenceEstimate, ConfidenceObservation, StableId } from "../contracts/index.js";

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function estimateConfidence(
  skillId: StableId,
  observations: readonly ConfidenceObservation[],
): ConfidenceEstimate {
  const relevant = observations.filter((observation) => observation.skillId === skillId);
  if (relevant.length === 0) {
    return {
      skillId,
      value: 0.5,
      uncertainty: 1,
      lowerBound: 0,
      upperBound: 1,
      evidenceCount: 0,
      effectiveEvidence: 0,
      distinctContextCount: 0,
      band: "insufficient-evidence",
      explanation: "No scored evidence is available, so the estimate is intentionally undecided.",
      placementDecisionAllowed: false,
    };
  }

  let alpha = 1;
  let beta = 1;
  let effectiveEvidence = 0;
  for (const observation of relevant) {
    const effectiveWeight = observation.weight * Math.max(0.1, observation.independence);
    effectiveEvidence += effectiveWeight;
    alpha += observation.score * effectiveWeight;
    beta += (1 - observation.score) * effectiveWeight;
  }
  const value = alpha / (alpha + beta);
  const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
  const standardDeviation = Math.sqrt(variance);
  const uncertainty = clamp(standardDeviation * 3.2);
  const lowerBound = clamp(value - 1.64 * standardDeviation);
  const upperBound = clamp(value + 1.64 * standardDeviation);
  const distinctContextCount = new Set(relevant.map((item) => item.contextId)).size;

  let band: ConfidenceEstimate["band"];
  if (relevant.length < 3 || distinctContextCount < 2) band = "insufficient-evidence";
  else if (value >= 0.85 && uncertainty <= 0.3) band = "strong";
  else if (value >= 0.65) band = "developing";
  else if (value >= 0.4) band = "low";
  else band = "very-low";

  const explanation =
    band === "insufficient-evidence"
      ? `The current estimate uses ${relevant.length} response(s) across ${distinctContextCount} context(s); more varied evidence is required before a mastery claim.`
      : `The estimate combines ${relevant.length} response(s) across ${distinctContextCount} context(s), while preserving an uncertainty range of ${Math.round(lowerBound * 100)}–${Math.round(upperBound * 100)}%.`;

  return {
    skillId,
    value,
    uncertainty,
    lowerBound,
    upperBound,
    evidenceCount: relevant.length,
    effectiveEvidence,
    distinctContextCount,
    band,
    explanation,
    placementDecisionAllowed: false,
  };
}
