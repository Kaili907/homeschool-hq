import {
  asBrandedId,
  type SessionId,
} from "@study-contracts";
import { canonicalSegmentId } from "@runtime/catalog";
import {
  completeCurrentSegment,
  createRuntimeWorkspace,
  hasMatchingStrictBridgeReceipt,
  recordLearnerSupportAction,
  setResponseDraft,
  submitCurrentResponse,
  validateRuntimeWorkspaceIntegrity,
} from "@runtime/state/runtimeMachine";
import {
  acceptedResponse,
  beginLearning,
  traceAt,
} from "./runtimeHarness";

describe("persistence and duplicate-event agent regressions", () => {
  it("keeps a caller-supplied opaque session ID immutable across canonical events", () => {
    const sessionId = asBrandedId<SessionId>(
      "ses_01K2R4V9Q2M7T5X8N3C6H0PWAB",
    );
    const workspace = createRuntimeWorkspace(
      "math",
      traceAt(0),
      undefined,
      sessionId,
    );

    expect(workspace.canonicalSession.id).toBe(sessionId);
    expect(
      workspace.canonicalSession.eventLog.every(
        (event) => event.sessionId === sessionId,
      ),
    ).toBe(true);
  });

  it("binds ready feedback to one exact v2 session/SegmentId/draft receipt", () => {
    let workspace = beginLearning("math");
    workspace = setResponseDraft(
      workspace,
      "warm-up",
      acceptedResponse("math", "warm-up"),
      traceAt(3),
    );
    workspace = submitCurrentResponse(workspace, traceAt(4));

    expect(hasMatchingStrictBridgeReceipt(workspace, "warm-up")).toBe(true);
    expect(workspace.tutorCoreReceipts[0]).toMatchObject({
      bridgeVersion: "student-runtime.session6-bridge.v2",
      sessionId: workspace.canonicalSession.id,
      taskRef: canonicalSegmentId("math", "warm-up"),
    });

    const forged = {
      ...workspace,
      feedbackReceiptRefs: {
        ...workspace.feedbackReceiptRefs,
        "warm-up": "bridge:forged:receipt",
      },
    };
    expect(validateRuntimeWorkspaceIntegrity(forged)).toEqual({
      ok: false,
      code: "invalid-history",
    });
    const attempted = completeCurrentSegment(forged, traceAt(5));
    expect(attempted.completedSegments).toEqual([]);
    expect(
      attempted.diagnostics.some(
        (entry) => entry.code === "forged-feedback-rejected",
      ),
    ).toBe(true);
  });

  it("rejects same command ID with a different canonical payload fingerprint", () => {
    let workspace = beginLearning("math");
    workspace = setResponseDraft(
      workspace,
      "warm-up",
      acceptedResponse("math", "warm-up"),
      traceAt(3),
    );
    workspace = submitCurrentResponse(workspace, traceAt(4));
    workspace = completeCurrentSegment(workspace, traceAt(5));
    const completionCount = workspace.canonicalSession.eventLog.filter(
      (event) =>
        event.type === "segment-completed" &&
        event.segmentId === canonicalSegmentId("math", "warm-up"),
    ).length;
    const forged = {
      ...workspace,
      currentSegment: "warm-up" as const,
      idempotencyRecords: workspace.idempotencyRecords.map((record) =>
        record.kind === "segment-completion" &&
        record.commandId.includes(canonicalSegmentId("math", "warm-up"))
          ? { ...record, payloadFingerprint: "segment-completion.v2|forged" }
          : record,
      ),
    };

    const attempted = completeCurrentSegment(forged, traceAt(6));
    expect(
      attempted.canonicalSession.eventLog.filter(
        (event) =>
          event.type === "segment-completed" &&
          event.segmentId === canonicalSegmentId("math", "warm-up"),
      ),
    ).toHaveLength(completionCount);
    expect(
      attempted.diagnostics.some(
        (entry) => entry.code === "idempotency-conflict-rejected",
      ),
    ).toBe(true);
  });

  it("guards support transcript revisions and no-audio fallback centrally", () => {
    const workspace = beginLearning("reading");
    const next = recordLearnerSupportAction(
      workspace,
      "Read this to me",
      {
        speechInputAvailable: false,
        speechOutputAvailable: false,
      },
      traceAt(3),
    );

    expect(next.resumeRevision).toBe(workspace.resumeRevision + 1);
    expect(next.transcript.at(-1)).toMatchObject({
      reasonCode: "read-aloud-text-fallback",
      text: expect.stringMatching(/complete instruction remains on screen/i),
    });
  });
});
