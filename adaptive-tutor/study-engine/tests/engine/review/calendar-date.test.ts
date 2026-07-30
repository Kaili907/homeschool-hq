import { describe, expect, it } from "vitest";

import {
  addCalendarDays,
  calendarDate,
  calendarDateInTimeZone,
  calendarDaysBetween,
} from "../../../engine/review/calendar-date";

describe("calendar-date arithmetic", () => {
  it("handles leap days and month boundaries", () => {
    expect(addCalendarDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addCalendarDays("2024-02-29", 1)).toBe("2024-03-01");
    expect(addCalendarDays("2025-02-28", 1)).toBe("2025-03-01");
    expect(addCalendarDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("keeps calendar-day intervals stable across US daylight-saving dates", () => {
    expect(addCalendarDays("2026-03-07", 3)).toBe("2026-03-10");
    expect(calendarDaysBetween("2026-03-07", "2026-03-10")).toBe(3);
    expect(addCalendarDays("2026-10-31", 3)).toBe("2026-11-03");
    expect(calendarDaysBetween("2026-10-31", "2026-11-03")).toBe(3);
  });

  it("supports early four-digit years without Date.UTC's 1900 offset", () => {
    expect(addCalendarDays("0001-01-01", 1)).toBe("0001-01-02");
    expect(calendarDaysBetween("0001-01-01", "0001-01-02")).toBe(1);
  });

  it("derives different local dates from one instant with explicit time zones", () => {
    const instant = "2026-01-01T01:30:00.000Z";

    expect(calendarDateInTimeZone(instant, "America/New_York")).toBe(
      "2025-12-31",
    );
    expect(calendarDateInTimeZone(instant, "Asia/Tokyo")).toBe("2026-01-01");
  });

  it("does not advance the local calendar date during a short DST interval", () => {
    expect(
      calendarDateInTimeZone(
        "2026-03-09T03:30:00.000Z",
        "America/New_York",
      ),
    ).toBe("2026-03-08");
  });

  it.each([
    "",
    "2026-1-01",
    "2026-01-1",
    "2025-02-29",
    "2026-04-31",
    "0000-01-01",
    "10000-01-01",
  ])("rejects invalid calendar date %j", (value) => {
    expect(() => calendarDate(value)).toThrow(RangeError);
  });

  it("rejects invalid instants and time zones", () => {
    expect(() =>
      calendarDateInTimeZone("not-an-instant", "America/New_York"),
    ).toThrow(RangeError);
    expect(() =>
      calendarDateInTimeZone("2026-01-01T00:00:00Z", ""),
    ).toThrow(RangeError);
    expect(() =>
      calendarDateInTimeZone("2026-01-01T00:00:00Z", "Mars/Olympus"),
    ).toThrow(RangeError);
  });
});
