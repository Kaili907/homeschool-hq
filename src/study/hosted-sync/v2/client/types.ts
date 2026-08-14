export const HOSTED_SYNC_CLIENT_PROTOCOL_VERSION = 2 as const

/** Exact functions installed by 20260813172000_academy_study_sync_lossless_v2.sql. */
export const HOSTED_SYNC_RPC = Object.freeze({
  firstLink: 'academy_study_sync_first_link_v2',
  resolveMapping: 'academy_study_sync_resolve_mapping_v2',
  hydrate: 'academy_study_sync_hydrate_v2',
  write: 'academy_study_sync_write_v2',
} as const)

export type HostedSyncRpcName = typeof HOSTED_SYNC_RPC[keyof typeof HOSTED_SYNC_RPC]

export type HostedSyncOutcomeCode =
  | 'SUCCESS' | 'OFFLINE' | 'NETWORK_UNAVAILABLE' | 'TIMEOUT'
  | 'AUTH_REQUIRED' | 'SESSION_EXPIRED' | 'RATE_LIMITED'
  | 'SERVER_UNAVAILABLE' | 'MALFORMED_RESPONSE' | 'PERMANENT_REFUSAL'
  | 'ABORTED'

export const HOSTED_SYNC_OUTCOME_CODES = Object.freeze([
  'SUCCESS', 'OFFLINE', 'NETWORK_UNAVAILABLE', 'TIMEOUT', 'AUTH_REQUIRED',
  'SESSION_EXPIRED', 'RATE_LIMITED', 'SERVER_UNAVAILABLE',
  'MALFORMED_RESPONSE', 'PERMANENT_REFUSAL', 'ABORTED',
] as const satisfies readonly HostedSyncOutcomeCode[])

export interface HostedSyncFailure {
  readonly code: Exclude<HostedSyncOutcomeCode, 'SUCCESS'>
  readonly httpStatus: number | null
  readonly retryAfterMs: number | null
  readonly reasonCode: string | null
}

export type HostedSyncOutcome<T> =
  | Readonly<{ code: 'SUCCESS'; value: T }>
  | HostedSyncFailure

export interface HostedSyncLocalScope {
  readonly householdRef: string
  readonly studentRef: string
  readonly assignmentRef: string
  readonly sessionRef: string
}

export interface HostedSyncHostedScope {
  readonly assignmentRef: string
  readonly sessionRef: string
}

export interface HostedSyncFirstLinkImport {
  readonly localScope: HostedSyncLocalScope
  readonly hostedScope: HostedSyncHostedScope
  readonly session: Readonly<Record<string, unknown>>
  readonly checkpoint: Readonly<Record<string, unknown>> | null
  readonly socialSource: Readonly<Record<string, unknown>> | null
  readonly guardianAttestation: Readonly<Record<string, unknown>> | null
  readonly safetyState: Readonly<{ schemaVersion: 1; holds: readonly Readonly<Record<string, unknown>>[] }>
  readonly assessment: Readonly<Record<string, unknown>> | null
}

export interface HostedSyncFirstLinkInput {
  readonly tokenDigest: string
  readonly studentId: string
  readonly clientOperationId: string
  readonly import: HostedSyncFirstLinkImport
}

export interface HostedSyncResolveMappingInput {
  readonly tokenDigest: string
  readonly studentId: string
  readonly localScope: HostedSyncLocalScope
}

export interface HostedSyncHydrateInput {
  readonly tokenDigest: string
  readonly studentId: string
  readonly assignmentRef: string
  readonly sessionId: string
}

export const HOSTED_SYNC_WRITE_OPERATIONS = Object.freeze([
  'checkpoint:compare-and-swap', 'session:complete', 'social-source:attach',
  'rfl:assert', 'rfl:attest', 'safety:hold', 'safety:clear',
  'assessment:set-state',
] as const)

export type HostedSyncWriteOperation = typeof HOSTED_SYNC_WRITE_OPERATIONS[number]

export interface HostedSyncWriteInput extends HostedSyncHydrateInput {
  readonly expectedRevision: number
  readonly clientOperationId: string
  readonly operation: HostedSyncWriteOperation
  readonly payload: Readonly<Record<string, unknown>>
}

export interface HostedSyncMapping {
  readonly localHouseholdRef: string
  readonly localStudentRef: string
  readonly localAssignmentRef: string
  readonly localSessionRef: string
  readonly hostedHouseholdId: string
  readonly hostedStudentId: string
  readonly hostedAssignmentRef: string
  readonly hostedSessionRef: string
}

export type HostedSyncFirstLinkResult =
  | Readonly<{ schemaVersion: 2; status: 'imported' | 'linked-existing'; mapping: HostedSyncMapping; revisions: Readonly<{ authority: number; session: number; checkpoint: number }> }>
  | Readonly<{ schemaVersion: 2; status: 'mapping-conflict' | 'idempotency-collision' }>
  | Readonly<{ schemaVersion: 2; status: 'denied'; code: string }>

export type HostedSyncResolveMappingResult =
  | Readonly<{ schemaVersion: 2; status: 'mapped'; mapping: HostedSyncMapping }>
  | Readonly<{ schemaVersion: 2; status: 'unavailable' }>

export type HostedSyncHydrateResult =
  | Readonly<{ schemaVersion: 2; status: 'ready'; mapping: HostedSyncMapping; document: Readonly<Record<string, unknown>> }>
  | Readonly<{ schemaVersion: 2; status: 'unavailable' }>

export type HostedSyncWriteResult =
  | Readonly<{ schemaVersion: 2; status: 'stored'; operation: HostedSyncWriteOperation; revisionDomain: 'authority' | 'session' | 'checkpoint'; serverRevision: number; readonly [key: string]: unknown }>
  | Readonly<{ schemaVersion: 2; status: 'revision-conflict'; operation: HostedSyncWriteOperation; revisionDomain: 'authority' | 'session' | 'checkpoint'; serverRevision: number }>
  | Readonly<{ schemaVersion: 2; status: 'invalid-write'; operation: HostedSyncWriteOperation; reasonCode: string }>
  | Readonly<{ schemaVersion: 2; status: 'denied'; code: string }>
  | Readonly<{ schemaVersion: 2; status: 'idempotency-collision'; operation: HostedSyncWriteOperation }>

export type HostedSyncRpcProviderResult =
  | Readonly<{ data: unknown; error: null }>
  | Readonly<{ data: null; error: Readonly<{ code: Exclude<HostedSyncOutcomeCode, 'SUCCESS' | 'OFFLINE' | 'AUTH_REQUIRED' | 'MALFORMED_RESPONSE'>; httpStatus?: number | null; retryAfterMs?: number | null; reasonCode?: string | null }> }>

export interface HostedSyncAuthenticatedRpcProvider {
  rpc(name: HostedSyncRpcName, args: Readonly<Record<string, unknown>>, signal?: AbortSignal): Promise<HostedSyncRpcProviderResult>
}

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
  firstLink(input: HostedSyncFirstLinkInput, signal?: AbortSignal): Promise<HostedSyncOutcome<HostedSyncFirstLinkResult>>
  resolveMapping(input: HostedSyncResolveMappingInput, signal?: AbortSignal): Promise<HostedSyncOutcome<HostedSyncResolveMappingResult>>
  hydrate(input: HostedSyncHydrateInput, signal?: AbortSignal): Promise<HostedSyncOutcome<HostedSyncHydrateResult>>
  write(input: HostedSyncWriteInput, signal?: AbortSignal): Promise<HostedSyncOutcome<HostedSyncWriteResult>>
}

export interface CreateHostedSyncRpcAdapterOptions {
  readonly authorization: HostedSyncEphemeralAuthorization
  readonly isOnline?: () => boolean
  readonly timeoutMs?: number
  readonly now?: () => Date
}
