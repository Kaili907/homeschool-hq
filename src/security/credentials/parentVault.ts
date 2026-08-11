import {
  INSTALLATION_BINDING_SCHEMA_VERSION,
  isInstallationId,
  PARENT_CREDENTIAL_BINDING_SCHEMA_VERSION,
  PARENT_CREDENTIAL_SCHEMA_VERSION,
  PARENT_PIN_VERIFIER_SCHEME_VERSION,
  type InstallationBinding,
  type ParentCredentialBindingReference,
  type ParentCredentialRecord,
} from '../contracts'
import {
  base64ToBytes,
  isFourDigitPin,
  isSupportedPinCostParameters,
  LEARNER_PIN_COST_PARAMETERS_V1,
  LEARNER_PIN_COST_PARAMETERS_VERSION,
  LEARNER_PIN_DERIVED_KEY_BYTES,
  LEARNER_PIN_SALT_BYTES,
} from './pinVerifier'
import {
  createParentPinVerifier,
  createUnusableParentPinVerifier,
  verifyParentPinVerifier,
} from './parentPinVerifier'
import type { CredentialOperationOptions, CredentialStorage } from './vault'

export const PARENT_CREDENTIAL_STORAGE_NAMESPACE =
  'homeschool-hq:security:parent-credentials:v1' as const

export interface StoredParentCredentialRecord extends ParentCredentialRecord {
  readonly costParametersVersion: typeof LEARNER_PIN_COST_PARAMETERS_VERSION
}

export type ParentCredentialVaultErrorCode =
  | 'storage-unavailable'
  | 'invalid-installation-binding'
  | 'credential-missing'
  | 'credential-conflict'
  | 'authorization-required'
  | 'coordination-unavailable'
  | 'binding-mismatch'
  | 'malformed-record'
  | 'unsupported-version'
  | 'persistence-verification-failed'

export class ParentCredentialVaultError extends Error {
  constructor(
    readonly code: ParentCredentialVaultErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ParentCredentialVaultError'
  }
}

export interface ParentCredentialLockManager {
  request<T>(
    name: string,
    options: { readonly mode: 'exclusive' },
    callback: () => T | Promise<T>,
  ): Promise<T>
}

export interface ParentCredentialOperationOptions extends CredentialOperationOptions {
  readonly lockManager?: ParentCredentialLockManager
}

/** Structurally compatible with the shared FailedAttemptLedger parent subject. */
export type ParentFailedAttemptSubject = Readonly<{
  kind: 'parent'
  householdId: string
}>

export type ParentCredentialAvailability = Readonly<
  | { status: 'enrolled'; subject: ParentFailedAttemptSubject }
  | { status: 'parent-setup-required'; subject: ParentFailedAttemptSubject }
  | { status: 'reset-required'; subject: ParentFailedAttemptSubject }
>

export type ParentPinVerificationResult = Readonly<
  | { status: 'verified'; subject: ParentFailedAttemptSubject }
  | { status: 'not-verified'; subject: ParentFailedAttemptSubject }
  | { status: 'parent-setup-required'; subject: ParentFailedAttemptSubject }
  | { status: 'reset-required'; subject: ParentFailedAttemptSubject }
>

export interface ParentCredentialMutationResult {
  readonly status: 'enrolled' | 'reset-required'
  readonly binding: ParentCredentialBindingReference
  readonly subject: ParentFailedAttemptSubject
  readonly createdAt: string
  readonly rotatedAt?: string
}

export interface ParentCredentialRotationAuthorizationContext {
  readonly operationId: 'parent-pin:rotate'
  readonly binding: ParentCredentialBindingReference
  readonly credentialCreatedAt: string
  readonly credentialRotatedAt?: string
}

/** Integration must consume its live Parent credential/session step-up here. */
export interface ParentCredentialRotationAuthorization {
  consumeParentCredentialRotationAuthorization(
    context: ParentCredentialRotationAuthorizationContext,
  ): boolean | Promise<boolean>
}

export interface ParentCredentialResetAuthorizationContext {
  readonly operationId: 'parent-pin:reset-required'
  readonly binding: ParentCredentialBindingReference
  readonly priorState: 'enrolled' | 'reset-required' | 'missing'
}

/** Integration must consume installation claim/recovery authority here. */
export interface ParentCredentialResetAuthorization {
  consumeParentCredentialResetAuthorization(
    context: ParentCredentialResetAuthorizationContext,
  ): boolean | Promise<boolean>
}

const REQUIRED_RECORD_KEYS = Object.freeze([
  'schemaVersion',
  'storage',
  'binding',
  'credentialKind',
  'verifierScheme',
  'verifierSchemeVersion',
  'costParametersVersion',
  'saltBase64',
  'verifierBase64',
  'costParameters',
  'state',
  'createdAt',
] as const)

const BINDING_REFERENCE_KEYS = Object.freeze([
  'schemaVersion',
  'installationId',
  'householdId',
] as const)

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function invalidBinding(message: string): never {
  throw new ParentCredentialVaultError('invalid-installation-binding', message)
}

function malformed(message: string): never {
  throw new ParentCredentialVaultError('malformed-record', message)
}

function recordDataProperty(record: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key)
  if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
    malformed(`Parent credential field ${key} is missing or unsafe.`)
  }
  return descriptor.value
}

function dataProperty(record: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key)
  if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
    invalidBinding(`Installation binding field ${key} is missing or unsafe.`)
  }
  return descriptor.value
}

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (next < 0xdc00 || next > 0xdfff) return true
      index += 1
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true
    }
  }
  return false
}

function isExactBoundedIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 512 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value) &&
    !hasUnpairedSurrogate(value)
  )
}

function validIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
}

/**
 * Requires the authoritative full binding. This module never creates,
 * guesses, or repairs installation identity.
 */
export function parentCredentialBindingReference(
  value: unknown,
): ParentCredentialBindingReference {
  if (!plainRecord(value)) invalidBinding('An authoritative active InstallationBinding is required.')
  const schemaVersion = dataProperty(value, 'schemaVersion')
  const installationId = dataProperty(value, 'installationId')
  const householdId = dataProperty(value, 'householdId')
  const bindingId = dataProperty(value, 'bindingId')
  const datasetEpoch = dataProperty(value, 'datasetEpoch')
  const verifiedActorId = dataProperty(value, 'verifiedActorId')
  const status = dataProperty(value, 'status')
  const boundAt = dataProperty(value, 'boundAt')
  const revokedAt = Object.getOwnPropertyDescriptor(value, 'revokedAt')

  if (
    schemaVersion !== INSTALLATION_BINDING_SCHEMA_VERSION ||
    !isInstallationId(installationId) ||
    !isExactBoundedIdentifier(householdId) ||
    !isExactBoundedIdentifier(bindingId) ||
    !isExactBoundedIdentifier(datasetEpoch) ||
    !isExactBoundedIdentifier(verifiedActorId) ||
    status !== 'active' ||
    !validIsoTimestamp(boundAt) ||
    (revokedAt !== undefined &&
      (!revokedAt.enumerable || !('value' in revokedAt) || revokedAt.value !== undefined))
  ) {
    invalidBinding('Installation binding is invalid, inactive, or incomplete.')
  }

  return Object.freeze({
    schemaVersion: PARENT_CREDENTIAL_BINDING_SCHEMA_VERSION,
    installationId,
    householdId,
  })
}

function activeInstallationBindingSnapshot(
  value: InstallationBinding,
): InstallationBinding {
  const reference = parentCredentialBindingReference(value)
  const record = value as unknown as Record<string, unknown>
  return Object.freeze({
    schemaVersion: INSTALLATION_BINDING_SCHEMA_VERSION,
    bindingId: dataProperty(record, 'bindingId') as string,
    installationId: reference.installationId,
    householdId: reference.householdId,
    datasetEpoch: dataProperty(record, 'datasetEpoch') as string,
    verifiedActorId: dataProperty(record, 'verifiedActorId') as string,
    status: 'active',
    boundAt: dataProperty(record, 'boundAt') as string,
  })
}

function parseStoredBindingReference(value: unknown): ParentCredentialBindingReference {
  if (!plainRecord(value)) malformed('Parent credential binding is not an object.')
  const keys = Object.keys(value)
  const schemaVersion = recordDataProperty(value, 'schemaVersion')
  const installationId = recordDataProperty(value, 'installationId')
  const householdId = recordDataProperty(value, 'householdId')
  if (
    keys.length !== BINDING_REFERENCE_KEYS.length ||
    !keys.every((key) => BINDING_REFERENCE_KEYS.includes(key as never)) ||
    schemaVersion !== PARENT_CREDENTIAL_BINDING_SCHEMA_VERSION ||
    !isInstallationId(installationId) ||
    !isExactBoundedIdentifier(householdId)
  ) {
    malformed('Parent credential binding is malformed.')
  }
  return Object.freeze({
    schemaVersion: PARENT_CREDENTIAL_BINDING_SCHEMA_VERSION,
    installationId,
    householdId,
  })
}

function validStoredCostParameters(value: unknown): boolean {
  if (!plainRecord(value) || Object.keys(value).length !== 2) return false
  return recordDataProperty(value, 'iterations') === LEARNER_PIN_COST_PARAMETERS_V1.iterations &&
    recordDataProperty(value, 'derivedKeyBytes') === LEARNER_PIN_COST_PARAMETERS_V1.derivedKeyBytes
}

function bindingMatches(
  left: ParentCredentialBindingReference,
  right: ParentCredentialBindingReference,
): boolean {
  return left.installationId === right.installationId && left.householdId === right.householdId
}

function storageFrom(options?: ParentCredentialOperationOptions): CredentialStorage {
  if (options?.storage) return options.storage
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Fall through to the fail-closed error.
  }
  throw new ParentCredentialVaultError(
    'storage-unavailable',
    'Device-local Parent credential storage is unavailable.',
  )
}

function timestamp(options?: ParentCredentialOperationOptions): string {
  const value = (options?.now ?? (() => new Date()))().toISOString()
  if (!validIsoTimestamp(value)) throw new Error('Parent credential clock returned an invalid timestamp.')
  return value
}

function storageKeyForReference(binding: ParentCredentialBindingReference): string {
  return `${PARENT_CREDENTIAL_STORAGE_NAMESPACE}:${encodeURIComponent(binding.installationId)}:${encodeURIComponent(binding.householdId)}`
}

function lockManagerFrom(options?: ParentCredentialOperationOptions): ParentCredentialLockManager {
  if (options?.lockManager) return options.lockManager
  const candidate = typeof navigator === 'undefined'
    ? undefined
    : (navigator as Navigator & { readonly locks?: ParentCredentialLockManager }).locks
  if (candidate && typeof candidate.request === 'function') return candidate
  throw new ParentCredentialVaultError(
    'coordination-unavailable',
    'Exclusive Parent credential mutation coordination is unavailable.',
  )
}

function mutationLockName(reference: ParentCredentialBindingReference): string {
  return `homeschool-hq:security:parent-credential-lock:v1:${encodeURIComponent(reference.installationId)}:${encodeURIComponent(reference.householdId)}`
}

/** @internal Shared by the migration so every Parent mutation uses one lock. */
export async function withParentCredentialMutationLock<T>(
  binding: InstallationBinding,
  options: ParentCredentialOperationOptions | undefined,
  operation: (bindingSnapshot: InstallationBinding) => T | Promise<T>,
): Promise<T> {
  const bindingSnapshot = activeInstallationBindingSnapshot(binding)
  const reference = parentCredentialBindingReference(bindingSnapshot)
  return lockManagerFrom(options).request(
    mutationLockName(reference),
    { mode: 'exclusive' },
    () => operation(bindingSnapshot),
  )
}

export function parentCredentialStorageKey(binding: unknown): string {
  return storageKeyForReference(parentCredentialBindingReference(binding))
}

export function parentFailedAttemptSubject(binding: unknown): ParentFailedAttemptSubject {
  const reference = parentCredentialBindingReference(binding)
  return Object.freeze({ kind: 'parent', householdId: reference.householdId })
}

export function parseParentCredentialRecord(
  value: unknown,
  expectedBinding?: unknown,
): StoredParentCredentialRecord {
  if (!plainRecord(value)) malformed('Parent credential record is not an object.')
  const rotatedAtDescriptor = Object.getOwnPropertyDescriptor(value, 'rotatedAt')
  const allowedKeys = rotatedAtDescriptor === undefined
    ? REQUIRED_RECORD_KEYS
    : [...REQUIRED_RECORD_KEYS, 'rotatedAt']
  const keys = Object.keys(value)
  if (keys.length !== allowedKeys.length || !keys.every((key) => allowedKeys.includes(key as never))) {
    malformed('Parent credential record contains missing or unexpected fields.')
  }
  const schemaVersion = recordDataProperty(value, 'schemaVersion')
  const storage = recordDataProperty(value, 'storage')
  const bindingValue = recordDataProperty(value, 'binding')
  const credentialKind = recordDataProperty(value, 'credentialKind')
  const verifierScheme = recordDataProperty(value, 'verifierScheme')
  const verifierSchemeVersion = recordDataProperty(value, 'verifierSchemeVersion')
  const costParametersVersion = recordDataProperty(value, 'costParametersVersion')
  const saltBase64 = recordDataProperty(value, 'saltBase64')
  const verifierBase64 = recordDataProperty(value, 'verifierBase64')
  const costParameters = recordDataProperty(value, 'costParameters')
  const state = recordDataProperty(value, 'state')
  const createdAt = recordDataProperty(value, 'createdAt')
  const rotatedAt = rotatedAtDescriptor === undefined
    ? undefined
    : recordDataProperty(value, 'rotatedAt')
  if (
    schemaVersion !== PARENT_CREDENTIAL_SCHEMA_VERSION ||
    verifierSchemeVersion !== PARENT_PIN_VERIFIER_SCHEME_VERSION ||
    costParametersVersion !== LEARNER_PIN_COST_PARAMETERS_VERSION
  ) {
    throw new ParentCredentialVaultError(
      'unsupported-version',
      'Parent credential record uses an unsupported version.',
    )
  }

  const binding = parseStoredBindingReference(bindingValue)
  if (expectedBinding !== undefined) {
    const expected = parentCredentialBindingReference(expectedBinding)
    if (!bindingMatches(binding, expected)) {
      throw new ParentCredentialVaultError(
        'binding-mismatch',
        'Parent credential does not match the active installation and household.',
      )
    }
  }

  if (
    storage !== 'device-local-only' ||
    credentialKind !== 'parent-pin' ||
    verifierScheme !== 'pbkdf2-sha256' ||
    (state !== 'enrolled' && state !== 'reset-required') ||
    !isSupportedPinCostParameters(costParametersVersion, costParameters) ||
    !validStoredCostParameters(costParameters) ||
    !validIsoTimestamp(createdAt) ||
    (rotatedAt !== undefined && !validIsoTimestamp(rotatedAt)) ||
    (typeof rotatedAt === 'string' && Date.parse(rotatedAt) < Date.parse(createdAt))
  ) {
    malformed('Parent credential record violates the device-local credential contract.')
  }

  try {
    base64ToBytes(saltBase64 as string, LEARNER_PIN_SALT_BYTES)
    base64ToBytes(verifierBase64 as string, LEARNER_PIN_DERIVED_KEY_BYTES)
  } catch {
    malformed('Parent credential record contains malformed verifier material.')
  }
  return Object.freeze({
    schemaVersion: PARENT_CREDENTIAL_SCHEMA_VERSION,
    storage: 'device-local-only',
    binding,
    credentialKind: 'parent-pin',
    verifierScheme: 'pbkdf2-sha256',
    verifierSchemeVersion: PARENT_PIN_VERIFIER_SCHEME_VERSION,
    costParametersVersion: LEARNER_PIN_COST_PARAMETERS_VERSION,
    saltBase64: saltBase64 as string,
    verifierBase64: verifierBase64 as string,
    costParameters: Object.freeze({ ...LEARNER_PIN_COST_PARAMETERS_V1 }),
    state,
    createdAt,
    ...(rotatedAt === undefined ? {} : { rotatedAt }),
  })
}

function parseStoredRecord(
  raw: string,
  binding: InstallationBinding,
): StoredParentCredentialRecord {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    malformed('Parent credential record is not valid JSON.')
  }
  return parseParentCredentialRecord(parsed, binding)
}

/** @internal Legacy migration reads this strict record; integration should use state/verify APIs. */
export function readParentCredentialRecord(
  binding: InstallationBinding,
  options?: ParentCredentialOperationOptions,
): StoredParentCredentialRecord | null {
  const key = parentCredentialStorageKey(binding)
  const storage = storageFrom(options)
  let raw: string | null
  try {
    raw = storage.getItem(key)
  } catch {
    throw new ParentCredentialVaultError(
      'storage-unavailable',
      'Device-local Parent credential storage could not be read.',
    )
  }
  return raw === null ? null : parseStoredRecord(raw, binding)
}

/** @internal All writes are exact-binding and read-back verified. */
export function writeParentCredentialRecord(
  binding: InstallationBinding,
  record: unknown,
  options?: ParentCredentialOperationOptions,
): StoredParentCredentialRecord {
  const validated = parseParentCredentialRecord(record, binding)
  const storage = storageFrom(options)
  const key = parentCredentialStorageKey(binding)
  const serialized = JSON.stringify(validated)
  try {
    storage.setItem(key, serialized)
    const persistedRaw = storage.getItem(key)
    if (persistedRaw !== serialized) {
      throw new ParentCredentialVaultError(
        'persistence-verification-failed',
        'Parent credential did not pass durable read-back verification.',
      )
    }
    return parseStoredRecord(persistedRaw, binding)
  } catch (cause) {
    if (cause instanceof ParentCredentialVaultError) throw cause
    throw new ParentCredentialVaultError(
      'storage-unavailable',
      'Device-local Parent credential storage could not be written.',
    )
  }
}

/** @internal The only unauthenticated creation path is exact legacy migration. */
export async function createParentCredentialRecordForMigration(
  binding: InstallationBinding,
  pin: string,
  options?: ParentCredentialOperationOptions,
): Promise<StoredParentCredentialRecord> {
  const reference = parentCredentialBindingReference(binding)
  const verifier = await createParentPinVerifier(reference, pin, options?.crypto)
  return {
    schemaVersion: PARENT_CREDENTIAL_SCHEMA_VERSION,
    storage: 'device-local-only',
    binding: reference,
    credentialKind: 'parent-pin',
    verifierScheme: 'pbkdf2-sha256',
    verifierSchemeVersion: PARENT_PIN_VERIFIER_SCHEME_VERSION,
    ...verifier,
    state: 'enrolled',
    createdAt: timestamp(options),
  }
}

export async function verifyParentCredentialRecord(
  record: unknown,
  binding: InstallationBinding,
  pin: unknown,
  options?: ParentCredentialOperationOptions,
): Promise<boolean> {
  let validated: StoredParentCredentialRecord
  try {
    validated = parseParentCredentialRecord(record, binding)
  } catch {
    return false
  }
  return validated.state === 'enrolled' &&
    verifyParentPinVerifier(validated.binding, pin, validated, options?.crypto)
}

function recordRejection(cause: unknown): boolean {
  return cause instanceof ParentCredentialVaultError &&
    (cause.code === 'malformed-record' ||
      cause.code === 'unsupported-version' ||
      cause.code === 'binding-mismatch')
}

export function readParentCredentialState(
  binding: InstallationBinding,
  options?: ParentCredentialOperationOptions,
): ParentCredentialAvailability {
  const subject = parentFailedAttemptSubject(binding)
  const record = readParentCredentialRecord(binding, options)
  if (!record) return { status: 'parent-setup-required', subject }
  return { status: record.state, subject }
}

export async function verifyParentPin(
  binding: InstallationBinding,
  pin: unknown,
  options?: ParentCredentialOperationOptions,
): Promise<ParentPinVerificationResult> {
  const subject = parentFailedAttemptSubject(binding)
  let record: StoredParentCredentialRecord | null
  try {
    record = readParentCredentialRecord(binding, options)
  } catch (cause) {
    if (recordRejection(cause)) return { status: 'not-verified', subject }
    throw cause
  }
  if (!record) return { status: 'parent-setup-required', subject }
  if (record.state === 'reset-required') return { status: 'reset-required', subject }
  return (await verifyParentPinVerifier(record.binding, pin, record, options?.crypto))
    ? { status: 'verified', subject }
    : { status: 'not-verified', subject }
}

/** @internal Used only after the Parent migration preflights the full raw state. */
export async function enrollLegacyParentPinForMigration(
  binding: InstallationBinding,
  pin: string,
  options?: ParentCredentialOperationOptions,
): Promise<StoredParentCredentialRecord> {
  const existing = readParentCredentialRecord(binding, options)
  if (existing) {
    if (await verifyParentCredentialRecord(existing, binding, pin, options)) return existing
    throw new ParentCredentialVaultError(
      'credential-conflict',
      'Existing Parent credential does not verify the exact legacy PIN.',
    )
  }

  const record = await createParentCredentialRecordForMigration(binding, pin, options)
  const persisted = writeParentCredentialRecord(binding, record, options)
  if (await verifyParentCredentialRecord(persisted, binding, pin, options)) return persisted

  try {
    const storage = storageFrom(options)
    const key = parentCredentialStorageKey(binding)
    storage.removeItem(key)
  } catch {
    // Authentication still fails closed if best-effort cleanup is unavailable.
  }
  throw new ParentCredentialVaultError(
    'persistence-verification-failed',
    'Persisted Parent credential could not verify its source PIN.',
  )
}

/** @internal Migration and authorized recovery share the unusable tombstone writer. */
export async function markParentCredentialResetRequiredForMigration(
  binding: InstallationBinding,
  options?: ParentCredentialOperationOptions,
): Promise<StoredParentCredentialRecord> {
  const reference = parentCredentialBindingReference(binding)
  const existing = readParentCredentialRecord(binding, options)
  if (existing?.state === 'reset-required') return existing
  const now = timestamp(options)
  const verifier = await createUnusableParentPinVerifier(reference, options?.crypto)
  if (existing) {
    return writeParentCredentialRecord(
      binding,
      { ...existing, ...verifier, state: 'reset-required', rotatedAt: now },
      options,
    )
  }
  return writeParentCredentialRecord(
    binding,
    {
      schemaVersion: PARENT_CREDENTIAL_SCHEMA_VERSION,
      storage: 'device-local-only',
      binding: reference,
      credentialKind: 'parent-pin',
      verifierScheme: 'pbkdf2-sha256',
      verifierSchemeVersion: PARENT_PIN_VERIFIER_SCHEME_VERSION,
      ...verifier,
      state: 'reset-required',
      createdAt: now,
    },
    options,
  )
}

function mutationResult(record: StoredParentCredentialRecord): ParentCredentialMutationResult {
  const binding = Object.freeze({ ...record.binding })
  const result: ParentCredentialMutationResult = {
    status: record.state,
    binding,
    subject: Object.freeze({ kind: 'parent', householdId: binding.householdId }),
    createdAt: record.createdAt,
    ...(record.rotatedAt === undefined ? {} : { rotatedAt: record.rotatedAt }),
  }
  return Object.freeze(result)
}

export async function rotateParentPinAuthorized(
  binding: InstallationBinding,
  replacementPin: string,
  authorization: ParentCredentialRotationAuthorization,
  options?: ParentCredentialOperationOptions,
): Promise<ParentCredentialMutationResult> {
  if (!isFourDigitPin(replacementPin)) {
    throw new Error('A Parent PIN must contain exactly four decimal digits.')
  }
  if (!authorization || typeof authorization.consumeParentCredentialRotationAuthorization !== 'function') {
    throw new ParentCredentialVaultError('authorization-required', 'Parent rotation authorization is required.')
  }
  return withParentCredentialMutationLock(binding, options, async (lockedBinding) => {
    const previous = readParentCredentialRecord(lockedBinding, options)
    if (!previous || previous.state !== 'enrolled') {
      throw new ParentCredentialVaultError('credential-missing', 'An enrolled Parent credential is required.')
    }
    const previousSerialized = JSON.stringify(previous)
    const accepted = await authorization.consumeParentCredentialRotationAuthorization({
      operationId: 'parent-pin:rotate',
      binding: parentCredentialBindingReference(lockedBinding),
      credentialCreatedAt: previous.createdAt,
      ...(previous.rotatedAt === undefined ? {} : { credentialRotatedAt: previous.rotatedAt }),
    })
    if (accepted !== true) {
      throw new ParentCredentialVaultError('authorization-required', 'Parent rotation authorization was denied.')
    }

    const replacement = await createParentCredentialRecordForMigration(lockedBinding, replacementPin, options)
    const current = readParentCredentialRecord(lockedBinding, options)
    if (!current || JSON.stringify(current) !== previousSerialized) {
      throw new ParentCredentialVaultError(
        'credential-conflict',
        'Parent credential changed while rotation authorization was being consumed.',
      )
    }
    const rotated: StoredParentCredentialRecord = {
      ...replacement,
      createdAt: previous.createdAt,
      rotatedAt: timestamp(options),
    }
    try {
      const persisted = writeParentCredentialRecord(lockedBinding, rotated, options)
      if (await verifyParentCredentialRecord(persisted, lockedBinding, replacementPin, options)) {
        return mutationResult(persisted)
      }
      throw new ParentCredentialVaultError(
        'persistence-verification-failed',
        'Rotated Parent credential failed verification.',
      )
    } catch (cause) {
      try {
        writeParentCredentialRecord(lockedBinding, previous, options)
      } catch {
        // The controlling error remains fail-closed even if rollback is unavailable.
      }
      throw cause
    }
  })
}

export async function markParentCredentialResetRequiredAuthorized(
  binding: InstallationBinding,
  authorization: ParentCredentialResetAuthorization,
  options?: ParentCredentialOperationOptions,
): Promise<ParentCredentialMutationResult> {
  if (!authorization || typeof authorization.consumeParentCredentialResetAuthorization !== 'function') {
    throw new ParentCredentialVaultError('authorization-required', 'Parent recovery authorization is required.')
  }
  return withParentCredentialMutationLock(binding, options, async (lockedBinding) => {
    const reference = parentCredentialBindingReference(lockedBinding)
    const previous = readParentCredentialRecord(lockedBinding, options)
    const previousSerialized = previous === null ? null : JSON.stringify(previous)
    const accepted = await authorization.consumeParentCredentialResetAuthorization({
      operationId: 'parent-pin:reset-required',
      binding: reference,
      priorState: previous?.state ?? 'missing',
    })
    if (accepted !== true) {
      throw new ParentCredentialVaultError('authorization-required', 'Parent recovery authorization was denied.')
    }
    const current = readParentCredentialRecord(lockedBinding, options)
    if ((current === null ? null : JSON.stringify(current)) !== previousSerialized) {
      throw new ParentCredentialVaultError(
        'credential-conflict',
        'Parent credential changed while recovery authorization was being consumed.',
      )
    }
    return mutationResult(await markParentCredentialResetRequiredForMigration(lockedBinding, options))
  })
}
