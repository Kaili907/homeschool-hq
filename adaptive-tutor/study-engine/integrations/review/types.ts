/**
 * Provisional, persistence-free review queue contracts.
 *
 * The tutor core supplies the instructional purpose and priority. This
 * integration only schedules already-authorized review work within explicit
 * daily limits.
 */

export const REVIEW_KINDS = [
  "review",
  "reteaching",
  "prerequisite_remediation",
] as const;

export type ReviewKind = (typeof REVIEW_KINDS)[number];

export const REVIEW_PRIORITIES = ["urgent", "high", "normal", "low"] as const;

export type ReviewPriority = (typeof REVIEW_PRIORITIES)[number];

export type ReviewSource = "tutor_generated";

export type ReviewState = "pending" | "completed";

export type ReviewTiming = "same_day" | "future" | "overdue";

export const REVIEW_DEFERRAL_REASONS = [
  "student_request",
  "parent_adjustment",
  "schedule_conflict",
  "daily_limit",
] as const;

export type ReviewDeferralReason =
  (typeof REVIEW_DEFERRAL_REASONS)[number];

export type ReviewDeferralActor = "student" | "parent" | "system";

export interface ReviewDeferral {
  readonly recordedOn: string;
  readonly fromDate: string;
  readonly toDate: string;
  readonly reason: ReviewDeferralReason;
  readonly actor: ReviewDeferralActor;
}

export interface ReviewItem {
  readonly schemaVersion: "provisional-review-item.v1";
  /**
   * Opaque references only. Direct student identifiers and response content do
   * not belong in this integration contract.
   */
  readonly reviewRef: string;
  readonly skillRef: string;
  readonly title: string;
  readonly source: ReviewSource;
  readonly kind: ReviewKind;
  readonly priority: ReviewPriority;
  readonly createdDate: string;
  readonly scheduledDate: string;
  readonly estimatedMinutes: number;
  readonly state: ReviewState;
  readonly deferrals: readonly ReviewDeferral[];
}

export interface CreateReviewItemInput {
  readonly reviewRef: string;
  readonly skillRef: string;
  readonly title: string;
  readonly source: ReviewSource;
  readonly kind: ReviewKind;
  readonly priority: ReviewPriority;
  readonly createdDate: string;
  readonly scheduledDate: string;
  readonly estimatedMinutes: number;
  readonly state?: ReviewState;
}

export interface DeferReviewInput {
  readonly recordedOn: string;
  readonly resumeDate: string;
  readonly reason: ReviewDeferralReason;
  readonly actor: ReviewDeferralActor;
}

export interface DailyReviewLimits {
  readonly maxItems: number;
  readonly maxMinutes: number;
}

export interface BuildDailyReviewQueueInput {
  readonly planningDate: string;
  readonly limits: DailyReviewLimits;
  readonly reviews: readonly ReviewItem[];
}

export interface ScheduledReview {
  readonly review: ReviewItem;
  readonly timing: Exclude<ReviewTiming, "future">;
  readonly queuePosition: number;
  readonly evidence: readonly string[];
  readonly studentMessage: string;
}

export interface UpcomingReview {
  readonly review: ReviewItem;
  readonly timing: "future";
}

export type CapacityHoldReason =
  | "daily_item_limit"
  | "daily_minute_limit"
  | "priority_preserved";

export interface CapacityHeldReview {
  readonly review: ReviewItem;
  readonly timing: Exclude<ReviewTiming, "future">;
  readonly reason: CapacityHoldReason;
  /**
   * Present when a lower-priority review is held after an earlier review could
   * not fit. This keeps queue ordering explainable and deterministic.
   */
  readonly heldBehindReviewRef?: string;
  readonly parentEvidence: string;
  readonly studentMessage: string;
}

export interface DailyReviewQueue {
  readonly schemaVersion: "provisional-daily-review-queue.v1";
  readonly planningDate: string;
  readonly limits: DailyReviewLimits;
  readonly scheduled: readonly ScheduledReview[];
  readonly upcoming: readonly UpcomingReview[];
  readonly capacityHeld: readonly CapacityHeldReview[];
  readonly completedExcludedReviewRefs: readonly string[];
  readonly summary: {
    readonly dueCount: number;
    readonly scheduledCount: number;
    readonly scheduledMinutes: number;
    readonly capacityHeldCount: number;
    readonly upcomingCount: number;
    readonly completedExcludedCount: number;
    readonly overloadAvoided: boolean;
    readonly evidence: readonly string[];
  };
}

export type ReviewQueueErrorCode =
  | "invalid_ref"
  | "invalid_title"
  | "invalid_date"
  | "invalid_estimate"
  | "invalid_source"
  | "invalid_kind"
  | "invalid_priority"
  | "invalid_state"
  | "invalid_deferral"
  | "completed_review"
  | "invalid_limit"
  | "duplicate_review_ref";

export class ReviewQueueError extends Error {
  public readonly name = "ReviewQueueError";

  public constructor(
    public readonly code: ReviewQueueErrorCode,
    message: string,
  ) {
    super(message);
  }
}
