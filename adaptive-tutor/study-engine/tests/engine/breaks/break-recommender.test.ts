import { describe, expect, it } from "vitest";

import {
  BREAK_TYPES,
  recommendBreak,
  type BreakContext,
} from "../../../engine/breaks";

const baseContext = {
  blockElapsedMinutes: 0,
  sessionElapsedMinutes: 10,
} as const;

describe("recommendBreak", () => {
  it("exports every required break type", () => {
    expect(BREAK_TYPES).toEqual([
      "planned",
      "student_requested",
      "movement",
      "water",
      "screen_rest",
      "quiet_reset",
      "parent_configured",
    ]);
  });

  it.each([
    {
      name: "planned",
      context: { ...baseContext, blockElapsedMinutes: 20 },
      type: "planned",
    },
    {
      name: "student requested",
      context: { ...baseContext, studentRequest: {} },
      type: "student_requested",
    },
    {
      name: "movement",
      context: { ...baseContext, needs: { movementRequested: true } },
      type: "movement",
    },
    {
      name: "water",
      context: { ...baseContext, needs: { waterRequested: true } },
      type: "water",
    },
    {
      name: "screen rest",
      context: { ...baseContext, needs: { screenRestRequested: true } },
      type: "screen_rest",
    },
    {
      name: "quiet reset",
      context: { ...baseContext, needs: { quietResetRequested: true } },
      type: "quiet_reset",
    },
    {
      name: "parent configured",
      context: {
        ...baseContext,
        blockElapsedMinutes: 20,
        parentPlannedActivityId: "walk-dog",
        policy: { allowedParentActivityIds: ["walk-dog"] },
      },
      type: "parent_configured",
    },
  ] as const)("starts a $name break", ({ context, type }) => {
    const result = recommendBreak(context);

    expect(result).toMatchObject({
      action: "start_break",
      breakType: type,
      approved: true,
      countsAsFailure: false,
      resume: { mode: "after_timer", returnTo: "previous_work_step" },
    });
    expect(result.durationMinutes).toBeGreaterThan(0);
  });

  it("honors a directly requested configured parent activity", () => {
    expect(
      recommendBreak({
        ...baseContext,
        studentRequest: {
          type: "parent_configured",
          parentActivityId: "stretch-routine",
        },
        policy: { allowedParentActivityIds: ["stretch-routine"] },
      }),
    ).toMatchObject({
      action: "start_break",
      breakType: "parent_configured",
      approved: true,
      reasons: expect.arrayContaining([
        "student_request",
        "parent_configured_activity",
      ]),
    });
  });

  it("does not run an unknown parent-configured activity", () => {
    expect(
      recommendBreak({
        ...baseContext,
        studentRequest: {
          type: "parent_configured",
          parentActivityId: "unknown-activity",
        },
        policy: { allowedParentActivityIds: ["approved-activity"] },
      }),
    ).toMatchObject({
      action: "insufficient_data",
      approved: false,
      countsAsFailure: false,
      reasons: ["invalid_context"],
    });
  });

  it("uses a screen-rest threshold even without an explicit request", () => {
    expect(
      recommendBreak({ ...baseContext, screenMinutesSinceRest: 20 }),
    ).toMatchObject({
      action: "start_break",
      breakType: "screen_rest",
      reasons: expect.arrayContaining(["screen_time_threshold"]),
    });
  });

  it("maps a possible fatigue signal to a quiet reset without asserting fatigue", () => {
    expect(
      recommendBreak({
        ...baseContext,
        needs: { possibleFatigue: true },
      }),
    ).toMatchObject({
      action: "start_break",
      breakType: "quiet_reset",
      reasons: expect.arrayContaining(["possible_fatigue_signal"]),
    });
  });

  it("honors break refusal and schedules a bounded check-in", () => {
    expect(
      recommendBreak({
        ...baseContext,
        blockElapsedMinutes: 20,
        breakRefused: true,
      }),
    ).toMatchObject({
      action: "honor_break_refusal",
      breakType: "planned",
      approved: false,
      countsAsFailure: false,
      reasons: expect.arrayContaining(["break_refusal_honored"]),
      resume: {
        mode: "checkpoint",
        afterMinutes: 5,
        returnTo: "previous_work_step",
      },
    });
  });

  it("continues an active break only for its remaining bounded time", () => {
    expect(
      recommendBreak({
        ...baseContext,
        currentBreak: {
          type: "planned",
          baseDurationMinutes: 5,
          elapsedMinutes: 2,
          extensionMinutes: 0,
        },
      }),
    ).toMatchObject({
      action: "continue_break",
      durationMinutes: 3,
      approved: true,
      countsAsFailure: false,
    });
  });

  it("resumes exactly at the break boundary", () => {
    expect(
      recommendBreak({
        ...baseContext,
        currentBreak: {
          type: "planned",
          baseDurationMinutes: 5,
          elapsedMinutes: 5,
          extensionMinutes: 0,
        },
      }),
    ).toMatchObject({
      action: "resume",
      reasons: expect.arrayContaining(["break_timer_complete"]),
      resume: { mode: "after_timer", returnTo: "previous_work_step" },
    });
  });

  it("resumes early when the learner is ready", () => {
    expect(
      recommendBreak({
        ...baseContext,
        currentBreak: {
          type: "water",
          baseDurationMinutes: 3,
          elapsedMinutes: 1,
          extensionMinutes: 0,
          readyToResume: true,
        },
      }),
    ).toMatchObject({
      action: "resume",
      breakType: "water",
      reasons: expect.arrayContaining(["ready_to_resume"]),
      resume: { mode: "when_ready", returnTo: "previous_work_step" },
    });
  });

  it("approves only the remaining extension below the total cap", () => {
    expect(
      recommendBreak({
        ...baseContext,
        currentBreak: {
          type: "quiet_reset",
          baseDurationMinutes: 5,
          elapsedMinutes: 5,
          extensionMinutes: 4,
          extensionRequested: true,
        },
      }),
    ).toMatchObject({
      action: "extend_break",
      durationMinutes: 1,
      approved: true,
      countsAsFailure: false,
    });
  });

  it("stops extension loops at the configured cap", () => {
    expect(
      recommendBreak({
        ...baseContext,
        currentBreak: {
          type: "quiet_reset",
          baseDurationMinutes: 5,
          elapsedMinutes: 10,
          extensionMinutes: 5,
          extensionRequested: true,
        },
      }),
    ).toMatchObject({
      action: "resume_or_finish",
      approved: true,
      countsAsFailure: false,
      reasons: expect.arrayContaining(["break_extension_limit_reached"]),
    });
  });

  it("escalates a repeated pattern for review while still approving the break", () => {
    const result = recommendBreak({
      ...baseContext,
      sessionElapsedMinutes: 40,
      studentRequest: {},
      history: [
        { type: "planned", endedAtSessionMinute: 10, approved: true },
        { type: "water", endedAtSessionMinute: 30, approved: true },
      ],
    });

    expect(result).toMatchObject({
      action: "start_break",
      approved: true,
      countsAsFailure: false,
      review: "parent_or_teacher",
      reasons: expect.arrayContaining([
        "repeated_break_pattern",
        "approved_break_not_failure",
      ]),
    });
  });

  it("does not count an unapproved prior suggestion toward repeated-break review", () => {
    expect(
      recommendBreak({
        ...baseContext,
        sessionElapsedMinutes: 40,
        studentRequest: {},
        policy: { repeatedBreakThreshold: 2 },
        history: [
          { type: "planned", endedAtSessionMinute: 20, approved: false },
        ],
      }).review,
    ).toBe("none");
  });

  it("finishes at the configured maximum session duration", () => {
    expect(
      recommendBreak({
        blockElapsedMinutes: 20,
        sessionElapsedMinutes: 120,
        studentRequest: {},
      }),
    ).toMatchObject({
      action: "finish_session",
      reasons: ["configured_session_limit"],
      countsAsFailure: false,
    });
  });

  it("finishes when the session goal is complete", () => {
    expect(
      recommendBreak({
        ...baseContext,
        sessionGoalComplete: true,
      }),
    ).toMatchObject({
      action: "finish_session",
      reasons: ["session_goal_complete"],
    });
  });

  it("continues work when there is no break signal", () => {
    expect(recommendBreak(baseContext)).toMatchObject({
      action: "continue_work",
      reasons: ["no_break_signal"],
      countsAsFailure: false,
    });
  });

  it.each([
    { blockElapsedMinutes: -1, sessionElapsedMinutes: 0 },
    { blockElapsedMinutes: 0, sessionElapsedMinutes: Number.NaN },
    {
      ...baseContext,
      policy: { repeatedBreakThreshold: 0 },
    },
    {
      ...baseContext,
      policy: { defaultBreakMinutes: 11, maxTotalBreakMinutes: 10 },
    },
    {
      ...baseContext,
      history: [
        { type: "planned", endedAtSessionMinute: 11, approved: true },
      ],
    },
  ] as readonly BreakContext[])(
    "rejects an invalid context without making a recommendation: %o",
    (context) => {
      expect(recommendBreak(context)).toMatchObject({
        action: "insufficient_data",
        approved: false,
        countsAsFailure: false,
      });
    },
  );
});
