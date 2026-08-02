import { describe, expect, it } from "vitest";

import {
  countContextSwitches,
  scheduleInterleavedPractice,
} from "../../../engine/interleaving/interleaving-scheduler";
import {
  INTERLEAVING_GUIDANCE,
  type PracticeSkillEvidence,
} from "../../../engine/interleaving/types";

const transitionTarget: PracticeSkillEvidence = {
  skillId: "fractions-add",
  difficulty: 3,
  prerequisiteReady: true,
  independentAttempts: 5,
  independentAccuracy: 0.8,
  mastery: 0.75,
  previouslyMastered: false,
};

const mixedTarget: PracticeSkillEvidence = {
  ...transitionTarget,
  independentAttempts: 10,
  independentAccuracy: 0.92,
  mastery: 0.9,
};

const masteredA: PracticeSkillEvidence = {
  skillId: "fractions-equivalent",
  difficulty: 2.8,
  prerequisiteReady: true,
  independentAttempts: 8,
  independentAccuracy: 0.95,
  mastery: 0.92,
  previouslyMastered: true,
};

const masteredB: PracticeSkillEvidence = {
  skillId: "fractions-compare",
  difficulty: 3.5,
  prerequisiteReady: true,
  independentAttempts: 7,
  independentAccuracy: 0.9,
  mastery: 0.9,
  previouslyMastered: true,
};

describe("blocked practice safeguards", () => {
  it("keeps initial practice blocked until enough independent attempts exist", () => {
    const result = scheduleInterleavedPractice({
      target: {
        ...transitionTarget,
        independentAttempts: 4,
      },
      reviewCandidates: [masteredA],
      itemCount: 8,
    });

    expect(result.mode).toBe("blocked");
    expect(result.contextSwitches).toBe(0);
    expect(new Set(result.slots.map((slot) => slot.skillId))).toEqual(
      new Set(["fractions-add"]),
    );
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "initial_blocked_practice",
        "premature_interleaving_prevented",
        "insufficient_independent_attempts",
      ]),
    );
  });

  it("does not treat guided-only evidence as interleaving readiness", () => {
    const result = scheduleInterleavedPractice({
      target: {
        ...transitionTarget,
        independentAttempts: 0,
        independentAccuracy: null,
      },
      reviewCandidates: [masteredA],
      itemCount: 8,
    });

    expect(result.mode).toBe("blocked");
    expect(result.reasons).toContain("independent_accuracy_not_observed");
  });

  it("prevents mixing when accuracy is below the transition threshold", () => {
    const result = scheduleInterleavedPractice({
      target: {
        ...transitionTarget,
        independentAccuracy: 0.749,
      },
      reviewCandidates: [masteredA],
      itemCount: 8,
    });

    expect(result.mode).toBe("blocked");
    expect(result.reasons).toContain(
      "independent_accuracy_below_transition_threshold",
    );
  });

  it("prevents mixing when a prerequisite is not ready", () => {
    const result = scheduleInterleavedPractice({
      target: {
        ...mixedTarget,
        prerequisiteReady: false,
      },
      reviewCandidates: [masteredA],
      itemCount: 8,
    });

    expect(result.mode).toBe("blocked");
    expect(result.reasons).toContain("prerequisite_not_ready");
  });

  it("uses blocked practice when the set is too small to mix safely", () => {
    const result = scheduleInterleavedPractice({
      target: mixedTarget,
      reviewCandidates: [masteredA],
      itemCount: 2,
    });

    expect(result.mode).toBe("blocked");
    expect(result.reasons).toContain("item_count_too_small_to_mix");
  });
});

describe("transition and mixed practice", () => {
  it("transitions conservatively after minimum readiness evidence", () => {
    const result = scheduleInterleavedPractice({
      target: transitionTarget,
      reviewCandidates: [masteredA, masteredB],
      itemCount: 10,
    });

    expect(result.mode).toBe("transition");
    expect(result.selectedReviewSkillIds).toEqual([
      "fractions-equivalent",
      "fractions-compare",
    ]);
    expect(
      result.slots.filter((slot) => slot.purpose === "mastered_retrieval"),
    ).toHaveLength(2);
    expect(
      result.slots.filter((slot) => slot.purpose === "target_practice"),
    ).toHaveLength(8);
    expect(result.contextSwitches).toBe(3);
    expect(result.contextSwitches).toBe(countContextSwitches(result.slots));
    expect(result.reasons).toContain("transition_to_mixed_practice");
  });

  it("uses a larger but still minority retrieval share for mixed practice", () => {
    const result = scheduleInterleavedPractice({
      target: mixedTarget,
      reviewCandidates: [masteredA, masteredB],
      itemCount: 12,
    });

    expect(result.mode).toBe("mixed");
    expect(
      result.slots.filter((slot) => slot.purpose === "mastered_retrieval"),
    ).toHaveLength(4);
    expect(
      result.slots.filter((slot) => slot.purpose === "target_practice"),
    ).toHaveLength(8);
    expect(result.reasons).toContain("mixed_practice");
    expect(result.reasons).toContain("mastered_skill_inserted");
  });

  it("inserts only explicitly and sufficiently mastered skills", () => {
    const result = scheduleInterleavedPractice({
      target: mixedTarget,
      reviewCandidates: [
        { ...masteredA, previouslyMastered: false },
        { ...masteredB, mastery: 0.84 },
      ],
      itemCount: 10,
    });

    expect(result.mode).toBe("blocked");
    expect(result.reasons).toContain("no_eligible_mastered_skill");
    expect(result.withheldReviewCandidates).toEqual([
      {
        skillId: "fractions-equivalent",
        reason: "not_explicitly_mastered",
      },
      { skillId: "fractions-compare", reason: "mastery_too_low" },
    ]);
  });

  it("withholds a mastered skill when its difficulty contrast is too large", () => {
    const result = scheduleInterleavedPractice({
      target: mixedTarget,
      reviewCandidates: [{ ...masteredA, difficulty: 1 }],
      itemCount: 10,
    });

    expect(result.mode).toBe("blocked");
    expect(result.withheldReviewCandidates).toEqual([
      {
        skillId: "fractions-equivalent",
        reason: "difficulty_difference_too_large",
      },
    ]);
  });

  it("respects a one-switch maximum and ends on the target skill", () => {
    const result = scheduleInterleavedPractice({
      target: mixedTarget,
      reviewCandidates: [masteredA, masteredB],
      itemCount: 10,
      config: { maximumContextSwitches: 1 },
    });

    expect(result.mode).toBe("mixed");
    expect(result.contextSwitches).toBe(1);
    expect(result.selectedReviewSkillIds).toHaveLength(1);
    expect(result.slots.at(-1)?.skillId).toBe(mixedTarget.skillId);
    expect(result.reasons).toContain("context_switch_limit_applied");
  });

  it("honors a zero-switch parent or program configuration", () => {
    const result = scheduleInterleavedPractice({
      target: mixedTarget,
      reviewCandidates: [masteredA],
      itemCount: 10,
      config: { maximumContextSwitches: 0 },
    });

    expect(result.mode).toBe("blocked");
    expect(result.contextSwitches).toBe(0);
    expect(result.reasons).toContain("context_switch_cap_prevents_mixing");
  });

  it("rotates equally eligible skills deterministically", () => {
    const fixture = {
      target: mixedTarget,
      reviewCandidates: [masteredA, masteredB],
      itemCount: 10,
      rotationOffset: 1,
    } as const;
    const first = scheduleInterleavedPractice(fixture);
    const second = scheduleInterleavedPractice(fixture);

    expect(first).toEqual(second);
    expect(first.selectedReviewSkillIds).toEqual([
      "fractions-compare",
      "fractions-equivalent",
    ]);
  });

  it("limits the number of skills in a set", () => {
    const result = scheduleInterleavedPractice({
      target: mixedTarget,
      reviewCandidates: [masteredA, masteredB],
      itemCount: 10,
      config: { maximumSkillsPerSet: 2 },
    });

    expect(result.selectedReviewSkillIds).toHaveLength(1);
    expect(result.withheldReviewCandidates).toContainEqual({
      skillId: "fractions-compare",
      reason: "not_selected_this_cycle",
    });
  });

  it("returns cautious safety guidance", () => {
    const result = scheduleInterleavedPractice({
      target: mixedTarget,
      reviewCandidates: [masteredA],
      itemCount: 10,
    });

    expect(result.guidance).toBe(INTERLEAVING_GUIDANCE);
    expect(result.guidance).toContain("configurable");
    expect(result.guidance).toContain("does not declare");
    expect(result.guidance.toLowerCase()).not.toMatch(
      /guaranteed|works for everyone|the optimal pattern/,
    );
  });

  it("does not echo unexpected identifying input fields", () => {
    const result = scheduleInterleavedPractice({
      target: mixedTarget,
      reviewCandidates: [masteredA],
      itemCount: 10,
      studentName: "Sensitive Student Name",
      learnerId: "private-123",
    } as Parameters<typeof scheduleInterleavedPractice>[0] & {
      studentName: string;
      learnerId: string;
    });

    expect(JSON.stringify(result)).not.toContain("Sensitive Student Name");
    expect(JSON.stringify(result)).not.toContain("private-123");
  });
});
