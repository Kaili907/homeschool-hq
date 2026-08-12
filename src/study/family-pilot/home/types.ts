export type FamilyPilotHomeAssignmentStatus = 'not-started' | 'in-progress' | 'completed'

export interface FamilyPilotHomeAssignment {
  readonly assignmentRef: string
  readonly title: string
  readonly subject?: string
  readonly status: FamilyPilotHomeAssignmentStatus
}

export interface FamilyPilotHomeStudent {
  /** Safe display label only — never an internal id, email, or other PII. */
  readonly displayName: string
  readonly avatarInitial?: string
}

export interface FamilyPilotHomeTutorAvailability {
  readonly available: boolean
  /** Shown when help isn't available right now. */
  readonly reason?: string
}

export interface FamilyPilotHomeHold {
  readonly active: boolean
  readonly reason?: string
}

export interface FamilyPilotHomeCallbacks {
  readonly onStartAssignment: (assignmentRef: string) => void
  readonly onResumeAssignment: (assignmentRef: string) => void
  readonly onOpenTutor: () => void
  readonly onOpenAssignments: () => void
  readonly onSwitchStudent: () => void
}

export interface FamilyPilotHomeProps extends FamilyPilotHomeCallbacks {
  readonly student: FamilyPilotHomeStudent
  /** Must already be scoped to this student only by the caller. */
  readonly todayAssignments: readonly FamilyPilotHomeAssignment[]
  readonly inProgressAssignment?: FamilyPilotHomeAssignment | null
  readonly completedTodayCount: number
  readonly tutorAvailability?: FamilyPilotHomeTutorAvailability | null
  readonly hold?: FamilyPilotHomeHold | null
  readonly loading?: boolean
  readonly error?: string | null
}
