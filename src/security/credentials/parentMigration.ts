import {
  CredentialSanitizationError,
  sanitizeCredentialFreeEducationalData,
  type CredentialFreeJsonValue,
} from '../appData'
import type {
  InstallationBinding,
  ParentCredentialBindingReference,
  ProfileId,
} from '../contracts'
import { parseProfileId } from '../contracts'
import {
  base64ToBytes,
  bytesToBase64,
  isFourDigitPin,
  LEARNER_PIN_DERIVED_KEY_BYTES,
} from './pinVerifier'
import {
  canonicalCredentialFreeJson,
  classifyLegacyPin,
  finalizePreparedLegacyEducationalCredentials,
  prepareLegacyEducationalCredentials,
  readLegacyCredentialMigrationRecord,
  type LegacyCredentialMigrationOptions,
  type LegacyCredentialMigrationOutcome,
  type LegacyCredentialMigrationResult,
} from './migration'
import {
  parentCredentialBindingReference,
  parseParentCredentialRecord,
  withParentCredentialMutationLock,
  type ParentCredentialOperationOptions,
  type StoredParentCredentialRecord,
} from './parentVault'
import {
  commitParentMigrationAuthority,
  markParentCredentialResetRequiredForMigration,
  parentCredentialRecordCommitment,
  prepareLegacyParentPinForMigration,
  readParentCredentialRecord,
  readParentCredentialGeneration,
  readParentCredentialSnapshot,
  stagePreparedParentCredentialForMigration,
  stagePreparedParentResetForMigration,
  verifyPreparedParentCredentialForMigration,
  type ParentMigrationPreparationSupersessionContext,
  type ParentMigrationPreparationSupersessionAuthorization,
} from './parentVault.internal'
import {
  readLearnerCredential,
  type CredentialStorage,
} from './vault'

export const LEGACY_PARENT_CREDENTIAL_MIGRATION_SCHEMA_VERSION = 2 as const
export const LEGACY_PARENT_CREDENTIAL_MIGRATION_NAMESPACE =
  'homeschool-hq:security:parent-pin-migration:v2' as const

const NULL_PARENT_RECORD_COMMITMENT_BASE64 =
  'dCNOmK/nSY+12vHzasLXiswzlGT5UHA7jAGYkvmCuQs=' as const

export type LegacyParentPinClassification =
  | 'migratable'
  | 'parent-setup-required'
  | 'reset-required'

export type LegacyParentMigrationStage =
  | 'prepared'
  | 'educational-committed'
  | 'credential-promoted'
  | 'completed'

export interface LegacyParentCredentialMigrationRecord {
  readonly schemaVersion: typeof LEGACY_PARENT_CREDENTIAL_MIGRATION_SCHEMA_VERSION
  readonly storage: 'device-local-migration-journal'
  readonly binding: ParentCredentialBindingReference
  readonly classification: LegacyParentPinClassification
  readonly stage: LegacyParentMigrationStage
  readonly attempt: number
  /** Credential-redacted source shape; never a digest of a four-digit PIN. */
  readonly sourceStructureCommitmentBase64: string
  readonly educationalDataCommitmentBase64: string
  readonly preparedParentCommitmentBase64: string
  readonly promotedParentCommitmentBase64: string | null
  readonly learnerMigrationCommitmentBase64: string
  readonly learnerProfileIds: readonly ProfileId[]
  /** Complete canonical educational profile set, including PIN-free learners. */
  readonly educationalProfileIds: readonly ProfileId[]
  readonly preparedGeneration: number | null
  readonly promotedGeneration: number | null
  /** Opaque durable revision from which this exact attempt was derived. */
  readonly sourceRevision: string
  /** Random transaction identity; never derived from a PIN or verifier. */
  readonly migrationReceiptBase64: string
  readonly completionSealBase64: string | null
  readonly updatedAt: string
}

export interface LegacyParentCredentialMigrationOutcome {
  readonly classification: LegacyParentPinClassification
  readonly credentialState: 'enrolled' | 'parent-setup-required' | 'reset-required'
  readonly resumed: boolean
}

export interface LegacyParentCredentialMigrationResult {
  readonly educationalData: CredentialFreeJsonValue
  readonly outcome: LegacyParentCredentialMigrationOutcome
}

export interface DurableParentMigrationSnapshot {
  readonly educationalData: unknown
  /** Opaque, ABA-resistant revision which changes on every durable write. */
  readonly revision: string
  /** Transaction receipt stored atomically with sanitized educational data. */
  readonly migrationReceiptBase64: string | null
  /** Exact prepared journal invariant stored atomically with the receipt. */
  readonly migrationPreparationCommitmentBase64: string | null
  /** Immutable completed-journal anchor stored outside local journal storage. */
  readonly migrationCompletionCommitmentBase64: string | null
}

export interface DurableParentMigrationPersistence {
  /**
   * Atomically writes credential-free data plus the random receipt only if the
   * complete authoritative snapshot (including revision and metadata) remains
   * exact. A false result must leave every durable field unchanged.
   */
  writeIfUnchanged(
    expected: DurableParentMigrationSnapshot,
    educationalData: CredentialFreeJsonValue,
    migrationReceiptBase64: string,
    migrationPreparationCommitmentBase64: string,
  ): boolean | Promise<boolean>
  /** Atomically reads educational data, revision, receipt, and completion anchor. */
  read(): DurableParentMigrationSnapshot | Promise<DurableParentMigrationSnapshot>
  /**
   * Acquires the durable educational-writer lock, atomically verifies the
   * expected snapshot and holds the lock through operation. Every educational
   * writer and every bound learner credential/journal writer must coordinate
   * with this lock through the Parent authority CAS. `commitCompletion` atomically
   * installs (or exactly reuses) the immutable anchor only after the caller
   * has validated all cross-store invariants, while the lock remains held.
   */
  withMigrationCommitLock<T>(
    expected: DurableParentMigrationSnapshot,
    completionCommitmentBase64: string,
    operation: (
      lockedSnapshot: DurableParentMigrationSnapshot,
      commitCompletion: () =>
        | DurableParentMigrationSnapshot
        | Promise<DurableParentMigrationSnapshot>,
    ) => T | Promise<T>,
  ): T | Promise<T>
}

export interface LegacyParentCredentialMigrationOptions
  extends ParentCredentialOperationOptions {
  readonly educationalDataPersistence: DurableParentMigrationPersistence
  readonly afterStage?: (
    stage: LegacyParentMigrationStage,
  ) => void | Promise<void>
}

const STAGES: readonly LegacyParentMigrationStage[] = Object.freeze([
  'prepared',
  'educational-committed',
  'credential-promoted',
  'completed',
])

const JOURNAL_KEYS = Object.freeze([
  'schemaVersion',
  'storage',
  'binding',
  'classification',
  'stage',
  'attempt',
  'sourceStructureCommitmentBase64',
  'educationalDataCommitmentBase64',
  'preparedParentCommitmentBase64',
  'promotedParentCommitmentBase64',
  'learnerMigrationCommitmentBase64',
  'learnerProfileIds',
  'educationalProfileIds',
  'preparedGeneration',
  'promotedGeneration',
  'sourceRevision',
  'migrationReceiptBase64',
  'completionSealBase64',
  'updatedAt',
] as const)

type SnapshotJsonValue =
  | null
  | boolean
  | number
  | string
  | SnapshotJsonValue[]
  | { readonly [key: string]: SnapshotJsonValue }

const RESERVED_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

function snapshotFailure(path: string, message: string): never {
  throw new CredentialSanitizationError(path, message)
}

/** Clones the complete legacy snapshot without invoking any property accessor. */
function cloneSnapshotJson(
  value: unknown,
  path = '$',
  active = new WeakSet<object>(),
): SnapshotJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) snapshotFailure(path, 'Snapshot contains a non-finite number')
    return value
  }
  if (typeof value !== 'object') snapshotFailure(path, 'Snapshot contains a non-JSON value')
  if (active.has(value)) snapshotFailure(path, 'Snapshot contains a cycle')

  active.add(value)
  try {
    if (Array.isArray(value)) {
      const keys = Reflect.ownKeys(value)
      if (keys.some((key) => typeof key === 'symbol')) {
        snapshotFailure(path, 'Snapshot contains a symbol-keyed array entry')
      }
      if (keys.length !== value.length + 1 || !keys.includes('length')) {
        snapshotFailure(path, 'Snapshot contains a sparse or extended array')
      }
      const clone: SnapshotJsonValue[] = []
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
          snapshotFailure(`${path}[${index}]`, 'Snapshot array entry is missing or unsafe')
        }
        clone.push(cloneSnapshotJson(descriptor.value, `${path}[${index}]`, active))
      }
      return clone
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      snapshotFailure(path, 'Snapshot contains a non-plain object')
    }
    const clone: Record<string, SnapshotJsonValue> = {}
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === 'symbol') snapshotFailure(path, 'Snapshot contains a symbol key')
      if (RESERVED_OBJECT_KEYS.has(key)) {
        snapshotFailure(`${path}.${key}`, 'Snapshot contains a prototype-sensitive key')
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        snapshotFailure(`${path}.${key}`, 'Snapshot property is non-enumerable or an accessor')
      }
      Object.defineProperty(clone, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: cloneSnapshotJson(descriptor.value, `${path}.${key}`, active),
      })
    }
    return clone
  } finally {
    active.delete(value)
  }
}

function canonicalSnapshotJson(value: SnapshotJsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalSnapshotJson(entry)).join(',')}]`
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalSnapshotJson(value[key]!)}`)
    .join(',')}}`
}

function exactDataRecord(
  value: unknown,
  expectedKeys: readonly string[],
  message: string,
): Readonly<Record<string, unknown>> {
  if (!plainRecord(value)) throw new Error(message)
  const keys = Reflect.ownKeys(value)
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
  ) {
    throw new Error(message)
  }
  const result: Record<string, unknown> = {}
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      throw new Error(message)
    }
    result[key] = descriptor.value
  }
  return result
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

type ParentMigrationStorageOptions = Readonly<{ storage?: CredentialStorage }>

function storageFrom(options?: ParentMigrationStorageOptions): CredentialStorage {
  if (options?.storage) return options.storage
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Fall through to the fail-closed error.
  }
  throw new Error('Device-local Parent migration journal storage is unavailable.')
}

function timestamp(options?: LegacyParentCredentialMigrationOptions): string {
  const value = (options?.now ?? (() => new Date()))().toISOString()
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error('Parent credential migration clock returned an invalid timestamp.')
  }
  return value
}

function bindingMatches(
  left: ParentCredentialBindingReference,
  right: ParentCredentialBindingReference,
): boolean {
  return left.installationId === right.installationId && left.householdId === right.householdId
}

async function sha256Commitment(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('Web Crypto is required for Parent migration commitments.')
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToBase64(new Uint8Array(digest))
}

function validCommitment(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    base64ToBytes(value, 32)
    return true
  } catch {
    return false
  }
}

function validRevision(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 1_024
}

function createMigrationReceipt(
  options: LegacyParentCredentialMigrationOptions,
): string {
  const provider = options.crypto ?? globalThis.crypto
  if (!provider || typeof provider.getRandomValues !== 'function') {
    throw new Error('Web Crypto is required for Parent migration receipts.')
  }
  return bytesToBase64(
    provider.getRandomValues(new Uint8Array(LEARNER_PIN_DERIVED_KEY_BYTES)),
  )
}

function parseJournalProfileIds(value: unknown): readonly ProfileId[] {
  if (!Array.isArray(value)) {
    throw new Error('Parent credential migration journal is malformed.')
  }
  const keys = Reflect.ownKeys(value)
  if (
    keys.length !== value.length + 1 ||
    !keys.includes('length') ||
    keys.some((key) => typeof key === 'symbol')
  ) {
    throw new Error('Parent credential migration journal is malformed.')
  }
  const profileIds: ProfileId[] = []
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    const profileId = descriptor && descriptor.enumerable && 'value' in descriptor
      ? parseProfileId(descriptor.value)
      : null
    if (profileId === null) {
      throw new Error('Parent credential migration journal is malformed.')
    }
    profileIds.push(profileId)
  }
  const canonical = [...new Set(profileIds)].sort()
  if (canonical.length !== profileIds.length || canonical.some((id, index) => id !== profileIds[index])) {
    throw new Error('Parent credential migration journal is malformed.')
  }
  return Object.freeze(profileIds)
}

function canonicalProfileIds(value: unknown): ProfileId[] {
  if (!plainRecord(value) || !Object.hasOwn(value, 'profiles')) return []
  const profiles = value.profiles
  if (!plainRecord(profiles)) throw new Error('Educational profiles must be a canonical object.')
  return Object.keys(profiles)
    .map((key) => {
      const profileId = parseProfileId(key)
      if (profileId === null) throw new Error(`Educational profile ${key} is not canonical.`)
      return profileId
    })
    .sort()
}

function legacyLearnerPinMode(value: unknown): 'all' | 'none' {
  if (!plainRecord(value) || !Object.hasOwn(value, 'profiles')) return 'none'
  if (!plainRecord(value.profiles)) throw new Error('Educational profiles must be a canonical object.')
  const presence = Object.entries(value.profiles).map(([profileId, profile]) => {
    if (!plainRecord(profile) || profile.id !== profileId) {
      throw new Error(`Educational profile ${profileId} is malformed.`)
    }
    return Object.hasOwn(profile, 'pin')
  })
  if (presence.some(Boolean) && !presence.every(Boolean)) {
    throw new Error('Legacy learner PIN fields are only partially present; coordinated migration cannot continue.')
  }
  return presence.some(Boolean) ? 'all' : 'none'
}

function isSnapshotSafeLegacyCredentialValue(
  value: unknown,
): value is null | boolean | number | string {
  return value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
}

function assertSnapshotSafeLegacyCredentialValues(value: unknown): void {
  if (!plainRecord(value)) return
  const parentDescriptor = Object.getOwnPropertyDescriptor(value, 'parentPin')
  if (
    parentDescriptor !== undefined &&
    (!('value' in parentDescriptor) ||
      !isSnapshotSafeLegacyCredentialValue(parentDescriptor.value))
  ) {
    throw new CredentialSanitizationError(
      '$.parentPin',
      'Legacy credential values must be finite JSON primitives',
    )
  }
  const profilesDescriptor = Object.getOwnPropertyDescriptor(value, 'profiles')
  if (!profilesDescriptor || !('value' in profilesDescriptor) || !plainRecord(profilesDescriptor.value)) {
    return
  }
  for (const [profileId, profile] of Object.entries(profilesDescriptor.value)) {
    if (!plainRecord(profile)) continue
    const pinDescriptor = Object.getOwnPropertyDescriptor(profile, 'pin')
    if (
      pinDescriptor !== undefined &&
      (!('value' in pinDescriptor) || !isSnapshotSafeLegacyCredentialValue(pinDescriptor.value))
    ) {
      throw new CredentialSanitizationError(
        `$.profiles.${profileId}.pin`,
        'Legacy credential values must be finite JSON primitives',
      )
    }
  }
}

async function educationalDataCommitment(
  educationalData: CredentialFreeJsonValue,
): Promise<string> {
  return sha256Commitment(canonicalCredentialFreeJson(educationalData))
}

async function snapshotCommitment(value: SnapshotJsonValue): Promise<string> {
  return sha256Commitment(canonicalSnapshotJson(value))
}

async function sourceStructureCommitment(value: SnapshotJsonValue): Promise<string> {
  const record = value as Readonly<Record<string, SnapshotJsonValue>>
  const parentDescriptor = Object.getOwnPropertyDescriptor(record, 'parentPin')
  const profilesDescriptor = Object.getOwnPropertyDescriptor(record, 'profiles')
  const learners: SnapshotJsonValue[] = []
  if (profilesDescriptor && 'value' in profilesDescriptor && plainRecord(profilesDescriptor.value)) {
    for (const profileId of Object.keys(profilesDescriptor.value).sort()) {
      const profile = profilesDescriptor.value[profileId]
      if (!plainRecord(profile)) continue
      const pin = Object.getOwnPropertyDescriptor(profile, 'pin')
      learners.push({
        profileId,
        present: pin !== undefined,
        classification: pin && 'value' in pin ? classifyLegacyPin(pin.value) : 'absent',
      })
    }
  }
  return snapshotCommitment({
    parent: parentDescriptor && 'value' in parentDescriptor
      ? { present: true, classification: classifyLegacyParentPin(true, parentDescriptor.value) }
      : { present: false, classification: 'parent-setup-required' },
    learners,
    educationalData: sanitizeCredentialFreeEducationalData(value),
  })
}

async function parentRecordCommitment(
  record: StoredParentCredentialRecord | null,
  options?: Pick<ParentCredentialOperationOptions, 'crypto'>,
): Promise<string> {
  return record === null
    ? snapshotCommitment(null)
    : parentCredentialRecordCommitment(record, options)
}

async function learnerSetCommitment(
  prepared: LegacyCredentialMigrationResult,
  options?: LegacyParentCredentialMigrationOptions,
): Promise<string> {
  const entries: SnapshotJsonValue[] = []
  for (const outcome of [...prepared.outcomes].sort((left, right) =>
    left.profileId.localeCompare(right.profileId)
  )) {
    entries.push({
      profileId: outcome.profileId,
      classification: outcome.classification,
      credentialState: outcome.credentialState,
      credential: cloneSnapshotJson(readLearnerCredential(outcome.profileId, options)),
    })
  }
  return snapshotCommitment(entries)
}

function learnerMigrationOptions(
  options?: LegacyParentCredentialMigrationOptions,
): LegacyCredentialMigrationOptions {
  return {
    ...(options?.storage === undefined ? {} : { storage: options.storage }),
    ...(options?.crypto === undefined ? {} : { crypto: options.crypto }),
    ...(options?.now === undefined ? {} : { now: options.now }),
  }
}

function journalStorageKey(reference: ParentCredentialBindingReference): string {
  return `${LEGACY_PARENT_CREDENTIAL_MIGRATION_NAMESPACE}:${encodeURIComponent(reference.installationId)}:${encodeURIComponent(reference.householdId)}`
}

function parseJournalBinding(value: unknown): ParentCredentialBindingReference {
  const record = exactDataRecord(
    value,
    ['schemaVersion', 'installationId', 'householdId'],
    'Parent credential migration journal is malformed.',
  )
  if (
    record.schemaVersion !== 1 ||
    typeof record.installationId !== 'string' ||
    typeof record.householdId !== 'string'
  ) {
    throw new Error('Parent credential migration journal is malformed.')
  }
  return Object.freeze({
    schemaVersion: 1,
    installationId: record.installationId,
    householdId: record.householdId,
  }) as ParentCredentialBindingReference
}

function parseMigrationRecord(
  value: unknown,
  expectedBinding: ParentCredentialBindingReference,
): LegacyParentCredentialMigrationRecord {
  const record = exactDataRecord(
    value,
    JOURNAL_KEYS,
    'Parent credential migration journal is malformed.',
  )
  const binding = parseJournalBinding(record.binding)
  const learnerProfileIds = parseJournalProfileIds(record.learnerProfileIds)
  const educationalProfileIds = parseJournalProfileIds(record.educationalProfileIds)
  const updatedAt = typeof record.updatedAt === 'string' ? Date.parse(record.updatedAt) : NaN
  if (
    record.schemaVersion !== LEGACY_PARENT_CREDENTIAL_MIGRATION_SCHEMA_VERSION ||
    record.storage !== 'device-local-migration-journal' ||
    !bindingMatches(binding, expectedBinding) ||
    (record.classification !== 'migratable' &&
      record.classification !== 'parent-setup-required' &&
      record.classification !== 'reset-required') ||
    !STAGES.includes(record.stage as LegacyParentMigrationStage) ||
    !Number.isSafeInteger(record.attempt) ||
    (record.attempt as number) < 1 ||
    !validCommitment(record.sourceStructureCommitmentBase64) ||
    !validCommitment(record.educationalDataCommitmentBase64) ||
    !validCommitment(record.preparedParentCommitmentBase64) ||
    (record.promotedParentCommitmentBase64 !== null &&
      !validCommitment(record.promotedParentCommitmentBase64)) ||
    !validCommitment(record.learnerMigrationCommitmentBase64) ||
    learnerProfileIds.some((profileId) => !educationalProfileIds.includes(profileId)) ||
    (record.preparedGeneration !== null &&
      (!Number.isSafeInteger(record.preparedGeneration) || (record.preparedGeneration as number) < 1)) ||
    (record.promotedGeneration !== null &&
      (!Number.isSafeInteger(record.promotedGeneration) || (record.promotedGeneration as number) < 1)) ||
    !validRevision(record.sourceRevision) ||
    !validCommitment(record.migrationReceiptBase64) ||
    (record.completionSealBase64 !== null && !validCommitment(record.completionSealBase64)) ||
    !Number.isFinite(updatedAt) ||
    new Date(updatedAt).toISOString() !== record.updatedAt ||
    (record.classification === 'parent-setup-required') !== (record.preparedGeneration === null) ||
    (record.classification === 'parent-setup-required' &&
      record.preparedParentCommitmentBase64 !== NULL_PARENT_RECORD_COMMITMENT_BASE64) ||
    (record.classification === 'parent-setup-required'
      ? record.promotedGeneration !== null
      : (record.stage === 'prepared' || record.stage === 'educational-committed'
          ? record.promotedGeneration !== null
          : record.promotedGeneration === null ||
            record.promotedGeneration !== (record.preparedGeneration as number) + 1)) ||
    (record.stage === 'prepared' || record.stage === 'educational-committed'
      ? record.promotedParentCommitmentBase64 !== null
      : record.promotedParentCommitmentBase64 === null) ||
    (record.classification === 'parent-setup-required' &&
      (record.stage === 'credential-promoted' || record.stage === 'completed') &&
      record.promotedParentCommitmentBase64 !== NULL_PARENT_RECORD_COMMITMENT_BASE64) ||
    (record.stage === 'completed'
      ? record.completionSealBase64 === null
      : record.completionSealBase64 !== null)
  ) {
    throw new Error('Parent credential migration journal is malformed.')
  }
  return Object.freeze({
    ...record,
    binding,
    learnerProfileIds,
    educationalProfileIds,
  }) as unknown as LegacyParentCredentialMigrationRecord
}

export function readLegacyParentCredentialMigrationRecord(
  binding: InstallationBinding,
  options?: ParentMigrationStorageOptions,
): LegacyParentCredentialMigrationRecord | null {
  const reference = parentCredentialBindingReference(binding)
  const raw = storageFrom(options).getItem(journalStorageKey(reference))
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    throw new Error('Parent credential migration journal is malformed.')
  }
  return parseMigrationRecord(parsed, reference)
}

interface PreparedJournalInvariants {
  readonly classification: LegacyParentPinClassification
  readonly sourceStructureCommitmentBase64: string
  readonly educationalDataCommitmentBase64: string
  readonly preparedParentCommitmentBase64: string
  readonly learnerMigrationCommitmentBase64: string
  readonly learnerProfileIds: readonly ProfileId[]
  readonly educationalProfileIds: readonly ProfileId[]
  readonly preparedGeneration: number | null
  readonly sourceRevision: string
  readonly migrationReceiptBase64: string
}

function journalCompletionPayload(
  record: LegacyParentCredentialMigrationRecord,
): SnapshotJsonValue {
  return cloneSnapshotJson({ ...record, completionSealBase64: null })
}

function journalPreparedPayload(
  record: LegacyParentCredentialMigrationRecord,
): SnapshotJsonValue {
  return cloneSnapshotJson({
    schemaVersion: record.schemaVersion,
    storage: record.storage,
    binding: record.binding,
    classification: record.classification,
    attempt: record.attempt,
    sourceStructureCommitmentBase64: record.sourceStructureCommitmentBase64,
    educationalDataCommitmentBase64: record.educationalDataCommitmentBase64,
    preparedParentCommitmentBase64: record.preparedParentCommitmentBase64,
    learnerMigrationCommitmentBase64: record.learnerMigrationCommitmentBase64,
    learnerProfileIds: record.learnerProfileIds,
    educationalProfileIds: record.educationalProfileIds,
    preparedGeneration: record.preparedGeneration,
    sourceRevision: record.sourceRevision,
    migrationReceiptBase64: record.migrationReceiptBase64,
  })
}

function journalPreparedCommitment(
  record: LegacyParentCredentialMigrationRecord,
): Promise<string> {
  return snapshotCommitment(journalPreparedPayload(record))
}

async function assertCompletionSeal(record: LegacyParentCredentialMigrationRecord): Promise<void> {
  if (
    record.stage !== 'completed' ||
    record.completionSealBase64 !== await snapshotCommitment(journalCompletionPayload(record))
  ) {
    throw new Error('Completed Parent migration journal commitment invariants failed.')
  }
}

async function persistJournalRecord(
  binding: InstallationBinding,
  record: LegacyParentCredentialMigrationRecord,
  options?: LegacyParentCredentialMigrationOptions,
): Promise<LegacyParentCredentialMigrationRecord> {
  const reference = parentCredentialBindingReference(binding)
  const completed = record.stage === 'completed'
    ? {
        ...record,
        completionSealBase64: await snapshotCommitment(journalCompletionPayload(record)),
      }
    : record
  const storage = storageFrom(options)
  const key = journalStorageKey(reference)
  const serialized = JSON.stringify(completed)
  storage.setItem(key, serialized)
  const readBack = storage.getItem(key)
  if (readBack !== serialized) {
    throw new Error('Parent credential migration journal failed durable read-back verification.')
  }
  const persisted = parseMigrationRecord(JSON.parse(readBack) as unknown, reference)
  if (persisted.stage === 'completed') await assertCompletionSeal(persisted)
  await options?.afterStage?.(persisted.stage)
  return persisted
}

function journalMatchesPreparedInvariants(
  record: LegacyParentCredentialMigrationRecord,
  invariants: PreparedJournalInvariants,
): boolean {
  return record.classification === invariants.classification &&
    record.sourceStructureCommitmentBase64 === invariants.sourceStructureCommitmentBase64 &&
    record.educationalDataCommitmentBase64 === invariants.educationalDataCommitmentBase64 &&
    record.preparedParentCommitmentBase64 === invariants.preparedParentCommitmentBase64 &&
    record.learnerMigrationCommitmentBase64 === invariants.learnerMigrationCommitmentBase64 &&
    record.learnerProfileIds.length === invariants.learnerProfileIds.length &&
    record.learnerProfileIds.every((id, index) => id === invariants.learnerProfileIds[index]) &&
    record.educationalProfileIds.length === invariants.educationalProfileIds.length &&
    record.educationalProfileIds.every(
      (id, index) => id === invariants.educationalProfileIds[index],
    ) &&
    record.preparedGeneration === invariants.preparedGeneration &&
    record.sourceRevision === invariants.sourceRevision &&
    record.migrationReceiptBase64 === invariants.migrationReceiptBase64
}

async function ensurePreparedJournal(
  binding: InstallationBinding,
  invariants: PreparedJournalInvariants,
  options?: LegacyParentCredentialMigrationOptions,
): Promise<LegacyParentCredentialMigrationRecord> {
  const existing = readLegacyParentCredentialMigrationRecord(binding, options)
  if (!existing) {
    return persistJournalRecord(binding, {
      schemaVersion: LEGACY_PARENT_CREDENTIAL_MIGRATION_SCHEMA_VERSION,
      storage: 'device-local-migration-journal',
      binding: parentCredentialBindingReference(binding),
      stage: 'prepared',
      attempt: 1,
      ...invariants,
      promotedParentCommitmentBase64: null,
      promotedGeneration: null,
      completionSealBase64: null,
      updatedAt: timestamp(options),
    }, options)
  }
  if (journalMatchesPreparedInvariants(existing, invariants)) return existing
  if (existing.stage !== 'prepared') {
    throw new Error('Prepared Parent migration journal commitments changed unexpectedly.')
  }
  // A durable CAS conflict may change any authoritative legacy credential
  // input. Because the prior attempt never installed its random receipt, its
  // inactive preparation can be superseded from the new authoritative state.
  return persistJournalRecord(binding, {
    schemaVersion: LEGACY_PARENT_CREDENTIAL_MIGRATION_SCHEMA_VERSION,
    storage: 'device-local-migration-journal',
    binding: parentCredentialBindingReference(binding),
    stage: 'prepared',
    attempt: existing.attempt + 1,
    ...invariants,
    promotedParentCommitmentBase64: null,
    promotedGeneration: null,
    completionSealBase64: null,
    updatedAt: timestamp(options),
  }, options)
}

const PRIOR_STAGE: Readonly<Record<Exclude<LegacyParentMigrationStage, 'prepared'>, LegacyParentMigrationStage>> = {
  'educational-committed': 'prepared',
  'credential-promoted': 'educational-committed',
  completed: 'credential-promoted',
}

async function advanceMigrationStage(
  binding: InstallationBinding,
  current: LegacyParentCredentialMigrationRecord,
  stage: Exclude<LegacyParentMigrationStage, 'prepared'>,
  promotedParentCommitmentBase64: string | null,
  promotedGeneration: number | null,
  options?: LegacyParentCredentialMigrationOptions,
): Promise<LegacyParentCredentialMigrationRecord> {
  const existing = readLegacyParentCredentialMigrationRecord(binding, options)
  if (!existing || JSON.stringify(existing) !== JSON.stringify(current)) {
    throw new Error('Parent migration journal changed before its next exact stage transition.')
  }
  if (existing.stage === stage) {
    if (
      existing.promotedParentCommitmentBase64 !== promotedParentCommitmentBase64 ||
      existing.promotedGeneration !== promotedGeneration ||
      (stage === 'completed' && existing.completionSealBase64 === null)
    ) {
      throw new Error('Parent migration journal stage commitments do not agree.')
    }
    if (stage === 'completed') await assertCompletionSeal(existing)
    return existing
  }
  if (existing.stage !== PRIOR_STAGE[stage]) {
    throw new Error(`Parent migration journal cannot transition from ${existing.stage} to ${stage}.`)
  }
  if (
    (stage === 'educational-committed' && promotedParentCommitmentBase64 !== null) ||
    (stage === 'educational-committed' && promotedGeneration !== null) ||
    (stage !== 'educational-committed' &&
      current.classification !== 'parent-setup-required' &&
      (promotedParentCommitmentBase64 === null || promotedGeneration === null)) ||
    (stage !== 'educational-committed' &&
      current.classification === 'parent-setup-required' &&
      (promotedParentCommitmentBase64 === null || promotedGeneration !== null))
  ) {
    throw new Error('Parent migration journal is missing an exact promotion commitment.')
  }
  return persistJournalRecord(binding, {
    ...existing,
    stage,
    promotedParentCommitmentBase64,
    promotedGeneration,
    completionSealBase64: null,
    updatedAt: timestamp(options),
  }, options)
}

interface ExactLegacyParentPin {
  readonly present: boolean
  readonly value: unknown
  readonly classification: LegacyParentPinClassification
}

export function classifyLegacyParentPin(
  present: boolean,
  value: unknown,
): LegacyParentPinClassification {
  if (!present || value === '') return 'parent-setup-required'
  return isFourDigitPin(value) ? 'migratable' : 'reset-required'
}

function exactLegacyParentPin(value: unknown): ExactLegacyParentPin {
  if (!plainRecord(value)) throw new Error('Legacy Parent educational data must be a plain object.')
  const descriptor = Object.getOwnPropertyDescriptor(value, 'parentPin')
  if (descriptor === undefined) {
    return { present: false, value: undefined, classification: 'parent-setup-required' }
  }
  if (!descriptor.enumerable || !('value' in descriptor)) {
    throw new Error('Legacy root parentPin must be an enumerable data property.')
  }
  return {
    present: true,
    value: descriptor.value,
    classification: classifyLegacyParentPin(true, descriptor.value),
  }
}

async function prepareParentCredential(
  legacy: ExactLegacyParentPin,
  binding: InstallationBinding,
  options: LegacyParentCredentialMigrationOptions,
  supersessionAuthorization?: ParentMigrationPreparationSupersessionAuthorization,
): Promise<StoredParentCredentialRecord | null> {
  const existing = await readParentCredentialRecord(binding, options)
  if (legacy.classification === 'parent-setup-required') {
    if (existing !== null) {
      throw new Error('A Parent credential exists without qualifying authoritative legacy state.')
    }
    return null
  }
  if (legacy.classification === 'reset-required') {
    if (existing?.state === 'enrolled') {
      throw new Error('Malformed legacy Parent PIN cannot replace an enrolled Parent credential.')
    }
    return markParentCredentialResetRequiredForMigration(binding, options)
  }
  if (!legacy.present || !isFourDigitPin(legacy.value)) {
    throw new Error('Migratable Parent state is missing its exact legacy PIN.')
  }
  const prepared = await prepareLegacyParentPinForMigration(
    binding,
    legacy.value,
    options,
    supersessionAuthorization,
  )
  if (
    prepared.state !== 'prepared' ||
    !(await verifyPreparedParentCredentialForMigration(prepared, binding, legacy.value, options))
  ) {
    throw new Error('Prepared Parent verifier failed exact migration verification.')
  }
  return prepared
}

async function assertJournalParentRecord(
  journal: LegacyParentCredentialMigrationRecord,
  binding: InstallationBinding,
  options: LegacyParentCredentialMigrationOptions,
): Promise<StoredParentCredentialRecord | null> {
  const snapshot = await readParentCredentialSnapshot(binding, options)
  const record = snapshot?.record ?? null
  if (journal.classification === 'parent-setup-required') {
    if (record !== null || journal.preparedGeneration !== null || journal.promotedGeneration !== null) {
      throw new Error('Parent setup journal unexpectedly has credential authority.')
    }
    return null
  }
  const expectedGeneration = journal.stage === 'prepared' || journal.stage === 'educational-committed'
    ? journal.preparedGeneration
    : journal.promotedGeneration
  if (!record) {
    throw new Error('Parent migration journal generation does not match the current credential.')
  }
  let commitment = await parentRecordCommitment(record, options)
  const expected = journal.stage === 'prepared' || journal.stage === 'educational-committed'
    ? journal.preparedParentCommitmentBase64
    : journal.promotedParentCommitmentBase64
  if (
    journal.stage === 'educational-committed' &&
    journal.preparedGeneration !== null &&
    record.generation === journal.preparedGeneration + 1 &&
    snapshot?.authority.activeGeneration === null &&
    ((journal.classification === 'migratable' && record.state === 'enrolled') ||
      (journal.classification === 'reset-required' && record.state === 'reset-required'))
  ) {
    const { rotatedAt: _rotatedAt, ...recordWithoutRotation } = record
    const reconstructedPrepared = parseParentCredentialRecord({
      ...recordWithoutRotation,
      state: 'prepared',
      generation: journal.preparedGeneration,
    }, binding)
    commitment = await parentRecordCommitment(reconstructedPrepared, options)
    if (commitment === journal.preparedParentCommitmentBase64) return record
  }
  if (record.generation !== expectedGeneration) {
    throw new Error('Parent migration journal generation does not match the current credential.')
  }
  if (commitment !== expected) {
    throw new Error('Parent migration journal credential commitment does not match current storage.')
  }
  if (
    (journal.classification === 'reset-required' &&
      (journal.stage === 'prepared' || journal.stage === 'educational-committed') &&
      record.state !== 'prepared') ||
    (journal.classification === 'reset-required' &&
      (journal.stage === 'credential-promoted' || journal.stage === 'completed') &&
      record.state !== 'reset-required') ||
    (journal.classification === 'migratable' &&
      (journal.stage === 'prepared' || journal.stage === 'educational-committed') &&
      record.state !== 'prepared') ||
    (journal.classification === 'migratable' &&
      (journal.stage === 'credential-promoted' || journal.stage === 'completed') &&
      record.state !== 'enrolled')
  ) {
    throw new Error('Parent migration journal stage and credential state do not agree.')
  }
  return record
}

async function finishCompletedMigration(
  journal: LegacyParentCredentialMigrationRecord,
  binding: InstallationBinding,
  durableSnapshot: DurableParentMigrationSnapshot & {
    readonly educationalData: SnapshotJsonValue
  },
  options: LegacyParentCredentialMigrationOptions,
  resumed = true,
): Promise<LegacyParentCredentialMigrationResult> {
  await assertCompletionSeal(journal)
  const completionCommitment = journal.completionSealBase64
  if (completionCommitment === null) {
    throw new Error('Completed Parent migration is missing its completion anchor.')
  }
  const preparedTransactionCommitment = await journalPreparedCommitment(journal)
  if (
    durableSnapshot.migrationReceiptBase64 !== journal.migrationReceiptBase64 ||
    durableSnapshot.migrationPreparationCommitmentBase64 !==
      preparedTransactionCommitment ||
    durableSnapshot.migrationCompletionCommitmentBase64 !== null &&
    durableSnapshot.migrationCompletionCommitmentBase64 !== completionCommitment
  ) {
    throw new Error('Completed Parent migration conflicts with its durable completion anchor.')
  }

  const educationalData = sanitizeCredentialFreeEducationalData(
    durableSnapshot.educationalData,
  )
  if (!isExactCredentialFreeSnapshot(durableSnapshot.educationalData, educationalData)) {
    throw new Error('Completed Parent migration found credential fields in durable educational data.')
  }
  assertEducationalProfileSet(
    durableSnapshot.educationalData,
    journal.educationalProfileIds,
  )

  let snapshot = await readParentCredentialSnapshot(binding, options)
  if (journal.classification === 'parent-setup-required') {
    if (snapshot && snapshot.record.generation <= (journal.promotedGeneration ?? 0)) {
      throw new Error('Completed Parent setup journal conflicts with current credential authority.')
    }
  } else {
    if (!snapshot || journal.promotedGeneration === null) {
      throw new Error('Completed Parent migration is missing its promoted generation.')
    }
    if (snapshot.record.generation < journal.promotedGeneration) {
      throw new Error('Completed Parent migration detected a credential generation rollback.')
    }
    if (snapshot.record.generation === journal.promotedGeneration) {
      if (
        await parentRecordCommitment(snapshot.record, options) !== journal.promotedParentCommitmentBase64 ||
        (journal.classification === 'migratable' && snapshot.record.state !== 'enrolled') ||
        (journal.classification === 'reset-required' && snapshot.record.state !== 'reset-required')
      ) {
        throw new Error('Completed Parent migration credential commitment changed.')
      }
    }
  }

  const authority = await readParentCredentialGeneration(binding, options)
  if (
    authority.migrationCommitmentBase64 !== null &&
    authority.migrationCommitmentBase64 !== completionCommitment
  ) {
    throw new Error('Completed Parent migration conflicts with external credential authority.')
  }

  const exactGeneration = journal.promotedGeneration !== null &&
    snapshot?.record.generation === journal.promotedGeneration
  const needsActivation = journal.classification === 'migratable' &&
    exactGeneration &&
    snapshot?.authority.activeGeneration === null
  const needsCompletionCommit =
    durableSnapshot.migrationCompletionCommitmentBase64 === null ||
    authority.migrationCommitmentBase64 === null ||
    needsActivation

  if (needsCompletionCommit) {
    if (
      await educationalDataCommitment(educationalData) !==
        journal.educationalDataCommitmentBase64 ||
      durableSnapshot.migrationReceiptBase64 !== journal.migrationReceiptBase64 ||
      durableSnapshot.migrationPreparationCommitmentBase64 !==
        preparedTransactionCommitment
    ) {
      throw new Error(
        'Completed Parent migration cannot commit against changed educational data.',
      )
    }
    await options.educationalDataPersistence.withMigrationCommitLock(
      durableSnapshot,
      completionCommitment,
      async (rawLockedSnapshot, commitCompletion) => {
        const locked = parseDurableMigrationSnapshot(rawLockedSnapshot)
        if (
          !durableSnapshotsEqual(locked, durableSnapshot) ||
          !isExactCredentialFreeSnapshot(locked.educationalData, educationalData) ||
          locked.migrationReceiptBase64 !== journal.migrationReceiptBase64 ||
          locked.migrationPreparationCommitmentBase64 !==
            preparedTransactionCommitment ||
          (locked.migrationCompletionCommitmentBase64 !== null &&
            locked.migrationCompletionCommitmentBase64 !== completionCommitment)
        ) {
          throw new Error(
            'Durable Parent migration lock did not preserve its exact completion proof.',
          )
        }
        const learners = resumePreparedLearners(
          locked.educationalData,
          educationalData,
          options,
          journal.learnerProfileIds,
          true,
        )
        assertEducationalProfileSet(
          locked.educationalData,
          journal.educationalProfileIds,
        )
        if (
          await learnerSetCommitment(learners, options) !==
          journal.learnerMigrationCommitmentBase64
        ) {
          throw new Error(
            'Completed Parent migration cannot commit against changed learner credentials.',
          )
        }
        await assertJournalParentRecord(journal, binding, options)
        const anchored = parseDurableMigrationSnapshot(await commitCompletion())
        if (
          !isExactCredentialFreeSnapshot(anchored.educationalData, educationalData) ||
          anchored.migrationReceiptBase64 !== journal.migrationReceiptBase64 ||
          anchored.migrationPreparationCommitmentBase64 !==
            preparedTransactionCommitment ||
          anchored.migrationCompletionCommitmentBase64 !== completionCommitment ||
          (locked.migrationCompletionCommitmentBase64 === null &&
            anchored.revision === locked.revision)
        ) {
          throw new Error('Durable Parent migration completion anchor failed exact read-back.')
        }
        const anchoredLearners = resumePreparedLearners(
          anchored.educationalData,
          educationalData,
          options,
          journal.learnerProfileIds,
          true,
        )
        if (
          await learnerSetCommitment(anchoredLearners, options) !==
          journal.learnerMigrationCommitmentBase64
        ) {
          throw new Error(
            'Learner credentials changed while Parent completion was being anchored.',
          )
        }
        await commitParentMigrationAuthority(
          binding,
          journal.classification === 'parent-setup-required'
            ? 'missing'
            : journal.classification === 'migratable'
              ? 'enrolled'
              : 'reset-required',
          journal.promotedGeneration,
          journal.promotedParentCommitmentBase64 ?? NULL_PARENT_RECORD_COMMITMENT_BASE64,
          completionCommitment,
          options,
        )
      },
    )
    snapshot = await readParentCredentialSnapshot(binding, options)
  }

  const finalDurable = await readAuthoritativeSnapshot(
    options.educationalDataPersistence,
  )
  const finalAuthority = await readParentCredentialGeneration(binding, options)
  if (
    finalDurable.migrationReceiptBase64 !== journal.migrationReceiptBase64 ||
    finalDurable.migrationCompletionCommitmentBase64 !== completionCommitment ||
    finalDurable.migrationPreparationCommitmentBase64 !==
      preparedTransactionCommitment ||
    finalAuthority.migrationCommitmentBase64 !== completionCommitment ||
    (journal.classification === 'migratable' &&
      exactGeneration &&
      snapshot?.authority.activeGeneration !== journal.promotedGeneration)
  ) {
    throw new Error('Completed Parent migration failed exact anchored post-completion verification.')
  }
  const credentialState: LegacyParentCredentialMigrationOutcome['credentialState'] =
    snapshot?.record.state === 'enrolled' || snapshot?.record.state === 'reset-required'
      ? snapshot.record.state
      : 'parent-setup-required'
  return {
    educationalData,
    outcome: {
      classification: journal.classification,
      credentialState,
      resumed,
    },
  }
}

function learnerStageVerified(stage: string): boolean {
  return stage === 'verifier-verified' ||
    stage === 'educational-data-sanitized' ||
    stage === 'complete'
}

function assertEducationalProfileSet(
  value: unknown,
  expectedProfileIds: readonly ProfileId[],
): void {
  const currentProfileIds = canonicalProfileIds(value)
  if (
    currentProfileIds.length !== expectedProfileIds.length ||
    currentProfileIds.some((profileId, index) => profileId !== expectedProfileIds[index])
  ) {
    throw new Error('Parent migration educational profile set changed unexpectedly.')
  }
}

function resumePreparedLearners(
  value: unknown,
  educationalData: CredentialFreeJsonValue,
  options?: LegacyParentCredentialMigrationOptions,
  expectedProfileIds?: readonly ProfileId[],
  requireComplete = false,
): LegacyCredentialMigrationResult {
  const outcomes: LegacyCredentialMigrationOutcome[] = []
  const currentProfileIds = canonicalProfileIds(value)
  const profileIds = expectedProfileIds ?? currentProfileIds
  if (expectedProfileIds?.some((profileId) => !currentProfileIds.includes(profileId))) {
    throw new Error('A learner bound to the Parent migration is missing from educational data.')
  }
  for (const profileId of profileIds) {
    const journal = readLegacyCredentialMigrationRecord(profileId, learnerMigrationOptions(options))
    if (!journal) {
      if (expectedProfileIds) {
        throw new Error(`Learner ${profileId} is missing its migration journal.`)
      }
      continue
    }
    const credential = readLearnerCredential(profileId, options)
    if (requireComplete && journal.stage !== 'complete') {
      throw new Error(`Learner ${profileId} migration is not complete.`)
    }
    if (
      journal.classification === 'migratable' &&
      (!learnerStageVerified(journal.stage) ||
        (credential?.state !== 'enrolled' && credential?.state !== 'reset-required'))
    ) {
      throw new Error(`Learner ${profileId} is missing its verified migration credential.`)
    }
    if (
      journal.classification === 'reset-required' &&
      (!learnerStageVerified(journal.stage) || credential?.state !== 'reset-required')
    ) {
      throw new Error(`Learner ${profileId} is missing its reset-required migration credential.`)
    }
    outcomes.push({
      profileId,
      classification: journal.classification,
      credentialState: credential?.state ?? 'none',
      resumed: true,
    })
  }
  return { educationalData, outcomes }
}

function parseDurableMigrationSnapshot(
  value: unknown,
): DurableParentMigrationSnapshot & { readonly educationalData: SnapshotJsonValue } {
  const record = exactDataRecord(
    value,
    [
      'educationalData',
      'revision',
      'migrationReceiptBase64',
      'migrationPreparationCommitmentBase64',
      'migrationCompletionCommitmentBase64',
    ],
    'Authoritative Parent migration snapshot is malformed.',
  )
  if (
    !validRevision(record.revision) ||
    (record.migrationReceiptBase64 !== null &&
      !validCommitment(record.migrationReceiptBase64)) ||
    (record.migrationPreparationCommitmentBase64 !== null &&
      !validCommitment(record.migrationPreparationCommitmentBase64)) ||
    (record.migrationCompletionCommitmentBase64 !== null &&
      !validCommitment(record.migrationCompletionCommitmentBase64)) ||
    (record.migrationReceiptBase64 === null) !==
      (record.migrationPreparationCommitmentBase64 === null) ||
    (record.migrationCompletionCommitmentBase64 !== null &&
      record.migrationReceiptBase64 === null)
  ) {
    throw new Error('Authoritative Parent migration snapshot is malformed.')
  }
  return Object.freeze({
    educationalData: cloneSnapshotJson(record.educationalData),
    revision: record.revision,
    migrationReceiptBase64: record.migrationReceiptBase64,
    migrationPreparationCommitmentBase64:
      record.migrationPreparationCommitmentBase64,
    migrationCompletionCommitmentBase64:
      record.migrationCompletionCommitmentBase64,
  }) as DurableParentMigrationSnapshot & { readonly educationalData: SnapshotJsonValue }
}

function durableSnapshotsEqual(
  left: DurableParentMigrationSnapshot,
  right: DurableParentMigrationSnapshot,
): boolean {
  return left.revision === right.revision &&
    left.migrationReceiptBase64 === right.migrationReceiptBase64 &&
    left.migrationPreparationCommitmentBase64 ===
      right.migrationPreparationCommitmentBase64 &&
    left.migrationCompletionCommitmentBase64 ===
      right.migrationCompletionCommitmentBase64 &&
    canonicalSnapshotJson(cloneSnapshotJson(left.educationalData)) ===
      canonicalSnapshotJson(cloneSnapshotJson(right.educationalData))
}

async function readAuthoritativeSnapshot(
  persistence: DurableParentMigrationPersistence,
): Promise<DurableParentMigrationSnapshot & { readonly educationalData: SnapshotJsonValue }> {
  return parseDurableMigrationSnapshot(await persistence.read())
}

async function verifyExactEducationalReadBack(
  educationalData: CredentialFreeJsonValue,
  migrationReceiptBase64: string,
  migrationPreparationCommitmentBase64: string,
  persistence: DurableParentMigrationPersistence,
  migrationCompletionCommitmentBase64: string | null = null,
): Promise<DurableParentMigrationSnapshot & { readonly educationalData: SnapshotJsonValue }> {
  const current = await readAuthoritativeSnapshot(persistence)
  if (
    !isExactCredentialFreeSnapshot(current.educationalData, educationalData) ||
    current.migrationReceiptBase64 !== migrationReceiptBase64 ||
    current.migrationPreparationCommitmentBase64 !==
      migrationPreparationCommitmentBase64 ||
    current.migrationCompletionCommitmentBase64 !==
      migrationCompletionCommitmentBase64
  ) {
    throw new Error('Educational migration failed exact durable receipt/read-back verification.')
  }
  return current
}

function isExactCredentialFreeSnapshot(
  snapshot: SnapshotJsonValue,
  educationalData: CredentialFreeJsonValue,
): boolean {
  return canonicalSnapshotJson(snapshot) === canonicalCredentialFreeJson(educationalData)
}

interface PreparedMigrationAttempt {
  readonly sourceSnapshot: DurableParentMigrationSnapshot & {
    readonly educationalData: SnapshotJsonValue
  }
  readonly educationalData: CredentialFreeJsonValue
  readonly preparedLearners: LegacyCredentialMigrationResult
  readonly journal: LegacyParentCredentialMigrationRecord
}

interface CommittedMigrationState {
  readonly authoritativeSnapshot: DurableParentMigrationSnapshot & {
    readonly educationalData: SnapshotJsonValue
  }
  readonly educationalData: CredentialFreeJsonValue
  readonly preparedLearners: LegacyCredentialMigrationResult
}

async function prepareMigrationAttempt(
  sourceSnapshot: DurableParentMigrationSnapshot & {
    readonly educationalData: SnapshotJsonValue
  },
  binding: InstallationBinding,
  options: LegacyParentCredentialMigrationOptions,
  forceNewReceipt = false,
): Promise<PreparedMigrationAttempt> {
  if (
    sourceSnapshot.migrationReceiptBase64 !== null ||
    sourceSnapshot.migrationPreparationCommitmentBase64 !== null ||
    sourceSnapshot.migrationCompletionCommitmentBase64 !== null
  ) {
    throw new Error('A different durable Parent migration transaction already owns this state.')
  }
  const authoritativeData = sourceSnapshot.educationalData
  assertSnapshotSafeLegacyCredentialValues(authoritativeData)
  const educationalData = sanitizeCredentialFreeEducationalData(authoritativeData)
  let legacy = exactLegacyParentPin(authoritativeData)
  const learnerMode = legacyLearnerPinMode(authoritativeData)

  // If an abandoned inactive preparation exists and the durable PIN was
  // removed, resolve to an authorization-gated reset tombstone instead of
  // pretending the installation is pristine.
  const existingParent = await readParentCredentialRecord(binding, options)
  if (
    legacy.classification === 'parent-setup-required' &&
    existingParent?.state === 'prepared'
  ) {
    legacy = { present: true, value: null, classification: 'reset-required' }
  }

  const existingJournal = readLegacyParentCredentialMigrationRecord(binding, options)
  const migrationReceiptBase64 =
    !forceNewReceipt &&
    existingJournal?.stage === 'prepared' &&
    existingJournal.sourceRevision === sourceSnapshot.revision
      ? existingJournal.migrationReceiptBase64
      : createMigrationReceipt(options)
  let supersessionAuthorization:
    | ParentMigrationPreparationSupersessionAuthorization
    | undefined
  if (
    existingParent?.state === 'prepared' &&
    existingJournal?.stage === 'prepared' &&
    existingJournal.preparedGeneration === existingParent.generation &&
    existingJournal.preparedParentCommitmentBase64 ===
      await parentRecordCommitment(existingParent, options) &&
    (forceNewReceipt || existingJournal.sourceRevision !== sourceSnapshot.revision)
  ) {
    const expectedBinding = parentCredentialBindingReference(binding)
    supersessionAuthorization = Object.freeze({
      sourceRevision: sourceSnapshot.revision,
      migrationReceiptBase64,
      consumeParentMigrationPreparationSupersession: async (
        context: ParentMigrationPreparationSupersessionContext,
      ) => {
        if (
          context.operationId !== 'parent-pin:migration-reprepare' ||
          !bindingMatches(context.binding, expectedBinding) ||
          context.preparedGeneration !== existingJournal.preparedGeneration ||
          context.preparedRecordCommitmentBase64 !==
            existingJournal.preparedParentCommitmentBase64 ||
          context.sourceRevision !== sourceSnapshot.revision ||
          context.migrationReceiptBase64 !== migrationReceiptBase64
        ) {
          return false
        }
        const current = await readAuthoritativeSnapshot(
          options.educationalDataPersistence,
        )
        return durableSnapshotsEqual(current, sourceSnapshot) &&
          current.migrationReceiptBase64 === null &&
          current.migrationPreparationCommitmentBase64 === null &&
          current.migrationCompletionCommitmentBase64 === null
      },
    })
  }

  // Validate the complete coordinated learner shape before creating Parent
  // material. The Parent record that follows is still inactive preparation.
  const preparedParent = await prepareParentCredential(
    legacy,
    binding,
    options,
    supersessionAuthorization,
  )
  const preparedLearners = learnerMode === 'all'
    ? await prepareLegacyEducationalCredentials(authoritativeData, learnerMigrationOptions(options))
    : resumePreparedLearners(authoritativeData, educationalData, options)
  if (
    canonicalCredentialFreeJson(preparedLearners.educationalData) !==
    canonicalCredentialFreeJson(educationalData)
  ) {
    throw new Error('Learner and Parent migrations produced different credential-free data.')
  }

  const learnerProfileIds = Object.freeze(
    preparedLearners.outcomes.map((outcome) => outcome.profileId).sort(),
  )
  const journal = await ensurePreparedJournal(binding, {
    classification: legacy.classification,
    sourceStructureCommitmentBase64: await sourceStructureCommitment(authoritativeData),
    educationalDataCommitmentBase64: await educationalDataCommitment(educationalData),
    preparedParentCommitmentBase64: await parentRecordCommitment(preparedParent, options),
    learnerMigrationCommitmentBase64: await learnerSetCommitment(preparedLearners, options),
    learnerProfileIds,
    educationalProfileIds: Object.freeze(canonicalProfileIds(authoritativeData)),
    preparedGeneration: preparedParent?.generation ?? null,
    sourceRevision: sourceSnapshot.revision,
    migrationReceiptBase64,
  }, options)
  if (journal.stage !== 'prepared') {
    throw new Error('Only a prepared Parent migration journal may publish educational data.')
  }
  await assertJournalParentRecord(journal, binding, options)
  if (
    await learnerSetCommitment(preparedLearners, options) !==
    journal.learnerMigrationCommitmentBase64
  ) {
    throw new Error('Prepared learner credential commitment changed before publication.')
  }
  return { sourceSnapshot, educationalData, preparedLearners, journal }
}

const MAX_EDUCATIONAL_CAS_ATTEMPTS = 3

async function publishPreparedMigration(
  initialSourceSnapshot: DurableParentMigrationSnapshot & {
    readonly educationalData: SnapshotJsonValue
  },
  binding: InstallationBinding,
  options: LegacyParentCredentialMigrationOptions,
): Promise<PreparedMigrationAttempt> {
  let sourceSnapshot = initialSourceSnapshot
  let forceNewReceipt = false
  for (let attemptIndex = 0; attemptIndex < MAX_EDUCATIONAL_CAS_ATTEMPTS; attemptIndex += 1) {
    const prepared = await prepareMigrationAttempt(
      sourceSnapshot,
      binding,
      options,
      forceNewReceipt,
    )
    const preparedTransactionCommitment = await journalPreparedCommitment(
      prepared.journal,
    )
    let casResult: boolean | undefined
    let casFailure: unknown
    try {
      casResult = await options.educationalDataPersistence.writeIfUnchanged(
        sourceSnapshot,
        JSON.parse(canonicalCredentialFreeJson(prepared.educationalData)) as CredentialFreeJsonValue,
        prepared.journal.migrationReceiptBase64,
        preparedTransactionCommitment,
      )
    } catch (cause) {
      casFailure = cause
    }

    const current = await readAuthoritativeSnapshot(options.educationalDataPersistence)
    if (
      isExactCredentialFreeSnapshot(current.educationalData, prepared.educationalData) &&
      current.migrationReceiptBase64 === prepared.journal.migrationReceiptBase64 &&
      current.migrationPreparationCommitmentBase64 ===
        preparedTransactionCommitment &&
      current.migrationCompletionCommitmentBase64 === null
    ) {
      await verifyExactEducationalReadBack(
        prepared.educationalData,
        prepared.journal.migrationReceiptBase64,
        preparedTransactionCommitment,
        options.educationalDataPersistence,
      )
      if (current.revision === sourceSnapshot.revision) {
        throw new Error('Educational CAS did not advance its authoritative revision.')
      }
      if (casResult !== true) {
        const detail = casFailure instanceof Error && casFailure.message
          ? `: ${casFailure.message}`
          : ''
        throw new Error(
          `Educational CAS outcome requires a fresh receipt-proven retry${detail}.`,
        )
      }
      return prepared
    }
    if (casResult === true) {
      throw new Error('Educational CAS reported success but exact durable read-back changed.')
    }
    if (durableSnapshotsEqual(current, sourceSnapshot)) {
      const detail = casFailure instanceof Error && casFailure.message
        ? `: ${casFailure.message}`
        : ''
      throw new Error(`Educational CAS failed without an authoritative state change${detail}.`)
    }
    if (
      current.migrationReceiptBase64 !== null ||
      current.migrationPreparationCommitmentBase64 !== null ||
      current.migrationCompletionCommitmentBase64 !== null
    ) {
      throw new Error('Educational CAS conflict is owned by a different migration transaction.')
    }
    const currentEducationalData = sanitizeCredentialFreeEducationalData(
      current.educationalData,
    )
    if (isExactCredentialFreeSnapshot(current.educationalData, currentEducationalData)) {
      throw new Error(
        'Educational CAS conflict removed credential inputs without this migration receipt.',
      )
    }
    if (attemptIndex + 1 >= MAX_EDUCATIONAL_CAS_ATTEMPTS) {
      throw new Error('Educational CAS rebase limit was exceeded.')
    }
    sourceSnapshot = current
    forceNewReceipt = true
  }
  throw new Error('Educational CAS did not reach a durable credential-free state.')
}

async function readAndAssertCommittedMigrationState(
  journal: LegacyParentCredentialMigrationRecord,
  binding: InstallationBinding,
  options: LegacyParentCredentialMigrationOptions,
  requireLearnerCompletion = journal.stage !== 'prepared',
): Promise<CommittedMigrationState> {
  const authoritativeSnapshot = await readAuthoritativeSnapshot(
    options.educationalDataPersistence,
  )
  const educationalData = sanitizeCredentialFreeEducationalData(
    authoritativeSnapshot.educationalData,
  )
  if (!isExactCredentialFreeSnapshot(authoritativeSnapshot.educationalData, educationalData)) {
    throw new Error('Durable educational data still contains credential fields.')
  }
  assertEducationalProfileSet(
    authoritativeSnapshot.educationalData,
    journal.educationalProfileIds,
  )
  if (
    await educationalDataCommitment(educationalData) !==
    journal.educationalDataCommitmentBase64
  ) {
    throw new Error('Durable educational commitment changed during Parent migration.')
  }
  await verifyExactEducationalReadBack(
    educationalData,
    journal.migrationReceiptBase64,
    await journalPreparedCommitment(journal),
    options.educationalDataPersistence,
  )
  await assertJournalParentRecord(journal, binding, options)
  const preparedLearners = resumePreparedLearners(
    authoritativeSnapshot.educationalData,
    educationalData,
    options,
    journal.learnerProfileIds,
    requireLearnerCompletion,
  )
  if (
    await learnerSetCommitment(preparedLearners, options) !==
    journal.learnerMigrationCommitmentBase64
  ) {
    throw new Error('Learner migration commitment changed during Parent migration.')
  }
  return { authoritativeSnapshot, educationalData, preparedLearners }
}

async function resolveOrStageParentPromotion(
  journal: LegacyParentCredentialMigrationRecord,
  binding: InstallationBinding,
  options: LegacyParentCredentialMigrationOptions,
): Promise<StoredParentCredentialRecord | null> {
  const current = await assertJournalParentRecord(journal, binding, options)
  if (journal.classification === 'parent-setup-required') return null
  if (!current || journal.preparedGeneration === null) {
    throw new Error('Parent migration is missing its exact prepared generation.')
  }

  const targetState = journal.classification === 'migratable'
    ? 'enrolled'
    : 'reset-required'
  if (
    current.generation === journal.preparedGeneration + 1 &&
    current.state === targetState
  ) {
    return current
  }
  if (
    current.generation !== journal.preparedGeneration ||
    current.state !== 'prepared'
  ) {
    throw new Error('Parent migration cannot resolve its exact prepared promotion.')
  }

  const promoted = journal.classification === 'migratable'
    ? await stagePreparedParentCredentialForMigration(
        binding,
        journal.preparedGeneration,
        options,
      )
    : await stagePreparedParentResetForMigration(
        binding,
        journal.preparedGeneration,
        options,
      )
  const readBack = await readParentCredentialSnapshot(binding, options)
  if (
    !readBack ||
    readBack.authority.activeGeneration !== null ||
    readBack.serialized !== JSON.stringify(promoted) ||
    promoted.state !== targetState ||
    promoted.generation !== journal.preparedGeneration + 1
  ) {
    throw new Error('Promoted Parent credential failed exact inactive read-back verification.')
  }
  return promoted
}

/**
 * Derives the legacy Parent credential only from the authoritative durable
 * adapter. No credential-bearing caller snapshot is accepted by this API.
 */
export async function migrateLegacyParentCredential(
  binding: InstallationBinding,
  options: LegacyParentCredentialMigrationOptions,
): Promise<LegacyParentCredentialMigrationResult> {
  if (
    !options?.educationalDataPersistence ||
    typeof options.educationalDataPersistence.read !== 'function' ||
    typeof options.educationalDataPersistence.writeIfUnchanged !== 'function' ||
    typeof options.educationalDataPersistence.withMigrationCommitLock !== 'function'
  ) {
    throw new Error('Durable educational-data persistence and read-back are required for Parent migration.')
  }

  return withParentCredentialMutationLock(binding, options, async (lockedBinding) => {
    const authoritativeSnapshot = await readAuthoritativeSnapshot(
      options.educationalDataPersistence,
    )
    const authoritativeData = authoritativeSnapshot.educationalData

    // These descriptor-safe full-shape checks precede every Parent, learner,
    // or journal mutation. Only the persistence adapter chooses the root.
    sanitizeCredentialFreeEducationalData(authoritativeData)
    assertSnapshotSafeLegacyCredentialValues(authoritativeData)
    legacyLearnerPinMode(authoritativeData)

    let journal = readLegacyParentCredentialMigrationRecord(lockedBinding, options)
    const priorCredential = await readParentCredentialRecord(lockedBinding, options)
    const resumed = journal !== null || priorCredential !== null
    const currentEducationalData = sanitizeCredentialFreeEducationalData(authoritativeData)
    const currentIsCredentialFree = isExactCredentialFreeSnapshot(
      authoritativeData,
      currentEducationalData,
    )

    if (journal?.stage === 'completed') {
      if (!currentIsCredentialFree) {
        throw new Error('Completed Parent migration found credential fields in durable educational data.')
      }
      return finishCompletedMigration(
        journal,
        lockedBinding,
        authoritativeSnapshot,
        options,
        true,
      )
    }

    const currentEducationalCommitment = await educationalDataCommitment(currentEducationalData)
    const currentPreparedCommitment = journal === null
      ? null
      : await journalPreparedCommitment(journal)
    if (
      journal &&
      currentIsCredentialFree &&
      authoritativeSnapshot.revision !== journal.sourceRevision &&
      authoritativeSnapshot.migrationReceiptBase64 ===
        journal.migrationReceiptBase64 &&
      authoritativeSnapshot.migrationPreparationCommitmentBase64 ===
        currentPreparedCommitment &&
      authoritativeSnapshot.migrationCompletionCommitmentBase64 === null &&
      currentEducationalCommitment === journal.educationalDataCommitmentBase64
    ) {
      await readAndAssertCommittedMigrationState(journal, lockedBinding, options)
    } else {
      if (journal && journal.stage !== 'prepared') {
        throw new Error('Interrupted Parent migration no longer matches authoritative educational data.')
      }
      const published = await publishPreparedMigration(
        authoritativeSnapshot,
        lockedBinding,
        options,
      )
      journal = published.journal
      await readAndAssertCommittedMigrationState(journal, lockedBinding, options)
    }

    if (!journal) {
      throw new Error('Parent migration did not persist its prepared journal.')
    }

    if (journal.stage === 'prepared') {
      const preparedState = await readAndAssertCommittedMigrationState(
        journal,
        lockedBinding,
        options,
      )
      await finalizePreparedLegacyEducationalCredentials(
        preparedState.preparedLearners,
        learnerMigrationOptions(options),
      )
      await readAndAssertCommittedMigrationState(journal, lockedBinding, options, true)
      journal = await advanceMigrationStage(
        lockedBinding,
        journal,
        'educational-committed',
        null,
        null,
        options,
      )
    }

    if (journal.stage === 'educational-committed') {
      await readAndAssertCommittedMigrationState(journal, lockedBinding, options)
      const promoted = await resolveOrStageParentPromotion(journal, lockedBinding, options)
      const promotedCommitment = await parentRecordCommitment(promoted, options)
      const promotedGeneration = promoted?.generation ?? null
      journal = await advanceMigrationStage(
        lockedBinding,
        journal,
        'credential-promoted',
        promotedCommitment,
        promotedGeneration,
        options,
      )
    }

    if (journal.stage === 'credential-promoted') {
      await readAndAssertCommittedMigrationState(journal, lockedBinding, options)
      journal = await advanceMigrationStage(
        lockedBinding,
        journal,
        'completed',
        journal.promotedParentCommitmentBase64,
        journal.promotedGeneration,
        options,
      )
    }

    if (journal.stage !== 'completed') {
      throw new Error('Parent migration stopped at an unsupported journal stage.')
    }

    // Completion is durable before this exact post-check and before activation.
    await assertCompletionSeal(journal)
    return finishCompletedMigration(
      journal,
      lockedBinding,
      await readAuthoritativeSnapshot(options.educationalDataPersistence),
      options,
      resumed,
    )
  })
}
