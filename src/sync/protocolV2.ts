import {
  ACADEMY_SYNC_PROTOCOL_VERSION,
  type CredentialFreeEducationalProfile,
  parseProfileId,
  type ProfileId,
} from '../security/contracts'
import {
  CredentialBearingProfileError,
  InvalidEducationalProfileError,
  readEducationalProfile,
  serializeCredentialFreeEducationalProfile,
  type CanonicalCredentialFreeEducationalProfile,
  type EducationalProfileInput,
  type LegacyPinHandoff,
} from './credentialFreeProfile'

export const ACADEMY_SYNC_SNAPSHOT_V2_RPC = 'academy_sync_snapshot_v2' as const
export const ACADEMY_APPLY_PROFILE_MUTATION_V2_RPC =
  'academy_apply_profile_mutation_v2' as const

export type AcademySyncV2RpcName =
  | typeof ACADEMY_SYNC_SNAPSHOT_V2_RPC
  | typeof ACADEMY_APPLY_PROFILE_MUTATION_V2_RPC

export interface AcademySyncSnapshotV2Params {
  readonly p_sync_protocol_version: typeof ACADEMY_SYNC_PROTOCOL_VERSION
}

export interface CredentialFreeProfileMutationRow {
  readonly profile_id: ProfileId
  readonly data: CanonicalCredentialFreeEducationalProfile
  readonly updated_at: string
}

export interface AcademyApplyProfileMutationV2Params {
  readonly p_sync_protocol_version: typeof ACADEMY_SYNC_PROTOCOL_VERSION
  readonly p_expected_revision: string
  readonly p_mutation_id: string
  readonly p_profiles: readonly CredentialFreeProfileMutationRow[]
}

export interface AcademySyncV2RpcParamsByName {
  readonly academy_sync_snapshot_v2: AcademySyncSnapshotV2Params
  readonly academy_apply_profile_mutation_v2: AcademyApplyProfileMutationV2Params
}

export interface AcademySyncV2TransportError {
  readonly message: string
  readonly code?: string
  readonly status?: number
}

export type AcademySyncV2ProtocolControlError =
  | Readonly<{
      message: string
      code?: string
      status: 'maintenance'
      mode: 'maintenance'
      syncProtocolVersion: number
      minimumSupportedSyncVersion: number
      retryAfter?: string
    }>
  | Readonly<{
      message: string
      code?: string
      status: 'update-required'
      mode: 'update-required'
      syncProtocolVersion: number
      minimumSupportedSyncVersion: number
      retryAfter?: never
    }>

export type AcademySyncV2RpcError =
  AcademySyncV2TransportError | AcademySyncV2ProtocolControlError

export interface AcademySyncV2RpcResponse {
  readonly data: unknown
  readonly error: AcademySyncV2RpcError | null
}

export interface AcademySyncV2RpcQuery extends PromiseLike<AcademySyncV2RpcResponse> {
  abortSignal?(signal: AbortSignal): AcademySyncV2RpcQuery
}

/** Minimal typed surface implemented by a Supabase client and simple test mocks. */
export interface AcademySyncV2RpcClient {
  rpc<Name extends AcademySyncV2RpcName>(
    functionName: Name,
    params: AcademySyncV2RpcParamsByName[Name],
  ): AcademySyncV2RpcQuery
}

interface NormalSyncControls {
  readonly automaticWrites: 'enabled'
  readonly manualWrites: 'enabled'
  readonly debouncedWrites: 'enabled'
  readonly reconnectWrites: 'enabled'
  readonly retryTimers: 'enabled'
}

interface PausedSyncControls {
  readonly automaticWrites: 'paused'
  readonly manualWrites: 'paused'
  readonly debouncedWrites: 'paused'
  readonly reconnectWrites: 'paused'
  readonly retryTimers: 'disabled'
}

interface StoppedSyncControls {
  readonly automaticWrites: 'stopped'
  readonly manualWrites: 'stopped'
  readonly debouncedWrites: 'stopped'
  readonly reconnectWrites: 'stopped'
  readonly retryTimers: 'disabled'
}

export type AcademySyncV2ClientState =
  | Readonly<{
      status: 'normal'
      syncProtocolVersion: typeof ACADEMY_SYNC_PROTOCOL_VERSION
      controls: NormalSyncControls
    }>
  | Readonly<{
      status: 'maintenance'
      syncProtocolVersion: number
      minimumSupportedSyncVersion: number
      retryAfter?: string
      message: string
      controls: PausedSyncControls
    }>
  | Readonly<{
      status: 'update-required'
      syncProtocolVersion: number
      minimumSupportedSyncVersion: number
      refreshRequired: true
      message: string
      controls: StoppedSyncControls
    }>

const NORMAL_STATE: Extract<AcademySyncV2ClientState, { status: 'normal' }> =
  Object.freeze({
    status: 'normal',
    syncProtocolVersion: ACADEMY_SYNC_PROTOCOL_VERSION,
    controls: Object.freeze({
      automaticWrites: 'enabled',
      manualWrites: 'enabled',
      debouncedWrites: 'enabled',
      reconnectWrites: 'enabled',
      retryTimers: 'enabled',
    }),
  })

export type AcademySyncV2OutcomeClass =
  | 'network-transient'
  | 'cas-conflict'
  | 'maintenance'
  | 'unsupported-protocol-update-required'
  | 'credential-bearing-payload-rejection'
  | 'authentication-provenance-mismatch'

export type AcademySyncV2ReconciliationDirective =
  | 'retry-with-backoff'
  | 'parent-review'
  | 'paused-preserve-local'
  | 'refresh-required-preserve-local'

export interface AcademySyncV2Failure {
  readonly ok: false
  readonly classification: AcademySyncV2OutcomeClass
  readonly retry: 'backoff' | 'never'
  readonly preserveLocalEducationalData: true
  readonly reconciliation: AcademySyncV2ReconciliationDirective
  readonly message: string
  readonly state: AcademySyncV2ClientState
  readonly revision?: string
}

export interface RemoteEducationalProfileRowV2 {
  readonly profile_id: ProfileId
  readonly data: CanonicalCredentialFreeEducationalProfile
  readonly updated_at: string
}

export interface AcademySyncV2SnapshotSuccess {
  readonly ok: true
  readonly operation: 'snapshot'
  readonly rows: readonly RemoteEducationalProfileRowV2[]
  readonly revision: string
  readonly legacyCredentialHandoffs: readonly LegacyPinHandoff[]
  readonly state: Extract<AcademySyncV2ClientState, { status: 'normal' }>
}

export interface AcademySyncV2MutationSuccess {
  readonly ok: true
  readonly operation: 'mutation'
  readonly status: 'applied' | 'replayed'
  readonly revision: string
  readonly state: Extract<AcademySyncV2ClientState, { status: 'normal' }>
}

export type AcademySyncV2OperationResult =
  | AcademySyncV2SnapshotSuccess
  | AcademySyncV2MutationSuccess
  | AcademySyncV2Failure

export interface ProfileMutationRowInput {
  readonly profile_id: string
  readonly data: EducationalProfileInput
  readonly updated_at: string
}

export interface AcademySyncV2MutationRequest {
  readonly expectedRevision: string
  readonly mutationId: string
  readonly profiles: readonly ProfileMutationRowInput[]
  readonly signal?: AbortSignal
}

export type AcademySyncV2SnapshotIntent =
  | 'automatic'
  | 'manual'
  | 'maintenance-probe'

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function positiveSafeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : null
}

function aliasedPositiveInteger(
  record: Record<string, unknown>,
  snakeCaseKey: string,
  camelCaseKey: string,
): number | null {
  const hasSnakeCase = Object.prototype.hasOwnProperty.call(
    record,
    snakeCaseKey,
  )
  const hasCamelCase = Object.prototype.hasOwnProperty.call(
    record,
    camelCaseKey,
  )
  if (hasSnakeCase === hasCamelCase) return null
  return positiveSafeInteger(record[hasSnakeCase ? snakeCaseKey : camelCaseKey])
}

function advertisedProtocol(record: Record<string, unknown>): number | null {
  return aliasedPositiveInteger(
    record,
    'sync_protocol_version',
    'syncProtocolVersion',
  )
}

function advertisedMinimum(record: Record<string, unknown>): number | null {
  return aliasedPositiveInteger(
    record,
    'minimum_supported_sync_version',
    'minimumSupportedSyncVersion',
  )
}

type ValidatedProtocolControl =
  | Readonly<{
      status: 'maintenance'
      mode: 'maintenance'
      syncProtocolVersion: number
      minimumSupportedSyncVersion: number
      retryAfter?: string
    }>
  | Readonly<{
      status: 'update-required'
      mode: 'update-required'
      syncProtocolVersion: number
      minimumSupportedSyncVersion: number
    }>

type ProtocolControlParseResult =
  | Readonly<{ kind: 'not-control' }>
  | Readonly<{ kind: 'invalid-control' }>
  | Readonly<{ kind: 'valid-control'; control: ValidatedProtocolControl }>

const CONTROL_STATUSES = new Set(['maintenance', 'update-required'])

type ProtocolControlSource = 'response' | 'typed-error'

const RESPONSE_CONTROL_KEYS = new Set([
  'status',
  'mode',
  'sync_protocol_version',
  'syncProtocolVersion',
  'minimum_supported_sync_version',
  'minimumSupportedSyncVersion',
  'retry_after',
  'retryAfter',
])

const TYPED_ERROR_CONTROL_KEYS = new Set([
  'message',
  'code',
  'status',
  'mode',
  'syncProtocolVersion',
  'minimumSupportedSyncVersion',
  'retryAfter',
])

function hasOnlyDataProperties(
  record: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
): boolean {
  try {
    return Reflect.ownKeys(record).every((key) => {
      if (typeof key !== 'string' || !allowedKeys.has(key)) return false
      const descriptor = Object.getOwnPropertyDescriptor(record, key)
      return !!descriptor && descriptor.enumerable && 'value' in descriptor
    })
  } catch {
    return false
  }
}

function aliasedOptionalRetryAfter(record: Record<string, unknown>): {
  readonly valid: boolean
  readonly value?: string
} {
  const hasSnakeCase = Object.prototype.hasOwnProperty.call(
    record,
    'retry_after',
  )
  const hasCamelCase = Object.prototype.hasOwnProperty.call(
    record,
    'retryAfter',
  )
  if (hasSnakeCase && hasCamelCase) return { valid: false }
  if (!hasSnakeCase && !hasCamelCase) return { valid: true }
  const value = record[hasSnakeCase ? 'retry_after' : 'retryAfter']
  return typeof value === 'string' && value.length > 0 && value.length <= 256
    ? { valid: true, value }
    : { valid: false }
}

function parseProtocolControl(
  record: Record<string, unknown>,
  source: ProtocolControlSource,
): ProtocolControlParseResult {
  const status = record.status
  const mode = record.mode
  const isCandidate =
    (typeof status === 'string' && CONTROL_STATUSES.has(status)) ||
    (typeof mode === 'string' && CONTROL_STATUSES.has(mode))
  if (!isCandidate) return { kind: 'not-control' }
  const allowedKeys =
    source === 'response' ? RESPONSE_CONTROL_KEYS : TYPED_ERROR_CONTROL_KEYS
  if (!hasOnlyDataProperties(record, allowedKeys)) {
    return { kind: 'invalid-control' }
  }
  if (
    source === 'typed-error' &&
    (typeof record.message !== 'string' ||
      (Object.prototype.hasOwnProperty.call(record, 'code') &&
        typeof record.code !== 'string') ||
      Object.prototype.hasOwnProperty.call(record, 'sync_protocol_version') ||
      Object.prototype.hasOwnProperty.call(
        record,
        'minimum_supported_sync_version',
      ) ||
      Object.prototype.hasOwnProperty.call(record, 'retry_after'))
  ) {
    return { kind: 'invalid-control' }
  }
  if (
    (status !== 'maintenance' && status !== 'update-required') ||
    mode !== status
  ) {
    return { kind: 'invalid-control' }
  }

  const syncProtocolVersion = advertisedProtocol(record)
  const minimumSupportedSyncVersion = advertisedMinimum(record)
  if (
    syncProtocolVersion === null ||
    minimumSupportedSyncVersion === null ||
    syncProtocolVersion < minimumSupportedSyncVersion
  ) {
    return { kind: 'invalid-control' }
  }

  const retryAfter = aliasedOptionalRetryAfter(record)
  if (!retryAfter.valid) return { kind: 'invalid-control' }
  if (status === 'update-required') {
    if (
      minimumSupportedSyncVersion <= ACADEMY_SYNC_PROTOCOL_VERSION ||
      retryAfter.value !== undefined
    ) {
      return { kind: 'invalid-control' }
    }
    return {
      kind: 'valid-control',
      control: {
        status,
        mode: status,
        syncProtocolVersion,
        minimumSupportedSyncVersion,
      },
    }
  }
  if (minimumSupportedSyncVersion > ACADEMY_SYNC_PROTOCOL_VERSION) {
    return { kind: 'invalid-control' }
  }
  return {
    kind: 'valid-control',
    control: {
      status,
      mode: status,
      syncProtocolVersion,
      minimumSupportedSyncVersion,
      ...(retryAfter.value ? { retryAfter: retryAfter.value } : {}),
    },
  }
}

function isValidNormalProtocolAdvertisement(
  record: Record<string, unknown>,
): boolean {
  const syncProtocolVersion = advertisedProtocol(record)
  const minimumSupportedSyncVersion = advertisedMinimum(record)
  return (
    syncProtocolVersion === ACADEMY_SYNC_PROTOCOL_VERSION &&
    minimumSupportedSyncVersion !== null &&
    minimumSupportedSyncVersion <= ACADEMY_SYNC_PROTOCOL_VERSION
  )
}

function parseRevision(value: unknown): string | null {
  if (
    (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)) ||
    (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
  ) {
    return String(value)
  }
  return null
}

function maintenanceState(
  control: Extract<ValidatedProtocolControl, { status: 'maintenance' }>,
): Extract<AcademySyncV2ClientState, { status: 'maintenance' }> {
  return {
    status: 'maintenance',
    syncProtocolVersion: control.syncProtocolVersion,
    minimumSupportedSyncVersion: control.minimumSupportedSyncVersion,
    ...(control.retryAfter ? { retryAfter: control.retryAfter } : {}),
    message:
      'Academy cloud sync is paused for maintenance. Unsynced educational work remains on this device.',
    controls: {
      automaticWrites: 'paused',
      manualWrites: 'paused',
      debouncedWrites: 'paused',
      reconnectWrites: 'paused',
      retryTimers: 'disabled',
    },
  }
}

function updateRequiredState(
  control: Extract<ValidatedProtocolControl, { status: 'update-required' }>,
): Extract<AcademySyncV2ClientState, { status: 'update-required' }> {
  return {
    status: 'update-required',
    syncProtocolVersion: control.syncProtocolVersion,
    minimumSupportedSyncVersion: control.minimumSupportedSyncVersion,
    refreshRequired: true,
    message:
      'This Academy client must be refreshed before cloud sync can continue. Unsynced educational work remains on this device.',
    controls: {
      automaticWrites: 'stopped',
      manualWrites: 'stopped',
      debouncedWrites: 'stopped',
      reconnectWrites: 'stopped',
      retryTimers: 'disabled',
    },
  }
}

function reconciliationFor(
  classification: AcademySyncV2OutcomeClass,
): AcademySyncV2ReconciliationDirective {
  switch (classification) {
    case 'network-transient':
      return 'retry-with-backoff'
    case 'maintenance':
      return 'paused-preserve-local'
    case 'unsupported-protocol-update-required':
      return 'refresh-required-preserve-local'
    case 'cas-conflict':
    case 'credential-bearing-payload-rejection':
    case 'authentication-provenance-mismatch':
      return 'parent-review'
  }
}

function failure(
  classification: AcademySyncV2OutcomeClass,
  message: string,
  state: AcademySyncV2ClientState,
  revision?: string,
): AcademySyncV2Failure {
  const retry =
    classification === 'network-transient' && state.status === 'normal'
      ? 'backoff'
      : 'never'
  const reconciliation =
    state.status === 'maintenance'
      ? 'paused-preserve-local'
      : state.status === 'update-required'
        ? 'refresh-required-preserve-local'
        : reconciliationFor(classification)
  return {
    ok: false,
    classification,
    retry,
    preserveLocalEducationalData: true,
    reconciliation,
    message,
    state,
    ...(revision ? { revision } : {}),
  }
}

function errorClassification(
  error: AcademySyncV2RpcError,
): AcademySyncV2OutcomeClass {
  const code = (error.code ?? '').toUpperCase()
  if (
    (typeof error.status === 'number' &&
      (error.status === 408 ||
        error.status === 425 ||
        error.status === 429 ||
        error.status >= 500)) ||
    /^08/.test(code) ||
    ['PGRST000', 'PGRST001', '53300', '57P01'].includes(code)
  ) {
    return 'network-transient'
  }
  if (code === 'ACADEMY_SYNC_CAS_CONFLICT') return 'cas-conflict'
  if (code === 'ACADEMY_SYNC_CREDENTIAL_PAYLOAD') {
    return 'credential-bearing-payload-rejection'
  }
  return 'authentication-provenance-mismatch'
}

function messageForClassification(
  classification: AcademySyncV2OutcomeClass,
): string {
  switch (classification) {
    case 'network-transient':
      return 'A temporary network error interrupted Academy sync. Local educational work is preserved.'
    case 'cas-conflict':
      return 'Another device updated this household first. Review is required; the client will not retry blindly.'
    case 'maintenance':
      return 'Academy cloud sync is paused for maintenance. Local educational work is preserved.'
    case 'unsupported-protocol-update-required':
      return 'This client bundle does not support the server sync protocol. Refresh is required.'
    case 'credential-bearing-payload-rejection':
      return 'A credential-bearing profile payload was rejected before synchronization.'
    case 'authentication-provenance-mismatch':
      return 'The authenticated household or synchronization provenance did not match.'
  }
}

function mutationPayload(
  rows: readonly ProfileMutationRowInput[],
): readonly CredentialFreeProfileMutationRow[] {
  if (rows.length > 5) {
    throw new InvalidEducationalProfileError(
      'Too many profiles were supplied for synchronization.',
    )
  }
  const ids = new Set<ProfileId>()
  return rows.map((row) => {
    const profileId = parseProfileId(row.profile_id)
    if (
      !profileId ||
      ids.has(profileId) ||
      typeof row.updated_at !== 'string' ||
      row.updated_at.length > 64 ||
      Number.isNaN(Date.parse(row.updated_at))
    ) {
      throw new InvalidEducationalProfileError()
    }
    const data = serializeCredentialFreeEducationalProfile(row.data)
    if (data.id !== profileId) throw new InvalidEducationalProfileError()
    ids.add(profileId)
    return {
      profile_id: profileId,
      data,
      updated_at: row.updated_at,
    }
  })
}

async function invokeRpc<Name extends AcademySyncV2RpcName>(
  client: AcademySyncV2RpcClient,
  name: Name,
  params: AcademySyncV2RpcParamsByName[Name],
  signal?: AbortSignal,
): Promise<AcademySyncV2RpcResponse> {
  let query = client.rpc(name, params)
  if (signal && typeof query.abortSignal === 'function') {
    query = query.abortSignal(signal)
  }
  return await query
}

interface ParsedSnapshotRows {
  readonly rows: readonly RemoteEducationalProfileRowV2[]
  readonly handoffs: readonly LegacyPinHandoff[]
}

function parseSnapshotRows(
  value: unknown,
): ParsedSnapshotRows | AcademySyncV2Failure {
  if (
    !Array.isArray(value) ||
    value.length > 5 ||
    Object.keys(value).length !== value.length
  ) {
    return failure(
      'authentication-provenance-mismatch',
      'The cloud returned an invalid profile list.',
      NORMAL_STATE,
    )
  }
  const ids = new Set<ProfileId>()
  const rows: RemoteEducationalProfileRowV2[] = []
  const handoffs: LegacyPinHandoff[] = []
  for (const candidate of value) {
    if (!plainRecord(candidate)) {
      return failure(
        'authentication-provenance-mismatch',
        'The cloud returned an invalid profile row.',
        NORMAL_STATE,
      )
    }
    const profileId = parseProfileId(candidate.profile_id)
    const updatedAt = candidate.updated_at
    if (
      !profileId ||
      ids.has(profileId) ||
      typeof updatedAt !== 'string' ||
      updatedAt.length > 64 ||
      Number.isNaN(Date.parse(updatedAt))
    ) {
      return failure(
        'authentication-provenance-mismatch',
        'The cloud returned an invalid profile row.',
        NORMAL_STATE,
      )
    }
    const read = readEducationalProfile(candidate.data)
    if (!read.ok) {
      const classification =
        read.classification === 'credential-bearing-payload-rejection'
          ? read.classification
          : 'authentication-provenance-mismatch'
      return failure(
        classification,
        messageForClassification(classification),
        NORMAL_STATE,
      )
    }
    if (read.profile.id !== profileId) {
      return failure(
        'authentication-provenance-mismatch',
        'The cloud profile identity did not match its row provenance.',
        NORMAL_STATE,
      )
    }
    ids.add(profileId)
    rows.push({
      profile_id: profileId,
      data: read.profile,
      updated_at: updatedAt,
    })
    if (read.legacyCredentialHandoff)
      handoffs.push(read.legacyCredentialHandoff)
  }
  return { rows, handoffs }
}

function isParsedSnapshotRows(
  value: ParsedSnapshotRows | AcademySyncV2Failure,
): value is ParsedSnapshotRows {
  return !('ok' in value)
}

/**
 * Credential-free Sync Protocol v2 client. It has no singleton and performs no
 * hosted call unless an injected RPC client is explicitly invoked by wiring.
 */
export class AcademySyncV2Client {
  #state: AcademySyncV2ClientState = NORMAL_STATE

  constructor(private readonly rpcClient: AcademySyncV2RpcClient) {}

  get state(): AcademySyncV2ClientState {
    return this.#state
  }

  async snapshot(
    options: {
      readonly intent?: AcademySyncV2SnapshotIntent
      readonly signal?: AbortSignal
    } = {},
  ): Promise<AcademySyncV2SnapshotSuccess | AcademySyncV2Failure> {
    const intent = options.intent ?? 'automatic'
    if (this.#state.status === 'update-required') {
      return failure(
        'unsupported-protocol-update-required',
        this.#state.message,
        this.#state,
      )
    }
    if (
      this.#state.status === 'maintenance' &&
      intent !== 'maintenance-probe'
    ) {
      return failure('maintenance', this.#state.message, this.#state)
    }
    if (options.signal?.aborted) {
      return failure(
        'authentication-provenance-mismatch',
        'The synchronization operation context ended before dispatch.',
        this.#state,
      )
    }

    let response: AcademySyncV2RpcResponse
    try {
      response = await invokeRpc(
        this.rpcClient,
        ACADEMY_SYNC_SNAPSHOT_V2_RPC,
        { p_sync_protocol_version: ACADEMY_SYNC_PROTOCOL_VERSION },
        options.signal,
      )
    } catch {
      const classification = options.signal?.aborted
        ? 'authentication-provenance-mismatch'
        : 'network-transient'
      return failure(
        classification,
        messageForClassification(classification),
        this.#state,
      )
    }
    if (response.error) return this.#failureFromRpcError(response.error)
    if (!plainRecord(response.data)) {
      return failure(
        'authentication-provenance-mismatch',
        'The cloud returned an invalid Sync Protocol v2 snapshot.',
        this.#state,
      )
    }
    const controlled = this.#serverControl(response.data)
    if (controlled) return controlled
    const status = response.data.status
    const mode = response.data.mode
    const acceptedSnapshotShape =
      isValidNormalProtocolAdvertisement(response.data) &&
      mode === 'normal' &&
      (status === 'ok' || status === 'normal')
    if (!acceptedSnapshotShape) {
      return failure(
        'authentication-provenance-mismatch',
        'The cloud returned an unknown Sync Protocol v2 snapshot result.',
        this.#state,
      )
    }
    const revision = parseRevision(response.data.revision)
    const parsed = parseSnapshotRows(response.data.rows)
    if (!revision) {
      return failure(
        'authentication-provenance-mismatch',
        'The cloud returned an invalid Sync Protocol v2 revision.',
        this.#state,
      )
    }
    if (!isParsedSnapshotRows(parsed)) return { ...parsed, state: this.#state }
    this.#state = NORMAL_STATE
    return {
      ok: true,
      operation: 'snapshot',
      rows: parsed.rows,
      revision,
      legacyCredentialHandoffs: parsed.handoffs,
      state: NORMAL_STATE,
    }
  }

  async applyMutation(
    request: AcademySyncV2MutationRequest,
  ): Promise<AcademySyncV2MutationSuccess | AcademySyncV2Failure> {
    if (this.#state.status === 'update-required') {
      return failure(
        'unsupported-protocol-update-required',
        this.#state.message,
        this.#state,
      )
    }
    if (this.#state.status === 'maintenance') {
      return failure('maintenance', this.#state.message, this.#state)
    }
    if (request.signal?.aborted) {
      return failure(
        'authentication-provenance-mismatch',
        'The synchronization operation context ended before dispatch.',
        this.#state,
      )
    }
    if (
      !/^(0|[1-9]\d*)$/.test(request.expectedRevision) ||
      request.mutationId.length === 0 ||
      request.mutationId.length > 200
    ) {
      return failure(
        'authentication-provenance-mismatch',
        'The mutation provenance was invalid.',
        this.#state,
      )
    }

    let profiles: readonly CredentialFreeProfileMutationRow[]
    try {
      profiles = mutationPayload(request.profiles)
    } catch (cause) {
      const classification =
        cause instanceof CredentialBearingProfileError
          ? 'credential-bearing-payload-rejection'
          : 'authentication-provenance-mismatch'
      return failure(
        classification,
        messageForClassification(classification),
        this.#state,
      )
    }

    let response: AcademySyncV2RpcResponse
    try {
      response = await invokeRpc(
        this.rpcClient,
        ACADEMY_APPLY_PROFILE_MUTATION_V2_RPC,
        {
          p_sync_protocol_version: ACADEMY_SYNC_PROTOCOL_VERSION,
          p_expected_revision: request.expectedRevision,
          p_mutation_id: request.mutationId,
          p_profiles: profiles,
        },
        request.signal,
      )
    } catch {
      const classification = request.signal?.aborted
        ? 'authentication-provenance-mismatch'
        : 'network-transient'
      return failure(
        classification,
        messageForClassification(classification),
        this.#state,
      )
    }
    if (response.error) return this.#failureFromRpcError(response.error)
    if (!plainRecord(response.data)) {
      return failure(
        'authentication-provenance-mismatch',
        'The cloud returned an invalid Sync Protocol v2 mutation result.',
        this.#state,
      )
    }
    const controlled = this.#serverControl(response.data)
    if (controlled) return controlled
    const status = response.data.status
    const mode = response.data.mode
    const revision = parseRevision(response.data.revision)
    if (
      !isValidNormalProtocolAdvertisement(response.data) ||
      (mode !== undefined && mode !== 'normal')
    ) {
      return failure(
        'authentication-provenance-mismatch',
        'The cloud returned an unknown Sync Protocol v2 mutation result.',
        this.#state,
      )
    }
    if (status === 'conflict') {
      return failure(
        'cas-conflict',
        messageForClassification('cas-conflict'),
        this.#state,
        revision ?? undefined,
      )
    }
    if (
      status === 'credential-rejected' ||
      status === 'credential-bearing-payload'
    ) {
      return failure(
        'credential-bearing-payload-rejection',
        messageForClassification('credential-bearing-payload-rejection'),
        this.#state,
      )
    }
    if (
      status === 'authentication-mismatch' ||
      status === 'provenance-mismatch' ||
      status === 'unauthorized'
    ) {
      return failure(
        'authentication-provenance-mismatch',
        messageForClassification('authentication-provenance-mismatch'),
        this.#state,
      )
    }
    if ((status !== 'applied' && status !== 'replayed') || !revision) {
      return failure(
        'authentication-provenance-mismatch',
        'The cloud returned an unknown Sync Protocol v2 mutation result.',
        this.#state,
      )
    }
    this.#state = NORMAL_STATE
    return {
      ok: true,
      operation: 'mutation',
      status,
      revision,
      state: NORMAL_STATE,
    }
  }

  #serverControl(record: Record<string, unknown>): AcademySyncV2Failure | null {
    const parsed = parseProtocolControl(record, 'response')
    if (parsed.kind === 'not-control') return null
    if (parsed.kind === 'invalid-control') {
      return failure(
        'authentication-provenance-mismatch',
        'The cloud returned malformed Sync Protocol v2 compatibility state.',
        this.#state,
      )
    }
    if (parsed.control.status === 'maintenance') {
      this.#state = maintenanceState(parsed.control)
      return failure('maintenance', this.#state.message, this.#state)
    }
    this.#state = updateRequiredState(parsed.control)
    return failure(
      'unsupported-protocol-update-required',
      this.#state.message,
      this.#state,
    )
  }

  #failureFromRpcError(error: AcademySyncV2RpcError): AcademySyncV2Failure {
    if (!plainRecord(error)) {
      return failure(
        'authentication-provenance-mismatch',
        messageForClassification('authentication-provenance-mismatch'),
        this.#state,
      )
    }
    const parsed = parseProtocolControl(error, 'typed-error')
    if (parsed.kind === 'invalid-control') {
      return failure(
        'authentication-provenance-mismatch',
        'The cloud returned malformed Sync Protocol v2 compatibility state.',
        this.#state,
      )
    }
    if (parsed.kind === 'valid-control') {
      if (parsed.control.status === 'maintenance') {
        this.#state = maintenanceState(parsed.control)
        return failure('maintenance', this.#state.message, this.#state)
      }
      this.#state = updateRequiredState(parsed.control)
      return failure(
        'unsupported-protocol-update-required',
        this.#state.message,
        this.#state,
      )
    }
    const classification = errorClassification(error)
    return failure(
      classification,
      messageForClassification(classification),
      this.#state,
    )
  }
}

export interface PreservedUnsyncedEducationalData {
  readonly profiles: Readonly<Record<string, CredentialFreeEducationalProfile>>
  readonly dirtyProfileIds: readonly string[]
  readonly disposition:
    | 'retry-pending'
    | 'parent-review'
    | 'maintenance-paused'
    | 'refresh-required'
}

/** Additive handoff for later reviewed AppState reconciliation. */
export function preserveUnsyncedEducationalData(
  profiles: Readonly<Record<string, CredentialFreeEducationalProfile>>,
  dirtyProfileIds: readonly string[],
  outcome: AcademySyncV2Failure,
): PreservedUnsyncedEducationalData {
  const disposition =
    outcome.classification === 'network-transient'
      ? 'retry-pending'
      : outcome.classification === 'maintenance'
        ? 'maintenance-paused'
        : outcome.classification === 'unsupported-protocol-update-required'
          ? 'refresh-required'
          : 'parent-review'
  return {
    profiles,
    dirtyProfileIds: [...dirtyProfileIds],
    disposition,
  }
}

export interface NetworkRetryOptions {
  readonly maxAttempts?: number
  readonly baseDelayMs?: number
  readonly maximumDelayMs?: number
  readonly wait?: (delayMs: number) => Promise<void>
}

function defaultWait(delayMs: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, delayMs))
}

/** Retry only network/transient outcomes; every other class stops immediately. */
export async function runWithNetworkRetry<
  Result extends AcademySyncV2OperationResult,
>(
  operation: () => Promise<Result>,
  options: NetworkRetryOptions = {},
): Promise<Result> {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 3))
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 250)
  const maximumDelayMs = Math.max(baseDelayMs, options.maximumDelayMs ?? 30_000)
  const wait = options.wait ?? defaultWait
  let result = await operation()
  for (let attempt = 1; attempt < maxAttempts; attempt += 1) {
    if (result.ok || result.retry !== 'backoff') return result
    const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maximumDelayMs)
    await wait(delay)
    result = await operation()
  }
  return result
}
