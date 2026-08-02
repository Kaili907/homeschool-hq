import { describe, expect, it } from "vitest";

import {
  createStartingReviewPlan,
  scheduleNextReview,
} from "../../../engine/review/review-scheduler";
import {
  REVIEW_SCHEDULE_GUIDANCE,
  REVIEW_STARTING_SEQUENCE_DAYS,
  type RetrievalEvidence,
} from "../../../engine/review/types";

const strongRetrieval: RetrievalEvidence = {
  retrievalAccuracy: 0.95,
  independence: 0.9,
  confidence: 0.85,
  consecutiveSuccessfulRetrievals: 3,
  retrievalFailed: false,
  prerequisiteGap: false,
  reteachingOutcome: "not_needed",
};

describe("createStartingReviewPlan", () => {
  it("creates the same-day, 1, 3, 7, 14, and 30 day starting sequence", () => {
    const plan = createStartingReviewPlan("2026-01-30");

    expect(plan.map((review) => review.intervalDays)).toEqual([
      ...REVIEW_STARTING_SEQUENCE_DAYS,
    ]);
    expect(plan.map((review) => review.dueOn)).toEqual([
      "2026-01-30",
      "2026-01-31",
      "2026-02-02",
      "2026-02-06",
      "2026-02-13",
      "2026-03-01",
    ]);
  });

  it("supports a configured starting sequence", () => {
    expect(
      createStartingReviewPlan("2026-02-01", {
        startingSequenceDays: [0, 2, 5, 12],
        maximumIntervalDays: 90,
      }),
    ).toEqual([
      { baselineIndex: 0, intervalDays: 0, dueOn: "2026-02-01" },
      { baselineIndex: 1, intervalDays: 2, dueOn: "2026-02-03" },
      { baselineIndex: 2, intervalDays: 5, dueOn: "2026-02-06" },
      { baselineIndex: 3, intervalDays: 12, dueOn: "2026-02-13" },
    ]);
  });
});

describe("scheduleNextReview", () => {
  it("starts with a same-day retrieval when no evidence exists yet", () => {
    const result = scheduleNextReview({
      reviewedOn: "2026-04-10",
      state: { lastBaselineIndex: -1 },
    });

    expect(result).toMatchObject({
      dueOn: "2026-04-10",
      intervalDays: 0,
      baselineIntervalDays: 0,
      baselineIndex: 0,
      cadenceAction: "start",
      intervalAdjustment: "same_day",
      preparation: "none",
      reasons: ["starting_sequence"],
      nextState: { lastBaselineIndex: 0 },
    });
  });

  it("advances one baseline step after a successful independent retrieval", () => {
    const result = scheduleNextReview({
      reviewedOn: "2026-04-10",
      state: { lastBaselineIndex: 0 },
      evidence: strongRetrieval,
    });

    expect(result.baselineIndex).toBe(1);
    expect(result.baselineIntervalDays).toBe(1);
    expect(result.intervalDays).toBe(1);
    expect(result.dueOn).toBe("2026-04-11");
    expect(result.cadenceAction).toBe("advance");
    expect(result.reasons).toContain("retrieval_success");
    expect(result.reasons).toContain("repeated_retrieval_success");
  });

  it("allows only a modest extension after repeated strong retrieval", () => {
    const result = scheduleNextReview({
      reviewedOn: "2026-04-10",
      state: { lastBaselineIndex: 2 },
      evidence: strongRetrieval,
    });

    expect(result.baselineIntervalDays).toBe(7);
    expect(result.intervalDays).toBe(8);
    expect(result.intervalAdjustment).toBe("modestly_extended");
    expect(result.dueOn).toBe("2026-04-18");
  });

  it("does not let high confidence advance without accuracy and independence", () => {
    const result = scheduleNextReview({
      reviewedOn: "2026-04-10",
      state: { lastBaselineIndex: 3 },
      evidence: {
        ...strongRetrieval,
        retrievalAccuracy: null,
        independence: null,
        confidence: 1,
      },
    });

    expect(result.baselineIndex).toBe(3);
    expect(result.intervalDays).toBe(7);
    expect(result.cadenceAction).toBe("hold");
    expect(result.reasons).toContain("insufficient_retrieval_evidence");
    expect(result.reasons).not.toContain(
      "high_confidence_supports_small_extension",
    );
  });

  it("shortens and prepares reteaching after retrieval failure", () => {
    const result = scheduleNextReview({
      reviewedOn: "2026-04-10",
      state: { lastBaselineIndex: 4 },
      evidence: {
        ...strongRetrieval,
        retrievalAccuracy: 0.3,
        independence: 0.4,
        confidence: 0.2,
        consecutiveSuccessfulRetrievals: 0,
        retrievalFailed: true,
      },
    });

    expect(result).toMatchObject({
      baselineIndex: 3,
      baselineIntervalDays: 7,
      intervalDays: 0,
      dueOn: "2026-04-10",
      cadenceAction: "shorten",
      intervalAdjustment: "same_day",
      preparation: "reteach_before_retrieval",
    });
    expect(result.reasons).toContain("retrieval_failure");
  });

  it("puts prerequisite support ahead of another retrieval", () => {
    const result = scheduleNextReview({
      reviewedOn: "2026-04-10",
      state: { lastBaselineIndex: 3 },
      evidence: {
        ...strongRetrieval,
        prerequisiteGap: true,
      },
    });

    expect(result.intervalDays).toBe(0);
    expect(result.preparation).toBe(
      "address_prerequisite_before_retrieval",
    );
    expect(result.reasons).toContain("prerequisite_gap");
    expect(result.reasons).toContain(
      "conflicting_evidence_resolved_conservatively",
    );
  });

  it("resolves optimistic and failure signals conservatively", () => {
    const result = scheduleNextReview({
      reviewedOn: "2026-04-10",
      state: { lastBaselineIndex: 5 },
      evidence: {
        ...strongRetrieval,
        retrievalAccuracy: 1,
        independence: 1,
        confidence: 1,
        consecutiveSuccessfulRetrievals: 8,
        retrievalFailed: true,
      },
    });

    expect(result.baselineIndex).toBe(4);
    expect(result.intervalDays).toBe(0);
    expect(result.reasons[0]).toBe(
      "conflicting_evidence_resolved_conservatively",
    );
    expect(result.reasons).not.toContain("retrieval_success");
  });

  it("holds the baseline but shortens timing for partial evidence", () => {
    const result = scheduleNextReview({
      reviewedOn: "2026-04-10",
      state: { lastBaselineIndex: 3 },
      evidence: {
        ...strongRetrieval,
        retrievalAccuracy: 0.7,
        independence: 0.65,
        confidence: 0.5,
        consecutiveSuccessfulRetrievals: 0,
      },
    });

    expect(result.baselineIndex).toBe(3);
    expect(result.cadenceAction).toBe("hold");
    expect(result.intervalDays).toBe(4);
    expect(result.intervalAdjustment).toBe("shortened");
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "low_retrieval_accuracy",
        "limited_independence",
      ]),
    );
  });

  it("reconsolidates sooner even after successful reteaching", () => {
    const result = scheduleNextReview({
      reviewedOn: "2026-04-10",
      state: { lastBaselineIndex: 3 },
      evidence: {
        ...strongRetrieval,
        reteachingOutcome: "successful",
      },
    });

    expect(result.baselineIndex).toBe(4);
    expect(result.baselineIntervalDays).toBe(14);
    expect(result.intervalDays).toBe(12);
    expect(result.intervalAdjustment).toBe("shortened");
    expect(result.reasons).toContain(
      "reteaching_success_needs_reconsolidation",
    );
  });

  it("applies a configured maximum interval", () => {
    const result = scheduleNextReview({
      reviewedOn: "2026-04-10",
      state: { lastBaselineIndex: 5 },
      evidence: strongRetrieval,
      config: { maximumIntervalDays: 32 },
    });

    expect(result.intervalDays).toBe(32);
    expect(result.intervalAdjustment).toBe("capped");
    expect(result.reasons).toContain("maximum_interval_cap_applied");
  });

  it("applies a configured extension-factor cap", () => {
    const result = scheduleNextReview({
      reviewedOn: "2026-04-10",
      state: { lastBaselineIndex: 5 },
      evidence: strongRetrieval,
      config: {
        maximumIntervalDays: 90,
        maximumExtensionFactor: 1.05,
      },
    });

    expect(result.intervalDays).toBe(32);
    expect(result.intervalAdjustment).toBe("capped");
    expect(result.reasons).toContain("maximum_extension_cap_applied");
  });

  it("returns the exact safety guidance on every recommendation", () => {
    const result = scheduleNextReview({
      reviewedOn: "2026-04-10",
      state: { lastBaselineIndex: -1 },
    });

    expect(result.guidance).toBe(REVIEW_SCHEDULE_GUIDANCE);
    expect(result.guidance).toContain("configurable");
    expect(result.guidance).toContain("not a claim");
    expect(result.guidance).toContain("every learner");
    expect(result.guidance.toLowerCase()).not.toMatch(
      /guaranteed|works for everyone|the optimal schedule/,
    );
  });

  it("is deterministic for the same fixture", () => {
    const fixture = {
      reviewedOn: "2026-04-10",
      state: { lastBaselineIndex: 3 },
      evidence: strongRetrieval,
    } as const;

    expect(scheduleNextReview(fixture)).toEqual(scheduleNextReview(fixture));
  });

  it("does not echo unexpected identifying input fields", () => {
    const result = scheduleNextReview({
      reviewedOn: "2026-04-10",
      state: { lastBaselineIndex: 0 },
      evidence: strongRetrieval,
      studentName: "Sensitive Student Name",
      learnerId: "private-123",
    } as Parameters<typeof scheduleNextReview>[0] & {
      studentName: string;
      learnerId: string;
    });

    expect(JSON.stringify(result)).not.toContain("Sensitive Student Name");
    expect(JSON.stringify(result)).not.toContain("private-123");
  });
});
