import { describe, expect, it } from "vitest";
import {
  CalendarIntegrationError,
  calendarBlockView,
  completeCurrentSegment,
  createAutomaticContinuation,
  createCalendarBlock,
  pauseCalendarBlock,
  resumeCalendarBlock,
  startCalendarBlock,
} from "../../integrations/calendar/index.js";

function fractionsLesson() {
  return createCalendarBlock({
    entryId: "fractions-lesson",
    learnerRef: "learner-calendar-test",
    source: "manuel_academy",
    sourceItemRef: "fractions-lesson-6",
    title: "Fractions Lesson",
    subject: "Math",
    blockType: "guided_practice",
    scheduledStart: "2026-07-28T09:00:00-04:00",
    timeZone: "America/New_York",
    createdAt: "2026-07-27T12:00:00-04:00",
    segments: [
      { segmentId: "warm-up", title: "Warm-up", estimatedMinutes: 4 },
      { segmentId: "visual", title: "Visual Model", estimatedMinutes: 5 },
      { segmentId: "example", title: "Worked Example", estimatedMinutes: 5 },
      {
        segmentId: "guided",
        title: "Guided Practice",
        estimatedMinutes: 8,
      },
      {
        segmentId: "independent",
        title: "Independent Practice",
        estimatedMinutes: 5,
      },
      { segmentId: "check", title: "Check-in", estimatedMinutes: 3 },
    ],
  });
}

function partialFractionsLesson() {
  let block = startCalendarBlock(
    fractionsLesson(),
    "2026-07-28T09:00:00-04:00",
  );
  block = completeCurrentSegment(block, {
    segmentId: "warm-up",
    at: "2026-07-28T09:03:00-04:00",
  });
  block = completeCurrentSegment(block, {
    segmentId: "visual",
    at: "2026-07-28T09:06:00-04:00",
  });
  block = completeCurrentSegment(block, {
    segmentId: "example",
    at: "2026-07-28T09:09:00-04:00",
  });
  return pauseCalendarBlock(block, {
    at: "2026-07-28T09:10:00-04:00",
    actor: "student",
    reason: "approved_break",
    approved: true,
  });
}

describe("partial calendar completion and resume", () => {
  it("reports the required partial Fractions Lesson state", () => {
    const block = partialFractionsLesson();

    expect(calendarBlockView(block)).toEqual({
      entryId: "fractions-lesson",
      title: "Fractions Lesson",
      executionState: "paused",
      completionState: "partially_complete",
      segmentsCompleted: 3,
      totalSegments: 6,
      estimatedMinutes: 30,
      estimatedMinutesRemaining: 16,
      actualMinutes: 10,
      resumeAt: "Guided Practice",
      completionPercent: 47,
    });
    expect(block.pause).toEqual({
      reason: "approved_break",
      approved: true,
      pausedAt: "2026-07-28T09:10:00-04:00",
    });
  });

  it("resumes the exact incomplete segment and records outside/technical interruptions", () => {
    let block = resumeCalendarBlock(
      partialFractionsLesson(),
      "2026-07-28T09:15:00-04:00",
    );
    expect(block.events.at(-1)).toMatchObject({
      type: "resumed",
      segmentId: "guided",
    });
    block = pauseCalendarBlock(block, {
      at: "2026-07-28T09:16:00-04:00",
      actor: "parent",
      reason: "outside_interruption",
      approved: true,
    });
    expect(calendarBlockView(block).actualMinutes).toBe(11);

    block = resumeCalendarBlock(
      block,
      "2026-07-28T09:20:00-04:00",
      "student",
    );
    block = pauseCalendarBlock(block, {
      at: "2026-07-28T09:22:00-04:00",
      actor: "student",
      reason: "technical_interruption",
      approved: true,
    });

    expect(calendarBlockView(block)).toMatchObject({
      segmentsCompleted: 3,
      actualMinutes: 13,
      resumeAt: "Guided Practice",
    });
    expect(
      block.events
        .filter((event) => event.type === "paused")
        .map((event) => event.reason),
    ).toEqual([
      "approved_break",
      "outside_interruption",
      "technical_interruption",
    ]);
  });

  it("creates one automatic continuation containing only unfinished segments", () => {
    const partial = partialFractionsLesson();
    const result = createAutomaticContinuation(partial, {
      continuationEntryId: "fractions-continuation",
      continuationRef: "fractions-lesson-6-continuation-1",
      scheduledStart: "2026-07-29T09:00:00-04:00",
      timeZone: "America/New_York",
      at: "2026-07-28T09:11:00-04:00",
    });

    expect(result.continuation).toMatchObject({
      continuationOf: "fractions-lesson",
      title: "Fractions Lesson",
      estimatedMinutes: 16,
      executionState: "scheduled",
    });
    expect(
      result.continuation.segments.map((segment) => segment.title),
    ).toEqual(["Guided Practice", "Independent Practice", "Check-in"]);
    expect(result.original.events.at(-1)).toEqual({
      type: "continuation_created",
      at: "2026-07-28T09:11:00-04:00",
      actor: "system",
      continuationEntryId: "fractions-continuation",
    });
    expect(partial.events.at(-1)?.type).toBe("paused");
  });

  it("keeps supportive guardrails around breaks and segment order", () => {
    const active = startCalendarBlock(
      fractionsLesson(),
      "2026-07-28T09:00:00-04:00",
    );

    expect(() =>
      pauseCalendarBlock(active, {
        at: "2026-07-28T09:01:00-04:00",
        actor: "student",
        reason: "approved_break",
        approved: false,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<CalendarIntegrationError>>({
        code: "invalid_pause",
      }),
    );
    expect(() =>
      completeCurrentSegment(active, {
        segmentId: "guided",
        at: "2026-07-28T09:01:00-04:00",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<CalendarIntegrationError>>({
        code: "invalid_segment",
      }),
    );
  });
});
