import {
  completeCurrentSegment,
  requestBreak,
  resumeBreak,
  setResponseDraft,
  submitCurrentResponse,
  validateRuntimeWorkspaceIntegrity,
} from "@runtime/state/runtimeMachine";
import type { RuntimeWorkspaceV1 } from "@runtime/runtimeTypes";
import {
  acceptedResponse,
  answerAndAdvance,
  beginLearning,
  reflectAndAdvance,
  traceAt,
} from "./runtimeHarness";

async function buildDeterministicMathTrace(): Promise<RuntimeWorkspaceV1> {
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
  workspace = setResponseDraft(
    workspace,
    "independent-attempt",
    "4/10",
    traceAt(40),
  );
  workspace = requestBreak(workspace, traceAt(41));
  workspace = resumeBreak(workspace, traceAt(42));
  workspace = await submitCurrentResponse(workspace, traceAt(43));
  workspace = completeCurrentSegment(workspace, traceAt(44));
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

function canonicalTrace(workspace: RuntimeWorkspaceV1) {
  return {
    eventLog: workspace.canonicalSession.eventLog,
    completedSegments: workspace.completedSegments,
    idempotencyRecords: workspace.idempotencyRecords,
    evidenceRecords: workspace.evidenceRecords,
    reviewRecords: workspace.reviewRecords,
    engineOutputs: workspace.engineOutputs,
    tutorCoreReceipts: workspace.tutorCoreReceipts,
  };
}

describe("deterministic canonical trace", () => {
  it("produces byte-equivalent canonical output for identical inputs and times", async () => {
    const first = await buildDeterministicMathTrace();
    const second = await buildDeterministicMathTrace();

    expect(validateRuntimeWorkspaceIntegrity(first)).toEqual({ ok: true });
    expect(validateRuntimeWorkspaceIntegrity(second)).toEqual({ ok: true });
    expect(JSON.stringify(canonicalTrace(first))).toBe(
      JSON.stringify(canonicalTrace(second)),
    );
    expect(first.canonicalSession.eventLog.map((event) => event.sequence)).toEqual(
      Array.from(
        { length: first.canonicalSession.eventLog.length },
        (_, index) => index + 1,
      ),
    );
    expect(
      new Set(first.canonicalSession.eventLog.map((event) => event.id)).size,
    ).toBe(first.canonicalSession.eventLog.length);
  });
});
