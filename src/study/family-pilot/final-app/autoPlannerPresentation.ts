import type { FamilyAutoPlannerTodayPlan } from '../auto-planner'
import type { StudentDashboardModel } from '../student-dashboard'

/** Learner-safe host copy. Internal planner enums and reason codes never cross. */
export function applyAutoPlannerPresentation(
  model: StudentDashboardModel,
  plan: FamilyAutoPlannerTodayPlan,
): StudentDashboardModel {
  if (plan.status === 'NEEDS_PLAN_SETUP' && model.todayItems.length === 0) {
    return Object.freeze({
      ...model,
      progressLabel: 'School plan setup needed',
      mission: Object.freeze({
        state: 'no-work' as const,
        eyebrow: 'Today’s schoolwork',
        title: 'Today’s schoolwork isn’t ready yet.',
        statusLabel: 'A parent needs to finish the School Plan',
        description: 'Ask a parent to unlock the Parent Hub and review this learner’s School Plan.',
      }),
      todayEmptyLabel: 'A parent can prepare today’s work in Parent Hub → School Plan.',
    })
  }
  if (plan.status === 'NO_SCHOOL_TODAY') {
    return Object.freeze({
      ...model,
      progressLabel: 'No ordinary schoolwork planned today',
      mission: Object.freeze({
        state: 'no-work' as const,
        eyebrow: 'Today’s school plan',
        title: 'No school today',
        statusLabel: 'Your school calendar is clear',
        description: 'No new daily lessons were assigned for this date.',
      }),
      todayEmptyLabel: 'No ordinary schoolwork is scheduled today.',
    })
  }
  if (plan.status === 'BLOCKED' && plan.items.length === 0) {
    return Object.freeze({
      ...model,
      progressLabel: 'Today’s plan needs attention',
      mission: Object.freeze({
        state: 'no-work' as const,
        eyebrow: 'Today’s schoolwork',
        title: 'Today’s schoolwork needs a parent.',
        statusLabel: 'Nothing new was opened',
        description: 'Ask a parent to unlock the Parent Hub and review the School Plan or device storage.',
      }),
      todayEmptyLabel: 'No new work was added. Existing saved Study work remains unchanged.',
    })
  }
  return model
}
