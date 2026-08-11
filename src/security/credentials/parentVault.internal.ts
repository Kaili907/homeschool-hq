import {
  PARENT_CREDENTIAL_SCHEMA_VERSION,
  PARENT_PIN_VERIFIER_SCHEME_VERSION,
  type InstallationBinding,
  type ParentCredentialBindingReference,
} from '../contracts'
import {
  base64ToBytes,
  bytesToBase64,
  isFourDigitPin,
  LEARNER_PIN_DERIVED_KEY_BYTES,
  LEARNER_PIN_COST_PARAMETERS_VERSION,
} from './pinVerifier'
import {
  createParentPinVerifier,
  createUnusableParentPinVerifier,
  verifyParentPinVerifier,
} from './parentPinVerifier'
import {
  ParentCredentialVaultError,
  parentCredentialBindingReference,
  parentFailedAttemptSubject,
  parentCredentialStorageKey,
  parseParentCredentialRecord,
  withParentCredentialMutationLock,
  type ParentCredentialMutationResult,
  type ParentCredentialRecoveryAuthorization,
  type ParentCredentialResetAuthorization,
  type ParentCredentialRotationAuthorization,
  type ParentCredentialGenerationSnapshot,
  type ParentCredentialOperationOptions,
  type ParentCredentialAvailability,
  type ParentPinVerificationResult,
  type StoredParentCredentialRecord,
} from './parentVault'

function generationFailure(message: string): never {
  throw new ParentCredentialVaultError('generation-mismatch', message)
}

function parseGenerationSnapshot(value: unknown): ParentCredentialGenerationSnapshot {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    generationFailure('Parent generation snapshot must be a plain object.')
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    generationFailure('Parent generation snapshot must be a plain object.')
  }
  const keys = Reflect.ownKeys(value)
  const expected = [
    'generation',
    'activeGeneration',
    'recordCommitmentBase64',
    'migrationCommitmentBase64',
  ]
  if (
    keys.length !== expected.length ||
    keys.some((key) => typeof key !== 'string' || !expected.includes(key))
  ) {
    generationFailure('Parent generation snapshot contains missing or unexpected fields.')
  }
  const values = new Map<string, unknown>()
  for (const key of expected) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      generationFailure(`Parent generation field ${key} is missing or unsafe.`)
    }
    values.set(key, descriptor.value)
  }
  const generation = values.get('generation')
  const activeGeneration = values.get('activeGeneration')
  const recordCommitmentBase64 = values.get('recordCommitmentBase64')
  const migrationCommitmentBase64 = values.get('migrationCommitmentBase64')
  if (
    !Number.isSafeInteger(generation) ||
    Number(generation) < 0 ||
    (activeGeneration !== null &&
      (!Number.isSafeInteger(activeGeneration) ||
        Number(activeGeneration) <= 0 ||
        activeGeneration !== generation)) ||
    (generation === 0 && (activeGeneration !== null || recordCommitmentBase64 !== null)) ||
    (generation !== 0 && typeof recordCommitmentBase64 !== 'string') ||
    (migrationCommitmentBase64 !== null && typeof migrationCommitmentBase64 !== 'string')
  ) {
    generationFailure('Parent generation snapshot violates the monotonic authority contract.')
  }
  if (typeof recordCommitmentBase64 === 'string') {
    try {
      base64ToBytes(recordCommitmentBase64, LEARNER_PIN_DERIVED_KEY_BYTES)
    } catch {
      generationFailure('Parent generation snapshot has an invalid record commitment.')
    }
  }
  if (typeof migrationCommitmentBase64 === 'string') {
    try {
      base64ToBytes(migrationCommitmentBase64, LEARNER_PIN_DERIVED_KEY_BYTES)
    } catch {
      generationFailure('Parent generation snapshot has an invalid migration commitment.')
    }
  }
  return Object.freeze({
    generation: generation as number,
    activeGeneration: activeGeneration as number | null,
    recordCommitmentBase64: recordCommitmentBase64 as string | null,
    migrationCommitmentBase64: migrationCommitmentBase64 as string | null,
  })
}

export function parentGenerationSnapshotsEqual(
  left: ParentCredentialGenerationSnapshot,
  right: ParentCredentialGenerationSnapshot,
): boolean {
  return left.generation === right.generation &&
    left.activeGeneration === right.activeGeneration &&
    left.recordCommitmentBase64 === right.recordCommitmentBase64 &&
    left.migrationCommitmentBase64 === right.migrationCommitmentBase64
}

async function recordCommitment(
  record: StoredParentCredentialRecord,
  options?: Pick<ParentCredentialOperationOptions, 'crypto'>,
): Promise<string> {
  const subtle = options?.crypto?.subtle ?? globalThis.crypto?.subtle
  if (!subtle) {
    throw new ParentCredentialVaultError(
      'generation-authority-unavailable',
      'Web Crypto is required for Parent record commitments.',
    )
  }
  const digest = await subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(record)),
  )
  return bytesToBase64(new Uint8Array(digest))
}

async function nullRecordCommitment(
  options?: Pick<ParentCredentialOperationOptions, 'crypto'>,
): Promise<string> {
  const subtle = options?.crypto?.subtle ?? globalThis.crypto?.subtle
  if (!subtle) {
    throw new ParentCredentialVaultError(
      'generation-authority-unavailable',
      'Web Crypto is required for Parent record commitments.',
    )
  }
  const digest = await subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(null)),
  )
  return bytesToBase64(new Uint8Array(digest))
}

async function readGeneration(
  binding: ParentCredentialBindingReference,
  options: ParentCredentialOperationOptions,
): Promise<ParentCredentialGenerationSnapshot> {
  const authority = options.generationAuthority
  if (!authority || typeof authority.read !== 'function' || typeof authority.compareAndSwap !== 'function') {
    throw new ParentCredentialVaultError(
      'generation-authority-unavailable',
      'Rollback-resistant Parent credential generation authority is required.',
    )
  }
  try {
    return parseGenerationSnapshot(await authority.read(binding))
  } catch (cause) {
    if (cause instanceof ParentCredentialVaultError) throw cause
    throw new ParentCredentialVaultError(
      'generation-authority-unavailable',
      'Rollback-resistant Parent credential generation could not be read.',
    )
  }
}

export function readParentCredentialGeneration(
  binding: InstallationBinding,
  options: ParentCredentialOperationOptions,
): Promise<ParentCredentialGenerationSnapshot> {
  return readGeneration(parentCredentialBindingReference(binding), options)
}

export async function compareAndSwapParentGeneration(
  binding: ParentCredentialBindingReference,
  expected: ParentCredentialGenerationSnapshot,
  replacement: ParentCredentialGenerationSnapshot,
  options: ParentCredentialOperationOptions,
): Promise<void> {
  const authority = options.generationAuthority
  const parsedExpected = parseGenerationSnapshot(expected)
  const parsedReplacement = parseGenerationSnapshot(replacement)
  if (!authority || typeof authority.compareAndSwap !== 'function') {
    throw new ParentCredentialVaultError(
      'generation-authority-unavailable',
      'Rollback-resistant Parent credential generation authority is required.',
    )
  }
  if (
    parsedExpected.migrationCommitmentBase64 !== null &&
    parsedReplacement.migrationCommitmentBase64 !== parsedExpected.migrationCommitmentBase64
  ) {
    generationFailure('A completed Parent migration commitment is immutable.')
  }
  const anchorsMigration =
    parsedExpected.migrationCommitmentBase64 === null &&
    parsedReplacement.migrationCommitmentBase64 !== null
  if (anchorsMigration) {
    if (
      parsedReplacement.generation !== parsedExpected.generation ||
      parsedReplacement.recordCommitmentBase64 !== parsedExpected.recordCommitmentBase64 ||
      (parsedExpected.activeGeneration !== null &&
        parsedReplacement.activeGeneration !== parsedExpected.activeGeneration)
    ) {
      generationFailure('Parent migration anchoring may only activate its exact current record.')
    }
  } else if (parsedReplacement.generation === parsedExpected.generation) {
    if (
      parsedReplacement.recordCommitmentBase64 !== parsedExpected.recordCommitmentBase64 ||
      parsedReplacement.migrationCommitmentBase64 !== parsedExpected.migrationCommitmentBase64 ||
      parsedExpected.activeGeneration !== null ||
      parsedReplacement.activeGeneration !== parsedReplacement.generation ||
      parsedReplacement.generation === 0
    ) {
      generationFailure('A same-generation transition may only activate an exact inactive record.')
    }
  } else if (
    parsedReplacement.generation !== parsedExpected.generation + 1 ||
    parsedReplacement.migrationCommitmentBase64 !== parsedExpected.migrationCommitmentBase64
  ) {
    generationFailure('Parent credential generations must advance exactly once.')
  }
  let changed: boolean
  try {
    changed = await authority.compareAndSwap(binding, parsedExpected, parsedReplacement)
  } catch {
    throw new ParentCredentialVaultError(
      'generation-authority-unavailable',
      'Rollback-resistant Parent credential generation could not be advanced.',
    )
  }
  if (changed !== true) {
    throw new ParentCredentialVaultError(
      'generation-conflict',
      'Parent credential generation changed during the operation.',
    )
  }
  const readBack = await readGeneration(binding, options)
  if (!parentGenerationSnapshotsEqual(readBack, parsedReplacement)) {
    throw new ParentCredentialVaultError(
      'persistence-verification-failed',
      'Parent credential generation failed exact durable read-back verification.',
    )
  }
}

function storageFrom(options: ParentCredentialOperationOptions) {
  if (options.storage) return options.storage
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

function pendingParentCredentialStorageKey(
  binding: InstallationBinding,
  generation: number,
): string {
  if (!Number.isSafeInteger(generation) || generation <= 0) {
    generationFailure('A positive pending Parent generation is required.')
  }
  return `${parentCredentialStorageKey(binding)}:pending-generation:${generation}`
}

async function recordMatchesAuthority(
  record: StoredParentCredentialRecord,
  authority: ParentCredentialGenerationSnapshot,
  options: ParentCredentialOperationOptions,
): Promise<boolean> {
  return record.generation === authority.generation &&
    await recordCommitment(record, options) === authority.recordCommitmentBase64 &&
    (authority.activeGeneration === null ||
      (record.state === 'enrolled' && authority.activeGeneration === record.generation)) &&
    (record.state === 'enrolled' || authority.activeGeneration === null)
}

function persistPendingParentCredentialRecord(
  binding: InstallationBinding,
  record: StoredParentCredentialRecord,
  options: ParentCredentialOperationOptions,
): void {
  const storage = storageFrom(options)
  const key = pendingParentCredentialStorageKey(binding, record.generation)
  const serialized = JSON.stringify(record)
  try {
    storage.setItem(key, serialized)
    if (storage.getItem(key) !== serialized) {
      throw new ParentCredentialVaultError(
        'persistence-verification-failed',
        'Pending Parent credential did not pass durable read-back verification.',
      )
    }
  } catch (cause) {
    if (cause instanceof ParentCredentialVaultError) throw cause
    throw new ParentCredentialVaultError(
      'storage-unavailable',
      'Pending Parent credential could not be persisted.',
    )
  }
}

function clearPendingParentCredentialRecord(
  binding: InstallationBinding,
  generation: number,
  options: ParentCredentialOperationOptions,
): void {
  const storage = storageFrom(options)
  const key = pendingParentCredentialStorageKey(binding, generation)
  try {
    if (storage.getItem(key) === null) return
    storage.removeItem(key)
    if (storage.getItem(key) !== null) {
      throw new ParentCredentialVaultError(
        'persistence-verification-failed',
        'Pending Parent credential recovery marker could not be cleared.',
      )
    }
  } catch (cause) {
    if (cause instanceof ParentCredentialVaultError) throw cause
    throw new ParentCredentialVaultError(
      'storage-unavailable',
      'Pending Parent credential recovery marker could not be cleared.',
    )
  }
}

function parseStoredRecord(raw: string, binding: InstallationBinding): StoredParentCredentialRecord {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    throw new ParentCredentialVaultError('malformed-record', 'Parent credential record is not valid JSON.')
  }
  return parseParentCredentialRecord(parsed, binding)
}

export interface CurrentParentCredentialSnapshot {
  readonly record: StoredParentCredentialRecord
  readonly serialized: string
  readonly authority: ParentCredentialGenerationSnapshot
}

export function parentCredentialSnapshotsEqual(
  left: CurrentParentCredentialSnapshot | null,
  right: CurrentParentCredentialSnapshot | null,
): boolean {
  if (left === null || right === null) return left === right
  return left.serialized === right.serialized &&
    parentGenerationSnapshotsEqual(left.authority, right.authority)
}

export async function readParentCredentialSnapshot(
  binding: InstallationBinding,
  options: ParentCredentialOperationOptions,
): Promise<CurrentParentCredentialSnapshot | null> {
  const reference = parentCredentialBindingReference(binding)
  const authority = await readGeneration(reference, options)
  const storage = storageFrom(options)
  let raw: string | null
  try {
    raw = storage.getItem(parentCredentialStorageKey(binding))
  } catch (cause) {
    if (cause instanceof ParentCredentialVaultError) throw cause
    throw new ParentCredentialVaultError(
      'storage-unavailable',
      'Device-local Parent credential storage could not be read.',
    )
  }
  if (raw === null) {
    if (
      authority.generation === 0 &&
      authority.activeGeneration === null &&
      authority.recordCommitmentBase64 === null
    ) {
      return null
    }
  } else {
    let record: StoredParentCredentialRecord | null = null
    let parseFailure: unknown
    try {
      record = parseStoredRecord(raw, binding)
    } catch (cause) {
      parseFailure = cause
    }
    if (record && await recordMatchesAuthority(record, authority, options)) {
      clearPendingParentCredentialRecord(binding, record.generation, options)
      return Object.freeze({ record, serialized: JSON.stringify(record), authority })
    }
    if (authority.generation === 0 && parseFailure) throw parseFailure
  }

  if (authority.generation === 0) {
    generationFailure('Stored Parent credential exists without generation authority.')
  }

  let pendingRaw: string | null
  try {
    pendingRaw = storage.getItem(
      pendingParentCredentialStorageKey(binding, authority.generation),
    )
  } catch {
    throw new ParentCredentialVaultError(
      'storage-unavailable',
      'Pending Parent credential recovery storage could not be read.',
    )
  }
  if (pendingRaw === null) {
    generationFailure('Current Parent generation has no matching durable record.')
  }
  const pending = parseStoredRecord(pendingRaw, binding)
  if (!(await recordMatchesAuthority(pending, authority, options))) {
    generationFailure('Pending Parent credential does not match generation authority.')
  }
  const serialized = JSON.stringify(pending)
  try {
    storage.setItem(parentCredentialStorageKey(binding), serialized)
    if (storage.getItem(parentCredentialStorageKey(binding)) !== serialized) {
      throw new ParentCredentialVaultError(
        'persistence-verification-failed',
        'Recovered Parent credential failed durable read-back verification.',
      )
    }
    clearPendingParentCredentialRecord(binding, pending.generation, options)
  } catch (cause) {
    if (cause instanceof ParentCredentialVaultError) throw cause
    throw new ParentCredentialVaultError(
      'storage-unavailable',
      'Authoritative pending Parent credential could not be recovered.',
    )
  }
  return Object.freeze({ record: pending, serialized, authority })
}

export async function readParentCredentialRecord(
  binding: InstallationBinding,
  options: ParentCredentialOperationOptions,
): Promise<StoredParentCredentialRecord | null> {
  return (await readParentCredentialSnapshot(binding, options))?.record ?? null
}

export async function persistParentCredentialRecord(
  binding: InstallationBinding,
  record: unknown,
  expectedAuthority: ParentCredentialGenerationSnapshot,
  options: ParentCredentialOperationOptions,
): Promise<StoredParentCredentialRecord> {
  const validated = parseParentCredentialRecord(record, binding)
  const expected = parseGenerationSnapshot(expectedAuthority)
  if (validated.generation !== expected.generation) {
    generationFailure('Parent credential write does not match the reserved generation.')
  }
  if (await recordCommitment(validated, options) !== expected.recordCommitmentBase64) {
    generationFailure('Parent credential write does not match the reserved record commitment.')
  }
  if (
    expected.activeGeneration !== null &&
    (validated.state !== 'enrolled' || expected.activeGeneration !== validated.generation)
  ) {
    generationFailure('Parent credential write does not match the active generation.')
  }
  const reference = parentCredentialBindingReference(binding)
  const before = await readGeneration(reference, options)
  if (!parentGenerationSnapshotsEqual(before, expected)) {
    throw new ParentCredentialVaultError(
      'generation-conflict',
      'Parent credential generation changed before its record write.',
    )
  }
  const serialized = JSON.stringify(validated)
  const storage = storageFrom(options)
  try {
    storage.setItem(parentCredentialStorageKey(binding), serialized)
    const persistedRaw = storage.getItem(parentCredentialStorageKey(binding))
    if (persistedRaw !== serialized) {
      throw new ParentCredentialVaultError(
        'persistence-verification-failed',
        'Parent credential did not pass durable read-back verification.',
      )
    }
    const persisted = parseStoredRecord(persistedRaw, binding)
    const after = await readGeneration(reference, options)
    if (!parentGenerationSnapshotsEqual(after, expected)) {
      throw new ParentCredentialVaultError(
        'generation-conflict',
        'Parent credential generation changed during its record write.',
      )
    }
    return persisted
  } catch (cause) {
    if (cause instanceof ParentCredentialVaultError) throw cause
    throw new ParentCredentialVaultError(
      'storage-unavailable',
      'Device-local Parent credential storage could not be written.',
    )
  }
}

async function committedInactiveGeneration(
  record: StoredParentCredentialRecord,
  current: ParentCredentialGenerationSnapshot,
  options: ParentCredentialOperationOptions,
): Promise<ParentCredentialGenerationSnapshot> {
  return Object.freeze({
    generation: record.generation,
    activeGeneration: null,
    recordCommitmentBase64: await recordCommitment(record, options),
    migrationCommitmentBase64: current.migrationCommitmentBase64,
  })
}

async function committedActiveGeneration(
  record: StoredParentCredentialRecord,
  current: ParentCredentialGenerationSnapshot,
  options: ParentCredentialOperationOptions,
): Promise<ParentCredentialGenerationSnapshot> {
  return Object.freeze({
    generation: record.generation,
    activeGeneration: record.generation,
    recordCommitmentBase64: await recordCommitment(record, options),
    migrationCommitmentBase64: current.migrationCommitmentBase64,
  })
}

function nextGeneration(current: ParentCredentialGenerationSnapshot): number {
  if (current.generation >= Number.MAX_SAFE_INTEGER) {
    throw new ParentCredentialVaultError('generation-conflict', 'Parent credential generation is exhausted.')
  }
  return current.generation + 1
}

function timestamp(options?: Pick<ParentCredentialOperationOptions, 'now'>): string {
  const value = (options?.now ?? (() => new Date()))().toISOString()
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error('Parent credential clock returned an invalid timestamp.')
  }
  return value
}

async function createCredentialRecord(
  binding: InstallationBinding,
  generation: number,
  state: 'prepared' | 'enrolled' | 'reset-required',
  pin: string | null,
  createdAt: string,
  rotatedAt: string | undefined,
  options: Pick<ParentCredentialOperationOptions, 'crypto'>,
): Promise<StoredParentCredentialRecord> {
  const reference = parentCredentialBindingReference(binding)
  const verifier = pin === null
    ? await createUnusableParentPinVerifier(reference, options.crypto)
    : await createParentPinVerifier(reference, pin, options.crypto)
  return parseParentCredentialRecord({
    schemaVersion: PARENT_CREDENTIAL_SCHEMA_VERSION,
    storage: 'device-local-only',
    binding: reference,
    credentialKind: 'parent-pin',
    verifierScheme: 'pbkdf2-sha256',
    verifierSchemeVersion: PARENT_PIN_VERIFIER_SCHEME_VERSION,
    ...verifier,
    state,
    generation,
    createdAt,
    ...(rotatedAt === undefined ? {} : { rotatedAt }),
  }, binding)
}

async function reserveAndPersistRecord(
  binding: InstallationBinding,
  current: ParentCredentialGenerationSnapshot,
  record: StoredParentCredentialRecord,
  options: ParentCredentialOperationOptions,
): Promise<StoredParentCredentialRecord> {
  const reference = parentCredentialBindingReference(binding)
  const reserved = await committedInactiveGeneration(record, current, options)
  // Write the exact candidate first under a generation-specific shadow key.
  // If the external CAS commits and the primary write is interrupted, strict
  // reads can recover only the record whose hash the authority already bound.
  persistPendingParentCredentialRecord(binding, record, options)
  await compareAndSwapParentGeneration(reference, current, reserved, options)
  const persisted = await persistParentCredentialRecord(binding, record, reserved, options)
  clearPendingParentCredentialRecord(binding, persisted.generation, options)
  return persisted
}

async function reserveAndPersistActiveRecord(
  binding: InstallationBinding,
  current: ParentCredentialGenerationSnapshot,
  record: StoredParentCredentialRecord,
  options: ParentCredentialOperationOptions,
): Promise<StoredParentCredentialRecord> {
  const reference = parentCredentialBindingReference(binding)
  const reserved = await committedActiveGeneration(record, current, options)
  persistPendingParentCredentialRecord(binding, record, options)
  await compareAndSwapParentGeneration(reference, current, reserved, options)
  const persisted = await persistParentCredentialRecord(binding, record, reserved, options)
  clearPendingParentCredentialRecord(binding, persisted.generation, options)
  return persisted
}

export async function parentCredentialRecordCommitment(
  record: StoredParentCredentialRecord,
  options?: Pick<ParentCredentialOperationOptions, 'crypto'>,
): Promise<string> {
  return recordCommitment(parseParentCredentialRecord(record), options)
}

export async function createPreparedParentCredentialRecordForTest(
  binding: InstallationBinding,
  pin: string,
  generation: number,
  options?: Pick<ParentCredentialOperationOptions, 'crypto' | 'now'>,
): Promise<StoredParentCredentialRecord> {
  if (!Number.isSafeInteger(generation) || generation <= 0) {
    throw new Error('A positive safe Parent credential generation is required.')
  }
  return createCredentialRecord(
    binding,
    generation,
    'prepared',
    pin,
    timestamp(options),
    undefined,
    options ?? {},
  )
}

export async function verifyParentCredentialRecord(
  record: unknown,
  binding: InstallationBinding,
  pin: unknown,
  options?: Pick<ParentCredentialOperationOptions, 'crypto'>,
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

export async function verifyPreparedParentCredentialForMigration(
  record: unknown,
  binding: InstallationBinding,
  pin: unknown,
  options?: Pick<ParentCredentialOperationOptions, 'crypto'>,
): Promise<boolean> {
  let validated: StoredParentCredentialRecord
  try {
    validated = parseParentCredentialRecord(record, binding)
  } catch {
    return false
  }
  return validated.state === 'prepared' &&
    verifyParentPinVerifier(validated.binding, pin, validated, options?.crypto)
}

export interface ParentMigrationPreparationSupersessionContext {
  readonly operationId: 'parent-pin:migration-reprepare'
  readonly binding: ParentCredentialBindingReference
  readonly preparedGeneration: number
  readonly preparedRecordCommitmentBase64: string
  readonly sourceRevision: string
  readonly migrationReceiptBase64: string
}

/** Internal proof port; the orchestrator must bind it to authoritative durable state. */
export interface ParentMigrationPreparationSupersessionAuthorization {
  readonly sourceRevision: string
  readonly migrationReceiptBase64: string
  consumeParentMigrationPreparationSupersession(
    context: ParentMigrationPreparationSupersessionContext,
  ): boolean | Promise<boolean>
}

/**
 * Internal migration seam. It can create only a non-authenticating prepared
 * record and never activates a generation.
 */
export async function prepareLegacyParentPinForMigration(
  binding: InstallationBinding,
  pin: string,
  options: ParentCredentialOperationOptions,
  supersessionAuthorization?: ParentMigrationPreparationSupersessionAuthorization,
): Promise<StoredParentCredentialRecord> {
  const current = await readParentCredentialSnapshot(binding, options)
  if (current) {
    if (
      current.record.state === 'prepared' &&
      await verifyPreparedParentCredentialForMigration(current.record, binding, pin, options)
    ) {
      const after = await readParentCredentialSnapshot(binding, options)
      if (parentCredentialSnapshotsEqual(current, after)) return current.record
      throw new ParentCredentialVaultError(
        'credential-conflict',
        'Prepared Parent credential changed while its source PIN was verified.',
      )
    }
    if (
      current.record.state === 'prepared' &&
      current.authority.activeGeneration === null &&
      current.authority.migrationCommitmentBase64 === null
    ) {
      const authorizationDescriptor = supersessionAuthorization &&
        Object.getOwnPropertyDescriptor(
          supersessionAuthorization,
          'consumeParentMigrationPreparationSupersession',
        )
      const sourceRevisionDescriptor = supersessionAuthorization &&
        Object.getOwnPropertyDescriptor(supersessionAuthorization, 'sourceRevision')
      const receiptDescriptor = supersessionAuthorization &&
        Object.getOwnPropertyDescriptor(
          supersessionAuthorization,
          'migrationReceiptBase64',
        )
      if (
        !authorizationDescriptor ||
        !authorizationDescriptor.enumerable ||
        !('value' in authorizationDescriptor) ||
        typeof authorizationDescriptor.value !== 'function' ||
        !sourceRevisionDescriptor ||
        !sourceRevisionDescriptor.enumerable ||
        !('value' in sourceRevisionDescriptor) ||
        typeof sourceRevisionDescriptor.value !== 'string' ||
        sourceRevisionDescriptor.value.length === 0 ||
        sourceRevisionDescriptor.value.length > 1_024 ||
        !receiptDescriptor ||
        !receiptDescriptor.enumerable ||
        !('value' in receiptDescriptor) ||
        typeof receiptDescriptor.value !== 'string'
      ) {
        throw new ParentCredentialVaultError(
          'authorization-required',
          'Authoritative migration re-preparation proof is required.',
        )
      }
      try {
        base64ToBytes(receiptDescriptor.value, LEARNER_PIN_DERIVED_KEY_BYTES)
      } catch {
        throw new ParentCredentialVaultError(
          'authorization-required',
          'Authoritative migration re-preparation receipt is malformed.',
        )
      }
      const accepted = await authorizationDescriptor.value.call(
        supersessionAuthorization,
        Object.freeze({
          operationId: 'parent-pin:migration-reprepare' as const,
          binding: parentCredentialBindingReference(binding),
          preparedGeneration: current.record.generation,
          preparedRecordCommitmentBase64: await recordCommitment(
            current.record,
            options,
          ),
          sourceRevision: sourceRevisionDescriptor.value,
          migrationReceiptBase64: receiptDescriptor.value,
        }),
      )
      if (accepted !== true) {
        throw new ParentCredentialVaultError(
          'authorization-required',
          'Authoritative migration re-preparation proof was denied.',
        )
      }
      const stable = await readParentCredentialSnapshot(binding, options)
      if (!parentCredentialSnapshotsEqual(current, stable)) {
        throw new ParentCredentialVaultError(
          'credential-conflict',
          'Prepared Parent credential changed during migration re-preparation proof.',
        )
      }
      const replacement = await createCredentialRecord(
        binding,
        nextGeneration(current.authority),
        'prepared',
        pin,
        current.record.createdAt,
        undefined,
        options,
      )
      return reserveAndPersistRecord(
        binding,
        current.authority,
        replacement,
        options,
      )
    }
    throw new ParentCredentialVaultError(
      'credential-conflict',
      'A current Parent credential prevents legacy preparation.',
    )
  }
  const reference = parentCredentialBindingReference(binding)
  const authority = await readGeneration(reference, options)
  if (authority.generation !== 0) {
    throw new ParentCredentialVaultError(
      'generation-conflict',
      'Legacy preparation cannot supersede an existing Parent generation.',
    )
  }
  const record = await createCredentialRecord(
    binding,
    nextGeneration(authority),
    'prepared',
    pin,
    timestamp(options),
    undefined,
    options,
  )
  return reserveAndPersistRecord(binding, authority, record, options)
}

/**
 * Internal malformed-legacy seam. The prepared verifier is unusable and still
 * distinct from the eventual reset-required tombstone.
 */
export async function markParentCredentialResetRequiredForMigration(
  binding: InstallationBinding,
  options: ParentCredentialOperationOptions,
): Promise<StoredParentCredentialRecord> {
  const current = await readParentCredentialSnapshot(binding, options)
  if (current?.record.state === 'prepared') return current.record
  if (current) {
    throw new ParentCredentialVaultError(
      'credential-conflict',
      'A current Parent credential prevents reset preparation.',
    )
  }
  const reference = parentCredentialBindingReference(binding)
  const authority = await readGeneration(reference, options)
  if (authority.generation !== 0) {
    throw new ParentCredentialVaultError(
      'generation-conflict',
      'Reset preparation cannot supersede an existing Parent generation.',
    )
  }
  const record = await createCredentialRecord(
    binding,
    nextGeneration(authority),
    'prepared',
    null,
    timestamp(options),
    undefined,
    options,
  )
  return reserveAndPersistRecord(binding, authority, record, options)
}

async function stagePreparedParentRecord(
  binding: InstallationBinding,
  preparedGeneration: number,
  state: 'enrolled' | 'reset-required',
  options: ParentCredentialOperationOptions,
): Promise<StoredParentCredentialRecord> {
  const current = await readParentCredentialSnapshot(binding, options)
  if (
    !current ||
    current.record.state !== 'prepared' ||
    current.record.generation !== preparedGeneration ||
    current.authority.activeGeneration !== null
  ) {
    throw new ParentCredentialVaultError(
      'generation-conflict',
      'Exact prepared Parent generation is required for promotion.',
    )
  }
  const now = timestamp(options)
  const staged = parseParentCredentialRecord({
    ...current.record,
    state,
    generation: nextGeneration(current.authority),
    ...(state === 'reset-required' ? { rotatedAt: now } : {}),
  }, binding)
  return reserveAndPersistRecord(binding, current.authority, staged, options)
}

export function stagePreparedParentCredentialForMigration(
  binding: InstallationBinding,
  preparedGeneration: number,
  options: ParentCredentialOperationOptions,
): Promise<StoredParentCredentialRecord> {
  return stagePreparedParentRecord(binding, preparedGeneration, 'enrolled', options)
}

export function stagePreparedParentResetForMigration(
  binding: InstallationBinding,
  preparedGeneration: number,
  options: ParentCredentialOperationOptions,
): Promise<StoredParentCredentialRecord> {
  return stagePreparedParentRecord(binding, preparedGeneration, 'reset-required', options)
}

export async function commitParentMigrationAuthority(
  binding: InstallationBinding,
  expectedState: 'missing' | 'enrolled' | 'reset-required',
  expectedGeneration: number | null,
  expectedRecordCommitmentBase64: string,
  migrationCommitmentBase64: string,
  options: ParentCredentialOperationOptions,
): Promise<StoredParentCredentialRecord | null> {
  try {
    base64ToBytes(expectedRecordCommitmentBase64, LEARNER_PIN_DERIVED_KEY_BYTES)
    base64ToBytes(migrationCommitmentBase64, LEARNER_PIN_DERIVED_KEY_BYTES)
  } catch {
    generationFailure('Parent migration completion commitments are malformed.')
  }
  const reference = parentCredentialBindingReference(binding)
  const authority = await readGeneration(reference, options)
  if (
    authority.migrationCommitmentBase64 !== null &&
    authority.migrationCommitmentBase64 !== migrationCommitmentBase64
  ) {
    generationFailure('A different completed Parent migration is already authoritative.')
  }

  const current = await readParentCredentialSnapshot(binding, options)
  let record: StoredParentCredentialRecord | null
  if (expectedState === 'missing') {
    if (
      expectedGeneration !== null ||
      current !== null ||
      authority.generation !== 0 ||
      authority.activeGeneration !== null ||
      authority.recordCommitmentBase64 !== null ||
      expectedRecordCommitmentBase64 !== await nullRecordCommitment(options)
    ) {
      generationFailure('Parent setup completion does not match exact generation-zero authority.')
    }
    record = null
  } else {
    if (
      expectedGeneration === null ||
      current === null ||
      current.record.state !== expectedState ||
      current.record.generation !== expectedGeneration ||
      current.authority.generation !== expectedGeneration ||
      current.authority.recordCommitmentBase64 !== expectedRecordCommitmentBase64 ||
      await recordCommitment(current.record, options) !== expectedRecordCommitmentBase64 ||
      (expectedState === 'reset-required' && current.authority.activeGeneration !== null) ||
      (expectedState === 'enrolled' &&
        current.authority.activeGeneration !== null &&
        current.authority.activeGeneration !== expectedGeneration)
    ) {
      generationFailure('Parent migration completion does not match its exact promoted record.')
    }
    record = current.record
  }

  const replacement: ParentCredentialGenerationSnapshot = Object.freeze({
    ...authority,
    activeGeneration: expectedState === 'enrolled' ? expectedGeneration : null,
    migrationCommitmentBase64,
  })
  if (!parentGenerationSnapshotsEqual(authority, replacement)) {
    await compareAndSwapParentGeneration(reference, authority, replacement, options)
  }

  const readBackAuthority = await readGeneration(reference, options)
  if (!parentGenerationSnapshotsEqual(readBackAuthority, replacement)) {
    throw new ParentCredentialVaultError(
      'persistence-verification-failed',
      'Completed Parent migration authority failed exact durable read-back.',
    )
  }
  const readBack = await readParentCredentialSnapshot(binding, options)
  if (expectedState === 'missing') {
    if (readBack !== null) generationFailure('Parent setup completion unexpectedly created a credential.')
    return null
  }
  if (
    readBack === null ||
    readBack.serialized !== JSON.stringify(record) ||
    readBack.authority.migrationCommitmentBase64 !== migrationCommitmentBase64 ||
    (expectedState === 'enrolled'
      ? readBack.authority.activeGeneration !== expectedGeneration
      : readBack.authority.activeGeneration !== null)
  ) {
    throw new ParentCredentialVaultError(
      'persistence-verification-failed',
      'Completed Parent migration record failed exact post-commit verification.',
    )
  }
  return readBack.record
}

function recordRejection(cause: unknown): boolean {
  return cause instanceof ParentCredentialVaultError &&
    (cause.code === 'malformed-record' ||
      cause.code === 'unsupported-version' ||
      cause.code === 'binding-mismatch' ||
      cause.code === 'generation-mismatch' ||
      cause.code === 'generation-conflict')
}

export async function readParentCredentialState(
  binding: InstallationBinding,
  options: ParentCredentialOperationOptions,
): Promise<ParentCredentialAvailability> {
  const subject = parentFailedAttemptSubject(binding)
  const current = await readParentCredentialSnapshot(binding, options)
  if (!current) return { status: 'parent-setup-required', subject }
  if (current.record.state === 'enrolled' && current.authority.activeGeneration === null) {
    return { status: 'prepared', subject }
  }
  return { status: current.record.state, subject }
}

export async function verifyParentPin(
  binding: InstallationBinding,
  pin: unknown,
  options: ParentCredentialOperationOptions,
): Promise<ParentPinVerificationResult> {
  const subject = parentFailedAttemptSubject(binding)
  let first: CurrentParentCredentialSnapshot | null
  try {
    first = await readParentCredentialSnapshot(binding, options)
  } catch (cause) {
    if (recordRejection(cause)) return { status: 'not-verified', subject }
    throw cause
  }
  if (!first) return { status: 'parent-setup-required', subject }
  if (first.record.state === 'reset-required') return { status: 'reset-required', subject }
  if (
    first.record.state !== 'enrolled' ||
    first.authority.activeGeneration !== first.record.generation
  ) {
    return { status: 'not-verified', subject }
  }

  const matches = await verifyParentPinVerifier(
    first.record.binding,
    pin,
    first.record,
    options.crypto,
  )
  let second: CurrentParentCredentialSnapshot | null
  try {
    second = await readParentCredentialSnapshot(binding, options)
  } catch (cause) {
    if (recordRejection(cause)) return { status: 'not-verified', subject }
    throw cause
  }
  if (
    !matches ||
    !second ||
    !parentCredentialSnapshotsEqual(first, second) ||
    second.record.state !== 'enrolled' ||
    second.authority.activeGeneration !== second.record.generation
  ) {
    return { status: 'not-verified', subject }
  }
  return { status: 'verified', subject }
}

function mutationResult(record: StoredParentCredentialRecord): ParentCredentialMutationResult {
  const binding = Object.freeze({ ...record.binding })
  return Object.freeze({
    status: record.state as 'enrolled' | 'reset-required',
    generation: record.generation,
    binding,
    subject: Object.freeze({ kind: 'parent' as const, householdId: binding.householdId }),
    createdAt: record.createdAt,
    ...(record.rotatedAt === undefined ? {} : { rotatedAt: record.rotatedAt }),
  })
}

async function requireStableSnapshot(
  binding: InstallationBinding,
  expected: CurrentParentCredentialSnapshot | null,
  options: ParentCredentialOperationOptions,
  message: string,
): Promise<CurrentParentCredentialSnapshot | null> {
  const current = await readParentCredentialSnapshot(binding, options)
  if (!parentCredentialSnapshotsEqual(expected, current)) {
    throw new ParentCredentialVaultError('credential-conflict', message)
  }
  return current
}

async function verifyReplacementBeforeCommit(
  pin: string,
  replacement: StoredParentCredentialRecord,
  options: ParentCredentialOperationOptions,
): Promise<void> {
  const matches = await verifyParentPinVerifier(
    replacement.binding,
    pin,
    replacement,
    options.crypto,
  )
  if (!matches) {
    throw new ParentCredentialVaultError(
      'persistence-verification-failed',
      'Replacement Parent credential failed pre-commit verification.',
    )
  }
}

export async function rotateParentPinAuthorized(
  binding: InstallationBinding,
  replacementPin: string,
  authorization: ParentCredentialRotationAuthorization,
  options: ParentCredentialOperationOptions,
): Promise<ParentCredentialMutationResult> {
  if (!isFourDigitPin(replacementPin)) {
    throw new Error('A Parent PIN must contain exactly four decimal digits.')
  }
  if (!authorization || typeof authorization.consumeParentCredentialRotationAuthorization !== 'function') {
    throw new ParentCredentialVaultError('authorization-required', 'Parent rotation authorization is required.')
  }
  return withParentCredentialMutationLock(binding, options, async (lockedBinding) => {
    const previous = await readParentCredentialSnapshot(lockedBinding, options)
    if (
      !previous ||
      previous.record.state !== 'enrolled' ||
      previous.authority.activeGeneration !== previous.record.generation
    ) {
      throw new ParentCredentialVaultError('credential-missing', 'An active enrolled Parent credential is required.')
    }
    const accepted = await authorization.consumeParentCredentialRotationAuthorization({
      operationId: 'parent-pin:rotate',
      binding: parentCredentialBindingReference(lockedBinding),
      credentialGeneration: previous.record.generation,
      credentialCreatedAt: previous.record.createdAt,
      ...(previous.record.rotatedAt === undefined
        ? {}
        : { credentialRotatedAt: previous.record.rotatedAt }),
    })
    if (accepted !== true) {
      throw new ParentCredentialVaultError('authorization-required', 'Parent rotation authorization was denied.')
    }
    await requireStableSnapshot(
      lockedBinding,
      previous,
      options,
      'Parent credential changed while rotation authorization was being consumed.',
    )
    const replacement = await createCredentialRecord(
      lockedBinding,
      nextGeneration(previous.authority),
      'enrolled',
      replacementPin,
      previous.record.createdAt,
      timestamp(options),
      options,
    )
    await verifyReplacementBeforeCommit(replacementPin, replacement, options)
    await requireStableSnapshot(
      lockedBinding,
      previous,
      options,
      'Parent credential changed while its replacement was being verified.',
    )
    return mutationResult(await reserveAndPersistActiveRecord(
      lockedBinding,
      previous.authority,
      replacement,
      options,
    ))
  })
}

export async function markParentCredentialResetRequiredAuthorized(
  binding: InstallationBinding,
  authorization: ParentCredentialResetAuthorization,
  options: ParentCredentialOperationOptions,
): Promise<ParentCredentialMutationResult> {
  if (!authorization || typeof authorization.consumeParentCredentialResetAuthorization !== 'function') {
    throw new ParentCredentialVaultError('authorization-required', 'Parent recovery authorization is required.')
  }
  return withParentCredentialMutationLock(binding, options, async (lockedBinding) => {
    const reference = parentCredentialBindingReference(lockedBinding)
    const authorityBefore = await readGeneration(reference, options)
    let previous: CurrentParentCredentialSnapshot | null = null
    let unavailable = false
    try {
      previous = await readParentCredentialSnapshot(lockedBinding, options)
    } catch (cause) {
      if (!recordRejection(cause)) throw cause
      unavailable = true
    }
    const accepted = await authorization.consumeParentCredentialResetAuthorization({
      operationId: 'parent-pin:reset-required',
      binding: reference,
      priorState: unavailable ? 'unavailable' : previous?.record.state ?? 'missing',
      priorGeneration: authorityBefore.generation,
    })
    if (accepted !== true) {
      throw new ParentCredentialVaultError('authorization-required', 'Parent recovery authorization was denied.')
    }
    if (previous) {
      await requireStableSnapshot(
        lockedBinding,
        previous,
        options,
        'Parent credential changed while recovery authorization was being consumed.',
      )
    }
    const authority = await readGeneration(reference, options)
    if (!parentGenerationSnapshotsEqual(authorityBefore, authority)) {
      throw new ParentCredentialVaultError(
        'generation-conflict',
        'Parent credential authority changed while recovery authorization was being consumed.',
      )
    }
    const now = timestamp(options)
    const tombstone = await createCredentialRecord(
      lockedBinding,
      nextGeneration(authority),
      'reset-required',
      null,
      previous?.record.createdAt ?? now,
      previous ? now : undefined,
      options,
    )
    return mutationResult(
      await reserveAndPersistRecord(lockedBinding, authority, tombstone, options),
    )
  })
}

export async function recoverParentPinAuthorized(
  binding: InstallationBinding,
  replacementPin: string,
  authorization: ParentCredentialRecoveryAuthorization,
  options: ParentCredentialOperationOptions,
): Promise<ParentCredentialMutationResult> {
  if (!isFourDigitPin(replacementPin)) {
    throw new Error('A Parent PIN must contain exactly four decimal digits.')
  }
  if (!authorization || typeof authorization.consumeParentCredentialRecoveryAuthorization !== 'function') {
    throw new ParentCredentialVaultError('authorization-required', 'Parent recovery authorization is required.')
  }
  return withParentCredentialMutationLock(binding, options, async (lockedBinding) => {
    const previous = await readParentCredentialSnapshot(lockedBinding, options)
    if (!previous || previous.record.state !== 'reset-required') {
      throw new ParentCredentialVaultError(
        'credential-missing',
        'A reset-required Parent tombstone is required for recovery.',
      )
    }
    const accepted = await authorization.consumeParentCredentialRecoveryAuthorization({
      operationId: 'parent-pin:recover',
      binding: parentCredentialBindingReference(lockedBinding),
      priorGeneration: previous.record.generation,
    })
    if (accepted !== true) {
      throw new ParentCredentialVaultError('authorization-required', 'Parent recovery authorization was denied.')
    }
    await requireStableSnapshot(
      lockedBinding,
      previous,
      options,
      'Parent credential changed while recovery authorization was being consumed.',
    )
    const replacement = await createCredentialRecord(
      lockedBinding,
      nextGeneration(previous.authority),
      'enrolled',
      replacementPin,
      previous.record.createdAt,
      timestamp(options),
      options,
    )
    await verifyReplacementBeforeCommit(replacementPin, replacement, options)
    await requireStableSnapshot(
      lockedBinding,
      previous,
      options,
      'Parent credential changed while its recovery replacement was being verified.',
    )
    return mutationResult(await reserveAndPersistActiveRecord(
      lockedBinding,
      previous.authority,
      replacement,
      options,
    ))
  })
}
