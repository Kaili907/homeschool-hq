import {
  REVIEW_DEFERRAL_REASONS,
  REVIEW_KINDS,
  REVIEW_PRIORITIES,
  ReviewQueueError,
  type BuildDailyReviewQueueInput,
  type CapacityHeldReview,
  type CreateReviewItemInput,
  type DailyReviewQueue,
  type DeferReviewInput,
  type ReviewDeferral,
  type ReviewItem,
  type ReviewPriority,
  type ReviewTiming,
  type ScheduledReview,
} from "./types.js";

const OPAQUE_REF = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TITLE_LENGTH = 120;
const MAX_REVIEW_MINUTES = 180;

const PRIORITY_RANK: Readonly<Record<ReviewPriority, number>> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function assertRef(value: string, field: "reviewRef" | "skillRef"): void {
  if (!OPAQUE_REF.test(value)) {
    throw new ReviewQueueError(
      "invalid_ref",
      `${field} must be an opaque 1-64 character reference.`,
    );
  }
}

function assertCalendarDate(value: string): void {
  if (!CALENDAR_DATE.test(value)) {
    throw new ReviewQueueError(
      "invalid_date",
      "Review dates must use the calendar-date form YYYY-MM-DD.",
    );
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ReviewQueueError(
      "invalid_date",
      "Review date is not a real calendar date.",
    );
  }
}

function isOneOf<T extends string>(
  value: string,
  values: readonly T[],
): value is T {
  return (values as readonly string[]).includes(value);
}

function assertReviewItem(review: ReviewItem): void {
  if (review.schemaVersion !== "provisional-review-item.v1") {
    throw new ReviewQueueError(
      "invalid_state",
      "Review item schema version is not supported.",
    );
  }
  assertRef(review.reviewRef, "reviewRef");
  assertRef(review.skillRef, "skillRef");
  if (
    typeof review.title !== "string" ||
    review.title.trim().length === 0 ||
    review.title.length > MAX_TITLE_LENGTH
  ) {
    throw new ReviewQueueError(
      "invalid_title",
      `Review titles must contain 1-${MAX_TITLE_LENGTH} characters.`,
    );
  }
  if (review.source !== "tutor_generated") {
    throw new ReviewQueueError(
      "invalid_source",
      "This provisional queue accepts only tutor-generated reviews.",
    );
  }
  if (!isOneOf(review.kind, REVIEW_KINDS)) {
    throw new ReviewQueueError("invalid_kind", "Review kind is not supported.");
  }
  if (!isOneOf(review.priority, REVIEW_PRIORITIES)) {
    throw new ReviewQueueError(
      "invalid_priority",
      "Review priority is not supported.",
    );
  }
  if (review.state !== "pending" && review.state !== "completed") {
    throw new ReviewQueueError(
      "invalid_state",
      "Review state must be pending or completed.",
    );
  }
  assertCalendarDate(review.createdDate);
  assertCalendarDate(review.scheduledDate);
  if (
    !Number.isInteger(review.estimatedMinutes) ||
    review.estimatedMinutes < 1 ||
    review.estimatedMinutes > MAX_REVIEW_MINUTES
  ) {
    throw new ReviewQueueError(
      "invalid_estimate",
      `Estimated review duration must be a whole number from 1-${MAX_REVIEW_MINUTES} minutes.`,
    );
  }
  if (!Array.isArray(review.deferrals)) {
    throw new ReviewQueueError(
      "invalid_deferral",
      "Review deferrals must be an array.",
    );
  }
  for (const deferral of review.deferrals) {
    assertDeferral(deferral);
  }
}

function assertDeferral(deferral: ReviewDeferral): void {
  assertCalendarDate(deferral.recordedOn);
  assertCalendarDate(deferral.fromDate);
  assertCalendarDate(deferral.toDate);
  if (deferral.toDate <= deferral.fromDate) {
    throw new ReviewQueueError(
      "invalid_deferral",
      "A deferred review must move to a later calendar date.",
    );
  }
  if (!isOneOf(deferral.reason, REVIEW_DEFERRAL_REASONS)) {
    throw new ReviewQueueError(
      "invalid_deferral",
      "Review deferral reason is not supported.",
    );
  }
  if (
    deferral.actor !== "student" &&
    deferral.actor !== "parent" &&
    deferral.actor !== "system"
  ) {
    throw new ReviewQueueError(
      "invalid_deferral",
      "Review deferral actor is not supported.",
    );
  }
}

function assertLimits(maxItems: number, maxMinutes: number): void {
  if (!Number.isInteger(maxItems) || maxItems < 0) {
    throw new ReviewQueueError(
      "invalid_limit",
      "Daily review item limit must be a non-negative whole number.",
    );
  }
  if (!Number.isInteger(maxMinutes) || maxMinutes < 0) {
    throw new ReviewQueueError(
      "invalid_limit",
      "Daily review minute limit must be a non-negative whole number.",
    );
  }
}

function compareReviews(a: ReviewItem, b: ReviewItem): number {
  return (
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    a.scheduledDate.localeCompare(b.scheduledDate) ||
    a.reviewRef.localeCompare(b.reviewRef)
  );
}

function scheduledEvidence(
  review: ReviewItem,
  timing: Exclude<ReviewTiming, "future">,
): readonly string[] {
  return [
    `Tutor-set priority: ${review.priority}.`,
    timing === "overdue"
      ? `Scheduled date ${review.scheduledDate} is before today's plan.`
      : `Scheduled date ${review.scheduledDate} matches today's plan.`,
    `Estimated duration: ${review.estimatedMinutes} minutes.`,
  ];
}

function queueMessage(timing: Exclude<ReviewTiming, "future">): string {
  return timing === "overdue"
    ? "This review is still ready when you are."
    : "Here is a quick review to help this skill stay strong.";
}

function capacityHold(
  review: ReviewItem,
  timing: Exclude<ReviewTiming, "future">,
  reason: CapacityHeldReview["reason"],
  heldBehindReviewRef?: string,
): CapacityHeldReview {
  const parentEvidence =
    reason === "daily_item_limit"
      ? "Held because the agreed daily review item limit was reached."
      : reason === "daily_minute_limit"
        ? "Held because this review would exceed the agreed daily review minute limit."
        : `Held to preserve priority after ${heldBehindReviewRef ?? "an earlier review"} could not fit.`;

  return {
    review,
    timing,
    reason,
    ...(heldBehindReviewRef ? { heldBehindReviewRef } : {}),
    parentEvidence,
    studentMessage:
      "This can wait for a later plan so today's review stays manageable.",
  };
}

export function createReviewItem(
  input: CreateReviewItemInput,
): ReviewItem {
  const review: ReviewItem = {
    schemaVersion: "provisional-review-item.v1",
    reviewRef: input.reviewRef,
    skillRef: input.skillRef,
    title: input.title,
    source: input.source,
    kind: input.kind,
    priority: input.priority,
    createdDate: input.createdDate,
    scheduledDate: input.scheduledDate,
    estimatedMinutes: input.estimatedMinutes,
    state: input.state ?? "pending",
    deferrals: [],
  };
  assertReviewItem(review);
  return review;
}

/**
 * Uses calendar dates rather than local-midnight Date objects, so classification
 * cannot shift when the host process runs in a different time zone.
 */
export function classifyReviewTiming(
  scheduledDate: string,
  planningDate: string,
): ReviewTiming {
  assertCalendarDate(scheduledDate);
  assertCalendarDate(planningDate);
  if (scheduledDate === planningDate) {
    return "same_day";
  }
  return scheduledDate < planningDate ? "overdue" : "future";
}

/**
 * Returns a new review item. No storage, calendar, or notification side effect
 * occurs here.
 */
export function deferReview(
  review: ReviewItem,
  input: DeferReviewInput,
): ReviewItem {
  assertReviewItem(review);
  if (review.state === "completed") {
    throw new ReviewQueueError(
      "completed_review",
      "A completed review cannot be deferred.",
    );
  }
  assertCalendarDate(input.recordedOn);
  assertCalendarDate(input.resumeDate);
  if (!isOneOf(input.reason, REVIEW_DEFERRAL_REASONS)) {
    throw new ReviewQueueError(
      "invalid_deferral",
      "Review deferral reason is not supported.",
    );
  }
  if (
    input.actor !== "student" &&
    input.actor !== "parent" &&
    input.actor !== "system"
  ) {
    throw new ReviewQueueError(
      "invalid_deferral",
      "Review deferral actor is not supported.",
    );
  }
  if (
    input.resumeDate <= review.scheduledDate ||
    input.resumeDate <= input.recordedOn
  ) {
    throw new ReviewQueueError(
      "invalid_deferral",
      "A deferral resume date must be later than both the current scheduled date and the recorded date.",
    );
  }

  const deferral: ReviewDeferral = {
    recordedOn: input.recordedOn,
    fromDate: review.scheduledDate,
    toDate: input.resumeDate,
    reason: input.reason,
    actor: input.actor,
  };

  return {
    ...review,
    scheduledDate: input.resumeDate,
    deferrals: [...review.deferrals, deferral],
  };
}

/**
 * Builds a daily view without mutating review items. Explicit priority is
 * authoritative; date and opaque reference provide deterministic tie-breaks.
 * Once a due item cannot fit, later items are held instead of leapfrogging it.
 */
export function buildDailyReviewQueue(
  input: BuildDailyReviewQueueInput,
): DailyReviewQueue {
  assertCalendarDate(input.planningDate);
  assertLimits(input.limits.maxItems, input.limits.maxMinutes);

  const seenRefs = new Set<string>();
  for (const review of input.reviews) {
    assertReviewItem(review);
    if (seenRefs.has(review.reviewRef)) {
      throw new ReviewQueueError(
        "duplicate_review_ref",
        `Duplicate review reference: ${review.reviewRef}.`,
      );
    }
    seenRefs.add(review.reviewRef);
  }

  const pending = input.reviews.filter(({ state }) => state === "pending");
  const completedExcludedReviewRefs = input.reviews
    .filter(({ state }) => state === "completed")
    .map(({ reviewRef }) => reviewRef)
    .sort((a, b) => a.localeCompare(b));
  const due = pending
    .filter(
      ({ scheduledDate }) =>
        classifyReviewTiming(scheduledDate, input.planningDate) !== "future",
    )
    .sort(compareReviews);
  const upcoming = pending
    .filter(
      ({ scheduledDate }) =>
        classifyReviewTiming(scheduledDate, input.planningDate) === "future",
    )
    .sort(
      (a, b) =>
        a.scheduledDate.localeCompare(b.scheduledDate) || compareReviews(a, b),
    )
    .map((review) => ({ review, timing: "future" as const }));

  const scheduled: ScheduledReview[] = [];
  const capacityHeld: CapacityHeldReview[] = [];
  let scheduledMinutes = 0;
  let firstMinuteBlockedRef: string | undefined;
  let itemLimitReached = false;

  for (const review of due) {
    const timing = classifyReviewTiming(
      review.scheduledDate,
      input.planningDate,
    ) as Exclude<ReviewTiming, "future">;

    if (itemLimitReached) {
      capacityHeld.push(
        capacityHold(review, timing, "daily_item_limit"),
      );
      continue;
    }
    if (firstMinuteBlockedRef) {
      capacityHeld.push(
        capacityHold(
          review,
          timing,
          "priority_preserved",
          firstMinuteBlockedRef,
        ),
      );
      continue;
    }
    if (scheduled.length >= input.limits.maxItems) {
      itemLimitReached = true;
      capacityHeld.push(
        capacityHold(review, timing, "daily_item_limit"),
      );
      continue;
    }
    if (
      scheduledMinutes + review.estimatedMinutes >
      input.limits.maxMinutes
    ) {
      firstMinuteBlockedRef = review.reviewRef;
      capacityHeld.push(
        capacityHold(review, timing, "daily_minute_limit"),
      );
      continue;
    }

    scheduledMinutes += review.estimatedMinutes;
    scheduled.push({
      review,
      timing,
      queuePosition: scheduled.length + 1,
      evidence: scheduledEvidence(review, timing),
      studentMessage: queueMessage(timing),
    });
  }

  const overloadAvoided = capacityHeld.length > 0;
  const evidence = [
    `Daily limit: ${input.limits.maxItems} reviews and ${input.limits.maxMinutes} minutes.`,
    `Scheduled: ${scheduled.length} reviews totaling ${scheduledMinutes} minutes.`,
    overloadAvoided
      ? `Held ${capacityHeld.length} due reviews to stay within the limit and preserve priority.`
      : "All due reviews fit within the agreed limit.",
  ] as const;

  return {
    schemaVersion: "provisional-daily-review-queue.v1",
    planningDate: input.planningDate,
    limits: { ...input.limits },
    scheduled,
    upcoming,
    capacityHeld,
    completedExcludedReviewRefs,
    summary: {
      dueCount: due.length,
      scheduledCount: scheduled.length,
      scheduledMinutes,
      capacityHeldCount: capacityHeld.length,
      upcomingCount: upcoming.length,
      completedExcludedCount: completedExcludedReviewRefs.length,
      overloadAvoided,
      evidence,
    },
  };
}
