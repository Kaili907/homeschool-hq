import { describe, expect, it } from 'vitest'
import type { FamilyPilotStudentDashboardModel } from '../dashboard-adapter'
import { toStudentDashboardPresentation } from './dashboardPresentation'

function dashboardModel(): FamilyPilotStudentDashboardModel {
  return {
    learner: {
      studentRef: 'student:authorized',
      displayName: 'Authorized Learner',
      avatarInitial: 'A',
      nominalGrade: '7',
      greeting: 'Welcome, Authorized Learner',
    },
    today: {
      date: '2026-08-14',
      state: 'SCHEDULED',
      emptyReason: null,
      scheduledCount: 2,
      omittedCount: 0,
      academicCount: 2,
      completedAcademicCount: 0,
      items: [
        {
          scheduleItemRef: 'schedule:continue',
          assignmentRef: 'assignment:continue-exact',
          kind: 'LESSON',
          title: 'Exact saved lesson',
          subject: 'mathematics',
          courseRef: 'ma-g5-mathematics',
          workingGrade: '5',
          date: '2026-08-14',
          timing: 'TODAY',
          status: 'IN_PROGRESS',
          blocked: null,
          action: {
            type: 'CONTINUE',
            studentRef: 'student:authorized',
            assignmentRef: 'assignment:continue-exact',
            workKind: 'LESSON',
          },
        },
        {
          scheduleItemRef: 'schedule:waiting',
          assignmentRef: 'assessment:waiting-exact',
          kind: 'ASSESSMENT',
          title: 'Trusted assessment',
          subject: 'science',
          courseRef: 'ma-g7-science',
          workingGrade: '7',
          date: '2026-08-14',
          timing: 'TODAY',
          status: 'WAITING',
          blocked: { kind: 'ASSESSMENT_SCORING_PENDING', message: 'Trusted scoring is pending.' },
          action: null,
        },
      ],
    },
    courses: [
      {
        subject: 'mathematics',
        workingGrade: '5',
        curriculumStatus: 'AVAILABLE',
        courseRef: 'ma-g5-mathematics',
        title: 'Grade 5 Mathematics',
        assignedLessons: 0,
        completedLessons: 0,
        totalLessons: 0,
        requiredAssessments: 0,
        completionPercent: null,
        completionStatus: 'NOT_STARTED',
        completionDate: null,
        nextCourseOptions: [],
        currentUnit: null,
        assessmentsAssigned: 0,
        assessmentsCertified: 0,
        assessmentStatus: 'NONE',
        action: { type: 'OPEN_COURSE', studentRef: 'student:authorized', courseRef: 'ma-g5-mathematics' },
      },
    ],
    progressSummary: {
      lessonsAssigned: 1,
      lessonsCompleted: 0,
      assessmentsAssigned: 1,
      assessmentsCertified: 0,
      recentCompletions: [],
    },
    upcoming: [],
    alerts: [],
    tools: [
      { kind: 'SCHEDULE', action: { type: 'OPEN_SCHEDULE', studentRef: 'student:authorized' } },
      { kind: 'REPORTS', action: { type: 'OPEN_REPORTS', studentRef: 'student:authorized' } },
      { kind: 'ASSIGNMENTS', action: { type: 'OPEN_ASSIGNMENTS', studentRef: 'student:authorized' } },
    ],
    jarvis: {
      mode: 'VISUAL_ONLY',
      status: 'STATIC_HELP_AVAILABLE',
      tutorCapability: 'NOT_CONNECTED',
      interactive: false,
      staticHelpAvailable: true,
    },
    actions: { signOut: { type: 'SIGN_OUT', studentRef: 'student:authorized' } },
  }
}

describe('Family Pilot dashboard presentation convergence', () => {
  it('preserves the exact assignment ref and accepted Start/Continue vocabulary', () => {
    const model = toStudentDashboardPresentation(dashboardModel())
    expect(model.mission).toMatchObject({
      state: 'continue-lesson',
      workRef: 'assignment:continue-exact',
      actionLabel: 'Continue lesson',
    })
    expect(model.todayItems[0]).toMatchObject({
      workRef: 'assignment:continue-exact',
      actionLabel: 'Continue',
      actionable: true,
    })
    expect(model.todayItems[1]).toMatchObject({
      workRef: 'assessment:waiting-exact',
      state: 'blocked',
      actionable: false,
    })
  })

  it('does not fabricate a percentage when no assignment denominator exists', () => {
    const course = toStudentDashboardPresentation(dashboardModel()).courses[0]
    expect(course).toMatchObject({ completionPercent: null, progressLabel: 'No assigned work yet' })
  })

  it('projects only the supplied learner identity, courses, schedule, and tools', () => {
    const serialized = JSON.stringify(toStudentDashboardPresentation(dashboardModel()))
    expect(serialized).toContain('Authorized Learner')
    expect(serialized).toContain('ma-g5-mathematics')
    expect(serialized).not.toContain('sibling')
    expect(serialized).not.toMatch(/correctAnswer|answerKey|pinDigest|transcript/i)
  })

  it('shows the exact factual Course complete state on a terminal course card', () => {
    const source = dashboardModel()
    const complete: FamilyPilotStudentDashboardModel = {
      ...source,
      courses: [{
        ...source.courses[0],
        assignedLessons: 2,
        completedLessons: 2,
        totalLessons: 2,
        requiredAssessments: 1,
        assessmentsAssigned: 1,
        assessmentsCertified: 1,
        completionPercent: 100,
        completionStatus: 'COMPLETE',
        completionDate: '2026-08-14T13:00:00.000Z',
      }],
    }
    expect(toStudentDashboardPresentation(complete).courses[0]).toMatchObject({
      completionPercent: 100,
      progressLabel: 'Course complete',
      completed: 3,
      total: 3,
    })
  })
})
