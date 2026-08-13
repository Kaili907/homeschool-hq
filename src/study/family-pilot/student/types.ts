export type AssignmentStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'

export type AssignmentSessionState = 'active' | 'paused'

export interface StudentSegment {
  readonly segmentRef: string
  readonly title: string
  readonly estimatedMinutes?: number
}

export interface StudentAssignment {
  readonly assignmentRef: string
  readonly title: string
  readonly subject?: string
  readonly status: AssignmentStatus
  /** Only meaningful when status is IN_PROGRESS. */
  readonly sessionState?: AssignmentSessionState
  readonly segments: readonly StudentSegment[]
  readonly currentSegmentRef?: string | null
  readonly completedSegmentRefs?: readonly string[]
}

export interface StudentProfile {
  /** Safe display label only — never an internal id, email, or other PII. */
  readonly displayName: string
  readonly avatarInitial?: string
}

export interface StudentExperienceCallbacks {
  readonly onStart: (assignmentRef: string) => void
  readonly onResume: (assignmentRef: string) => void
  readonly onPause: (assignmentRef: string) => void
  readonly onComplete: (assignmentRef: string) => void
  readonly onExit: (assignmentRef: string) => void
}

export interface StudentExperienceProps extends StudentExperienceCallbacks {
  readonly student: StudentProfile
  /** Must already be scoped to this student only by the caller. */
  readonly assignments: readonly StudentAssignment[]
  readonly loading?: boolean
  readonly error?: string | null
  /**
   * True while a Study action or a Tutor turn is in flight for this learner.
   * Disables Pause/Finish so a click can't race a mutation already underway
   * or a safety classification still pending — defense in depth alongside
   * the authoritative controller-level gating.
   */
  readonly actionsDisabled?: boolean
}
