import { describe, expect, it } from "vitest";

import { scheduleInterleavedPractice } from "../../../engine/interleaving/interleaving-scheduler";
import type { PracticeSkillEvidence } from "../../../engine/interleaving/types";

const target: PracticeSkillEvidence = {
  skillId: "target",
  difficulty: 3,
  prerequisiteReady: true,
  independentAttempts: 12,
  independentAccuracy: 0.95,
  mastery: 0.95,
  previouslyMastered: false,
};

const candidates: readonly PracticeSkillEvidence[] = [
  {
    skillId: "review-a",
    difficulty: 2.8,
    prerequisiteReady: true,
    independentAttempts: 9,
    independentAccuracy: 0.95,
    mastery: 0.95,
    previouslyMastered: true,
  },
  {
    skillId: "review-b",
    difficulty: 3.6,
    prerequisiteReady: true,
    independentAttempts: 9,
    independentAccuracy: 0.95,
    mastery: 0.95,
    previouslyMastered: true,
  },
  {
    skillId: "review-c",
    difficulty: 4.2,
    prerequisiteReady: true,
    independentAttempts: 9,
    independentAccuracy: 0.95,
    mastery: 0.95,
    previouslyMastered: true,
  },
];

describe("interleaving bounded property checks", () => {
  it("always fills the requested set and respects the context-switch cap", () => {
    for (let itemCount = 1; itemCount <= 30; itemCount += 1) {
      for (let maximumContextSwitches = 0; maximumContextSwitches <= 5; maximumContextSwitches += 1) {
        const result = scheduleInterleavedPractice({
          target,
          reviewCandidates: candidates,
          itemCount,
          rotationOffset: itemCount - maximumContextSwitches,
          config: { maximumContextSwitches },
        });

        expect(result.slots).toHaveLength(itemCount);
        expect(result.slots.map((slot) => slot.position)).toEqual(
          Array.from({ length: itemCount }, (_, index) => index),
        );
        expect(result.contextSwitches).toBeLessThanOrEqual(
          maximumContextSwitches,
        );
        if (result.mode !== "blocked") {
          const targetCount = result.slots.filter(
            (slot) => slot.skillId === target.skillId,
          ).length;
          expect(targetCount).toBeGreaterThan(itemCount / 2);
        }
      }
    }
  });

  it("never mixes before every readiness gate passes", () => {
    const attempts = [0, 4, 5, 8];
    const accuracies = [null, 0, 0.74, 0.75, 0.85, 1] as const;
    const masteries = [0, 0.69, 0.7, 0.85, 1] as const;

    for (const independentAttempts of attempts) {
      for (const independentAccuracy of accuracies) {
        for (const mastery of masteries) {
          const result = scheduleInterleavedPractice({
            target: {
              ...target,
              independentAttempts,
              independentAccuracy,
              mastery,
            },
            reviewCandidates: candidates,
            itemCount: 8,
          });
          const transitionReady =
            independentAttempts >= 5 &&
            independentAccuracy !== null &&
            independentAccuracy >= 0.75 &&
            mastery >= 0.7;

          if (!transitionReady) {
            expect(result.mode).toBe("blocked");
            expect(
              result.slots.every((slot) => slot.skillId === target.skillId),
            ).toBe(true);
          }
        }
      }
    }
  });

  it("keeps every scheduled difficulty transition within the configured bound", () => {
    for (const maximumDifficultyDifference of [0, 0.5, 1, 1.5, 2]) {
      const result = scheduleInterleavedPractice({
        target,
        reviewCandidates: candidates,
        itemCount: 15,
        config: { maximumDifficultyDifference },
      });

      for (let index = 1; index < result.slots.length; index += 1) {
        expect(
          Math.abs(
            result.slots[index]!.difficulty -
              result.slots[index - 1]!.difficulty,
          ),
        ).toBeLessThanOrEqual(maximumDifficultyDifference);
      }
    }
  });

  it("never schedules a candidate that lacks explicit mastered status", () => {
    for (const mastery of [0, 0.5, 0.84, 0.85, 1]) {
      for (const previouslyMastered of [false, true]) {
        const candidate = {
          ...candidates[0]!,
          mastery,
          previouslyMastered,
        };
        const result = scheduleInterleavedPractice({
          target,
          reviewCandidates: [candidate],
          itemCount: 8,
        });
        const selected = result.selectedReviewSkillIds.includes(
          candidate.skillId,
        );

        expect(selected).toBe(previouslyMastered && mastery >= 0.85);
      }
    }
  });
});
