import type { AcademyGrade, AcademySubject, Grade } from '../../../../types'
import type { FamilyPilotStudentRecordV1 } from '../../../family-pilot/core/schema'
import type { DurableStudyDocumentV1 } from '../../../family-pilot/durable-ports/schema'

export const HOSTED_SYNC_STATE_CONTRACT_VERSION = 'hosted-study-sync-state.r2.v1' as const

export const HOSTED_SYNC_STATE_OPERATION_KINDS = Object.freeze([
  'FIRST_LINK_IMPORT',
  'UPSERT_ASSIGNMENT_SESSION',
  'CHECKPOINT',
  'NORMAL_COMPLETION',
  'ASSESSMENT_TRANSITION',
  'RFL_TRANSITION',
  'SOCIAL_SOURCE_ATTACHMENT',
  'SAFETY_TRANSITION',
  'FULL_STATE_REPLACEMENT',
] as const)

export type HostedSyncStateOperationKind = typeof HOSTED_SYNC_STATE_OPERATION_KINDS[number]

export interface HostedSyncStateIdentityR2 {
  readonly householdRef: string
  readonly studentRef: string
  /** Current Study persistence calls this learnerRef; it is explicit rather than inferred. */
  readonly learnerRef: string
}

/** One CAS/idempotency domain for the entire minimized student document. */
export interface HostedSyncStateMetadataR2 {
  readonly serverRevision: number
  readonly baseRevision: number
  readonly operationId: string
  readonly idempotencyKey: string
  readonly operationKind: HostedSyncStateOperationKind
  readonly deviceRef: string
  readonly localSequence: number
  readonly createdAt: string
}

/** PIN configuration and PIN-derived material intentionally have no field here. */
export interface HostedSyncStudentProfileR2 {
  readonly studentRef: string
  readonly displayName: string
  readonly nominalGrade: Grade
  readonly workingGradeBySubject: Readonly<Partial<Record<AcademySubject, AcademyGrade>>>
  readonly enabledSubjects: readonly AcademySubject[]
  readonly createdAt: string
  readonly updatedAt: string
}

export interface HostedSyncSessionIdentityR2 {
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly blockRef: string
  readonly sessionRef: string
  readonly lineageRootRef: string
  readonly continuationKey: string
}

export type HostedSyncCompletionStateR2 =
  | Readonly<{ kind: 'INCOMPLETE'; completedAt: null }>
  | Readonly<{ kind: 'NORMAL_CERTIFIED'; completedAt: string }>
  | Readonly<{ kind: 'RFL_PENDING_GUARDIAN'; completedAt: null }>
  | Readonly<{ kind: 'RFL_CERTIFIED'; completedAt: string }>

export interface HostedSyncAssignmentStateR2 {
  /** Exact current Core record, already minimized by its raw/transcript false markers. */
  readonly record: FamilyPilotStudentRecordV1['assignments'][number]
  readonly authorityRevision: number
  readonly sessionIdentity: HostedSyncSessionIdentityR2 | null
  readonly completion: HostedSyncCompletionStateR2
}

export type HostedSyncAssessmentStatusR2 =
  | 'PLANNED'
  | 'ACTIVE'
  | 'PENDING_ASSESSMENT'
  | 'SCORING_COMPLETE'
  | 'ADULT_REVIEW_REQUIRED'
  | 'PENDING_GUARDIAN_ATTESTATION'
  | 'CERTIFIED'

export interface HostedSyncAssessmentOutcomeR2 {
  readonly assessmentRecordRef: string
  readonly decision: 'CORRECT' | 'INCORRECT' | 'PARTIAL' | 'REVIEW_REQUIRED' | 'COMPLETED'
  readonly assessedAt: string
  readonly assessorRef: string
}

export interface HostedSyncAssessmentStateR2 {
  readonly assignmentRef: string
  readonly assessmentRef: string
  readonly studentRef: string
  readonly courseRef: string
  readonly subject: AcademySubject
  readonly grade: number
  readonly title: string
  readonly authorityClass: 'AUTO_SCOREABLE' | 'RUBRIC_REQUIRED' | 'GUARDIAN_REQUIRED' | 'COMPLETION_ONLY'
  readonly status: HostedSyncAssessmentStatusR2
  readonly createdAt: string
  readonly updatedAt: string
  readonly completedAt: string | null
  /** Opaque evidence references only; learner response bodies are outside this state contract. */
  readonly evidenceRefs: readonly string[]
  readonly outcome: HostedSyncAssessmentOutcomeR2 | null
  readonly authorityRevision: number
}

export interface HostedSyncRflStateR2 {
  readonly studentRef: string
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly sessionRef: string
  readonly learnerAssertionState: 'ASSERTED'
  readonly learnerAssertedAt: string
  readonly guardianState: 'PENDING' | 'CERTIFIED'
  readonly certifiedAt: string | null
  readonly attesterRef: string | null
  readonly evidenceMode: 'adult-observed' | 'simulated-alternative' | null
  readonly authorityRevision: number
}

export interface HostedSyncSocialSourceStateR2 {
  readonly studentRef: string
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly readiness: 'ATTACHED_SATISFIED'
  readonly sourceRef: string
  readonly kind: 'article' | 'primary-source' | 'reference' | 'unspecified'
  readonly title: string
  readonly publisher: string
  readonly publishedAt: string
  readonly attachedAt: string
  readonly sourceRevision: number
}

export type HostedSyncSafetyCategoryR2 =
  | 'URGENT'
  | 'UNCERTAIN'
  | 'CONCERNING_CONTENT'
  | 'ADULT_REVIEW'

export interface HostedSyncSafetyHoldR2 {
  readonly holdRef: string
  readonly studentRef: string
  readonly sessionRef: string
  readonly reasonCode: string
  readonly category: HostedSyncSafetyCategoryR2
  readonly source: 'study-safety' | 'tutor-core' | 'parent'
  readonly dedupeKey: string
  readonly createdAt: string
  readonly status: 'OPEN' | 'ACKNOWLEDGED' | 'CLEARED'
  readonly acknowledgedAt: string | null
  readonly clearedAt: string | null
  readonly clearAuthority: 'GUARDIAN' | null
  readonly clearerRef: string | null
  readonly logicalRevision: number
}

export interface HostedSyncPrivacyMarkersR2 {
  readonly pinIncluded: false
  readonly bearerIncluded: false
  readonly rawLearnerResponseIncluded: false
  readonly rawTutorConversationIncluded: false
  readonly rawAudioIncluded: false
  readonly inferenceIncluded: false
  readonly adultAnswerAuthorityIncluded: false
  readonly answerMaterialIncluded: false
}

/**
 * The one canonical R2 cross-device document. `indexedDbDocument` is the exact
 * current accepted, already-minimized Study document. Carrying it intact is
 * what removes the incompatible-checkpoint and synthetic-hydrate gaps.
 */
export interface HostedSyncStateSnapshotR2 {
  readonly contractVersion: typeof HOSTED_SYNC_STATE_CONTRACT_VERSION
  readonly identity: HostedSyncStateIdentityR2
  readonly sync: HostedSyncStateMetadataR2
  readonly student: FamilyPilotStudentRecordV1
  readonly studentProfile: HostedSyncStudentProfileR2
  readonly appUpdatedAt: string
  readonly setupCompletedAt: string | null
  readonly assignments: readonly HostedSyncAssignmentStateR2[]
  readonly assessmentStates: readonly HostedSyncAssessmentStateR2[]
  readonly rflStates: readonly HostedSyncRflStateR2[]
  readonly socialSources: readonly HostedSyncSocialSourceStateR2[]
  readonly safetyHolds: readonly HostedSyncSafetyHoldR2[]
  readonly indexedDbDocument: DurableStudyDocumentV1
  readonly privacy: HostedSyncPrivacyMarkersR2
}

export type HostedSyncStateParseFailureR2 =
  | 'UNKNOWN_VERSION'
  | 'MALFORMED_STATE'
  | 'PRIVACY_VIOLATION'
  | 'IDENTITY_MISMATCH'
  | 'CROSS_STUDENT_STATE'
  | 'MALFORMED_REVISION'
  | 'DANGEROUS_AUTHORITY_FIELD'
  | 'INCONSISTENT_STATE'

export type HostedSyncStateParseResultR2 =
  | Readonly<{ status: 'ready'; snapshot: HostedSyncStateSnapshotR2 }>
  | Readonly<{ status: 'refused'; reason: HostedSyncStateParseFailureR2 }>
