import { describe, expect, it } from "vitest";
import {
  DAILY_CALENDAR_BLOCK_TYPES,
  applyParentCalendarEdit,
  buildCalendarMockDemonstration,
  completeCurrentSegment,
  createCalendarBlock,
  dailyCompletionBar,
  pauseCalendarBlock,
  rescheduleCalendarBlock,
  startCalendarBlock,
  transformPlannedCalendarItem,
  weeklyCompletionBar,
} from "../../integrations/calendar/index.js";

function makeBlock(
  entryId: string,
  scheduledStart: string,
  segmentMinutes: readonly number[] = [10],
) {
  return createCalendarBlock({
    entryId,
    learnerRef: "learner-calendar-test",
    source: "manuel_academy",
    sourceItemRef: `source-${entryId}`,
    title: `Block ${entryId}`,
    subject: "Math",
    blockType: "guided_practice",
    scheduledStart,
    timeZone: "America/New_York",
    createdAt: "2026-07-27T12:00:00-04:00",
    segments: segmentMinutes.map((estimatedMinutes, index) => ({
      segmentId: `segment-${index + 1}`,
      title: `Segment ${index + 1}`,
      estimatedMinutes,
    })),
  });
}

describe("calendar transformation contract", () => {
  it("supports every required daily calendar block type", () => {
    const demonstration = buildCalendarMockDemonstration();

    expect(
      demonstration.everyDailyBlockType.map((block) => block.blockType),
    ).toEqual(DAILY_CALENDAR_BLOCK_TYPES);
    expect(new Set(demonstration.everyDailyBlockType.map((block) => block.source)))
      .toEqual(
        new Set(["manuel_academy", "parent", "romeo_virtual_academy"]),
      );
  });

  it("transforms an explicit-offset planner item and verifies its local day", () => {
    const block = transformPlannedCalendarItem({
      entryId: "planned-reading",
      learnerRef: "learner-calendar-test",
      source: "manuel_academy",
      sourceItemRef: "plan-reading-1",
      title: "Read the next chapter",
      subject: "Reading",
      blockType: "reading",
      scheduledStart: "2026-07-28T08:30:00-04:00",
      timeZone: "America/New_York",
      intendedLocalDate: "2026-07-28",
      createdAt: "2026-07-27T12:00:00-04:00",
      segments: [
        {
          segmentId: "read",
          title: "Read",
          estimatedMinutes: 22,
        },
      ],
    });

    expect(block).toMatchObject({
      schemaVersion: "provisional-calendar-block.v1",
      estimatedMinutes: 22,
      executionState: "scheduled",
      timerVisibility: "shown",
      revision: 0,
    });
    expect(block.events).toEqual([
      {
        type: "created",
        at: "2026-07-27T12:00:00-04:00",
        actor: "system",
      },
    ]);
  });

  it("demonstrates drag-and-drop rescheduling and auditable parent edits", () => {
    const original = makeBlock(
      "move-me",
      "2026-07-28T09:00:00-04:00",
    );
    const dragged = rescheduleCalendarBlock(original, {
      at: "2026-07-27T13:00:00-04:00",
      actor: "student",
      method: "drag_drop",
      scheduledStart: "2026-07-29T10:15:00-04:00",
      timeZone: "America/New_York",
    });
    const parentEdited = applyParentCalendarEdit(dragged, {
      at: "2026-07-27T13:05:00-04:00",
      title: "Short guided-practice block",
      timerVisibility: "hidden",
    });

    expect(parentEdited).toMatchObject({
      title: "Short guided-practice block",
      scheduledStart: "2026-07-29T10:15:00-04:00",
      timerVisibility: "hidden",
      revision: 2,
    });
    expect(parentEdited.events.slice(-2)).toEqual([
      expect.objectContaining({
        type: "rescheduled",
        method: "drag_drop",
        actor: "student",
      }),
      expect.objectContaining({
        type: "parent_edited",
        actor: "parent",
        changedFields: ["title", "timerVisibility"],
      }),
    ]);
    expect(original.scheduledStart).toBe("2026-07-28T09:00:00-04:00");
  });

  it("builds duration-weighted daily and weekly completion bars", () => {
    let completeBlock = makeBlock(
      "complete",
      "2026-07-28T09:00:00-04:00",
      [10, 10],
    );
    completeBlock = startCalendarBlock(
      completeBlock,
      "2026-07-28T09:00:00-04:00",
    );
    completeBlock = completeCurrentSegment(completeBlock, {
      segmentId: "segment-1",
      at: "2026-07-28T09:10:00-04:00",
    });
    completeBlock = completeCurrentSegment(completeBlock, {
      segmentId: "segment-2",
      at: "2026-07-28T09:20:00-04:00",
    });

    let partialBlock = makeBlock(
      "partial",
      "2026-07-28T10:00:00-04:00",
      [10, 10],
    );
    partialBlock = startCalendarBlock(
      partialBlock,
      "2026-07-28T10:00:00-04:00",
    );
    partialBlock = completeCurrentSegment(partialBlock, {
      segmentId: "segment-1",
      at: "2026-07-28T10:05:00-04:00",
    });
    partialBlock = pauseCalendarBlock(partialBlock, {
      at: "2026-07-28T10:06:00-04:00",
      actor: "student",
      reason: "approved_break",
      approved: true,
    });

    const daily = dailyCompletionBar(
      [completeBlock, partialBlock],
      "2026-07-28",
      "America/New_York",
    );
    const weekly = weeklyCompletionBar(
      [completeBlock, partialBlock],
      "2026-07-27",
      "America/New_York",
    );

    expect(daily).toEqual({
      completedEstimatedMinutes: 30,
      scheduledEstimatedMinutes: 40,
      completedBlocks: 1,
      totalBlocks: 2,
      percent: 75,
    });
    expect(weekly).toEqual(daily);
  });
});
