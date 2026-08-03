import type {
  EvidenceAssessment,
  EvidenceCategory,
  EvidenceReasonCode,
  EvidenceSignals,
} from "./types";

interface Candidate {
  readonly category: Exclude<EvidenceCategory, "Insufficient evidence">;
  readonly rank: number;
  readonly reasons: readonly EvidenceReasonCode[];
}

const SAFE_SUMMARIES: Readonly<Record<EvidenceCategory, string>> = {
  "Concept difficulty":
    "The pattern may reflect difficulty with this concept. Review the instructional context before responding.",
  "Missing prerequisite":
    "The pattern may reflect a prerequisite gap. Check the prerequisite skill before changing pace.",
  Fatigue:
    "The pattern may reflect a need for rest. This is a session-level observation, not a diagnosis.",
  Interruption:
    "An observed interruption may have affected this session. Do not treat the interruption as learner failure.",
  "Technical issue":
    "A technical event may have affected the evidence. Resolve it before drawing learning conclusions.",
  Frustration:
    "The learner reported frustration. Offer support or a reset without blame.",
  "Low confidence":
    "The confidence check was low. Invite support without treating confidence as proof of mastery.",
  "Support removed too quickly":
    "The guided-to-independent change may have been too abrupt. Consider restoring support and checking again.",
  "Possible disengagement":
    "Rapid, inconsistent responses may reflect disengagement. Check context before drawing conclusions.",
  "Insufficient evidence":
    "There is not enough clear evidence for a safe classification. Gather more comparable observations.",
};

const ratioFields = [
  "accuracy",
  "guidedAccuracy",
  "independentAccuracy",
  "prerequisiteAccuracy",
  "averageConfidence",
  "rapidAnswerRatio",
] as const satisfies readonly (keyof EvidenceSignals)[];

const countFields = [
  "attempts",
  "completedAttempts",
  "guidedAttempts",
  "independentAttempts",
  "prerequisiteChecks",
  "confidenceChecks",
  "pauseCount",
  "interruptionCount",
  "technicalIssueCount",
  "approvedBreakCount",
] as const satisfies readonly (keyof EvidenceSignals)[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean";
}

function isOptionalEnum(
  value: unknown,
  allowed: ReadonlySet<string>,
): boolean {
  return value === undefined || (typeof value === "string" && allowed.has(value));
}

function isInvalid(signals: EvidenceSignals): boolean {
  if (!isRecord(signals)) {
    return true;
  }
  for (const field of ratioFields) {
    const value = signals[field];
    if (
      value !== undefined &&
      (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)
    ) {
      return true;
    }
  }

  if (
    typeof signals.attempts === "number" &&
    typeof signals.completedAttempts === "number" &&
    signals.completedAttempts > signals.attempts
  ) {
    return true;
  }

  if (
    !isOptionalBoolean(signals.fatigueReported) ||
    !isOptionalBoolean(signals.frustrationReported) ||
    !isOptionalEnum(
      signals.effortPattern,
      new Set(["steady", "variable", "unknown"]),
    ) ||
    !isOptionalEnum(
      signals.performanceTrend,
      new Set(["improving", "stable", "declining", "unknown"]),
    ) ||
    !isOptionalEnum(
      signals.answerPattern,
      new Set(["considered", "rapid_random_like", "unknown"]),
    ) ||
    !isOptionalEnum(
      signals.supportTransition,
      new Set(["gradual", "abrupt", "unchanged", "unknown"]),
    )
  ) {
    return true;
  }

  for (const field of countFields) {
    const value = signals[field];
    if (
      value !== undefined &&
      (typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        !Number.isInteger(value))
    ) {
      return true;
    }
  }

  const responseSeconds = signals.medianResponseSeconds;
  return (
    responseSeconds !== undefined &&
    (typeof responseSeconds !== "number" ||
      !Number.isFinite(responseSeconds) ||
      responseSeconds < 0)
  );
}

function insufficient(
  reasons: readonly EvidenceReasonCode[],
  dataQuality: EvidenceAssessment["dataQuality"],
  alternatives: readonly EvidenceCategory[] = [],
): EvidenceAssessment {
  return {
    category: "Insufficient evidence",
    conclusion: "insufficient",
    dataQuality,
    reasons,
    alternatives,
    safeSummary: SAFE_SUMMARIES["Insufficient evidence"],
  };
}

function orderedUniqueCategories(candidates: readonly Candidate[]): readonly EvidenceCategory[] {
  return [...new Set(candidates.map(({ category }) => category))];
}

/**
 * Classifies aggregate study-session evidence without making a diagnosis,
 * assigning blame, or deciding instructional mastery.
 *
 * Rules are deliberately conservative:
 * - a direct technical event contaminates performance inferences;
 * - similarly ranked explanations produce "Insufficient evidence";
 * - approved breaks are explicitly excluded from negative evidence;
 * - every affirmative output is framed as only "possible".
 */
export function classifyEvidence(signals: EvidenceSignals): EvidenceAssessment {
  if (isInvalid(signals)) {
    return insufficient(["invalid_signal"], "sparse");
  }

  const approvedBreakReason: readonly EvidenceReasonCode[] =
    (signals.approvedBreakCount ?? 0) > 0 ? ["approved_breaks_excluded"] : [];

  const candidates: Candidate[] = [];

  if ((signals.technicalIssueCount ?? 0) > 0) {
    candidates.push({
      category: "Technical issue",
      rank: 100,
      reasons: ["technical_event_observed"],
    });
  }

  if ((signals.interruptionCount ?? 0) > 0) {
    candidates.push({
      category: "Interruption",
      rank: 90,
      reasons: ["observed_interruption"],
    });
  }

  if (signals.fatigueReported === true) {
    candidates.push({
      category: "Fatigue",
      rank: 80,
      reasons: ["explicit_fatigue_report"],
    });
  }

  if (signals.frustrationReported === true) {
    candidates.push({
      category: "Frustration",
      rank: 80,
      reasons: ["explicit_frustration_report"],
    });
  }

  if (
    (signals.guidedAttempts ?? 0) >= 2 &&
    (signals.independentAttempts ?? 0) >= 2 &&
    (signals.guidedAccuracy ?? 0) >= 0.75 &&
    (signals.independentAccuracy ?? 1) <= 0.5 &&
    signals.supportTransition === "abrupt"
  ) {
    candidates.push({
      category: "Support removed too quickly",
      rank: 75,
      reasons: ["guided_independent_gap", "abrupt_support_transition"],
    });
  }

  if (
    (signals.prerequisiteChecks ?? 0) >= 2 &&
    (signals.prerequisiteAccuracy ?? 1) <= 0.5
  ) {
    candidates.push({
      category: "Missing prerequisite",
      rank: 75,
      reasons: ["low_prerequisite_accuracy"],
    });
  }

  if (
    (signals.attempts ?? 0) >= 5 &&
    signals.answerPattern === "rapid_random_like" &&
    (signals.medianResponseSeconds ?? Number.POSITIVE_INFINITY) <= 3 &&
    (signals.rapidAnswerRatio ?? 0) >= 0.6
  ) {
    candidates.push({
      category: "Possible disengagement",
      rank: 70,
      reasons: ["rapid_inconsistent_responses"],
    });
  }

  if (
    (signals.attempts ?? 0) >= 4 &&
    (signals.accuracy ?? 1) <= 0.55 &&
    signals.effortPattern === "steady"
  ) {
    candidates.push({
      category: "Concept difficulty",
      rank: 65,
      reasons: ["steady_effort_with_low_accuracy"],
    });
  }

  if (
    (signals.attempts ?? 0) >= 5 &&
    (signals.pauseCount ?? 0) >= 3 &&
    signals.performanceTrend === "declining"
  ) {
    candidates.push({
      category: "Fatigue",
      rank: 65,
      reasons: ["declining_performance_with_pauses"],
    });
  }

  if (
    (signals.confidenceChecks ?? 0) >= 1 &&
    (signals.averageConfidence ?? 1) <= 0.35
  ) {
    candidates.push({
      category: "Low confidence",
      rank: 60,
      reasons: ["low_confidence_report"],
    });
  }

  const hasUnexplainedPauses =
    (signals.attempts ?? 0) >= 4 &&
    (signals.accuracy ?? 0) >= 0.75 &&
    (signals.pauseCount ?? 0) >= 3 &&
    (signals.interruptionCount ?? 0) === 0 &&
    signals.fatigueReported !== true;

  if (hasUnexplainedPauses) {
    candidates.push(
      {
        category: "Interruption",
        rank: 50,
        reasons: ["high_accuracy_with_unexplained_pauses"],
      },
      {
        category: "Fatigue",
        rank: 50,
        reasons: ["high_accuracy_with_unexplained_pauses"],
      },
    );
  }

  candidates.sort(
    (left, right) =>
      right.rank - left.rank || left.category.localeCompare(right.category, "en"),
  );

  const technicalCandidate = candidates.find(
    ({ category }) => category === "Technical issue",
  );
  if (technicalCandidate) {
    return {
      category: technicalCandidate.category,
      conclusion: "possible",
      dataQuality: "contaminated",
      reasons: [...technicalCandidate.reasons, ...approvedBreakReason],
      alternatives: orderedUniqueCategories(
        candidates.filter(({ category }) => category !== "Technical issue"),
      ),
      safeSummary: SAFE_SUMMARIES[technicalCandidate.category],
    };
  }

  const top = candidates[0];
  if (!top) {
    return insufficient(
      ["insufficient_observations", ...approvedBreakReason],
      "sparse",
    );
  }

  const similarlyRanked = candidates.filter(
    ({ rank, category }) => top.rank - rank <= 5 && category !== top.category,
  );
  if (similarlyRanked.length > 0) {
    const ambiguous = [top, ...similarlyRanked];
    const reasons = [
      "conflicting_signals" as const,
      ...new Set(ambiguous.flatMap((candidate) => candidate.reasons)),
      ...approvedBreakReason,
    ];
    return insufficient(reasons, "conflicting", orderedUniqueCategories(ambiguous));
  }

  return {
    category: top.category,
    conclusion: "possible",
    dataQuality: "sufficient",
    reasons: [...top.reasons, ...approvedBreakReason],
    alternatives: orderedUniqueCategories(candidates.slice(1)),
    safeSummary: SAFE_SUMMARIES[top.category],
  };
}
