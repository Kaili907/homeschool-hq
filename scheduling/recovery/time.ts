import type {
  ISODate,
  InstantString,
  LocalDateTime,
  LocalTime,
} from './types'

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const LOCAL_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/
const WINDOW_TIME_RE = /^(?:([01]\d|2[0-3]):([0-5]\d)|24:00)$/
const OFFSET_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/

export type DstDisambiguation = 'compatible' | 'earlier' | 'later' | 'reject'

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string') return false
  const match = ISO_DATE_RE.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function isLocalTime(value: unknown): value is LocalTime {
  return typeof value === 'string' && LOCAL_TIME_RE.test(value)
}

export function isWindowBoundaryTime(value: unknown): value is LocalTime {
  return typeof value === 'string' && WINDOW_TIME_RE.test(value)
}

export function isInstantString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    OFFSET_TIMESTAMP_RE.test(value) &&
    Number.isFinite(Date.parse(value))
  )
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0)
    return true
  } catch {
    return false
  }
}

export function timeToMinutes(time: LocalTime): number {
  if (time === '24:00') return 1440
  const match = LOCAL_TIME_RE.exec(time)
  if (!match) return Number.NaN
  return Number(match[1]) * 60 + Number(match[2])
}

export function minutesToTime(minutes: number): LocalTime {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) {
    throw new RangeError('minutes must be an integer from 0 through 1440')
  }
  if (minutes === 1440) return '24:00'
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(
    minutes % 60,
  ).padStart(2, '0')}`
}

export function compareLocalDateTime(
  left: LocalDateTime,
  right: LocalDateTime,
): number {
  const dateOrder = left.date.localeCompare(right.date)
  return dateOrder || timeToMinutes(left.time) - timeToMinutes(right.time)
}

export function addCalendarDays(date: ISODate, days: number): ISODate {
  if (!isISODate(date) || !Number.isInteger(days)) {
    throw new RangeError('addCalendarDays requires a valid date and integer days')
  }
  const [year, month, day] = date.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day + days))
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(
    2,
    '0',
  )}-${String(result.getUTCDate()).padStart(2, '0')}`
}

/** ISO weekday: Monday=1 through Sunday=7, independent of host time zone. */
export function weekdayOf(date: ISODate): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  if (!isISODate(date)) throw new RangeError('invalid ISO date')
  const [year, month, day] = date.split('-').map(Number)
  const sundayZero = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return (sundayZero === 0 ? 7 : sundayZero) as 1 | 2 | 3 | 4 | 5 | 6 | 7
}

export function mondayOf(date: ISODate): ISODate {
  return addCalendarDays(date, 1 - weekdayOf(date))
}

export function datesBetween(start: ISODate, end: ISODate): ISODate[] {
  if (!isISODate(start) || !isISODate(end) || start > end) return []
  const result: ISODate[] = []
  for (let date = start; date <= end; date = addCalendarDays(date, 1)) {
    result.push(date)
  }
  return result
}

interface DateTimeParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone)
  if (cached) return cached
  const created = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  formatterCache.set(timeZone, created)
  return created
}

function partsAt(epochMs: number, timeZone: string): DateTimeParts {
  const values: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {}
  for (const part of formatter(timeZone).formatToParts(epochMs)) {
    if (part.type !== 'literal') values[part.type] = part.value
  }
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

function naiveEpoch(parts: DateTimeParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
}

function offsetAt(epochMs: number, timeZone: string): number {
  const local = partsAt(epochMs, timeZone)
  return naiveEpoch(local) - Math.floor(epochMs / 1000) * 1000
}

function requestedParts(value: LocalDateTime): DateTimeParts {
  if (!isISODate(value.date) || !isLocalTime(value.time)) {
    throw new RangeError('invalid local date-time')
  }
  const [year, month, day] = value.date.split('-').map(Number)
  const [hour, minute] = value.time.split(':').map(Number)
  return { year, month, day, hour, minute, second: 0 }
}

function sameParts(left: DateTimeParts, right: DateTimeParts): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second
  )
}

/**
 * Resolves an IANA-zone wall time without relying on the host's local zone.
 *
 * Ambiguous fall-back times honor `earlier`/`later`; nonexistent spring-forward
 * times follow Temporal-style compatible behavior (move forward by the gap).
 */
export function localDateTimeToEpochMs(
  value: LocalDateTime,
  timeZone: string,
  disambiguation: DstDisambiguation = 'compatible',
): number {
  if (!isValidTimeZone(timeZone)) throw new RangeError('invalid IANA time zone')
  const requested = requestedParts(value)
  const naive = naiveEpoch(requested)
  const offsets = new Set<number>()
  for (let hours = -36; hours <= 36; hours += 3) {
    offsets.add(offsetAt(naive + hours * 60 * 60 * 1000, timeZone))
  }

  const exact = [...offsets]
    .map((offset) => naive - offset)
    .filter((epoch) => sameParts(partsAt(epoch, timeZone), requested))
    .sort((a, b) => a - b)

  if (exact.length > 0) {
    if (exact.length > 1 && disambiguation === 'reject') {
      throw new RangeError('ambiguous local date-time')
    }
    return disambiguation === 'later'
      ? exact[exact.length - 1]
      : exact[0]
  }

  if (disambiguation === 'reject') {
    throw new RangeError('nonexistent local date-time')
  }

  const candidates = [...offsets]
    .map((offset) => naive - offset)
    .map((epoch) => ({
      epoch,
      difference: naiveEpoch(partsAt(epoch, timeZone)) - naive,
    }))

  const before = candidates
    .filter((candidate) => candidate.difference < 0)
    .sort((a, b) => b.difference - a.difference)[0]
  const after = candidates
    .filter((candidate) => candidate.difference > 0)
    .sort((a, b) => a.difference - b.difference)[0]

  if (disambiguation === 'earlier') {
    if (before) return before.epoch
    if (after) return after.epoch
  } else {
    if (after) return after.epoch
    if (before) return before.epoch
  }
  throw new RangeError('could not resolve local date-time')
}

export function localDateTimeToInstant(
  value: LocalDateTime,
  timeZone: string,
  disambiguation: DstDisambiguation = 'compatible',
): InstantString {
  return new Date(
    localDateTimeToEpochMs(value, timeZone, disambiguation),
  ).toISOString()
}

export function instantToLocalDateTime(
  instant: InstantString,
  timeZone: string,
): LocalDateTime {
  if (!isInstantString(instant) || !isValidTimeZone(timeZone)) {
    throw new RangeError('invalid instant or IANA time zone')
  }
  const parts = partsAt(Date.parse(instant), timeZone)
  return {
    date: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(
      parts.day,
    ).padStart(2, '0')}`,
    time: `${String(parts.hour).padStart(2, '0')}:${String(
      parts.minute,
    ).padStart(2, '0')}`,
  }
}

export interface ZonedInterval {
  startEpochMs: number
  endEpochMs: number
}

export function zonedInterval(
  start: LocalDateTime,
  durationMinutes: number,
  timeZone: string,
): ZonedInterval {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new RangeError('duration must be positive')
  }
  const startEpochMs = localDateTimeToEpochMs(start, timeZone)
  return {
    startEpochMs,
    endEpochMs: startEpochMs + durationMinutes * 60_000,
  }
}

export function intervalsOverlap(
  first: ZonedInterval,
  second: ZonedInterval,
): boolean {
  return first.startEpochMs < second.endEpochMs &&
    second.startEpochMs < first.endEpochMs
}
