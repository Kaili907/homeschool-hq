/**
 * A calendar date without a time or UTC offset.
 *
 * Keeping review due dates as calendar dates prevents daylight-saving changes
 * from turning a one-day review interval into a 23- or 25-hour calculation.
 */
export type CalendarDate = string;

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 86_400_000;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  const monthLengths = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return monthLengths[month - 1] ?? 0;
}

interface CalendarParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

function parseParts(value: string): CalendarParts {
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) {
    throw new RangeError(
      "Invalid calendar date. Expected a real date in YYYY-MM-DD format.",
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1 || year > 9999 || month < 1 || month > 12) {
    throw new RangeError(
      "Invalid calendar date. Expected a real date in YYYY-MM-DD format.",
    );
  }

  if (day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(
      "Invalid calendar date. Expected a real date in YYYY-MM-DD format.",
    );
  }

  return { year, month, day };
}

function formatParts(parts: CalendarParts): CalendarDate {
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(
    2,
    "0",
  )}-${String(parts.day).padStart(2, "0")}`;
}

function utcMilliseconds(parts: CalendarParts): number {
  const instant = new Date(0);
  instant.setUTCHours(0, 0, 0, 0);
  instant.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  return instant.getTime();
}

/** Validate and normalize an ISO calendar date. */
export function calendarDate(value: string): CalendarDate {
  return formatParts(parseParts(value));
}

/**
 * Add whole calendar days using UTC only as an arithmetic implementation
 * detail. The returned value remains a time-zone-free calendar date.
 */
export function addCalendarDays(
  value: CalendarDate,
  days: number,
): CalendarDate {
  if (!Number.isSafeInteger(days)) {
    throw new RangeError("Calendar-day offset must be a safe integer.");
  }

  const parts = parseParts(value);
  const instant = new Date(0);
  instant.setUTCHours(0, 0, 0, 0);
  instant.setUTCFullYear(parts.year, parts.month - 1, parts.day + days);
  const result = formatParts({
    year: instant.getUTCFullYear(),
    month: instant.getUTCMonth() + 1,
    day: instant.getUTCDate(),
  });

  if (instant.getUTCFullYear() < 1 || instant.getUTCFullYear() > 9999) {
    throw new RangeError("Calendar-day calculation is outside years 0001-9999.");
  }

  return result;
}

/** Return the signed number of whole calendar days from start to end. */
export function calendarDaysBetween(
  start: CalendarDate,
  end: CalendarDate,
): number {
  const startParts = parseParts(start);
  const endParts = parseParts(end);
  const startMilliseconds = utcMilliseconds(startParts);
  const endMilliseconds = utcMilliseconds(endParts);

  return Math.round(
    (endMilliseconds - startMilliseconds) / MILLISECONDS_PER_DAY,
  );
}

/**
 * Convert an absolute instant to the learner's local calendar date.
 *
 * Callers must supply an IANA time-zone name. The engine never guesses a
 * learner's time zone from locale, IP address, or other personal data.
 */
export function calendarDateInTimeZone(
  instant: Date | string | number,
  timeZone: string,
): CalendarDate {
  const parsedInstant = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(parsedInstant.getTime())) {
    throw new RangeError("Instant must be a valid Date, timestamp, or ISO string.");
  }
  if (timeZone.trim().length === 0) {
    throw new RangeError("An explicit IANA time-zone name is required.");
  }

  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      calendar: "iso8601",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(parsedInstant);
  } catch {
    throw new RangeError("Invalid or unsupported IANA time zone.");
  }

  const part = (type: Intl.DateTimeFormatPartTypes): string | undefined =>
    parts.find((candidate) => candidate.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");

  if (!year || !month || !day) {
    throw new RangeError("Unable to derive a calendar date in the supplied time zone.");
  }

  return calendarDate(`${year}-${month}-${day}`);
}
