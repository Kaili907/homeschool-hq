import { describe, expect, it } from "vitest";
import {
  advanceStudySession,
  allowedEventFor,
  createStudySession,
  replayStudySession,
  SessionTransitionError,
  type SessionEvent,
} from "../../../engine/orchestrator/index.js";

const input = {
  sessionRef: "fixture-session-001",
  startedAt: "2026-07-28T13:00:00-04:00",
} as const;

const finishCycle = [
  { type: "check_in_completed", at: "2026-07-28T13:00:01-04:00" },
  {
    type: "prior_retrieval_completed",
    at: "2026-07-28T13:00:02-04:00",
  },
  {
    type: "visual_teaching_completed",
    at: "2026-07-28T13:00:03-04:00",
  },
  {
    type: "guided_practice_completed",
    at: "2026-07-28T13:00:04-04:00",
  },
  {
    type: "independent_attempt_completed",
    at: "2026-07-28T13:00:05-04:00",
  },
  {
    type: "confidence_check_completed",
    at: "2026-07-28T13:00:06-04:00",
    coreDirective: "reteach",
  },
  {
    type: "core_instruction_completed",
    at: "2026-07-28T13:00:07-04:00",
  },
  {
    type: "review_scheduled",
    at: "2026-07-28T13:00:08-04:00",
    reviewDate: "2026-07-29",
  },
  {
    type: "pacing_disposition_recorded",
    at: "2026-07-28T13:00:09-04:00",
    disposition: "finish",
  },
] as const satisfies readonly SessionEvent[];

describe("study session orchestrator", () => {
  it("runs the required cycle while leaving instruction to the tutor core", () => {
    const state = replayStudySession(input, finishCycle);

    expect(state.phase).toBe("finished");
    expect(state.status).toBe("finished");
    expect(state.coreDirective).toBe("reteach");
    expect(state.scheduledReviewDate).toBe("2026-07-29");
    expect(state.history.map(({ from, to }) => `${from}->${to}`)).toEqual([
      "check_in->retrieve_prior_knowledge",
      "retrieve_prior_knowledge->teach_visually",
      "teach_visually->guided_practice",
      "guided_practice->independent_attempt",
      "independent_attempt->confidence_check",
      "confidence_check->correct_or_reteach",
      "correct_or_reteach->schedule_future_review",
      "schedule_future_review->break_continue_or_finish",
      "break_continue_or_finish->finished",
    ]);
  });

  it("supports a break and resumes at a fresh check-in cycle", () => {
    const beforeDisposition = replayStudySession(input, finishCycle.slice(0, -1));
    const onBreak = advanceStudySession(beforeDisposition, {
      type: "pacing_disposition_recorded",
      at: "2026-07-28T13:00:09-04:00",
      disposition: "break",
    });
    const resumed = advanceStudySession(onBreak, {
      type: "break_resume_confirmed",
      at: "2026-07-28T13:05:09-04:00",
    });

    expect(onBreak).toMatchObject({ phase: "on_break", status: "on_break" });
    expect(resumed).toMatchObject({
      phase: "check_in",
      status: "active",
      cycleNumber: 2,
    });
  });

  it("supports continuing without a break", () => {
    const state = replayStudySession(input, [
      ...finishCycle.slice(0, -1),
      {
        type: "pacing_disposition_recorded",
        at: "2026-07-28T13:00:09-04:00",
        disposition: "continue",
      },
    ]);

    expect(state).toMatchObject({
      phase: "check_in",
      status: "active",
      cycleNumber: 2,
    });
  });

  it("rejects phase skipping and advancing a finished session", () => {
    const initial = createStudySession(input);
    expect(() =>
      advanceStudySession(initial, {
        type: "guided_practice_completed",
        at: "2026-07-28T13:01:00-04:00",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SessionTransitionError>>({
        code: "invalid_transition",
      }),
    );

    const finished = replayStudySession(input, finishCycle);
    expect(() =>
      advanceStudySession(finished, {
        type: "break_resume_confirmed",
        at: "2026-07-28T13:10:00-04:00",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SessionTransitionError>>({
        code: "session_finished",
      }),
    );
  });

  it("rejects timestamps without offsets and out-of-order events", () => {
    expect(() =>
      createStudySession({
        sessionRef: "fixture",
        startedAt: "2026-07-28T13:00:00",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SessionTransitionError>>({
        code: "invalid_timestamp",
      }),
    );

    const initial = createStudySession(input);
    expect(() =>
      advanceStudySession(initial, {
        type: "check_in_completed",
        at: "2026-07-28T12:59:59-04:00",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SessionTransitionError>>({
        code: "event_before_session",
      }),
    );
  });

  it.each(["2026-02-30", "07/29/2026", "2026-13-01"])(
    "rejects invalid review date %s",
    (reviewDate) => {
      const ready = replayStudySession(input, finishCycle.slice(0, -2));
      expect(() =>
        advanceStudySession(ready, {
          type: "review_scheduled",
          at: "2026-07-28T13:00:08-04:00",
          reviewDate,
        }),
      ).toThrowError(
        expect.objectContaining<Partial<SessionTransitionError>>({
          code: "invalid_review_date",
        }),
      );
    },
  );

  it("is deterministic for identical explicit inputs", () => {
    expect(replayStudySession(input, finishCycle)).toStrictEqual(
      replayStudySession(input, finishCycle),
    );
  });

  it("stores only an opaque reference and minimal transition metadata", () => {
    const serialized = JSON.stringify(replayStudySession(input, finishCycle));

    expect(serialized).not.toMatch(
      /studentName|email|birth|diagnos|transcript|rawResponse/i,
    );
    expect(serialized).not.toContain("sample@example.com");
  });

  it("exposes the single allowed next event", () => {
    const initial = createStudySession(input);
    expect(allowedEventFor(initial)).toBe("check_in_completed");
    expect(allowedEventFor(replayStudySession(input, finishCycle))).toBeNull();
  });
});
