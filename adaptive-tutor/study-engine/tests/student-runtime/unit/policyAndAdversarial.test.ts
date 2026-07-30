import {
  inspectCoachLanguage,
  recommendFocusDuration,
  type FocusSessionEvidence,
} from "@study-engine";
import {
  resolveDurationPolicy,
} from "@runtime/adapters/engineProjection.v1";
import {
  allAdversarialProbesPass,
  runAdversarialProbes,
} from "@runtime/adversarial/probes";
import {
  canonicalSegmentId,
  defaultParentPreferences,
} from "@runtime/catalog";
import {
  completeCheckIn,
  completeCurrentSegment,
  createRuntimeWorkspace,
  requestBreak,
  resumeBreak,
  setResponseDraft,
  setTimerMode,
  submitCurrentResponse,
  tickRuntimeTimer,
  validateRuntimeWorkspaceIntegrity,
} from "@runtime/state/runtimeMachine";
import {
  acceptedResponse,
  answerAndAdvance,
  beginLearning,
  traceAt,
} from "./runtimeHarness";

describe("policy, timer, idempotency, and adversarial boundaries", () => {
  it("applies the provisional Card 5 precedence and all duration caps", async () => {
    const preferences = {
      ...defaultParentPreferences(),
      maximumDurationMinutes: 18,
      parentManualOverrideMinutes: 25,
      accommodationMaximumMinutes: 12,
      breakRange: {
        minimumMinutes: 2,
        defaultMinutes: 10,
        maximumMinutes: 6,
      },
    };
    const policy = resolveDurationPolicy(preferences, {
      targetMinutes: 28,
      accepted: true,
      evidenceSufficient: true,
    });

    expect(policy).toMatchObject({
      precedenceVersion: "card5.resolve-duration-policy.v1",
      status: "resolved",
      reasonCode: "policy.resolved",
      targetMinutes: 12,
      automaticTargetMinutes: 12,
      hardMaximumMinutes: 12,
      breakMinutes: 6,
      candidateSource: "parent-manual-override",
      candidateMinutes: 25,
      feasibleMinimumMinutes: 1,
      feasibleMaximumMinutes: 12,
      provisionalUntilCard5: false,
    });
    expect(policy.appliedReasonCodes).toContain("hard-clamp");
  });

  it("keeps visible, minimal, and hidden timer modes state-equivalent", async () => {
    let workspace = beginLearning("math");
    const canonicalBefore = workspace.canonicalSession.eventLog;
    for (const mode of ["visible", "minimal", "hidden"] as const) {
      workspace = setTimerMode(workspace, mode, traceAt(10));
      expect(workspace.timer.mode).toBe(mode);
      expect(workspace.canonicalSession.eventLog).toEqual(canonicalBefore);
    }
  });

  it("enforces the parent hard maximum and saves at the exact segment", async () => {
    const preferences = {
      ...defaultParentPreferences(),
      maximumDurationMinutes: 1,
    };
    let workspace = completeCheckIn(
      createRuntimeWorkspace("math", traceAt(0), preferences),
      "ready",
      traceAt(1),
    );
    for (let second = 0; second < 60; second += 1) {
      workspace = tickRuntimeTimer(workspace, traceAt(2 + second));
    }

    expect(workspace.screen).toBe("limit");
    expect(workspace.canonicalSession.status).toBe("paused");
    if (workspace.canonicalSession.status === "paused") {
      expect(workspace.canonicalSession.resumePoint.segmentId).toBe(
        canonicalSegmentId("math", "warm-up"),
      );
    }
    expect(workspace.timer.running).toBe(false);
  });

  it("triggers a required break after guided practice without marking failure", async () => {
    const preferences = {
      ...defaultParentPreferences(),
      requiredBreaks: true,
    };
    let workspace = completeCheckIn(
      createRuntimeWorkspace("math", traceAt(0), preferences),
      "ready",
      traceAt(1),
    );
    workspace = await answerAndAdvance(
      workspace,
      acceptedResponse("math", "warm-up"),
      10,
    );
    workspace = await answerAndAdvance(
      workspace,
      acceptedResponse("math", "visual-lesson"),
      20,
    );
    workspace = await answerAndAdvance(
      workspace,
      acceptedResponse("math", "guided-practice"),
      30,
    );

    expect(workspace.screen).toBe("break");
    expect(workspace.breakState).toMatchObject({
      returnSegment: "independent-attempt",
      countsAsFailure: false,
    });
    expect(workspace.canonicalSession.status).toBe("approved-break");
    workspace = resumeBreak(workspace, traceAt(40));
    expect(workspace.currentSegment).toBe("independent-attempt");
  });

  it("keeps assessment authority in Tutor Core and ignores a replayed completion", async () => {
    let workspace = beginLearning("math");
    workspace = setResponseDraft(
      workspace,
      "warm-up",
      "2/4",
      traceAt(3),
    );
    workspace = await submitCurrentResponse(workspace, traceAt(4));
    expect(workspace.feedback["warm-up"]).toBe("ready");
    expect(workspace.tutorCoreReceipts[0]?.ledgerAccepted).toBe(true);
    workspace = completeCurrentSegment(workspace, traceAt(5));
    const completionCount = workspace.canonicalSession.eventLog.filter(
      (event) =>
        event.type === "segment-completed" &&
        event.segmentId === canonicalSegmentId("math", "warm-up"),
    ).length;

    const replayed = completeCurrentSegment(
      {
        ...workspace,
        currentSegment: "warm-up",
        feedback: { ...workspace.feedback, "warm-up": "ready" },
      },
      traceAt(6),
    );
    expect(
      replayed.canonicalSession.eventLog.filter(
        (event) =>
          event.type === "segment-completed" &&
          event.segmentId === canonicalSegmentId("math", "warm-up"),
      ),
    ).toHaveLength(completionCount);
    expect(
      replayed.diagnostics.some(
        (entry) => entry.code === "duplicate-event-ignored",
      ),
    ).toBe(true);
  });

  it("passes all seven adversarial demonstrations with safe language", async () => {
    const probes = await runAdversarialProbes();
    expect(allAdversarialProbesPass(probes)).toBe(true);
    expect(probes.map((probe) => probe.id)).toEqual([
      "forged-completion",
      "duplicate-event",
      "privacy",
      "unsupported-version",
      "blame-language",
      "excessive-increase",
      "repeated-breaks",
    ]);
    expect(
      inspectCoachLanguage(
        "You failed because you were not focused, so you do not get a break.",
      ).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("withholds pacing increases until five comparable reliable sessions exist", async () => {
    const sessions: FocusSessionEvidence[] = Array.from(
      { length: 4 },
      (_, index) => ({
        occurredAtEpochMs: Date.parse(traceAt(index)),
        subject: "subject:math",
        taskType: "lesson-cycle",
        plannedDurationMinutes: 10,
        completedDurationMinutes: 10,
        coreOutcome: "successful",
        durationResponse: "comfortable",
        disruption: "none",
        quality: "reliable",
      }),
    );
    const insufficient = recommendFocusDuration({
      gradeBand: "elementary",
      subject: "subject:math",
      taskType: "lesson-cycle",
      currentDurationMinutes: 10,
      sessions,
      parentOverride: { mode: "automatic", maximumDurationMinutes: 30 },
    });
    const sufficient = recommendFocusDuration({
      gradeBand: "elementary",
      subject: "subject:math",
      taskType: "lesson-cycle",
      currentDurationMinutes: 10,
      sessions: [
        ...sessions,
        { ...sessions[0]!, occurredAtEpochMs: Date.parse(traceAt(20)) },
      ],
      parentOverride: { mode: "automatic", maximumDurationMinutes: 30 },
      policy: { maximumIncreaseRatio: 0.1 },
    });

    expect(insufficient.recommendation).toBe("insufficient_data");
    expect(insufficient.adjustmentMinutes).toBe(0);
    expect(sufficient.evidence.evaluatedComparableSessions).toBe(5);
    expect(sufficient.adjustmentMinutes).toBeLessThanOrEqual(1);
  });

  it("keeps forged canonical histories invalid after break activity", async () => {
    let workspace = beginLearning("math");
    workspace = requestBreak(workspace, traceAt(3));
    expect(workspace.breakState?.countsAsFailure).toBe(false);
    const forged = {
      ...workspace,
      completedSegments: ["exit-ticket" as const],
    };
    expect(validateRuntimeWorkspaceIntegrity(forged)).toEqual({
      ok: false,
      code: "invalid-history",
    });
  });
});
