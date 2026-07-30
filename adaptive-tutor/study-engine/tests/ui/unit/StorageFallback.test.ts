import {
  createEmptyWorkspace,
  getActiveSession,
  hydrateWorkspace,
  studyReducer,
} from "../../../prototype/src/sessionStore";

describe("local persistence fallback", () => {
  it("continues with an empty local workspace when storage reads are blocked", () => {
    const blockedStorage: Pick<Storage, "getItem"> = {
      getItem() {
        throw new DOMException("Blocked", "SecurityError");
      },
    };
    expect(hydrateWorkspace(blockedStorage, "blocked-runtime")).toEqual(
      createEmptyWorkspace(),
    );
  });

  it("preserves an unsubmitted check-in choice for recovery", () => {
    let state = studyReducer(createEmptyWorkspace(), {
      type: "start_or_resume",
      subjectId: "math",
      at: "2026-07-28T12:00:00.000Z",
    });
    state = studyReducer(state, {
      type: "set_check_in_draft",
      value: "gentle",
      at: "2026-07-28T12:00:01.000Z",
    });

    expect(getActiveSession(state)?.screen).toBe("check-in");
    expect(getActiveSession(state)?.checkIn).toBe("gentle");
    expect(
      getActiveSession(state)?.events.filter(
        (event) => event.type === "check_in_completed",
      ),
    ).toHaveLength(0);
  });
});
