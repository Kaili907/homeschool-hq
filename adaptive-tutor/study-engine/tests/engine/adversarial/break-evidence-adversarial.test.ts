import { describe, expect, it } from "vitest";

import {
  recommendBreak,
  type ActiveBreak,
  type BreakContext,
} from "../../../engine/breaks/index.js";
import {
  classifyEvidence,
  type EvidenceSignals,
} from "../../../engine/evidence/index.js";

const SAFE_LANGUAGE =
  /you were not paying attention|you failed because|sit longer|adhd|diagnos|permanent attention|lazy|lost your break/i;

describe("adversarial break and evidence validation", () => {
  it("never treats approved breaks, refusals, extensions, or escalations as failure", () => {
    const contexts: BreakContext[] = [
      {
        blockElapsedMinutes: 20,
        sessionElapsedMinutes: 20,
      },
      {
        blockElapsedMinutes: 20,
        sessionElapsedMinutes: 20,
        breakRefused: true,
      },
      {
        blockElapsedMinutes: 0,
        sessionElapsedMinutes: 20,
        studentRequest: {},
      },
      {
        blockElapsedMinutes: 0,
        sessionElapsedMinutes: 40,
        studentRequest: { type: "movement" },
        history: [
          { type: "water", approved: true, endedAtSessionMinute: 10 },
          { type: "quiet_reset", approved: true, endedAtSessionMinute: 25 },
        ],
      },
      {
        blockElapsedMinutes: 0,
        sessionElapsedMinutes: 30,
        currentBreak: {
          type: "screen_rest",
          baseDurationMinutes: 5,
          elapsedMinutes: 5,
          extensionMinutes: 0,
          extensionRequested: true,
        },
      },
    ];

    for (const context of contexts) {
      const result = recommendBreak(context);
      expect(result.countsAsFailure).toBe(false);
      expect(result.safeMessage).not.toMatch(SAFE_LANGUAGE);
    }
  });

  it("ends a cooperative extension loop at both extension and total-duration caps", () => {
    const extensionSteps = [0, 2, 4] as const;
    const approvedDurations: number[] = [];

    for (const extensionMinutes of extensionSteps) {
      const result = recommendBreak({
        blockElapsedMinutes: 0,
        sessionElapsedMinutes: 30,
        currentBreak: {
          type: "movement",
          baseDurationMinutes: 5,
          elapsedMinutes: 5 + extensionMinutes,
          extensionMinutes,
          extensionRequested: true,
        },
      });
      expect(result.action).toBe("extend_break");
      expect(result.durationMinutes).toBeGreaterThan(0);
      approvedDurations.push(result.durationMinutes!);
    }

    expect(approvedDurations).toEqual([2, 2, 1]);

    const capped = recommendBreak({
      blockElapsedMinutes: 0,
      sessionElapsedMinutes: 35,
      currentBreak: {
        type: "movement",
        baseDurationMinutes: 5,
        elapsedMinutes: 10,
        extensionMinutes: 5,
        extensionRequested: true,
      },
    });
    expect(capped).toMatchObject({
      action: "resume_or_finish",
      approved: true,
      countsAsFailure: false,
    });
    expect(capped.reasons).toContain("break_extension_limit_reached");
  });

  it("escalates repeated approved breaks while preserving the immediate break", () => {
    const result = recommendBreak({
      blockElapsedMinutes: 2,
      sessionElapsedMinutes: 40,
      studentRequest: { type: "water" },
      history: [
        { type: "movement", endedAtSessionMinute: 10, approved: true },
        { type: "quiet_reset", endedAtSessionMinute: 25, approved: true },
      ],
    });

    expect(result).toMatchObject({
      action: "start_break",
      approved: true,
      countsAsFailure: false,
      review: "parent_or_teacher",
    });
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "repeated_break_pattern",
        "approved_break_not_failure",
      ]),
    );
  });

  it("rejects NaN, infinity, invalid history, and impossible policy values", () => {
    const hostile: BreakContext[] = [
      { blockElapsedMinutes: Number.NaN, sessionElapsedMinutes: 1 },
      {
        blockElapsedMinutes: 1,
        sessionElapsedMinutes: Number.POSITIVE_INFINITY,
      },
      {
        blockElapsedMinutes: 1,
        sessionElapsedMinutes: 5,
        history: [
          { type: "water", endedAtSessionMinute: 6, approved: true },
        ],
      },
      {
        blockElapsedMinutes: 1,
        sessionElapsedMinutes: 5,
        policy: { maxTotalBreakMinutes: -1 },
      },
      {
        blockElapsedMinutes: 1,
        sessionElapsedMinutes: 5,
        currentBreak: {
          type: "movement",
          baseDurationMinutes: 5,
          elapsedMinutes: Number.NaN,
          extensionMinutes: 0,
        },
      },
    ];

    for (const context of hostile) {
      expect(recommendBreak(context)).toMatchObject({
        action: "insufficient_data",
        approved: false,
        countsAsFailure: false,
        reasons: ["invalid_context"],
      });
    }
  });

  it("rejects malformed runtime shapes instead of silently changing their meaning", () => {
    const malformedContexts = [
      {
        blockElapsedMinutes: 20,
        sessionElapsedMinutes: 20,
        breakRefused: "false",
      },
      {
        blockElapsedMinutes: 20,
        sessionElapsedMinutes: 20,
        sessionGoalComplete: "true",
      },
      {
        blockElapsedMinutes: 0,
        sessionElapsedMinutes: 20,
        needs: { waterRequested: "yes" },
      },
      {
        blockElapsedMinutes: 0,
        sessionElapsedMinutes: 20,
        currentBreak: {
          type: "movement",
          baseDurationMinutes: 5,
          elapsedMinutes: 1,
          extensionMinutes: 0,
          extensionRequested: "true",
        },
      },
      {
        blockElapsedMinutes: 0,
        sessionElapsedMinutes: 20,
        history: "not-an-array",
      },
    ] as unknown as BreakContext[];

    for (const malformed of malformedContexts) {
      expect(() => recommendBreak(malformed)).not.toThrow();
      expect(recommendBreak(malformed)).toMatchObject({
        action: "insufficient_data",
        reasons: ["invalid_context"],
      });
    }
  });

  it("does not echo accidental PII fields from break context", () => {
    const hostile = {
      blockElapsedMinutes: 20,
      sessionElapsedMinutes: 20,
      studentName: "PRIVATE STUDENT",
      email: "private@example.invalid",
      history: [],
    } as unknown as BreakContext;

    expect(JSON.stringify(recommendBreak(hostile))).not.toMatch(
      /PRIVATE STUDENT|private@example\.invalid|studentName|email/,
    );
  });

  it("resolves direct technical evidence before optimistic or blame-prone inferences", () => {
    const result = classifyEvidence({
      attempts: 10,
      accuracy: 1,
      effortPattern: "steady",
      answerPattern: "rapid_random_like",
      medianResponseSeconds: 1,
      rapidAnswerRatio: 1,
      technicalIssueCount: 1,
      approvedBreakCount: 3,
    });

    expect(result).toMatchObject({
      category: "Technical issue",
      conclusion: "possible",
      dataQuality: "contaminated",
    });
    expect(result.reasons).toContain("approved_breaks_excluded");
    expect(result.safeSummary).not.toMatch(SAFE_LANGUAGE);
  });

  it("routes equally plausible conflicting signals to insufficient evidence", () => {
    const result = classifyEvidence({
      fatigueReported: true,
      frustrationReported: true,
      attempts: 8,
      accuracy: 0.4,
      effortPattern: "steady",
    });

    expect(result).toMatchObject({
      category: "Insufficient evidence",
      conclusion: "insufficient",
      dataQuality: "conflicting",
    });
    expect(result.reasons).toContain("conflicting_signals");
    expect(result.alternatives).toEqual(
      expect.arrayContaining(["Fatigue", "Frustration"]),
    );
  });

  it("labels rapid random-like answers as only possible disengagement, never a diagnosis", () => {
    const result = classifyEvidence({
      attempts: 10,
      completedAttempts: 10,
      accuracy: 0.2,
      answerPattern: "rapid_random_like",
      medianResponseSeconds: 1,
      rapidAnswerRatio: 0.9,
      effortPattern: "variable",
    });

    expect(result).toMatchObject({
      category: "Possible disengagement",
      conclusion: "possible",
    });
    expect(JSON.stringify(result)).not.toMatch(SAFE_LANGUAGE);
  });

  it("rejects internally inconsistent attempt counts as insufficient evidence", () => {
    const inconsistent = {
      attempts: 5,
      completedAttempts: 20,
      accuracy: 0.2,
      effortPattern: "steady",
    } satisfies EvidenceSignals;

    const result = classifyEvidence(inconsistent);
    expect(result).toMatchObject({
      category: "Insufficient evidence",
      conclusion: "insufficient",
    });
    expect(result.reasons).toContain("invalid_signal");
  });

  it("rejects malformed runtime evidence flags and enums with a fixed safe result", () => {
    const hostile = [
      { fatigueReported: "yes" },
      { frustrationReported: 1 },
      { effortPattern: "lazy" },
      { performanceTrend: "collapsed" },
      { answerPattern: "careless" },
      { supportTransition: "abandoned" },
    ] as unknown as EvidenceSignals[];

    for (const signals of hostile) {
      expect(() => classifyEvidence(signals)).not.toThrow();
      expect(classifyEvidence(signals)).toMatchObject({
        category: "Insufficient evidence",
        conclusion: "insufficient",
        reasons: ["invalid_signal"],
      });
    }
  });

  it("never echoes accidental PII over a deterministic hostile evidence corpus", () => {
    let seed = 0xa11ce;
    const random = (): number => {
      seed = (seed * 1_103_515_245 + 12_345) >>> 0;
      return seed / 0x1_0000_0000;
    };

    for (let index = 0; index < 250; index += 1) {
      const signals = {
        attempts: Math.floor(random() * 20),
        accuracy: random(),
        confidenceChecks: Math.floor(random() * 5),
        averageConfidence: random(),
        pauseCount: Math.floor(random() * 8),
        technicalIssueCount: random() < 0.1 ? 1 : 0,
        interruptionCount: random() < 0.1 ? 1 : 0,
        approvedBreakCount: Math.floor(random() * 5),
        studentName: "PRIVATE STUDENT",
        email: "private@example.invalid",
      } as unknown as EvidenceSignals;
      const first = classifyEvidence(signals);
      const second = classifyEvidence(signals);

      expect(second).toEqual(first);
      expect(JSON.stringify(first)).not.toMatch(
        /PRIVATE STUDENT|private@example\.invalid|studentName|email/,
      );
      expect(first.safeSummary).not.toMatch(SAFE_LANGUAGE);
    }
  });
});
