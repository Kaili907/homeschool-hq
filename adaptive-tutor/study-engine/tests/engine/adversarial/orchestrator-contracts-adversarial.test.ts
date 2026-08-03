import { describe, expect, it } from "vitest";

import {
  adaptProvisionalSessionContext,
  adaptTutorCoreOutcome,
  PROVISIONAL_CONTRACT_VERSIONS,
} from "../../../engine/adapters/index.js";
import {
  advanceStudySession,
  createStudySession,
  replayStudySession,
  SessionTransitionError,
  type SessionEvent,
  type StudySessionState,
} from "../../../engine/orchestrator/index.js";

const start = {
  sessionRef: "session_opaque_01",
  startedAt: "2026-07-28T08:00:00-04:00",
} as const;

const fullCycle: readonly SessionEvent[] = [
  { type: "check_in_completed", at: "2026-07-28T08:01:00-04:00" },
  {
    type: "prior_retrieval_completed",
    at: "2026-07-28T08:02:00-04:00",
  },
  {
    type: "visual_teaching_completed",
    at: "2026-07-28T08:03:00-04:00",
  },
  {
    type: "guided_practice_completed",
    at: "2026-07-28T08:04:00-04:00",
  },
  {
    type: "independent_attempt_completed",
    at: "2026-07-28T08:05:00-04:00",
  },
  {
    type: "confidence_check_completed",
    at: "2026-07-28T08:06:00-04:00",
    coreDirective: "reteach",
  },
  {
    type: "core_instruction_completed",
    at: "2026-07-28T08:07:00-04:00",
  },
  {
    type: "review_scheduled",
    at: "2026-07-28T08:08:00-04:00",
    reviewDate: "2026-07-29",
  },
  {
    type: "pacing_disposition_recorded",
    at: "2026-07-28T08:09:00-04:00",
    disposition: "finish",
  },
];

describe("adversarial orchestrator and adapter validation", () => {
  it("rejects every attempt to skip the required next phase", () => {
    const events: readonly SessionEvent[] = [
      fullCycle[1]!,
      fullCycle[2]!,
      fullCycle[3]!,
      fullCycle[4]!,
      fullCycle[5]!,
      fullCycle[6]!,
      fullCycle[7]!,
      fullCycle[8]!,
      { type: "break_resume_confirmed", at: "2026-07-28T08:01:00-04:00" },
    ];

    for (const event of events) {
      expect(() =>
        advanceStudySession(createStudySession(start), event),
      ).toThrowError(
        expect.objectContaining({ code: "invalid_transition" }),
      );
    }
  });

  it("keeps the tutor core directive authoritative through the full cycle", () => {
    const result = replayStudySession(start, fullCycle);
    expect(result).toMatchObject({
      phase: "finished",
      status: "finished",
      coreDirective: "reteach",
      scheduledReviewDate: "2026-07-29",
    });
    expect(result.history.map(({ event }) => event)).toEqual(
      fullCycle.map(({ type }) => type),
    );
  });

  it("rejects a forged state that tries to complete instruction without a core directive", () => {
    const forged = {
      ...createStudySession(start),
      phase: "correct_or_reteach",
      lastEventAt: "2026-07-28T08:06:00-04:00",
    } as StudySessionState;

    expect(() =>
      advanceStudySession(forged, {
        type: "core_instruction_completed",
        at: "2026-07-28T08:07:00-04:00",
      }),
    ).toThrowError(SessionTransitionError);
  });

  it("rejects forged history that jumps phases even when it supplies a plausible core directive", () => {
    const forged = {
      ...createStudySession(start),
      phase: "correct_or_reteach",
      coreDirective: "reteach",
      lastEventAt: "2026-07-28T08:06:00-04:00",
      history: [
        {
          at: "2026-07-28T08:06:00-04:00",
          event: "confidence_check_completed",
          from: "check_in",
          to: "correct_or_reteach",
        },
      ],
    } as StudySessionState;

    expect(() =>
      advanceStudySession(forged, {
        type: "core_instruction_completed",
        at: "2026-07-28T08:07:00-04:00",
      }),
    ).toThrowError(
      expect.objectContaining({ code: "invalid_state" }),
    );
  });

  it("rejects impossible calendar instants instead of accepting Date.parse normalization", () => {
    expect(() =>
      createStudySession({
        sessionRef: "session_opaque_01",
        startedAt: "2026-02-31T08:00:00-04:00",
      }),
    ).toThrowError(
      expect.objectContaining({ code: "invalid_timestamp" }),
    );
  });

  it("rejects an invalid or locally invented instruction directive", () => {
    const throughIndependent = replayStudySession(start, fullCycle.slice(0, 5));
    const invented = {
      type: "confidence_check_completed",
      at: "2026-07-28T08:06:00-04:00",
      coreDirective: "declare_mastery",
    } as unknown as SessionEvent;

    expect(() => advanceStudySession(throughIndependent, invented)).toThrowError(
      expect.objectContaining({ code: "invalid_core_directive" }),
    );
  });

  it("replays deterministically and rejects post-finish mutation", () => {
    const first = replayStudySession(start, fullCycle);
    for (let iteration = 0; iteration < 50; iteration += 1) {
      expect(replayStudySession(start, fullCycle)).toEqual(first);
    }
    expect(() =>
      advanceStudySession(first, {
        type: "check_in_completed",
        at: "2026-07-28T08:10:00-04:00",
      }),
    ).toThrowError(expect.objectContaining({ code: "session_finished" }));
  });

  it("does not copy accidental PII fields into session state", () => {
    const input = {
      ...start,
      studentName: "PRIVATE STUDENT",
      email: "private@example.invalid",
      transcript: "PRIVATE TRANSCRIPT",
    };
    const event = {
      ...fullCycle[0]!,
      rawAnswer: "PRIVATE RAW ANSWER",
    } as unknown as SessionEvent;
    const state = advanceStudySession(createStudySession(input), event);

    expect(JSON.stringify(state)).not.toMatch(
      /PRIVATE STUDENT|private@example\.invalid|PRIVATE TRANSCRIPT|PRIVATE RAW ANSWER|studentName|email|transcript|rawAnswer/,
    );
  });

  it("allowlists provisional context fields and drops accidental PII", () => {
    const result = adaptProvisionalSessionContext({
      schemaVersion: PROVISIONAL_CONTRACT_VERSIONS.sessionContext,
      sessionRef: "session_opaque_01",
      gradeBand: "middle",
      subjectKey: "math",
      taskTypeKey: "retrieval",
      timeZone: "America/New_York",
      studentName: "PRIVATE STUDENT",
      email: "private@example.invalid",
      diagnosis: "PRIVATE DIAGNOSIS",
    });

    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(
      /PRIVATE STUDENT|private@example\.invalid|PRIVATE DIAGNOSIS|studentName|email|diagnosis/,
    );
  });

  it("rejects mismatched, invalid, and invented tutor-core outcomes with fixed safe errors", () => {
    const baseOutcome = {
      schemaVersion: PROVISIONAL_CONTRACT_VERSIONS.tutorCoreOutcome,
      sessionRef: "session_opaque_01",
      occurredAt: "2026-07-28T08:06:00-04:00",
      instructionDirective: "reteach",
      studentName: "PRIVATE STUDENT",
      rawAnswer: "PRIVATE RAW ANSWER",
    };
    const hostile = [
      [baseOutcome, "other_session"],
      [{ ...baseOutcome, occurredAt: "not-a-time" }, "session_opaque_01"],
      [
        { ...baseOutcome, instructionDirective: "declare_mastery" },
        "session_opaque_01",
      ],
      [
        {
          ...baseOutcome,
          schemaVersion: "attacker.contract.v999",
        },
        "session_opaque_01",
      ],
    ] as const;

    for (const [source, expectedSessionRef] of hostile) {
      const result = adaptTutorCoreOutcome(source, expectedSessionRef);
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toMatch(
        /PRIVATE STUDENT|PRIVATE RAW ANSWER|studentName|rawAnswer/,
      );
    }
  });
});
