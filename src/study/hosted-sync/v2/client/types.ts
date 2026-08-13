import type { DurableStudyDocumentV1 } from '../../../family-pilot/durable-ports/schema'

export const HOSTED_SYNC_CLIENT_PROTOCOL_VERSION = 2 as const

export const HOSTED_SYNC_RPC = Object.freeze({
  firstLinkImport: 'academy_study_sync_first_link_import_v2',
  hydrate: 'academy_study_sync_hydrate_v2',
  revisionedWrite: 'academy_study_sync_revisioned_write_v2',
  acknowledge: 'academy_study_sync_acknowledge_v2',
} as const)

export type HostedSyncRpcName = typeof HOSTED_SYNC_RPC[keyof typeof HOSTED_SYNC_RPC]

export type HostedSyncOutcomeCode =
  | 'SUCCESS'
  | 'OFFLINE'
  | 'NETWORK_UNAVAILABLE'
  | 'TIMEOUT'
  | 'AUTH_REQUIRED'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMITED'
  | 'STALE_REVISION'
  | 'SERVER_UNAVAILABLE'
  | 'MALFORMED_RESPONSE'
  | 'PERMANENT_REFUSAL'
  | 'ABORTED'

export const HOSTED_SYNC_OUTCOME_CODES = Object.freeze([
  'SUCCESS',
  'OFFLINE',
  'NETWORK_UNAVAILABLE',
  'TIMEOUT',
  'AUTH_REQUIRED',
  'SESSION_EXPIRED',
  'RATE_LIMITED',
  'STALE_REVISION',
  'SERVER_UNAVAILABLE',
  'MALFORMED_RESPONSE',
  'PERMANENT_REFUSAL',
  'ABORTED',
] as const satisfies readonly HostedSyncOutcomeCode[])

export interface HostedSyncSuccess<T> {
  readonly code: 'SUCCESS'
  readonly value: T
}

export interface HostedSyncFailure {
  readonly code: Exclude<HostedSyncOutcomeCode, 'SUCCESS'>
  readonly httpStatus: number | null
  readonly retryAfterMs: number | null
  /** Present only when a valid CAS refusal disclosed the current revision. */
  readonly serverRevision: number | null
  readonly reasonCode: string | null
}

export type HostedSyncOutcome<T> = HostedSyncSuccess<T> | HostedSyncFailure

export interface HostedSyncIdentity {
  readonly householdRef: string
  readonly learnerRef: string
  readonly documentRef: string
}

/**
 * The hosted payload is the exact locally accepted minimized authority document.
 * No projection is allowed at this boundary because it would make hydrate lossy.
 */
export interface HostedSyncSnapshot {
  readonly documentSchemaVersion: 1
  readonly document: DurableStudyDocumentV1
}

export interface HostedSyncFirstLinkImportInput {
  readonly identity: HostedSyncIdentity
  readonly operationId: string
  readonly baseRevision: 0
  readonly adultConfirmation: 'EXPLICIT_ADULT_CONFIRMED'
  readonly confirmedAt: string
  readonly snapshot: HostedSyncSnapshot
}

export interface HostedSyncHydrateInput {
  readonly identity: HostedSyncIdentity
}

export interface HostedSyncRevisionedWriteInput {
  readonly identity: HostedSyncIdentity
  readonly operationId: string
  readonly baseRevision: number
  readonly snapshot: HostedSyncSnapshot
}

export interface HostedSyncAcknowledgeInput {
  readonly identity: HostedSyncIdentity
  /** Stable UUID for this acknowledgement, retained across every retry. */
  readonly operationId: string
  readonly acknowledgedOperationId: string
  readonly serverRevision: number
}

export interface HostedSyncStoredResult {
  readonly operationId: string
  readonly serverRevision: number
  readonly acceptedAt: string
  readonly duplicate: boolean
}

export type HostedSyncHydrateResult =
  | Readonly<{ status: 'UNAVAILABLE' }>
  | Readonly<{
      status: 'READY'
      serverRevision: number
      lastOperationId: string
      snapshot: HostedSyncSnapshot
    }>

export interface HostedSyncAcknowledgedResult {
  readonly operationId: string
  readonly acknowledgedOperationId: string
  readonly serverRevision: number
  readonly acknowledgedAt: string
  readonly duplicate: boolean
}

/** Narrow Supabase/PostgREST-shaped result, injected by the authenticated client. */
export type HostedSyncRpcProviderResult =
  | Readonly<{ data: unknown; error: null }>
  | Readonly<{
      data: null
      error: Readonly<{
        code:
          | 'NETWORK_UNAVAILABLE'
          | 'TIMEOUT'
          | 'SESSION_EXPIRED'
          | 'RATE_LIMITED'
          | 'SERVER_UNAVAILABLE'
          | 'PERMANENT_REFUSAL'
          | 'ABORTED'
        httpStatus?: number | null
        retryAfterMs?: number | null
        reasonCode?: string | null
      }>
    }>

export interface HostedSyncAuthenticatedRpcProvider {
  rpc(
    name: HostedSyncRpcName,
    args: Readonly<Record<string, unknown>>,
    signal?: AbortSignal,
  ): Promise<HostedSyncRpcProviderResult>
}

/**
 * An authorization lease is memory-only and scoped to one RPC attempt. The
 * adapter never receives a bearer, refresh token, PIN, cookie, or service key.
 */
export interface HostedSyncEphemeralAuthorizationLease {
  readonly clientKind: 'AUTHENTICATED_USER'
  readonly expiresAt: string
  readonly provider: HostedSyncAuthenticatedRpcProvider
  release?(): void
}

export type HostedSyncAuthorizationResult =
  | Readonly<{ status: 'AUTHORIZED'; lease: HostedSyncEphemeralAuthorizationLease }>
  | Readonly<{ status: 'AUTH_REQUIRED' | 'SESSION_EXPIRED' }>

export interface HostedSyncEphemeralAuthorization {
  acquire(signal?: AbortSignal): Promise<HostedSyncAuthorizationResult>
}

export interface HostedSyncRpcAdapter {
  firstLinkImport(
    input: HostedSyncFirstLinkImportInput,
    signal?: AbortSignal,
  ): Promise<HostedSyncOutcome<HostedSyncStoredResult>>
  hydrate(
    input: HostedSyncHydrateInput,
    signal?: AbortSignal,
  ): Promise<HostedSyncOutcome<HostedSyncHydrateResult>>
  revisionedWrite(
    input: HostedSyncRevisionedWriteInput,
    signal?: AbortSignal,
  ): Promise<HostedSyncOutcome<HostedSyncStoredResult>>
  acknowledge(
    input: HostedSyncAcknowledgeInput,
    signal?: AbortSignal,
  ): Promise<HostedSyncOutcome<HostedSyncAcknowledgedResult>>
}

export interface CreateHostedSyncRpcAdapterOptions {
  readonly authorization: HostedSyncEphemeralAuthorization
  readonly isOnline?: () => boolean
  readonly timeoutMs?: number
  readonly now?: () => Date
}

export type HostedSyncFirstLinkImportRpcArgs = Readonly<{
  p_schema_version: 2
  p_household_ref: string
  p_learner_ref: string
  p_document_ref: string
  p_operation_id: string
  p_base_revision: 0
  p_adult_confirmation: 'EXPLICIT_ADULT_CONFIRMED'
  p_confirmed_at: string
  p_snapshot: HostedSyncSnapshot
}>

export type HostedSyncHydrateRpcArgs = Readonly<{
  p_schema_version: 2
  p_household_ref: string
  p_learner_ref: string
  p_document_ref: string
}>

export type HostedSyncRevisionedWriteRpcArgs = Readonly<{
  p_schema_version: 2
  p_household_ref: string
  p_learner_ref: string
  p_document_ref: string
  p_operation_id: string
  p_base_revision: number
  p_snapshot: HostedSyncSnapshot
}>

export type HostedSyncAcknowledgeRpcArgs = Readonly<{
  p_schema_version: 2
  p_household_ref: string
  p_learner_ref: string
  p_document_ref: string
  p_operation_id: string
  p_acknowledged_operation_id: string
  p_server_revision: number
}>

export type HostedSyncStoredRpcResponse = Readonly<{
  schema_version: 2
  status: 'stored' | 'duplicate'
  operation_id: string
  server_revision: number
  accepted_at: string
}>

export type HostedSyncStaleRpcResponse = Readonly<{
  schema_version: 2
  status: 'stale_revision'
  operation_id: string
  server_revision: number
}>

export type HostedSyncRefusedRpcResponse = Readonly<{
  schema_version: 2
  status: 'refused'
  reason_code: string
}>

export type HostedSyncHydrateRpcResponse =
  | Readonly<{ schema_version: 2; status: 'unavailable' }>
  | Readonly<{
      schema_version: 2
      status: 'ready'
      server_revision: number
      last_operation_id: string
      snapshot: HostedSyncSnapshot
    }>

export type HostedSyncAcknowledgeRpcResponse = Readonly<{
  schema_version: 2
  status: 'acknowledged' | 'duplicate'
  operation_id: string
  acknowledged_operation_id: string
  server_revision: number
  acknowledged_at: string
}>
