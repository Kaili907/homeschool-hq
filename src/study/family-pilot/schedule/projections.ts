import type { ScheduleItemV1 } from './schema'

// FAMILY-PILOT-SCHEDULE: read-only progress summary, derived from the items
// array rather than stored alongside it — same reasoning as
// ../core/projections.ts. Optional break items are counted in totals and in
// "is the day done", but never counted toward academic completion.

export interface ScheduleProgressView {
  readonly studentRef: string
  readonly totalItems: number
  readonly completedCount: number
  readonly inProgressCount: number
  readonly pendingCount: number
  readonly academicTotal: number
  readonly academicCompleted: number
  /** 0-100, integer. 100 when there is no academic work today. */
  readonly percentComplete: number
  /** True once every item — including breaks — is completed. Vacuously true for an empty day. */
  readonly allDone: boolean
}

function percentComplete(completed: number, total: number): number {
  if (total <= 0) return 100
  return Math.min(100, Math.max(0, Math.round((completed / total) * 100)))
}

export function scheduleProgress(
  items: readonly ScheduleItemV1[],
  studentRef: string,
): ScheduleProgressView {
  const mine = items.filter((item) => item.studentRef === studentRef)
  const academic = mine.filter((item) => item.kind !== 'break')
  const academicCompleted = academic.filter((item) => item.status === 'completed').length
  return Object.freeze({
    studentRef,
    totalItems: mine.length,
    completedCount: mine.filter((item) => item.status === 'completed').length,
    inProgressCount: mine.filter((item) => item.status === 'in-progress').length,
    pendingCount: mine.filter((item) => item.status === 'pending').length,
    academicTotal: academic.length,
    academicCompleted,
    percentComplete: percentComplete(academicCompleted, academic.length),
    allDone: mine.every((item) => item.status === 'completed'),
  })
}
