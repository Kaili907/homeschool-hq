import { describe, expect, it } from 'vitest'
import type {
  FamilyPilotDashboardCommand,
  FamilyPilotDashboardWorkItem,
  FamilyPilotStudentDashboardModel,
} from '../dashboard-adapter'
import { findExactDashboardLaunchCommand } from './dashboardLaunch'

const LEARNER = 'student:authorized'

function modelFor(
  assignmentRef: string,
  workKind: 'LESSON' | 'ASSESSMENT',
  type: 'START' | 'CONTINUE',
  overrides: Partial<FamilyPilotDashboardCommand> = {},
): FamilyPilotStudentDashboardModel {
  const command = {
    type,
    studentRef: LEARNER,
    assignmentRef,
    workKind,
    ...overrides,
  } as FamilyPilotDashboardCommand
  const item: FamilyPilotDashboardWorkItem = {
    scheduleItemRef: `schedule:${assignmentRef}`,
    assignmentRef,
    kind: workKind,
    title: assignmentRef,
    subject: 'mathematics',
    courseRef: 'ma-g5-mathematics',
    workingGrade: '5',
    date: '2026-08-14',
    timing: 'TODAY',
    status: type === 'START' ? 'NOT_STARTED' : 'IN_PROGRESS',
    blocked: null,
    action: command,
  }
  return {
    learner: { studentRef: LEARNER, displayName: 'Authorized Learner', avatarInitial: 'A', nominalGrade: '5', greeting: 'Welcome' },
    today: { date: '2026-08-14', state: 'SCHEDULED', emptyReason: null, items: [item], scheduledCount: 1, omittedCount: 0, academicCount: 1, completedAcademicCount: 0 },
    courses: [],
    progressSummary: { lessonsAssigned: 1, lessonsCompleted: 0, assessmentsAssigned: 0, assessmentsCertified: 0, recentCompletions: [] },
    upcoming: [], alerts: [], tools: [],
    jarvis: { mode: 'VISUAL_ONLY', status: 'STATIC_HELP_AVAILABLE', tutorCapability: 'NOT_CONNECTED', interactive: false, staticHelpAvailable: true },
    actions: { signOut: { type: 'SIGN_OUT', studentRef: LEARNER } },
  }
}

describe('Dashboard launch command boundary', () => {
  it.each([
    ['manual Parent assignment', 'assignment:manual', 'LESSON', 'START'],
    ['Auto Planner assignment', 'assignment:auto', 'LESSON', 'START'],
    ['carried assignment', 'assignment:carried', 'LESSON', 'CONTINUE'],
    ['actionable assessment', 'assessment:unit-one', 'ASSESSMENT', 'START'],
  ] as const)('accepts the same exact command path for %s', (_label, assignmentRef, workKind, type) => {
    expect(findExactDashboardLaunchCommand(modelFor(assignmentRef, workKind, type), LEARNER, assignmentRef)).toEqual({
      type, studentRef: LEARNER, assignmentRef, workKind,
    })
  })

  it('rejects stale, sibling-bound, assignment-mismatched, and kind-mismatched commands', () => {
    const exact = modelFor('assignment:exact', 'LESSON', 'START')
    expect(findExactDashboardLaunchCommand(exact, LEARNER, 'assignment:missing')).toBeNull()
    expect(findExactDashboardLaunchCommand(exact, 'student:sibling', 'assignment:exact')).toBeNull()
    expect(findExactDashboardLaunchCommand(
      modelFor('assignment:exact', 'LESSON', 'START', { studentRef: 'student:sibling' }),
      LEARNER,
      'assignment:exact',
    )).toBeNull()
    expect(findExactDashboardLaunchCommand(
      modelFor('assignment:exact', 'LESSON', 'START', { assignmentRef: 'assignment:other' }),
      LEARNER,
      'assignment:exact',
    )).toBeNull()
    expect(findExactDashboardLaunchCommand(
      modelFor('assignment:exact', 'LESSON', 'START', { workKind: 'ASSESSMENT' }),
      LEARNER,
      'assignment:exact',
    )).toBeNull()
  })
})
