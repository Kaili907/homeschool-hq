export type StudentId = string
export type RecoveryProposalId = string
export type RecoveryAuditEntryId = string
export type IsoDate = string

export type RecoveryChoice =
  | 'move-to-tomorrow'
  | 'shorten-today'
  | 'split-sessions'
  | 'move-to-catch-up-block'
  | 'replace-lower-priority-review'
  | 'keep-due-date-rebalance-week'
  | 'parent-manual'
  | 'leave-unchanged'

export type RecoveryTrigger =
  | 'missed'
  | 'interrupted'
  | 'shortened'
  | 'overdue'
  | 'focus-difficulty'

export type ActivityCategory =
  | 'academic-assignment'
  | 'romeo-virtual-academy'
  | 'manuel-academy-lesson'
  | 'adaptive-tutor-intervention'
  | 'ready-for-life'
  | 'wrestling'
  | 'jiu-jitsu'
  | 'weight-training'
  | 'pe-activity'
  | 'appointment'
  | 'meal'
  | 'movement-break'
  | 'focus-recovery-break'
  | 'parent-created-activity'

export type ProposalStatus = 'pending' | 'approved' | 'overridden' | 'undone'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type ConflictStatus = 'open' | 'resolved-by-proposal' | 'protected'

export interface RecoveryChoiceMetadata {
  id: RecoveryChoice
  label: string
  shortLabel: string
  description: string
}

export interface StudentSummary {
  id: StudentId
  name: string
  initials: string
  gradeLabel: string
  accent: 'violet' | 'blue' | 'teal' | 'coral'
}

export interface SchedulePlacement {
  date: IsoDate
  startTime: string
  durationMinutes: number
  label?: string
}

export interface RecoveryChange {
  id: string
  title: string
  category: ActivityCategory
  kind: 'moved' | 'shortened' | 'split' | 'replaced' | 'unchanged'
  before: SchedulePlacement[]
  after: SchedulePlacement[]
  isRequiredWork: boolean
  isFixedOrLocked: boolean
}

export interface WorkloadDay {
  date: IsoDate
  beforeMinutes: number
  proposedMinutes: number
  limitMinutes: number
  protectedMinutes: number
  overloadPrevented?: boolean
}

export interface ConflictIndicator {
  id: string
  studentId: StudentId
  title: string
  detail: string
  severity: RiskLevel
  status: ConflictStatus
}

export interface DueDateRisk {
  id: string
  studentId: StudentId
  title: string
  detail: string
  dueAt: string
  level: RiskLevel
}

export interface RecoveryOptionView {
  choice: RecoveryChoice
  summary: string
  tradeoff: string
  permitted: boolean
  unavailableReason?: string
  parentApprovalRequired: boolean
  workloadDeltaMinutes: {
    today: number
    tomorrow: number
    week: number
  }
}

export interface StudentFriendlyExplanation {
  headline: string
  changed: string
  why: string
  tradeoff: string
  reassurance: string
}

export interface RecoveryProposalView {
  id: RecoveryProposalId
  studentId: StudentId
  status: ProposalStatus
  trigger: RecoveryTrigger
  title: string
  sourceLabel: string
  createdAt: string
  dueAt?: string
  priorityLabel: string
  reason: string
  tradeoff: string
  requiredWorkPreserved: boolean
  recommendedChoice: RecoveryChoice
  decidedChoice?: RecoveryChoice
  decisionNote?: string
  options: RecoveryOptionView[]
  changes: RecoveryChange[]
  workloadPreview: WorkloadDay[]
  conflictIds: string[]
  riskIds: string[]
  studentExplanation: StudentFriendlyExplanation
}

export interface CalendarItemView {
  id: string
  studentId: StudentId
  date: IsoDate
  startTime: string
  durationMinutes: number
  title: string
  category: ActivityCategory
  state: 'unchanged' | 'added' | 'moved' | 'shortened' | 'protected'
  isFixedOrLocked: boolean
}

export interface RecoveryAuditEntryView {
  id: RecoveryAuditEntryId
  proposalId: RecoveryProposalId
  studentId: StudentId
  occurredAt: string
  actorLabel: string
  action: 'approved' | 'overridden' | 'manually-placed' | 'undone'
  summary: string
  reason?: string
  reversible: boolean
}

export interface RecoverySafeguards {
  sleepProtected: boolean
  mealsProtected: boolean
  parentLockedTimeProtected: boolean
  requiredWorkRemovalRequiresApproval: boolean
  followingDayOverloadBlocked: boolean
}

export interface ScheduleRecoveryViewModel {
  generatedAt: string
  timeZone: string
  students: StudentSummary[]
  proposals: RecoveryProposalView[]
  conflicts: ConflictIndicator[]
  dueDateRisks: DueDateRisk[]
  calendarItems: CalendarItemView[]
  auditHistory: RecoveryAuditEntryView[]
  safeguards: RecoverySafeguards
}

export interface ApproveRecoveryInput {
  proposalId: RecoveryProposalId
  choice: RecoveryChoice
}

export interface OverrideRecoveryInput extends ApproveRecoveryInput {
  reason: string
}

export interface ManualRecoveryInput {
  proposalId: RecoveryProposalId
  date: IsoDate
  startTime: string
  durationMinutes: number
  reason: string
}

export interface UndoRecoveryInput {
  proposalId: RecoveryProposalId
  auditEntryId: RecoveryAuditEntryId
}

export interface ScheduleRecoveryHandlers {
  onApprove: (input: ApproveRecoveryInput) => void
  onOverride: (input: OverrideRecoveryInput) => void
  onManualPlacement: (input: ManualRecoveryInput) => void
  onUndo: (input: UndoRecoveryInput) => void
}

export type ScheduleRecoveryAdapter<TSource> = (
  source: TSource,
) => ScheduleRecoveryViewModel

export type DemoRecoveryAction =
  | { type: 'approve'; input: ApproveRecoveryInput }
  | { type: 'override'; input: OverrideRecoveryInput }
  | { type: 'manual'; input: ManualRecoveryInput }
  | { type: 'undo'; input: UndoRecoveryInput }
