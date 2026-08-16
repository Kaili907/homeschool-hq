import type {
  FamilyPilotDashboardCommand,
  FamilyPilotDashboardJarvisActionPort,
} from './types'

export const FAMILY_PILOT_VISUAL_ONLY_JARVIS_PORT: FamilyPilotDashboardJarvisActionPort =
  Object.freeze({ tutorCapability: 'NOT_CONNECTED' })

export function startDashboardWork(
  studentRef: string,
  assignmentRef: string,
  workKind: 'LESSON' | 'ASSESSMENT',
): FamilyPilotDashboardCommand {
  return Object.freeze({ type: 'START', studentRef, assignmentRef, workKind })
}

export function continueDashboardWork(
  studentRef: string,
  assignmentRef: string,
  workKind: 'LESSON' | 'ASSESSMENT',
): FamilyPilotDashboardCommand {
  return Object.freeze({ type: 'CONTINUE', studentRef, assignmentRef, workKind })
}

export function openDashboardCourse(studentRef: string, courseRef: string): FamilyPilotDashboardCommand {
  return Object.freeze({ type: 'OPEN_COURSE', studentRef, courseRef })
}

export function openDashboardSurface(
  studentRef: string,
  type: 'OPEN_SCHEDULE' | 'OPEN_REPORTS' | 'OPEN_ASSIGNMENTS' | 'SIGN_OUT',
): FamilyPilotDashboardCommand {
  return Object.freeze({ type, studentRef })
}

/** Future Tutor V2 can call this seam without changing the dashboard model. */
export function openDashboardTutor(
  port: FamilyPilotDashboardJarvisActionPort,
  studentRef: string,
): boolean {
  if (port.tutorCapability !== 'AVAILABLE') return false
  port.onOpenTutor({ studentRef })
  return true
}
