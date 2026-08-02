/**
 * Manuel Academy AI Safety Center contracts.
 *
 * These contracts deliberately do not import the existing tutor or identity
 * implementation. The host must adapt its authenticated identity and tutor data
 * at the boundary. IDs remain opaque strings so legacy profile IDs can be used
 * without copying names, email addresses, or other identity data.
 */

export const AI_SAFETY_SCHEMA_VERSION = 1 as const
export type AiSafetySchemaVersion = typeof AI_SAFETY_SCHEMA_VERSION

export type IsoDate = string
export type IsoDateTime = string
export type IanaTimeZone = string
export type OpaqueId = string

export type SafetyCenterRole = 'student' | 'parent' | 'reviewer' | 'system' | 'tutor'
export type AgeBand = 'under-8' | '8-12' | '13-17'
export type TutorChannel = 'text' | 'voice'

export const PARENT_REVIEW_NOTICE =
  'A parent can review tutor conversations and safety events for students they are authorized to support.'
export const SAFETY_EXCEPTION_NOTICE =
  'Student messages are not promised to be private. A safety concern may be shared with an authorized parent or human reviewer.'
export const RAW_AUDIO_NOTICE =
  'Voice may be converted to text for the tutor, but raw microphone recordings are not stored by the Safety Center.'

export interface ContractEnvelope {
  readonly schemaVersion: AiSafetySchemaVersion
  readonly createdAt: IsoDateTime
}

export interface SubjectReference {
  readonly subjectId: OpaqueId
  /** Parent/student display label; it must not contain a student's name. */
  readonly displayName: string
}

export interface ConversationSessionMetadata extends ContractEnvelope {
  readonly kind: 'conversation-session'
  readonly sessionId: OpaqueId
  readonly studentId: OpaqueId
  readonly subject: SubjectReference
  readonly ageBand: AgeBand
  readonly channel: TutorChannel
  readonly startedAt: IsoDateTime
  readonly endedAt?: IsoDateTime
  readonly status: 'active' | 'completed' | 'paused-for-safety' | 'student-blocked' | 'technical-stop'
  readonly timeZone: IanaTimeZone
  readonly policyVersion: string
  readonly transcriptMode: 'text-only' | 'not-retained'
  readonly rawMicrophoneRecordingStored: false
  readonly parentReviewScope: 'authorized-parent-and-student'
  readonly safetyExceptionApplies: true
}

export type TimelineSpeaker = 'student' | 'tutor' | 'system'

export interface TimelineEntryBase {
  readonly entryId: OpaqueId
  readonly at: IsoDateTime
  readonly sequence: number
}

export interface ConversationTimelineEntry extends TimelineEntryBase {
  readonly type: 'message'
  readonly speaker: TimelineSpeaker
  readonly text: string
}

export interface TutorHelpTimelineEntry extends TimelineEntryBase {
  readonly type: 'tutor-help'
  readonly helpKind: 'question' | 'hint' | 'worked-step' | 'refusal'
  readonly displayText: string
  readonly playback: {
    readonly mode: 'text-only' | 'text-to-speech-on-demand'
    readonly rawAudioStored: false
  }
}

export interface WithheldTimelineEntry extends TimelineEntryBase {
  readonly type: 'answer-withheld'
  readonly reason: WithheldReason
  readonly explanation: string
  readonly safetyEventId?: OpaqueId
}

export interface SafetyMarkerTimelineEntry extends TimelineEntryBase {
  readonly type: 'safety-marker'
  readonly safetyEventId: OpaqueId
  readonly label: string
}

export type TutorTimelineEntry =
  | ConversationTimelineEntry
  | TutorHelpTimelineEntry
  | WithheldTimelineEntry
  | SafetyMarkerTimelineEntry

/**
 * Instructional history is stored separately from SafetyEvent. It may contain
 * the minimum text needed for parent review and learning continuity, but never
 * raw microphone recordings or hidden reviewer notes.
 */
export interface InstructionalHistoryRecord extends ContractEnvelope {
  readonly kind: 'instructional-history'
  readonly historyId: OpaqueId
  readonly sessionId: OpaqueId
  readonly studentId: OpaqueId
  readonly subject: SubjectReference
  readonly startedAt: IsoDateTime
  readonly endedAt?: IsoDateTime
  readonly parentVisibleSummary: string
  readonly searchableKeywords: readonly string[]
  readonly timeline: readonly TutorTimelineEntry[]
  readonly rawMicrophoneRecordingStored: false
  readonly retentionClass: 'instructional'
}

export type SafetyClassification =
  | 'answer-integrity'
  | 'academic-integrity'
  | 'age-inappropriate-content'
  | 'dangerous-activity'
  | 'harassment-or-hate'
  | 'medical-boundary'
  | 'legal-boundary'
  | 'potential-self-harm'
  | 'potential-immediate-danger'
  | 'potential-abuse-or-unsafe-situation'
  | 'privacy-or-personal-data'
  | 'prompt-injection'
  | 'restricted-subject'
  | 'sexual-content'
  | 'violent-content'
  | 'student-report'
  | 'student-block'
  | 'model-policy-failure'
  | 'access-control'

export type SafetySeverity = 'info' | 'low' | 'moderate' | 'high' | 'critical'

export type EscalationLevel =
  | 'none'
  | 'record-for-parent'
  | 'parent-review'
  | 'urgent-parent-attention'
  | 'human-safety-review'

export type WithheldReason =
  | 'direct-answer-request'
  | 'answer-leak-detected'
  | 'restricted-subject'
  | 'outside-allowed-time'
  | 'daily-session-limit'
  | 'session-time-limit'
  | 'permission-disabled'
  | 'voice-input-disabled'
  | 'safety-concern'
  | 'privacy-request'
  | 'harmful-instructions'
  | 'age-inappropriate'
  | 'prompt-injection'
  | 'student-blocked'
  | 'human-review-required'
  | 'history-unavailable'

/** Runtime vocabularies for dependency-neutral UI and persistence adapters. */
export const AGE_BAND_VALUES = ['under-8', '8-12', '13-17'] as const satisfies readonly AgeBand[]
export const SAFETY_CLASSIFICATION_VALUES = [
  'answer-integrity',
  'academic-integrity',
  'age-inappropriate-content',
  'dangerous-activity',
  'harassment-or-hate',
  'medical-boundary',
  'legal-boundary',
  'potential-self-harm',
  'potential-immediate-danger',
  'potential-abuse-or-unsafe-situation',
  'privacy-or-personal-data',
  'prompt-injection',
  'restricted-subject',
  'sexual-content',
  'violent-content',
  'student-report',
  'student-block',
  'model-policy-failure',
  'access-control',
] as const satisfies readonly SafetyClassification[]
export const SAFETY_SEVERITY_VALUES = [
  'info',
  'low',
  'moderate',
  'high',
  'critical',
] as const satisfies readonly SafetySeverity[]
export const ESCALATION_LEVEL_VALUES = [
  'none',
  'record-for-parent',
  'parent-review',
  'urgent-parent-attention',
  'human-safety-review',
] as const satisfies readonly EscalationLevel[]
export const WITHHELD_REASON_VALUES = [
  'direct-answer-request',
  'answer-leak-detected',
  'restricted-subject',
  'outside-allowed-time',
  'daily-session-limit',
  'session-time-limit',
  'permission-disabled',
  'voice-input-disabled',
  'safety-concern',
  'privacy-request',
  'harmful-instructions',
  'age-inappropriate',
  'prompt-injection',
  'student-blocked',
  'human-review-required',
  'history-unavailable',
] as const satisfies readonly WithheldReason[]

export interface SafetyEventBase extends ContractEnvelope {
  readonly eventId: OpaqueId
  readonly sessionId: OpaqueId
  readonly studentId: OpaqueId
  readonly subjectId: OpaqueId
  readonly occurredAt: IsoDateTime
  readonly classification: SafetyClassification
  readonly severity: SafetySeverity
  readonly escalation: EscalationLevel
  /** Short, neutral, parent-visible summary. Never a diagnosis. */
  readonly summary: string
  /** Opaque turn/timeline IDs only; raw text is not duplicated into an event. */
  readonly evidenceRefs: readonly OpaqueId[]
  readonly detector: 'local-policy' | 'model-output-check' | 'student' | 'parent' | 'reviewer'
  readonly parentVisible: true
  readonly rawMicrophoneRecordingStored: false
}

export interface AnswerWithheldSafetyEvent extends SafetyEventBase {
  readonly kind: 'answer-withheld-event'
  readonly withheldReason: WithheldReason
  readonly studentExplanation: string
  readonly canContinueLearning: boolean
}

export interface EmergencyLanguageSafetyEvent extends SafetyEventBase {
  readonly kind: 'emergency-language-event'
  readonly classification:
    | 'potential-self-harm'
    | 'potential-immediate-danger'
    | 'potential-abuse-or-unsafe-situation'
  readonly severity: 'critical'
  readonly escalation: 'human-safety-review'
  readonly sessionAction: 'pause-and-seek-trusted-adult'
  /**
   * A protocol identifier, not a claim that emergency services were contacted.
   * This package intentionally contains no hotline or emergency-service data.
   */
  readonly responseProtocol: 'trusted-adult-now-and-authorized-human-review'
  readonly hotlineInformationProvided: false
  readonly emergencyServicesContacted: false
}

export interface StudentReportSafetyEvent extends SafetyEventBase {
  readonly kind: 'student-report-event'
  readonly classification: 'student-report'
  readonly reportId: OpaqueId
  readonly reportCategory:
    | 'unhelpful'
    | 'incorrect'
    | 'scary-or-upsetting'
    | 'inappropriate'
    | 'privacy-concern'
    | 'other'
  readonly targetEntryId?: OpaqueId
  /** Optional, length-limited student words. Do not require a report narrative. */
  readonly studentComment?: string
}

export interface StudentBlockSafetyEvent extends SafetyEventBase {
  readonly kind: 'student-block-event'
  readonly classification: 'student-block'
  readonly blockId: OpaqueId
  readonly blockScope: 'session' | 'subject' | 'all-tutor'
}

export interface PolicyViolationSafetyEvent extends SafetyEventBase {
  readonly kind: 'policy-violation-event'
  readonly policyCode:
    | 'unsafe-model-output'
    | 'answer-disclosure'
    | 'restricted-content'
    | 'privacy-boundary'
    | 'authorization-denied'
}

export type SafetyEvent =
  | AnswerWithheldSafetyEvent
  | EmergencyLanguageSafetyEvent
  | StudentReportSafetyEvent
  | StudentBlockSafetyEvent
  | PolicyViolationSafetyEvent

export interface ParentNotification extends ContractEnvelope {
  readonly kind: 'parent-notification'
  readonly notificationId: OpaqueId
  readonly eventId: OpaqueId
  readonly studentId: OpaqueId
  /** Opaque authenticated parent identity; no email/phone is collected here. */
  readonly recipientActorId: OpaqueId
  readonly channel: 'in-app'
  readonly urgency: 'when-convenient' | 'prompt' | 'urgent'
  readonly title: string
  readonly summary: string
  readonly includedData: readonly ('session-metadata' | 'safe-event-summary' | 'timeline-reference')[]
  readonly includesRawTranscript: false
  readonly status: 'pending' | 'shown' | 'acknowledged'
  readonly shownAt?: IsoDateTime
  readonly acknowledgedAt?: IsoDateTime
}

export interface StudentReport extends ContractEnvelope {
  readonly kind: 'student-report'
  readonly reportId: OpaqueId
  readonly studentId: OpaqueId
  readonly sessionId: OpaqueId
  readonly createdByStudentId: OpaqueId
  readonly category:
    | 'unhelpful'
    | 'incorrect'
    | 'scary-or-upsetting'
    | 'inappropriate'
    | 'privacy-concern'
    | 'other'
  readonly targetEntryId?: OpaqueId
  readonly comment?: string
  readonly status: 'submitted' | 'in-review' | 'resolved'
}

export interface StudentTutorBlock extends ContractEnvelope {
  readonly kind: 'student-tutor-block'
  readonly blockId: OpaqueId
  readonly studentId: OpaqueId
  readonly createdByStudentId: OpaqueId
  readonly sessionId: OpaqueId
  readonly subjectId?: OpaqueId
  readonly scope: 'session' | 'subject' | 'all-tutor'
  readonly reason: 'student-choice' | 'felt-unsafe' | 'unwanted-content' | 'other'
  readonly active: boolean
  readonly liftedAt?: IsoDateTime
  readonly liftedBy?: {
    readonly role: 'student' | 'parent' | 'reviewer'
    readonly actorId: OpaqueId
  }
}

export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface AllowedSessionWindow {
  readonly windowId: OpaqueId
  readonly days: readonly Weekday[]
  /** Local 24-hour HH:mm in timeZone. Equal values mean a full-day window. */
  readonly startLocalTime: string
  readonly endLocalTime: string
  readonly timeZone: IanaTimeZone
}

export interface TutorCapabilityPermissions {
  readonly textTutoring: boolean
  readonly voiceInput: boolean
  readonly readAloud: boolean
  readonly externalLinks: boolean
  readonly fileUpload: boolean
}

export interface TutorPermissions extends ContractEnvelope {
  readonly kind: 'tutor-permissions'
  readonly permissionsId: OpaqueId
  readonly studentId: OpaqueId
  readonly enabled: boolean
  /** Empty means no subjects; wildcard values are not accepted. */
  readonly allowedSubjectIds: readonly OpaqueId[]
  readonly allowedSessionWindows: readonly AllowedSessionWindow[]
  readonly dailySessionLimit: number
  readonly maximumSessionMinutes: number
  readonly capabilities: TutorCapabilityPermissions
  /**
   * Parent review and safety exceptions are fixed safeguards, not permissions
   * that can be disabled.
   */
  readonly parentReviewMode: 'always-available-to-authorized-parent'
  readonly studentPrivacyNotice: 'parent-review-with-safety-exceptions'
  readonly voiceDataMode: 'transcript-only-no-raw-audio'
  readonly updatedBy: {
    readonly role: 'parent'
    readonly actorId: OpaqueId
  }
  readonly updatedAt: IsoDateTime
}

export type SafetyPermission =
  | 'history:read'
  | 'safety-events:read'
  | 'permissions:manage'
  | 'reviews:read'
  | 'reviews:resolve'
  | 'data:export'
  | 'data:delete'
  | 'notifications:acknowledge'

/**
 * Authentication happens in the host. The safety core consumes only this
 * minimized authorization projection and rejects unauthenticated principals.
 */
export interface SafetyPrincipal {
  readonly authenticated: boolean
  readonly actorId: OpaqueId
  readonly role: SafetyCenterRole
  /** Required for a student principal. */
  readonly studentId?: OpaqueId
  /** Required for parent/reviewer access; never inferred from stored records. */
  readonly authorizedStudentIds: readonly OpaqueId[]
  readonly permissions: readonly SafetyPermission[]
}

export type AccessDenialReason =
  | 'unauthenticated'
  | 'role-not-allowed'
  | 'student-not-authorized'
  | 'permission-missing'

export interface AccessGranted {
  readonly allowed: true
}

export interface AccessDenied {
  readonly allowed: false
  readonly reason: AccessDenialReason
}

export type AuthorizationDecision = AccessGranted | AccessDenied

export interface TutorAccessRequest {
  readonly studentId: OpaqueId
  readonly sessionId: OpaqueId
  readonly subjectId: OpaqueId
  readonly channel: TutorChannel
  readonly at: IsoDateTime
  readonly activeSessionMinutes: number
  readonly sessionsStartedOnLocalDate: number
  readonly activeBlocks: readonly StudentTutorBlock[]
}

export type TutorAccessDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false
      readonly reason:
        | 'permission-disabled'
        | 'restricted-subject'
        | 'outside-allowed-time'
        | 'daily-session-limit'
        | 'session-time-limit'
        | 'voice-input-disabled'
        | 'student-blocked'
      readonly explanation: string
    }

export interface SafetyAuditEvent extends ContractEnvelope {
  readonly kind: 'safety-audit-event'
  readonly auditId: OpaqueId
  readonly studentId: OpaqueId
  readonly at: IsoDateTime
  readonly actor: {
    readonly actorId: OpaqueId
    readonly role: SafetyCenterRole
  }
  readonly action:
    | 'history-viewed'
    | 'event-viewed'
    | 'permissions-changed'
    | 'student-report-created'
    | 'student-block-created'
    | 'student-block-lifted'
    | 'notification-acknowledged'
    | 'review-queued'
    | 'review-updated'
    | 'false-positive-requested'
    | 'export-requested'
    | 'export-completed'
    | 'deletion-requested'
    | 'deletion-completed'
    | 'retention-applied'
  readonly targetType:
    | 'history'
    | 'safety-event'
    | 'permissions'
    | 'report'
    | 'block'
    | 'notification'
    | 'review'
    | 'data-request'
    | 'retention'
  readonly targetId: OpaqueId
  readonly outcome: 'allowed' | 'denied' | 'completed' | 'partial'
  /** Neutral reason code only. Never raw student or tutor text. */
  readonly reasonCode?: string
}

export interface RetentionPolicy extends ContractEnvelope {
  readonly kind: 'retention-policy'
  readonly policyId: OpaqueId
  readonly studentId: OpaqueId
  readonly instructionalHistoryDays: 7 | 30 | 60 | 90
  readonly safetyEventDays: 90 | 180 | 365
  readonly auditHistoryDays: 180 | 365 | 730
  readonly preserveOpenHumanReviews: true
  readonly rawMicrophoneRecordingRetentionDays: 0
  readonly updatedBy: {
    readonly role: 'parent'
    readonly actorId: OpaqueId
  }
  readonly updatedAt: IsoDateTime
}

export interface DataExportRequest extends ContractEnvelope {
  readonly kind: 'data-export-request'
  readonly requestId: OpaqueId
  readonly studentId: OpaqueId
  readonly requestedBy: {
    readonly role: 'student' | 'parent'
    readonly actorId: OpaqueId
  }
  readonly requestedAt: IsoDateTime
  readonly scope: 'instructional-history' | 'safety-events' | 'all-safety-center-data'
  readonly format: 'json'
  readonly status: 'requested' | 'ready' | 'completed' | 'denied'
  readonly completedAt?: IsoDateTime
}

export interface DataDeletionRequest extends ContractEnvelope {
  readonly kind: 'data-deletion-request'
  readonly requestId: OpaqueId
  readonly studentId: OpaqueId
  readonly requestedBy: {
    readonly role: 'student' | 'parent'
    readonly actorId: OpaqueId
  }
  readonly requestedAt: IsoDateTime
  readonly scope: 'instructional-history' | 'safety-events' | 'all-eligible-data'
  readonly status:
    | 'requested'
    | 'awaiting-parent-confirmation'
    | 'approved'
    | 'completed'
    | 'partially-completed'
    | 'denied'
  readonly approvedBy?: {
    readonly role: 'parent'
    readonly actorId: OpaqueId
  }
  readonly approvedAt?: IsoDateTime
  readonly completedAt?: IsoDateTime
}

export type HumanReviewPriority = 'routine' | 'prompt' | 'urgent'
export type HumanReviewStatus = 'queued' | 'in-review' | 'resolved' | 'dismissed'

export interface HumanReviewHistoryEntry {
  readonly actionId: OpaqueId
  readonly at: IsoDateTime
  readonly actor: {
    readonly role: 'system' | 'parent' | 'student' | 'reviewer'
    readonly actorId: OpaqueId
  }
  readonly action:
    | 'queued'
    | 'claimed'
    | 'note-added'
    | 'false-positive-requested'
    | 'false-positive-accepted'
    | 'false-positive-rejected'
    | 'resolved'
    | 'dismissed'
  /** Reviewer-safe structured outcome; no free-form private diagnosis field. */
  readonly reasonCode?: string
}

export interface FalsePositiveReview {
  readonly falsePositiveId: OpaqueId
  readonly requestedAt: IsoDateTime
  readonly requestedBy: {
    readonly role: 'student' | 'parent'
    readonly actorId: OpaqueId
  }
  readonly reason:
    | 'context-misunderstood'
    | 'schoolwork-quotation'
    | 'benign-phrase'
    | 'wrong-student'
    | 'other'
  readonly comment?: string
  readonly status: 'pending' | 'accepted' | 'rejected'
  readonly decidedAt?: IsoDateTime
  readonly decidedByReviewerId?: OpaqueId
}

export interface HumanReviewItem extends ContractEnvelope {
  readonly kind: 'human-review-item'
  readonly reviewId: OpaqueId
  readonly eventId: OpaqueId
  readonly sessionId: OpaqueId
  readonly studentId: OpaqueId
  readonly priority: HumanReviewPriority
  readonly status: HumanReviewStatus
  readonly queuedAt: IsoDateTime
  readonly assignedReviewerId?: OpaqueId
  readonly falsePositiveReview?: FalsePositiveReview
  readonly history: readonly HumanReviewHistoryEntry[]
  readonly resolvedAt?: IsoDateTime
  readonly resolution:
    | 'pending'
    | 'safety-concern-confirmed'
    | 'false-positive'
    | 'insufficient-context'
}

export interface SafetyCenterStore {
  readonly historyAvailability: 'available' | 'unavailable'
  readonly sessions: readonly ConversationSessionMetadata[]
  readonly instructionalHistory: readonly InstructionalHistoryRecord[]
  readonly safetyEvents: readonly SafetyEvent[]
  readonly notifications: readonly ParentNotification[]
  readonly reports: readonly StudentReport[]
  readonly blocks: readonly StudentTutorBlock[]
  readonly auditEvents: readonly SafetyAuditEvent[]
  readonly reviewItems: readonly HumanReviewItem[]
  readonly exportRequests: readonly DataExportRequest[]
  readonly deletionRequests: readonly DataDeletionRequest[]
}

export interface SafetyCenterDataExport extends ContractEnvelope {
  readonly kind: 'safety-center-data-export'
  readonly requestId: OpaqueId
  readonly studentId: OpaqueId
  readonly generatedAt: IsoDateTime
  readonly notices: {
    readonly parentReview: typeof PARENT_REVIEW_NOTICE
    readonly safetyException: typeof SAFETY_EXCEPTION_NOTICE
    readonly rawAudio: typeof RAW_AUDIO_NOTICE
  }
  readonly instructionalHistory: readonly InstructionalHistoryRecord[]
  readonly safetyEvents: readonly SafetyEvent[]
  readonly reports: readonly StudentReport[]
  readonly blocks: readonly StudentTutorBlock[]
  readonly auditEvents: readonly SafetyAuditEvent[]
}

export const emptySafetyCenterStore = (
  historyAvailability: SafetyCenterStore['historyAvailability'] = 'available',
): SafetyCenterStore => ({
  historyAvailability,
  sessions: [],
  instructionalHistory: [],
  safetyEvents: [],
  notifications: [],
  reports: [],
  blocks: [],
  auditEvents: [],
  reviewItems: [],
  exportRequests: [],
  deletionRequests: [],
})
