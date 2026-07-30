import { describe, expect, it } from "vitest";

import {
  EVIDENCE_CATEGORIES,
  classifyEvidence,
  type EvidenceSignals,
} from "../../../engine/evidence";

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const bannedLanguage = [
  "you were not paying attention",
  "you failed because you did not focus",
  "you should be able to sit longer",
  "permanent attention span",
  "has adhd",
  "is lazy",
];

describe("evidence classifier safety properties", () => {
  it("is deterministic across a fixed fixture set", () => {
    const fixtures: readonly EvidenceSignals[] = [
      {},
      { technicalIssueCount: 1, attempts: 8, accuracy: 0 },
      { guidedAttempts: 3, guidedAccuracy: 1, independentAttempts: 3, independentAccuracy: 0 },
      { fatigueReported: true, frustrationReported: true },
      { attempts: 10, accuracy: 0.8, pauseCount: 5 },
    ];

    for (const fixture of fixtures) {
      expect(classifyEvidence(fixture)).toEqual(classifyEvidence(fixture));
    }
  });

  it("keeps randomized valid inputs inside the closed output vocabulary", () => {
    const random = seededRandom(0x5eed_cafe);
    const efforts = ["steady", "variable", "unknown"] as const;
    const trends = ["improving", "stable", "declining", "unknown"] as const;
    const answers = ["considered", "rapid_random_like", "unknown"] as const;
    const transitions = ["gradual", "abrupt", "unchanged", "unknown"] as const;

    for (let index = 0; index < 750; index += 1) {
      const signals: EvidenceSignals = {
        attempts: Math.floor(random() * 12),
        accuracy: random(),
        guidedAttempts: Math.floor(random() * 5),
        guidedAccuracy: random(),
        independentAttempts: Math.floor(random() * 5),
        independentAccuracy: random(),
        prerequisiteChecks: Math.floor(random() * 4),
        prerequisiteAccuracy: random(),
        confidenceChecks: Math.floor(random() * 3),
        averageConfidence: random(),
        pauseCount: Math.floor(random() * 7),
        interruptionCount: Math.floor(random() * 2),
        technicalIssueCount: Math.floor(random() * 2),
        medianResponseSeconds: random() * 20,
        rapidAnswerRatio: random(),
        fatigueReported: random() > 0.9,
        frustrationReported: random() > 0.9,
        effortPattern: efforts[Math.floor(random() * efforts.length)],
        performanceTrend: trends[Math.floor(random() * trends.length)],
        answerPattern: answers[Math.floor(random() * answers.length)],
        supportTransition:
          transitions[Math.floor(random() * transitions.length)],
        approvedBreakCount: Math.floor(random() * 5),
      };

      const first = classifyEvidence(signals);
      const second = classifyEvidence(signals);
      expect(first).toEqual(second);
      expect(EVIDENCE_CATEGORIES).toContain(first.category);
      expect(["possible", "insufficient"]).toContain(first.conclusion);
      expect(first.safeSummary.trim().length).toBeGreaterThan(0);
      expect(bannedLanguage.some((phrase) =>
        first.safeSummary.toLowerCase().includes(phrase),
      )).toBe(false);
    }
  });

  it("does not reflect identity, notes, or other unexpected private fields", () => {
    const untrustedRuntimeInput = {
      fatigueReported: true,
      studentName: "PRIVATE_NAME_6ddc",
      studentId: "PRIVATE_ID_a82f",
      freeTextNote: "PRIVATE_NOTE_11aa",
    } as EvidenceSignals;

    const serialized = JSON.stringify(classifyEvidence(untrustedRuntimeInput));

    expect(serialized).not.toContain("PRIVATE_NAME_6ddc");
    expect(serialized).not.toContain("PRIVATE_ID_a82f");
    expect(serialized).not.toContain("PRIVATE_NOTE_11aa");
  });

  it("never emits diagnosis, blame, permanence, or required forbidden phrases", () => {
    const adversarialFixtures: readonly EvidenceSignals[] = [
      {
        attempts: 100,
        accuracy: 0,
        answerPattern: "rapid_random_like",
        medianResponseSeconds: 0,
        rapidAnswerRatio: 1,
      },
      {
        attempts: 100,
        accuracy: 1,
        pauseCount: 100,
        fatigueReported: true,
      },
      {
        attempts: 10,
        accuracy: 0,
        effortPattern: "steady",
        frustrationReported: true,
      },
    ];

    for (const fixture of adversarialFixtures) {
      const resultText = JSON.stringify(classifyEvidence(fixture)).toLowerCase();
      for (const phrase of bannedLanguage) {
        expect(resultText).not.toContain(phrase);
      }
    }
  });
});
