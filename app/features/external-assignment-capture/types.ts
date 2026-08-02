export type CaptureViewerRole = 'parent' | 'student'

export type CaptureStep = 'capture' | 'review' | 'schedule' | 'evidence' | 'approval'

export type IntakeMode = 'manual' | 'document'

export type ProposalFieldKey =
  | 'providerName'
  | 'providerAssignmentReference'
  | 'externalCourseName'
  | 'externalSectionName'
  | 'manuelCourseName'
  | 'assignmentTitle'
  | 'dueDate'
  | 'dueTime'
  | 'timeZone'
  | 'instructions'
  | 'rubric'
  | 'evidenceRequirement'

export type ProposalInputKind = 'text' | 'date' | 'time' | 'textarea' | 'timezone' | 'evidence'

export interface ProposalSourceEvidence {
  kind: 'manual-entry' | 'document-text' | 'document-layout' | 'provider-metadata'
  attachmentId?: string
  page?: number
  region?: string
  excerpt: string
}

export interface ReviewableProposalField {
  key: ProposalFieldKey
  label: string
  value: string
  required: boolean
  inputKind: ProposalInputKind
  /**
   * Extraction confidence from 0 to 1. It is null for a field supplied directly
   * by a person. Confidence is never treated as confirmation.
   */
  confidence: number | null
  sourceEvidence: ProposalSourceEvidence[]
  confirmed: boolean
}

export interface CaptureAttachmentMetadata {
  id: string
  fileName: string
  mediaType: string
  byteSize: number
  pageCount?: number
  capturedAt: string
  /**
   * The UI records metadata only. The host controls storage and must not treat
   * this as evidence that a file was uploaded or retained.
   */
  storageStatus: 'browser-only' | 'accepted-by-host'
}

export interface ExternalAssignmentProposal {
  proposalId: string
  providerId: string
  providerKind: 'manual' | 'provisional-adapter' | 'authorized-adapter'
  originalProviderIdentity: string
  fields: ReviewableProposalField[]
  sourceAttachments: CaptureAttachmentMetadata[]
  extractionStatus: 'manual' | 'proposed' | 'failed'
  createdByRole: CaptureViewerRole
  createdAt: string
}

export type ExtractionFailureCode =
  | 'missing-file'
  | 'unsupported-file'
  | 'empty-file'
  | 'unreadable-image'
  | 'encrypted-document'
  | 'extractor-unavailable'

export type ExtractionOutcome =
  | {
      ok: true
      proposal: ExternalAssignmentProposal
      warnings: string[]
    }
  | {
      ok: false
      code: ExtractionFailureCode
      message: string
      canUseManualFallback: true
      attachment?: CaptureAttachmentMetadata
    }

export interface ExtractionRequest {
  file: File
  providerId: string
  providerDisplayName: string
  viewerRole: CaptureViewerRole
  timeZone: string
}

export type DuplicateScenario = 'none' | 'exact' | 'provider-update' | 'conflict'

export type DuplicateCheckResult =
  | { kind: 'none' }
  | {
      kind: 'exact-duplicate'
      existingAssignmentId: string
      explanation: string
      matchedOn: string[]
    }
  | {
      kind: 'provider-update'
      existingAssignmentId: string
      explanation: string
      changedFields: Array<{
        field: ProposalFieldKey
        existingValue: string
        proposedValue: string
      }>
    }
  | {
      kind: 'conflict'
      existingAssignmentId: string
      explanation: string
      conflicts: Array<{
        field: ProposalFieldKey
        existingValue: string
        proposedValue: string
      }>
    }

export type DuplicateResolution =
  | { kind: 'not-needed' }
  | { kind: 'use-existing' }
  | { kind: 'apply-provider-update' }
  | { kind: 'keep-existing' }
  | { kind: 'create-separate'; reason: string }

export interface ConfirmedAssignmentInput {
  proposal: ExternalAssignmentProposal
  confirmedValues: Record<ProposalFieldKey, string>
  duplicateCheck: DuplicateCheckResult
  duplicateResolution: DuplicateResolution
  requestedByRole: CaptureViewerRole
}

export interface ScheduleResult {
  assignmentId: string
  operation: 'created' | 'updated' | 'reused-existing'
  scheduledAt: string
}

export type EvidenceRequirement = 'file' | 'link' | 'file-or-link' | 'none'

export interface CompletionEvidenceInput {
  assignmentId: string
  submittedByRole: CaptureViewerRole
  note: string
  link?: string
  file?: File
  fileMetadata?: CaptureAttachmentMetadata
  submittedAt: string
}

export interface EvidenceSubmissionResult {
  evidenceId: string
  status: 'awaiting-parent'
  submittedAt: string
}

export type ParentEvidenceDecision =
  | { decision: 'approve'; note?: string }
  | { decision: 'return'; reason: string }

export interface ParentEvidenceReviewInput {
  assignmentId: string
  evidenceId: string
  reviewerRole: 'parent'
  reviewedAt: string
  result: ParentEvidenceDecision
}

export interface ParentEvidenceReviewResult {
  assignmentStatus: 'complete' | 'evidence-returned'
  reviewedAt: string
}

export interface ProviderSyncStatus {
  providerId: string
  connection: 'manual-only' | 'not-authorized' | 'authorized'
  state: 'idle' | 'pending' | 'synchronized' | 'attention-needed'
  label: string
  detail: string
  lastAttemptAt?: string
  lastSuccessfulSyncAt?: string
}

export interface ExternalAssignmentCaptureController {
  extractDocument?(request: ExtractionRequest): Promise<ExtractionOutcome>
  checkForDuplicate?(
    proposal: ExternalAssignmentProposal,
    demoScenario?: DuplicateScenario,
  ): Promise<DuplicateCheckResult>
  scheduleAssignment?(input: ConfirmedAssignmentInput): Promise<ScheduleResult>
  submitEvidence?(input: CompletionEvidenceInput): Promise<EvidenceSubmissionResult>
  reviewEvidence?(input: ParentEvidenceReviewInput): Promise<ParentEvidenceReviewResult>
  getProviderSyncStatus?(providerId: string): Promise<ProviderSyncStatus>
}

export interface ExternalAssignmentCaptureProps {
  controller?: ExternalAssignmentCaptureController
  initialRole?: CaptureViewerRole
  initialTimeZone?: string
  studentDisplayName?: string
  onClose?: () => void
}
