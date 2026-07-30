import { describe, expect, it } from "vitest";
import {
  classifyEvidence,
  recommendBreak,
  recommendFocusDuration,
  replayStudySession,
  scheduleInterleavedPractice,
  scheduleNextReview,
  type FocusSessionEvidence,
  type SessionEvent,
} from "../../../engine/index.js";

function focusSession(
  offset: number,
  overrides: Partial<FocusSessionEvidence> = {},
): FocusSessionEvidence {
  return {
    occurredAtEpochMs: 1_785_256_800_000 + offset,
    subject: "mathematics",
    taskType: "independent_practice",
    plannedDurationMinutes: 40,
    completedDurationMinutes: 40,
    coreOutcome: "successful",
    durationResponse: "comfortable",
    disruption: "none",
    quality: "reliable",
    ...overrides,
  };
}

describe("deterministic sample recommendation traces", () => {
  it("traces a conservative high-school increase after four of five successes", () => {
    const result = recommendFocusDuration({
      gradeBand: "high_school",
      subject: "mathematics",
      taskType: "independent_practice",
      currentDurationMinutes: 40,
      sessions: [
        focusSession(1),
        focusSession(2),
        focusSession(3),
        focusSession(4),
        focusSession(5, { coreOutcome: "not_successful" }),
      ],
      parentOverride: {
        mode: "automatic",
        maximumDurationMinutes: 45,
      },
    });

    expect(result).toEqual({
      recommendation: "increase",
      currentDurationMinutes: 40,
      recommendedDurationMinutes: 44,
      adjustmentMinutes: 4,
      reasonCodes: ["evidence_supports_small_increase"],
      evidence: {
        availableComparableSessions: 5,
        evaluatedComparableSessions: 5,
        successfulSessions: 4,
        tooLongResponses: 0,
        tooShortResponses: 0,
        approvedBreakSessions: 0,
      },
    });
  });

  it("traces conflicting focus signals and ambiguous pause evidence to review", () => {
    const sessions = Array.from({ length: 5 }, (_, index) =>
      focusSession(index, {
        durationResponse:
          index < 2 ? "too_long" : index < 4 ? "too_short" : "comfortable",
      }),
    );
    const focus = recommendFocusDuration({
      gradeBand: "high_school",
      subject: "mathematics",
      taskType: "independent_practice",
      currentDurationMinutes: 40,
      sessions,
    });
    const evidence = classifyEvidence({
      attempts: 6,
      accuracy: 0.9,
      pauseCount: 3,
    });

    expect(focus).toMatchObject({
      recommendation: "manual_review",
      recommendedDurationMinutes: 40,
      adjustmentMinutes: 0,
      reasonCodes: ["conflicting_duration_feedback"],
    });
    expect(evidence).toMatchObject({
      category: "Insufficient evidence",
      conclusion: "insufficient",
      dataQuality: "conflicting",
      alternatives: ["Fatigue", "Interruption"],
    });
  });

  it("traces a repeated requested break and failed retrieval conservatively", () => {
    const breakResult = recommendBreak({
      blockElapsedMinutes: 2,
      sessionElapsedMinutes: 40,
      studentRequest: { type: "water" },
      history: [
        { type: "movement", endedAtSessionMinute: 10, approved: true },
        { type: "quiet_reset", endedAtSessionMinute: 25, approved: true },
      ],
    });
    const review = scheduleNextReview({
      reviewedOn: "2026-07-28",
      state: { lastBaselineIndex: 3 },
      evidence: {
        retrievalAccuracy: 0.2,
        independence: 0.3,
        confidence: 0.4,
        consecutiveSuccessfulRetrievals: 0,
        retrievalFailed: true,
        prerequisiteGap: false,
        reteachingOutcome: "not_observed",
      },
    });

    expect(breakResult).toMatchObject({
      action: "start_break",
      breakType: "water",
      durationMinutes: 3,
      approved: true,
      countsAsFailure: false,
      review: "parent_or_teacher",
      reasons: [
        "student_request",
        "repeated_break_pattern",
        "approved_break_not_failure",
      ],
    });
    expect(review).toMatchObject({
      dueOn: "2026-07-28",
      intervalDays: 0,
      baselineIntervalDays: 3,
      cadenceAction: "shorten",
      preparation: "reteach_before_retrieval",
    });
  });

  it("traces core-authoritative reteaching and blocks premature interleaving", () => {
    const events = [
      { type: "check_in_completed", at: "2026-07-28T09:00:01-04:00" },
      {
        type: "prior_retrieval_completed",
        at: "2026-07-28T09:00:02-04:00",
      },
      {
        type: "visual_teaching_completed",
        at: "2026-07-28T09:00:03-04:00",
      },
      {
        type: "guided_practice_completed",
        at: "2026-07-28T09:00:04-04:00",
      },
      {
        type: "independent_attempt_completed",
        at: "2026-07-28T09:00:05-04:00",
      },
      {
        type: "confidence_check_completed",
        at: "2026-07-28T09:00:06-04:00",
        coreDirective: "reteach",
      },
      {
        type: "core_instruction_completed",
        at: "2026-07-28T09:00:07-04:00",
      },
      {
        type: "review_scheduled",
        at: "2026-07-28T09:00:08-04:00",
        reviewDate: "2026-07-28",
      },
      {
        type: "pacing_disposition_recorded",
        at: "2026-07-28T09:00:09-04:00",
        disposition: "finish",
      },
    ] as const satisfies readonly SessionEvent[];
    const session = replayStudySession(
      {
        sessionRef: "trace-session-004",
        startedAt: "2026-07-28T09:00:00-04:00",
      },
      events,
    );
    const practice = scheduleInterleavedPractice({
      target: {
        skillId: "fractions-add",
        difficulty: 3,
        prerequisiteReady: true,
        independentAttempts: 2,
        independentAccuracy: 0.9,
        mastery: 0.9,
        previouslyMastered: false,
      },
      reviewCandidates: [
        {
          skillId: "fractions-equivalent",
          difficulty: 2,
          prerequisiteReady: true,
          independentAttempts: 10,
          independentAccuracy: 0.95,
          mastery: 0.95,
          previouslyMastered: true,
        },
      ],
      itemCount: 8,
    });

    expect(session).toMatchObject({
      phase: "finished",
      coreDirective: "reteach",
      scheduledReviewDate: "2026-07-28",
    });
    expect(practice).toMatchObject({
      mode: "blocked",
      contextSwitches: 0,
      reasons: expect.arrayContaining([
        "premature_interleaving_prevented",
        "insufficient_independent_attempts",
      ]),
    });
  });
});
