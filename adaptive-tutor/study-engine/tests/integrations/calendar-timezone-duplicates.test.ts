import { describe, expect, it } from "vitest";
import {
  CalendarIntegrationError,
  calendarDateInTimeZone,
  mergeCalendarEntries,
  rescheduleCalendarBlock,
  transformPlannedCalendarItem,
} from "../../integrations/calendar/index.js";

function plannerItem(
  entryId: string,
  sourceItemRef: string,
  scheduledStart = "2026-07-28T09:00:00-04:00",
) {
  return {
    entryId,
    learnerRef: "learner-calendar-test",
    source: "manuel_academy" as const,
    sourceItemRef,
    title: "Calendar fixture",
    blockType: "new_instruction" as const,
    scheduledStart,
    timeZone: "America/New_York",
    intendedLocalDate: "2026-07-28",
    createdAt: "2026-07-27T12:00:00-04:00",
    segments: [
      {
        segmentId: "instruction",
        title: "Instruction",
        estimatedMinutes: 20,
      },
    ],
  };
}

describe("time-zone-safe calendar scheduling", () => {
  it("uses explicit instants and IANA zones at a UTC date boundary", () => {
    const instant = "2026-07-29T00:30:00Z";

    expect(calendarDateInTimeZone(instant, "America/New_York")).toBe(
      "2026-07-28",
    );
    expect(calendarDateInTimeZone(instant, "Asia/Tokyo")).toBe("2026-07-29");
  });

  it("preserves the two distinct instants during a daylight-saving overlap", () => {
    const first = "2026-11-01T01:30:00-04:00";
    const second = "2026-11-01T01:30:00-05:00";

    expect(Date.parse(second) - Date.parse(first)).toBe(60 * 60 * 1_000);
    expect(calendarDateInTimeZone(first, "America/New_York")).toBe(
      "2026-11-01",
    );
    expect(calendarDateInTimeZone(second, "America/New_York")).toBe(
      "2026-11-01",
    );
  });

  it("rejects offset-free timestamps, unknown zones, and local-date drift", () => {
    expect(() =>
      transformPlannedCalendarItem({
        ...plannerItem("no-offset", "no-offset"),
        scheduledStart: "2026-07-28T09:00:00",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<CalendarIntegrationError>>({
        code: "invalid_timestamp",
      }),
    );
    expect(() =>
      transformPlannedCalendarItem({
        ...plannerItem("bad-zone", "bad-zone"),
        timeZone: "Mars/Olympus_Mons",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<CalendarIntegrationError>>({
        code: "invalid_time_zone",
      }),
    );
    expect(() =>
      transformPlannedCalendarItem({
        ...plannerItem(
          "wrong-day",
          "wrong-day",
          "2026-07-29T00:30:00Z",
        ),
        timeZone: "Asia/Tokyo",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<CalendarIntegrationError>>({
        code: "local_date_mismatch",
      }),
    );
  });
});

describe("duplicate calendar entry prevention", () => {
  it("collapses repeat imports by learner and stable source identity", () => {
    const first = transformPlannedCalendarItem(
      plannerItem("calendar-entry-1", "lesson-42"),
    );
    const repeatWithAnotherGeneratedId = transformPlannedCalendarItem(
      plannerItem("calendar-entry-2", "lesson-42"),
    );

    const merged = mergeCalendarEntries(
      [first],
      [repeatWithAnotherGeneratedId],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].dedupeKey).toBe("manuel_academy:lesson-42");
  });

  it("preserves a locally rescheduled revision over a repeated fresh import", () => {
    const imported = transformPlannedCalendarItem(
      plannerItem("calendar-entry-1", "lesson-42"),
    );
    const locallyRescheduled = rescheduleCalendarBlock(imported, {
      at: "2026-07-27T13:00:00-04:00",
      actor: "parent",
      method: "parent_edit",
      scheduledStart: "2026-07-29T11:00:00-04:00",
      timeZone: "America/New_York",
    });
    const freshRepeat = transformPlannedCalendarItem(
      plannerItem("calendar-entry-2", "lesson-42"),
    );

    expect(mergeCalendarEntries([locallyRescheduled], [freshRepeat])).toEqual([
      locallyRescheduled,
    ]);
  });

  it("rejects one entry ID reused for a different source record", () => {
    const first = transformPlannedCalendarItem(
      plannerItem("same-entry", "lesson-42"),
    );
    const conflicting = transformPlannedCalendarItem(
      plannerItem("same-entry", "lesson-43"),
    );

    expect(() => mergeCalendarEntries([first], [conflicting])).toThrowError(
      expect.objectContaining<Partial<CalendarIntegrationError>>({
        code: "identity_conflict",
      }),
    );
  });
});
