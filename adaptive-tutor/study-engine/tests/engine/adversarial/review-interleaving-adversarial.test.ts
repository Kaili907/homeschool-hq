import { describe, expect, it } from "vitest";

import {
  addCalendarDays,
  calendarDateInTimeZone,
  scheduleNextReview,
  type RetrievalEvidence,
} from "../../../engine/review/index.js";
import {
  countContextSwitches,
  scheduleInterleavedPractice,
  type InterleavingScheduleInput,
  type PracticeSkillEvidence,
} from "../../../engine/interleaving/index.js";

const strongEvidence: RetrievalEvidence = {
  retrievalAccuracy: 1,
  independence: 1,
  confidence: 1,
  consecutiveSuccessfulRetrievals: 20,
  retrievalFailed: false,
  prerequisiteGap: false,
  reteachingOutcome: "not_needed",
};

function skill(
  skillId: string,
  overrides: Partial<PracticeSkillEvidence> = {},
): PracticeSkillEvidence {
  return {
    skillId,
    difficulty: 3,
    prerequisiteReady: true,
    independentAttempts: 10,
    independentAccuracy: 0.95,
    mastery: 0.95,
    previouslyMastered: true,
    ...overrides,
  };
}

function interleavingInput(
  overrides: Partial<InterleavingScheduleInput> = {},
): InterleavingScheduleInput {
  return {
    target: skill("target", { previouslyMastered: false }),
    reviewCandidates: [skill("review-a"), skill("review-b")],
    itemCount: 12,
    ...overrides,
  };
}

describe("adversarial retrieval and interleaving validation", () => {
  it("makes retrieval failure dominate otherwise perfect signals", () => {
    const result = scheduleNextReview({
      reviewedOn: "2026-11-01",
      state: { lastBaselineIndex: 4 },
      evidence: {
        ...strongEvidence,
        retrievalFailed: true,
      },
    });

    expect(result).toMatchObject({
      dueOn: "2026-11-01",
      intervalDays: 0,
      cadenceAction: "shorten",
      preparation: "reteach_before_retrieval",
    });
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "retrieval_failure",
        "conflicting_evidence_resolved_conservatively",
      ]),
    );
  });

  it("makes a prerequisite gap dominate repeated retrieval success", () => {
    const result = scheduleNextReview({
      reviewedOn: "2026-03-08",
      state: { lastBaselineIndex: 5 },
      evidence: {
        ...strongEvidence,
        prerequisiteGap: true,
      },
    });

    expect(result).toMatchObject({
      dueOn: "2026-03-08",
      intervalDays: 0,
      cadenceAction: "shorten",
      preparation: "address_prerequisite_before_retrieval",
    });
    expect(result.reasons).toContain("prerequisite_gap");
  });

  it("caps hostile extension configuration and never exceeds the configured interval", () => {
    const result = scheduleNextReview({
      reviewedOn: "2026-01-01",
      state: { lastBaselineIndex: 4 },
      evidence: strongEvidence,
      config: {
        maximumExtensionFactor: 1.05,
        maximumIntervalDays: 31,
      },
    });

    expect(result.baselineIntervalDays).toBe(30);
    expect(result.intervalDays).toBeLessThanOrEqual(31);
    expect(result.intervalDays).toBeLessThanOrEqual(
      Math.round(result.baselineIntervalDays * 1.05),
    );
    expect(result.reasons).toContain("maximum_extension_cap_applied");
  });

  it("rejects invalid and NaN retrieval inputs", () => {
    const hostileValues = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      -0.01,
      1.01,
    ];

    for (const retrievalAccuracy of hostileValues) {
      expect(() =>
        scheduleNextReview({
          reviewedOn: "2026-01-01",
          state: { lastBaselineIndex: 2 },
          evidence: { ...strongEvidence, retrievalAccuracy },
        }),
      ).toThrow();
    }
  });

  it("uses learner-supplied time zones without guessing across date boundaries", () => {
    const instant = "2026-03-08T04:30:00.000Z";
    expect(calendarDateInTimeZone(instant, "America/New_York")).toBe(
      "2026-03-07",
    );
    expect(calendarDateInTimeZone(instant, "Asia/Tokyo")).toBe("2026-03-08");
    expect(addCalendarDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addCalendarDays("2026-11-01", 1)).toBe("2026-11-02");
  });

  it("does not leak accidental PII fields through review recommendations", () => {
    const input = {
      reviewedOn: "2026-01-01",
      state: {
        lastBaselineIndex: 2,
        studentName: "PRIVATE STUDENT",
      },
      evidence: {
        ...strongEvidence,
        email: "private@example.invalid",
      },
    } as Parameters<typeof scheduleNextReview>[0];

    expect(JSON.stringify(scheduleNextReview(input))).not.toMatch(
      /PRIVATE STUDENT|private@example\.invalid|studentName|email/,
    );
  });

  it.each([
    {
      name: "no independent attempts",
      target: skill("target", {
        previouslyMastered: false,
        independentAttempts: 0,
        independentAccuracy: null,
        mastery: 0,
      }),
    },
    {
      name: "missing prerequisite",
      target: skill("target", {
        previouslyMastered: false,
        prerequisiteReady: false,
      }),
    },
    {
      name: "low independent accuracy",
      target: skill("target", {
        previouslyMastered: false,
        independentAccuracy: 0.4,
      }),
    },
  ])("prevents premature interleaving with $name", ({ target }) => {
    const result = scheduleInterleavedPractice(interleavingInput({ target }));
    expect(result.mode).toBe("blocked");
    expect(result.contextSwitches).toBe(0);
    expect(result.reasons).toContain("premature_interleaving_prevented");
    expect(new Set(result.slots.map(({ skillId }) => skillId))).toEqual(
      new Set(["target"]),
    );
  });

  it("does not permit configuration to erase the minimum evidence floor", () => {
    const result = scheduleInterleavedPractice(
      interleavingInput({
        target: skill("target", {
          previouslyMastered: false,
          independentAttempts: 0,
          independentAccuracy: 1,
          mastery: 1,
        }),
        config: {
          minimumBlockedAttempts: 0,
          minimumMixedAttempts: 0,
          minimumTransitionAccuracy: 0,
          minimumTransitionMastery: 0,
          minimumMixedAccuracy: 0,
          minimumMixedMastery: 0,
          minimumReviewAttempts: 0,
          minimumReviewAccuracy: 0,
          minimumReviewMastery: 0,
        },
      }),
    );

    expect(result.mode).toBe("blocked");
    expect(result.reasons).toContain("premature_interleaving_prevented");
  });

  it("withholds unmastered, unready, weak, and difficulty-mismatched review candidates", () => {
    const result = scheduleInterleavedPractice(
      interleavingInput({
        reviewCandidates: [
          skill("not-mastered", { previouslyMastered: false }),
          skill("not-ready", { prerequisiteReady: false }),
          skill("too-weak", { mastery: 0.4 }),
          skill("too-hard", { difficulty: 5 }),
          skill("eligible"),
        ],
      }),
    );

    expect(result.selectedReviewSkillIds).toEqual(["eligible"]);
    expect(result.withheldReviewCandidates).toEqual(
      expect.arrayContaining([
        { skillId: "not-mastered", reason: "not_explicitly_mastered" },
        { skillId: "not-ready", reason: "prerequisite_not_ready" },
        { skillId: "too-weak", reason: "mastery_too_low" },
        {
          skillId: "too-hard",
          reason: "difficulty_difference_too_large",
        },
      ]),
    );
  });

  it("keeps context switching within every configured cap over a hostile matrix", () => {
    const candidates = Array.from({ length: 20 }, (_, index) =>
      skill(`review-${String(index).padStart(2, "0")}`, {
        difficulty: 2.5 + (index % 3) * 0.25,
      }),
    );

    for (let maximumContextSwitches = 0; maximumContextSwitches <= 8; maximumContextSwitches += 1) {
      for (let itemCount = 1; itemCount <= 40; itemCount += 1) {
        const result = scheduleInterleavedPractice(
          interleavingInput({
            reviewCandidates: candidates,
            itemCount,
            rotationOffset: itemCount - 20,
            config: {
              maximumContextSwitches,
              maximumSkillsPerSet: 10,
            },
          }),
        );

        expect(result.contextSwitches).toBe(
          countContextSwitches(result.slots),
        );
        expect(result.contextSwitches).toBeLessThanOrEqual(
          maximumContextSwitches,
        );
        expect(result.slots).toHaveLength(itemCount);
      }
    }
  });

  it("is deterministic and does not echo unknown PII fields", () => {
    const hostile = {
      ...interleavingInput({ rotationOffset: -99 }),
      studentName: "PRIVATE STUDENT",
      reviewCandidates: [
        {
          ...skill("review-a"),
          email: "private@example.invalid",
        },
        skill("review-b"),
      ],
    } as unknown as InterleavingScheduleInput;

    const first = scheduleInterleavedPractice(hostile);
    for (let iteration = 0; iteration < 50; iteration += 1) {
      expect(scheduleInterleavedPractice(hostile)).toEqual(first);
    }
    expect(JSON.stringify(first)).not.toMatch(
      /PRIVATE STUDENT|private@example\.invalid|studentName|email/,
    );
  });
});
