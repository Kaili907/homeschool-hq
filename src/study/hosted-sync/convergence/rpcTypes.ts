import type { StudyCheckpointRecord } from '../../contracts/persistence/types'

export const HOSTED_STUDY_RPC_SCHEMA_VERSION = 1 as const

export interface HostedStudyRpcScope {
  readonly householdRef: string
  readonly studentRef: string
  readonly assignmentRef: string
  readonly sessionRef: string
}

export interface HostedStudyRpcRevisions {
  readonly authority: number
  readonly session: number
  readonly checkpoint: number
}

export interface HostedStudyRpcHydrateDocument {
  readonly studentRef: string
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly studySessionId: string
  readonly completionState:
    | 'planned'
    | 'active'
    | 'paused'
    | 'approved-break'
    | 'student-requested-break'
    | 'technical-interruption'
    | 'completed'
    | 'abandoned'
  readonly revisions: HostedStudyRpcRevisions
  readonly progress: Readonly<{
    currentSegmentRef: string | null
    completedSegmentRefs: readonly string[]
    safeInstructionalCursor: Readonly<Record<string, unknown>> | null
    checkpointUpdatedAt: string | null
  }>
  readonly safety: Readonly<{
    state: 'clear' | 'stopped'
    stoppedAt: string | null
    clearedAt: string | null
  }>
  readonly guardianAttestation: Readonly<{
    state: 'pending' | 'attested'
    attestedAt: string | null
  }>
  readonly dynamicSourceReadiness: Readonly<{
    state: 'ready' | 'not-ready'
    curriculumReleaseVersion: string
  }>
  readonly syncMetadata: Readonly<{
    lastAuthorityClientOperationId: string | null
    serverAcceptedAt: string
  }>
}

export type HostedStudyRpcHydrateResult =
  | Readonly<{ schemaVersion: 1; status: 'ready'; document: HostedStudyRpcHydrateDocument }>
  | Readonly<{ schemaVersion: 1; status: 'unavailable' }>

export type HostedStudyRpcWriteInput =
  | Readonly<{
      scope: HostedStudyRpcScope
      expectedRevision: number
      clientOperationId: string
      operation: 'checkpoint:compare-and-swap'
      checkpoint: StudyCheckpointRecord
    }>
  | Readonly<{
      scope: HostedStudyRpcScope
      expectedRevision: number
      clientOperationId: string
      operation: 'safety:stop' | 'safety:clear' | 'guardian-attestation:attest'
    }>

export type HostedStudyRpcWriteResult =
  | Readonly<{
      schemaVersion: 1
      status: 'stored'
      operation: HostedStudyRpcWriteInput['operation']
      serverRevision: number
      safetyState?: 'clear' | 'stopped'
      guardianAttestationState?: 'pending' | 'attested'
    }>
  | Readonly<{
      schemaVersion: 1
      status: 'revision-conflict'
      operation: HostedStudyRpcWriteInput['operation']
      serverRevision: number
    }>
  | Readonly<{
      schemaVersion: 1
      status: 'denied'
      code: 'study-session-invalid' | 'actor-not-authorized' | 'study-session-closed'
    }>
  | Readonly<{
      schemaVersion: 1
      status: 'idempotency-collision' | 'invalid-write'
      operation: HostedStudyRpcWriteInput['operation']
      reasonCode?: string
    }>

export type HostedStudyRpcFailureCode =
  | 'OFFLINE'
  | 'NETWORK_UNAVAILABLE'
  | 'TIMEOUT'
  | 'AUTHORIZATION_REQUIRED'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMITED'
  | 'SERVER_UNAVAILABLE'
  | 'MALFORMED_RESPONSE'
  | 'PERMANENT_REFUSAL'
  | 'ABORTED'

export type HostedStudyRpcOutcome<T> =
  | Readonly<{ code: 'SUCCESS'; value: T }>
  | Readonly<{
      code: HostedStudyRpcFailureCode
      httpStatus: number | null
      retryAfterMs: number | null
    }>

export type HostedStudyRpcAuthorizationResult =
  | Readonly<{
      status: 'authorized'
      headers: Readonly<Record<string, string>>
      /** Ephemeral Study grant reference. The RPC client hashes and discards it. */
      studySessionReference: string
    }>
  | Readonly<{ status: 'interrupted' }>

export interface HostedStudyRpcAuthorization {
  authorize(signal?: AbortSignal): Promise<HostedStudyRpcAuthorizationResult>
}

export interface HostedStudyRpcClient {
  hydrate(scope: HostedStudyRpcScope, signal?: AbortSignal): Promise<HostedStudyRpcOutcome<HostedStudyRpcHydrateResult>>
  write(input: HostedStudyRpcWriteInput, signal?: AbortSignal): Promise<HostedStudyRpcOutcome<HostedStudyRpcWriteResult>>
}
