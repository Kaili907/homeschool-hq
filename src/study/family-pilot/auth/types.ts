import type { StudyLearnerSelector } from '../../contracts/identity/session'

/** A selector only — this module never resolves it to Study session/assignment state itself. */
export type FamilyPilotStudentRef = StudyLearnerSelector

export interface FamilyPilotStudentProfile {
  readonly studentRef: FamilyPilotStudentRef
  /** Safe display label only — never an internal id, email, or other PII. */
  readonly displayName: string
  readonly avatarInitial?: string
  /** Whether this profile requires a PIN before it can become active. */
  readonly pinRequired?: boolean
}

export interface FamilyPilotStudentLoginCallbacks {
  /** Fired when a student card is picked, before any PIN check or confirmation. */
  readonly onSelectStudent: (studentRef: FamilyPilotStudentRef) => void
  /** Validate a PIN for the given student. Return true to accept, false to reject. Omit if no student requires a PIN. */
  readonly onVerifyPin?: (studentRef: FamilyPilotStudentRef, pin: string) => boolean
  /** Fired once the student is confirmed active (no PIN required, or PIN accepted). */
  readonly onAuthenticated: (studentRef: FamilyPilotStudentRef) => void
  readonly onLogout: () => void
  readonly onSwitchStudent: () => void
  /** Ask a parent to reset this student's PIN. Omit if PIN recovery isn't wired up yet. */
  readonly onParentRecover?: (studentRef: FamilyPilotStudentRef) => void
}

export interface FamilyPilotStudentLoginProps extends FamilyPilotStudentLoginCallbacks {
  readonly students: readonly FamilyPilotStudentProfile[]
  /** Controlled by the host — this component never decides who is active on its own. */
  readonly activeStudentRef: FamilyPilotStudentRef | null
  readonly loading?: boolean
  readonly error?: string | null
}
