import type { AttendanceDay, AttendanceState, ISODate, Profile } from '../types'
import { templateFor } from '../missions'

// ============================================================================
// SE-B attendance (SE card #6). Invisible to the kids: when a mission day
// completes, one attendance day is auto-recorded per profile. The log is
// append-only — a school day that happened is never un-happened, even if Dad
// later unchecks an item. Hours are estimated from the girl's template block
// count, with a Dad-editable per-girl hours/day override. Monthly + YTD counts
// and CSV export live here too. Self-contained; MP absorbs it later.
// ============================================================================

/** Estimated hours credited per mission block when Dad hasn't set an override. */
export const HOURS_PER_BLOCK = 0.5

const roundQuarter = (h: number) => Math.round(h * 4) / 4

export function emptyAttendance(): AttendanceState {
  return { log: [] }
}

export function getAttendance(p: Profile): AttendanceState {
  return p.attendance ?? emptyAttendance()
}

/** Estimate a full school day's hours from the girl's weekday template block count. */
export function estimateHoursFromTemplate(p: Profile): number {
  const blocks = templateFor(p).weekday.length
  return roundQuarter(blocks * HOURS_PER_BLOCK)
}

/** Effective hours/day: Dad's override when set, else the template estimate. */
export function effectiveHoursPerDay(p: Profile): number {
  const override = getAttendance(p).hoursPerDay
  return override != null && override >= 0 ? override : estimateHoursFromTemplate(p)
}

/** Dad sets (or clears, with undefined) the per-girl hours/day override. */
export function setHoursPerDay(p: Profile, hours: number | undefined): Profile {
  const att = getAttendance(p)
  const next: AttendanceState = { ...att }
  if (hours == null || Number.isNaN(hours)) delete next.hoursPerDay
  else next.hoursPerDay = Math.max(0, hours)
  return { ...p, attendance: next }
}

/** Has this date already been logged? (append-only guard) */
export function hasAttendance(state: AttendanceState, date: ISODate): boolean {
  return state.log.some((d) => d.date === date)
}

/**
 * Import a mission-day completion. Appends exactly one attendance row for `today`
 * IFF the day is complete and not already logged; otherwise returns the profile
 * unchanged. Idempotent and safe to call on every render — the date guard makes a
 * second call a no-op. `dayComplete` is passed in so this module never has to know
 * how completion is decided (missions.isDayComplete owns that).
 */
export function recordAttendance(
  p: Profile,
  dayComplete: boolean,
  today: ISODate,
): Profile {
  if (!dayComplete) return p
  const att = getAttendance(p)
  if (hasAttendance(att, today)) return p
  const row: AttendanceDay = { date: today, hours: effectiveHoursPerDay(p) }
  return { ...p, attendance: { ...att, log: [...att.log, row] } }
}

// ---------- aggregation ----------

export interface AttendanceTotals {
  days: number
  hours: number
}

const sum = (rows: AttendanceDay[]): AttendanceTotals => ({
  days: rows.length,
  hours: roundQuarter(rows.reduce((n, r) => n + r.hours, 0)),
})

/** Totals for one calendar month, e.g. month='2026-09'. */
export function monthTotals(state: AttendanceState, month: string): AttendanceTotals {
  return sum(state.log.filter((r) => r.date.startsWith(`${month}-`)))
}

/**
 * School-year to-date totals. The homeschool year rolls over Aug 1, so YTD for a
 * date in Jan–Jul belongs to the year that started the previous August. `asOf`
 * bounds the window (defaults to the latest logged date).
 */
export function yearToDateTotals(state: AttendanceState, asOf: ISODate): AttendanceTotals {
  const [y, m] = asOf.split('-').map(Number)
  const startYear = m >= 8 ? y : y - 1
  const start = `${startYear}-08-01`
  return sum(state.log.filter((r) => r.date >= start && r.date <= asOf))
}

/** Distinct months present in the log, most-recent first (for the panel). */
export function loggedMonths(state: AttendanceState): string[] {
  const set = new Set(state.log.map((r) => r.date.slice(0, 7)))
  return [...set].sort().reverse()
}

// ---------- CSV export ----------

const csvField = (v: string | number): string => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Attendance CSV: one row per school day, date + hours. */
export function attendanceCsv(state: AttendanceState): string {
  const rows = [...state.log].sort((a, b) => a.date.localeCompare(b.date))
  const lines = ['date,hours', ...rows.map((r) => `${csvField(r.date)},${csvField(r.hours)}`)]
  return lines.join('\n')
}
