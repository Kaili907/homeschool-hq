import { RECOVERY_CHOICES, recoveryChoiceMetadata } from './presentation'
import type {
  DemoRecoveryAction,
  RecoveryChoice,
  RecoveryOptionView,
  RecoveryProposalView,
  ScheduleRecoveryViewModel,
} from './types'

const BASE_TIMESTAMP = '2026-07-28T13:35:00-04:00'

function optionsFor(
  summaries: Partial<Record<RecoveryChoice, string>>,
  tradeoffs: Partial<Record<RecoveryChoice, string>>,
  unavailable: Partial<Record<RecoveryChoice, string>> = {},
): RecoveryOptionView[] {
  return RECOVERY_CHOICES.map(({ id, description }) => ({
    choice: id,
    summary: summaries[id] ?? description,
    tradeoff: tradeoffs[id] ?? 'No additional tradeoff recorded.',
    permitted: unavailable[id] === undefined,
    unavailableReason: unavailable[id],
    parentApprovalRequired:
      id === 'shorten-today' ||
      id === 'replace-lower-priority-review' ||
      id === 'parent-manual',
    workloadDeltaMinutes:
      id === 'move-to-tomorrow'
        ? { today: -30, tomorrow: 30, week: 0 }
        : id === 'shorten-today'
          ? { today: -20, tomorrow: 0, week: -20 }
          : id === 'split-sessions'
            ? { today: -25, tomorrow: 25, week: 0 }
            : id === 'move-to-catch-up-block'
              ? { today: -30, tomorrow: 0, week: 0 }
              : id === 'replace-lower-priority-review'
                ? { today: 0, tomorrow: 0, week: 0 }
                : id === 'keep-due-date-rebalance-week'
                  ? { today: -30, tomorrow: 10, week: 0 }
                  : { today: 0, tomorrow: 0, week: 0 },
  }))
}

const averyProposal: RecoveryProposalView = {
  id: 'proposal-avery-algebra',
  studentId: 'student-avery',
  status: 'pending',
  trigger: 'interrupted',
  title: 'Finish the algebra practice in two smaller sessions',
  sourceLabel: 'Manuel Academy · Algebra',
  createdAt: BASE_TIMESTAMP,
  dueAt: '2026-07-29T16:00:00-04:00',
  priorityLabel: 'Required · due tomorrow',
  reason:
    'The first session ended early. Two shorter sessions fit Avery’s current focus block size and keep tomorrow under its workload limit.',
  tradeoff:
    'A 25-minute reading review moves to Thursday; the required algebra practice and its due date stay intact.',
  requiredWorkPreserved: true,
  recommendedChoice: 'split-sessions',
  options: optionsFor(
    {
      'split-sessions':
        'Use 20 minutes today and 25 minutes tomorrow, with a recovery break before each block.',
      'move-to-tomorrow':
        'Move all 45 remaining minutes to Wednesday afternoon.',
      'shorten-today':
        'Complete only the essential 25-minute problem set today.',
      'move-to-catch-up-block':
        'Use Friday’s open catch-up block for the remaining work.',
      'replace-lower-priority-review':
        'Use Wednesday’s movable reading review block for algebra.',
      'keep-due-date-rebalance-week':
        'Keep Wednesday’s due date and spread movable reviews across the week.',
      'parent-manual':
        'Pick the exact date, start time, and duration.',
      'leave-unchanged':
        'Keep the unfinished 45-minute block in its original place.',
    },
    {
      'split-sessions': 'Reading review moves one day; no required work is removed.',
      'move-to-tomorrow': 'Wednesday would reach its workload limit with less flexibility.',
      'shorten-today': 'Twenty minutes of required work would still need a parent-approved plan.',
      'move-to-catch-up-block': 'Completion would happen after the current due date.',
      'replace-lower-priority-review': 'A lower-priority review moves to Thursday.',
      'keep-due-date-rebalance-week': 'Three review blocks change across the week.',
      'parent-manual': 'The parent takes responsibility for checking conflicts and load.',
      'leave-unchanged': 'The calendar will continue to show unfinished work and due-date risk.',
    },
    {
      'move-to-catch-up-block':
        'Friday is after the due date. Change the due date first or choose another option.',
    },
  ),
  changes: [
    {
      id: 'change-avery-algebra',
      title: 'Algebra practice: linear equations',
      category: 'manuel-academy-lesson',
      kind: 'split',
      before: [
        {
          date: '2026-07-28',
          startTime: '10:15',
          durationMinutes: 45,
          label: 'Remaining work',
        },
      ],
      after: [
        {
          date: '2026-07-28',
          startTime: '14:10',
          durationMinutes: 20,
          label: 'Session 1 of 2',
        },
        {
          date: '2026-07-29',
          startTime: '10:35',
          durationMinutes: 25,
          label: 'Session 2 of 2',
        },
      ],
      isRequiredWork: true,
      isFixedOrLocked: false,
    },
    {
      id: 'change-avery-reading-review',
      title: 'Reading recall review',
      category: 'adaptive-tutor-intervention',
      kind: 'moved',
      before: [
        {
          date: '2026-07-29',
          startTime: '10:35',
          durationMinutes: 25,
        },
      ],
      after: [
        {
          date: '2026-07-30',
          startTime: '10:35',
          durationMinutes: 25,
        },
      ],
      isRequiredWork: false,
      isFixedOrLocked: false,
    },
  ],
  workloadPreview: [
    {
      date: '2026-07-28',
      beforeMinutes: 205,
      proposedMinutes: 180,
      limitMinutes: 210,
      protectedMinutes: 75,
    },
    {
      date: '2026-07-29',
      beforeMinutes: 190,
      proposedMinutes: 190,
      limitMinutes: 210,
      protectedMinutes: 90,
      overloadPrevented: true,
    },
    {
      date: '2026-07-30',
      beforeMinutes: 155,
      proposedMinutes: 180,
      limitMinutes: 210,
      protectedMinutes: 75,
    },
  ],
  conflictIds: ['conflict-avery-dentist'],
  riskIds: ['risk-avery-algebra'],
  studentExplanation: {
    headline: 'Your algebra is now two smaller steps',
    changed:
      'You have a 20-minute algebra block this afternoon and a 25-minute block tomorrow morning.',
    why:
      'The first block was interrupted, so the plan made the remaining work easier to restart.',
    tradeoff:
      'Your short reading review moves to Thursday. The algebra due date does not change.',
    reassurance:
      'Lunch, your movement break, and the dentist appointment stay exactly where they are.',
  },
}

const jordanProposal: RecoveryProposalView = {
  id: 'proposal-jordan-romeo',
  studentId: 'student-jordan',
  status: 'pending',
  trigger: 'missed',
  title: 'Use Thursday’s catch-up block for the Romeo science assignment',
  sourceLabel: 'Romeo Virtual Academy · Science',
  createdAt: '2026-07-28T14:02:00-04:00',
  dueAt: '2026-07-31T17:00:00-04:00',
  priorityLabel: 'Required · due Friday',
  reason:
    'The science assignment was missed this morning. Thursday has reserved catch-up capacity and stays below Jordan’s daily workload limit.',
  tradeoff:
    'Thursday’s open catch-up capacity becomes committed; wrestling and weight training remain fixed.',
  requiredWorkPreserved: true,
  recommendedChoice: 'move-to-catch-up-block',
  options: optionsFor(
    {
      'move-to-catch-up-block':
        'Place the 35-minute assignment in Thursday’s reserved catch-up block.',
      'move-to-tomorrow':
        'Move the full assignment to Wednesday after lunch.',
      'split-sessions':
        'Use a 15-minute start Wednesday and 20 minutes Thursday.',
      'shorten-today':
        'Complete the required questions only in 20 minutes today.',
      'replace-lower-priority-review':
        'Replace Wednesday’s vocabulary review.',
      'keep-due-date-rebalance-week':
        'Spread movable review work over Wednesday through Friday.',
      'parent-manual':
        'Pick another open time before Friday’s due date.',
      'leave-unchanged':
        'Keep the assignment marked missed with no calendar change.',
    },
    {
      'move-to-catch-up-block': 'The reserved catch-up block will no longer be open.',
      'move-to-tomorrow': 'Wednesday would be at its limit.',
      'split-sessions': 'Two calendar blocks are needed instead of one.',
      'shorten-today': 'Fifteen minutes of required work still needs a plan.',
      'replace-lower-priority-review': 'Vocabulary review moves to next week.',
      'keep-due-date-rebalance-week': 'Two movable reviews change days.',
      'parent-manual': 'The parent must confirm capacity and conflicts.',
      'leave-unchanged': 'Due-date risk remains high.',
    },
    {
      'shorten-today':
        'Required questions cannot be removed unless a parent explicitly approves the reduced scope.',
    },
  ),
  changes: [
    {
      id: 'change-jordan-science',
      title: 'Romeo science: energy transfer',
      category: 'romeo-virtual-academy',
      kind: 'moved',
      before: [
        {
          date: '2026-07-28',
          startTime: '09:30',
          durationMinutes: 35,
          label: 'Missed',
        },
      ],
      after: [
        {
          date: '2026-07-30',
          startTime: '14:00',
          durationMinutes: 35,
          label: 'Catch-up block',
        },
      ],
      isRequiredWork: true,
      isFixedOrLocked: false,
    },
  ],
  workloadPreview: [
    {
      date: '2026-07-29',
      beforeMinutes: 235,
      proposedMinutes: 235,
      limitMinutes: 235,
      protectedMinutes: 80,
      overloadPrevented: true,
    },
    {
      date: '2026-07-30',
      beforeMinutes: 175,
      proposedMinutes: 210,
      limitMinutes: 235,
      protectedMinutes: 100,
    },
    {
      date: '2026-07-31',
      beforeMinutes: 195,
      proposedMinutes: 195,
      limitMinutes: 235,
      protectedMinutes: 75,
    },
  ],
  conflictIds: ['conflict-jordan-wrestling'],
  riskIds: ['risk-jordan-science'],
  studentExplanation: {
    headline: 'Science has a new catch-up time',
    changed: 'Your science assignment moves to Thursday at 2:00 PM for 35 minutes.',
    why: 'Today’s block was missed, and Thursday already has room saved for catch-up work.',
    tradeoff: 'That catch-up block will be used, but no required work is dropped.',
    reassurance: 'Wrestling, lunch, and weight training do not move.',
  },
}

const mayaProposal: RecoveryProposalView = {
  id: 'proposal-maya-writing',
  studentId: 'student-maya',
  status: 'approved',
  trigger: 'focus-difficulty',
  title: 'Shorten the writing restart and add a focus-recovery break',
  sourceLabel: 'Academic assignment · Writing',
  createdAt: '2026-07-28T12:18:00-04:00',
  dueAt: '2026-08-03T16:00:00-04:00',
  priorityLabel: 'Required · due next Monday',
  reason:
    'Maya asked for help restarting after losing focus. The proposal uses a smaller block and adds recovery time without increasing tomorrow’s load.',
  tradeoff:
    'The remaining outline work moves into Friday’s catch-up block. Required writing work stays scheduled.',
  requiredWorkPreserved: true,
  recommendedChoice: 'shorten-today',
  decidedChoice: 'shorten-today',
  decisionNote: 'Approved after checking Friday’s catch-up capacity.',
  options: optionsFor(
    {
      'shorten-today':
        'Use a 15-minute writing restart, then a 10-minute focus-recovery break.',
      'move-to-tomorrow': 'Move all 35 minutes to Wednesday.',
      'split-sessions': 'Use 15 minutes today and 20 minutes Friday.',
      'move-to-catch-up-block': 'Move all remaining work to Friday’s catch-up block.',
      'replace-lower-priority-review': 'Replace Thursday’s grammar review.',
      'keep-due-date-rebalance-week': 'Spread the outline and draft across the week.',
      'parent-manual': 'Choose a different restart time.',
      'leave-unchanged': 'Keep the original 35-minute block.',
    },
    {
      'shorten-today': 'Twenty outline minutes move to Friday; all required work remains.',
      'move-to-tomorrow': 'Wednesday would be near its limit.',
      'split-sessions': 'A second restart is needed Friday.',
      'move-to-catch-up-block': 'Writing does not restart today.',
      'replace-lower-priority-review': 'Grammar review changes days.',
      'keep-due-date-rebalance-week': 'Several writing blocks change.',
      'parent-manual': 'The parent confirms the new time.',
      'leave-unchanged': 'The longer block may be harder to restart today.',
    },
  ),
  changes: [
    {
      id: 'change-maya-writing',
      title: 'Writing: personal narrative outline',
      category: 'academic-assignment',
      kind: 'shortened',
      before: [
        {
          date: '2026-07-28',
          startTime: '13:00',
          durationMinutes: 35,
        },
      ],
      after: [
        {
          date: '2026-07-28',
          startTime: '13:00',
          durationMinutes: 15,
          label: 'Gentle restart',
        },
        {
          date: '2026-07-31',
          startTime: '13:30',
          durationMinutes: 20,
          label: 'Finish outline',
        },
      ],
      isRequiredWork: true,
      isFixedOrLocked: false,
    },
    {
      id: 'change-maya-break',
      title: 'Focus-recovery break',
      category: 'focus-recovery-break',
      kind: 'moved',
      before: [],
      after: [
        {
          date: '2026-07-28',
          startTime: '13:15',
          durationMinutes: 10,
          label: 'Added support',
        },
      ],
      isRequiredWork: false,
      isFixedOrLocked: false,
    },
  ],
  workloadPreview: [
    {
      date: '2026-07-28',
      beforeMinutes: 180,
      proposedMinutes: 160,
      limitMinutes: 190,
      protectedMinutes: 90,
    },
    {
      date: '2026-07-29',
      beforeMinutes: 175,
      proposedMinutes: 175,
      limitMinutes: 190,
      protectedMinutes: 75,
      overloadPrevented: true,
    },
    {
      date: '2026-07-31',
      beforeMinutes: 130,
      proposedMinutes: 150,
      limitMinutes: 190,
      protectedMinutes: 85,
    },
  ],
  conflictIds: [],
  riskIds: [],
  studentExplanation: {
    headline: 'Writing starts with one small step',
    changed:
      'Today’s writing restart is 15 minutes, followed by a 10-minute recovery break. You will finish the outline Friday.',
    why: 'You asked for support restarting, so the plan made the first step smaller.',
    tradeoff: 'Friday uses 20 minutes of catch-up time. No writing is removed.',
    reassurance: 'This is a supportive adjustment, not a penalty. Lunch and protected time stay put.',
  },
}

const initialModel: ScheduleRecoveryViewModel = {
  generatedAt: BASE_TIMESTAMP,
  timeZone: 'America/New_York',
  students: [
    {
      id: 'student-avery',
      name: 'Avery',
      initials: 'AV',
      gradeLabel: 'Grade 8',
      accent: 'violet',
    },
    {
      id: 'student-jordan',
      name: 'Jordan',
      initials: 'JR',
      gradeLabel: 'Grade 10',
      accent: 'blue',
    },
    {
      id: 'student-maya',
      name: 'Maya',
      initials: 'MY',
      gradeLabel: 'Grade 6',
      accent: 'teal',
    },
  ],
  proposals: [averyProposal, jordanProposal, mayaProposal],
  conflicts: [
    {
      id: 'conflict-avery-dentist',
      studentId: 'student-avery',
      title: 'Dentist appointment is locked',
      detail:
        'Wednesday 1:30–3:00 PM cannot receive moved work. The proposal uses morning capacity instead.',
      severity: 'medium',
      status: 'protected',
    },
    {
      id: 'conflict-jordan-wrestling',
      studentId: 'student-jordan',
      title: 'Wrestling is fixed',
      detail:
        'Wednesday 4:30 PM is fixed. Moving science to Wednesday would leave no recovery margin.',
      severity: 'high',
      status: 'resolved-by-proposal',
    },
  ],
  dueDateRisks: [
    {
      id: 'risk-avery-algebra',
      studentId: 'student-avery',
      title: 'Algebra due tomorrow',
      detail: 'The split plan completes the final session five hours before the due time.',
      dueAt: '2026-07-29T16:00:00-04:00',
      level: 'medium',
    },
    {
      id: 'risk-jordan-science',
      studentId: 'student-jordan',
      title: 'Science due Friday',
      detail: 'Without recovery, the required assignment remains unscheduled.',
      dueAt: '2026-07-31T17:00:00-04:00',
      level: 'high',
    },
  ],
  calendarItems: [
    {
      id: 'calendar-avery-lunch',
      studentId: 'student-avery',
      date: '2026-07-28',
      startTime: '12:00',
      durationMinutes: 45,
      title: 'Lunch',
      category: 'meal',
      state: 'protected',
      isFixedOrLocked: true,
    },
    {
      id: 'calendar-avery-movement',
      studentId: 'student-avery',
      date: '2026-07-28',
      startTime: '13:45',
      durationMinutes: 10,
      title: 'Movement break',
      category: 'movement-break',
      state: 'protected',
      isFixedOrLocked: true,
    },
    {
      id: 'calendar-avery-algebra',
      studentId: 'student-avery',
      date: '2026-07-28',
      startTime: '14:10',
      durationMinutes: 20,
      title: 'Algebra practice · session 1',
      category: 'manuel-academy-lesson',
      state: 'shortened',
      isFixedOrLocked: false,
    },
    {
      id: 'calendar-avery-life',
      studentId: 'student-avery',
      date: '2026-07-29',
      startTime: '11:20',
      durationMinutes: 35,
      title: 'Ready for Life: meal planning',
      category: 'ready-for-life',
      state: 'unchanged',
      isFixedOrLocked: false,
    },
    {
      id: 'calendar-avery-dentist',
      studentId: 'student-avery',
      date: '2026-07-29',
      startTime: '13:30',
      durationMinutes: 90,
      title: 'Dentist appointment',
      category: 'appointment',
      state: 'protected',
      isFixedOrLocked: true,
    },
    {
      id: 'calendar-jordan-tutor',
      studentId: 'student-jordan',
      date: '2026-07-29',
      startTime: '09:15',
      durationMinutes: 20,
      title: 'Adaptive tutor review',
      category: 'adaptive-tutor-intervention',
      state: 'unchanged',
      isFixedOrLocked: false,
    },
    {
      id: 'calendar-jordan-parent',
      studentId: 'student-jordan',
      date: '2026-07-29',
      startTime: '12:45',
      durationMinutes: 30,
      title: 'Parent-created project check-in',
      category: 'parent-created-activity',
      state: 'protected',
      isFixedOrLocked: true,
    },
    {
      id: 'calendar-jordan-wrestling',
      studentId: 'student-jordan',
      date: '2026-07-29',
      startTime: '16:30',
      durationMinutes: 90,
      title: 'Wrestling practice',
      category: 'wrestling',
      state: 'protected',
      isFixedOrLocked: true,
    },
    {
      id: 'calendar-jordan-science',
      studentId: 'student-jordan',
      date: '2026-07-30',
      startTime: '14:00',
      durationMinutes: 35,
      title: 'Romeo science catch-up',
      category: 'romeo-virtual-academy',
      state: 'moved',
      isFixedOrLocked: false,
    },
    {
      id: 'calendar-jordan-weights',
      studentId: 'student-jordan',
      date: '2026-07-30',
      startTime: '16:00',
      durationMinutes: 45,
      title: 'Weight training',
      category: 'weight-training',
      state: 'unchanged',
      isFixedOrLocked: true,
    },
    {
      id: 'calendar-maya-writing',
      studentId: 'student-maya',
      date: '2026-07-28',
      startTime: '13:00',
      durationMinutes: 15,
      title: 'Writing · gentle restart',
      category: 'academic-assignment',
      state: 'shortened',
      isFixedOrLocked: false,
    },
    {
      id: 'calendar-maya-recovery',
      studentId: 'student-maya',
      date: '2026-07-28',
      startTime: '13:15',
      durationMinutes: 10,
      title: 'Focus-recovery break',
      category: 'focus-recovery-break',
      state: 'added',
      isFixedOrLocked: false,
    },
    {
      id: 'calendar-maya-pe',
      studentId: 'student-maya',
      date: '2026-07-28',
      startTime: '14:30',
      durationMinutes: 40,
      title: 'PE bike ride',
      category: 'pe-activity',
      state: 'unchanged',
      isFixedOrLocked: true,
    },
    {
      id: 'calendar-maya-bjj',
      studentId: 'student-maya',
      date: '2026-07-29',
      startTime: '17:00',
      durationMinutes: 60,
      title: 'Jiu-jitsu',
      category: 'jiu-jitsu',
      state: 'protected',
      isFixedOrLocked: true,
    },
  ],
  auditHistory: [
    {
      id: 'audit-maya-writing-approved',
      proposalId: 'proposal-maya-writing',
      studentId: 'student-maya',
      occurredAt: '2026-07-28T12:28:00-04:00',
      actorLabel: 'Parent',
      action: 'approved',
      summary: 'Approved “Shorten today” and kept the remaining writing scheduled.',
      reason: 'Friday catch-up capacity was confirmed.',
      reversible: true,
    },
  ],
  safeguards: {
    sleepProtected: true,
    mealsProtected: true,
    parentLockedTimeProtected: true,
    requiredWorkRemovalRequiresApproval: true,
    followingDayOverloadBlocked: true,
  },
}

export function createDemoScheduleRecoveryModel(): ScheduleRecoveryViewModel {
  return {
    ...initialModel,
    students: initialModel.students.map((student) => ({ ...student })),
    proposals: initialModel.proposals.map((proposal) => ({
      ...proposal,
      options: proposal.options.map((option) => ({
        ...option,
        workloadDeltaMinutes: { ...option.workloadDeltaMinutes },
      })),
      changes: proposal.changes.map((change) => ({
        ...change,
        before: change.before.map((placement) => ({ ...placement })),
        after: change.after.map((placement) => ({ ...placement })),
      })),
      workloadPreview: proposal.workloadPreview.map((day) => ({ ...day })),
      conflictIds: [...proposal.conflictIds],
      riskIds: [...proposal.riskIds],
      studentExplanation: { ...proposal.studentExplanation },
    })),
    conflicts: initialModel.conflicts.map((conflict) => ({ ...conflict })),
    dueDateRisks: initialModel.dueDateRisks.map((risk) => ({ ...risk })),
    calendarItems: initialModel.calendarItems.map((item) => ({ ...item })),
    auditHistory: initialModel.auditHistory.map((entry) => ({ ...entry })),
    safeguards: { ...initialModel.safeguards },
  }
}

function actionLabel(choice: RecoveryChoice): string {
  return recoveryChoiceMetadata(choice).label
}

export function applyDemoRecoveryAction(
  model: ScheduleRecoveryViewModel,
  action: DemoRecoveryAction,
): ScheduleRecoveryViewModel {
  const proposalId = action.input.proposalId
  const proposal = model.proposals.find((item) => item.id === proposalId)
  if (!proposal) return model

  if (action.type === 'undo') {
    const target = model.auditHistory.find(
      (entry) =>
        entry.id === action.input.auditEntryId &&
        entry.proposalId === action.input.proposalId &&
        entry.reversible,
    )
    if (!target) return model
    const occurredAt = new Date().toISOString()
    return {
      ...model,
      generatedAt: occurredAt,
      proposals: model.proposals.map((item) =>
        item.id === proposalId
          ? {
              ...item,
              status: 'undone',
              decidedChoice: undefined,
              decisionNote: undefined,
            }
          : item,
      ),
      auditHistory: [
        {
          id: `audit-${proposalId}-undo-${model.auditHistory.length + 1}`,
          proposalId,
          studentId: proposal.studentId,
          occurredAt,
          actorLabel: 'Parent',
          action: 'undone',
          summary: `Restored the schedule from before “${target.summary}”`,
          reason: 'Undo requested in the recovery review.',
          reversible: false,
        },
        ...model.auditHistory.map((entry) =>
          entry.id === target.id ? { ...entry, reversible: false } : entry,
        ),
      ],
    }
  }

  const occurredAt = new Date().toISOString()
  const choice =
    action.type === 'manual'
      ? 'parent-manual'
      : action.input.choice
  const reason =
    action.type === 'override' || action.type === 'manual'
      ? action.input.reason
      : undefined
  const status = action.type === 'approve' ? 'approved' : 'overridden'
  const auditAction =
    action.type === 'approve'
      ? 'approved'
      : action.type === 'manual'
        ? 'manually-placed'
        : 'overridden'
  const summary =
    action.type === 'manual'
      ? `Manually placed work on ${action.input.date} at ${action.input.startTime} for ${action.input.durationMinutes} minutes.`
      : `${action.type === 'approve' ? 'Approved' : 'Overrode with'} “${actionLabel(choice)}”.`

  return {
    ...model,
    generatedAt: occurredAt,
    proposals: model.proposals.map((item) => {
      if (item.id !== proposalId) return item
      const manualChanges =
        action.type === 'manual'
          ? item.changes.map((change, index) =>
              index === 0
                ? {
                    ...change,
                    kind: 'moved' as const,
                    after: [
                      {
                        date: action.input.date,
                        startTime: action.input.startTime,
                        durationMinutes: action.input.durationMinutes,
                        label: 'Parent placement',
                      },
                    ],
                  }
                : change,
            )
          : item.changes
      return {
        ...item,
        status,
        decidedChoice: choice,
        decisionNote: reason,
        changes: manualChanges,
      }
    }),
    auditHistory: [
      {
        id: `audit-${proposalId}-${model.auditHistory.length + 1}`,
        proposalId,
        studentId: proposal.studentId,
        occurredAt,
        actorLabel: 'Parent',
        action: auditAction,
        summary,
        reason,
        reversible: true,
      },
      ...model.auditHistory.map((entry) =>
        entry.proposalId === proposalId ? { ...entry, reversible: false } : entry,
      ),
    ],
  }
}
