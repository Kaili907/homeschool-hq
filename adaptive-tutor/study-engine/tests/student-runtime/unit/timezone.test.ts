import {
  LEARNER_TIME_ZONE,
  isSupportedIanaTimeZone,
  requireIanaTimeZone,
} from "@runtime/catalog";
import { calendarDateInTimeZone } from "@study-engine";

describe("household IANA timezone", () => {
  it("keeps New York only as the explicit sample default", () => {
    expect(LEARNER_TIME_ZONE).toBe("America/New_York");
    expect(requireIanaTimeZone(LEARNER_TIME_ZONE)).toBe("America/New_York");
  });

  it("accepts a supported non-DST household timezone", () => {
    expect(requireIanaTimeZone("Asia/Kolkata")).toBe("Asia/Kolkata");
    expect(
      calendarDateInTimeZone("2026-01-01T20:00:00.000Z", "Asia/Kolkata"),
    ).toBe("2026-01-02");
  });

  it("uses the supplied zone deterministically across a DST transition", () => {
    const before = calendarDateInTimeZone(
      "2026-03-08T06:59:59.000Z",
      "America/New_York",
    );
    const after = calendarDateInTimeZone(
      "2026-03-08T07:00:00.000Z",
      "America/New_York",
    );
    expect(before).toBe("2026-03-08");
    expect(after).toBe("2026-03-08");
  });

  it.each([undefined, "", "New_York", "America//New_York", "Mars/Olympus"])(
    "rejects missing, malformed, or unsupported input: %s",
    (value) => {
      expect(isSupportedIanaTimeZone(value)).toBe(false);
      expect(() => requireIanaTimeZone(value)).toThrow(
        "A supported household IANA timezone is required.",
      );
    },
  );
});
