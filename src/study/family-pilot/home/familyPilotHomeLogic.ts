import type { FamilyPilotHomeAssignment } from './types'

export type FamilyPilotHomeAssignmentAction = 'start' | 'resume' | null

export function resolveHomeAssignmentAction(
  assignment: Pick<FamilyPilotHomeAssignment, 'status'>,
): FamilyPilotHomeAssignmentAction {
  if (assignment.status === 'not-started') return 'start'
  if (assignment.status === 'in-progress') return 'resume'
  return null
}

/** Rounded percent of today's assignments completed, clamped to [0, 100]. */
export function simpleProgressPercent(completedCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0
  const clamped = Math.min(Math.max(completedCount, 0), totalCount)
  return Math.round((clamped / totalCount) * 100)
}
