import { describe, expect, it } from "vitest";

import { scheduleInterleavedPractice } from "../../../engine/interleaving/interleaving-scheduler";
import type { PracticeSkillEvidence } from "../../../engine/interleaving/types";

const target: PracticeSkillEvidence = {
  skillId: "target",
  difficulty: 3,
  prerequisiteReady: true,
  independentAttempts: 8,
  independentAccuracy: 0.85,
  mastery: 0.85,
  previouslyMastered: false,
};

const review: PracticeSkillEvidence = {
  skillId: "review",
  difficulty: 2.5,
  prerequisiteReady: true,
  independentAttempts: 3,
  independentAccuracy: 0.8,
  mastery: 0.85,
  previouslyMastered: true,
};

describe("interleaving scheduler boundaries", () => {
  it("accepts exact transition, mixed, and review thresholds", () => {
    const result = scheduleInterleavedPractice({
      target,
      reviewCandidates: [review],
      itemCount: 6,
    });
    expect(result.mode).toBe("mixed");
    expect(result.selectedReviewSkillIds).toEqual(["review"]);
  });

  it.each([
    {
      targetPatch: { independentAttempts: 4 },
      reason: "insufficient_independent_attempts",
    },
    {
      targetPatch: { independentAccuracy: 0.749_999 },
      reason: "independent_accuracy_below_transition_threshold",
    },
    {
      targetPatch: { mastery: 0.699_999 },
      reason: "target_mastery_below_transition_threshold",
    },
  ] as const)("blocks just below readiness: $reason", ({ targetPatch, reason }) => {
    const result = scheduleInterleavedPractice({
      target: { ...target, ...targetPatch },
      reviewCandidates: [review],
      itemCount: 6,
    });
    expect(result.mode).toBe("blocked");
    expect(result.reasons).toContain(reason);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid itemCount %s",
    (itemCount) => {
      expect(() =>
        scheduleInterleavedPractice({
          target,
          reviewCandidates: [review],
          itemCount,
        }),
      ).toThrow(RangeError);
    },
  );

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid rotationOffset %s",
    (rotationOffset) => {
      expect(() =>
        scheduleInterleavedPractice({
          target,
          reviewCandidates: [review],
          itemCount: 6,
          rotationOffset,
        }),
      ).toThrow(RangeError);
    },
  );

  it.each([
    { patch: { skillId: "" }, label: "empty id" },
    { patch: { difficulty: 0.99 }, label: "low difficulty" },
    { patch: { difficulty: 5.01 }, label: "high difficulty" },
    { patch: { independentAttempts: -1 }, label: "negative attempts" },
    { patch: { independentAttempts: 1.5 }, label: "fractional attempts" },
    { patch: { independentAccuracy: -0.01 }, label: "low accuracy" },
    { patch: { independentAccuracy: 1.01 }, label: "high accuracy" },
    { patch: { mastery: Number.NaN }, label: "NaN mastery" },
  ])("rejects invalid target evidence: $label", ({ patch }) => {
    expect(() =>
      scheduleInterleavedPractice({
        target: { ...target, ...patch } as PracticeSkillEvidence,
        reviewCandidates: [review],
        itemCount: 6,
      }),
    ).toThrow();
  });

  it.each([
    { maximumSkillsPerSet: 1 },
    { maximumContextSwitches: -1 },
    { maximumContextSwitches: 1.5 },
    { minimumBlockedAttempts: -1 },
    { minimumTransitionAccuracy: -0.1 },
    { maximumDifficultyDifference: -0.1 },
    { maximumDifficultyDifference: 4.1 },
    { transitionReviewShare: 0 },
    { transitionReviewShare: 0.5 },
    { mixedReviewShare: 0.5 },
    { transitionReviewShare: 0.4, mixedReviewShare: 0.3 },
    { minimumBlockedAttempts: 6, minimumMixedAttempts: 5 },
    { minimumTransitionAccuracy: 0.8, minimumMixedAccuracy: 0.7 },
    { minimumTransitionMastery: 0.8, minimumMixedMastery: 0.7 },
  ])("rejects unsafe config %#", (config) => {
    expect(() =>
      scheduleInterleavedPractice({
        target,
        reviewCandidates: [review],
        itemCount: 6,
        config,
      }),
    ).toThrow();
  });

  it("withholds duplicate candidate IDs deterministically", () => {
    const result = scheduleInterleavedPractice({
      target,
      reviewCandidates: [review, { ...review }],
      itemCount: 6,
    });

    expect(result.selectedReviewSkillIds).toEqual(["review"]);
    expect(result.withheldReviewCandidates).toContainEqual({
      skillId: "review",
      reason: "duplicate_skill_id",
    });
  });
});
