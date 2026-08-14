import { describe, expect, it } from 'vitest'
import type { FamilyAutoPlannerTodayPlan } from '../auto-planner'
import type { StudentDashboardModel } from '../student-dashboard'
import { applyAutoPlannerPresentation } from './autoPlannerPresentation'

const model: StudentDashboardModel = {
  student: { displayName: 'Ada' }, periodEyebrow: 'Today', periodLabel: 'Friday', progressLabel: 'No work',
  mission: { state: 'no-work', eyebrow: 'Today', title: 'No work', statusLabel: 'Clear' },
  todayItems: [], courses: [], upcoming: [], quickTools: [],
}

function plan(status: FamilyAutoPlannerTodayPlan['status']): FamilyAutoPlannerTodayPlan {
  return {
    status, reason: status === 'NEEDS_PLAN_SETUP' ? 'SCHOOL_PLAN_MISSING' : status === 'NO_SCHOOL_TODAY' ? 'NON_SCHOOL_DAY' : 'PERSISTENCE_UNAVAILABLE',
    scope: { householdRef: 'household:test', learnerRef: 'student:ada' }, householdTimeZone: 'America/Detroit',
    localDate: '2026-08-14', generatedAt: '2026-08-14T13:00:00.000Z', items: [], blockers: [],
    manualOverrideActive: false, offlineMaterializedWorkAvailable: false,
  }
}

describe('auto planner learner presentation', () => {
  it('never exposes the technical missing-plan enum to a learner', () => {
    const result = applyAutoPlannerPresentation(model, plan('NEEDS_PLAN_SETUP'))
    expect(result.mission.title).toBe('Today’s schoolwork isn’t ready yet.')
    expect(JSON.stringify(result)).not.toContain('NEEDS_PLAN_SETUP')
    expect(result.mission.description).toContain('Parent Hub')
  })

  it('uses friendly truthful no-school copy', () => {
    const result = applyAutoPlannerPresentation(model, plan('NO_SCHOOL_TODAY'))
    expect(result.mission.title).toBe('No school today')
    expect(result.mission.description).toContain('No new daily lessons')
  })
})
