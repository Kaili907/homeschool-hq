import { describe, expect, it } from "vitest";
import { runAcceptedStudyCoreBridge } from "../../../integration-labs/student-runtime/src/bridges/acceptedStudyCoreBridge";
import {
  asBrandedId,
  type SegmentId,
  type SessionId,
} from "@study-contracts";

function request(localResponse: string) {
  return {
    requestId: `bridge:test:${localResponse}`,
    sessionId: asBrandedId<SessionId>("session_01K1S2V8Q4M7T9X5N3C6H0PWAB"),
    lessonId: "lesson_math",
    taskRef: asBrandedId<SegmentId>("seg_01K1S2V8Q4M7T9X5N3C6H0PWAB"),
    subjectId: "math" as const,
    skillId: "math-equivalent-fractions",
    responseRef: "protected-draft:test",
    submissionRevision: 1,
    localResponse,
    expectedAnswer: "2/4",
    occurredAt: "2026-07-29T12:00:00.000Z",
    learnerLocalDate: "2026-07-29",
    householdTimeZone: "America/New_York",
    taskType: "retrieval-practice" as const,
    priorAcceptedEvents: [],
  };
}

describe("accepted Study-Core bridge", () => {
  it("uses Tutor Core scoring for correct and incorrect choices", async () => {
    const correct = await runAcceptedStudyCoreBridge(request("2/4"));
    const incorrect = await runAcceptedStudyCoreBridge(request("1/3"));
    expect(correct.ok && correct.receipt.directive).toBe("continue");
    expect(incorrect.ok && incorrect.receipt.directive).toBe("reteach");
  });
});
