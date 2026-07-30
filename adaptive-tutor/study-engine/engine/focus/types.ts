/**
 * Local, provisional focus-engine contracts.
 *
 * These types intentionally contain no learner identifier or free-form notes. The
 * integration adapter should convert authoritative tutor-core outcomes into this
 * narrow evidence shape and must not pass student profile data through the engine.
 */

export const FOCUS_RECOMMENDATIONS = [
  "increase",
  "maintain",
  "decrease",
  "insufficient_data",
  "manual_review",
] as const;

export type FocusRecommendation = (typeof FOCUS_RECOMMENDATIONS)[number];

export const GRADE_BANDS = [
  "elementary",
  "middle_school",
  "high_school",
] as const;

export type GradeBand = (typeof GRADE_BANDS)[number];

/**
 * This is an upstream outcome, not a judgment made by the focus engine.
 * The tutor core remains authoritative for mastery and misconception handling.
 */
export type CoreSessionOutcome =
  | "successful"
  | "not_successful"
  | "inconclusive";

/**
 * Direct, session-scoped feedback about the work-block duration.
 * "too_long" and "too_short" must never be inferred from academic accuracy.
 */
export type DurationResponse =
  | "comfortable"
  | "too_long"
  | "too_short"
  | "unknown";

/**
 * Approved breaks remain valid focus evidence. Interruptions and technical issues
 * are excluded because they do not provide reliable duration evidence.
 */
export type SessionDisruption =
  | "none"
  | "approved_break"
  | "interruption"
  | "technical_issue";

export type EvidenceQuality = "reliable" | "limited";

export interface FocusSessionEvidence {
  readonly occurredAtEpochMs: number;
  readonly subject: string;
  readonly taskType: string;
  readonly plannedDurationMinutes: number;
  readonly completedDurationMinutes: number;
  readonly coreOutcome: CoreSessionOutcome;
  readonly durationResponse: DurationResponse;
  readonly disruption: SessionDisruption;
  readonly quality: EvidenceQuality;
  /**
   * A trusted adult or upstream safety rule can request review. This is deliberately
   * a boolean so no sensitive or diagnostic free text enters the engine.
   */
  readonly manualReviewRequested?: boolean;
}

export interface ParentFocusOverride {
  /**
   * - automatic: apply evidence rules, while honoring the remaining override fields
   * - hold: keep the current duration without requiring five sessions
   * - reduce: reduce without requiring five sessions
   * - manual_review: do not make an automatic duration recommendation
   */
  readonly mode: "automatic" | "hold" | "reduce" | "manual_review";
  readonly maximumDurationMinutes?: number;
  /**
   * Only valid with mode "reduce". If omitted, the engine selects one conservative
   * grade-band step.
   */
  readonly targetDurationMinutes?: number;
  /**
   * Setting this to false disables evidence-based increases while still allowing a
   * maintain or decrease recommendation.
   */
  readonly allowIncrease?: boolean;
}

export interface FocusEnginePolicy {
  /**
   * Maximum number of recent comparable sessions to evaluate. At least five are
   * always required, regardless of this setting.
   */
  readonly comparisonWindowSize?: number;
  readonly durationSimilarityRatio?: number;
  readonly durationSimilarityFloorMinutes?: number;
  /**
   * May tighten, but never exceed, 0.10.
   */
  readonly maximumIncreaseRatio?: number;
  readonly maximumAutomaticDecreaseRatio?: number;
  readonly adjustmentGranularityMinutes?: number;
  readonly minimumDurationMinutes?: number;
  readonly durationCapsMinutes?: Readonly<
    Partial<Record<GradeBand, number>>
  >;
}

export interface FocusRecommendationInput {
  readonly gradeBand: GradeBand;
  readonly subject: string;
  readonly taskType: string;
  readonly currentDurationMinutes: number;
  readonly sessions: readonly FocusSessionEvidence[];
  readonly parentOverride?: ParentFocusOverride;
  readonly policy?: FocusEnginePolicy;
}

export type FocusReasonCode =
  | "adult_review_requested"
  | "conflicting_duration_feedback"
  | "current_duration_at_cap"
  | "current_duration_at_minimum"
  | "evidence_supports_maintain"
  | "evidence_supports_small_increase"
  | "increase_below_safe_minimum"
  | "increase_disabled_by_parent"
  | "insufficient_comparable_sessions"
  | "invalid_request"
  | "parent_cap_requires_decrease"
  | "parent_hold"
  | "parent_requested_decrease"
  | "parent_requested_review"
  | "repeated_too_long_feedback";

export interface FocusEvidenceSummary {
  readonly availableComparableSessions: number;
  readonly evaluatedComparableSessions: number;
  readonly successfulSessions: number;
  readonly tooLongResponses: number;
  readonly tooShortResponses: number;
  readonly approvedBreakSessions: number;
}

export interface FocusRecommendationResult {
  /**
   * The only possible recommendation vocabulary. All other fields are bounded
   * numeric metadata or enumerated reason codes.
   */
  readonly recommendation: FocusRecommendation;
  readonly currentDurationMinutes: number;
  readonly recommendedDurationMinutes: number;
  readonly adjustmentMinutes: number;
  readonly reasonCodes: readonly FocusReasonCode[];
  readonly evidence: FocusEvidenceSummary;
}
