import { canonicalSegmentId } from "@runtime/catalog";
import {
  completeCurrentSegment,
  validateRuntimeWorkspaceIntegrity,
} from "@runtime/state/runtimeMachine";
import { beginLearning, traceAt } from "./runtimeHarness";

describe("canonical contract agent regressions", () => {
  it("rejects forged ready feedback without a matching validated bridge receipt", () => {
    const workspace = beginLearning("math");
    const forged = {
      ...workspace,
      feedback: {
        ...workspace.feedback,
        "warm-up": "ready" as const,
      },
    };

    expect(forged.tutorCoreReceipts).toHaveLength(0);
    expect(validateRuntimeWorkspaceIntegrity(forged)).toEqual({
      ok: false,
      code: "invalid-history",
    });

    const attempted = completeCurrentSegment(forged, traceAt(3));
    expect(attempted.completedSegments).toEqual([]);
    expect(
      attempted.canonicalSession.eventLog.some(
        (event) =>
          event.type === "segment-completed" &&
          event.segmentId === canonicalSegmentId("math", "warm-up"),
      ),
    ).toBe(false);
  });
});
