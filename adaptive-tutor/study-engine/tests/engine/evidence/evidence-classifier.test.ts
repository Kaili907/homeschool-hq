import { describe, expect, it } from "vitest";

import {
  EVIDENCE_CATEGORIES,
  classifyEvidence,
  type EvidenceSignals,
} from "../../../engine/evidence";

describe("classifyEvidence", () => {
  it("exports exactly the required evidence categories", () => {
    expect(EVIDENCE_CATEGORIES).toEqual([
      "Concept difficulty",
      "Missing prerequisite",
      "Fatigue",
      "Interruption",
      "Technical issue",
      "Frustration",
      "Low confidence",
      "Support removed too quickly",
      "Possible disengagement",
      "Insufficient evidence",
    ]);
  });

  it.each([
    {
      name: "concept difficulty from low accuracy and steady effort",
      signals: { attempts: 4, accuracy: 0.55, effortPattern: "steady" },
      category: "Concept difficulty",
    },
    {
      name: "missing prerequisite from checked prerequisite performance",
      signals: { prerequisiteChecks: 2, prerequisiteAccuracy: 0.5 },
      category: "Missing prerequisite",
    },
    {
      name: "fatigue from a direct learner report",
      signals: { fatigueReported: true },
      category: "Fatigue",
    },
    {
      name: "interruption from an observed interruption",
      signals: { interruptionCount: 1 },
      category: "Interruption",
    },
    {
      name: "technical issue from an observed technical event",
      signals: { technicalIssueCount: 1 },
      category: "Technical issue",
    },
    {
      name: "frustration from a direct learner report",
      signals: { frustrationReported: true },
      category: "Frustration",
    },
    {
      name: "low confidence from a confidence check",
      signals: { confidenceChecks: 1, averageConfidence: 0.35 },
      category: "Low confidence",
    },
    {
      name: "support removed too quickly from guided-independent contrast",
      signals: {
        guidedAttempts: 2,
        guidedAccuracy: 0.75,
        independentAttempts: 2,
        independentAccuracy: 0.5,
        supportTransition: "abrupt",
      },
      category: "Support removed too quickly",
    },
    {
      name: "possible disengagement from repeated rapid random-like responses",
      signals: {
        attempts: 5,
        answerPattern: "rapid_random_like",
        medianResponseSeconds: 3,
        rapidAnswerRatio: 0.6,
      },
      category: "Possible disengagement",
    },
  ] as const)("$name", ({ signals, category }) => {
    const result = classifyEvidence(signals);

    expect(result.category).toBe(category);
    expect(result.conclusion).toBe("possible");
    expect(result.safeSummary.length).toBeGreaterThan(20);
  });

  it("uses declining performance plus repeated pauses only as possible fatigue", () => {
    const result = classifyEvidence({
      attempts: 5,
      pauseCount: 3,
      performanceTrend: "declining",
    });

    expect(result).toMatchObject({
      category: "Fatigue",
      conclusion: "possible",
      reasons: ["declining_performance_with_pauses"],
    });
  });

  it("returns insufficient evidence for sparse performance data", () => {
    expect(
      classifyEvidence({
        attempts: 3,
        accuracy: 0.2,
        effortPattern: "steady",
      }),
    ).toMatchObject({
      category: "Insufficient evidence",
      conclusion: "insufficient",
      dataQuality: "sparse",
      reasons: ["insufficient_observations"],
    });
  });

  it("keeps high accuracy with unexplained pauses ambiguous", () => {
    const result = classifyEvidence({
      attempts: 6,
      accuracy: 0.9,
      pauseCount: 3,
    });

    expect(result).toMatchObject({
      category: "Insufficient evidence",
      conclusion: "insufficient",
      dataQuality: "conflicting",
    });
    expect(result.alternatives).toEqual(
      expect.arrayContaining(["Fatigue", "Interruption"]),
    );
  });

  it("returns insufficient evidence for equally strong fatigue and frustration reports", () => {
    const result = classifyEvidence({
      fatigueReported: true,
      frustrationReported: true,
    });

    expect(result.category).toBe("Insufficient evidence");
    expect(result.reasons).toContain("conflicting_signals");
    expect(result.alternatives).toEqual(["Fatigue", "Frustration"]);
  });

  it("returns insufficient evidence when low confidence conflicts with concept difficulty", () => {
    const result = classifyEvidence({
      attempts: 5,
      accuracy: 0.4,
      effortPattern: "steady",
      confidenceChecks: 2,
      averageConfidence: 0.2,
    });

    expect(result.category).toBe("Insufficient evidence");
    expect(result.alternatives).toEqual(
      expect.arrayContaining(["Concept difficulty", "Low confidence"]),
    );
  });

  it("treats technical issues as contaminating evidence rather than learner failure", () => {
    const result = classifyEvidence({
      attempts: 8,
      accuracy: 0.1,
      effortPattern: "steady",
      technicalIssueCount: 2,
    });

    expect(result).toMatchObject({
      category: "Technical issue",
      conclusion: "possible",
      dataQuality: "contaminated",
    });
    expect(result.alternatives).toContain("Concept difficulty");
  });

  it("does not use approved breaks as negative evidence", () => {
    const result = classifyEvidence({ approvedBreakCount: 99 });

    expect(result.category).toBe("Insufficient evidence");
    expect(result.reasons).toContain("approved_breaks_excluded");
    expect(result.alternatives).toEqual([]);
  });

  it.each([
    { attempts: -1 },
    { attempts: 1.5 },
    { accuracy: -0.01 },
    { accuracy: 1.01 },
    { accuracy: Number.NaN },
    { pauseCount: Number.POSITIVE_INFINITY },
    { medianResponseSeconds: -1 },
  ] as readonly EvidenceSignals[])(
    "rejects invalid numeric evidence conservatively: %o",
    (signals) => {
      expect(classifyEvidence(signals)).toMatchObject({
        category: "Insufficient evidence",
        conclusion: "insufficient",
        reasons: ["invalid_signal"],
      });
    },
  );

  it("applies exact minimum boundaries without rounding", () => {
    expect(
      classifyEvidence({
        attempts: 4,
        accuracy: 0.55,
        effortPattern: "steady",
      }).category,
    ).toBe("Concept difficulty");
    expect(
      classifyEvidence({
        attempts: 4,
        accuracy: 0.550_000_000_1,
        effortPattern: "steady",
      }).category,
    ).toBe("Insufficient evidence");

    expect(
      classifyEvidence({
        attempts: 5,
        answerPattern: "rapid_random_like",
        medianResponseSeconds: 3,
        rapidAnswerRatio: 0.6,
      }).category,
    ).toBe("Possible disengagement");
    expect(
      classifyEvidence({
        attempts: 5,
        answerPattern: "rapid_random_like",
        medianResponseSeconds: 3.000_000_001,
        rapidAnswerRatio: 0.6,
      }).category,
    ).toBe("Insufficient evidence");
  });
});
