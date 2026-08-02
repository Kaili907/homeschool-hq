import {
  FOCUS_RECOMMENDATIONS,
  GRADE_BANDS,
  type DurationResponse,
  type EvidenceQuality,
  type FocusEnginePolicy,
  type FocusEvidenceSummary,
  type FocusRecommendation,
  type FocusRecommendationInput,
  type FocusRecommendationResult,
  type FocusReasonCode,
  type FocusSessionEvidence,
  type GradeBand,
  type ParentFocusOverride,
  type SessionDisruption,
} from "./types";

const MINIMUM_COMPARABLE_SESSIONS = 5;
const DEFAULT_COMPARISON_WINDOW_SIZE = 5;
const DEFAULT_DURATION_SIMILARITY_RATIO = 0.2;
const DEFAULT_DURATION_SIMILARITY_FLOOR_MINUTES = 2;
const DEFAULT_MAXIMUM_INCREASE_RATIO = 0.1;
const DEFAULT_MAXIMUM_AUTOMATIC_DECREASE_RATIO = 0.1;
const DEFAULT_ADJUSTMENT_GRANULARITY_MINUTES = 1;
const DEFAULT_MINIMUM_DURATION_MINUTES = 1;

const CORE_OUTCOMES = [
  "successful",
  "not_successful",
  "inconclusive",
] as const;
const DURATION_RESPONSES = [
  "comfortable",
  "too_long",
  "too_short",
  "unknown",
] as const;
const SESSION_DISRUPTIONS = [
  "none",
  "approved_break",
  "interruption",
  "technical_issue",
] as const;
const EVIDENCE_QUALITIES = ["reliable", "limited"] as const;
const PARENT_OVERRIDE_MODES = [
  "automatic",
  "hold",
  "reduce",
  "manual_review",
] as const;

const BAND_ADJUSTMENTS: Readonly<
  Record<
    GradeBand,
    {
      readonly minimumIncreaseMinutes: number;
      readonly preferredAdjustmentMinutes: number;
    }
  >
> = Object.freeze({
  elementary: Object.freeze({
    minimumIncreaseMinutes: 1,
    preferredAdjustmentMinutes: 2,
  }),
  middle_school: Object.freeze({
    minimumIncreaseMinutes: 2,
    preferredAdjustmentMinutes: 3,
  }),
  high_school: Object.freeze({
    minimumIncreaseMinutes: 3,
    preferredAdjustmentMinutes: 4,
  }),
});

interface ResolvedPolicy {
  readonly comparisonWindowSize: number;
  readonly durationSimilarityRatio: number;
  readonly durationSimilarityFloorMinutes: number;
  readonly maximumIncreaseRatio: number;
  readonly maximumAutomaticDecreaseRatio: number;
  readonly adjustmentGranularityMinutes: number;
  readonly minimumDurationMinutes: number;
  readonly durationCapsMinutes: Readonly<
    Partial<Record<GradeBand, number>>
  >;
}

const EMPTY_EVIDENCE: FocusEvidenceSummary = Object.freeze({
  availableComparableSessions: 0,
  evaluatedComparableSessions: 0,
  successfulSessions: 0,
  tooLongResponses: 0,
  tooShortResponses: 0,
  approvedBreakSessions: 0,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOneOf<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
): value is T[number] {
  return typeof value === "string" && allowed.includes(value);
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function normalizeComparableKey(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

function isValidComparableLabel(value: unknown): value is string {
  return typeof value === "string" && normalizeComparableKey(value).length > 0;
}

function roundDuration(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function floorToGranularity(value: number, granularity: number): number {
  if (value < granularity) {
    return 0;
  }

  return roundDuration(
    Math.floor((value + Number.EPSILON) / granularity) * granularity,
  );
}

function resolvePolicy(
  policy: FocusEnginePolicy | undefined,
): ResolvedPolicy | undefined {
  const candidate = policy ?? {};
  if (!isRecord(candidate)) {
    return undefined;
  }

  const comparisonWindowSize =
    candidate.comparisonWindowSize ?? DEFAULT_COMPARISON_WINDOW_SIZE;
  const durationSimilarityRatio =
    candidate.durationSimilarityRatio ?? DEFAULT_DURATION_SIMILARITY_RATIO;
  const durationSimilarityFloorMinutes =
    candidate.durationSimilarityFloorMinutes ??
    DEFAULT_DURATION_SIMILARITY_FLOOR_MINUTES;
  const maximumIncreaseRatio =
    candidate.maximumIncreaseRatio ?? DEFAULT_MAXIMUM_INCREASE_RATIO;
  const maximumAutomaticDecreaseRatio =
    candidate.maximumAutomaticDecreaseRatio ??
    DEFAULT_MAXIMUM_AUTOMATIC_DECREASE_RATIO;
  const adjustmentGranularityMinutes =
    candidate.adjustmentGranularityMinutes ??
    DEFAULT_ADJUSTMENT_GRANULARITY_MINUTES;
  const minimumDurationMinutes =
    candidate.minimumDurationMinutes ?? DEFAULT_MINIMUM_DURATION_MINUTES;
  const durationCapsMinutes = candidate.durationCapsMinutes ?? {};

  if (
    typeof comparisonWindowSize !== "number" ||
    !Number.isInteger(comparisonWindowSize) ||
    comparisonWindowSize < MINIMUM_COMPARABLE_SESSIONS ||
    comparisonWindowSize > 50 ||
    !isNonNegativeFinite(durationSimilarityRatio) ||
    durationSimilarityRatio > 0.5 ||
    !isNonNegativeFinite(durationSimilarityFloorMinutes) ||
    durationSimilarityFloorMinutes > 60 ||
    !isPositiveFinite(maximumIncreaseRatio) ||
    maximumIncreaseRatio > DEFAULT_MAXIMUM_INCREASE_RATIO ||
    !isPositiveFinite(maximumAutomaticDecreaseRatio) ||
    maximumAutomaticDecreaseRatio > 0.2 ||
    !isPositiveFinite(adjustmentGranularityMinutes) ||
    adjustmentGranularityMinutes > 1 ||
    !isPositiveFinite(minimumDurationMinutes) ||
    !isRecord(durationCapsMinutes)
  ) {
    return undefined;
  }

  for (const gradeBand of GRADE_BANDS) {
    const cap = durationCapsMinutes[gradeBand];
    if (
      cap !== undefined &&
      (!isPositiveFinite(cap) || cap < minimumDurationMinutes)
    ) {
      return undefined;
    }
  }

  return {
    comparisonWindowSize,
    durationSimilarityRatio,
    durationSimilarityFloorMinutes,
    maximumIncreaseRatio,
    maximumAutomaticDecreaseRatio,
    adjustmentGranularityMinutes,
    minimumDurationMinutes,
    durationCapsMinutes,
  };
}

function isValidParentOverride(
  override: ParentFocusOverride | undefined,
): boolean {
  if (override === undefined) {
    return true;
  }
  if (
    !isRecord(override) ||
    !isOneOf(override.mode, PARENT_OVERRIDE_MODES)
  ) {
    return false;
  }
  if (
    override.maximumDurationMinutes !== undefined &&
    !isPositiveFinite(override.maximumDurationMinutes)
  ) {
    return false;
  }
  if (
    override.allowIncrease !== undefined &&
    typeof override.allowIncrease !== "boolean"
  ) {
    return false;
  }

  if (override.mode === "reduce") {
    return (
      override.targetDurationMinutes === undefined ||
      isPositiveFinite(override.targetDurationMinutes)
    );
  }

  return override.targetDurationMinutes === undefined;
}

function isValidSessionShape(value: unknown): value is FocusSessionEvidence {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.occurredAtEpochMs === "number" &&
    Number.isSafeInteger(value.occurredAtEpochMs) &&
    value.occurredAtEpochMs >= 0 &&
    isValidComparableLabel(value.subject) &&
    isValidComparableLabel(value.taskType) &&
    isPositiveFinite(value.plannedDurationMinutes) &&
    isNonNegativeFinite(value.completedDurationMinutes) &&
    value.completedDurationMinutes <= value.plannedDurationMinutes * 2 &&
    isOneOf(value.coreOutcome, CORE_OUTCOMES) &&
    isOneOf(value.durationResponse, DURATION_RESPONSES) &&
    isOneOf(value.disruption, SESSION_DISRUPTIONS) &&
    isOneOf(value.quality, EVIDENCE_QUALITIES) &&
    (value.manualReviewRequested === undefined ||
      typeof value.manualReviewRequested === "boolean")
  );
}

function matchesTargetContext(
  session: FocusSessionEvidence,
  input: FocusRecommendationInput,
  policy: ResolvedPolicy,
): boolean {
  if (
    normalizeComparableKey(session.subject) !==
      normalizeComparableKey(input.subject) ||
    normalizeComparableKey(session.taskType) !==
      normalizeComparableKey(input.taskType)
  ) {
    return false;
  }

  const allowedDifference = Math.max(
    policy.durationSimilarityFloorMinutes,
    input.currentDurationMinutes * policy.durationSimilarityRatio,
  );
  return (
    Math.abs(session.plannedDurationMinutes - input.currentDurationMinutes) <=
    allowedDifference
  );
}

function isUsableDurationEvidence(session: FocusSessionEvidence): boolean {
  return (
    session.quality === "reliable" &&
    session.disruption !== "interruption" &&
    session.disruption !== "technical_issue"
  );
}

function canonicalSessionTieBreak(session: FocusSessionEvidence): string {
  return [
    normalizeComparableKey(session.subject),
    normalizeComparableKey(session.taskType),
    session.plannedDurationMinutes.toString(),
    session.completedDurationMinutes.toString(),
    session.coreOutcome,
    session.durationResponse,
    session.disruption,
    session.quality,
    session.manualReviewRequested === true ? "1" : "0",
  ].join("\u001f");
}

function compareSessionsNewestFirst(
  left: FocusSessionEvidence,
  right: FocusSessionEvidence,
): number {
  const timestampDifference = right.occurredAtEpochMs - left.occurredAtEpochMs;
  if (timestampDifference !== 0) {
    return timestampDifference;
  }
  return canonicalSessionTieBreak(left).localeCompare(
    canonicalSessionTieBreak(right),
    "en-US",
  );
}

function createEvidenceSummary(
  allComparable: readonly FocusSessionEvidence[],
  evaluated: readonly FocusSessionEvidence[],
): FocusEvidenceSummary {
  return Object.freeze({
    availableComparableSessions: allComparable.length,
    evaluatedComparableSessions: evaluated.length,
    successfulSessions: evaluated.filter(
      (session) => session.coreOutcome === "successful",
    ).length,
    tooLongResponses: evaluated.filter(
      (session) => session.durationResponse === "too_long",
    ).length,
    tooShortResponses: evaluated.filter(
      (session) => session.durationResponse === "too_short",
    ).length,
    approvedBreakSessions: evaluated.filter(
      (session) => session.disruption === "approved_break",
    ).length,
  });
}

function createResult(
  recommendation: FocusRecommendation,
  currentDurationMinutes: number,
  recommendedDurationMinutes: number,
  reasonCodes: readonly FocusReasonCode[],
  evidence: FocusEvidenceSummary,
): FocusRecommendationResult {
  const safeCurrent = isPositiveFinite(currentDurationMinutes)
    ? roundDuration(currentDurationMinutes)
    : 0;
  const safeRecommended = isPositiveFinite(recommendedDurationMinutes)
    ? roundDuration(recommendedDurationMinutes)
    : safeCurrent;
  const safeRecommendation = FOCUS_RECOMMENDATIONS.includes(recommendation)
    ? recommendation
    : "manual_review";

  return Object.freeze({
    recommendation: safeRecommendation,
    currentDurationMinutes: safeCurrent,
    recommendedDurationMinutes: safeRecommended,
    adjustmentMinutes: roundDuration(safeRecommended - safeCurrent),
    reasonCodes: Object.freeze([...reasonCodes]),
    evidence,
  });
}

function manualReviewResult(
  currentDurationMinutes: number,
  reasonCode: FocusReasonCode,
  evidence: FocusEvidenceSummary = EMPTY_EVIDENCE,
): FocusRecommendationResult {
  return createResult(
    "manual_review",
    currentDurationMinutes,
    currentDurationMinutes,
    [reasonCode],
    evidence,
  );
}

function automaticDecreaseTarget(
  currentDurationMinutes: number,
  gradeBand: GradeBand,
  policy: ResolvedPolicy,
): number {
  const preferred =
    BAND_ADJUSTMENTS[gradeBand].preferredAdjustmentMinutes;
  const ratioBudget = floorToGranularity(
    currentDurationMinutes * policy.maximumAutomaticDecreaseRatio,
    policy.adjustmentGranularityMinutes,
  );
  const decrement = Math.min(preferred, ratioBudget);
  return roundDuration(
    Math.max(policy.minimumDurationMinutes, currentDurationMinutes - decrement),
  );
}

function effectiveDurationCap(
  gradeBand: GradeBand,
  policy: ResolvedPolicy,
  override: ParentFocusOverride | undefined,
): number {
  const configuredCap =
    policy.durationCapsMinutes[gradeBand] ?? Number.POSITIVE_INFINITY;
  const parentCap =
    override?.maximumDurationMinutes ?? Number.POSITIVE_INFINITY;
  return Math.min(configuredCap, parentCap);
}

/**
 * Produces a conservative, deterministic duration recommendation.
 *
 * Academic accuracy is consumed only through `coreOutcome`; the engine does not
 * infer why a session was unsuccessful and never generates diagnostic prose.
 */
export function recommendFocusDuration(
  input: FocusRecommendationInput,
): FocusRecommendationResult {
  if (!isRecord(input)) {
    return manualReviewResult(0, "invalid_request");
  }

  const currentDurationMinutes = input.currentDurationMinutes;
  const policy = resolvePolicy(input.policy);
  if (
    !isOneOf(input.gradeBand, GRADE_BANDS) ||
    !isValidComparableLabel(input.subject) ||
    !isValidComparableLabel(input.taskType) ||
    !isPositiveFinite(currentDurationMinutes) ||
    !Array.isArray(input.sessions) ||
    policy === undefined ||
    !isValidParentOverride(input.parentOverride)
  ) {
    return manualReviewResult(currentDurationMinutes, "invalid_request");
  }

  const override = input.parentOverride;
  const cap = effectiveDurationCap(input.gradeBand, policy, override);
  if (cap < policy.minimumDurationMinutes) {
    return manualReviewResult(currentDurationMinutes, "invalid_request");
  }

  const validContextSessions = input.sessions
    .filter(isValidSessionShape)
    .filter((session) => matchesTargetContext(session, input, policy))
    .sort(compareSessionsNewestFirst);

  const comparableSessions = validContextSessions.filter(
    isUsableDurationEvidence,
  );
  const evaluatedSessions = comparableSessions.slice(
    0,
    policy.comparisonWindowSize,
  );
  const evidence = createEvidenceSummary(
    comparableSessions,
    evaluatedSessions,
  );

  if (
    validContextSessions.some(
      (session) => session.manualReviewRequested === true,
    )
  ) {
    return manualReviewResult(
      currentDurationMinutes,
      "adult_review_requested",
      evidence,
    );
  }

  if (override?.mode === "manual_review") {
    return manualReviewResult(
      currentDurationMinutes,
      "parent_requested_review",
      evidence,
    );
  }

  if (override?.mode === "hold") {
    if (cap < currentDurationMinutes) {
      return manualReviewResult(
        currentDurationMinutes,
        "invalid_request",
        evidence,
      );
    }
    return createResult(
      "maintain",
      currentDurationMinutes,
      currentDurationMinutes,
      ["parent_hold"],
      evidence,
    );
  }

  if (override?.mode === "reduce") {
    const target =
      override.targetDurationMinutes ??
      automaticDecreaseTarget(
        currentDurationMinutes,
        input.gradeBand,
        policy,
      );
    const cappedTarget = Math.min(target, cap);
    if (
      cappedTarget < policy.minimumDurationMinutes ||
      cappedTarget >= currentDurationMinutes
    ) {
      return manualReviewResult(
        currentDurationMinutes,
        "invalid_request",
        evidence,
      );
    }
    return createResult(
      "decrease",
      currentDurationMinutes,
      cappedTarget,
      ["parent_requested_decrease"],
      evidence,
    );
  }

  /*
   * A cap below the current setting is a direct configuration constraint, not an
   * inference about the learner, so it is honored even when history is sparse.
   */
  if (cap < currentDurationMinutes) {
    return createResult(
      "decrease",
      currentDurationMinutes,
      cap,
      ["parent_cap_requires_decrease"],
      evidence,
    );
  }

  if (evaluatedSessions.length < MINIMUM_COMPARABLE_SESSIONS) {
    return createResult(
      "insufficient_data",
      currentDurationMinutes,
      currentDurationMinutes,
      ["insufficient_comparable_sessions"],
      evidence,
    );
  }

  if (
    evidence.tooLongResponses >= 2 &&
    evidence.tooShortResponses >= 2
  ) {
    return manualReviewResult(
      currentDurationMinutes,
      "conflicting_duration_feedback",
      evidence,
    );
  }

  if (evidence.tooLongResponses >= 2) {
    const target = automaticDecreaseTarget(
      currentDurationMinutes,
      input.gradeBand,
      policy,
    );
    if (target >= currentDurationMinutes) {
      return createResult(
        "maintain",
        currentDurationMinutes,
        currentDurationMinutes,
        ["current_duration_at_minimum"],
        evidence,
      );
    }
    return createResult(
      "decrease",
      currentDurationMinutes,
      target,
      ["repeated_too_long_feedback"],
      evidence,
    );
  }

  const successfulSessionsRequired = Math.ceil(
    evaluatedSessions.length * 0.8,
  );
  const qualifiesForIncrease =
    evidence.successfulSessions >= successfulSessionsRequired &&
    evidence.tooLongResponses === 0;

  if (!qualifiesForIncrease) {
    return createResult(
      "maintain",
      currentDurationMinutes,
      currentDurationMinutes,
      ["evidence_supports_maintain"],
      evidence,
    );
  }

  if (override?.allowIncrease === false) {
    return createResult(
      "maintain",
      currentDurationMinutes,
      currentDurationMinutes,
      ["increase_disabled_by_parent"],
      evidence,
    );
  }

  if (cap <= currentDurationMinutes) {
    return createResult(
      "maintain",
      currentDurationMinutes,
      currentDurationMinutes,
      ["current_duration_at_cap"],
      evidence,
    );
  }

  const bandAdjustment = BAND_ADJUSTMENTS[input.gradeBand];
  const ratioBudget = floorToGranularity(
    currentDurationMinutes * policy.maximumIncreaseRatio,
    policy.adjustmentGranularityMinutes,
  );
  const capBudget = floorToGranularity(
    cap - currentDurationMinutes,
    policy.adjustmentGranularityMinutes,
  );
  const adjustment = Math.min(
    bandAdjustment.preferredAdjustmentMinutes,
    ratioBudget,
    capBudget,
  );

  if (adjustment < bandAdjustment.minimumIncreaseMinutes) {
    return createResult(
      "maintain",
      currentDurationMinutes,
      currentDurationMinutes,
      ["increase_below_safe_minimum"],
      evidence,
    );
  }

  return createResult(
    "increase",
    currentDurationMinutes,
    currentDurationMinutes + adjustment,
    ["evidence_supports_small_increase"],
    evidence,
  );
}

export const FOCUS_ENGINE_MINIMUM_COMPARABLE_SESSIONS =
  MINIMUM_COMPARABLE_SESSIONS;
