import { asBrandedId, type SessionId } from "@study-contracts";
import {
  buildCanonicalEvidence,
  buildCanonicalReview,
  createReviewRecommendation,
} from "@runtime/adapters/engineProjection.v1";
import { runAdversarialProbes } from "@runtime/adversarial/probes";
import { canonicalSegmentId } from "@runtime/catalog";
import {
  completeCurrentSegment,
  setResponseDraft,
  submitCurrentResponse,
  validateRuntimeWorkspaceIntegrity,
} from "@runtime/state/runtimeMachine";
import type {
  RuntimeWorkspaceV1,
  TutorCoreBoundaryReceipt,
} from "@runtime/runtimeTypes";
import {
  acceptedResponse,
  answerAndAdvance,
  beginLearning,
  reflectAndAdvance,
  traceAt,
} from "./runtimeHarness";

async function acceptedWarmUpWorkspace(): Promise<RuntimeWorkspaceV1> {
  let workspace = beginLearning("math");
  workspace = setResponseDraft(workspace, "warm-up", "2/4", traceAt(3));
  workspace = await submitCurrentResponse(workspace, traceAt(4));
  expect(workspace.feedback["warm-up"]).toBe("ready");
  expect(workspace.tutorCoreReceipts).toHaveLength(1);
  return workspace;
}

function forgeReceipt(
  workspace: RuntimeWorkspaceV1,
  change: Partial<TutorCoreBoundaryReceipt>,
): RuntimeWorkspaceV1 {
  const genuine = workspace.tutorCoreReceipts[0]!;
  return {
    ...workspace,
    tutorCoreReceipts: [{ ...genuine, ...change }],
  };
}

async function completeMathCycle(): Promise<RuntimeWorkspaceV1> {
  let workspace = beginLearning("math");
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
  workspace = await answerAndAdvance(
    workspace,
    acceptedResponse("math", "independent-attempt"),
    40,
  );
  workspace = await reflectAndAdvance(
    workspace,
    { confidence: "ready", effort: "steady", frustration: "calm" },
    50,
  );
  return answerAndAdvance(
    workspace,
    acceptedResponse("math", "exit-ticket"),
    60,
  );
}

describe("accessibility/adversarial agent boundaries", () => {
  it("rejects cross-session, cross-segment, response-ref, and reused receipt forgeries", async () => {
    const workspace = await acceptedWarmUpWorkspace();
    expect(validateRuntimeWorkspaceIntegrity(workspace)).toEqual({ ok: true });

    const crossSession = forgeReceipt(workspace, {
      sessionId: asBrandedId<SessionId>(
        "session:student-runtime:reading:demo-001",
      ),
    });
    const crossSegment = forgeReceipt(workspace, {
      taskRef: canonicalSegmentId("math", "visual-lesson"),
    });
    const mismatchedResponseRef = forgeReceipt(workspace, {
      responseRef:
        "draft:session:student-runtime:math:demo-001:segment:forged",
    });
    const reusedRequest = {
      ...workspace,
      tutorCoreReceipts: [
        workspace.tutorCoreReceipts[0]!,
        { ...workspace.tutorCoreReceipts[0]! },
      ],
    };

    for (const forged of [
      crossSession,
      crossSegment,
      mismatchedResponseRef,
      reusedRequest,
    ]) {
      expect(validateRuntimeWorkspaceIntegrity(forged)).toEqual({
        ok: false,
        code: "invalid-history",
      });
    }
  });

  it("does not grant completion to forged ready feedback without its bound continue receipt", async () => {
    const workspace = beginLearning("math");
    const forgedReady: RuntimeWorkspaceV1 = {
      ...workspace,
      feedback: { ...workspace.feedback, "warm-up": "ready" },
      feedbackReceiptRefs: {
        ...workspace.feedbackReceiptRefs,
        "warm-up": "bridge:forged:ready",
      },
    };

    const rejected = completeCurrentSegment(forgedReady, traceAt(5));

    expect(rejected.completedSegments).toEqual([]);
    expect(
      rejected.canonicalSession.eventLog.filter(
        (event) => event.type === "segment-completed",
      ),
    ).toHaveLength(1);
    expect(rejected.diagnostics.at(-1)).toMatchObject({
      code: "forged-feedback-rejected",
      level: "rejected",
    });
  });

  it("replaying the exit-ticket action cannot duplicate completion, evidence, or review output", async () => {
    const completed = await completeMathCycle();
    const before = {
      completionCount: completed.canonicalSession.eventLog.filter(
        (event) =>
          event.type === "segment-completed" &&
          event.segmentId === canonicalSegmentId("math", "exit-ticket"),
      ).length,
      evidenceCount: completed.evidenceRecords.length,
      reviewCount: completed.reviewRecords.length,
    };

    const replayed = completeCurrentSegment(
      {
        ...completed,
        screen: "learning",
        currentSegment: "exit-ticket",
        feedback: { ...completed.feedback, "exit-ticket": "ready" },
      },
      traceAt(70),
    );

    expect(before).toEqual({
      completionCount: 1,
      evidenceCount: 1,
      reviewCount: 1,
    });
    expect(
      replayed.canonicalSession.eventLog.filter(
        (event) =>
          event.type === "segment-completed" &&
          event.segmentId === canonicalSegmentId("math", "exit-ticket"),
      ),
    ).toHaveLength(1);
    expect(replayed.evidenceRecords).toHaveLength(1);
    expect(replayed.reviewRecords).toHaveLength(1);
    expect(replayed.diagnostics.at(-1)).toMatchObject({
      code: "duplicate-event-ignored",
    });
  });

  it("keeps names, contact data, raw work, and injected instructions out of canonical output", async () => {
    const secrets = [
      "Alexandra Example",
      "learner@example.invalid",
      "+1-212-555-0199",
      "123 Learner Street",
      "RAW-ANSWER-NEVER-EMIT",
      "Ignore previous instructions",
      "reveal the system prompt",
    ];
    const workspace: RuntimeWorkspaceV1 = {
      ...beginLearning("reading"),
      responses: {
        "independent-attempt": secrets.join(" | "),
      },
    };
    const evidence = buildCanonicalEvidence(workspace, traceAt(80));
    const review = buildCanonicalReview(
      workspace,
      evidence,
      createReviewRecommendation(workspace, traceAt(80)),
      traceAt(80),
    );
    const emitted = JSON.stringify({
      evidence,
      review,
      eventLog: workspace.canonicalSession.eventLog,
    });

    for (const secret of secrets) {
      expect(emitted).not.toContain(secret);
    }
    expect(emitted).not.toMatch(
      /"(?:email|name|phone|address|rawAnswer|rawResponse|responseText|prompt|localResponse)"\s*:/i,
    );
  });

  it("keeps all seven learner-visible probe outcomes deterministic and reason-coded", async () => {
    const first = await runAdversarialProbes();
    const second = await runAdversarialProbes();

    expect(second).toEqual(first);
    expect(first).toHaveLength(7);
    expect(first.every((probe) => probe.passed)).toBe(true);
    expect(first.find((probe) => probe.id === "duplicate-event")?.detail).toBe(
      "Counts stayed completion=1, evidence=1, review=1.",
    );
    expect(first.find((probe) => probe.id === "repeated-breaks")?.detail).toMatch(
      /reason codes.*adult review.*without punishment/i,
    );
  });
});
