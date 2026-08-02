/**
 * Local, provisional evidence types.
 *
 * These types intentionally contain only aggregate learning-session signals.
 * Identity, free-form notes, diagnoses, and instructional mastery decisions do
 * not belong in this boundary.
 */

export const EVIDENCE_CATEGORIES = [
  "Concept difficulty",
  "Missing prerequisite",
  "Fatigue",
  "Interruption",
  "Technical issue",
  "Frustration",
  "Low confidence",
  "Support removed too quickly",
  "Possible disengagement",
  "Insufficient evidence",
] as const;

export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];

export type EffortPattern = "steady" | "variable" | "unknown";
export type PerformanceTrend = "improving" | "stable" | "declining" | "unknown";
export type AnswerPattern = "considered" | "rapid_random_like" | "unknown";
export type SupportTransition = "gradual" | "abrupt" | "unchanged" | "unknown";

export interface EvidenceSignals {
  readonly attempts?: number;
  readonly completedAttempts?: number;
  readonly accuracy?: number;

  readonly guidedAttempts?: number;
  readonly guidedAccuracy?: number;
  readonly independentAttempts?: number;
  readonly independentAccuracy?: number;

  readonly prerequisiteChecks?: number;
  readonly prerequisiteAccuracy?: number;

  readonly confidenceChecks?: number;
  readonly averageConfidence?: number;

  readonly pauseCount?: number;
  readonly interruptionCount?: number;
  readonly technicalIssueCount?: number;

  readonly medianResponseSeconds?: number;
  readonly rapidAnswerRatio?: number;

  readonly fatigueReported?: boolean;
  readonly frustrationReported?: boolean;
  readonly effortPattern?: EffortPattern;
  readonly performanceTrend?: PerformanceTrend;
  readonly answerPattern?: AnswerPattern;
  readonly supportTransition?: SupportTransition;

  /**
   * Accepted only to make the non-penalizing rule explicit. It is never used as
   * negative evidence by the classifier.
   */
  readonly approvedBreakCount?: number;
}

export type EvidenceReasonCode =
  | "abrupt_support_transition"
  | "approved_breaks_excluded"
  | "conflicting_signals"
  | "declining_performance_with_pauses"
  | "explicit_fatigue_report"
  | "explicit_frustration_report"
  | "guided_independent_gap"
  | "high_accuracy_with_unexplained_pauses"
  | "insufficient_observations"
  | "invalid_signal"
  | "low_confidence_report"
  | "low_prerequisite_accuracy"
  | "rapid_inconsistent_responses"
  | "steady_effort_with_low_accuracy"
  | "technical_event_observed"
  | "observed_interruption";

export interface EvidenceAssessment {
  readonly category: EvidenceCategory;
  /**
   * No category is asserted as a fact. "possible" means the aggregate pattern
   * warrants a contextual check; "insufficient" means no safe inference.
   */
  readonly conclusion: "possible" | "insufficient";
  readonly dataQuality: "sufficient" | "sparse" | "conflicting" | "contaminated";
  readonly reasons: readonly EvidenceReasonCode[];
  readonly alternatives: readonly EvidenceCategory[];
  /**
   * Static, non-diagnostic copy. No input text or learner identifier is echoed.
   */
  readonly safeSummary: string;
}
