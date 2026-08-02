import { describe, expect, it } from "vitest";
import {
  buildDailyReviewQueue,
  classifyReviewTiming,
  createMockReviewQueueDemo,
  createReviewItem,
  deferReview,
  ReviewQueueError,
  type CreateReviewItemInput,
  type ReviewItem,
} from "../../integrations/review/index.js";

const planningDate = "2026-07-28";

function review(
  overrides: Partial<CreateReviewItemInput> = {},
): ReviewItem {
  return createReviewItem({
    reviewRef: "review-default",
    skillRef: "skill-default",
    title: "A quick skill review",
    source: "tutor_generated",
    kind: "review",
    priority: "normal",
    createdDate: planningDate,
    scheduledDate: planningDate,
    estimatedMinutes: 5,
    ...overrides,
  });
}

describe("provisional review queue", () => {
  it("demonstrates tutor-generated same-day, future, overdue, reteaching, and prerequisite work", () => {
    const demo = createMockReviewQueueDemo();

    expect(
      demo.queue.scheduled.map(({ review, timing }) => ({
        reviewRef: review.reviewRef,
        source: review.source,
        kind: review.kind,
        timing,
      })),
    ).toEqual([
      {
        reviewRef: "review-fractions-reteach",
        source: "tutor_generated",
        kind: "reteaching",
        timing: "overdue",
      },
      {
        reviewRef: "review-multiplication-prerequisite",
        source: "tutor_generated",
        kind: "prerequisite_remediation",
        timing: "same_day",
      },
    ]);
    expect(
      demo.queue.upcoming.map(({ review, timing }) => ({
        reviewRef: review.reviewRef,
        timing,
      })),
    ).toEqual([
      { reviewRef: "review-reading-deferred", timing: "future" },
      { reviewRef: "review-decimals-future", timing: "future" },
    ]);
    expect(demo.deferralDemonstration.recordedDeferral).toMatchObject({
      fromDate: planningDate,
      toDate: "2026-07-30",
      reason: "student_request",
      actor: "student",
    });
  });

  it("classifies calendar dates without host-time-zone conversion", () => {
    expect(classifyReviewTiming(planningDate, planningDate)).toBe("same_day");
    expect(classifyReviewTiming("2026-07-27", planningDate)).toBe("overdue");
    expect(classifyReviewTiming("2026-07-29", planningDate)).toBe("future");
  });

  it("orders by explicit priority, then oldest scheduled date, then opaque ref", () => {
    const reviews = [
      review({
        reviewRef: "review-low-old",
        priority: "low",
        scheduledDate: "2026-07-20",
      }),
      review({
        reviewRef: "review-high-today",
        priority: "high",
      }),
      review({
        reviewRef: "review-high-old-b",
        priority: "high",
        scheduledDate: "2026-07-21",
      }),
      review({
        reviewRef: "review-high-old-a",
        priority: "high",
        scheduledDate: "2026-07-21",
      }),
      review({
        reviewRef: "review-urgent-today",
        priority: "urgent",
      }),
    ];

    const queue = buildDailyReviewQueue({
      planningDate,
      limits: { maxItems: 10, maxMinutes: 100 },
      reviews,
    });

    expect(queue.scheduled.map(({ review: item }) => item.reviewRef)).toEqual([
      "review-urgent-today",
      "review-high-old-a",
      "review-high-old-b",
      "review-high-today",
      "review-low-old",
    ]);
  });

  it("enforces the daily item limit and explains every held review", () => {
    const queue = buildDailyReviewQueue({
      planningDate,
      limits: { maxItems: 2, maxMinutes: 100 },
      reviews: [
        review({ reviewRef: "review-1", priority: "urgent" }),
        review({ reviewRef: "review-2", priority: "high" }),
        review({ reviewRef: "review-3", priority: "normal" }),
        review({ reviewRef: "review-4", priority: "low" }),
      ],
    });

    expect(queue.scheduled.map(({ review: item }) => item.reviewRef)).toEqual([
      "review-1",
      "review-2",
    ]);
    expect(queue.capacityHeld.map(({ reason }) => reason)).toEqual([
      "daily_item_limit",
      "daily_item_limit",
    ]);
    expect(queue.summary).toMatchObject({
      dueCount: 4,
      scheduledCount: 2,
      capacityHeldCount: 2,
      overloadAvoided: true,
    });
    expect(queue.capacityHeld.every(({ parentEvidence }) => parentEvidence))
      .toBe(true);
  });

  it("enforces the minute limit without letting short low-priority work leapfrog", () => {
    const queue = buildDailyReviewQueue({
      planningDate,
      limits: { maxItems: 5, maxMinutes: 20 },
      reviews: [
        review({
          reviewRef: "review-urgent",
          priority: "urgent",
          estimatedMinutes: 15,
        }),
        review({
          reviewRef: "review-high-too-long",
          priority: "high",
          estimatedMinutes: 10,
        }),
        review({
          reviewRef: "review-low-short",
          priority: "low",
          estimatedMinutes: 2,
        }),
      ],
    });

    expect(queue.scheduled.map(({ review: item }) => item.reviewRef)).toEqual([
      "review-urgent",
    ]);
    expect(queue.summary.scheduledMinutes).toBe(15);
    expect(queue.capacityHeld).toEqual([
      expect.objectContaining({
        review: expect.objectContaining({
          reviewRef: "review-high-too-long",
        }),
        reason: "daily_minute_limit",
      }),
      expect.objectContaining({
        review: expect.objectContaining({ reviewRef: "review-low-short" }),
        reason: "priority_preserved",
        heldBehindReviewRef: "review-high-too-long",
      }),
    ]);
  });

  it("defers immutably and records structured parent-visible evidence", () => {
    const original = review({
      reviewRef: "review-to-defer",
      scheduledDate: "2026-07-27",
    });
    const deferred = deferReview(original, {
      recordedOn: planningDate,
      resumeDate: "2026-07-30",
      reason: "parent_adjustment",
      actor: "parent",
    });

    expect(original.scheduledDate).toBe("2026-07-27");
    expect(original.deferrals).toEqual([]);
    expect(deferred.scheduledDate).toBe("2026-07-30");
    expect(deferred.deferrals).toEqual([
      {
        recordedOn: planningDate,
        fromDate: "2026-07-27",
        toDate: "2026-07-30",
        reason: "parent_adjustment",
        actor: "parent",
      },
    ]);
  });

  it("rejects backwards deferrals and deferrals of completed reviews", () => {
    const pending = review({ reviewRef: "review-pending" });
    expect(() =>
      deferReview(pending, {
        recordedOn: planningDate,
        resumeDate: planningDate,
        reason: "schedule_conflict",
        actor: "parent",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ReviewQueueError>>({
        code: "invalid_deferral",
      }),
    );

    const completed = review({
      reviewRef: "review-completed",
      state: "completed",
    });
    expect(() =>
      deferReview(completed, {
        recordedOn: planningDate,
        resumeDate: "2026-07-29",
        reason: "schedule_conflict",
        actor: "parent",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ReviewQueueError>>({
        code: "completed_review",
      }),
    );
  });

  it("excludes completed work and rejects duplicate queue entries", () => {
    const completed = review({
      reviewRef: "review-completed",
      state: "completed",
    });
    const queue = buildDailyReviewQueue({
      planningDate,
      limits: { maxItems: 3, maxMinutes: 30 },
      reviews: [completed],
    });
    expect(queue.completedExcludedReviewRefs).toEqual(["review-completed"]);
    expect(queue.scheduled).toEqual([]);

    const duplicate = review({ reviewRef: "review-duplicate" });
    expect(() =>
      buildDailyReviewQueue({
        planningDate,
        limits: { maxItems: 3, maxMinutes: 30 },
        reviews: [duplicate, duplicate],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ReviewQueueError>>({
        code: "duplicate_review_ref",
      }),
    );
  });

  it("is deterministic and keeps student language supportive", () => {
    const reviews = [
      review({ reviewRef: "review-b", priority: "high" }),
      review({ reviewRef: "review-a", priority: "high" }),
      review({ reviewRef: "review-c", priority: "low" }),
    ];
    const input = {
      planningDate,
      limits: { maxItems: 1, maxMinutes: 5 },
      reviews,
    } as const;

    const first = buildDailyReviewQueue(input);
    const second = buildDailyReviewQueue(input);
    expect(first).toStrictEqual(second);

    const serializedStudentMessages = JSON.stringify([
      ...first.scheduled.map(({ studentMessage }) => studentMessage),
      ...first.capacityHeld.map(({ studentMessage }) => studentMessage),
    ]);
    expect(serializedStudentMessages).not.toMatch(
      /failed|behind|attention span|diagnos|score/i,
    );
  });

  it("stores only minimal opaque queue references and structured evidence", () => {
    const serialized = JSON.stringify(createMockReviewQueueDemo());

    expect(serialized).not.toMatch(
      /studentName|email|birth|webcam|eye.?tracking|medical|diagnos|rawResponse|credential|password/i,
    );
    expect(serialized).toContain("skill-fraction-equivalence");
    expect(serialized).toContain("Daily limit:");
  });
});
