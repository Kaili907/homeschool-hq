import type { CalendarDate } from "./calendar-date";

export const REVIEW_STARTING_SEQUENCE_DAYS = Object.freeze([
  0, 1, 3, 7, 14, 30,
] as const);

export const REVIEW_SCHEDULE_GUIDANCE =
  "This configurable sequence is a starting point, not a claim that one fixed spacing schedule is optimal for every learner.";

export type ReteachingOutcome =
  | "not_needed"
  | "successful"
  | "partial"
  | "unsuccessful"
  | "not_observed";

/**
 * Evidence collected from a retrieval event. Values are proportions from 0 to
 * 1. Null means the measure was not collected and is never treated as zero.
 */
export interface RetrievalEvidence {
  readonly retrievalAccuracy: number | null;
  readonly independence: number | null;
  readonly confidence: number | null;
  readonly consecutiveSuccessfulRetrievals: number;
  readonly retrievalFailed: boolean;
  readonly prerequisiteGap: boolean;
  readonly reteachingOutcome: ReteachingOutcome;
}

export interface ReviewProgressState {
  /**
   * Baseline interval most recently used. -1 means no review has yet been
   * scheduled from the starting sequence.
   */
  readonly lastBaselineIndex: number;
}

export interface ReviewSchedulerConfig {
  readonly startingSequenceDays?: readonly number[];
  readonly maximumIntervalDays?: number;
  /**
   * Upper bound for evidence-based extension beyond the selected baseline.
   * Values above 1.5 are rejected as too aggressive for this engine.
   */
  readonly maximumExtensionFactor?: number;
  readonly successAccuracyThreshold?: number;
  readonly strongAccuracyThreshold?: number;
  readonly successIndependenceThreshold?: number;
  readonly strongIndependenceThreshold?: number;
  readonly lowConfidenceThreshold?: number;
  readonly highConfidenceThreshold?: number;
}

export interface ReviewScheduleInput {
  readonly reviewedOn: CalendarDate;
  readonly state: ReviewProgressState;
  readonly evidence?: RetrievalEvidence;
  readonly config?: ReviewSchedulerConfig;
}

export type ReviewCadenceAction =
  | "start"
  | "shorten"
  | "hold"
  | "advance";

export type ReviewIntervalAdjustment =
  | "same_day"
  | "shortened"
  | "baseline"
  | "modestly_extended"
  | "capped";

export type ReviewReasonCode =
  | "starting_sequence"
  | "insufficient_retrieval_evidence"
  | "retrieval_success"
  | "repeated_retrieval_success"
  | "retrieval_failure"
  | "prerequisite_gap"
  | "low_retrieval_accuracy"
  | "limited_independence"
  | "low_confidence"
  | "high_confidence_supports_small_extension"
  | "strong_accuracy_supports_small_extension"
  | "strong_independence_supports_small_extension"
  | "reteaching_success_needs_reconsolidation"
  | "reteaching_partial"
  | "reteaching_unsuccessful"
  | "conflicting_evidence_resolved_conservatively"
  | "maximum_interval_cap_applied"
  | "maximum_extension_cap_applied"
  | "end_of_starting_sequence";

export type ReviewPreparation =
  | "none"
  | "reteach_before_retrieval"
  | "address_prerequisite_before_retrieval";

export interface ReviewRecommendation {
  readonly reviewedOn: CalendarDate;
  readonly dueOn: CalendarDate;
  readonly intervalDays: number;
  readonly baselineIntervalDays: number;
  readonly baselineIndex: number;
  readonly cadenceAction: ReviewCadenceAction;
  readonly intervalAdjustment: ReviewIntervalAdjustment;
  readonly preparation: ReviewPreparation;
  readonly reasons: readonly ReviewReasonCode[];
  readonly nextState: ReviewProgressState;
  readonly guidance: typeof REVIEW_SCHEDULE_GUIDANCE;
}

export interface StartingReview {
  readonly baselineIndex: number;
  readonly intervalDays: number;
  readonly dueOn: CalendarDate;
}
