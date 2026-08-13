import {
  LEARNER_CREDENTIAL_SCHEMA_VERSION,
  LEARNER_PIN_VERIFIER_SCHEME_VERSION,
  parseProfileId,
  type LearnerCredentialRecord,
  type ProfileId,
} from '../contracts'
import {
  base64ToBytes,
  createPinVerifier,
  createUnusablePinVerifier,
  isSupportedPinCostParameters,
  LEARNER_PIN_COST_PARAMETERS_V1,
  LEARNER_PIN_COST_PARAMETERS_VERSION,
  LEARNER_PIN_DERIVED_KEY_BYTES,
  LEARNER_PIN_SALT_BYTES,
  type PinVerifierCrypto,
  verifyPinVerifier,
} from './pinVerifier'

export const LEARNER_CREDENTIAL_STORAGE_NAMESPACE = 'homeschool-hq:security:learner-credentials:v1' as const

export interface StoredLearnerCredentialRecord extends LearnerCredentialRecord {
  readonly costParametersVersion: typeof LEARNER_PIN_COST_PARAMETERS_VERSION
}

export interface CredentialStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type CredentialVaultErrorCode =
  | 'storage-unavailable'
  | 'invalid-profile-id'
  | 'credential-exists'
  | 'credential-missing'
  | 'credential-mismatch'
  | 'malformed-record'
  | 'unsupported-version'
  | 'persistence-verification-failed'

export class CredentialVaultError extends Error {
  constructor(
    readonly code: CredentialVaultErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'CredentialVaultError'
  }
}

export interface CredentialOperationOptions {
  readonly storage?: CredentialStorage
  readonly crypto?: PinVerifierCrypto
  readonly now?: () => Date
}

const REQUIRED_RECORD_KEYS = Object.freeze([
  'schemaVersion',
  'storage',
  'profileId',
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
const OPTIONAL_RECORD_KEYS = Object.freeze(['rotatedAt'] as const)
const ALLOWED_RECORD_KEYS: readonly string[] = Object.freeze([...REQUIRED_RECORD_KEYS, ...OPTIONAL_RECORD_KEYS])
const COST_PARAMETER_KEYS: readonly string[] = Object.freeze(['iterations', 'derivedKeyBytes'])

function storageFrom(options?: CredentialOperationOptions): CredentialStorage {
  if (options?.storage) return options.storage
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Fall through to the fail-closed error.
  }
  throw new CredentialVaultError('storage-unavailable', 'Device-local learner credential storage is unavailable.')
}

export function validateLearnerProfileId(profileId: unknown): asserts profileId is ProfileId {
  if (parseProfileId(profileId) === null) {
    throw new CredentialVaultError(
      'invalid-profile-id',
      'A canonical Manuel Academy profile identifier (p1 through p5) is required.',
    )
  }
}

export function learnerCredentialStorageKey(profileId: unknown): string {
  validateLearnerProfileId(profileId)
  return `${LEARNER_CREDENTIAL_STORAGE_NAMESPACE}:${encodeURIComponent(profileId)}`
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function validIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
}

function malformed(message: string): never {
  throw new CredentialVaultError('malformed-record', message)
}

/**
 * Reads each own key exactly once via its property descriptor so a hostile
 * getter/setter is never invoked, and fails closed on anything outside an
 * exact own-enumerable-data-property shape: symbol keys, inherited keys, and
 * unexpected or non-enumerable/accessor fields are all rejected before their
 * value is ever read.
 */
function ownDataSnapshot(value: object, allowedKeys: readonly string[]): Record<string, unknown> {
  if (Object.getOwnPropertySymbols(value).length > 0) {
    malformed('Learner credential record contains missing or unexpected fields.')
  }
  const snapshot: Record<string, unknown> = {}
  for (const name of Object.getOwnPropertyNames(value)) {
    if (!allowedKeys.includes(name)) {
      malformed('Learner credential record contains missing or unexpected fields.')
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, name)
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      malformed('Learner credential record contains missing or unexpected fields.')
    }
    snapshot[name] = descriptor.value
  }
  return snapshot
}

export function parseLearnerCredentialRecord(
  value: unknown,
  expectedProfileId?: unknown,
): StoredLearnerCredentialRecord {
  if (!plainRecord(value)) malformed('Learner credential record is not an object.')

  const snapshot = ownDataSnapshot(value, ALLOWED_RECORD_KEYS)
  if (!REQUIRED_RECORD_KEYS.every((key) => Object.hasOwn(snapshot, key))) {
    malformed('Learner credential record contains missing or unexpected fields.')
  }

  validateLearnerProfileId(snapshot.profileId)
  if (expectedProfileId !== undefined) validateLearnerProfileId(expectedProfileId)

  if (
    snapshot.schemaVersion !== LEARNER_CREDENTIAL_SCHEMA_VERSION ||
    snapshot.verifierSchemeVersion !== LEARNER_PIN_VERIFIER_SCHEME_VERSION ||
    snapshot.costParametersVersion !== LEARNER_PIN_COST_PARAMETERS_VERSION
  ) {
    throw new CredentialVaultError('unsupported-version', 'Learner credential record uses an unsupported version.')
  }

  const costParametersValue = snapshot.costParameters
  if (!plainRecord(costParametersValue)) {
    malformed('Learner credential record violates the device-local credential contract.')
  }
  const costSnapshot = ownDataSnapshot(costParametersValue, COST_PARAMETER_KEYS)
  const supportedCostParameters =
    COST_PARAMETER_KEYS.every((key) => Object.hasOwn(costSnapshot, key)) &&
    isSupportedPinCostParameters(snapshot.costParametersVersion, costSnapshot)

  if (
    snapshot.storage !== 'device-local-only' ||
    snapshot.credentialKind !== 'learner-pin' ||
    snapshot.verifierScheme !== 'pbkdf2-sha256' ||
    (expectedProfileId !== undefined && snapshot.profileId !== expectedProfileId) ||
    (snapshot.state !== 'enrolled' && snapshot.state !== 'reset-required') ||
    !supportedCostParameters ||
    !validIsoTimestamp(snapshot.createdAt) ||
    (snapshot.rotatedAt !== undefined && !validIsoTimestamp(snapshot.rotatedAt)) ||
    (typeof snapshot.rotatedAt === 'string' && Date.parse(snapshot.rotatedAt) < Date.parse(snapshot.createdAt))
  ) {
    malformed('Learner credential record violates the device-local credential contract.')
  }

  try {
    base64ToBytes(snapshot.saltBase64 as string, LEARNER_PIN_SALT_BYTES)
    base64ToBytes(snapshot.verifierBase64 as string, LEARNER_PIN_DERIVED_KEY_BYTES)
  } catch {
    malformed('Learner credential record contains malformed verifier material.')
  }

  const canonical: Record<string, unknown> = {
    schemaVersion: snapshot.schemaVersion,
    storage: snapshot.storage,
    profileId: snapshot.profileId,
    credentialKind: snapshot.credentialKind,
    verifierScheme: snapshot.verifierScheme,
    verifierSchemeVersion: snapshot.verifierSchemeVersion,
    costParametersVersion: snapshot.costParametersVersion,
    saltBase64: snapshot.saltBase64,
    verifierBase64: snapshot.verifierBase64,
    // Nested cost parameters were only ever compared for equality against this
    // frozen canonical constant, so the returned record never carries a
    // caller-controlled nested object.
    costParameters: LEARNER_PIN_COST_PARAMETERS_V1,
    state: snapshot.state,
    createdAt: snapshot.createdAt,
  }
  if (Object.hasOwn(snapshot, 'rotatedAt')) canonical.rotatedAt = snapshot.rotatedAt

  return Object.freeze(canonical) as unknown as StoredLearnerCredentialRecord
}

function parseStoredRecord(raw: string, profileId: ProfileId): StoredLearnerCredentialRecord {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    malformed('Learner credential record is not valid JSON.')
  }
  return parseLearnerCredentialRecord(parsed, profileId)
}

function timestamp(options?: CredentialOperationOptions): string {
  const value = (options?.now ?? (() => new Date()))().toISOString()
  if (!validIsoTimestamp(value)) throw new Error('Credential clock returned an invalid timestamp.')
  return value
}

export async function createLearnerCredentialRecord(
  profileId: unknown,
  pin: string,
  options?: CredentialOperationOptions,
): Promise<StoredLearnerCredentialRecord> {
  validateLearnerProfileId(profileId)
  const verifier = await createPinVerifier(profileId, pin, options?.crypto)
  return {
    schemaVersion: LEARNER_CREDENTIAL_SCHEMA_VERSION,
    storage: 'device-local-only',
    profileId,
    credentialKind: 'learner-pin',
    verifierScheme: 'pbkdf2-sha256',
    verifierSchemeVersion: LEARNER_PIN_VERIFIER_SCHEME_VERSION,
    ...verifier,
    state: 'enrolled',
    createdAt: timestamp(options),
  }
}

export function readLearnerCredential(
  profileId: unknown,
  options?: CredentialOperationOptions,
): StoredLearnerCredentialRecord | null {
  validateLearnerProfileId(profileId)
  const key = learnerCredentialStorageKey(profileId)
  const storage = storageFrom(options)
  let raw: string | null
  try {
    raw = storage.getItem(key)
  } catch {
    throw new CredentialVaultError('storage-unavailable', 'Device-local learner credential storage could not be read.')
  }
  return raw === null ? null : parseStoredRecord(raw, profileId)
}

/**
 * Internal storage-mutation primitive. No external file imports this: every
 * write goes through the reviewed orchestration in this module (enroll,
 * rotate, reset) so a durable overwrite always follows a verified decision,
 * never a raw caller-supplied record. Keep this un-exported.
 */
function writeLearnerCredential(
  record: unknown,
  options?: CredentialOperationOptions,
): StoredLearnerCredentialRecord {
  const validated = parseLearnerCredentialRecord(record)
  const storage = storageFrom(options)
  const key = learnerCredentialStorageKey(validated.profileId)
  const serialized = JSON.stringify(validated)
  try {
    storage.setItem(key, serialized)
    const persistedRaw = storage.getItem(key)
    if (persistedRaw !== serialized) {
      throw new CredentialVaultError(
        'persistence-verification-failed',
        'Learner credential did not pass durable read-back verification.',
      )
    }
    return parseStoredRecord(persistedRaw, validated.profileId)
  } catch (cause) {
    if (cause instanceof CredentialVaultError) throw cause
    throw new CredentialVaultError(
      'storage-unavailable',
      'Device-local learner credential storage could not be written.',
    )
  }
}

export async function verifyLearnerCredentialRecord(
  record: unknown,
  pin: unknown,
  options?: CredentialOperationOptions,
): Promise<boolean> {
  let validated: StoredLearnerCredentialRecord
  try {
    validated = parseLearnerCredentialRecord(record)
  } catch {
    return false
  }
  return validated.state === 'enrolled' && verifyPinVerifier(validated.profileId, pin, validated, options?.crypto)
}

export async function verifyLearnerPin(
  profileId: unknown,
  pin: unknown,
  options?: CredentialOperationOptions,
): Promise<boolean> {
  // Keep invalid caller input distinct from invalid credential material read
  // from an otherwise valid profile's storage location.
  validateLearnerProfileId(profileId)
  let record: StoredLearnerCredentialRecord | null
  try {
    record = readLearnerCredential(profileId, options)
  } catch (cause) {
    if (
      cause instanceof CredentialVaultError &&
      (cause.code === 'malformed-record' || cause.code === 'unsupported-version' || cause.code === 'invalid-profile-id')
    ) {
      return false
    }
    throw cause
  }
  return record === null ? false : verifyLearnerCredentialRecord(record, pin, options)
}

export async function enrollLearnerPin(
  profileId: unknown,
  pin: string,
  options?: CredentialOperationOptions,
): Promise<StoredLearnerCredentialRecord> {
  if (readLearnerCredential(profileId, options) !== null) {
    throw new CredentialVaultError('credential-exists', 'A learner credential already exists for this profile.')
  }
  const record = await createLearnerCredentialRecord(profileId, pin, options)
  const persisted = writeLearnerCredential(record, options)
  if (await verifyLearnerCredentialRecord(persisted, pin, options)) return persisted

  try {
    storageFrom(options).removeItem(learnerCredentialStorageKey(profileId))
  } catch {
    // The operation still fails closed even if best-effort cleanup is unavailable.
  }
  throw new CredentialVaultError(
    'persistence-verification-failed',
    'Persisted learner credential could not verify its source PIN.',
  )
}

/**
 * Async handoff boundary for callers that still hold a legacy plaintext PIN.
 * Resolution means derivation, durable vault read-back, and source-PIN
 * verification have all succeeded, so the caller may discard its source PIN.
 */
export function enrollLegacyCredential(
  profileId: unknown,
  pin: string,
  options?: CredentialOperationOptions,
): Promise<StoredLearnerCredentialRecord> {
  return enrollLearnerPin(profileId, pin, options)
}

export async function rotateLearnerPin(
  profileId: unknown,
  currentPin: unknown,
  replacementPin: string,
  options?: CredentialOperationOptions,
): Promise<StoredLearnerCredentialRecord> {
  const previous = readLearnerCredential(profileId, options)
  if (!previous) {
    throw new CredentialVaultError('credential-missing', 'Learner credential is not enrolled.')
  }
  if (!(await verifyLearnerCredentialRecord(previous, currentPin, options))) {
    throw new CredentialVaultError('credential-mismatch', 'Current learner credential verification failed.')
  }

  const replacement = await createLearnerCredentialRecord(profileId, replacementPin, options)
  const rotated: StoredLearnerCredentialRecord = {
    ...replacement,
    createdAt: previous.createdAt,
    rotatedAt: timestamp(options),
  }
  try {
    const persisted = writeLearnerCredential(rotated, options)
    if (await verifyLearnerCredentialRecord(persisted, replacementPin, options)) {
      return persisted
    }
    throw new CredentialVaultError('persistence-verification-failed', 'Rotated learner credential failed verification.')
  } catch (cause) {
    try {
      writeLearnerCredential(previous, options)
    } catch {
      // The original error remains the controlling failure; all reads fail closed.
    }
    throw cause
  }
}

export async function markLearnerCredentialResetRequired(
  profileId: unknown,
  options?: CredentialOperationOptions,
): Promise<StoredLearnerCredentialRecord> {
  validateLearnerProfileId(profileId)
  const existing = readLearnerCredential(profileId, options)
  if (existing?.state === 'reset-required') return existing
  const now = timestamp(options)
  const verifier = await createUnusablePinVerifier(profileId, options?.crypto)
  if (existing) {
    return writeLearnerCredential(
      {
        ...existing,
        ...verifier,
        state: 'reset-required',
        rotatedAt: now,
      },
      options,
    )
  }
  return writeLearnerCredential(
    {
      schemaVersion: LEARNER_CREDENTIAL_SCHEMA_VERSION,
      storage: 'device-local-only',
      profileId,
      credentialKind: 'learner-pin',
      verifierScheme: 'pbkdf2-sha256',
      verifierSchemeVersion: LEARNER_PIN_VERIFIER_SCHEME_VERSION,
      ...verifier,
      state: 'reset-required',
      createdAt: now,
    },
    options,
  )
}

export function deleteLearnerCredential(profileId: unknown, options?: CredentialOperationOptions): void {
  const storage = storageFrom(options)
  const key = learnerCredentialStorageKey(profileId)
  try {
    storage.removeItem(key)
    if (storage.getItem(key) !== null) {
      throw new CredentialVaultError(
        'persistence-verification-failed',
        'Learner credential deletion did not pass read-back verification.',
      )
    }
  } catch (cause) {
    if (cause instanceof CredentialVaultError) throw cause
    throw new CredentialVaultError('storage-unavailable', 'Device-local learner credential could not be deleted.')
  }
}
