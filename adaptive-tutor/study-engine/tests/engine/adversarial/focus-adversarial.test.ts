import { describe, expect, it } from "vitest";

import {
  FOCUS_RECOMMENDATIONS,
  recommendFocusDuration,
  type FocusRecommendationInput,
  type FocusSessionEvidence,
  type GradeBand,
} from "../../../engine/focus/index.js";

const BASE_TIME = 1_800_000_000_000;

function session(
  index: number,
  overrides: Partial<FocusSessionEvidence> = {},
): FocusSessionEvidence {
  return {
    occurredAtEpochMs: BASE_TIME + index,
    subject: "mathematics",
    taskType: "independent-practice",
    plannedDurationMinutes: 30,
    completedDurationMinutes: 30,
    coreOutcome: "successful",
    durationResponse: "comfortable",
    disruption: "none",
    quality: "reliable",
    ...overrides,
  };
}

function sessions(
  count: number,
  overrides: readonly Partial<FocusSessionEvidence>[] = [],
): FocusSessionEvidence[] {
  return Array.from({ length: count }, (_, index) =>
    session(index, overrides[index]),
  );
}

function input(
  overrides: Partial<FocusRecommendationInput> = {},
): FocusRecommendationInput {
  return {
    gradeBand: "middle_school",
    subject: "mathematics",
    taskType: "independent-practice",
    currentDurationMinutes: 30,
    sessions: sessions(5),
    ...overrides,
  };
}

describe("adversarial focus recommendation validation", () => {
  it("never automates from fewer than five comparable sessions", () => {
    for (let count = 0; count < 5; count += 1) {
      const result = recommendFocusDuration(input({ sessions: sessions(count) }));

      expect(result.recommendation).toBe("insufficient_data");
      expect(result.adjustmentMinutes).toBe(0);
      expect(result.evidence.evaluatedComparableSessions).toBe(count);
    }
  });

  it("does not manufacture comparability from different subjects, tasks, or unusable sessions", () => {
    const hostileHistory = [
      ...sessions(4),
      session(10, { subject: "science" }),
      session(11, { taskType: "guided-practice" }),
      session(12, { disruption: "technical_issue" }),
      session(13, { disruption: "interruption" }),
      session(14, { quality: "limited" }),
      session(15, { plannedDurationMinutes: 300 }),
    ];

    const result = recommendFocusDuration(input({ sessions: hostileHistory }));

    expect(result.recommendation).toBe("insufficient_data");
    expect(result.evidence.evaluatedComparableSessions).toBe(4);
    expect(result.adjustmentMinutes).toBe(0);
  });

  it("holds at three successes out of five", () => {
    const result = recommendFocusDuration(
      input({
        sessions: sessions(5, [
          {},
          {},
          {},
          { coreOutcome: "not_successful" },
          { coreOutcome: "not_successful" },
        ]),
      }),
    );

    expect(result.recommendation).toBe("maintain");
    expect(result.evidence.successfulSessions).toBe(3);
    expect(result.adjustmentMinutes).toBe(0);
  });

  it("requires four successes out of five and no too-long response before increasing", () => {
    const fourOfFive = recommendFocusDuration(
      input({
        sessions: sessions(5, [
          {},
          {},
          {},
          {},
          { coreOutcome: "not_successful" },
        ]),
      }),
    );
    const tooLong = recommendFocusDuration(
      input({
        sessions: sessions(5, [
          {},
          {},
          {},
          {},
          { coreOutcome: "not_successful", durationResponse: "too_long" },
        ]),
      }),
    );

    expect(fourOfFive.recommendation).toBe("increase");
    expect(tooLong.recommendation).toBe("maintain");
  });

  it("respects ten-percent, grade-band, configured-cap, and parent-cap boundaries", () => {
    const gradeMaximum: Readonly<Record<GradeBand, number>> = {
      elementary: 2,
      middle_school: 3,
      high_school: 5,
    };

    for (const gradeBand of Object.keys(gradeMaximum) as GradeBand[]) {
      for (let duration = 1; duration <= 180; duration += 1) {
        const evidence = sessions(5).map((item) => ({
          ...item,
          plannedDurationMinutes: duration,
          completedDurationMinutes: duration,
        }));
        const result = recommendFocusDuration(
          input({
            gradeBand,
            currentDurationMinutes: duration,
            sessions: evidence,
          }),
        );

        expect(FOCUS_RECOMMENDATIONS).toContain(result.recommendation);
        if (result.recommendation === "increase") {
          expect(result.adjustmentMinutes).toBeGreaterThan(0);
          expect(result.adjustmentMinutes).toBeLessThanOrEqual(
            gradeMaximum[gradeBand],
          );
          expect(result.adjustmentMinutes / duration).toBeLessThanOrEqual(
            0.1 + Number.EPSILON,
          );
        } else {
          expect(result.adjustmentMinutes).toBeLessThanOrEqual(0);
        }
      }
    }

    const configuredCap = recommendFocusDuration(
      input({
        policy: { durationCapsMinutes: { middle_school: 31 } },
      }),
    );
    const parentCap = recommendFocusDuration(
      input({
        parentOverride: {
          mode: "automatic",
          maximumDurationMinutes: 31,
        },
      }),
    );

    expect(configuredCap.recommendedDurationMinutes).toBeLessThanOrEqual(31);
    expect(parentCap.recommendedDurationMinutes).toBeLessThanOrEqual(31);
  });

  it("honors every parent override without requiring favorable evidence", () => {
    const unfavorable = sessions(2, [
      { coreOutcome: "not_successful", durationResponse: "too_long" },
      { coreOutcome: "not_successful", durationResponse: "too_long" },
    ]);

    expect(
      recommendFocusDuration(
        input({
          sessions: unfavorable,
          parentOverride: { mode: "hold" },
        }),
      ),
    ).toMatchObject({
      recommendation: "maintain",
      recommendedDurationMinutes: 30,
      reasonCodes: ["parent_hold"],
    });
    expect(
      recommendFocusDuration(
        input({
          sessions: unfavorable,
          parentOverride: { mode: "reduce", targetDurationMinutes: 27 },
        }),
      ),
    ).toMatchObject({
      recommendation: "decrease",
      recommendedDurationMinutes: 27,
      reasonCodes: ["parent_requested_decrease"],
    });
    expect(
      recommendFocusDuration(
        input({
          parentOverride: { mode: "manual_review" },
        }),
      ),
    ).toMatchObject({
      recommendation: "manual_review",
      reasonCodes: ["parent_requested_review"],
    });
    expect(
      recommendFocusDuration(
        input({
          parentOverride: { mode: "automatic", allowIncrease: false },
        }),
      ),
    ).toMatchObject({
      recommendation: "maintain",
      reasonCodes: ["increase_disabled_by_parent"],
    });
  });

  it("routes invalid top-level and policy numbers to manual review with finite output", () => {
    const hostileInputs = [
      input({ currentDurationMinutes: Number.NaN }),
      input({ currentDurationMinutes: Number.POSITIVE_INFINITY }),
      input({ currentDurationMinutes: -1 }),
      input({ policy: { maximumIncreaseRatio: 0.100001 } }),
      input({ policy: { adjustmentGranularityMinutes: Number.NaN } }),
      { ...input(), sessions: null } as unknown as FocusRecommendationInput,
    ];

    for (const hostileInput of hostileInputs) {
      const result = recommendFocusDuration(hostileInput);
      expect(result.recommendation).toBe("manual_review");
      expect(result.reasonCodes).toEqual(["invalid_request"]);
      expect(Number.isFinite(result.currentDurationMinutes)).toBe(true);
      expect(Number.isFinite(result.recommendedDurationMinutes)).toBe(true);
      expect(Number.isFinite(result.adjustmentMinutes)).toBe(true);
    }
  });

  it("cannot turn malformed or non-comparable records into positive evidence", () => {
    const malformed = Array.from({ length: 50 }, (_, index) => ({
      ...session(index),
      occurredAtEpochMs: Number.NaN,
      studentEmail: `private-${index}@example.invalid`,
    })) as unknown as FocusSessionEvidence[];

    const result = recommendFocusDuration(input({ sessions: malformed }));
    const serialized = JSON.stringify(result);

    expect(result.recommendation).toBe("insufficient_data");
    expect(result.evidence.evaluatedComparableSessions).toBe(0);
    expect(serialized).not.toContain("private-");
    expect(serialized).not.toContain("studentEmail");
  });

  it("is deterministic under hostile replay and never emits diagnostic prose", () => {
    let seed = 0x51afe123;
    const random = (): number => {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    const generated = Array.from({ length: 75 }, (_, index) =>
      session(index, {
        subject: random() < 0.2 ? "science" : "mathematics",
        taskType:
          random() < 0.2 ? "guided-practice" : "independent-practice",
        coreOutcome: random() < 0.65 ? "successful" : "not_successful",
        durationResponse:
          random() < 0.15
            ? "too_long"
            : random() < 0.15
              ? "too_short"
              : "comfortable",
        disruption: random() < 0.1 ? "approved_break" : "none",
      }),
    );
    const hostileInput = input({
      sessions: generated,
      policy: { comparisonWindowSize: 20 },
    });

    const first = recommendFocusDuration(hostileInput);
    for (let iteration = 0; iteration < 50; iteration += 1) {
      expect(recommendFocusDuration(hostileInput)).toEqual(first);
    }

    expect(JSON.stringify(first)).not.toMatch(
      /adhd|diagnos|attention span|not paying attention|lazy|failed because/i,
    );
  });
});
