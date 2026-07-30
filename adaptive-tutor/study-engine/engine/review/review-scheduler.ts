import {
  addCalendarDays,
  calendarDate,
  type CalendarDate,
} from "./calendar-date";
import {
  REVIEW_SCHEDULE_GUIDANCE,
  REVIEW_STARTING_SEQUENCE_DAYS,
  type RetrievalEvidence,
  type ReviewCadenceAction,
  type ReviewIntervalAdjustment,
  type ReviewPreparation,
  type ReviewReasonCode,
  type ReviewRecommendation,
  type ReviewScheduleInput,
  type ReviewSchedulerConfig,
  type StartingReview,
} from "./types";

interface ResolvedReviewSchedulerConfig {
  readonly startingSequenceDays: readonly number[];
  readonly maximumIntervalDays: number;
  readonly maximumExtensionFactor: number;
  readonly successAccuracyThreshold: number;
  readonly strongAccuracyThreshold: number;
  readonly successIndependenceThreshold: number;
  readonly strongIndependenceThreshold: number;
  readonly lowConfidenceThreshold: number;
  readonly highConfidenceThreshold: number;
}

const DEFAULT_CONFIG: ResolvedReviewSchedulerConfig = Object.freeze({
  startingSequenceDays: REVIEW_STARTING_SEQUENCE_DAYS,
  maximumIntervalDays: 180,
  maximumExtensionFactor: 1.2,
  successAccuracyThreshold: 0.8,
  strongAccuracyThreshold: 0.9,
  successIndependenceThreshold: 0.7,
  strongIndependenceThreshold: 0.85,
  lowConfidenceThreshold: 0.4,
  highConfidenceThreshold: 0.8,
});

function assertProportion(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be a finite number from 0 to 1.`);
  }
}

function assertOptionalProportion(
  value: number | null,
  name: string,
): void {
  if (value !== null) {
    assertProportion(value, name);
  }
}

function validateEvidence(evidence: RetrievalEvidence): void {
  assertOptionalProportion(evidence.retrievalAccuracy, "retrievalAccuracy");
  assertOptionalProportion(evidence.independence, "independence");
  assertOptionalProportion(evidence.confidence, "confidence");
  if (
    !Number.isSafeInteger(evidence.consecutiveSuccessfulRetrievals) ||
    evidence.consecutiveSuccessfulRetrievals < 0
  ) {
    throw new RangeError(
      "consecutiveSuccessfulRetrievals must be a non-negative safe integer.",
    );
  }

  const validReteachingOutcomes = new Set([
    "not_needed",
    "successful",
    "partial",
    "unsuccessful",
    "not_observed",
  ]);
  if (!validReteachingOutcomes.has(evidence.reteachingOutcome)) {
    throw new RangeError("reteachingOutcome is not supported.");
  }
  if (typeof evidence.retrievalFailed !== "boolean") {
    throw new TypeError("retrievalFailed must be a boolean.");
  }
  if (typeof evidence.prerequisiteGap !== "boolean") {
    throw new TypeError("prerequisiteGap must be a boolean.");
  }
}

function validateSequence(sequence: readonly number[]): readonly number[] {
  if (sequence.length === 0 || sequence[0] !== 0) {
    throw new RangeError(
      "startingSequenceDays must begin with 0 for a same-day review.",
    );
  }

  let previous = -1;
  const copy = sequence.map((value) => {
    if (!Number.isSafeInteger(value) || value < 0 || value <= previous) {
      throw new RangeError(
        "startingSequenceDays must be strictly increasing non-negative safe integers.",
      );
    }
    previous = value;
    return value;
  });

  return Object.freeze(copy);
}

function resolveConfig(
  config: ReviewSchedulerConfig | undefined,
): ResolvedReviewSchedulerConfig {
  const startingSequenceDays = validateSequence(
    config?.startingSequenceDays ?? DEFAULT_CONFIG.startingSequenceDays,
  );
  const maximumIntervalDays =
    config?.maximumIntervalDays ?? DEFAULT_CONFIG.maximumIntervalDays;
  const maximumExtensionFactor =
    config?.maximumExtensionFactor ?? DEFAULT_CONFIG.maximumExtensionFactor;
  const successAccuracyThreshold =
    config?.successAccuracyThreshold ?? DEFAULT_CONFIG.successAccuracyThreshold;
  const strongAccuracyThreshold =
    config?.strongAccuracyThreshold ?? DEFAULT_CONFIG.strongAccuracyThreshold;
  const successIndependenceThreshold =
    config?.successIndependenceThreshold ??
    DEFAULT_CONFIG.successIndependenceThreshold;
  const strongIndependenceThreshold =
    config?.strongIndependenceThreshold ??
    DEFAULT_CONFIG.strongIndependenceThreshold;
  const lowConfidenceThreshold =
    config?.lowConfidenceThreshold ?? DEFAULT_CONFIG.lowConfidenceThreshold;
  const highConfidenceThreshold =
    config?.highConfidenceThreshold ?? DEFAULT_CONFIG.highConfidenceThreshold;

  if (
    !Number.isSafeInteger(maximumIntervalDays) ||
    maximumIntervalDays < startingSequenceDays[startingSequenceDays.length - 1]!
  ) {
    throw new RangeError(
      "maximumIntervalDays must be a safe integer at least as large as the final starting interval.",
    );
  }
  if (
    !Number.isFinite(maximumExtensionFactor) ||
    maximumExtensionFactor < 1 ||
    maximumExtensionFactor > 1.5
  ) {
    throw new RangeError(
      "maximumExtensionFactor must be a finite number from 1 to 1.5.",
    );
  }

  assertProportion(successAccuracyThreshold, "successAccuracyThreshold");
  assertProportion(strongAccuracyThreshold, "strongAccuracyThreshold");
  assertProportion(
    successIndependenceThreshold,
    "successIndependenceThreshold",
  );
  assertProportion(
    strongIndependenceThreshold,
    "strongIndependenceThreshold",
  );
  assertProportion(lowConfidenceThreshold, "lowConfidenceThreshold");
  assertProportion(highConfidenceThreshold, "highConfidenceThreshold");

  if (strongAccuracyThreshold < successAccuracyThreshold) {
    throw new RangeError(
      "strongAccuracyThreshold cannot be below successAccuracyThreshold.",
    );
  }
  if (strongIndependenceThreshold < successIndependenceThreshold) {
    throw new RangeError(
      "strongIndependenceThreshold cannot be below successIndependenceThreshold.",
    );
  }
  if (highConfidenceThreshold <= lowConfidenceThreshold) {
    throw new RangeError(
      "highConfidenceThreshold must be greater than lowConfidenceThreshold.",
    );
  }

  return {
    startingSequenceDays,
    maximumIntervalDays,
    maximumExtensionFactor,
    successAccuracyThreshold,
    strongAccuracyThreshold,
    successIndependenceThreshold,
    strongIndependenceThreshold,
    lowConfidenceThreshold,
    highConfidenceThreshold,
  };
}

function containsConflictingEvidence(
  evidence: RetrievalEvidence,
  config: ResolvedReviewSchedulerConfig,
): boolean {
  const highMeasuredPerformance =
    evidence.retrievalAccuracy !== null &&
    evidence.retrievalAccuracy >= config.successAccuracyThreshold &&
    evidence.independence !== null &&
    evidence.independence >= config.successIndependenceThreshold;

  return (
    ((evidence.retrievalFailed || evidence.prerequisiteGap) &&
      highMeasuredPerformance) ||
    ((evidence.retrievalFailed || evidence.prerequisiteGap) &&
      evidence.consecutiveSuccessfulRetrievals > 0)
  );
}

function hasSufficientEvidence(evidence: RetrievalEvidence): boolean {
  return (
    evidence.retrievalAccuracy !== null && evidence.independence !== null
  );
}

function isSuccessful(
  evidence: RetrievalEvidence,
  config: ResolvedReviewSchedulerConfig,
): boolean {
  return (
    !evidence.retrievalFailed &&
    !evidence.prerequisiteGap &&
    evidence.reteachingOutcome !== "partial" &&
    evidence.reteachingOutcome !== "unsuccessful" &&
    evidence.retrievalAccuracy !== null &&
    evidence.retrievalAccuracy >= config.successAccuracyThreshold &&
    evidence.independence !== null &&
    evidence.independence >= config.successIndependenceThreshold
  );
}

function needsRegression(
  evidence: RetrievalEvidence,
  config: ResolvedReviewSchedulerConfig,
): boolean {
  return (
    evidence.retrievalFailed ||
    evidence.prerequisiteGap ||
    evidence.reteachingOutcome === "unsuccessful" ||
    (evidence.retrievalAccuracy !== null &&
      evidence.retrievalAccuracy < config.successAccuracyThreshold * 0.75) ||
    (evidence.independence !== null &&
      evidence.independence < config.successIndependenceThreshold * 0.7)
  );
}

function selectBaselineIndex(
  previousIndex: number,
  evidence: RetrievalEvidence | undefined,
  config: ResolvedReviewSchedulerConfig,
): number {
  if (previousIndex === -1) {
    return 0;
  }
  if (!evidence || !hasSufficientEvidence(evidence)) {
    return previousIndex;
  }
  if (needsRegression(evidence, config)) {
    return Math.max(0, previousIndex - 1);
  }
  if (isSuccessful(evidence, config)) {
    return Math.min(
      config.startingSequenceDays.length - 1,
      previousIndex + 1,
    );
  }
  return previousIndex;
}

function cadenceAction(
  previousIndex: number,
  selectedIndex: number,
): ReviewCadenceAction {
  if (previousIndex === -1) {
    return "start";
  }
  if (selectedIndex < previousIndex) {
    return "shorten";
  }
  if (selectedIndex > previousIndex) {
    return "advance";
  }
  return "hold";
}

interface IntervalResult {
  readonly intervalDays: number;
  readonly adjustment: ReviewIntervalAdjustment;
  readonly capReasons: readonly ReviewReasonCode[];
}

function selectInterval(
  baselineDays: number,
  evidence: RetrievalEvidence | undefined,
  config: ResolvedReviewSchedulerConfig,
): IntervalResult {
  if (!evidence) {
    return {
      intervalDays: baselineDays,
      adjustment: baselineDays === 0 ? "same_day" : "baseline",
      capReasons: [],
    };
  }

  if (
    evidence.retrievalFailed ||
    evidence.prerequisiteGap ||
    evidence.reteachingOutcome === "unsuccessful"
  ) {
    return {
      intervalDays: 0,
      adjustment: "same_day",
      capReasons: [],
    };
  }

  if (!hasSufficientEvidence(evidence)) {
    return {
      intervalDays: baselineDays,
      adjustment: baselineDays === 0 ? "same_day" : "baseline",
      capReasons: [],
    };
  }

  if (
    evidence.reteachingOutcome === "partial" ||
    !isSuccessful(evidence, config)
  ) {
    const shortened =
      baselineDays === 0 ? 0 : Math.max(1, Math.floor(baselineDays * 0.6));
    return {
      intervalDays: shortened,
      adjustment: shortened === 0 ? "same_day" : "shortened",
      capReasons: [],
    };
  }

  let factor = 1;
  if (
    evidence.retrievalAccuracy !== null &&
    evidence.retrievalAccuracy >= config.strongAccuracyThreshold
  ) {
    factor += 0.05;
  }
  if (
    evidence.independence !== null &&
    evidence.independence >= config.strongIndependenceThreshold
  ) {
    factor += 0.05;
  }
  if (
    evidence.confidence !== null &&
    evidence.confidence >= config.highConfidenceThreshold
  ) {
    factor += 0.025;
  }
  if (evidence.consecutiveSuccessfulRetrievals >= 2) {
    factor += Math.min(
      0.1,
      (evidence.consecutiveSuccessfulRetrievals - 1) * 0.025,
    );
  }
  if (
    evidence.confidence !== null &&
    evidence.confidence < config.lowConfidenceThreshold
  ) {
    factor *= 0.85;
  }
  if (evidence.reteachingOutcome === "successful") {
    factor = Math.min(factor, 0.85);
  }

  const capReasons: ReviewReasonCode[] = [];
  if (factor > config.maximumExtensionFactor) {
    factor = config.maximumExtensionFactor;
    capReasons.push("maximum_extension_cap_applied");
  }

  let intervalDays =
    baselineDays === 0 ? 0 : Math.max(1, Math.round(baselineDays * factor));
  if (intervalDays > config.maximumIntervalDays) {
    intervalDays = config.maximumIntervalDays;
    capReasons.push("maximum_interval_cap_applied");
  }

  let adjustment: ReviewIntervalAdjustment;
  if (capReasons.length > 0) {
    adjustment = "capped";
  } else if (intervalDays === 0) {
    adjustment = "same_day";
  } else if (intervalDays < baselineDays) {
    adjustment = "shortened";
  } else if (intervalDays > baselineDays) {
    adjustment = "modestly_extended";
  } else {
    adjustment = "baseline";
  }

  return { intervalDays, adjustment, capReasons };
}

function evidenceReasons(
  evidence: RetrievalEvidence | undefined,
  config: ResolvedReviewSchedulerConfig,
  selectedIndex: number,
): ReviewReasonCode[] {
  if (!evidence) {
    return ["starting_sequence"];
  }

  const reasons: ReviewReasonCode[] = [];
  if (containsConflictingEvidence(evidence, config)) {
    reasons.push("conflicting_evidence_resolved_conservatively");
  }
  if (evidence.prerequisiteGap) {
    reasons.push("prerequisite_gap");
  }
  if (evidence.retrievalFailed) {
    reasons.push("retrieval_failure");
  }
  if (evidence.reteachingOutcome === "unsuccessful") {
    reasons.push("reteaching_unsuccessful");
  } else if (evidence.reteachingOutcome === "partial") {
    reasons.push("reteaching_partial");
  } else if (evidence.reteachingOutcome === "successful") {
    reasons.push("reteaching_success_needs_reconsolidation");
  }

  if (!hasSufficientEvidence(evidence)) {
    reasons.push("insufficient_retrieval_evidence");
  } else if (isSuccessful(evidence, config)) {
    reasons.push("retrieval_success");
    if (
      evidence.retrievalAccuracy !== null &&
      evidence.retrievalAccuracy >= config.strongAccuracyThreshold
    ) {
      reasons.push("strong_accuracy_supports_small_extension");
    }
    if (
      evidence.independence !== null &&
      evidence.independence >= config.strongIndependenceThreshold
    ) {
      reasons.push("strong_independence_supports_small_extension");
    }
    if (
      evidence.confidence !== null &&
      evidence.confidence >= config.highConfidenceThreshold
    ) {
      reasons.push("high_confidence_supports_small_extension");
    }
    if (evidence.consecutiveSuccessfulRetrievals >= 2) {
      reasons.push("repeated_retrieval_success");
    }
  } else {
    if (
      evidence.retrievalAccuracy !== null &&
      evidence.retrievalAccuracy < config.successAccuracyThreshold
    ) {
      reasons.push("low_retrieval_accuracy");
    }
    if (
      evidence.independence !== null &&
      evidence.independence < config.successIndependenceThreshold
    ) {
      reasons.push("limited_independence");
    }
  }

  if (
    evidence.confidence !== null &&
    evidence.confidence < config.lowConfidenceThreshold
  ) {
    reasons.push("low_confidence");
  }
  if (selectedIndex === config.startingSequenceDays.length - 1) {
    reasons.push("end_of_starting_sequence");
  }

  return reasons;
}

function preparationFor(evidence: RetrievalEvidence | undefined): ReviewPreparation {
  if (evidence?.prerequisiteGap) {
    return "address_prerequisite_before_retrieval";
  }
  if (
    evidence?.retrievalFailed ||
    evidence?.reteachingOutcome === "partial" ||
    evidence?.reteachingOutcome === "unsuccessful"
  ) {
    return "reteach_before_retrieval";
  }
  return "none";
}

/**
 * Build the configured starting cadence without claiming it is universally
 * optimal. The caller can present or persist these dates as a provisional plan.
 */
export function createStartingReviewPlan(
  startsOn: CalendarDate,
  config?: ReviewSchedulerConfig,
): readonly StartingReview[] {
  const validStart = calendarDate(startsOn);
  const resolved = resolveConfig(config);

  return resolved.startingSequenceDays.map((intervalDays, baselineIndex) => ({
    baselineIndex,
    intervalDays,
    dueOn: addCalendarDays(validStart, intervalDays),
  }));
}

/**
 * Schedule one next retrieval from prior baseline state and current evidence.
 * Failures and prerequisite gaps always dominate optimistic or conflicting
 * signals; confidence alone can never advance the sequence.
 */
export function scheduleNextReview(
  input: ReviewScheduleInput,
): ReviewRecommendation {
  const reviewedOn = calendarDate(input.reviewedOn);
  const config = resolveConfig(input.config);
  const previousIndex = input.state.lastBaselineIndex;

  if (
    !Number.isSafeInteger(previousIndex) ||
    previousIndex < -1 ||
    previousIndex >= config.startingSequenceDays.length
  ) {
    throw new RangeError(
      "state.lastBaselineIndex must be -1 or an index in startingSequenceDays.",
    );
  }
  if (input.evidence) {
    validateEvidence(input.evidence);
  }

  const selectedIndex = selectBaselineIndex(
    previousIndex,
    input.evidence,
    config,
  );
  const baselineDays = config.startingSequenceDays[selectedIndex]!;
  const interval = selectInterval(baselineDays, input.evidence, config);
  const reasons = [
    ...evidenceReasons(input.evidence, config, selectedIndex),
    ...interval.capReasons,
  ];

  return {
    reviewedOn,
    dueOn: addCalendarDays(reviewedOn, interval.intervalDays),
    intervalDays: interval.intervalDays,
    baselineIntervalDays: baselineDays,
    baselineIndex: selectedIndex,
    cadenceAction: cadenceAction(previousIndex, selectedIndex),
    intervalAdjustment: interval.adjustment,
    preparation: preparationFor(input.evidence),
    reasons,
    nextState: { lastBaselineIndex: selectedIndex },
    guidance: REVIEW_SCHEDULE_GUIDANCE,
  };
}
