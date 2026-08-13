/**
 * Canonical list of grades authored Manuel Academy curriculum currently
 * supports, in ascending order. Grade 6 is intentionally absent — no
 * curriculum has been authored for it yet — and must not be added here
 * just because it sits between 5 and 7. See AUDIT.md for the many places
 * that independently guess at this list today.
 */
export const SUPPORTED_ACADEMY_GRADES = [3, 4, 5, 7, 8, 9, 10, 11, 12] as const

/** One grade curriculum content actually exists for. */
export type AcademySupportedGrade = (typeof SUPPORTED_ACADEMY_GRADES)[number]
