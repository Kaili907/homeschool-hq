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
  isSupportedPinCostParameters,
  LEARNER_PIN_COST_PARAMETERS_V1,
  LEARNER_PIN_COST_PARAMETERS_VERSION,
  LEARNER_PIN_DERIVED_KEY_BYTES,
  LEARNER_PIN_SALT_BYTES,
} from './pinVerifier'
import type { CredentialOperationOptions } from './vault'

export const PARENT_CREDENTIAL_STORAGE_NAMESPACE =
  'homeschool-hq:security:parent-credentials:v2' as const

export interface StoredParentCredentialRecord extends ParentCredentialRecord {
  readonly costParametersVersion: typeof LEARNER_PIN_COST_PARAMETERS_VERSION
}

export interface ParentCredentialGenerationSnapshot {
  readonly generation: number
  readonly activeGeneration: number | null
  readonly recordCommitmentBase64: string | null
  /** Immutable completed-migration anchor held outside device-local storage. */
  readonly migrationCommitmentBase64: string | null
}

/** Must not share a rollback domain with the device-local credential blob. */
export interface ParentCredentialGenerationAuthority {
  read(
    binding: ParentCredentialBindingReference,
  ): ParentCredentialGenerationSnapshot | Promise<ParentCredentialGenerationSnapshot>
  compareAndSwap(
    binding: ParentCredentialBindingReference,
    expected: ParentCredentialGenerationSnapshot,
    replacement: ParentCredentialGenerationSnapshot,
  ): boolean | Promise<boolean>
}

export type ParentCredentialVaultErrorCode =
  | 'storage-unavailable'
  | 'invalid-installation-binding'
  | 'credential-missing'
  | 'credential-conflict'
  | 'authorization-required'
  | 'coordination-unavailable'
  | 'generation-authority-unavailable'
  | 'generation-conflict'
  | 'generation-mismatch'
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
  readonly generationAuthority: ParentCredentialGenerationAuthority
  readonly lockManager?: ParentCredentialLockManager
}

/** Structurally compatible with the shared FailedAttemptLedger parent subject. */
export type ParentFailedAttemptSubject = Readonly<{
  kind: 'parent'
  householdId: string
}>

export type ParentCredentialAvailability = Readonly<
  | { status: 'enrolled'; subject: ParentFailedAttemptSubject }
  | { status: 'prepared'; subject: ParentFailedAttemptSubject }
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
  readonly generation: number
  readonly binding: ParentCredentialBindingReference
  readonly subject: ParentFailedAttemptSubject
  readonly createdAt: string
  readonly rotatedAt?: string
}

export interface ParentCredentialRotationAuthorizationContext {
  readonly operationId: 'parent-pin:rotate'
  readonly binding: ParentCredentialBindingReference
  readonly credentialGeneration: number
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
  readonly priorState: 'prepared' | 'enrolled' | 'reset-required' | 'missing' | 'unavailable'
  readonly priorGeneration: number
}

/** Integration must consume installation claim/recovery authority here. */
export interface ParentCredentialResetAuthorization {
  consumeParentCredentialResetAuthorization(
    context: ParentCredentialResetAuthorizationContext,
  ): boolean | Promise<boolean>
}

export interface ParentCredentialRecoveryAuthorizationContext {
  readonly operationId: 'parent-pin:recover'
  readonly binding: ParentCredentialBindingReference
  readonly priorGeneration: number
}

export interface ParentCredentialRecoveryAuthorization {
  consumeParentCredentialRecoveryAuthorization(
    context: ParentCredentialRecoveryAuthorizationContext,
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
  'generation',
  'createdAt',
] as const)

const BINDING_REFERENCE_KEYS = Object.freeze([
  'schemaVersion',
  'installationId',
  'householdId',
] as const)

const ACTIVE_BINDING_KEYS = Object.freeze([
  'schemaVersion', 'bindingId', 'installationId', 'householdId',
  'datasetEpoch', 'verifiedActorId', 'status', 'boundAt',
] as const)

function invalidBinding(message: string): never {
  throw new ParentCredentialVaultError('invalid-installation-binding', message)
}

function malformed(message: string): never {
  throw new ParentCredentialVaultError('malformed-record', message)
}

const PROTOTYPE_SENSITIVE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

function ownDataFields(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[],
  fail: (message: string) => never,
): ReadonlyMap<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('Expected a plain object.')
  }
  let prototype: object | null
  let keys: readonly PropertyKey[]
  try {
    prototype = Object.getPrototypeOf(value)
    keys = Reflect.ownKeys(value)
  } catch {
    fail('Object structure could not be inspected safely.')
  }
  if (prototype !== Object.prototype && prototype !== null) fail('Expected a plain object.')
  const allowed = new Set([...requiredKeys, ...optionalKeys])
  const fields = new Map<string, unknown>()
  for (const key of keys) {
    if (typeof key !== 'string') fail('Symbol keys are forbidden.')
    if (PROTOTYPE_SENSITIVE_KEYS.has(key)) fail(`Prototype-sensitive field ${key} is forbidden.`)
    if (!allowed.has(key)) fail(`Unexpected field ${key}.`)
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      fail(`Field ${key} must be an enumerable data property.`)
    }
    fields.set(key, descriptor.value)
  }
  for (const key of requiredKeys) {
    if (!fields.has(key)) fail(`Required field ${key} is missing.`)
  }
  return fields
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
  const fields = ownDataFields(value, ACTIVE_BINDING_KEYS, ['revokedAt'], (message) =>
    invalidBinding(`Installation binding is invalid: ${message}`))
  const schemaVersion = fields.get('schemaVersion')
  const installationId = fields.get('installationId')
  const householdId = fields.get('householdId')
  const bindingId = fields.get('bindingId')
  const datasetEpoch = fields.get('datasetEpoch')
  const verifiedActorId = fields.get('verifiedActorId')
  const status = fields.get('status')
  const boundAt = fields.get('boundAt')
  const revokedAt = fields.get('revokedAt')

  if (
    schemaVersion !== INSTALLATION_BINDING_SCHEMA_VERSION ||
    !isInstallationId(installationId) ||
    !isExactBoundedIdentifier(householdId) ||
    !isExactBoundedIdentifier(bindingId) ||
    !isExactBoundedIdentifier(datasetEpoch) ||
    !isExactBoundedIdentifier(verifiedActorId) ||
    status !== 'active' ||
    !validIsoTimestamp(boundAt) ||
    revokedAt !== undefined
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
  const fields = ownDataFields(value, ACTIVE_BINDING_KEYS, ['revokedAt'], (message) =>
    invalidBinding(`Installation binding is invalid: ${message}`))
  return Object.freeze({
    schemaVersion: INSTALLATION_BINDING_SCHEMA_VERSION,
    bindingId: fields.get('bindingId') as string,
    installationId: reference.installationId,
    householdId: reference.householdId,
    datasetEpoch: fields.get('datasetEpoch') as string,
    verifiedActorId: fields.get('verifiedActorId') as string,
    status: 'active',
    boundAt: fields.get('boundAt') as string,
  })
}

function parseStoredBindingReference(value: unknown): ParentCredentialBindingReference {
  const fields = ownDataFields(value, BINDING_REFERENCE_KEYS, [], (message) =>
    malformed(`Parent credential binding is malformed: ${message}`))
  const schemaVersion = fields.get('schemaVersion')
  const installationId = fields.get('installationId')
  const householdId = fields.get('householdId')
  if (
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
  return isSupportedPinCostParameters(LEARNER_PIN_COST_PARAMETERS_VERSION, value)
}

function bindingMatches(
  left: ParentCredentialBindingReference,
  right: ParentCredentialBindingReference,
): boolean {
  return left.installationId === right.installationId && left.householdId === right.householdId
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
  options: ParentCredentialOperationOptions,
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
  const fields = ownDataFields(value, REQUIRED_RECORD_KEYS, ['rotatedAt'], (message) =>
    malformed(`Parent credential record is malformed: ${message}`))
  const schemaVersion = fields.get('schemaVersion')
  const storage = fields.get('storage')
  const bindingValue = fields.get('binding')
  const credentialKind = fields.get('credentialKind')
  const verifierScheme = fields.get('verifierScheme')
  const verifierSchemeVersion = fields.get('verifierSchemeVersion')
  const costParametersVersion = fields.get('costParametersVersion')
  const saltBase64 = fields.get('saltBase64')
  const verifierBase64 = fields.get('verifierBase64')
  const costParameters = fields.get('costParameters')
  const state = fields.get('state')
  const generation = fields.get('generation')
  const createdAt = fields.get('createdAt')
  const rotatedAt = fields.get('rotatedAt')
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
    (state !== 'prepared' && state !== 'enrolled' && state !== 'reset-required') ||
    !Number.isSafeInteger(generation) ||
    Number(generation) <= 0 ||
    !isSupportedPinCostParameters(costParametersVersion, costParameters) ||
    !validStoredCostParameters(costParameters) ||
    typeof saltBase64 !== 'string' ||
    typeof verifierBase64 !== 'string' ||
    !validIsoTimestamp(createdAt) ||
    (rotatedAt !== undefined && !validIsoTimestamp(rotatedAt)) ||
    (typeof rotatedAt === 'string' && Date.parse(rotatedAt) < Date.parse(createdAt))
  ) {
    malformed('Parent credential record violates the device-local credential contract.')
  }

  try {
    base64ToBytes(saltBase64, LEARNER_PIN_SALT_BYTES)
    base64ToBytes(verifierBase64, LEARNER_PIN_DERIVED_KEY_BYTES)
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
    saltBase64,
    verifierBase64,
    costParameters: Object.freeze({ ...LEARNER_PIN_COST_PARAMETERS_V1 }),
    state,
    generation: generation as number,
    createdAt,
    ...(rotatedAt === undefined ? {} : { rotatedAt }),
  })
}

export async function readParentCredentialState(
  binding: InstallationBinding,
  options: ParentCredentialOperationOptions,
): Promise<ParentCredentialAvailability> {
  const internal = await import('./parentVault.internal')
  return internal.readParentCredentialState(binding, options)
}

export async function verifyParentPin(
  binding: InstallationBinding,
  pin: unknown,
  options: ParentCredentialOperationOptions,
): Promise<ParentPinVerificationResult> {
  const internal = await import('./parentVault.internal')
  return internal.verifyParentPin(binding, pin, options)
}

export async function rotateParentPinAuthorized(
  binding: InstallationBinding,
  replacementPin: string,
  authorization: ParentCredentialRotationAuthorization,
  options: ParentCredentialOperationOptions,
): Promise<ParentCredentialMutationResult> {
  const internal = await import('./parentVault.internal')
  return internal.rotateParentPinAuthorized(
    binding,
    replacementPin,
    authorization,
    options,
  )
}

export async function markParentCredentialResetRequiredAuthorized(
  binding: InstallationBinding,
  authorization: ParentCredentialResetAuthorization,
  options: ParentCredentialOperationOptions,
): Promise<ParentCredentialMutationResult> {
  const internal = await import('./parentVault.internal')
  return internal.markParentCredentialResetRequiredAuthorized(
    binding,
    authorization,
    options,
  )
}

export async function recoverParentPinAuthorized(
  binding: InstallationBinding,
  replacementPin: string,
  authorization: ParentCredentialRecoveryAuthorization,
  options: ParentCredentialOperationOptions,
): Promise<ParentCredentialMutationResult> {
  const internal = await import('./parentVault.internal')
  return internal.recoverParentPinAuthorized(
    binding,
    replacementPin,
    authorization,
    options,
  )
}
