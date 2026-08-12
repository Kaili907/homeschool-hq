import type { StudySubject } from '../../types'

/**
 * First-party, plain typed contracts for the family-pilot Parent
 * assignment-control UI. This module is a host-driven view/action surface:
 * it owns no fetching and no persistence, and it does not import the
 * Assignment Planner (src/study/family-pilot/assignments/**). The host
 * supplies every value below as props and receives intent back through the
 * callbacks in FamilyPilotParentAssignCallbacks.
 */

export interface FamilyPilotAssignStudent {
  readonly studentRef: string
  readonly displayName: string
  readonly nominalGrade: number
}

export interface FamilyPilotAssignLesson {
  readonly lessonRef: string
  readonly title: string
  readonly subject: StudySubject
  readonly grade: number
}

export type FamilyPilotAssignmentStatus = 'not-started' | 'in-progress' | 'paused' | 'completed' | 'skipped'

export interface FamilyPilotAssignment {
  readonly assignmentRef: string
  readonly studentRef: string
  readonly lessonRef: string
  readonly lessonTitle: string
  readonly subject: StudySubject
  readonly status: FamilyPilotAssignmentStatus
  readonly optional: boolean
}

export interface FamilyPilotWorkingGradeEntry {
  readonly subject: StudySubject
  readonly grade: number
}

export interface FamilyPilotParentAssignCallbacks {
  readonly onAssignLesson: (studentRef: string, lessonRef: string) => void | Promise<void>
  readonly onResumeAssignment: (studentRef: string, assignmentRef: string) => void | Promise<void>
  readonly onSkipAssignment?: (studentRef: string, assignmentRef: string) => void | Promise<void>
  readonly onChangeWorkingGrade?: (studentRef: string, subject: StudySubject, grade: number) => void | Promise<void>
}
