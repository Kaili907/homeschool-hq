// Reusable page-object steps for the supervised family-pilot success path:
//   student login -> student dashboard -> assigned Grade 5 Math work ->
//   open lesson -> visible lesson content -> progress action -> return/resume
//
// The student-login and student-dashboard surfaces are owned by the Mac
// Student track and are not present on this branch's base yet. Per this
// session's brief ("Do not invent selectors for unfinished UI"), every step
// below that depends on that surface throws WAITING_ON_MAC_STUDENT_OUTPUT
// instead of guessing a selector. Once the Mac Student surface lands, fill in
// the marked selector/route and delete the corresponding throw.
import type { Page } from '@playwright/test'

export const WAITING_ON_MAC_STUDENT_OUTPUT = 'WAITING_ON_MAC_STUDENT_OUTPUT'

function pending(step: string): never {
  throw new Error(
    `${WAITING_ON_MAC_STUDENT_OUTPUT}: ${step} has no selector/route yet — ` +
      'see tests/family-pilot/browser/WAITING_ON_MAC_STUDENT_OUTPUT.md',
  )
}

export class PilotFlow {
  constructor(private readonly page: Page) {}

  // Expected route: WAITING_ON_MAC_STUDENT_OUTPUT
  async studentLogin(_studentName: string): Promise<void> {
    pending('student login')
  }

  // Expected route: WAITING_ON_MAC_STUDENT_OUTPUT
  async expectStudentDashboard(): Promise<void> {
    pending('student dashboard')
  }

  // Expected selector for the Grade 5 Math assignment card: WAITING_ON_MAC_STUDENT_OUTPUT
  async openAssignedGrade5Math(): Promise<void> {
    pending('assigned Grade 5 Math work')
  }

  // Expected selector for lesson content: WAITING_ON_MAC_STUDENT_OUTPUT
  async expectLessonContentVisible(): Promise<void> {
    pending('visible lesson content')
  }

  // Expected selector for the progress/complete action: WAITING_ON_MAC_STUDENT_OUTPUT
  async takeProgressAction(): Promise<void> {
    pending('progress action')
  }

  // Expected route/selector for return-to-dashboard and resume: WAITING_ON_MAC_STUDENT_OUTPUT
  async returnAndResume(): Promise<void> {
    pending('return/resume')
  }
}
