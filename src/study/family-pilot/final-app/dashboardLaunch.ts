import type {
  FamilyPilotDashboardCommand,
  FamilyPilotStudentDashboardModel,
} from '../dashboard-adapter'

export type FamilyPilotDashboardLaunchCommand = Extract<
  FamilyPilotDashboardCommand,
  { readonly type: 'START' | 'CONTINUE' }
>

/**
 * Accepts only the exact learner/item command already composed by the
 * Dashboard adapter. It never derives a route from a display ref alone.
 */
export function findExactDashboardLaunchCommand(
  model: FamilyPilotStudentDashboardModel,
  activeStudentRef: string,
  assignmentRef: string,
): FamilyPilotDashboardLaunchCommand | null {
  if (model.learner.studentRef !== activeStudentRef) return null
  const item = model.today.items.find((candidate) => candidate.assignmentRef === assignmentRef)
  const command = item?.action
  if (
    !item ||
    (item.kind !== 'LESSON' && item.kind !== 'ASSESSMENT') ||
    !command ||
    (command.type !== 'START' && command.type !== 'CONTINUE') ||
    command.studentRef !== activeStudentRef ||
    command.assignmentRef !== assignmentRef ||
    command.workKind !== item.kind
  ) return null
  return command
}
