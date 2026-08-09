import {
  sanitizeCredentialFreeEducationalData,
  type CredentialFreeJsonValue,
} from '../appData'
import { isFourDigitPin } from './pinVerifier'
import {
  enrollLegacyCredential,
  learnerCredentialStorageKey,
  markLearnerCredentialResetRequired,
  readLearnerCredential,
  type CredentialOperationOptions,
  type CredentialStorage,
  verifyLearnerCredentialRecord,
} from './vault'

export const LEGACY_CREDENTIAL_MIGRATION_SCHEMA_VERSION = 1 as const
export const LEGACY_CREDENTIAL_MIGRATION_NAMESPACE =
  'homeschool-hq:security:learner-pin-migration:v1' as const
export const LEGACY_IMPORT_CREDENTIAL_MIGRATION_NAMESPACE =
  'homeschool-hq:security:legacy-import-pin-migration:v1' as const

export type LegacyPinClassification =
  | 'unenrolled'
  | 'migratable'
  | 'reset-required'

export type LegacyMigrationStage =
  | 'classified'
  | 'credential-persisted'
  | 'verifier-verified'
  | 'educational-data-sanitized'
  | 'complete'

export interface LegacyCredentialMigrationRecord {
  readonly schemaVersion: typeof LEGACY_CREDENTIAL_MIGRATION_SCHEMA_VERSION
  readonly storage: 'device-local-migration-journal'
  readonly profileId: string
  readonly classification: LegacyPinClassification
  readonly stage: LegacyMigrationStage
  readonly updatedAt: string
}

export interface LegacyCredentialMigrationOutcome {
  readonly profileId: string
  readonly classification: LegacyPinClassification
  readonly credentialState: 'none' | 'enrolled' | 'reset-required'
  readonly resumed: boolean
}

export interface LegacyCredentialMigrationResult {
  readonly educationalData: CredentialFreeJsonValue
  readonly outcomes: readonly LegacyCredentialMigrationOutcome[]
}

export interface LegacyCredentialMigrationOptions extends CredentialOperationOptions {
  readonly journalNamespace?: string
  readonly educationalDataPersistence?: DurableEducationalDataPersistence
  readonly afterStage?: (
    profileId: string,
    stage: LegacyMigrationStage,
  ) => void | Promise<void>
}

/**
 * Final integration owns AppState persistence. The migration supplies only an
 * already-sanitized value, then independently validates the durable read-back.
 */
export interface DurableEducationalDataPersistence {
  write(educationalData: CredentialFreeJsonValue): void | Promise<void>
  read(): unknown | Promise<unknown>
}

const STAGES: readonly LegacyMigrationStage[] = Object.freeze([
  'classified',
  'credential-persisted',
  'verifier-verified',
  'educational-data-sanitized',
  'complete',
])

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function storageFrom(options?: LegacyCredentialMigrationOptions): CredentialStorage {
  if (options?.storage) return options.storage
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Fall through to a fail-closed error.
  }
  throw new Error('Device-local migration journal storage is unavailable.')
}

function namespaceFrom(options?: LegacyCredentialMigrationOptions): string {
  const namespace = options?.journalNamespace ?? LEGACY_CREDENTIAL_MIGRATION_NAMESPACE
  if (!namespace.startsWith('homeschool-hq:security:') || namespace.length > 200) {
    throw new Error('Credential migration journal namespace is invalid.')
  }
  return namespace
}

function migrationStorageKey(
  profileId: string,
  options?: LegacyCredentialMigrationOptions,
): string {
  // Reuse the vault's strict profile-id validation without sharing its namespace.
  learnerCredentialStorageKey(profileId)
  return `${namespaceFrom(options)}:${encodeURIComponent(profileId)}`
}

function timestamp(options?: LegacyCredentialMigrationOptions): string {
  const value = (options?.now ?? (() => new Date()))().toISOString()
  if (new Date(Date.parse(value)).toISOString() !== value) {
    throw new Error('Credential migration clock returned an invalid timestamp.')
  }
  return value
}

export function classifyLegacyPin(value: unknown): LegacyPinClassification {
  if (value === '') return 'unenrolled'
  return isFourDigitPin(value) ? 'migratable' : 'reset-required'
}

function parseMigrationRecord(
  value: unknown,
  expectedProfileId: string,
): LegacyCredentialMigrationRecord {
  if (!plainRecord(value)) throw new Error('Credential migration journal is malformed.')
  const keys = Object.keys(value)
  const expectedKeys = [
    'schemaVersion',
    'storage',
    'profileId',
    'classification',
    'stage',
    'updatedAt',
  ]
  const updatedAt = typeof value.updatedAt === 'string' ? Date.parse(value.updatedAt) : NaN
  if (
    keys.length !== expectedKeys.length ||
    !keys.every((key) => expectedKeys.includes(key)) ||
    value.schemaVersion !== LEGACY_CREDENTIAL_MIGRATION_SCHEMA_VERSION ||
    value.storage !== 'device-local-migration-journal' ||
    value.profileId !== expectedProfileId ||
    (value.classification !== 'unenrolled' &&
      value.classification !== 'migratable' &&
      value.classification !== 'reset-required') ||
    !STAGES.includes(value.stage as LegacyMigrationStage) ||
    !Number.isFinite(updatedAt) ||
    new Date(updatedAt).toISOString() !== value.updatedAt
  ) {
    throw new Error('Credential migration journal is malformed.')
  }
  return value as unknown as LegacyCredentialMigrationRecord
}

export function readLegacyCredentialMigrationRecord(
  profileId: string,
  options?: LegacyCredentialMigrationOptions,
): LegacyCredentialMigrationRecord | null {
  const storage = storageFrom(options)
  const raw = storage.getItem(migrationStorageKey(profileId, options))
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    throw new Error('Credential migration journal is malformed.')
  }
  return parseMigrationRecord(parsed, profileId)
}

async function advanceMigrationStage(
  profileId: string,
  classification: LegacyPinClassification,
  stage: LegacyMigrationStage,
  options?: LegacyCredentialMigrationOptions,
): Promise<LegacyCredentialMigrationRecord> {
  const existing = readLegacyCredentialMigrationRecord(profileId, options)
  if (existing && existing.classification !== classification) {
    throw new Error(
      'Legacy credential classification changed during an interrupted migration; re-enrollment is required.',
    )
  }
  if (existing && STAGES.indexOf(existing.stage) >= STAGES.indexOf(stage)) return existing

  const record: LegacyCredentialMigrationRecord = {
    schemaVersion: LEGACY_CREDENTIAL_MIGRATION_SCHEMA_VERSION,
    storage: 'device-local-migration-journal',
    profileId,
    classification,
    stage,
    updatedAt: timestamp(options),
  }
  const storage = storageFrom(options)
  const key = migrationStorageKey(profileId, options)
  const serialized = JSON.stringify(record)
  storage.setItem(key, serialized)
  const readBack = storage.getItem(key)
  if (readBack !== serialized) {
    throw new Error('Credential migration journal failed durable read-back verification.')
  }
  const persisted = parseMigrationRecord(JSON.parse(readBack) as unknown, profileId)
  await options?.afterStage?.(profileId, stage)
  return persisted
}

interface LegacyProfileInput {
  readonly profileId: string
  readonly pin: unknown
  readonly classification: LegacyPinClassification
}

function legacyProfilesFrom(value: unknown): LegacyProfileInput[] {
  if (!plainRecord(value) || !plainRecord(value.profiles)) {
    throw new Error('Legacy educational data must contain a profiles object.')
  }
  return Object.entries(value.profiles).map(([profileId, profile]) => {
    learnerCredentialStorageKey(profileId)
    if (!plainRecord(profile) || profile.id !== profileId || !Object.hasOwn(profile, 'pin')) {
      throw new Error(`Legacy profile ${profileId} is malformed.`)
    }
    return {
      profileId,
      pin: profile.pin,
      classification: classifyLegacyPin(profile.pin),
    }
  })
}

function canonicalCredentialFreeJson(value: CredentialFreeJsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalCredentialFreeJson(entry)).join(',')}]`
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalCredentialFreeJson(value[key])}`)
    .join(',')}}`
}

async function persistAndVerifyEducationalData(
  educationalData: CredentialFreeJsonValue,
  options?: LegacyCredentialMigrationOptions,
): Promise<void> {
  const persistence = options?.educationalDataPersistence
  if (!persistence) {
    throw new Error(
      'Durable educational-data persistence and read-back are required to complete credential migration.',
    )
  }
  await persistence.write(educationalData)
  const readBack = await persistence.read()
  const credentialFreeReadBack = sanitizeCredentialFreeEducationalData(readBack)
  const expected = canonicalCredentialFreeJson(educationalData)
  if (
    canonicalCredentialFreeJson(credentialFreeReadBack) !== expected ||
    canonicalCredentialFreeJson(readBack as CredentialFreeJsonValue) !== expected
  ) {
    throw new Error('Durable educational data failed exact credential-free read-back verification.')
  }
}

async function migrateOneProfile(
  profile: LegacyProfileInput,
  options?: LegacyCredentialMigrationOptions,
): Promise<LegacyCredentialMigrationOutcome> {
  const priorJournal = readLegacyCredentialMigrationRecord(profile.profileId, options)
  const priorCredential = readLearnerCredential(profile.profileId, options)
  const resumed = priorJournal !== null || priorCredential !== null
  await advanceMigrationStage(
    profile.profileId,
    profile.classification,
    'classified',
    options,
  )

  if (profile.classification === 'unenrolled') {
    return {
      profileId: profile.profileId,
      classification: profile.classification,
      credentialState: priorCredential?.state ?? 'none',
      resumed,
    }
  }

  if (profile.classification === 'reset-required') {
    const reset = await markLearnerCredentialResetRequired(profile.profileId, options)
    await advanceMigrationStage(
      profile.profileId,
      profile.classification,
      'credential-persisted',
      options,
    )
    const readBack = readLearnerCredential(profile.profileId, options)
    if (!readBack || readBack.state !== 'reset-required' || readBack !== reset &&
      JSON.stringify(readBack) !== JSON.stringify(reset)) {
      throw new Error('Reset-required credential failed migration read-back verification.')
    }
    await advanceMigrationStage(
      profile.profileId,
      profile.classification,
      'verifier-verified',
      options,
    )
    return {
      profileId: profile.profileId,
      classification: profile.classification,
      credentialState: 'reset-required',
      resumed,
    }
  }

  const rawPin = profile.pin as string
  let credential = priorCredential
  if (!credential) {
    credential = await enrollLegacyCredential(profile.profileId, rawPin, options)
  } else if (!(await verifyLearnerCredentialRecord(credential, rawPin, options))) {
    credential = await markLearnerCredentialResetRequired(profile.profileId, options)
  }
  await advanceMigrationStage(
    profile.profileId,
    profile.classification,
    'credential-persisted',
    options,
  )

  const readBack = readLearnerCredential(profile.profileId, options)
  if (!readBack) throw new Error('Migrated learner credential is missing after persistence.')
  const credentialState = await verifyLearnerCredentialRecord(readBack, rawPin, options)
    ? 'enrolled'
    : 'reset-required'
  if (credentialState === 'reset-required' && readBack.state !== 'reset-required') {
    throw new Error('Migrated learner verifier failed correctness verification.')
  }
  await advanceMigrationStage(
    profile.profileId,
    profile.classification,
    'verifier-verified',
    options,
  )
  return {
    profileId: profile.profileId,
    classification: profile.classification,
    credentialState,
    resumed,
  }
}

/**
 * Crash-safe and idempotent while the legacy plaintext remains available in
 * memory. No journal record contains the PIN, salt, verifier, or recovery data.
 */
export async function migrateLegacyEducationalCredentials(
  value: unknown,
  options?: LegacyCredentialMigrationOptions,
): Promise<LegacyCredentialMigrationResult> {
  const profiles = legacyProfilesFrom(value)
  const outcomes: LegacyCredentialMigrationOutcome[] = []
  for (const profile of profiles) {
    outcomes.push(await migrateOneProfile(profile, options))
  }

  const educationalData = sanitizeCredentialFreeEducationalData(value)
  await persistAndVerifyEducationalData(educationalData, options)
  for (const profile of profiles) {
    await advanceMigrationStage(
      profile.profileId,
      profile.classification,
      'educational-data-sanitized',
      options,
    )
    await advanceMigrationStage(
      profile.profileId,
      profile.classification,
      'complete',
      options,
    )
  }
  return { educationalData, outcomes }
}
