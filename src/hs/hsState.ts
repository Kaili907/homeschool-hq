// ---------- M4 high-school state helpers (pure, immutable) ----------

import type { CollegeTask, CourseTrack, HsUnitStat, Profile } from '../types'
import { isoToday } from '../appState'
import { defaultCollegeTasks, defaultCoursesFor } from './hsCatalog'

const rid = () => Math.random().toString(36).slice(2, 9)

/** True for the two teen profiles that use high-school mode. */
export const isHighSchool = (p: Profile): boolean => p.grade === '10' || p.grade === '12'

/**
 * Seed the additive HS fields on first view. Non-destructive: only fills fields
 * that are still undefined, never overwrites Dad's edits or existing data.
 * Returns the same object reference when nothing changed (cheap no-op).
 */
export function ensureHsDefaults(p: Profile): Profile {
  if (!isHighSchool(p)) return p
  let next = p
  if (next.courses === undefined) {
    next = { ...next, courses: defaultCoursesFor(next.grade) }
  }
  if (next.grade === '12' && next.collegeTasks === undefined) {
    next = { ...next, collegeTasks: defaultCollegeTasks() }
  }
  return next
}

// ---------- practice stats ----------

export function getHsStat(p: Profile, unitId: string): HsUnitStat {
  return p.hsStats?.[unitId] ?? { attempts: 0, correct: 0 }
}

/** Tally one answered HS practice question against its unit. */
export function recordHsAnswer(
  p: Profile,
  unitId: string,
  correct: boolean,
  today: string = isoToday(),
): Profile {
  const prev = getHsStat(p, unitId)
  const stat: HsUnitStat = {
    attempts: prev.attempts + 1,
    correct: prev.correct + (correct ? 1 : 0),
    lastSeen: today,
  }
  return {
    ...p,
    hsStats: { ...p.hsStats, [unitId]: stat },
    totals: {
      ...p.totals,
      questionsAnswered: p.totals.questionsAnswered + 1,
      correct: p.totals.correct + (correct ? 1 : 0),
    },
  }
}

// ---------- course tracker ----------

export function setCourses(p: Profile, courses: CourseTrack[]): Profile {
  return { ...p, courses }
}

/** Tick / untick a single unit within a course. */
export function toggleCourseUnit(
  p: Profile,
  courseId: string,
  unitId: string,
  done: boolean,
): Profile {
  const courses = (p.courses ?? []).map((c) =>
    c.id !== courseId
      ? c
      : { ...c, units: c.units.map((u) => (u.id === unitId ? { ...u, done } : u)) },
  )
  return { ...p, courses }
}

export function courseProgress(c: CourseTrack): { done: number; total: number; pct: number } {
  const total = c.units.length
  const done = c.units.filter((u) => u.done).length
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
}

// ---------- college-application deadlines (senior) ----------

export function setCollegeTasks(p: Profile, collegeTasks: CollegeTask[]): Profile {
  return { ...p, collegeTasks }
}

export function addCollegeTask(p: Profile, label = 'New task', due = ''): Profile {
  const task: CollegeTask = { id: rid(), label, due, done: false }
  return { ...p, collegeTasks: [...(p.collegeTasks ?? []), task] }
}

export function updateCollegeTask(
  p: Profile,
  id: string,
  patch: Partial<Omit<CollegeTask, 'id'>>,
): Profile {
  const collegeTasks = (p.collegeTasks ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t))
  return { ...p, collegeTasks }
}

export function removeCollegeTask(p: Profile, id: string): Profile {
  return { ...p, collegeTasks: (p.collegeTasks ?? []).filter((t) => t.id !== id) }
}

export interface SortedCollegeTask {
  task: CollegeTask
  overdue: boolean
}

/** An incomplete task with a due date strictly before today is overdue. */
export function isOverdue(t: CollegeTask, today: string = isoToday()): boolean {
  return !t.done && t.due !== '' && t.due < today
}

/**
 * Deadline view order (Build-Spec §M4): overdue first (soonest-past first),
 * then upcoming by due date (undated last), then completed tasks at the bottom.
 * A stable helper so the senior's mission shows red overdue items on top.
 */
export function sortedCollegeTasks(
  tasks: readonly CollegeTask[],
  today: string = isoToday(),
): SortedCollegeTask[] {
  const byDue = (a: CollegeTask, b: CollegeTask) => {
    if (a.due === b.due) return 0
    if (a.due === '') return 1 // undated sinks below dated
    if (b.due === '') return -1
    return a.due < b.due ? -1 : 1
  }
  const overdue = tasks.filter((t) => isOverdue(t, today)).slice().sort(byDue)
  const upcoming = tasks.filter((t) => !t.done && !isOverdue(t, today)).slice().sort(byDue)
  const done = tasks.filter((t) => t.done).slice().sort(byDue)
  return [
    ...overdue.map((task) => ({ task, overdue: true })),
    ...upcoming.map((task) => ({ task, overdue: false })),
    ...done.map((task) => ({ task, overdue: false })),
  ]
}
