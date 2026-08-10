export const CURRICULUM_APPROVAL_SCHEMA_VERSION = 1 as const
export const CURRICULUM_APPROVAL_CAPABILITY = 'curriculum:approve' as const

export const CURRICULUM_APPROVAL_DECISIONS = ['approved', 'changes_requested'] as const
export type CurriculumApprovalDecision = (typeof CURRICULUM_APPROVAL_DECISIONS)[number]

export const CURRICULUM_APPROVAL_REASON_CODES = [
  'approval.ready',
  'changes.validation',
  'changes.standards',
  'changes.content_quality',
  'changes.references',
  'changes.accessibility',
  'changes.safety_privacy',
  'changes.other',
] as const
export type CurriculumApprovalReasonCode = (typeof CURRICULUM_APPROVAL_REASON_CODES)[number]

export type CurriculumApprovalStatus =
  | 'pending_review'
  | 'approved'
  | 'changes_requested'
  | 'stale'

export interface CurriculumValidationSnapshotSummary {
  readonly validationSnapshotId: string
  readonly draftRevision: number
  readonly engineVersion: string
  readonly resultDigest: string
  readonly status: 'valid' | 'invalid' | 'incomplete' | 'unavailable' | 'error'
  readonly publicationReady: boolean
  readonly blockingCount: number
  readonly blockingErrorCount: number
  readonly humanReviewBlockerCount: number
  readonly validatedAt: string
}

export interface CurriculumApprovalHistoryEntry {
  readonly approvalId: string
  readonly draftRevision: number
  readonly decision: CurriculumApprovalDecision
  readonly reasonCode: CurriculumApprovalReasonCode
  readonly validationSnapshotId: string | null
  readonly validationResultDigest: string | null
  readonly reviewerRole: 'owner'
  readonly decidedAt: string
  readonly bindingStatus: 'current' | 'superseded'
}

export type CurriculumApprovalPublishGateReason =
  | 'approved'
  | 'approval_missing'
  | 'approval_stale'
  | 'changes_requested'
  | 'validation_missing'
  | 'validation_blocked'

export interface CurriculumApprovalStatusResult {
  readonly schemaVersion: typeof CURRICULUM_APPROVAL_SCHEMA_VERSION
  readonly draftId: string
  readonly draftRevision: number
  readonly baseReleaseVersion: string
  readonly targetVersion: string
  readonly schemaSetVersion: string
  readonly status: CurriculumApprovalStatus
  readonly latestValidation: CurriculumValidationSnapshotSummary | null
  readonly currentDecision: CurriculumApprovalHistoryEntry | null
  readonly staleApproval: CurriculumApprovalHistoryEntry | null
  readonly history: readonly CurriculumApprovalHistoryEntry[]
  /** Machine-readable seam for later release staging. It does not stage or publish. */
  readonly publishGate: {
    readonly eligible: boolean
    readonly reason: CurriculumApprovalPublishGateReason
    readonly approvalId: string | null
    readonly draftRevision: number
    readonly validationSnapshotId: string | null
  }
}

export interface CurriculumApprovalDecisionInput {
  readonly draftId: string
  readonly draftRevision: number
  readonly decision: CurriculumApprovalDecision
  readonly reasonCode: CurriculumApprovalReasonCode
  readonly validationSnapshotId: string | null
  readonly idempotencyKey: string
}

export interface CurriculumApprovalMutationResult extends CurriculumApprovalStatusResult {
  readonly replayed: boolean
}

export interface CurriculumApprovalSource {
  readApproval(draftId: string): Promise<CurriculumApprovalStatusResult>
  decideApproval(input: CurriculumApprovalDecisionInput): Promise<CurriculumApprovalMutationResult>
}

export class CurriculumApprovalError extends Error {
  readonly code: 'unauthenticated' | 'forbidden' | 'invalid' | 'conflict' | 'not-found' | 'unavailable'
  readonly reason?: 'revision-conflict' | 'idempotency-conflict' | 'validation-blocked' | 'decision-conflict'

  constructor(code: CurriculumApprovalError['code'], reason?: CurriculumApprovalError['reason']) {
    super(code)
    this.name = 'CurriculumApprovalError'
    this.code = code
    this.reason = reason
  }
}
