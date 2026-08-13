import type { DurableStudyDocumentV1 } from '../../family-pilot/durable-ports/schema'

export const STUDY_SYNC_PROTOCOL_VERSION = 1 as const

export type StudySyncOperation = 'HYDRATE' | 'PULL' | 'PUSH' | 'ACKNOWLEDGE'

export interface StudySyncIdentity {
  readonly householdRef: string
  readonly studentRef: string
  readonly documentRef: string
}

export interface StudySyncHydrateStudent {
  readonly studentRef: string
  readonly documentRefs: readonly string[]
}

export interface StudySyncHydrateInput {
  readonly householdRef: string
  readonly students: readonly StudySyncHydrateStudent[]
}

export interface StudySyncPullInput {
  readonly identity: StudySyncIdentity
  /** Omit for a full first pull; otherwise asks for state newer than this revision. */
  readonly afterRevision?: number | null
}

export interface StudySyncPushInput {
  readonly identity: StudySyncIdentity
  /** Stable across every retry of this exact local mutation. */
  readonly operationId: string
  /** Conditional server revision. Conflict policy lives above this transport. */
  readonly baseRevision: number
  readonly document: DurableStudyDocumentV1
}

export interface StudySyncAcknowledgeInput {
  readonly identity: StudySyncIdentity
  /** Stable across retries of this acknowledgement. */
  readonly acknowledgementId: string
  readonly serverRevision: number
}

export interface StudySyncDocumentState {
  readonly documentRef: string
  readonly serverRevision: number
  readonly acknowledgedRevision: number | null
  readonly hasRemoteDocument: boolean
}

export interface StudySyncStudentState {
  readonly studentRef: string
  readonly documents: readonly StudySyncDocumentState[]
}

export interface StudySyncHydrateResult {
  readonly householdRef: string
  readonly students: readonly StudySyncStudentState[]
}

export interface StudySyncPullResult {
  readonly identity: StudySyncIdentity
  readonly serverRevision: number
  readonly document: DurableStudyDocumentV1 | null
}

export interface StudySyncPushResult {
  readonly identity: StudySyncIdentity
  readonly operationId: string
  readonly serverRevision: number
  readonly acceptedAt: string
  /** True when the server had already accepted this operation ID. */
  readonly duplicate: boolean
}

export interface StudySyncAcknowledgeResult {
  readonly identity: StudySyncIdentity
  readonly acknowledgementId: string
  readonly serverRevision: number
  readonly acknowledgedAt: string
  readonly duplicate: boolean
}

export type StudySyncTransportCode =
  | 'SUCCESS'
  | 'OFFLINE'
  | 'NETWORK_UNAVAILABLE'
  | 'TIMEOUT'
  | 'AUTHORIZATION_REQUIRED'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMITED'
  | 'STALE_REVISION'
  | 'SERVER_UNAVAILABLE'
  | 'MALFORMED_RESPONSE'
  | 'PERMANENT_REFUSAL'
  | 'ABORTED'

export type StudySyncRetryClassification =
  | 'RETRY_WITH_BACKOFF'
  | 'RETRY_AFTER_DELAY'
  | 'REAUTHORIZE'
  | 'REBASE_REQUIRED'
  | 'DO_NOT_RETRY'
  | 'ABORTED'

export interface StudySyncSuccess<T> {
  readonly code: 'SUCCESS'
  readonly value: T
}

export interface StudySyncFailure {
  readonly code: Exclude<StudySyncTransportCode, 'SUCCESS'>
  readonly retry: StudySyncRetryClassification
  readonly httpStatus: number | null
  readonly retryAfterMs: number | null
}

export type StudySyncOutcome<T> = StudySyncSuccess<T> | StudySyncFailure

/**
 * Structurally compatible with the accepted historical Study session seam.
 * Returning null means fail closed before fetch. Implementations should keep
 * bearer/session material in a closure and create a fresh map for every call.
 */
export interface StudySyncAuthorization {
  authorizeStudyRequestHeaders(
    headers: Readonly<Record<string, string>>,
  ): Promise<Readonly<Record<string, string>> | null> | Readonly<Record<string, string>> | null
}

export interface StudySyncTransportOptions {
  readonly resolveEndpoint: (operation: StudySyncOperation) => string
  readonly authorization: StudySyncAuthorization
  readonly fetchImpl?: typeof fetch
  readonly isOnline?: () => boolean
  readonly timeoutMs?: number
  readonly now?: () => Date
}

export interface StudySyncTransport {
  hydrate(input: StudySyncHydrateInput, signal?: AbortSignal): Promise<StudySyncOutcome<StudySyncHydrateResult>>
  pull(input: StudySyncPullInput, signal?: AbortSignal): Promise<StudySyncOutcome<StudySyncPullResult>>
  push(input: StudySyncPushInput, signal?: AbortSignal): Promise<StudySyncOutcome<StudySyncPushResult>>
  acknowledge(
    input: StudySyncAcknowledgeInput,
    signal?: AbortSignal,
  ): Promise<StudySyncOutcome<StudySyncAcknowledgeResult>>
}

export type StudySyncRequestContract =
  | Readonly<{
      protocolVersion: typeof STUDY_SYNC_PROTOCOL_VERSION
      operation: 'HYDRATE'
      householdRef: string
      students: readonly StudySyncHydrateStudent[]
    }>
  | Readonly<{
      protocolVersion: typeof STUDY_SYNC_PROTOCOL_VERSION
      operation: 'PULL'
      identity: StudySyncIdentity
      afterRevision: number | null
    }>
  | Readonly<{
      protocolVersion: typeof STUDY_SYNC_PROTOCOL_VERSION
      operation: 'PUSH'
      identity: StudySyncIdentity
      operationId: string
      baseRevision: number
      mutation: 'REPLACE_MINIMIZED_STUDY_DOCUMENT'
      document: DurableStudyDocumentV1
    }>
  | Readonly<{
      protocolVersion: typeof STUDY_SYNC_PROTOCOL_VERSION
      operation: 'ACKNOWLEDGE'
      identity: StudySyncIdentity
      acknowledgementId: string
      serverRevision: number
    }>
export type StudySyncResponseContract =
  | Readonly<{
      protocolVersion: typeof STUDY_SYNC_PROTOCOL_VERSION
      status: 'SUCCESS'
      operation: 'HYDRATE'
      householdRef: string
      students: readonly StudySyncStudentState[]
    }>
  | Readonly<{
      protocolVersion: typeof STUDY_SYNC_PROTOCOL_VERSION
      status: 'SUCCESS'
      operation: 'PULL'
      identity: StudySyncIdentity
      serverRevision: number
      document: DurableStudyDocumentV1 | null
    }>
  | Readonly<{
      protocolVersion: typeof STUDY_SYNC_PROTOCOL_VERSION
      status: 'SUCCESS'
      operation: 'PUSH'
      identity: StudySyncIdentity
      operationId: string
      serverRevision: number
      acceptedAt: string
      duplicate: boolean
    }>
  | Readonly<{
      protocolVersion: typeof STUDY_SYNC_PROTOCOL_VERSION
      status: 'SUCCESS'
      operation: 'ACKNOWLEDGE'
      identity: StudySyncIdentity
      acknowledgementId: string
      serverRevision: number
      acknowledgedAt: string
      duplicate: boolean
    }>
