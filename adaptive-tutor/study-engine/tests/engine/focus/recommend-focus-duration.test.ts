import { describe, expect, it } from "vitest";

import {
  FOCUS_RECOMMENDATIONS,
  recommendFocusDuration,
  type FocusRecommendationInput,
  type FocusSessionEvidence,
  type GradeBand,
} from "../../../engine/focus";

const BASE_TIMESTAMP = 1_800_000_000_000;

function session(
  offset: number,
  overrides: Partial<FocusSessionEvidence> = {},
): FocusSessionEvidence {
  return {
    occurredAtEpochMs: BASE_TIMESTAMP + offset,
    subject: "mathematics",
    taskType: "guided-practice",
    plannedDurationMinutes: 30,
    completedDurationMinutes: 30,
    coreOutcome: "successful",
    durationResponse: "comfortable",
    disruption: "none",
    quality: "reliable",
    ...overrides,
  };
}

function fiveSessions(
  overrides: readonly Partial<FocusSessionEvidence>[] = [],
): FocusSessionEvidence[] {
  return Array.from({ length: 5 }, (_, index) =>
    session(index, overrides[index]),
  );
}

function input(
  overrides: Partial<FocusRecommendationInput> = {},
): FocusRecommendationInput {
  return {
    gradeBand: "middle_school",
    subject: "mathematics",
    taskType: "guided-practice",
    currentDurationMinutes: 30,
    sessions: fiveSessions(),
    ...overrides,
  };
}

describe("recommendFocusDuration", () => {
  describe("minimum evidence and comparable context", () => {
    it("returns insufficient_data with fewer than five sessions", () => {
      const result = recommendFocusDuration(
        input({ sessions: fiveSessions().slice(0, 4) }),
      );

      expect(result.recommendation).toBe("insufficient_data");
      expect(result.adjustmentMinutes).toBe(0);
      expect(result.evidence.evaluatedComparableSessions).toBe(4);
    });

    it("requires five reliable sessions matching both subject and task type", () => {
      const sessions = [
        ...fiveSessions().slice(0, 4),
        session(5, { subject: "science" }),
        session(6, { taskType: "independent-attempt" }),
        session(7, { quality: "limited" }),
      ];

      const result = recommendFocusDuration(input({ sessions }));

      expect(result.recommendation).toBe("insufficient_data");
      expect(result.evidence.availableComparableSessions).toBe(4);
    });

    it("normalizes harmless label formatting but not different contexts", () => {
      const sessions = fiveSessions().map((item, index) => ({
        ...item,
        occurredAtEpochMs: BASE_TIMESTAMP + index,
        subject: index % 2 === 0 ? " MATHEMATICS " : "Mathematics",
        taskType:
          index % 2 === 0 ? "GUIDED-PRACTICE" : " guided-practice ",
      }));

      const result = recommendFocusDuration(input({ sessions }));

      expect(result.recommendation).toBe("increase");
      expect(result.evidence.evaluatedComparableSessions).toBe(5);
    });

    it("excludes sessions whose planned duration is not comparable", () => {
      const sessions = [
        ...fiveSessions().slice(0, 4),
        session(10, { plannedDurationMinutes: 50 }),
      ];

      const result = recommendFocusDuration(input({ sessions }));

      expect(result.recommendation).toBe("insufficient_data");
    });

    it("excludes technical issues and interruptions", () => {
      const sessions = [
        ...fiveSessions().slice(0, 4),
        session(10, { disruption: "technical_issue" }),
        session(11, { disruption: "interruption" }),
      ];

      const result = recommendFocusDuration(input({ sessions }));

      expect(result.recommendation).toBe("insufficient_data");
      expect(result.evidence.availableComparableSessions).toBe(4);
    });

    it("does not treat an approved break as failed or incomparable", () => {
      const sessions = fiveSessions([
        { disruption: "approved_break" },
        { disruption: "approved_break" },
      ]);

      const result = recommendFocusDuration(input({ sessions }));

      expect(result.recommendation).toBe("increase");
      expect(result.evidence.successfulSessions).toBe(5);
      expect(result.evidence.approvedBreakSessions).toBe(2);
    });
  });

  describe("conservative increase rules", () => {
    it("normally requires at least four successful sessions out of five", () => {
      const fourSuccessful = fiveSessions([
        {},
        {},
        {},
        {},
        { coreOutcome: "not_successful" },
      ]);
      const threeSuccessful = fiveSessions([
        {},
        {},
        {},
        { coreOutcome: "not_successful" },
        { coreOutcome: "not_successful" },
      ]);

      expect(
        recommendFocusDuration(input({ sessions: fourSuccessful }))
          .recommendation,
      ).toBe("increase");
      expect(
        recommendFocusDuration(input({ sessions: threeSuccessful }))
          .recommendation,
      ).toBe("maintain");
    });

    it.each([
      ["elementary", 20, 2],
      ["middle_school", 30, 3],
      ["high_school", 40, 4],
    ] as const)(
      "uses a conservative %s adjustment",
      (gradeBand, currentDurationMinutes, expectedIncrease) => {
        const sessions = fiveSessions().map((item) => ({
          ...item,
          plannedDurationMinutes: currentDurationMinutes,
          completedDurationMinutes: currentDurationMinutes,
        }));

        const result = recommendFocusDuration(
          input({ gradeBand, currentDurationMinutes, sessions }),
        );

        expect(result.recommendation).toBe("increase");
        expect(result.adjustmentMinutes).toBe(expectedIncrease);
      },
    );

    it("limits a middle-school increase to ten percent", () => {
      const sessions = fiveSessions().map((item) => ({
        ...item,
        plannedDurationMinutes: 20,
        completedDurationMinutes: 20,
      }));

      const result = recommendFocusDuration(
        input({ currentDurationMinutes: 20, sessions }),
      );

      expect(result.recommendation).toBe("increase");
      expect(result.adjustmentMinutes).toBe(2);
      expect(result.adjustmentMinutes / 20).toBeLessThanOrEqual(0.1);
    });

    it("maintains when the safe ratio budget is below the grade-band minimum", () => {
      const sessions = fiveSessions().map((item) => ({
        ...item,
        plannedDurationMinutes: 15,
        completedDurationMinutes: 15,
      }));

      const result = recommendFocusDuration(
        input({
          gradeBand: "middle_school",
          currentDurationMinutes: 15,
          sessions,
        }),
      );

      expect(result.recommendation).toBe("maintain");
      expect(result.reasonCodes).toEqual(["increase_below_safe_minimum"]);
    });

    it("does not use low academic success alone as evidence to decrease", () => {
      const sessions = fiveSessions().map((item) => ({
        ...item,
        coreOutcome: "not_successful" as const,
      }));

      const result = recommendFocusDuration(input({ sessions }));

      expect(result.recommendation).toBe("maintain");
      expect(result.adjustmentMinutes).toBe(0);
    });

    it("does not increase after even one direct too-long response", () => {
      const sessions = fiveSessions([{ durationResponse: "too_long" }]);

      const result = recommendFocusDuration(input({ sessions }));

      expect(result.recommendation).toBe("maintain");
    });
  });

  describe("decrease and conflicting evidence", () => {
    it("uses repeated direct too-long feedback for a conservative decrease", () => {
      const sessions = fiveSessions([
        { durationResponse: "too_long" },
        { durationResponse: "too_long" },
      ]);

      const result = recommendFocusDuration(input({ sessions }));

      expect(result.recommendation).toBe("decrease");
      expect(result.adjustmentMinutes).toBe(-3);
      expect(result.reasonCodes).toEqual(["repeated_too_long_feedback"]);
    });

    it("routes repeated contradictory duration feedback to manual review", () => {
      const sessions = fiveSessions([
        { durationResponse: "too_long" },
        { durationResponse: "too_long" },
        { durationResponse: "too_short" },
        { durationResponse: "too_short" },
      ]);

      const result = recommendFocusDuration(input({ sessions }));

      expect(result.recommendation).toBe("manual_review");
      expect(result.reasonCodes).toEqual([
        "conflicting_duration_feedback",
      ]);
    });

    it("honors a trusted manual-review signal before making a recommendation", () => {
      const sessions = fiveSessions([
        { manualReviewRequested: true },
      ]);

      const result = recommendFocusDuration(input({ sessions }));

      expect(result.recommendation).toBe("manual_review");
      expect(result.adjustmentMinutes).toBe(0);
    });
  });

  describe("parent overrides and duration caps", () => {
    it("honors a parent hold even when automatic evidence is sparse", () => {
      const result = recommendFocusDuration(
        input({
          sessions: [],
          parentOverride: { mode: "hold" },
        }),
      );

      expect(result.recommendation).toBe("maintain");
      expect(result.reasonCodes).toEqual(["parent_hold"]);
    });

    it("honors an explicit parent reduction without five sessions", () => {
      const result = recommendFocusDuration(
        input({
          sessions: [],
          parentOverride: {
            mode: "reduce",
            targetDurationMinutes: 24,
          },
        }),
      );

      expect(result.recommendation).toBe("decrease");
      expect(result.recommendedDurationMinutes).toBe(24);
    });

    it("never lets a parent setting force an evidence-free increase", () => {
      const result = recommendFocusDuration(
        input({
          sessions: [],
          parentOverride: {
            mode: "automatic",
            maximumDurationMinutes: 60,
          },
        }),
      );

      expect(result.recommendation).toBe("insufficient_data");
    });

    it("lets a parent disable increases", () => {
      const result = recommendFocusDuration(
        input({
          parentOverride: {
            mode: "automatic",
            allowIncrease: false,
          },
        }),
      );

      expect(result.recommendation).toBe("maintain");
      expect(result.reasonCodes).toEqual(["increase_disabled_by_parent"]);
    });

    it("does not exceed a configured grade-band cap", () => {
      const result = recommendFocusDuration(
        input({
          currentDurationMinutes: 29,
          sessions: fiveSessions().map((item) => ({
            ...item,
            plannedDurationMinutes: 29,
            completedDurationMinutes: 29,
          })),
          policy: {
            adjustmentGranularityMinutes: 0.5,
            durationCapsMinutes: { middle_school: 30 },
          },
        }),
      );

      expect(result.recommendation).toBe("maintain");
      expect(result.recommendedDurationMinutes).toBeLessThanOrEqual(30);
    });

    it("maintains at the configured maximum duration", () => {
      const result = recommendFocusDuration(
        input({
          policy: {
            durationCapsMinutes: { middle_school: 30 },
          },
        }),
      );

      expect(result.recommendation).toBe("maintain");
      expect(result.reasonCodes).toEqual(["current_duration_at_cap"]);
    });

    it("brings a duration above a parent cap down without inferring a cause", () => {
      const result = recommendFocusDuration(
        input({
          sessions: [],
          parentOverride: {
            mode: "automatic",
            maximumDurationMinutes: 25,
          },
        }),
      );

      expect(result.recommendation).toBe("decrease");
      expect(result.recommendedDurationMinutes).toBe(25);
      expect(result.reasonCodes).toEqual(["parent_cap_requires_decrease"]);
    });

    it("routes invalid or internally conflicting overrides to review", () => {
      const result = recommendFocusDuration(
        input({
          parentOverride: {
            mode: "hold",
            maximumDurationMinutes: 20,
          },
        }),
      );

      expect(result.recommendation).toBe("manual_review");
      expect(result.reasonCodes).toEqual(["invalid_request"]);
    });
  });

  describe("determinism, boundaries, privacy, and safe vocabulary", () => {
    it("uses the most recent configured evidence window", () => {
      const olderFailures = Array.from({ length: 5 }, (_, index) =>
        session(index, { coreOutcome: "not_successful" }),
      );
      const newerSuccesses = Array.from({ length: 5 }, (_, index) =>
        session(100 + index),
      );

      const result = recommendFocusDuration(
        input({ sessions: [...newerSuccesses, ...olderFailures] }),
      );

      expect(result.recommendation).toBe("increase");
      expect(result.evidence.availableComparableSessions).toBe(10);
      expect(result.evidence.evaluatedComparableSessions).toBe(5);
      expect(result.evidence.successfulSessions).toBe(5);
    });

    it("is invariant to input order, including tied timestamps", () => {
      const sessions = fiveSessions([
        {},
        {},
        {},
        {},
        { coreOutcome: "not_successful" },
      ]).map((item) => ({ ...item, occurredAtEpochMs: BASE_TIMESTAMP }));
      const forward = recommendFocusDuration(input({ sessions }));
      const reversed = recommendFocusDuration(
        input({ sessions: [...sessions].reverse() }),
      );

      expect(reversed).toEqual(forward);
    });

    it("returns only the allowed vocabulary over generated evidence combinations", () => {
      const outcomes = [
        "successful",
        "not_successful",
        "inconclusive",
      ] as const;
      const responses = [
        "comfortable",
        "too_long",
        "too_short",
        "unknown",
      ] as const;
      const gradeBands: readonly GradeBand[] = [
        "elementary",
        "middle_school",
        "high_school",
      ];

      for (const gradeBand of gradeBands) {
        for (const coreOutcome of outcomes) {
          for (const durationResponse of responses) {
            const sessions = fiveSessions().map((item) => ({
              ...item,
              coreOutcome,
              durationResponse,
            }));
            const result = recommendFocusDuration(
              input({ gradeBand, sessions }),
            );

            expect(FOCUS_RECOMMENDATIONS).toContain(result.recommendation);
            expect(Number.isFinite(result.recommendedDurationMinutes)).toBe(
              true,
            );
          }
        }
      }
    });

    it("never exceeds the configured ten-percent increase boundary", () => {
      const gradeBands: readonly GradeBand[] = [
        "elementary",
        "middle_school",
        "high_school",
      ];

      for (const gradeBand of gradeBands) {
        for (let duration = 1; duration <= 120; duration += 1) {
          const sessions = fiveSessions().map((item) => ({
            ...item,
            plannedDurationMinutes: duration,
            completedDurationMinutes: duration,
          }));
          const result = recommendFocusDuration(
            input({
              gradeBand,
              currentDurationMinutes: duration,
              sessions,
            }),
          );

          if (result.recommendation === "increase") {
            expect(result.adjustmentMinutes / duration).toBeLessThanOrEqual(
              0.1,
            );
          }
        }
      }
    });

    it("never increases unless at least eighty percent of the evaluated window succeeded", () => {
      for (let successes = 0; successes <= 10; successes += 1) {
        const sessions = Array.from({ length: 10 }, (_, index) =>
          session(index, {
            coreOutcome:
              index < successes ? "successful" : "not_successful",
          }),
        );
        const result = recommendFocusDuration(
          input({
            sessions,
            policy: { comparisonWindowSize: 10 },
          }),
        );

        if (result.recommendation === "increase") {
          expect(result.evidence.successfulSessions).toBeGreaterThanOrEqual(8);
        }
      }
    });

    it("returns a safe result instead of throwing on invalid numeric input", () => {
      const result = recommendFocusDuration(
        input({ currentDurationMinutes: Number.NaN }),
      );

      expect(result.recommendation).toBe("manual_review");
      expect(result.currentDurationMinutes).toBe(0);
      expect(result.recommendedDurationMinutes).toBe(0);
    });

    it("does not echo extra identifying data supplied at runtime", () => {
      const sessionsWithPrivateExtras = fiveSessions().map((item) => ({
        ...item,
        studentName: "PRIVATE STUDENT",
        email: "private@example.invalid",
        notes: "PRIVATE NOTE",
      }));
      const runtimeInput = {
        ...input({ sessions: sessionsWithPrivateExtras }),
        studentId: "PRIVATE-ID-123",
      } as FocusRecommendationInput;

      const serialized = JSON.stringify(
        recommendFocusDuration(runtimeInput),
      );

      expect(serialized).not.toContain("PRIVATE");
      expect(serialized).not.toContain("example.invalid");
      expect(serialized).not.toContain("studentId");
      expect(serialized).not.toContain("studentName");
    });

    it("does not generate diagnostic, blaming, or permanent-trait language", () => {
      const result = recommendFocusDuration(
        input({
          sessions: fiveSessions().map((item) => ({
            ...item,
            coreOutcome: "not_successful",
            durationResponse: "too_long",
          })),
        }),
      );
      const output = JSON.stringify(result).toLocaleLowerCase("en-US");
      const forbiddenPhrases = [
        "not paying attention",
        "failed because",
        "should be able to sit longer",
        "attention span",
        "diagnosis",
        "adhd",
        "lazy",
      ];

      for (const phrase of forbiddenPhrases) {
        expect(output).not.toContain(phrase);
      }
    });

    it("freezes returned metadata to prevent downstream accidental mutation", () => {
      const result = recommendFocusDuration(input());

      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.reasonCodes)).toBe(true);
      expect(Object.isFrozen(result.evidence)).toBe(true);
    });
  });
});
