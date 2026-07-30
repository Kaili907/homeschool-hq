import {
  mapStudyUxIntent,
  stableCompletionKey,
} from "../../../ui/integrationAdapter";

describe("study UX integration adapter", () => {
  it("maps learning completions without inferring mastery", () => {
    expect(
      mapStudyUxIntent({
        type: "ui/segment-completed",
        sessionRef: "opaque-session",
        subjectId: "math",
        segment: "guided-practice",
        completionKey: stableCompletionKey("opaque-session", "guided-practice"),
        at: "2026-07-28T12:00:00.000Z",
      }),
    ).toEqual({
      orchestratorEvent: {
        type: "guided_practice_completed",
        at: "2026-07-28T12:00:00.000Z",
      },
      reason: "forward",
    });
  });

  it("leaves confidence interpretation to the authoritative core", () => {
    expect(
      mapStudyUxIntent({
        type: "ui/segment-completed",
        sessionRef: "opaque-session",
        subjectId: "reading",
        segment: "self-check",
        completionKey: stableCompletionKey("opaque-session", "self-check"),
        at: "2026-07-28T12:00:00.000Z",
      }),
    ).toEqual({ reason: "requires-core-directive" });
  });

  it("keeps mid-segment break recovery and technical recovery UI-local", () => {
    expect(
      mapStudyUxIntent({
        type: "ui/break-returned",
        sessionRef: "opaque-session",
        returnSegment: "independent-attempt",
        lifecycleBreak: false,
        at: "2026-07-28T12:00:00.000Z",
      }),
    ).toEqual({ reason: "ui-local" });
    expect(
      mapStudyUxIntent({
        type: "ui/technical-interruption",
        sessionRef: "opaque-session",
        recoveryKey: "technical:opaque-session:runtime-a",
        returnSegment: "independent-attempt",
        at: "2026-07-28T12:00:01.000Z",
      }),
    ).toEqual({ reason: "ui-local" });
  });
});
