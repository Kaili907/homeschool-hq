import {
  STORAGE_KEY,
  createEmptyWorkspace,
  getActiveSession,
  hydrateWorkspace,
  persistWorkspace,
  segmentCompletionEventCount,
  studyReducer,
  type StudySession,
  type StudyWorkspace,
} from "../../../prototype/src/sessionStore";
import type {
  LearningSegmentId,
  SubjectId,
} from "../../../prototype/src/content";

const BASE_TIME = Date.parse("2026-07-28T14:00:00.000Z");

function timestamp(seconds = 0): string {
  return new Date(BASE_TIME + seconds * 1_000).toISOString();
}

function sessionFrom(state: StudyWorkspace): StudySession {
  const session = getActiveSession(state);
  if (!session) {
    throw new Error("Expected the test workspace to have an active session.");
  }
  return session;
}

function startLearning(subjectId: SubjectId = "math"): StudyWorkspace {
  let state = studyReducer(createEmptyWorkspace(), {
    type: "start_or_resume",
    subjectId,
    at: timestamp(),
  });
  state = studyReducer(state, {
    type: "complete_check_in",
    value: "ready",
    at: timestamp(1),
  });
  return state;
}

function advanceTo(
  state: StudyWorkspace,
  target: LearningSegmentId,
  startAtSeconds = 10,
): StudyWorkspace {
  let next = state;
  let step = 0;
  while (sessionFrom(next).currentSegment !== target) {
    const current = sessionFrom(next).currentSegment;
    next = studyReducer(next, {
      type: "complete_segment",
      segment: current,
      at: timestamp(startAtSeconds + step),
    });
    step += 1;
    if (step > 6) {
      throw new Error(`Could not advance the test session to ${target}.`);
    }
  }
  return next;
}

function withRemainingSeconds(
  state: StudyWorkspace,
  remainingSeconds: number,
): StudyWorkspace {
  const activeId = state.activeSessionId;
  const session = sessionFrom(state);
  if (!activeId) throw new Error("Expected an active session id.");
  return {
    ...state,
    sessions: {
      ...state.sessions,
      [activeId]: {
        ...session,
        timer: {
          ...session.timer,
          remainingSeconds,
        },
      },
    },
  };
}

function finishBreakCountdown(
  state: StudyWorkspace,
  startAtSeconds: number,
): StudyWorkspace {
  let next = state;
  for (let tick = 0; tick < 5; tick += 1) {
    next = studyReducer(next, {
      type: "tick_return_countdown",
      at: timestamp(startAtSeconds + tick),
    });
  }
  return next;
}

function eventCount(session: StudySession, type: StudySession["events"][number]["type"]) {
  return session.events.filter((event) => event.type === type).length;
}

function createMemoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map<string, string>();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

describe("studyReducer adversarial state invariants", () => {
  describe("rushing and double submission", () => {
    it("does not skip a segment or duplicate completion when a submit is replayed", () => {
      let state = startLearning();
      state = studyReducer(state, {
        type: "set_answer",
        segment: "warm-up",
        value: "2/4",
        at: timestamp(2),
      });

      const completion = {
        type: "complete_segment" as const,
        segment: "warm-up" as const,
        at: timestamp(3),
      };
      const afterFirstSubmit = studyReducer(state, completion);
      const afterDoubleSubmit = studyReducer(afterFirstSubmit, completion);

      expect(sessionFrom(afterFirstSubmit).currentSegment).toBe("visual-lesson");
      expect(afterDoubleSubmit).toBe(afterFirstSubmit);
      expect(sessionFrom(afterDoubleSubmit).completedSegments).toEqual(["warm-up"]);
      expect(
        segmentCompletionEventCount(sessionFrom(afterDoubleSubmit), "warm-up"),
      ).toBe(1);
    });

    it("ignores stale submissions instead of completing the learner's new segment", () => {
      let state = startLearning();
      state = studyReducer(state, {
        type: "complete_segment",
        segment: "warm-up",
        at: timestamp(2),
      });

      const afterStaleSubmit = studyReducer(state, {
        type: "complete_segment",
        segment: "warm-up",
        at: timestamp(3),
      });

      expect(afterStaleSubmit).toBe(state);
      expect(sessionFrom(afterStaleSubmit).currentSegment).toBe("visual-lesson");
      expect(sessionFrom(afterStaleSubmit).completedSegments).toEqual(["warm-up"]);
      expect(
        segmentCompletionEventCount(sessionFrom(afterStaleSubmit), "visual-lesson"),
      ).toBe(0);
    });

    it("records the check-in only once when Enter and click both submit", () => {
      let state = studyReducer(createEmptyWorkspace(), {
        type: "start_or_resume",
        subjectId: "reading",
        at: timestamp(),
      });
      const action = {
        type: "complete_check_in" as const,
        value: "I want a calm pace",
        at: timestamp(1),
      };

      state = studyReducer(state, action);
      const afterReplay = studyReducer(state, action);

      expect(afterReplay).toBe(state);
      expect(sessionFrom(afterReplay).checkIn).toBe("I want a calm pace");
      expect(eventCount(sessionFrom(afterReplay), "check_in_completed")).toBe(1);
    });
  });

  describe("repeated breaks", () => {
    it("pauses instructional time and returns to the exact segment on every break", () => {
      let state = advanceTo(startLearning(), "guided-practice");
      const segmentBeforeBreak = sessionFrom(state).currentSegment;
      const secondsBeforeBreak = sessionFrom(state).timer.remainingSeconds;

      state = studyReducer(state, {
        type: "request_break",
        at: timestamp(20),
        eventId: "break-request:one",
      });
      const afterRepeatedRequest = studyReducer(state, {
        type: "request_break",
        at: timestamp(21),
        eventId: "break-request:replayed",
      });

      expect(afterRepeatedRequest).toBe(state);
      expect(sessionFrom(state).screen).toBe("break");
      expect(sessionFrom(state).timer).toMatchObject({
        running: false,
        pauseReason: "break",
        remainingSeconds: secondsBeforeBreak,
      });

      const afterTimerTick = studyReducer(state, {
        type: "tick_timer",
        at: timestamp(22),
      });
      expect(afterTimerTick).toBe(state);

      state = studyReducer(state, {
        type: "choose_break_activity",
        activity: "Get water",
        at: timestamp(23),
      });
      state = studyReducer(state, {
        type: "start_return_countdown",
        at: timestamp(24),
      });
      state = finishBreakCountdown(state, 25);

      expect(sessionFrom(state).screen).toBe("learning");
      expect(sessionFrom(state).currentSegment).toBe(segmentBeforeBreak);
      expect(sessionFrom(state).timer.running).toBe(true);
      expect(eventCount(sessionFrom(state), "break_requested")).toBe(1);
      expect(eventCount(sessionFrom(state), "break_returned")).toBe(1);

      state = studyReducer(state, {
        type: "toggle_timer",
        at: timestamp(31),
      });
      state = studyReducer(state, {
        type: "request_break",
        at: timestamp(32),
        eventId: "break-request:two",
      });
      state = studyReducer(state, {
        type: "choose_break_activity",
        activity: "Stretch",
        at: timestamp(33),
      });
      state = studyReducer(state, {
        type: "start_return_countdown",
        at: timestamp(34),
      });
      state = finishBreakCountdown(state, 35);

      expect(sessionFrom(state).screen).toBe("learning");
      expect(sessionFrom(state).currentSegment).toBe(segmentBeforeBreak);
      expect(sessionFrom(state).timer).toMatchObject({
        running: false,
        pauseReason: "learner",
      });
      expect(eventCount(sessionFrom(state), "break_requested")).toBe(2);
      expect(eventCount(sessionFrom(state), "break_returned")).toBe(2);
    });

    it("does not start a return countdown until a safe activity is selected", () => {
      let state = startLearning();
      state = studyReducer(state, {
        type: "request_break",
        at: timestamp(2),
        eventId: "break-request:no-activity",
      });

      const unchanged = studyReducer(state, {
        type: "start_return_countdown",
        at: timestamp(3),
      });

      expect(unchanged).toBe(state);
      expect(sessionFrom(unchanged).breakState?.returnCountdown).toBeNull();
    });
  });

  describe("optional and anxiety-safe timer states", () => {
    it("supports visible, minimal, and hidden modes without changing learning progress", () => {
      let state = startLearning();

      for (const mode of ["minimal", "hidden", "visible"] as const) {
        state = studyReducer(state, {
          type: "set_timer_mode",
          mode,
          at: timestamp(2),
        });
        expect(sessionFrom(state).timer.mode).toBe(mode);
        expect(sessionFrom(state).currentSegment).toBe("warm-up");
        expect(sessionFrom(state).completedSegments).toEqual([]);
      }
    });

    it("keeps a paused hidden timer paused until the learner explicitly resumes it", () => {
      let state = startLearning();
      state = studyReducer(state, {
        type: "set_timer_mode",
        mode: "hidden",
        at: timestamp(2),
      });
      state = studyReducer(state, {
        type: "toggle_timer",
        at: timestamp(3),
      });
      const pausedSeconds = sessionFrom(state).timer.remainingSeconds;

      const afterTickWhilePaused = studyReducer(state, {
        type: "tick_timer",
        at: timestamp(4),
      });
      expect(afterTickWhilePaused).toBe(state);
      expect(sessionFrom(afterTickWhilePaused).timer).toMatchObject({
        mode: "hidden",
        running: false,
        pauseReason: "learner",
        remainingSeconds: pausedSeconds,
      });

      state = studyReducer(state, {
        type: "toggle_timer",
        at: timestamp(5),
      });
      state = studyReducer(state, {
        type: "tick_timer",
        at: timestamp(6),
      });
      expect(sessionFrom(state).timer).toMatchObject({
        mode: "hidden",
        running: true,
        pauseReason: null,
        remainingSeconds: pausedSeconds - 1,
      });
    });

    it("treats countdown expiry as a goal marker, never forced completion", () => {
      let state = withRemainingSeconds(startLearning(), 1);
      state = studyReducer(state, {
        type: "set_timer_mode",
        mode: "hidden",
        at: timestamp(2),
      });
      state = studyReducer(state, {
        type: "tick_timer",
        at: timestamp(3),
      });

      const sessionAtGoal = sessionFrom(state);
      expect(sessionAtGoal.timer).toMatchObject({
        mode: "hidden",
        remainingSeconds: 0,
        running: false,
        goalReached: true,
      });
      expect(sessionAtGoal.screen).toBe("learning");
      expect(sessionAtGoal.currentSegment).toBe("warm-up");
      expect(sessionAtGoal.completedSegments).toEqual([]);
      expect(eventCount(sessionAtGoal, "timer_goal_reached")).toBe(1);

      const afterExtraTick = studyReducer(state, {
        type: "tick_timer",
        at: timestamp(4),
      });
      const afterResumeAttempt = studyReducer(afterExtraTick, {
        type: "toggle_timer",
        at: timestamp(5),
      });

      expect(afterExtraTick).toBe(state);
      expect(afterResumeAttempt).toBe(state);
      expect(eventCount(sessionFrom(afterResumeAttempt), "timer_goal_reached")).toBe(1);
      expect(sessionFrom(afterResumeAttempt).currentSegment).toBe("warm-up");
    });
  });

  describe("refresh and close recovery", () => {
    it("restores the exact segment and draft, then records one technical interruption", () => {
      const storage = createMemoryStorage();
      let state = advanceTo(startLearning("reading"), "independent-attempt");
      state = studyReducer(state, {
        type: "set_answer",
        segment: "independent-attempt",
        value: "Weary means tired; sinking onto the bench is the clue.",
        at: timestamp(20),
      });
      state = studyReducer(state, {
        type: "set_timer_mode",
        mode: "minimal",
        at: timestamp(21),
      });
      const priorRuntime = sessionFrom(state).runtimeId;
      persistWorkspace(state, storage);

      const recovered = hydrateWorkspace(storage, "runtime-after-refresh", timestamp(22));
      const recoveredSession = sessionFrom(recovered);

      expect(recovered.activeSessionId).toBe("reading");
      expect(recoveredSession.currentSegment).toBe("independent-attempt");
      expect(recoveredSession.answers["independent-attempt"]).toBe(
        "Weary means tired; sinking onto the bench is the clue.",
      );
      expect(recoveredSession.timer).toMatchObject({
        mode: "minimal",
        running: false,
        pauseReason: "technical",
      });
      expect(recoveredSession.showRecoveryNotice).toBe(true);
      expect(recoveredSession.technicalInterruptionCount).toBe(1);
      expect(
        recoveredSession.events.filter(
          (event) =>
            event.type === "technical_interruption" &&
            event.id === `technical:${recoveredSession.sessionId}:${priorRuntime}`,
        ),
      ).toHaveLength(1);
    });

    it("does not duplicate an interruption when the recovered runtime hydrates again", () => {
      const storage = createMemoryStorage();
      const original = startLearning();
      persistWorkspace(original, storage);

      const firstRecovery = hydrateWorkspace(storage, "runtime-recovered", timestamp(2));
      persistWorkspace(firstRecovery, storage);
      const repeatedHydration = hydrateWorkspace(
        storage,
        "runtime-recovered",
        timestamp(3),
      );

      expect(sessionFrom(repeatedHydration).technicalInterruptionCount).toBe(1);
      expect(eventCount(sessionFrom(repeatedHydration), "technical_interruption")).toBe(1);
      expect(sessionFrom(repeatedHydration).runtimeId).toBe("runtime-recovered");
    });

    it("restores a deliberate save-and-exit without labeling it technical", () => {
      const storage = createMemoryStorage();
      let state = advanceTo(startLearning(), "independent-attempt");
      state = studyReducer(state, {
        type: "set_answer",
        segment: "independent-attempt",
        value: "4/10",
        at: timestamp(20),
      });
      state = studyReducer(state, {
        type: "save_and_exit",
        at: timestamp(21),
      });
      persistWorkspace(state, storage);

      const reopened = hydrateWorkspace(storage, "runtime-after-close", timestamp(22));
      const savedSession = reopened.sessions.math;

      expect(reopened.activeSessionId).toBeUndefined();
      expect(savedSession).toMatchObject({
        status: "saved",
        cleanExit: true,
        currentSegment: "independent-attempt",
        technicalInterruptionCount: 0,
      });
      expect(savedSession?.answers["independent-attempt"]).toBe("4/10");
      expect(savedSession && eventCount(savedSession, "technical_interruption")).toBe(0);

      const resumed = studyReducer(reopened, {
        type: "start_or_resume",
        subjectId: "math",
        at: timestamp(23),
      });
      expect(sessionFrom(resumed)).toMatchObject({
        status: "active",
        cleanExit: false,
        currentSegment: "independent-attempt",
      });
      expect(sessionFrom(resumed).answers["independent-attempt"]).toBe("4/10");
      expect(eventCount(sessionFrom(resumed), "technical_interruption")).toBe(0);
    });

    it("falls back safely when persisted JSON is corrupt", () => {
      const storage: Pick<Storage, "getItem"> = {
        getItem(key) {
          return key === STORAGE_KEY ? "{not-valid-json" : null;
        },
      };

      expect(hydrateWorkspace(storage, "runtime-corrupt", timestamp())).toEqual(
        createEmptyWorkspace(),
      );
    });
  });

  describe("completion event idempotency", () => {
    it("emits exactly one completion per segment through the full six-step flow", () => {
      let state = startLearning();
      const segments = [
        "warm-up",
        "visual-lesson",
        "guided-practice",
        "independent-attempt",
        "self-check",
        "exit-ticket",
      ] as const;

      for (const [index, segment] of segments.entries()) {
        const action = {
          type: "complete_segment" as const,
          segment,
          at: timestamp(10 + index),
        };
        state = studyReducer(state, action);
        state = studyReducer(state, action);
      }

      const completed = state.sessions.math;
      expect(state.activeSessionId).toBe("math");
      expect(completed?.screen).toBe("decision");
      expect(completed?.completedSegments).toEqual(segments);
      for (const segment of segments) {
        expect(completed && segmentCompletionEventCount(completed, segment)).toBe(1);
      }
      expect(completed && eventCount(completed, "segment_completed")).toBe(6);
    });
  });
});
