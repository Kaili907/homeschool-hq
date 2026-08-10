import type { Profile } from '../../types'
import type { AcademySchedule } from '../contentTypes'

/**
 * CURR-1 — versioned adapter between the curriculum schedule and the Study
 * Engine's host-context vocabulary (see study/hostContext.buildHostStudyContext:
 * `lessonRef` / `skillRefs` strings). ADAPTER CONTRACT v1: the academy exposes
 * its scheduled work as refs the study layer already understands; it never
 * reaches into study state, and Study never mutates Academy state. Mounted by
 * the scheduled-day dashboard control as advisory context only.
 */

export const ACADEMY_STUDY_ADAPTER_VERSION = 1 as const

export interface AcademyStudyContext {
  readonly adapterVersion: typeof ACADEMY_STUDY_ADAPTER_VERSION
  readonly releaseVersion: string
  /** study-vocabulary lesson ref for the day's academy block. */
  readonly lessonRef: string
  /** the day's scheduled lesson ids, in order (study scheduling input). */
  readonly skillRefs: readonly string[]
  readonly scopeWeek: number
  readonly scopeDay: number
}

/**
 * The academy study context for one scope day (1-based week/day), or null when
 * the schedule has no such day (e.g. beyond week 36).
 */
export function buildAcademyStudyContext(
  profile: Profile,
  schedule: AcademySchedule,
  scopeWeek: number,
  scopeDay: number,
): AcademyStudyContext | null {
  if (!profile.academy) return null
  const day = schedule.days.find((d) => d.week === scopeWeek && d.day === scopeDay)
  if (!day) return null
  return {
    adapterVersion: ACADEMY_STUDY_ADAPTER_VERSION,
    releaseVersion: profile.academy.releaseVersion,
    lessonRef: `grade-${schedule.grade}:academy-week-${scopeWeek}-day-${scopeDay}`,
    skillRefs: day.lessons.map((l) => l.lessonId),
    scopeWeek,
    scopeDay,
  }
}
