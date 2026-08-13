// HOSTED-SYNC-FIRST-LINK-R1: isolated, injected contracts for linking an
// existing device-local Family Pilot household. Nothing in this package is
// mounted by the final app and no implementation contacts a hosted service.

export const FIRST_LINK_MANIFEST_VERSION = 1 as const
export const FIRST_LINK_CONFIRMATION_VERSION = 1 as const

export interface StableStudentIdentity {
  readonly kind: 'academy-student-id' | 'legacy-profile-id'
  readonly value: string
}

export interface LocalAssignmentForLink {
  readonly kind: 'lesson' | 'assessment'
  readonly localAssignmentRef: string
  readonly contentRef: string
  readonly title: string
  readonly subject: string
  readonly state: string
  readonly completedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
  readonly progress: {
    readonly completedSegmentRefs: readonly string[]
    readonly totalSegments: number
    readonly lastSegmentRef: string | null
    readonly activeSeconds: number
  }
}

export interface LocalStudySessionForLink {
  readonly localSessionRef: string
  readonly localAssignmentRef: string
  readonly blockRef: string
  readonly lessonRef: string
  readonly status: 'ready' | 'active' | 'paused' | 'completed' | 'stopped'
  readonly segmentRef: string | null
  readonly updatedAt: string
  readonly lastAcceptedEventRef: string | null
  readonly checkpoint: {
    readonly checkpointRef: string
    readonly revision: number
    readonly capturedAt: string
    readonly completedSegmentRefs: readonly string[]
    readonly elapsedActiveSecondsInSegment: number
  } | null
}

export interface LocalStudyDocumentForLink {
  readonly localDocumentRef: string
  readonly updatedAt: string
  readonly sessions: readonly LocalStudySessionForLink[]
}

export interface LocalSourceForLink {
  readonly localSourceRef: string
  readonly localAssignmentRef: string
  readonly lessonRef: string
  readonly title: string
  readonly publisher: string
  readonly publishedAt: string
  readonly attachedAt: string
  readonly status: 'ATTACHED_SATISFIED'
}

export interface LocalAttestationForLink {
  readonly localAssignmentRef: string
  readonly lessonRef: string
  readonly localSessionRef: string
  readonly status: 'PENDING_GUARDIAN_ATTESTATION' | 'CERTIFIED'
  readonly learnerAssertedAt: string
  readonly attestedAt: string | null
  readonly evidenceMode: 'adult-observed' | 'simulated-alternative' | null
}

export interface LocalSafetyHoldForLink {
  readonly localHoldRef: string
  readonly localSessionRef: string
  readonly createdAt: string
  readonly status: string
  readonly reasonCode: string
  readonly source: string
  readonly acknowledgedAt: string | null
  readonly clearedAt: string | null
}

export interface LocalStudentForLink {
  readonly localStudentRef: string
  readonly displayName: string
  readonly identity: StableStudentIdentity
  readonly assignments: readonly LocalAssignmentForLink[]
  readonly studyDocument: LocalStudyDocumentForLink
  readonly sources: readonly LocalSourceForLink[]
  readonly attestations: readonly LocalAttestationForLink[]
  readonly safetyHolds: readonly LocalSafetyHoldForLink[]
}

export interface LocalHouseholdForLink {
  readonly localHouseholdRef: string
  readonly capturedAt: string
  readonly students: readonly LocalStudentForLink[]
}

/** Server-derived authenticated authority. No bearer/session token is allowed. */
export interface AuthenticatedParentHouseholdAuthority {
  readonly status: 'authenticated-parent-household-authority'
  readonly authorityRef: string
  readonly remoteHouseholdRef: string
  readonly expiresAt: string
}

export interface RemoteAssignmentSummary {
  readonly remoteAssignmentRef: string
  readonly kind: LocalAssignmentForLink['kind']
  readonly contentRef: string
  /** Present only when the server has already accepted this exact local identity. */
  readonly originLocalAssignmentRef: string | null
  readonly revision: number
}

export interface RemoteStudySessionSummary {
  readonly remoteSessionRef: string
  readonly remoteAssignmentRef: string
  readonly lessonRef: string
  /** Present only when the server has already accepted this exact local identity. */
  readonly originLocalSessionRef: string | null
  readonly revision: number
}

export interface RemoteStudentSummary {
  readonly remoteStudentRef: string
  readonly displayName: string
  readonly identities: readonly StableStudentIdentity[]
  readonly assignments: readonly RemoteAssignmentSummary[]
  readonly sessions: readonly RemoteStudySessionSummary[]
}

export interface FirstLinkInspection {
  readonly authority: AuthenticatedParentHouseholdAuthority
  readonly serverBaseRevision: number
  readonly remoteStudents: readonly RemoteStudentSummary[]
}

export type StudentLinkState =
  | 'EXACT_MATCH'
  | 'EXPLICIT_MAP_REQUIRED'
  | 'NEW_REMOTE_STUDENT'
  | 'CONFLICT'

export type AssignmentLinkState = 'EXACT_MATCH' | 'NEW_REMOTE_ASSIGNMENT' | 'CONFLICT'
export type SessionLinkState = 'EXACT_MATCH' | 'NEW_REMOTE_SESSION' | 'CONFLICT'

export interface AssignmentLinkPlanItem {
  readonly localAssignmentRef: string
  readonly state: AssignmentLinkState
  readonly remoteAssignmentRef: string | null
  readonly reasonCode: string | null
}

export interface SessionLinkPlanItem {
  readonly localSessionRef: string
  readonly localAssignmentRef: string
  readonly state: SessionLinkState
  readonly remoteSessionRef: string | null
  readonly reasonCode: string | null
}

export interface StudentLinkPlanItem {
  readonly localStudentRef: string
  readonly displayName: string
  readonly state: StudentLinkState
  readonly identityResolution: Exclude<StudentLinkState, 'CONFLICT'> | 'CONFLICT'
  readonly remoteStudentRef: string | null
  readonly candidateRemoteStudentRefs: readonly string[]
  readonly assignments: readonly AssignmentLinkPlanItem[]
  readonly sessions: readonly SessionLinkPlanItem[]
  readonly reasonCode: string | null
}

export interface FirstLinkPlan {
  readonly planVersion: 1
  readonly localHouseholdRef: string
  readonly remoteHouseholdRef: string
  readonly authorityRef: string
  readonly serverBaseRevision: number
  readonly students: readonly StudentLinkPlanItem[]
  readonly readyForParentConfirmation: boolean
}

export type ExplicitStudentMappingChoice = Readonly<{
  localStudentRef: string
  /** `null` is an explicit Parent choice to create a new remote student. */
  remoteStudentRef: string | null
}>

export interface ParentFirstLinkConfirmation {
  readonly confirmationVersion: typeof FIRST_LINK_CONFIRMATION_VERSION
  readonly approved: true
  readonly confirmedAt: string
  readonly planDigest: string
}

export interface FirstLinkManifestAssignment extends LocalAssignmentForLink {
  readonly operationId: string
  readonly remoteAssignmentRef: string | null
  readonly mapping: Exclude<AssignmentLinkState, 'CONFLICT'>
}

export interface FirstLinkManifestSession extends LocalStudySessionForLink {
  readonly operationId: string
  readonly remoteSessionRef: string | null
  readonly mapping: Exclude<SessionLinkState, 'CONFLICT'>
}

export interface FirstLinkManifestStudent {
  readonly operationId: string
  readonly localStudentRef: string
  readonly remoteStudentRef: string | null
  readonly mapping: 'EXACT_MATCH' | 'NEW_REMOTE_STUDENT'
  readonly displayName: string
  readonly identity: StableStudentIdentity
  readonly assignments: readonly FirstLinkManifestAssignment[]
  readonly studyDocument: Omit<LocalStudyDocumentForLink, 'sessions'> & {
    readonly operationId: string
    readonly sessions: readonly FirstLinkManifestSession[]
  }
  readonly sources: readonly (LocalSourceForLink & { readonly operationId: string })[]
  readonly attestations: readonly (LocalAttestationForLink & {
    readonly operationId: string
    /** Imported history is accepted only under the currently authenticated Parent. */
    readonly authorityTreatment: 'authenticated-parent-import-receipt-required'
  })[]
  readonly safetyHolds: readonly (LocalSafetyHoldForLink & { readonly operationId: string })[]
}

export interface FirstLinkManifest {
  readonly manifestVersion: typeof FIRST_LINK_MANIFEST_VERSION
  readonly attemptId: string
  readonly manifestDigest: string
  readonly localSnapshotDigest: string
  readonly household: {
    readonly operationId: string
    readonly localHouseholdRef: string
    readonly remoteHouseholdRef: string
    readonly authorityRef: string
  }
  readonly serverBaseRevisionSeed: number
  readonly capturedAt: string
  readonly confirmation: ParentFirstLinkConfirmation
  readonly students: readonly FirstLinkManifestStudent[]
  readonly rawAnswerIncluded: false
  readonly tutorTranscriptIncluded: false
  readonly pinIncluded: false
  readonly adultAnswerAuthorityIncluded: false
}

export interface FirstLinkReadbackStudent {
  readonly localStudentRef: string
  readonly remoteStudentRef: string
  readonly assignments: readonly {
    readonly localAssignmentRef: string
    readonly remoteAssignmentRef: string
  }[]
  readonly sessions: readonly {
    readonly localSessionRef: string
    readonly remoteSessionRef: string
  }[]
}

export interface FirstLinkReadback {
  readonly status: 'complete' | 'incomplete'
  readonly attemptId: string
  readonly manifestDigest: string
  readonly remoteHouseholdRef: string
  readonly serverRevision: number
  readonly appliedOperationIds: readonly string[]
  readonly students: readonly FirstLinkReadbackStudent[]
}

export interface FirstLinkApi {
  /** Must derive Parent/household authority from the authenticated server session. */
  inspect(): Promise<FirstLinkInspection>
  /**
   * Idempotent on (attemptId, operationId), CAS-bound to serverBaseRevisionSeed,
   * and must return conflict rather than overwrite a different fingerprint.
   */
  apply(manifest: FirstLinkManifest): Promise<{ readonly status: 'accepted' | 'incomplete' | 'conflict' }>
  /** Independent authoritative read after apply; never a client echo. */
  readback(attemptId: string): Promise<FirstLinkReadback>
}

export interface PendingFirstLinkImport {
  readonly status: 'pending'
  readonly manifest: FirstLinkManifest
}

export interface FirstLinkProgressPort {
  load(localHouseholdRef: string): Promise<PendingFirstLinkImport | null>
  savePending(pending: PendingFirstLinkImport): Promise<void>
  clearPending(localHouseholdRef: string, attemptId: string): Promise<void>
}

export interface LinkedHouseholdReceipt {
  readonly localHouseholdRef: string
  readonly remoteHouseholdRef: string
  readonly attemptId: string
  readonly manifestDigest: string
  readonly serverRevision: number
  readonly students: readonly FirstLinkReadbackStudent[]
  readonly confirmedAt: string
}

export interface LocalLinkCommitPort {
  /** Sidecar binding only: implementations must not rewrite existing local IDs or content. */
  commitVerifiedLink(receipt: LinkedHouseholdReceipt): Promise<void>
}

export type FirstLinkFailureCode =
  | 'AUTHORITY_REQUIRED'
  | 'PLAN_NOT_READY'
  | 'PARENT_CONFIRMATION_REQUIRED'
  | 'LOCAL_STATE_CHANGED'
  | 'NETWORK_FAILURE'
  | 'REMOTE_STATE_CHANGED'
  | 'REMOTE_IMPORT_INCOMPLETE'
  | 'READBACK_MISMATCH'
  | 'LOCAL_COMMIT_FAILED'

export type FirstLinkExecutionResult =
  | { readonly status: 'linked'; readonly receipt: LinkedHouseholdReceipt }
  | {
      readonly status: 'failed'
      readonly code: FirstLinkFailureCode
      readonly message: string
      readonly resumable: boolean
    }
