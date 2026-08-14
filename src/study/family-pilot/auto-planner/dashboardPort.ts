import type { BuildDailyScheduleInput, DailyScheduleAssignmentInput } from '../schedule'
import type { FamilyAutoPlanner } from './coordinator'
import type { FamilyAutoPlannerScope, FamilyAutoPlannerTodayPlan } from './types'

/** Clean convergence port. A Dashboard depends on this read shape, not planner
 * storage, catalog selection, Core mutations, or assessment internals. */
export interface FamilyAutoPlannerDashboardPort {
  getTodayWork(scope: FamilyAutoPlannerScope, instant?: Date): Promise<FamilyAutoPlannerTodayPlan>
}

export function createFamilyAutoPlannerDashboardPort(
  planner: Pick<FamilyAutoPlanner, 'today'>,
): FamilyAutoPlannerDashboardPort {
  return Object.freeze({
    getTodayWork: (scope: FamilyAutoPlannerScope, instant?: Date) => planner.today(scope, instant),
  })
}

/** Lesson-only projection into the already-shipped daily schedule contract.
 * Assessments remain in `FamilyAutoPlannerTodayPlan.items` for the existing
 * assessment surface; they are not forged into Core assignment state. */
export function toExistingDailyScheduleInput(plan: FamilyAutoPlannerTodayPlan): BuildDailyScheduleInput {
  const items: DailyScheduleAssignmentInput[] = plan.items.flatMap((item) => {
    if (item.kind !== 'LESSON') return []
    const state: DailyScheduleAssignmentInput['state'] = item.state === 'IN_PROGRESS'
      ? 'active'
      : item.state === 'PAUSED' || item.state === 'BLOCKED'
        ? 'paused'
        : 'planned'
    return [{
      kind: 'assignment',
      assignmentRef: item.assignmentRef,
      lessonRef: item.lessonRef,
      title: item.title,
      state,
    }]
  })
  return Object.freeze({ studentRef: plan.scope.learnerRef, date: plan.localDate, items: Object.freeze(items) })
}
