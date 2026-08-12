import type { ScheduleItemV1 } from './schema'

// FAMILY-PILOT-SCHEDULE: pure reads and transitions over an items array the
// host owns. No storage, no clock. Every function is scoped by studentRef so
// that a caller holding a mixed list (multiple students' items in one array)
// can never read or mutate a sibling student's item, even by an unknown or
// mistaken scheduleItemRef — mirroring withStudent/withAssignment in
// ../core/operations.ts.

function forStudent(
  items: readonly ScheduleItemV1[],
  studentRef: string,
): readonly ScheduleItemV1[] {
  return items.filter((item) => item.studentRef === studentRef)
}

function byOrder(items: readonly ScheduleItemV1[]): readonly ScheduleItemV1[] {
  return [...items].sort((a, b) => a.order - b.order)
}

/** The item currently being worked on, or null if nothing is in progress. */
export function getCurrentScheduleItem(
  items: readonly ScheduleItemV1[],
  studentRef: string,
): ScheduleItemV1 | null {
  const ordered = byOrder(forStudent(items, studentRef))
  return ordered.find((item) => item.status === 'in-progress') ?? null
}

/**
 * What the student should do next: resume anything already in progress,
 * otherwise the first pending item, otherwise null when the day is done.
 */
export function getNextScheduleItem(
  items: readonly ScheduleItemV1[],
  studentRef: string,
): ScheduleItemV1 | null {
  const ordered = byOrder(forStudent(items, studentRef))
  return ordered.find((item) => item.status === 'in-progress') ??
    ordered.find((item) => item.status === 'pending') ??
    null
}

function withScheduleItem(
  items: readonly ScheduleItemV1[],
  studentRef: string,
  scheduleItemRef: string,
  mutate: (item: ScheduleItemV1) => ScheduleItemV1,
): readonly ScheduleItemV1[] {
  let changed = false
  const next = items.map((item) => {
    if (item.studentRef !== studentRef || item.scheduleItemRef !== scheduleItemRef) return item
    const mutated = mutate(item)
    if (mutated === item) return item
    changed = true
    return mutated
  })
  // An unknown ref, wrong student, or a refused transition returns the
  // ORIGINAL array so callers can use reference equality to detect a change.
  if (!changed) return items
  return Object.freeze(next)
}

/** Starts a pending item. A no-op for anything already in progress or completed. */
export function markScheduleItemStarted(
  items: readonly ScheduleItemV1[],
  studentRef: string,
  scheduleItemRef: string,
): readonly ScheduleItemV1[] {
  return withScheduleItem(items, studentRef, scheduleItemRef, (item) =>
    item.status !== 'pending' ? item : Object.freeze({ ...item, status: 'in-progress' }))
}

/** Completes an item. Completed items stay completed — this is idempotent. */
export function markScheduleItemCompleted(
  items: readonly ScheduleItemV1[],
  studentRef: string,
  scheduleItemRef: string,
): readonly ScheduleItemV1[] {
  return withScheduleItem(items, studentRef, scheduleItemRef, (item) =>
    item.status === 'completed' ? item : Object.freeze({ ...item, status: 'completed' }))
}
