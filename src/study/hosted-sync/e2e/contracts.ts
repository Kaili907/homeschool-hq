import type {
  FinalE2EAssignmentSnapshot,
  FinalE2ESourceFixture,
  FinalE2EStudentFixture,
} from '../../family-pilot/final-e2e/contracts'

export const HOSTED_STUDY_E2E_SCHEMA_VERSION = 1 as const

export type HostedActorRole = 'student' | 'parent'

/** Returned by identity, held only in device memory, and never handed to local storage. */
export interface HostedIdentitySession {
  readonly sessionRef: string
  readonly householdRef: string
  readonly actorRef: string
  readonly role: HostedActorRole
  readonly authorizedStudentRefs: readonly string[]
  readonly bearerToken: string
  readonly expiresAt: string
}

export interface HostedSignInInput {
  readonly deviceRef: string
  readonly credentialRef: string
  /** A local identity-verification input. It must never cross the sync transport. */
  readonly pin?: string
}

export interface IdentityProvider {
  readonly signIn: (input: HostedSignInInput) => Promise<HostedIdentitySession>
  readonly logout: (sessionRef: string) => Promise<void>
}

export interface HostedSourceAttachment {
  readonly sourceRef: string
  readonly kind: FinalE2ESourceFixture['kind']
  readonly title: string
  readonly publisher: string
  readonly publishedAt: string
  readonly attachedAt: string
  readonly status: 'ATTACHED_SATISFIED'
}

export interface HostedSafetyHold {
  readonly holdRef: string
  readonly reasonCode: string
  readonly status: 'open' | 'cleared'
  readonly createdAt: string
  readonly createdByRole: HostedActorRole
  readonly clearedAt: string | null
  readonly clearedByRef: string | null
}

export interface HostedCompletion {
  readonly authority: 'learner' | 'guardian'
  readonly status: 'in-progress' | 'pending-attestation' | 'certified'
  readonly learnerFinishedAt: string | null
  readonly attestedAt: string | null
  readonly attestedByRef: string | null
}

/**
 * Hosted representation of a real-shaped Family Pilot assignment. The assignment
 * projection deliberately reuses the audited public E2E shape rather than a toy
 * progress counter.
 */
export interface HostedStudyDocument {
  readonly schemaVersion: typeof HOSTED_STUDY_E2E_SCHEMA_VERSION
  readonly documentRef: string
  readonly householdRef: string
  readonly studentRef: string
  readonly assignment: FinalE2EAssignmentSnapshot
  readonly completion: HostedCompletion
  readonly sourceAttachment: HostedSourceAttachment | null
  readonly safetyHolds: readonly HostedSafetyHold[]
  readonly serverRevision: number
  /** Server ordering evidence only. Device clocks never establish authority. */
  readonly serverAcceptedAt: string
  readonly rawTutorConversationIncluded: false
  readonly privateResponseIncluded: false
}

export interface HostedHouseholdSnapshot {
  readonly householdRef: string
  readonly students: readonly FinalE2EStudentFixture[]
  readonly documents: readonly HostedStudyDocument[]
  readonly serverRevision: number
}

export type HostedStudyOperation =
  | { readonly type: 'start' }
  | { readonly type: 'advance'; readonly segmentRef: string }
  | { readonly type: 'finish' }
  | { readonly type: 'attest'; readonly evidenceMode: 'adult-observed' | 'simulated-alternative' }
  | { readonly type: 'attach-source'; readonly source: FinalE2ESourceFixture }
  | { readonly type: 'place-safety-hold'; readonly holdRef: string; readonly reasonCode: string }
  | { readonly type: 'clear-safety-hold'; readonly holdRef: string }

export interface HostedMutationRequest {
  readonly kind: 'mutate'
  readonly requestRef: string
  readonly idempotencyKey: string
  readonly householdRef: string
  readonly studentRef: string
  readonly documentRef: string
  readonly baseRevision: number
  readonly deviceOccurredAt: string
  readonly operation: HostedStudyOperation
}

export interface HostedHydrateRequest {
  readonly kind: 'hydrate-household'
  readonly requestRef: string
  readonly householdRef: string
}

export interface HostedReadStudentRequest {
  readonly kind: 'read-student'
  readonly requestRef: string
  readonly householdRef: string
  readonly studentRef: string
}

export type HostedSyncRequest =
  | HostedHydrateRequest
  | HostedReadStudentRequest
  | HostedMutationRequest

export type HostedSyncResponse =
  | {
      readonly status: 'ok'
      readonly requestRef: string
      readonly snapshot?: HostedHouseholdSnapshot
      readonly document?: HostedStudyDocument
      readonly duplicate: boolean
    }
  | {
      readonly status: 'stale'
      readonly requestRef: string
      readonly remote: HostedStudyDocument
    }
  | {
      readonly status: 'auth-error'
      readonly requestRef: string
      readonly httpStatus: 401
      readonly reasonCode: 'session-expired' | 'session-invalid'
    }
  | {
      readonly status: 'forbidden'
      readonly requestRef: string
      readonly httpStatus: 403
      readonly reasonCode: string
    }
  | {
      readonly status: 'safety-blocked'
      readonly requestRef: string
      readonly reasonCode: string
      readonly remote: HostedStudyDocument
    }
  | {
      readonly status: 'retryable'
      readonly requestRef: string
      readonly reasonCode: 'offline' | 'timeout' | 'rate-limited' | 'server-error' | 'lost-ack'
      readonly httpStatus?: 429 | 500 | 503
    }
  | {
      readonly status: 'invalid-response'
      readonly requestRef: string
      readonly reasonCode: 'malformed-response' | 'corrupt-remote-state' | 'reordered-response'
    }

export interface HostedSyncTransport {
  readonly send: (
    session: HostedIdentitySession,
    request: HostedSyncRequest,
  ) => Promise<unknown>
}

export interface HostedStudyRepository {
  readonly hydrateHousehold: (
    session: HostedIdentitySession,
    request: HostedHydrateRequest,
  ) => Promise<HostedSyncResponse>
  readonly readStudent: (
    session: HostedIdentitySession,
    request: HostedReadStudentRequest,
  ) => Promise<HostedSyncResponse>
  readonly applyMutation: (
    session: HostedIdentitySession,
    request: HostedMutationRequest,
  ) => Promise<HostedSyncResponse>
}

export interface PendingHostedMutation {
  readonly request: HostedMutationRequest
  readonly attempts: number
}

export interface LocalHostedStudyState {
  readonly household: HostedHouseholdSnapshot | null
  readonly pending: readonly PendingHostedMutation[]
  readonly lastError: HostedSyncResponse['status'] | null
}

/** IndexedDB-equivalent storage. One fresh instance must be supplied per device. */
export interface LocalStudyStore {
  readonly read: () => LocalHostedStudyState
  readonly replaceHousehold: (snapshot: HostedHouseholdSnapshot) => void
  readonly replaceDocument: (document: HostedStudyDocument) => void
  readonly enqueue: (pending: PendingHostedMutation) => void
  readonly replacePending: (pending: readonly PendingHostedMutation[]) => void
  readonly setLastError: (status: HostedSyncResponse['status'] | null) => void
  readonly clearEphemeralAuthorization: () => void
  /** Test-only serialized view of what would be persisted in IndexedDB. */
  readonly persistedCanary: () => string
}

export type ReconciliationDecision =
  | { readonly status: 'retry'; readonly request: HostedMutationRequest; readonly local: HostedStudyDocument }
  | { readonly status: 'accept-remote'; readonly remote: HostedStudyDocument; readonly reasonCode: string }
  | { readonly status: 'conflict'; readonly remote: HostedStudyDocument; readonly reasonCode: string }

export interface ReconciliationPolicy {
  readonly reconcile: (input: {
    readonly session: HostedIdentitySession
    readonly local: HostedStudyDocument
    readonly remote: HostedStudyDocument
    readonly rejected: HostedMutationRequest
    readonly nextRequestRef: string
  }) => ReconciliationDecision
}

export interface TestClockScheduler {
  readonly now: () => string
  readonly advance: (milliseconds: number) => void
}

export type HostedFailureInjection =
  | 'offline'
  | 'timeout'
  | '401'
  | '403'
  | '429'
  | '500'
  | '503'
  | 'stale-revision'
  | 'duplicate-request'
  | 'duplicate-response'
  | 'reordered-response'
  | 'lost-ack'
  | 'malformed-response'
  | 'corrupt-remote-state'

export interface NetworkController {
  readonly isOnline: () => boolean
  readonly setOnline: (online: boolean) => void
  readonly injectNext: (failure: HostedFailureInjection) => void
  readonly takeNext: () => HostedFailureInjection | null
}

export interface HostedSyncHarnessInjection {
  readonly identityProvider: IdentityProvider
  readonly transport: HostedSyncTransport
  readonly reconciliationPolicy: ReconciliationPolicy
  readonly createLocalStudyStore: (deviceRef: string) => LocalStudyStore
  readonly hostedRepository: HostedStudyRepository
  readonly clock: TestClockScheduler
  readonly network: NetworkController
}

export type DeviceSyncOutcome =
  | { readonly status: 'synced' | 'hydrated' | 'logged-out'; readonly duplicate?: boolean }
  | { readonly status: 'queued' | 'conflict' | 'auth-required' | 'forbidden' | 'safety-blocked' | 'invalid-response'; readonly reasonCode: string }

export interface HostedSyncTraceEntry {
  readonly deviceRef: string
  readonly request: HostedSyncRequest
  readonly response: unknown
}
