import { describe, expect, it } from "vitest";

import { scheduleNextReview } from "../../../engine/review/review-scheduler";
import type { RetrievalEvidence } from "../../../engine/review/types";

const evidence: RetrievalEvidence = {
  retrievalAccuracy: 0.8,
  independence: 0.7,
  confidence: 0.5,
  consecutiveSuccessfulRetrievals: 1,
  retrievalFailed: false,
  prerequisiteGap: false,
  reteachingOutcome: "not_needed",
};

function inputWithEvidence(candidate: RetrievalEvidence) {
  return {
    reviewedOn: "2026-05-01",
    state: { lastBaselineIndex: 2 },
    evidence: candidate,
  } as const;
}

describe("review scheduler boundaries", () => {
  it("accepts exact success thresholds", () => {
    const result = scheduleNextReview(inputWithEvidence(evidence));
    expect(result.baselineIndex).toBe(3);
    expect(result.cadenceAction).toBe("advance");
  });

  it("does not advance just below an accuracy threshold", () => {
    const result = scheduleNextReview(
      inputWithEvidence({ ...evidence, retrievalAccuracy: 0.799_999 }),
    );
    expect(result.baselineIndex).toBe(2);
    expect(result.cadenceAction).toBe("hold");
  });

  it("does not advance just below an independence threshold", () => {
    const result = scheduleNextReview(
      inputWithEvidence({ ...evidence, independence: 0.699_999 }),
    );
    expect(result.baselineIndex).toBe(2);
    expect(result.cadenceAction).toBe("hold");
  });

  it.each([
    { field: "retrievalAccuracy", value: -0.001 },
    { field: "retrievalAccuracy", value: 1.001 },
    { field: "retrievalAccuracy", value: Number.NaN },
    { field: "independence", value: Number.POSITIVE_INFINITY },
    { field: "confidence", value: -1 },
  ] as const)("rejects invalid $field value $value", ({ field, value }) => {
    expect(() =>
      scheduleNextReview(
        inputWithEvidence({ ...evidence, [field]: value }),
      ),
    ).toThrow(RangeError);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid success counts: %s",
    (value) => {
      expect(() =>
        scheduleNextReview(
          inputWithEvidence({
            ...evidence,
            consecutiveSuccessfulRetrievals: value,
          }),
        ),
      ).toThrow(RangeError);
    },
  );

  it.each([-2, 6, 1.5, Number.NaN])(
    "rejects invalid baseline indexes: %s",
    (lastBaselineIndex) => {
      expect(() =>
        scheduleNextReview({
          reviewedOn: "2026-05-01",
          state: { lastBaselineIndex },
        }),
      ).toThrow(RangeError);
    },
  );

  it.each([
    { startingSequenceDays: [] },
    { startingSequenceDays: [1, 3, 7] },
    { startingSequenceDays: [0, 1, 1, 3] },
    { startingSequenceDays: [0, 1.5, 3] },
    { startingSequenceDays: [0, -1, 3] },
    { maximumIntervalDays: 29 },
    { maximumExtensionFactor: 0.99 },
    { maximumExtensionFactor: 1.51 },
    { successAccuracyThreshold: -0.1 },
    { strongAccuracyThreshold: 0.7, successAccuracyThreshold: 0.8 },
    {
      strongIndependenceThreshold: 0.6,
      successIndependenceThreshold: 0.7,
    },
    { lowConfidenceThreshold: 0.8, highConfidenceThreshold: 0.8 },
  ])("rejects unsafe scheduler config %#", (config) => {
    expect(() =>
      scheduleNextReview({
        reviewedOn: "2026-05-01",
        state: { lastBaselineIndex: -1 },
        config,
      }),
    ).toThrow();
  });
});
