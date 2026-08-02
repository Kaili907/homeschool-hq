import {
  RECOVERY_CHOICE_LABELS,
  type DayWorkloadSummary,
  type EventChange,
  type GenerateRecoveryProposalInput,
  type ISODate,
  type RecoveryChoice,
  type RecoveryOption,
  type RecoveryProposal,
  type RecoverySchedule,
  type RecoveryTradeoff,
  type ScheduleChange,
  type ScheduleEvent,
  type WorkItem,
} from './types'
import {
  compareWorkPriority,
  dueDateRisks,
  effectivePriorityScore,
  eventCanMove,
  eventCanResize,
  recommendedFocusBlockMinutes,
  remainingWorkMinutes,
} from './models'
import {
  addCalendarDays,
  compareLocalDateTime,
  datesBetween,
  instantToLocalDateTime,
  minutesToTime,
  mondayOf,
  timeToMinutes,
} from './time'
import {
  dayWorkload,
  findAvailableSlot,
  policyForStudent,
} from './workload'
import { detectConflicts } from './conflicts'
import { previewScheduleChanges } from './changes'
import { validateRecoverySchedule } from './schemas'

const CHOICE_ORDER: readonly RecoveryChoice[] = [
  'move-to-tomorrow',
  'shorten-today',
  'split-sessions',
  'move-to-catch-up-block',
  'replace-lower-priority-review',
  'keep-due-date-rebalance-week',
  'parent-manual',
  'leave-unchanged',
]

function hash(seed: string): string {
  let value = 2_166_136_261
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index)
    value = Math.imul(value, 16_777_619)
  }
  return (value >>> 0).toString(36)
}

function stableId(prefix: string, seed: string): string {
  return `${prefix}-${hash(seed)}`
}

function roundedCurrentTime(time: string, stepMinutes = 5): string {
  const minutes = timeToMinutes(time)
  return minutesToTime(
    Math.min(1440, Math.ceil(minutes / stepMinutes) * stepMinutes),
  )
}

function laterDate(left: ISODate, right: ISODate): ISODate {
  return left > right ? left : right
}

function reasonCodeForTrigger(
  kind: GenerateRecoveryProposalInput['trigger']['kind'],
): EventChange['reasonCode'] {
  switch (kind) {
    case 'missed':
      return 'recovered-missed-work'
    case 'interrupted':
      return 'recovered-interrupted-work'
    case 'shortened':
      return 'recovered-shortened-work'
    case 'overdue':
      return 'recovered-overdue-work'
    case 'focus-difficulty':
      return 'support-focus-stamina'
  }
}

function remainingForTrigger(
  event: ScheduleEvent,
  workItem: WorkItem | undefined,
  input: GenerateRecoveryProposalInput,
): number {
  if (
    input.trigger.remainingMinutes !== undefined &&
    Number.isFinite(input.trigger.remainingMinutes) &&
    input.trigger.remainingMinutes > 0
  ) {
    return Math.max(1, Math.round(input.trigger.remainingMinutes))
  }
  if (
    input.trigger.actualMinutes !== undefined &&
    Number.isFinite(input.trigger.actualMinutes) &&
    input.trigger.actualMinutes >= 0 &&
    (input.trigger.kind === 'interrupted' ||
      input.trigger.kind === 'shortened' ||
      input.trigger.kind === 'focus-difficulty')
  ) {
    return Math.max(
      1,
      event.durationMinutes - Math.round(input.trigger.actualMinutes),
    )
  }
  return Math.max(
    1,
    workItem ? remainingWorkMinutes(workItem) : event.durationMinutes,
  )
}

function recoverySource(
  event: ScheduleEvent,
  originDate: ISODate,
  proposalId: string,
): ScheduleEvent['source'] {
  return {
    ...event.source,
    adapterData: {
      ...(event.source.adapterData ?? {}),
      recoveryOriginDate: originDate,
      recoveryProposalId: proposalId,
    },
  }
}

function changedEvent(
  event: ScheduleEvent,
  proposalId: string,
  at: string,
  patch: Partial<ScheduleEvent>,
): ScheduleEvent {
  return {
    ...event,
    ...patch,
    source: recoverySource(event, event.start.date, proposalId),
    updatedAt: at,
  }
}

interface OptionDraft {
  choice: RecoveryChoice
  availability: RecoveryOption['availability']
  why: string
  tradeoff: RecoveryTradeoff
  studentExplanation: string
  changes: ScheduleChange[]
}

function unavailableDraft(
  choice: RecoveryChoice,
  why: string,
  tradeoff: RecoveryTradeoff,
  studentExplanation: string,
): OptionDraft {
  return {
    choice,
    availability: 'unavailable',
    why,
    tradeoff,
    studentExplanation,
    changes: [],
  }
}

function affectedDates(
  original: ScheduleEvent,
  changes: readonly ScheduleChange[],
): ISODate[] {
  const dates = new Set<ISODate>([original.start.date])
  for (const change of changes) {
    if (change.kind !== 'event') continue
    if (change.before) dates.add(change.before.start.date)
    if (change.after) dates.add(change.after.start.date)
  }
  return [...dates].sort()
}

function optionFromDraft(
  proposalId: string,
  schedule: RecoverySchedule,
  event: ScheduleEvent,
  now: string,
  draft: OptionDraft,
): RecoveryOption {
  const id = `${proposalId}:${draft.choice}`
  if (
    draft.availability === 'unavailable' ||
    draft.choice === 'parent-manual'
  ) {
    const dates = affectedDates(event, draft.changes)
    return {
      id,
      choice: draft.choice,
      label: RECOVERY_CHOICE_LABELS[draft.choice],
      availability: draft.availability,
      why: draft.why,
      tradeoff: draft.tradeoff,
      changes: draft.changes,
      conflicts: detectConflicts(schedule, {
        studentId: event.studentId,
        dates,
      }),
      dueDateRisks: dueDateRisks(schedule, now, event.studentId),
      workload: dates.map((date) =>
        dayWorkload(schedule, event.studentId, date),
      ),
      preservesInvariants: draft.availability !== 'unavailable',
      studentExplanation: draft.studentExplanation,
    }
  }

  if (draft.choice === 'leave-unchanged') {
    return {
      id,
      choice: draft.choice,
      label: RECOVERY_CHOICE_LABELS[draft.choice],
      availability: 'available',
      why: draft.why,
      tradeoff: draft.tradeoff,
      changes: [],
      conflicts: detectConflicts(schedule, {
        studentId: event.studentId,
        dates: [event.start.date],
      }),
      dueDateRisks: dueDateRisks(schedule, now, event.studentId),
      workload: [dayWorkload(schedule, event.studentId, event.start.date)],
      preservesInvariants: true,
      studentExplanation: draft.studentExplanation,
    }
  }

  const preview = previewScheduleChanges(schedule, draft.changes, now)
  if (!preview.ok) {
    return {
      id,
      choice: draft.choice,
      label: RECOVERY_CHOICE_LABELS[draft.choice],
      availability: 'unavailable',
      why: `${draft.why} It cannot be applied safely: ${preview.errors
        .map((error) => error.message)
        .join(' ')}`,
      tradeoff: draft.tradeoff,
      changes: draft.changes,
      conflicts: [],
      dueDateRisks: dueDateRisks(schedule, now, event.studentId),
      workload: affectedDates(event, draft.changes).map((date) =>
        dayWorkload(schedule, event.studentId, date),
      ),
      preservesInvariants: false,
      studentExplanation:
        'That choice does not fit safely right now, so nothing would change.',
    }
  }

  const after = preview.value
  const dates = affectedDates(event, draft.changes)
  return {
    id,
    choice: draft.choice,
    label: RECOVERY_CHOICE_LABELS[draft.choice],
    availability: draft.availability,
    why: draft.why,
    tradeoff: draft.tradeoff,
    changes: draft.changes,
    conflicts: detectConflicts(after, {
      studentId: event.studentId,
      dates,
    }),
    dueDateRisks: dueDateRisks(after, now, event.studentId),
    workload: dates.map((date) =>
      dayWorkload(after, event.studentId, date),
    ),
    preservesInvariants: true,
    studentExplanation: draft.studentExplanation,
  }
}

function movedEventChange(
  event: ScheduleEvent,
  after: ScheduleEvent,
  reasonCode: EventChange['reasonCode'],
): EventChange {
  return {
    kind: 'event',
    eventId: event.id,
    before: event,
    after,
    reasonCode,
  }
}

function tomorrowDraft(
  schedule: RecoverySchedule,
  event: ScheduleEvent,
  workItem: WorkItem | undefined,
  remainingMinutes: number,
  proposalId: string,
  now: string,
  reasonCode: EventChange['reasonCode'],
): OptionDraft {
  const choice: RecoveryChoice = 'move-to-tomorrow'
  if (!eventCanMove(event)) {
    return unavailableDraft(
      choice,
      `${event.title} is fixed, protected, or parent locked.`,
      {
        gained: 'The original time remains protected.',
        cost: 'The missed or interrupted work still needs a parent decision.',
      },
      'This item is staying where it is because its time is protected.',
    )
  }
  const nowLocal = instantToLocalDateTime(now, schedule.timeZone)
  const tomorrow = laterDate(
    addCalendarDays(event.start.date, 1),
    addCalendarDays(nowLocal.date, 1),
  )
  const duration = Math.max(
    workItem?.minimumSessionMinutes ?? 1,
    Math.min(remainingMinutes, event.durationMinutes),
  )
  const slot = findAvailableSlot({
    schedule,
    studentId: event.studentId,
    dates: [tomorrow],
    durationMinutes: duration,
    loadCategory: event.loadCategory,
    excludeEventIds: [event.id],
  })
  if (!slot) {
    return unavailableDraft(
      choice,
      `Tomorrow has no complete ${duration}-minute slot inside this student’s workload limits and protected time.`,
      {
        gained: 'Tomorrow is not silently overloaded.',
        cost: 'Another recovery choice is needed.',
      },
      'Tomorrow is already too full for this work, so we did not add it.',
    )
  }
  const after = changedEvent(event, proposalId, now, {
    start: { date: slot.date, time: slot.startTime },
    durationMinutes: duration,
    status: 'scheduled',
  })
  return {
    choice,
    availability: 'requires-parent',
    why: `${event.title} moves to ${slot.date} at ${slot.startTime}; tomorrow remains within this student’s limits.`,
    tradeoff: {
      gained: 'Today becomes lighter without changing protected time.',
      cost: `Tomorrow gains ${duration} minutes of carryover work.`,
    },
    changes: [movedEventChange(event, after, reasonCode)],
    studentExplanation: `We can move ${event.title} to tomorrow at ${slot.startTime} so today can settle down.`,
  }
}

function shortenDraft(
  schedule: RecoverySchedule,
  event: ScheduleEvent,
  workItem: WorkItem | undefined,
  remainingMinutes: number,
  proposalId: string,
  now: string,
  reasonCode: EventChange['reasonCode'],
): OptionDraft {
  const choice: RecoveryChoice = 'shorten-today'
  if (!eventCanResize(event, workItem) || !workItem?.canShorten) {
    return unavailableDraft(
      choice,
      `${event.title} is not eligible for automatic shortening.`,
      {
        gained: 'The original requirement remains intact.',
        cost: 'Today is not shortened by this choice.',
      },
      'This work should not be shortened automatically.',
    )
  }
  const policy = policyForStudent(schedule, event.studentId)
  if (!policy) {
    return unavailableDraft(
      choice,
      'The student workload policy is missing.',
      {
        gained: 'No unsupported estimate is used.',
        cost: 'A parent needs to choose the duration.',
      },
      'A parent needs to choose a comfortable amount.',
    )
  }
  const duration = Math.min(
    event.durationMinutes - 1,
    remainingMinutes,
    recommendedFocusBlockMinutes(policy, workItem, remainingMinutes),
  )
  if (duration < workItem.minimumSessionMinutes) {
    return unavailableDraft(
      choice,
      `The safe shortened block would be below the ${workItem.minimumSessionMinutes}-minute minimum.`,
      {
        gained: 'The minimum useful session is preserved.',
        cost: 'A different supportive adjustment is needed.',
      },
      'This block cannot get shorter and still be useful.',
    )
  }
  const nowLocal = instantToLocalDateTime(now, schedule.timeZone)
  const currentFloor = {
    date: nowLocal.date,
    time: roundedCurrentTime(nowLocal.time),
  }
  let start = event.start
  if (
    event.start.date !== nowLocal.date ||
    compareLocalDateTime(event.start, currentFloor) < 0
  ) {
    const slot = findAvailableSlot({
      schedule,
      studentId: event.studentId,
      dates: [nowLocal.date],
      durationMinutes: duration,
      loadCategory: event.loadCategory,
      excludeEventIds: [event.id],
      earliestTime: currentFloor.time,
    })
    if (!slot) {
      return unavailableDraft(
        choice,
        `No future ${duration}-minute slot remains today inside protected time and workload limits.`,
        {
          gained: 'No recovery block is placed in the past.',
          cost: 'Another recovery choice is needed.',
        },
        'There is not enough safe time left today for a shorter block.',
      )
    }
    start = { date: slot.date, time: slot.startTime }
  }
  const after = changedEvent(event, proposalId, now, {
    start,
    durationMinutes: duration,
    status: 'scheduled',
  })
  return {
    choice,
    availability: 'requires-parent',
    why: `Today’s block becomes ${duration} minutes. The work item remains active, so ${Math.max(
      0,
      remainingMinutes - duration,
    )} minutes are still visible for later planning.`,
    tradeoff: {
      gained: 'The continuous focus demand is reduced today.',
      cost: 'Any unscheduled remainder may increase due-date risk.',
    },
    changes: [movedEventChange(event, after, reasonCode)],
    studentExplanation: `We can make today’s ${event.title} block ${duration} minutes. The rest is not erased; it stays on the plan for a parent to place.`,
  }
}

function splitDurations(
  total: number,
  preferred: number,
  minimum: number,
): number[] {
  if (total < minimum * 2) return []
  const count = Math.max(2, Math.ceil(total / preferred))
  const base = Math.floor(total / count)
  const remainder = total % count
  const values = Array.from(
    { length: count },
    (_, index) => base + (index < remainder ? 1 : 0),
  )
  if (values.some((value) => value < minimum)) {
    const maxCount = Math.floor(total / minimum)
    if (maxCount < 2) return []
    const adjustedBase = Math.floor(total / maxCount)
    const adjustedRemainder = total % maxCount
    return Array.from(
      { length: maxCount },
      (_, index) =>
        adjustedBase + (index < adjustedRemainder ? 1 : 0),
    )
  }
  return values
}

function splitDraft(
  schedule: RecoverySchedule,
  event: ScheduleEvent,
  workItem: WorkItem | undefined,
  remainingMinutes: number,
  proposalId: string,
  now: string,
  reasonCode: EventChange['reasonCode'],
): OptionDraft {
  const choice: RecoveryChoice = 'split-sessions'
  const policy = policyForStudent(schedule, event.studentId)
  if (!eventCanMove(event) || !workItem?.canSplit || !policy) {
    return unavailableDraft(
      choice,
      `${event.title} is fixed, locked, or not marked as splittable.`,
      {
        gained: 'The original block remains unchanged.',
        cost: 'The work cannot be distributed automatically.',
      },
      'This item cannot be split automatically.',
    )
  }
  const preferred = recommendedFocusBlockMinutes(
    policy,
    workItem,
    remainingMinutes,
  )
  const durations = splitDurations(
    remainingMinutes,
    preferred,
    Math.max(workItem.minimumSessionMinutes, policy.minimumFocusBlockMinutes),
  )
  if (durations.length < 2) {
    return unavailableDraft(
      choice,
      'There is not enough remaining work for two useful sessions.',
      {
        gained: 'Tiny, unhelpful fragments are avoided.',
        cost: 'Another recovery choice is needed.',
      },
      'There is not enough left to make two useful sessions.',
    )
  }

  const nowLocal = instantToLocalDateTime(now, schedule.timeZone)
  const startDate =
    nowLocal.date > event.start.date ? nowLocal.date : event.start.date
  const deadlineDate = workItem.deadline?.due.date
  const lastDate =
    deadlineDate && deadlineDate < schedule.range.end
      ? deadlineDate
      : schedule.range.end
  const candidateDates = datesBetween(
    startDate,
    [addCalendarDays(startDate, 13), lastDate].sort()[0],
  )
  let scratch: RecoverySchedule = {
    ...schedule,
    events: schedule.events.filter((candidate) => candidate.id !== event.id),
  }
  const segments: ScheduleEvent[] = []
  let dateCursor = 0
  for (const [index, duration] of durations.entries()) {
    let placed:
      | ReturnType<typeof findAvailableSlot>
      | undefined
    let placedDateIndex = -1
    for (
      let candidateIndex = dateCursor;
      candidateIndex < candidateDates.length;
      candidateIndex += 1
    ) {
      placed = findAvailableSlot({
        schedule: scratch,
        studentId: event.studentId,
        dates: [candidateDates[candidateIndex]],
        durationMinutes: duration,
        loadCategory: event.loadCategory,
        ...(candidateDates[candidateIndex] === nowLocal.date
          ? { earliestTime: roundedCurrentTime(nowLocal.time) }
          : {}),
      })
      if (placed) {
        placedDateIndex = candidateIndex
        break
      }
    }
    if (!placed || placedDateIndex < 0) {
      return unavailableDraft(
        choice,
        'All useful session pieces do not fit before the due date without conflict or overload.',
        {
          gained: 'No day is silently overloaded.',
          cost: 'The split cannot be proposed automatically.',
        },
        'The pieces do not all fit safely yet, so we did not split the work.',
      )
    }
    dateCursor = placedDateIndex + 1
    const segment: ScheduleEvent = changedEvent(event, proposalId, now, {
      id:
        index === 0
          ? event.id
          : stableId(
              'recovery-segment',
              `${proposalId}:${event.id}:${index}`,
            ),
      start: { date: placed.date, time: placed.startTime },
      durationMinutes: duration,
      status: 'scheduled',
      segmentIndex: index,
      createdAt: index === 0 ? event.createdAt : now,
    })
    segments.push(segment)
    scratch = { ...scratch, events: [...scratch.events, segment] }
  }

  const changes: EventChange[] = segments.map((segment, index) => ({
    kind: 'event',
    eventId: segment.id,
    before: index === 0 ? event : null,
    after: segment,
    reasonCode,
  }))
  return {
    choice,
    availability: 'requires-parent',
    why: `${remainingMinutes} minutes become ${segments
      .map((segment) => `${segment.durationMinutes} minutes on ${segment.start.date}`)
      .join(', ')}. Each day stays inside its limits.`,
    tradeoff: {
      gained: 'Each focus block is smaller and recovery time falls between sessions.',
      cost: `The work spans ${segments.length} days instead of one block.`,
    },
    changes,
    studentExplanation: `${event.title} can become ${segments.length} smaller sessions. Nothing extra was added; the same remaining work is spread out.`,
  }
}

function catchUpDraft(
  schedule: RecoverySchedule,
  event: ScheduleEvent,
  workItem: WorkItem | undefined,
  remainingMinutes: number,
  proposalId: string,
  now: string,
  reasonCode: EventChange['reasonCode'],
): OptionDraft {
  const choice: RecoveryChoice = 'move-to-catch-up-block'
  if (!eventCanMove(event)) {
    return unavailableDraft(
      choice,
      `${event.title} cannot move because it is fixed, protected, or parent locked.`,
      {
        gained: 'The protected event stays unchanged.',
        cost: 'Catch-up capacity cannot be used for this item.',
      },
      'This item cannot move into catch-up time.',
    )
  }
  const duration = Math.max(
    workItem?.minimumSessionMinutes ?? 1,
    Math.min(remainingMinutes, event.durationMinutes),
  )
  const nowLocal = instantToLocalDateTime(now, schedule.timeZone)
  const earliestDate = laterDate(event.start.date, nowLocal.date)
  const todayFloor = roundedCurrentTime(nowLocal.time)
  const blocks = schedule.catchUpBlocks
    .filter(
      (block) =>
        block.studentId === event.studentId &&
        block.date >= earliestDate &&
        (block.date !== nowLocal.date ||
          timeToMinutes(block.endTime) > timeToMinutes(todayFloor)),
    )
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.startTime.localeCompare(right.startTime),
    )
  const slot = findAvailableSlot({
    schedule,
    studentId: event.studentId,
    dates: [...new Set(blocks.map((block) => block.date))],
    durationMinutes: duration,
    loadCategory: event.loadCategory,
    excludeEventIds: [event.id],
    windows: blocks.map((block) => ({
      date: block.date,
      startTime:
        block.date === nowLocal.date &&
        timeToMinutes(block.startTime) < timeToMinutes(todayFloor)
          ? todayFloor
          : block.startTime,
      endTime: block.endTime,
    })),
  })
  if (!slot) {
    return unavailableDraft(
      choice,
      'No configured catch-up block has enough unused capacity within workload limits.',
      {
        gained: 'Catch-up blocks are not overfilled.',
        cost: 'A different recovery choice is needed.',
      },
      'The catch-up blocks are full or too short, so nothing was squeezed in.',
    )
  }
  const after = changedEvent(event, proposalId, now, {
    start: { date: slot.date, time: slot.startTime },
    durationMinutes: duration,
    status: 'scheduled',
  })
  return {
    choice,
    availability: 'requires-parent',
    why: `${event.title} fits inside the catch-up block on ${slot.date} at ${slot.startTime}.`,
    tradeoff: {
      gained: 'Purpose-built recovery capacity absorbs the work.',
      cost: `${duration} minutes of catch-up capacity are used.`,
    },
    changes: [movedEventChange(event, after, 'use-catch-up-capacity')],
    studentExplanation: `We can put ${event.title} into catch-up time on ${slot.date}.`,
  }
}

function replacementDraft(
  schedule: RecoverySchedule,
  event: ScheduleEvent,
  workItem: WorkItem | undefined,
  remainingMinutes: number,
  proposalId: string,
  now: string,
  reasonCode: EventChange['reasonCode'],
): OptionDraft {
  const choice: RecoveryChoice = 'replace-lower-priority-review'
  if (!eventCanMove(event) || !workItem) {
    return unavailableDraft(
      choice,
      'The affected event cannot replace another block.',
      {
        gained: 'No protected or fixed event is displaced.',
        cost: 'A review slot is not available through this choice.',
      },
      'This item cannot take another block’s place automatically.',
    )
  }
  const targetPriority = effectivePriorityScore(schedule, workItem, now)
  const nowLocal = instantToLocalDateTime(now, schedule.timeZone)
  const currentFloor = {
    date: nowLocal.date,
    time: roundedCurrentTime(nowLocal.time),
  }
  const candidates = schedule.events
    .flatMap((candidate) => {
      if (
        candidate.id === event.id ||
        candidate.studentId !== event.studentId ||
        compareLocalDateTime(candidate.start, currentFloor) < 0 ||
        candidate.start.date < event.start.date ||
        !eventCanMove(candidate) ||
        candidate.durationMinutes <
          Math.min(remainingMinutes, event.durationMinutes) ||
        !candidate.workItemId
      ) {
        return []
      }
      const candidateWork = schedule.workItems.find(
        (item) => item.id === candidate.workItemId,
      )
      if (
        !candidateWork ||
        candidateWork.requirement === 'required' ||
        candidateWork.requirement === workItem.requirement ||
        effectivePriorityScore(schedule, candidateWork, now) >= targetPriority
      ) {
        return []
      }
      return [{ event: candidate, work: candidateWork }]
    })
    .sort((left, right) =>
      compareWorkPriority(schedule, right.work, left.work, now),
    )
  const replacement = candidates[0]
  if (!replacement) {
    return unavailableDraft(
      choice,
      'No movable, lower-priority review block is large enough to replace.',
      {
        gained: 'Required work and equal-or-higher priorities remain untouched.',
        cost: 'Another recovery choice is needed.',
      },
      'There is no lower-priority review block to trade.',
    )
  }
  const duration = Math.min(remainingMinutes, event.durationMinutes)
  const afterTarget = changedEvent(event, proposalId, now, {
    start: replacement.event.start,
    durationMinutes: duration,
    status: 'scheduled',
  })
  const afterReview: ScheduleEvent = {
    ...replacement.event,
    status: 'deferred',
    source: recoverySource(
      replacement.event,
      replacement.event.start.date,
      proposalId,
    ),
    updatedAt: now,
  }
  return {
    choice,
    availability: 'requires-parent',
    why: `${event.title} takes the ${replacement.event.start.time} slot on ${replacement.event.start.date}; ${replacement.event.title} is marked deferred, not deleted.`,
    tradeoff: {
      gained: 'Higher-priority work gets a safe slot without adding daily load.',
      cost: `${replacement.event.title} must be reconsidered later.`,
    },
    changes: [
      movedEventChange(event, afterTarget, reasonCode),
      {
        kind: 'event',
        eventId: replacement.event.id,
        before: replacement.event,
        after: afterReview,
        reasonCode: 'defer-lower-priority-review',
      },
    ],
    studentExplanation: `We can use a lower-priority review time for ${event.title}. The review is deferred, not erased.`,
  }
}

function rebalanceDraft(
  schedule: RecoverySchedule,
  event: ScheduleEvent,
  workItem: WorkItem | undefined,
  remainingMinutes: number,
  proposalId: string,
  now: string,
  reasonCode: EventChange['reasonCode'],
): OptionDraft {
  const choice: RecoveryChoice = 'keep-due-date-rebalance-week'
  if (!eventCanMove(event)) {
    return unavailableDraft(
      choice,
      `${event.title} cannot move during weekly balancing.`,
      {
        gained: 'Fixed and parent-locked placement stays intact.',
        cost: 'Automatic weekly balancing cannot place this item.',
      },
      'This item is fixed, so the week cannot move it automatically.',
    )
  }
  const nowLocal = instantToLocalDateTime(now, schedule.timeZone)
  const weekStart = mondayOf(
    nowLocal.date > event.start.date ? nowLocal.date : event.start.date,
  )
  const weekEnd = addCalendarDays(weekStart, 6)
  const deadlineEnd = workItem?.deadline?.due.date
  const finalDate =
    deadlineEnd && deadlineEnd < weekEnd ? deadlineEnd : weekEnd
  const firstDate =
    laterDate(
      nowLocal.date > weekStart ? nowLocal.date : weekStart,
      event.start.date,
    )
  const candidateDates = datesBetween(firstDate, finalDate).sort(
    (left, right) => {
      const leftLoad = dayWorkload(
        schedule,
        event.studentId,
        left,
        [event.id],
      )
      const rightLoad = dayWorkload(
        schedule,
        event.studentId,
        right,
        [event.id],
      )
      return (
        leftLoad.academicMinutes - rightLoad.academicMinutes ||
        left.localeCompare(right)
      )
    },
  )
  const duration = Math.max(
    workItem?.minimumSessionMinutes ?? 1,
    Math.min(remainingMinutes, event.durationMinutes),
  )
  let slot:
    | ReturnType<typeof findAvailableSlot>
    | undefined
  for (const date of candidateDates) {
    slot = findAvailableSlot({
      schedule,
      studentId: event.studentId,
      dates: [date],
      durationMinutes: duration,
      loadCategory: event.loadCategory,
      excludeEventIds: [event.id],
      ...(date === nowLocal.date
        ? { earliestTime: roundedCurrentTime(nowLocal.time) }
        : {}),
    })
    if (slot) break
  }
  if (!slot) {
    return unavailableDraft(
      choice,
      'The current week has no complete slot before the due date without overload.',
      {
        gained: 'The due date, protected time, and workload limits stay visible.',
        cost: 'A parent needs to choose a cross-week or scope adjustment.',
      },
      'The week is too full to rebalance this safely.',
    )
  }
  const after = changedEvent(event, proposalId, now, {
    start: { date: slot.date, time: slot.startTime },
    durationMinutes: duration,
    status: 'scheduled',
  })
  return {
    choice,
    availability: 'requires-parent',
    why: `${event.title} moves to the lightest safe day (${slot.date} at ${slot.startTime}) while its configured due date remains unchanged.`,
    tradeoff: {
      gained: 'Academic demand is distributed more evenly across the week.',
      cost: `The plan changes on ${event.start.date} and ${slot.date}.`,
    },
    changes: [movedEventChange(event, after, reasonCode)],
    studentExplanation: `We can move ${event.title} to a lighter part of this week and keep the same due date.`,
  }
}

function manualDraft(event: ScheduleEvent): OptionDraft {
  return {
    choice: 'parent-manual',
    availability: 'requires-parent',
    why: `A parent can build a custom change for ${event.title}. The same fixed, protected, required-work, conflict, and workload safeguards still apply.`,
    tradeoff: {
      gained: 'The parent controls the exact placement and tradeoff.',
      cost: 'No automatic change is prepared.',
    },
    changes: [],
    studentExplanation: 'A parent can choose a different plan. Nothing changes until they approve it.',
  }
}

function unchangedDraft(event: ScheduleEvent): OptionDraft {
  return {
    choice: 'leave-unchanged',
    availability: 'available',
    why: `${event.title} remains exactly where it is. Existing due-date risk and workload warnings stay visible.`,
    tradeoff: {
      gained: 'No schedule rows change.',
      cost: 'The missed, interrupted, shortened, or overdue work may remain unresolved.',
    },
    changes: [],
    studentExplanation: 'We can leave the schedule as it is. Nothing will move or disappear.',
  }
}

function preferredChoices(
  trigger: GenerateRecoveryProposalInput['trigger']['kind'],
): RecoveryChoice[] {
  if (trigger === 'focus-difficulty') {
    return [
      'split-sessions',
      'shorten-today',
      'move-to-catch-up-block',
      'keep-due-date-rebalance-week',
      'move-to-tomorrow',
      'replace-lower-priority-review',
      'leave-unchanged',
    ]
  }
  if (trigger === 'overdue') {
    return [
      'move-to-catch-up-block',
      'keep-due-date-rebalance-week',
      'replace-lower-priority-review',
      'split-sessions',
      'move-to-tomorrow',
      'shorten-today',
      'leave-unchanged',
    ]
  }
  return [
    'move-to-catch-up-block',
    'split-sessions',
    'move-to-tomorrow',
    'keep-due-date-rebalance-week',
    'shorten-today',
    'replace-lower-priority-review',
    'leave-unchanged',
  ]
}

export function generateRecoveryProposal(
  input: GenerateRecoveryProposalInput,
): RecoveryProposal {
  const scheduleValidation = validateRecoverySchedule(input.schedule)
  if (!scheduleValidation.valid) {
    throw new TypeError(
      `Invalid recovery schedule: ${scheduleValidation.issues
        .map((validationIssue) => `${validationIssue.path} ${validationIssue.message}`)
        .join('; ')}`,
    )
  }
  const event = input.schedule.events.find(
    (candidate) => candidate.id === input.trigger.eventId,
  )
  if (!event) {
    throw new RangeError(`Recovery event ${input.trigger.eventId} was not found.`)
  }
  const student = input.schedule.students.find(
    (candidate) => candidate.id === event.studentId,
  )
  if (!student) {
    throw new RangeError(`Recovery student ${event.studentId} was not found.`)
  }
  const workItem = event.workItemId
    ? input.schedule.workItems.find((item) => item.id === event.workItemId)
    : undefined
  const now = input.now ?? input.trigger.observedAt
  const proposalId =
    input.proposalId ??
    stableId(
      'recovery',
      `${input.schedule.householdId}:${input.schedule.revision}:${event.id}:${input.trigger.kind}:${input.trigger.observedAt}`,
    )
  const remainingMinutes = remainingForTrigger(event, workItem, input)
  const reasonCode = reasonCodeForTrigger(input.trigger.kind)
  const drafts: OptionDraft[] = [
    tomorrowDraft(
      input.schedule,
      event,
      workItem,
      remainingMinutes,
      proposalId,
      now,
      reasonCode,
    ),
    shortenDraft(
      input.schedule,
      event,
      workItem,
      remainingMinutes,
      proposalId,
      now,
      reasonCode,
    ),
    splitDraft(
      input.schedule,
      event,
      workItem,
      remainingMinutes,
      proposalId,
      now,
      reasonCode,
    ),
    catchUpDraft(
      input.schedule,
      event,
      workItem,
      remainingMinutes,
      proposalId,
      now,
      reasonCode,
    ),
    replacementDraft(
      input.schedule,
      event,
      workItem,
      remainingMinutes,
      proposalId,
      now,
      reasonCode,
    ),
    rebalanceDraft(
      input.schedule,
      event,
      workItem,
      remainingMinutes,
      proposalId,
      now,
      reasonCode,
    ),
    manualDraft(event),
    unchangedDraft(event),
  ]
  const byChoice = new Map(drafts.map((draft) => [draft.choice, draft]))
  const options = CHOICE_ORDER.map((choice) =>
    optionFromDraft(
      proposalId,
      input.schedule,
      event,
      now,
      byChoice.get(choice) ??
        unavailableDraft(
          choice,
          'This option was not generated.',
          {
            gained: 'No unsafe change occurs.',
            cost: 'A different option is needed.',
          },
          'Nothing changes.',
        ),
    ),
  )
  const recommended =
    preferredChoices(input.trigger.kind)
      .map((choice) => options.find((option) => option.choice === choice))
      .find(
        (option) =>
          option !== undefined &&
          option.availability !== 'unavailable' &&
          option.preservesInvariants,
      ) ?? options.find((option) => option.choice === 'leave-unchanged')!

  return {
    id: proposalId,
    scheduleRevision: input.schedule.revision,
    studentId: event.studentId,
    trigger: input.trigger,
    ...(workItem ? { affectedWorkItemId: workItem.id } : {}),
    createdAt: now,
    status: 'pending-parent',
    recommendedOptionId: recommended.id,
    options,
    summary: `${student.displayName}: ${remainingMinutes} minutes of ${event.title} need a recovery decision after ${input.trigger.kind.replaceAll('-', ' ')}. No change is applied without parent approval.`,
  }
}

export function explainProposalForStudent(
  proposal: RecoveryProposal,
  optionId = proposal.recommendedOptionId,
): string {
  const option = proposal.options.find((candidate) => candidate.id === optionId)
  return (
    option?.studentExplanation ??
    'A parent is reviewing the schedule. Nothing has changed yet.'
  )
}

export function proposalWorkload(
  proposal: RecoveryProposal,
  choice: RecoveryChoice,
): DayWorkloadSummary[] {
  return (
    proposal.options.find((option) => option.choice === choice)?.workload ?? []
  )
}
