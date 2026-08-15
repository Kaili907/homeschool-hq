import { describe, expect, it } from 'vitest'
import type { FamilyPilotStudentDashboardModel } from '../dashboard-adapter'
import type { FamilyAutoPlannerTodayItem, FamilyAutoPlannerTodayPlan } from '../auto-planner'
import type { StudentDashboardModel } from '../student-dashboard'
import { applyAutoPlannerPresentation } from './autoPlannerPresentation'

const model: StudentDashboardModel = {
  student: { displayName: 'Ada' }, periodEyebrow: 'Today', periodLabel: 'Friday', progressLabel: 'No work',
  mission: { state: 'no-work', eyebrow: 'Today', title: 'No work', statusLabel: 'Clear' },
  todayItems: [], courses: [], upcoming: [], quickTools: [],
}

function plannerItem(patch: Partial<FamilyAutoPlannerTodayItem> = {}): FamilyAutoPlannerTodayItem {
  return {
    kind: 'LESSON', origin: 'AUTO', learnerRef: 'student:ada', assignmentRef: 'assignment:one',
    itemRef: 'lesson:one', lessonRef: 'lesson:one', assessmentRef: null, courseRef: 'course:math',
    unitRef: 'unit:one', subject: 'mathematics', workingGrade: '5', title: 'Math lesson',
    state: 'IN_PROGRESS', scheduledLocalTime: '09:00', materializedForDate: '2026-08-14',
    carriedForwardFromDate: null, blockedReason: null, ...patch,
  }
}

function plan(status: FamilyAutoPlannerTodayPlan['status'], patch: Partial<FamilyAutoPlannerTodayPlan> = {}): FamilyAutoPlannerTodayPlan {
  return {
    status,
    reason: status === 'NEEDS_PLAN_SETUP' ? 'SCHOOL_PLAN_MISSING' : status === 'NO_SCHOOL_TODAY' ? 'NON_SCHOOL_DAY' : 'NONE',
    scope: { householdRef: 'household:test', learnerRef: 'student:ada' }, householdTimeZone: 'America/Detroit',
    localDate: '2026-08-14', generatedAt: '2026-08-14T13:00:00.000Z', items: [], blockers: [],
    manualOverrideActive: false, offlineMaterializedWorkAvailable: false, ...patch,
  }
}

type TodayAuthority = Pick<FamilyPilotStudentDashboardModel, 'today'>

function authorityItem(patch: Partial<FamilyPilotStudentDashboardModel['today']['items'][number]> = {}): FamilyPilotStudentDashboardModel['today']['items'][number] {
  return {
    scheduleItemRef: 'schedule:one', assignmentRef: 'assignment:one', kind: 'LESSON', title: 'Math lesson',
    subject: 'mathematics', courseRef: 'course:math', workingGrade: '5', date: '2026-08-14', timing: 'TODAY',
    status: 'IN_PROGRESS', blocked: null,
    action: { type: 'CONTINUE', studentRef: 'student:ada', assignmentRef: 'assignment:one', workKind: 'LESSON' },
    ...patch,
  }
}

function authority(items: readonly FamilyPilotStudentDashboardModel['today']['items'][number][]): TodayAuthority {
  const completed = items.filter((item) => item.kind !== 'BREAK' && item.status === 'COMPLETED').length
  return {
    today: {
      date: '2026-08-14', state: items.length ? 'SCHEDULED' : 'EMPTY',
      emptyReason: items.length ? null : 'NO_SCHEDULED_WORK', items,
      scheduledCount: items.length, omittedCount: 0,
      academicCount: items.filter((item) => item.kind !== 'BREAK').length,
      completedAcademicCount: completed,
    },
  }
}

function presentedModel(item = authorityItem()): StudentDashboardModel {
  return {
    ...model,
    progressLabel: '0 of 1 complete today',
    mission: {
      state: item.blocked?.kind === 'SAFETY_HOLD' ? 'safety-blocked' : 'continue-lesson',
      eyebrow: 'Continue your work', title: item.title, context: 'Mathematics · Working Grade 5',
      statusLabel: item.blocked?.message ?? 'In progress', description: item.blocked?.message ?? 'Continue from your saved place.',
      ...(item.action ? { workRef: item.assignmentRef!, actionLabel: 'Continue lesson' } : {}),
    },
    todayItems: [{
      workRef: item.assignmentRef!, title: item.title, context: 'Mathematics · Working Grade 5',
      state: item.blocked ? 'blocked' : item.status === 'COMPLETED' ? 'complete' : 'in-progress',
      stateLabel: item.blocked?.message ?? (item.status === 'COMPLETED' ? 'Complete' : 'In progress'),
      actionable: Boolean(item.action), ...(item.action ? { actionLabel: 'Continue' } : {}),
    }],
  }
}

describe('student school-day completion presentation', () => {
  it('never exposes the technical missing-plan enum to a learner', () => {
    const result = applyAutoPlannerPresentation(model, plan('NEEDS_PLAN_SETUP'))
    expect(result.mission.title).toBe('Today’s schoolwork isn’t ready yet.')
    expect(result.dayStatus?.state).toBe('needs-plan')
    expect(JSON.stringify(result)).not.toContain('NEEDS_PLAN_SETUP')
    expect(result.mission.description).toContain('Parent Hub')
  })

  it('keeps no-school separate from a completed school day', () => {
    const result = applyAutoPlannerPresentation(model, plan('NO_SCHOOL_TODAY'))
    expect(result).toMatchObject({ dayStatus: { state: 'no-school' }, mission: { state: 'no-school', title: 'No school today' } })
    expect(result.mission.title).not.toContain('done')
  })

  it('marks the day complete only from planner completion plus zero unfinished assignment truth', () => {
    const completedItems = [
      authorityItem({ status: 'COMPLETED', action: null }),
      authorityItem({ scheduleItemRef: 'schedule:two', assignmentRef: 'assessment:two', kind: 'ASSESSMENT', title: 'Unit assessment', status: 'COMPLETED', action: null }),
    ]
    const source = authority(completedItems)
    const dashboard: StudentDashboardModel = {
      ...model,
      todayItems: completedItems.map((item) => ({ workRef: item.assignmentRef!, title: item.title, context: 'Mathematics', state: 'complete', stateLabel: 'Complete' })),
    }
    const result = applyAutoPlannerPresentation(dashboard, plan('COMPLETE_FOR_TODAY'), source)
    expect(result).toMatchObject({
      progressLabel: '2 of 2 required items complete today',
      dayStatus: { state: 'complete', requiredCount: 2, completedCount: 2, remainingCount: 0, assessmentCount: 1 },
      mission: { state: 'day-complete', title: 'You’re done for today', statusLabel: '2 required items complete' },
    })
    expect(JSON.stringify(result)).not.toContain('%')
  })

  it('fails closed when planner completion conflicts with unfinished or safety-blocked assignment truth', () => {
    const held = authorityItem({
      blocked: { kind: 'SAFETY_HOLD', message: 'This work is paused until a grown-up clears the safety check.' },
      status: 'WAITING', action: null,
    })
    const result = applyAutoPlannerPresentation(presentedModel(held), plan('COMPLETE_FOR_TODAY'), authority([held]))
    expect(result).toMatchObject({ dayStatus: { state: 'unfinished', remainingCount: 1 }, mission: { title: 'You still have work' } })
    expect(result.mission.title).not.toContain('done')
  })

  it('uses the learner-completion attestation contract for the waiting-on-parent state', () => {
    const waiting = authorityItem({
      blocked: { kind: 'GUARDIAN_PENDING', message: 'A grown-up needs to confirm this work before it can continue.' },
      status: 'WAITING', action: null,
    })
    // Planner still sees the Core assignment as active; the attestation authority
    // is what proves the learner has completed every personal step.
    const result = applyAutoPlannerPresentation(
      presentedModel(waiting),
      plan('READY', { items: [plannerItem()] }),
      authority([waiting]),
    )
    expect(result).toMatchObject({
      dayStatus: { state: 'waiting-on-parent', waitingOnParentCount: 1, remainingCount: 1 },
      mission: { state: 'waiting-on-parent', title: 'Your work is done — waiting for Parent review' },
    })
    expect(result.mission).not.toHaveProperty('workRef')
  })

  it.each([
    ['ADULT_REVIEW_REQUIRED', 'ASSESSMENT_REVIEW_REQUIRED'],
    ['PENDING_GUARDIAN_ATTESTATION', 'ASSESSMENT_GUARDIAN_REQUIRED'],
  ] as const)('treats submitted %s assessments as learner-done but waiting for Parent authority', (status, reason) => {
    const waiting = authorityItem({
      assignmentRef: 'assessment:one', kind: 'ASSESSMENT', title: 'Unit assessment', status: 'WAITING', action: null,
      blocked: {
        kind: status === 'ADULT_REVIEW_REQUIRED' ? 'ADULT_REVIEW_REQUIRED' : 'GUARDIAN_PENDING',
        message: 'This submitted assessment is waiting for a grown-up.',
      },
    })
    const result = applyAutoPlannerPresentation(
      presentedModel(waiting),
      plan('WAITING_FOR_ASSESSMENT', {
        reason,
        items: [plannerItem({
          kind: 'ASSESSMENT', assignmentRef: 'assessment:one', itemRef: 'assessment-material:one', lessonRef: null,
          assessmentRef: 'assessment-material:one', state: 'WAITING', blockedReason: reason,
        })],
      }),
      authority([waiting]),
    )
    expect(result).toMatchObject({
      dayStatus: { state: 'waiting-on-parent', waitingOnParentCount: 1, assessmentCount: 1 },
      mission: { title: 'Your work is done — waiting for Parent review' },
    })
    expect(JSON.stringify(result)).not.toContain(status)
  })

  it('keeps trusted-scoring wait distinct from both completion and Parent review', () => {
    const waiting = authorityItem({
      assignmentRef: 'assessment:one', kind: 'ASSESSMENT', title: 'Unit assessment', status: 'WAITING', action: null,
      blocked: { kind: 'ASSESSMENT_SCORING_PENDING', message: 'This assessment is waiting for trusted scoring.' },
    })
    const result = applyAutoPlannerPresentation(
      presentedModel(waiting),
      plan('WAITING_FOR_ASSESSMENT', {
        reason: 'ASSESSMENT_PENDING',
        items: [plannerItem({
          kind: 'ASSESSMENT', assignmentRef: 'assessment:one', itemRef: 'assessment-material:one', lessonRef: null,
          assessmentRef: 'assessment-material:one', state: 'WAITING', blockedReason: 'ASSESSMENT_PENDING',
        })],
      }),
      authority([waiting]),
    )
    expect(result).toMatchObject({
      dayStatus: { state: 'waiting-for-assessment', assessmentCount: 1 },
      mission: { title: 'Your work is submitted' },
    })
    expect(result.mission.title).not.toContain('done for today')
  })

  it('keeps an actionable assessment in the unfinished state', () => {
    const assessment = authorityItem({
      assignmentRef: 'assessment:one', kind: 'ASSESSMENT', title: 'Unit assessment', status: 'NOT_STARTED',
      action: { type: 'START', studentRef: 'student:ada', assignmentRef: 'assessment:one', workKind: 'ASSESSMENT' },
    })
    const result = applyAutoPlannerPresentation(
      presentedModel(assessment),
      plan('READY', { items: [plannerItem({ kind: 'ASSESSMENT', assignmentRef: 'assessment:one', itemRef: 'assessment-material:one', lessonRef: null, assessmentRef: 'assessment-material:one', state: 'NOT_STARTED' })] }),
      authority([assessment]),
    )
    expect(result).toMatchObject({ dayStatus: { state: 'unfinished', assessmentCount: 1 }, mission: { title: 'You still have work', actionLabel: 'Continue lesson' } })
  })

  it('labels required carry-forward work with its deterministic planner date', () => {
    const active = authorityItem()
    const result = applyAutoPlannerPresentation(
      presentedModel(active),
      plan('READY', { items: [plannerItem({ materializedForDate: '2026-08-13', carriedForwardFromDate: '2026-08-13' })] }),
      authority([active]),
    )
    expect(result).toMatchObject({ dayStatus: { state: 'unfinished', carryForwardCount: 1 }, mission: { title: 'You still have work' } })
    expect(result.progressLabel).toContain('1 carried forward')
    expect(result.todayItems[0].context).toContain('Carried forward from Thu, Aug 13')
  })

  it('does not expose a Start or Continue action through an Auto Planner safety hold', () => {
    const held = authorityItem({
      status: 'WAITING', action: null,
      blocked: { kind: 'SAFETY_HOLD', message: 'This work is paused until a grown-up clears the safety check.' },
    })
    const result = applyAutoPlannerPresentation(
      presentedModel(held),
      plan('BLOCKED', {
        reason: 'SAFETY_HOLD',
        items: [plannerItem({ state: 'BLOCKED', blockedReason: 'SAFETY_HOLD' })],
        blockers: [{ reason: 'SAFETY_HOLD', subject: 'mathematics', detail: 'Internal detail.' }],
      }),
      authority([held]),
    )
    expect(result).toMatchObject({ dayStatus: { state: 'unfinished' }, mission: { state: 'safety-blocked', title: 'You still have work' } })
    expect(result.mission).not.toHaveProperty('workRef')
    expect(JSON.stringify(result)).not.toContain('Internal detail')
  })

  it('honors a parent-paused subject even when Core still has a resumable carry-forward assignment', () => {
    const active = authorityItem()
    const result = applyAutoPlannerPresentation(
      presentedModel(active),
      plan('BLOCKED', {
        reason: 'SUBJECT_PAUSED',
        items: [plannerItem({ state: 'BLOCKED', blockedReason: 'SUBJECT_PAUSED', carriedForwardFromDate: '2026-08-13' })],
        blockers: [{ reason: 'SUBJECT_PAUSED', subject: 'mathematics', detail: 'Internal plan detail.' }],
      }),
      authority([active]),
    )
    expect(result).toMatchObject({
      dayStatus: { state: 'unfinished', carryForwardCount: 1 },
      mission: { title: 'You still have work' },
      todayItems: [{ state: 'blocked', stateLabel: 'Paused in your School Plan', actionable: false }],
    })
    expect(result.mission).not.toHaveProperty('actionLabel')
  })
})
