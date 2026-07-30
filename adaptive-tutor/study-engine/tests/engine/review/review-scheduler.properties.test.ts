import { describe, expect, it } from "vitest";

import { calendarDaysBetween } from "../../../engine/review/calendar-date";
import { scheduleNextReview } from "../../../engine/review/review-scheduler";
import type { RetrievalEvidence } from "../../../engine/review/types";

const scores = [0, 0.3, 0.6, 0.8, 0.9, 1] as const;

function evidence(
  retrievalAccuracy: number,
  independence: number,
  retrievalFailed: boolean,
): RetrievalEvidence {
  return {
    retrievalAccuracy,
    independence,
    confidence: 0.75,
    consecutiveSuccessfulRetrievals: retrievalFailed ? 0 : 3,
    retrievalFailed,
    prerequisiteGap: false,
    reteachingOutcome: "not_needed",
  };
}

describe("review scheduler bounded property checks", () => {
  it("always returns a valid bounded interval and matching due date", () => {
    for (let baselineIndex = -1; baselineIndex <= 5; baselineIndex += 1) {
      for (const accuracy of scores) {
        for (const independence of scores) {
          for (const failed of [false, true]) {
            const result = scheduleNextReview({
              reviewedOn: "2026-02-20",
              state: { lastBaselineIndex: baselineIndex },
              evidence: evidence(accuracy, independence, failed),
            });

            expect(result.intervalDays).toBeGreaterThanOrEqual(0);
            expect(result.intervalDays).toBeLessThanOrEqual(180);
            expect(result.baselineIndex).toBeGreaterThanOrEqual(0);
            expect(result.baselineIndex).toBeLessThanOrEqual(5);
            expect(
              calendarDaysBetween(result.reviewedOn, result.dueOn),
            ).toBe(result.intervalDays);
            expect(Number.isSafeInteger(result.intervalDays)).toBe(true);
          }
        }
      }
    }
  });

  it("never extends a review when explicit retrieval failure is present", () => {
    for (let baselineIndex = 0; baselineIndex <= 5; baselineIndex += 1) {
      for (const accuracy of scores) {
        for (const independence of scores) {
          const result = scheduleNextReview({
            reviewedOn: "2026-02-20",
            state: { lastBaselineIndex: baselineIndex },
            evidence: evidence(accuracy, independence, true),
          });

          expect(result.intervalDays).toBe(0);
          expect(result.intervalAdjustment).toBe("same_day");
          expect(result.reasons).not.toContain("retrieval_success");
        }
      }
    }
  });

  it("keeps strong-evidence extensions within the default conservative cap", () => {
    for (let baselineIndex = 0; baselineIndex <= 5; baselineIndex += 1) {
      const result = scheduleNextReview({
        reviewedOn: "2026-02-20",
        state: { lastBaselineIndex: baselineIndex },
        evidence: {
          ...evidence(1, 1, false),
          confidence: 1,
          consecutiveSuccessfulRetrievals: 100,
        },
      });

      expect(result.intervalDays).toBeLessThanOrEqual(
        Math.ceil(result.baselineIntervalDays * 1.2),
      );
    }
  });

  it("treats a prerequisite gap as dominant over every score combination", () => {
    for (const accuracy of scores) {
      for (const independence of scores) {
        const result = scheduleNextReview({
          reviewedOn: "2026-02-20",
          state: { lastBaselineIndex: 4 },
          evidence: {
            ...evidence(accuracy, independence, false),
            prerequisiteGap: true,
          },
        });

        expect(result.intervalDays).toBe(0);
        expect(result.preparation).toBe(
          "address_prerequisite_before_retrieval",
        );
      }
    }
  });
});
