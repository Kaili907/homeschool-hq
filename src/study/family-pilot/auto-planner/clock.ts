import type { FamilyAutoPlannerSchoolPlanV1, SchoolWeekday } from './types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

export function assertTimeZone(timeZone: string): void {
  new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(0))
}

/** School-local calendar date at an explicit instant. No host-local or UTC date
 * fallback is permitted because either would move work across midnight. */
export function schoolLocalDate(instant: Date, timeZone: string): string {
  assertTimeZone(timeZone)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes): string => {
    const value = parts.find((part) => part.type === type)?.value
    if (!value) throw new Error(`Unable to resolve school-local ${type}.`)
    return value
  }
  return `${read('year')}-${read('month')}-${read('day')}`
}

export function weekdayOf(date: string): SchoolWeekday {
  if (!isIsoDate(date)) throw new Error('School date must be an ISO calendar date.')
  const [year, month, day] = date.split('-').map(Number)
  const sundayZero = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return (sundayZero === 0 ? 7 : sundayZero) as SchoolWeekday
}

export function schoolDayReason(
  plan: FamilyAutoPlannerSchoolPlanV1,
  date: string,
): 'SCHOOL_DAY' | 'OUTSIDE_SCHOOL_YEAR' | 'NON_SCHOOL_DAY' {
  if (date < plan.schoolYearStart || date > plan.schoolYearEnd) return 'OUTSIDE_SCHOOL_YEAR'
  if (plan.addedSchoolDates.includes(date)) return 'SCHOOL_DAY'
  if (plan.nonSchoolDates.includes(date)) return 'NON_SCHOOL_DAY'
  return plan.schoolWeekdays.includes(weekdayOf(date)) ? 'SCHOOL_DAY' : 'NON_SCHOOL_DAY'
}
