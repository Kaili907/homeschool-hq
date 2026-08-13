import type { StudyLearnerPreferences, StudyParentSettings, StudyCheckpoint, StudySessionSnapshot } from '../../types'
import type { FamilyPilotAssignmentRecordV1 } from '../../family-pilot/core'
import type { DurableCalendarRecordV1, DurableEventRecordV1 } from '../../family-pilot/durable-ports'
import type { FinalFamilyPilotAttestationRecord } from '../../family-pilot/final-composition'
import type { FinalReadinessAssignmentConfiguration } from '../../family-pilot/final-readiness'
import type {
  FinalFamilyPilotSavedSession,
  FinalFamilyPilotSourceAttachment,
} from '../../family-pilot/final-app/state'
import type { SafetyHoldV1 } from '../../family-pilot/safety'

/**
 * One exact assignment/session occurrence. Every field is already an identity
 * used by the final Family Pilot or accepted Study runtime; reconciliation does
 * not derive identity from titles, timestamps, or array position.
 */
export interface StudyDocumentIdentity {
  readonly householdRef: string
  readonly learnerRef: string
  readonly studentRef: string
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly blockRef: string
  readonly sessionRef: string
  readonly lineageRootRef: string
  readonly lineageKey: string
}

/**
 * A focused view over the records the final app already owns. This is not a
 * second durable Study document: every member is an existing final schema and
 * can be selected from DurableStudyDocumentV1/Core/final app state verbatim.
 */
export interface ReconciliableStudyState {
  readonly assignment: FamilyPilotAssignmentRecordV1
  readonly readiness: FinalReadinessAssignmentConfiguration
  readonly savedSession: FinalFamilyPilotSavedSession
  readonly calendar: DurableCalendarRecordV1
  readonly session: StudySessionSnapshot
  readonly checkpoint: StudyCheckpoint | null
  readonly events: readonly DurableEventRecordV1[]
  readonly preferences: StudyLearnerPreferences | null
  readonly parentSettings: StudyParentSettings | null
  readonly sourceAttachment: FinalFamilyPilotSourceAttachment | null
  readonly attestation: FinalFamilyPilotAttestationRecord | null
  readonly safetyHolds: readonly SafetyHoldV1[]
}

export type StudyAuthorityActor = 'STUDENT' | 'PARENT' | 'SERVER' | 'SYSTEM'

/** Logical revision, never a wall-clock value. */
export interface StudyAuthorityStamp {
  readonly revision: number
  readonly operationId: string
  readonly actor: StudyAuthorityActor
}

/**
 * Sidecar versions for fields whose existing record has no native authority
 * revision. Safety is per hold so a new hold cannot erase an older clear (or
 * vice versa) merely because another hold changed later.
 */
export interface StudyFieldAuthority {
  readonly assignment: StudyAuthorityStamp
  readonly calendar: StudyAuthorityStamp
  readonly requirements: StudyAuthorityStamp
  readonly preferences: StudyAuthorityStamp
  readonly parentSettings: StudyAuthorityStamp
  readonly sourceAttachment: StudyAuthorityStamp
  readonly attestation: StudyAuthorityStamp
  readonly safetyHolds: Readonly<Record<string, StudyAuthorityStamp>>
}

export const STUDY_SYNC_OPERATION_KINDS = Object.freeze([
  'PROGRESS',
  'CHECKPOINT',
  'LEARNER_COMPLETION',
  'GUARDIAN_ATTESTATION',
  'SAFETY_HOLD',
  'SAFETY_CLEAR',
  'SOURCE_ATTACHMENT',
  'PREFERENCE',
  'PARENT_SETTINGS',
  'ASSIGNMENT_AUTHORITY',
] as const)

export type StudySyncOperationKind = typeof STUDY_SYNC_OPERATION_KINDS[number]

/** Minimized persistent queue entry: identifiers/revisions/codes only. */
export interface StudySyncOperationMetadata {
  readonly operationId: string
  readonly deviceId: string
  readonly localRevision: number
  readonly kind: StudySyncOperationKind
  readonly actor: StudyAuthorityActor
}

export interface StudySyncMetadata {
  /** Last server revision this replica has acknowledged. */
  readonly serverRevision: number
  /** Server revision from which the current local mutation chain began. */
  readonly baseServerRevision: number
  /** Device-local monotonic mutation counter. */
  readonly localRevision: number
  readonly deviceId: string
  readonly pendingOperations: readonly StudySyncOperationMetadata[]
  readonly appliedOperationIds: readonly string[]
  readonly authority: StudyFieldAuthority
}

export interface StudySyncReplica {
  readonly identity: StudyDocumentIdentity
  readonly state: ReconciliableStudyState
  readonly metadata: StudySyncMetadata
}

export const STUDY_RECONCILIATION_RESULTS = Object.freeze([
  'ACCEPT_LOCAL',
  'ACCEPT_REMOTE',
  'MERGED',
  'RETRY_WITH_REVISION',
  'MANUAL_OR_CONSERVATIVE_CONFLICT',
  'REFUSE_IDENTITY_MISMATCH',
] as const)

export type StudyReconciliationResultCode = typeof STUDY_RECONCILIATION_RESULTS[number]

export const STUDY_CONFLICT_CODES = Object.freeze([
  'DOCUMENT_IDENTITY_MISMATCH',
  'HOUSEHOLD_BINDING_MISMATCH',
  'STUDENT_BINDING_MISMATCH',
  'ASSIGNMENT_BINDING_MISMATCH',
  'LESSON_BINDING_MISMATCH',
  'SESSION_BINDING_MISMATCH',
  'LINEAGE_BINDING_MISMATCH',
  'STATE_BINDING_INVALID',
  'PRIVACY_MINIMIZATION_FAILED',
  'REVISION_METADATA_INVALID',
  'QUEUE_METADATA_INVALID',
  'REMOTE_REVISION_MOVED',
  'REMOTE_REVISION_BEHIND',
  'PLAN_STRUCTURE_MISMATCH',
  'INCOMPATIBLE_PROGRESS_BRANCH',
  'INCOMPATIBLE_CURRENT_CHECKPOINT',
  'CHECKPOINT_REVISION_COLLISION',
  'EVENT_IDENTITY_COLLISION',
  'EVENT_SEMANTIC_COLLISION',
  'ASSIGNMENT_ABANDONED_CONFLICT',
  'ASSIGNMENT_AUTHORITY_COLLISION',
  'CALENDAR_AUTHORITY_COLLISION',
  'CALENDAR_AUTHORITY_PROGRESS_CONFLICT',
  'REQUIREMENTS_AUTHORITY_COLLISION',
  'PREFERENCE_REVISION_COLLISION',
  'PARENT_AUTHORITY_COLLISION',
  'SOURCE_ATTACHMENT_CONFLICT',
  'ATTESTATION_AUTHORITY_COLLISION',
  'COMPLETION_AUTHORITY_INVALID',
  'SAFETY_AUTHORITY_COLLISION',
  'SAFETY_CLEAR_UNAUTHORIZED',
] as const)

export type StudyConflictCode = typeof STUDY_CONFLICT_CODES[number]

export type StudyFieldClass =
  | 'IDENTITY_IMMUTABLE'
  | 'MONOTONIC_PROGRESS'
  | 'AUTHORITY_SENSITIVE'
  | 'SERVER_OR_PARENT_AUTHORITY'
  | 'LOCAL_PREFERENCE'

/** Derived from the concrete records in ReconciliableStudyState. */
export const STUDY_FIELD_CLASSIFICATION: Readonly<Record<StudyFieldClass, readonly string[]>> = Object.freeze({
  IDENTITY_IMMUTABLE: Object.freeze([
    'identity.*',
    'identity.studentRef + assignment.assignmentRef/lessonRef',
    'savedSession.*',
    'calendar.block.internalBlockId/learnerRef/sourceIdentity/lineage',
    'calendar.plan.lessonRef/segments',
    'session.scope/lessonRef',
  ]),
  MONOTONIC_PROGRESS: Object.freeze([
    'assignment.progress.completedSegmentRefs',
    'assignment.progress.totalSegments',
    'assignment.progress.activeSeconds',
    'calendar.block.segments[].completedAt',
    'calendar.block.revision',
    'checkpoint.revision/completedSegmentRefs',
    'events',
    'completion',
  ]),
  AUTHORITY_SENSITIVE: Object.freeze([
    'attestation',
    'safetyHolds[].status',
    'sourceAttachment',
    'readiness.completionRequirement',
  ]),
  SERVER_OR_PARENT_AUTHORITY: Object.freeze([
    'assignment.state=abandoned',
    'readiness requirements',
    'parentSettings',
    'calendar parent-editable fields',
    'attestation.status=CERTIFIED',
    'safetyHolds[].status=cleared',
  ]),
  LOCAL_PREFERENCE: Object.freeze(['preferences']),
})

export interface StudyConflictDiagnostic {
  readonly documentId: string
  readonly codes: readonly StudyConflictCode[]
  readonly localServerRevision: number
  readonly remoteServerRevision: number
  readonly localRevision: number
  readonly remoteLocalRevision: number
}

export type ConflictClassification =
  | {
      readonly status: 'COMPATIBLE'
      readonly codes: readonly []
      readonly diagnostic: StudyConflictDiagnostic
    }
  | {
      readonly status: 'CONFLICT'
      readonly codes: readonly StudyConflictCode[]
      readonly diagnostic: StudyConflictDiagnostic
    }
  | {
      readonly status: 'IDENTITY_MISMATCH'
      readonly codes: readonly StudyConflictCode[]
      readonly diagnostic: StudyConflictDiagnostic
    }

interface StudyReconciliationBase {
  readonly diagnostic: StudyConflictDiagnostic
  readonly conflictCodes: readonly StudyConflictCode[]
  readonly identity: StudyDocumentIdentity
  readonly remoteServerRevision: number
}

interface StudyReconciledPayload {
  readonly state: ReconciliableStudyState
  readonly authority: StudyFieldAuthority
  readonly pendingOperations: readonly StudySyncOperationMetadata[]
  readonly appliedOperationIds: readonly string[]
  readonly localRevision: number
}

export type StudyReconciliationOutcome =
  | (StudyReconciliationBase & StudyReconciledPayload & { readonly result: 'ACCEPT_LOCAL' })
  | (StudyReconciliationBase & StudyReconciledPayload & { readonly result: 'ACCEPT_REMOTE' })
  | (StudyReconciliationBase & StudyReconciledPayload & { readonly result: 'MERGED' })
  | (StudyReconciliationBase & { readonly result: 'RETRY_WITH_REVISION' })
  | (StudyReconciliationBase & { readonly result: 'MANUAL_OR_CONSERVATIVE_CONFLICT' })
  | (StudyReconciliationBase & { readonly result: 'REFUSE_IDENTITY_MISMATCH' })

export interface ReconcileStudyStateInput {
  readonly local: StudySyncReplica
  readonly remote: StudySyncReplica
  /** CAS revision observed by the caller while fetching `remote`. */
  readonly baseRevision: number
}

interface ReadyStudySyncResolution {
  readonly identity: StudyDocumentIdentity
  readonly expectedServerRevision: number
  readonly state: ReconciliableStudyState
  readonly authority: StudyFieldAuthority
  readonly operations: readonly StudySyncOperationMetadata[]
  readonly appliedOperationIds: readonly string[]
  readonly localRevision: number
  readonly diagnostic: StudyConflictDiagnostic
}

export type StudySyncResolution =
  | (ReadyStudySyncResolution & { readonly method: 'HYDRATE_REMOTE'; readonly result: 'ACCEPT_REMOTE' })
  | (ReadyStudySyncResolution & { readonly method: 'PUT_WITH_CAS'; readonly result: 'ACCEPT_LOCAL' | 'MERGED' })
  | { readonly method: 'REFETCH_REMOTE'; readonly result: 'RETRY_WITH_REVISION'; readonly diagnostic: StudyConflictDiagnostic }
  | { readonly method: 'BLOCK'; readonly result: 'MANUAL_OR_CONSERVATIVE_CONFLICT' | 'REFUSE_IDENTITY_MISMATCH'; readonly diagnostic: StudyConflictDiagnostic }

export type OfflineStudyBlockCode =
  | 'IDENTITY_OR_STATE_INVALID'
  | 'DURABLE_STORAGE_UNAVAILABLE'
  | 'ASSIGNMENT_UNAVAILABLE'
  | 'PRODUCTION_MATERIAL_UNAVAILABLE'
  | 'SAFETY_STATE_UNAVAILABLE'
  | 'SAFETY_HOLD'
  | 'DYNAMIC_SOURCE_REQUIRED'
  | 'SESSION_STOPPED'
  | 'ASSIGNMENT_ABANDONED'
  | 'ASSIGNMENT_COMPLETE'
  | 'GUARDIAN_ATTESTATION_REQUIRED'

export interface OfflineStudyCapabilities {
  readonly durableStorageAvailable: boolean
  readonly assignmentAvailable: boolean
  readonly productionMaterialAvailable: boolean
  readonly safetyStateAvailable: boolean
}

export type OfflineStudyDecision =
  | {
      readonly status: 'ALLOW_LOCAL_PROGRESS'
      readonly mayRecordProgress: true
      readonly mayCertifyCompletion: boolean
      readonly reasonCode: null
    }
  | {
      readonly status: 'BLOCKED' | 'WAITING_FOR_GUARDIAN'
      readonly mayRecordProgress: false
      readonly mayCertifyCompletion: false
      readonly reasonCode: OfflineStudyBlockCode
    }
