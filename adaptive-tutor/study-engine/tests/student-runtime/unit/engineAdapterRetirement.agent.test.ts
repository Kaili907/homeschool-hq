import {
  asBrandedId,
  type EvidenceId,
  type SessionId,
} from "@study-contracts";
import {
  buildCanonicalEvidence,
  buildCanonicalReview,
  COMPARABLE_FOCUS_HISTORY_VERSION,
  createReviewRecommendation,
  ENGINE_PROJECTION_VERSION,
  projectFocusRecommendation,
  resolveDurationPolicy,
  type ComparableFocusHistoryRecordV1,
  type ComparableFocusHistoryV1,
} from "@runtime/adapters/engineProjection.v1";
import {
  canonicalSegmentId,
  defaultParentPreferences,
  idsFor,
} from "@runtime/catalog";
import type { RuntimeWorkspaceV1 } from "@runtime/runtimeTypes";
import { responseDraftReference } from "@runtime/state/canonicalSession";
import { beginLearning, traceAt } from "./runtimeHarness";

function verifiedHistory(
  workspace: RuntimeWorkspaceV1,
  count: number,
): ComparableFocusHistoryV1 {
  const ids = idsFor(workspace.subjectId);
  return {
    schemaVersion: COMPARABLE_FOCUS_HISTORY_VERSION,
    records: Array.from(
      { length: count },
      (_, index): ComparableFocusHistoryRecordV1 => ({
        sessionId: asBrandedId<SessionId>(
          `session:verified-history:${workspace.subjectId}:${index}`,
        ),
        evidenceId: asBrandedId<EvidenceId>(
          `evidence:verified-history:${workspace.subjectId}:${index}`,
        ),
        subjectId: ids.subjectId,
        taskType: "lesson-cycle",
        occurredAt: new Date(
          Date.parse("2026-07-20T14:00:00.000Z") + index * 86_400_000,
        ).toISOString(),
        plannedDurationMinutes: workspace.durationPolicy.targetMinutes,
        completedDurationMinutes: workspace.durationPolicy.targetMinutes,
        coreOutcome: "successful",
        durationResponse: "comfortable",
        disruption: index === 2 ? "approved_break" : "none",
        quality: "reliable",
        coreOutcomeAuthority: "verified-tutor-core",
        durationEvidenceAuthority:
          "canonical-session-and-learner-report",
      }),
    ),
  };
}

describe("engine adapter retirement", () => {
  it("never fabricates comparable history for a first runtime session", () => {
    const workspace = beginLearning("math");
    const recommendation = projectFocusRecommendation(workspace, traceAt(80));

    expect(ENGINE_PROJECTION_VERSION).toBe(
      "student-runtime.engine-projection.v2",
    );
    expect(recommendation.recommendation).toBe("insufficient_data");
    expect(recommendation.adjustmentMinutes).toBe(0);
    expect(recommendation.evidence).toMatchObject({
      availableComparableSessions: 1,
      evaluatedComparableSessions: 1,
      successfulSessions: 0,
    });
  });

  it("accepts only explicit unique history and keeps increases at ten percent or less", () => {
    const workspace = beginLearning("math");
    const recommendation = projectFocusRecommendation(
      workspace,
      traceAt(80),
      verifiedHistory(workspace, 4),
    );

    expect(recommendation.evidence.evaluatedComparableSessions).toBe(5);
    expect(recommendation.evidence.successfulSessions).toBe(4);
    expect(recommendation.recommendation).toBe("increase");
    expect(
      recommendation.adjustmentMinutes /
        recommendation.currentDurationMinutes,
    ).toBeLessThanOrEqual(0.1);

    const records = verifiedHistory(workspace, 4).records;
    const duplicated = projectFocusRecommendation(workspace, traceAt(80), {
      schemaVersion: COMPARABLE_FOCUS_HISTORY_VERSION,
      records: [...records, records[0]!],
    });
    expect(duplicated.recommendation).toBe("insufficient_data");
    expect(duplicated.evidence.evaluatedComparableSessions).toBe(4);
  });

  it("does not turn temporary continue/reteach directives into academic evidence", () => {
    const base = beginLearning("reading");
    const workspace: RuntimeWorkspaceV1 = {
      ...base,
      reflection: {
        confidence: "not-yet",
        effort: "steady",
        frustration: "some",
      },
      tutorCoreReceipts: [
        {
          bridgeVersion: "student-runtime.session6-bridge.v2",
          requestId: `bridge:${base.canonicalSession.id}:${canonicalSegmentId("reading", "warm-up")}:1`,
          sessionId: base.canonicalSession.id,
          taskRef: canonicalSegmentId("reading", "warm-up"),
          responseRef: responseDraftReference(
            base.canonicalSession.id,
            canonicalSegmentId("reading", "warm-up"),
          ),
          submissionRevision: base.resumeRevision,
          directive: "continue",
          masteryAuthority: "withheld-pending-tutor-core",
          misconceptionAuthority: "withheld-pending-tutor-core",
          reasonCode: "demo-rubric-accepted",
          occurredAt: "2026-07-29T02:00:00.000Z",
        },
      ],
    };
    const evidence = buildCanonicalEvidence(
      workspace,
      "2026-07-29T02:00:00.000Z",
    );
    const recommendation = createReviewRecommendation(
      workspace,
      "2026-07-29T02:00:00.000Z",
    );
    const review = buildCanonicalReview(
      workspace,
      evidence,
      recommendation,
      "2026-07-29T02:00:00.000Z",
    );

    expect(evidence).not.toHaveProperty("accuracy");
    expect(evidence).not.toHaveProperty("independence");
    expect(evidence).not.toHaveProperty("tutorIntervention");
    expect(evidence).not.toHaveProperty("masteryOutcome");
    expect(evidence).not.toHaveProperty("prerequisiteGapOutcome");
    expect(recommendation.reviewedOn).toBe("2026-07-28");
    expect(recommendation.reasons).toContain(
      "insufficient_retrieval_evidence",
    );
    expect(review.timeZone).toBe("America/New_York");
    expect(review.retrievalAttempts).toEqual([]);

    const serialized = JSON.stringify({ evidence, review });
    expect(serialized).not.toMatch(/email|studentName|rawAnswer|responseText/i);
    expect(serialized).not.toContain("demo-rubric-accepted");
  });

  it("uses Card 5 constraint reduction, evidence gates, and manual review", () => {
    const constrained = {
      ...defaultParentPreferences(),
      maximumDurationMinutes: 18,
      parentManualOverrideMinutes: 25,
      accommodationMaximumMinutes: 12,
    };
    const resolved = resolveDurationPolicy(
      constrained,
      { targetMinutes: 28, accepted: true, evidenceSufficient: true },
      14,
    );

    expect(resolved).toMatchObject({
      precedenceVersion: "card5.resolve-duration-policy.v1",
      status: "resolved",
      reasonCode: "policy.resolved",
      targetMinutes: 12,
      automaticTargetMinutes: 12,
      hardMaximumMinutes: 12,
      candidateSource: "parent-manual-override",
      candidateMinutes: 25,
      feasibleMinimumMinutes: 1,
      feasibleMaximumMinutes: 12,
      provisionalUntilCard5: false,
    });
    expect(resolved.appliedReasonCodes).toContain("hard-clamp");

    const established = resolveDurationPolicy(
      {
        ...defaultParentPreferences(),
        parentManualOverrideMinutes: undefined,
      },
      { targetMinutes: 28, accepted: true, evidenceSufficient: false },
      14,
    );
    expect(established.candidateSource).toBe("established-target");
    expect(established.targetMinutes).toBe(14);

    const infeasible = resolveDurationPolicy({
      ...defaultParentPreferences(),
      maximumDurationMinutes: 0,
    });
    expect(infeasible).toMatchObject({
      status: "manual-review",
      reasonCode: "policy.infeasible-constraints",
      candidateSource: "manual-review",
      feasibleMinimumMinutes: 1,
      feasibleMaximumMinutes: 0,
      provisionalUntilCard5: false,
    });
    expect(infeasible).not.toHaveProperty("automaticTargetMinutes");
    expect(infeasible).not.toHaveProperty("candidateMinutes");
  });
});
