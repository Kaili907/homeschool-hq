import {
  LEARNER_CREDENTIAL_SCHEMA_VERSION,
  LEARNER_PIN_VERIFIER_SCHEME_VERSION,
  type LearnerCredentialRecord,
} from '../contracts'
import {
  base64ToBytes,
  createPinVerifier,
  createUnusablePinVerifier,
  isSupportedPinCostParameters,
  LEARNER_PIN_COST_PARAMETERS_VERSION,
  LEARNER_PIN_DERIVED_KEY_BYTES,
  LEARNER_PIN_SALT_BYTES,
  type PinVerifierCrypto,
  verifyPinVerifier,
} from './pinVerifier'

export const LEARNER_CREDENTIAL_STORAGE_NAMESPACE =
  'homeschool-hq:security:learner-credentials:v1' as const

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

function storageFrom(options?: CredentialOperationOptions): CredentialStorage {
  if (options?.storage) return options.storage
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Fall through to the fail-closed error.
  }
  throw new CredentialVaultError(
    'storage-unavailable',
    'Device-local learner credential storage is unavailable.',
  )
}

export function validateLearnerProfileId(profileId: unknown): asserts profileId is string {
  if (typeof profileId !== 'string') {
    throw new CredentialVaultError(
      'invalid-profile-id',
      'A stable non-empty profile identifier is required.',
    )
  }
  let hasMalformedSurrogate = false
  for (let index = 0; index < profileId.length; index += 1) {
    const codeUnit = profileId.charCodeAt(index)
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = profileId.charCodeAt(index + 1)
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        hasMalformedSurrogate = true
        break
      }
      index += 1
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      hasMalformedSurrogate = true
      break
    }
  }
  if (
    profileId.length === 0 ||
    profileId.length > 256 ||
    /[\u0000-\u001f\u007f]/.test(profileId) ||
    hasMalformedSurrogate
  ) {
    throw new CredentialVaultError(
      'invalid-profile-id',
      'A stable non-empty profile identifier is required.',
    )
  }
}

export function learnerCredentialStorageKey(profileId: string): string {
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

export function parseLearnerCredentialRecord(
  value: unknown,
  expectedProfileId?: string,
): StoredLearnerCredentialRecord {
  if (!plainRecord(value)) malformed('Learner credential record is not an object.')

  validateLearnerProfileId(value.profileId)
  if (expectedProfileId !== undefined) validateLearnerProfileId(expectedProfileId)

  if (
    value.schemaVersion !== LEARNER_CREDENTIAL_SCHEMA_VERSION ||
    value.verifierSchemeVersion !== LEARNER_PIN_VERIFIER_SCHEME_VERSION ||
    value.costParametersVersion !== LEARNER_PIN_COST_PARAMETERS_VERSION
  ) {
    throw new CredentialVaultError(
      'unsupported-version',
      'Learner credential record uses an unsupported version.',
    )
  }

  const allowedKeys = value.rotatedAt === undefined
    ? REQUIRED_RECORD_KEYS
    : [...REQUIRED_RECORD_KEYS, 'rotatedAt']
  const keys = Object.keys(value)
  if (
    keys.length !== allowedKeys.length ||
    !keys.every((key) => allowedKeys.includes(key as never))
  ) {
    malformed('Learner credential record contains missing or unexpected fields.')
  }

  if (
    value.storage !== 'device-local-only' ||
    value.credentialKind !== 'learner-pin' ||
    value.verifierScheme !== 'pbkdf2-sha256' ||
    (expectedProfileId !== undefined && value.profileId !== expectedProfileId) ||
    (value.state !== 'enrolled' && value.state !== 'reset-required') ||
    !isSupportedPinCostParameters(
      value.costParametersVersion,
      value.costParameters,
    ) ||
    !validIsoTimestamp(value.createdAt) ||
    (value.rotatedAt !== undefined && !validIsoTimestamp(value.rotatedAt)) ||
    (typeof value.rotatedAt === 'string' &&
      Date.parse(value.rotatedAt) < Date.parse(value.createdAt))
  ) {
    malformed('Learner credential record violates the device-local credential contract.')
  }

  try {
    base64ToBytes(value.saltBase64 as string, LEARNER_PIN_SALT_BYTES)
    base64ToBytes(value.verifierBase64 as string, LEARNER_PIN_DERIVED_KEY_BYTES)
  } catch {
    malformed('Learner credential record contains malformed verifier material.')
  }

  return value as unknown as StoredLearnerCredentialRecord
}

function parseStoredRecord(raw: string, profileId: string): StoredLearnerCredentialRecord {
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
  profileId: string,
  pin: string,
  options?: CredentialOperationOptions,
): Promise<StoredLearnerCredentialRecord> {
  validateLearnerProfileId(profileId)
  const verifier = await createPinVerifier(pin, options?.crypto)
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
  profileId: string,
  options?: CredentialOperationOptions,
): StoredLearnerCredentialRecord | null {
  const storage = storageFrom(options)
  const key = learnerCredentialStorageKey(profileId)
  let raw: string | null
  try {
    raw = storage.getItem(key)
  } catch {
    throw new CredentialVaultError(
      'storage-unavailable',
      'Device-local learner credential storage could not be read.',
    )
  }
  return raw === null ? null : parseStoredRecord(raw, profileId)
}

export function writeLearnerCredential(
  record: StoredLearnerCredentialRecord,
  options?: CredentialOperationOptions,
): StoredLearnerCredentialRecord {
  const validated = parseLearnerCredentialRecord(record, record.profileId)
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
  record: StoredLearnerCredentialRecord,
  pin: unknown,
  options?: CredentialOperationOptions,
): Promise<boolean> {
  let validated: StoredLearnerCredentialRecord
  try {
    validated = parseLearnerCredentialRecord(record, record.profileId)
  } catch {
    return false
  }
  return validated.state === 'enrolled' &&
    verifyPinVerifier(pin, validated, options?.crypto)
}

export async function verifyLearnerPin(
  profileId: string,
  pin: unknown,
  options?: CredentialOperationOptions,
): Promise<boolean> {
  const record = readLearnerCredential(profileId, options)
  return record === null ? false : verifyLearnerCredentialRecord(record, pin, options)
}

export async function enrollLearnerPin(
  profileId: string,
  pin: string,
  options?: CredentialOperationOptions,
): Promise<StoredLearnerCredentialRecord> {
  if (readLearnerCredential(profileId, options) !== null) {
    throw new CredentialVaultError(
      'credential-exists',
      'A learner credential already exists for this profile.',
    )
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
  profileId: string,
  pin: string,
  options?: CredentialOperationOptions,
): Promise<StoredLearnerCredentialRecord> {
  return enrollLearnerPin(profileId, pin, options)
}

export async function rotateLearnerPin(
  profileId: string,
  currentPin: unknown,
  replacementPin: string,
  options?: CredentialOperationOptions,
): Promise<StoredLearnerCredentialRecord> {
  const previous = readLearnerCredential(profileId, options)
  if (!previous) {
    throw new CredentialVaultError('credential-missing', 'Learner credential is not enrolled.')
  }
  if (!(await verifyLearnerCredentialRecord(previous, currentPin, options))) {
    throw new CredentialVaultError(
      'credential-mismatch',
      'Current learner credential verification failed.',
    )
  }

  const replacement = await createLearnerCredentialRecord(
    profileId,
    replacementPin,
    options,
  )
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
    throw new CredentialVaultError(
      'persistence-verification-failed',
      'Rotated learner credential failed verification.',
    )
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
  profileId: string,
  options?: CredentialOperationOptions,
): Promise<StoredLearnerCredentialRecord> {
  const existing = readLearnerCredential(profileId, options)
  if (existing?.state === 'reset-required') return existing
  const now = timestamp(options)
  const verifier = await createUnusablePinVerifier(options?.crypto)
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

export function deleteLearnerCredential(
  profileId: string,
  options?: CredentialOperationOptions,
): void {
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
    throw new CredentialVaultError(
      'storage-unavailable',
      'Device-local learner credential could not be deleted.',
    )
  }
}
