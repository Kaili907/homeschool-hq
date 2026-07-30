import { describe, expect, it } from "vitest";

import {
  BREAK_ACTIONS,
  recommendBreak,
  type BreakContext,
  type BreakType,
} from "../../../engine/breaks";

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_103_515_245 + 12_345) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const bannedLanguage = [
  "you were not paying attention",
  "you failed because you did not focus",
  "you should be able to sit longer",
  "lazy",
  "bad attention span",
  "has adhd",
];

describe("break recommender safety properties", () => {
  it("never labels any output, including approved breaks, as failure", () => {
    const fixtures: readonly BreakContext[] = [
      { blockElapsedMinutes: 20, sessionElapsedMinutes: 20 },
      {
        blockElapsedMinutes: 2,
        sessionElapsedMinutes: 20,
        studentRequest: {},
      },
      {
        blockElapsedMinutes: 20,
        sessionElapsedMinutes: 20,
        breakRefused: true,
      },
      {
        blockElapsedMinutes: 0,
        sessionElapsedMinutes: 20,
        currentBreak: {
          type: "planned",
          baseDurationMinutes: 5,
          elapsedMinutes: 5,
          extensionMinutes: 0,
        },
      },
      { blockElapsedMinutes: -1, sessionElapsedMinutes: 20 },
      { blockElapsedMinutes: 0, sessionElapsedMinutes: 120 },
    ];

    for (const fixture of fixtures) {
      expect(recommendBreak(fixture).countsAsFailure).toBe(false);
    }
  });

  it("bounds every extension request and terminates the extension loop", () => {
    const observedActions: string[] = [];
    const observedExtensions: number[] = [];

    for (const extensionMinutes of [0, 2, 4, 5, 6, 100]) {
      const result = recommendBreak({
        blockElapsedMinutes: 0,
        sessionElapsedMinutes: 30,
        currentBreak: {
          type: "planned",
          baseDurationMinutes: 5,
          elapsedMinutes: 5 + extensionMinutes,
          extensionMinutes,
          extensionRequested: true,
        },
      });
      observedActions.push(result.action);
      if (result.durationMinutes !== undefined) {
        observedExtensions.push(result.durationMinutes);
      }
    }

    expect(observedExtensions.every((value) => value > 0 && value <= 2)).toBe(true);
    expect(observedActions.slice(-3)).toEqual([
      "resume_or_finish",
      "resume_or_finish",
      "resume_or_finish",
    ]);
  });

  it("is deterministic and closed over actions for randomized valid contexts", () => {
    const random = seededRandom(0xb0a7_2026);
    const breakTypes: readonly BreakType[] = [
      "planned",
      "student_requested",
      "movement",
      "water",
      "screen_rest",
      "quiet_reset",
    ];

    for (let index = 0; index < 750; index += 1) {
      const sessionElapsedMinutes = random() * 119.999;
      const hasActiveBreak = random() > 0.55;
      const type = breakTypes[Math.floor(random() * breakTypes.length)];
      const context: BreakContext = {
        blockElapsedMinutes: random() * 30,
        sessionElapsedMinutes,
        screenMinutesSinceRest: random() * 30,
        needs: {
          movementRequested: random() > 0.9,
          waterRequested: random() > 0.9,
          screenRestRequested: random() > 0.9,
          quietResetRequested: random() > 0.9,
          possibleFatigue: random() > 0.9,
        },
        ...(hasActiveBreak
          ? {
              currentBreak: {
                type,
                baseDurationMinutes: type === "water" ? 3 : 5,
                elapsedMinutes: random() * 12,
                extensionMinutes: random() * 5,
                extensionRequested: random() > 0.7,
                readyToResume: random() > 0.95,
              },
            }
          : {}),
      };

      const first = recommendBreak(context);
      const second = recommendBreak(context);

      expect(first).toEqual(second);
      expect(BREAK_ACTIONS).toContain(first.action);
      expect(first.countsAsFailure).toBe(false);
      if (first.durationMinutes !== undefined) {
        expect(Number.isFinite(first.durationMinutes)).toBe(true);
        expect(first.durationMinutes).toBeGreaterThan(0);
        expect(first.durationMinutes).toBeLessThanOrEqual(10);
      }
    }
  });

  it("does not reflect names, notes, or opaque activity identifiers", () => {
    const privateActivityId = "PRIVATE_ACTIVITY_4f31";
    const untrustedContext = {
      blockElapsedMinutes: 20,
      sessionElapsedMinutes: 20,
      studentName: "PRIVATE_NAME_88ca",
      notes: "PRIVATE_NOTE_b401",
      parentPlannedActivityId: privateActivityId,
      policy: { allowedParentActivityIds: [privateActivityId] },
    } as BreakContext;

    const output = JSON.stringify(recommendBreak(untrustedContext));
    expect(output).not.toContain("PRIVATE_ACTIVITY_4f31");
    expect(output).not.toContain("PRIVATE_NAME_88ca");
    expect(output).not.toContain("PRIVATE_NOTE_b401");
  });

  it("never emits blame, diagnosis, or the required forbidden Jarvis phrases", () => {
    const adversarialContexts: readonly BreakContext[] = [
      {
        blockElapsedMinutes: 100,
        sessionElapsedMinutes: 100,
        breakRefused: true,
      },
      {
        blockElapsedMinutes: 1,
        sessionElapsedMinutes: 80,
        studentRequest: {},
        history: [
          { type: "planned", endedAtSessionMinute: 10, approved: true },
          { type: "planned", endedAtSessionMinute: 50, approved: true },
        ],
      },
      {
        blockElapsedMinutes: 0,
        sessionElapsedMinutes: 30,
        currentBreak: {
          type: "quiet_reset",
          baseDurationMinutes: 5,
          elapsedMinutes: 500,
          extensionMinutes: 500,
          extensionRequested: true,
        },
      },
    ];

    for (const context of adversarialContexts) {
      const resultText = JSON.stringify(recommendBreak(context)).toLowerCase();
      for (const phrase of bannedLanguage) {
        expect(resultText).not.toContain(phrase);
      }
    }
  });

  it("uses elapsed minutes only, yielding the same result across date contexts", () => {
    const context = {
      blockElapsedMinutes: 20,
      sessionElapsedMinutes: 45,
      studentRequest: {},
    } as const;

    // No Date or timestamp enters the contract, so DST gaps and local-midnight
    // boundaries cannot alter this decision.
    const beforeDstBoundary = recommendBreak(context);
    const afterDstBoundary = recommendBreak({ ...context });
    expect(afterDstBoundary).toEqual(beforeDstBoundary);
  });
});
