import type { ISODate, Pacing, PointerNudge, Profile, SchoolYear } from '../types'
import type { Weekday } from './parser'

/**
 * MP — the pacing engine (the core idea, built first). PURE: no React, no storage.
 *
 * Calendar weeks map to SCOPE weeks by counting NON-off weeks since the start date.
 * Marking a travel week "off" shifts every subsequent week's expectation — the plan
 * breathes, no guilt math. Each girl × subject has a weekPointer (defaults to the
 * calendar-derived week); Dad can nudge it ±, and manual nudges are logged. Pointers
 * are the truth the whole hub renders from. Off-weeks affect expectations ONLY.
 */

export const DEFAULT_TOTAL_WEEKS = 36
export const DEFAULT_QUARTER_BREAKS = [9, 18, 27]

/** A fresh school year (start date must still be set by Dad). */
export function defaultSchoolYear(startDate: ISODate = ''): SchoolYear {
  return { startDate, totalWeeks: DEFAULT_TOTAL_WEEKS, quarterBreaks: [...DEFAULT_QUARTER_BREAKS], offWeeks: [] }
}

export const isSchoolYearConfigured = (sy: SchoolYear | undefined): sy is SchoolYear =>
  !!sy && !!sy.startDate

// ---------- date helpers (local calendar; mirrors missions.isFridayDate) ----------

const pad = (n: number) => String(n).padStart(2, '0')
const dateOf = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const toISO = (dt: Date): string => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return toISO(new Date(y, m - 1, d + n))
}
function daysBetween(aISO: string, bISO: string): number {
  return Math.round((dateOf(bISO).getTime() - dateOf(aISO).getTime()) / 86_400_000)
}

const WD_NAMES: Weekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** The weekday name of a date (matches the parser's day tags). */
export function weekdayOf(iso: string): Weekday {
  return WD_NAMES[dateOf(iso).getDay()]
}

/** The Monday (ISO) of the week containing `iso`. Weeks run Mon–Sun. */
export function mondayOf(iso: string): string {
  const dow = dateOf(iso).getDay() // Sun=0 … Sat=6
  const back = (dow + 6) % 7 // days since Monday
  return addDaysISO(iso, -back)
}

// ---------- calendar ↔ scope mapping ----------

/** 0-based calendar-week index of `iso` relative to the start week (negative before start). */
export function calendarWeekIndex(sy: SchoolYear, iso: string): number {
  return Math.floor(daysBetween(mondayOf(sy.startDate), mondayOf(iso)) / 7)
}

/** Is the calendar week whose Monday is `mondayISO` marked off (travel/vacation)? */
export function isOffWeek(sy: SchoolYear, mondayISO: string): boolean {
  return sy.offWeeks.includes(mondayISO)
}

/** Is the week containing `iso` an off (travel) week? */
export function isTravelWeek(sy: SchoolYear, iso: string): boolean {
  return isSchoolYearConfigured(sy) && calendarWeekIndex(sy, iso) >= 0 && isOffWeek(sy, mondayOf(iso))
}

/**
 * The scope week expected as of `iso`: the count of NON-off calendar weeks from the
 * start through the week containing `iso`, capped at totalWeeks. 0 before the year
 * starts. During a travel week the count holds steady at the last taught week (the
 * off week consumes no scope week), so expectations don't advance while away.
 */
export function derivedScopeWeek(sy: SchoolYear, iso: string): number {
  if (!isSchoolYearConfigured(sy)) return 0
  const idx = calendarWeekIndex(sy, iso)
  if (idx < 0) return 0
  let scope = 0
  for (let i = 0; i <= idx; i++) {
    const monday = addDaysISO(mondayOf(sy.startDate), i * 7)
    if (!isOffWeek(sy, monday)) scope++
    if (scope >= sy.totalWeeks) return sy.totalWeeks
  }
  return scope
}

/** The real Monday a given scope week (1-based) lands on, skipping off-weeks. */
export function mondayForScopeWeek(sy: SchoolYear, scopeWeek: number): string | null {
  if (!isSchoolYearConfigured(sy) || scopeWeek < 1) return null
  let scope = 0
  const start = mondayOf(sy.startDate)
  for (let i = 0; i < sy.totalWeeks * 3 + 8; i++) {
    const monday = addDaysISO(start, i * 7)
    if (!isOffWeek(sy, monday)) {
      scope++
      if (scope === scopeWeek) return monday
    }
  }
  return null
}

/** Which quarter (1-based) a scope week belongs to, per the quarter-break boundaries. */
export function quarterOfWeek(sy: SchoolYear, scopeWeek: number): number {
  const breaks = [...sy.quarterBreaks].sort((a, b) => a - b)
  let q = 1
  for (const b of breaks) {
    if (scopeWeek > b) q++
    else break
  }
  return q
}

export interface CalendarRow {
  /** the real Monday of this calendar week. */
  monday: ISODate
  /** true when this week is a travel/off week (no scope week consumed). */
  off: boolean
  /** scope week number (1..totalWeeks) for a taught week; null on an off week. */
  scopeWeek: number | null
  /** quarter (1..4) of the scope week; null on an off week. */
  quarter: number | null
  /** true if a quarter break falls AFTER this scope week. */
  quarterBreakAfter: boolean
}

/**
 * Lay the whole year over real calendar weeks: taught weeks carry their scope number,
 * off weeks are interleaved. Runs until all `totalWeeks` scope weeks are placed.
 */
export function buildCalendar(sy: SchoolYear): CalendarRow[] {
  if (!isSchoolYearConfigured(sy)) return []
  const rows: CalendarRow[] = []
  const start = mondayOf(sy.startDate)
  let scope = 0
  for (let i = 0; scope < sy.totalWeeks && i < sy.totalWeeks * 3 + 12; i++) {
    const monday = addDaysISO(start, i * 7)
    const off = isOffWeek(sy, monday)
    if (off) {
      rows.push({ monday, off: true, scopeWeek: null, quarter: null, quarterBreakAfter: false })
    } else {
      scope++
      rows.push({
        monday,
        off: false,
        scopeWeek: scope,
        quarter: quarterOfWeek(sy, scope),
        quarterBreakAfter: sy.quarterBreaks.includes(scope),
      })
    }
  }
  return rows
}

// ---------- off-week + start-date mutations (on SchoolYear) ----------

export function setStartDate(sy: SchoolYear, iso: string): SchoolYear {
  return { ...sy, startDate: iso }
}

/** Toggle a travel week on/off by its Monday. Keeps the list sorted + de-duped. */
export function toggleOffWeek(sy: SchoolYear, iso: string): SchoolYear {
  const monday = mondayOf(iso)
  const has = sy.offWeeks.includes(monday)
  const offWeeks = has ? sy.offWeeks.filter((w) => w !== monday) : [...sy.offWeeks, monday].sort()
  return { ...sy, offWeeks }
}

// ---------- per-girl per-subject pointers ----------

/** The pointer for a subject: her set pointer, else the calendar-derived week. */
export function resolvePointer(p: Profile, subjectId: string, sy: SchoolYear, todayISO: string): number {
  const set = p.pacing?.pointers?.[subjectId]
  return set != null ? set : derivedScopeWeek(sy, todayISO)
}

/** How far a subject's pointer sits from the calendar week (for the ± drift badge). 0 = on pace. */
export function pointerDrift(p: Profile, subjectId: string, sy: SchoolYear, todayISO: string): number {
  const set = p.pacing?.pointers?.[subjectId]
  if (set == null) return 0
  return set - derivedScopeWeek(sy, todayISO)
}

/**
 * Nudge one subject's pointer to `to`, logging the move (date + old→new + reason).
 * Scoped to THAT subject only — no other subject or student data changes. Clamps to
 * [1, totalWeeks]. A no-op move (same resolved week) still records nothing.
 */
export function nudgePointer(
  p: Profile,
  subjectId: string,
  to: number,
  reason: string,
  nowISO: string,
  sy: SchoolYear,
  todayISO: string,
): Profile {
  const from = resolvePointer(p, subjectId, sy, todayISO)
  const clamped = Math.max(1, Math.min(sy.totalWeeks, Math.round(to)))
  if (clamped === from) return p
  const prev: Pacing = p.pacing ?? { pointers: {}, nudges: [] }
  const nudge: PointerNudge = { at: nowISO, subjectId, from, to: clamped, reason: reason.trim() }
  return {
    ...p,
    pacing: {
      pointers: { ...prev.pointers, [subjectId]: clamped },
      nudges: [...prev.nudges, nudge],
    },
  }
}

/** Clear a subject's manual pointer so it rides the calendar again (does not erase the log). */
export function resetPointer(p: Profile, subjectId: string): Profile {
  if (p.pacing?.pointers?.[subjectId] == null) return p
  const pointers = { ...p.pacing.pointers }
  delete pointers[subjectId]
  return { ...p, pacing: { ...p.pacing, pointers } }
}
