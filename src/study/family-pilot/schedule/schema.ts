import type { FamilyPilotAssignmentState } from '../core/schema'

// FAMILY-PILOT-SCHEDULE: "what does this student need to do today, and what is
// next?" This module answers that question only. It is not a second Study
// Engine and does not schedule, plan, or sync a calendar — it orders a flat
// list of a student's items for one day.
//
// The assignment engine (src/study/family-pilot/assignments/**) is owned by a
// parallel, still-moving session. This module never imports it. Assignment
// facts arrive as plain input data through buildDailySchedule's parameters,
// scoped by the one stable, already-merged contract this module does depend
// on: FamilyPilotAssignmentState from ../core/schema.
//
// No storage, no clock, no randomness: every function here is a pure
// transform over data the caller supplies and owns. The host decides when to
// call buildDailySchedule again and when to persist the result.

export type ScheduleItemKind = 'assignment' | 'study-session' | 'break'

export type ScheduleItemStatus = 'pending' | 'in-progress' | 'completed'

export interface ScheduleItemV1 {
  readonly scheduleItemRef: string
  readonly studentRef: string
  readonly date: string
  readonly title: string
  readonly kind: ScheduleItemKind
  readonly order: number
  readonly status: ScheduleItemStatus
  readonly assignmentRef: string | null
  readonly lessonRef: string | null
}

/** One assignment as scheduling input. `state` is the assignment engine's own truth. */
export interface DailyScheduleAssignmentInput {
  readonly kind: 'assignment'
  readonly assignmentRef: string
  readonly lessonRef?: string | null
  readonly title: string
  readonly state: FamilyPilotAssignmentState
}

/** A standalone study block not tied to a specific assignment record. */
export interface DailyScheduleStudySessionInput {
  readonly kind: 'study-session'
  readonly scheduleItemRef: string
  readonly title: string
  readonly lessonRef?: string | null
  /** Carried in from the host's last known copy of this item, if any. */
  readonly status?: ScheduleItemStatus
}

/** An optional rest item. Never counted toward academic completion. */
export interface DailyScheduleBreakInput {
  readonly kind: 'break'
  readonly scheduleItemRef: string
  readonly title: string
  readonly status?: ScheduleItemStatus
}

export type DailyScheduleInputItem =
  | DailyScheduleAssignmentInput
  | DailyScheduleStudySessionInput
  | DailyScheduleBreakInput

export interface BuildDailyScheduleInput {
  readonly studentRef: string
  readonly date: string
  /**
   * The day's candidate items, in the base order the host wants them to
   * appear absent any in-progress promotion. Assignments abandoned in the
   * assignment engine are not shown here — they are no longer today's work.
   */
  readonly items: readonly DailyScheduleInputItem[]
}

/**
 * `|` is not a valid character in the IDENTIFIER ref format used throughout
 * this codebase (see ../core/schema.ts), so it can only ever appear here as
 * this function's own delimiter. Joining with `:` instead would not be
 * injective: studentRef/date/assignmentRef may themselves contain `:` (refs
 * commonly look like `student:ada`), so two different triples could produce
 * the same joined string.
 */
function assignmentItemRef(studentRef: string, date: string, assignmentRef: string): string {
  return `schedule|${studentRef}|${date}|${assignmentRef}`
}

function dedupeKey(item: DailyScheduleInputItem): string {
  return item.kind === 'assignment' ? `assignment:${item.assignmentRef}` : `item:${item.scheduleItemRef}`
}

function statusOf(item: DailyScheduleInputItem): ScheduleItemStatus {
  if (item.kind === 'assignment') {
    if (item.state === 'completed') return 'completed'
    if (item.state === 'active' || item.state === 'paused') return 'in-progress'
    return 'pending'
  }
  return item.status ?? 'pending'
}

const STATUS_RANK: Readonly<Record<ScheduleItemStatus, number>> = Object.freeze({
  'in-progress': 0,
  pending: 1,
  completed: 2,
})

/**
 * Builds one student's ordered items for one day.
 *
 * - Abandoned assignments are dropped; they are not today's work.
 * - A duplicate assignmentRef (or duplicate scheduleItemRef for a
 *   study-session/break) keeps only the first occurrence.
 * - Items are grouped in-progress first, then pending, then completed, with a
 *   stable sort preserving the caller's relative order within each group —
 *   so the same input always yields the same output.
 * - An assignment's scheduleItemRef is derived deterministically from
 *   (studentRef, date, assignmentRef), so rebuilding the same day from the
 *   same assignment facts reuses the same ref rather than minting a new one.
 *   A paused assignment maps to 'in-progress', not 'pending', so it stays the
 *   same resumable item rather than becoming a fresh one.
 */
export function buildDailySchedule(input: BuildDailyScheduleInput): readonly ScheduleItemV1[] {
  const seen = new Set<string>()
  const candidates: DailyScheduleInputItem[] = []
  for (const item of input.items) {
    if (item.kind === 'assignment' && item.state === 'abandoned') continue
    const key = dedupeKey(item)
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push(item)
  }

  const withRank = candidates.map((item, index) => ({ item, status: statusOf(item), index }))
  withRank.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.index - b.index)

  return Object.freeze(
    withRank.map(({ item, status }, order) =>
      Object.freeze({
        scheduleItemRef: item.kind === 'assignment'
          ? assignmentItemRef(input.studentRef, input.date, item.assignmentRef)
          : item.scheduleItemRef,
        studentRef: input.studentRef,
        date: input.date,
        title: item.title,
        kind: item.kind,
        order,
        status,
        assignmentRef: item.kind === 'assignment' ? item.assignmentRef : null,
        lessonRef: item.kind === 'assignment' || item.kind === 'study-session'
          ? item.lessonRef ?? null
          : null,
      })),
  )
}
