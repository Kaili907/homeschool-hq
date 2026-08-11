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
} from './pinVerifier'
import {
  canonicalCredentialFreeJson,
  finalizePreparedLegacyEducationalCredentials,
  persistAndVerifyEducationalData,
  prepareLegacyEducationalCredentials,
  readLegacyCredentialMigrationRecord,
  type DurableEducationalDataPersistence,
  type LegacyCredentialMigrationOptions,
  type LegacyCredentialMigrationOutcome,
  type LegacyCredentialMigrationResult,
} from './migration'
import {
  enrollLegacyParentPinForMigration,
  markParentCredentialResetRequiredForMigration,
  parentCredentialBindingReference,
  readParentCredentialRecord,
  verifyParentCredentialRecord,
  withParentCredentialMutationLock,
  type ParentCredentialOperationOptions,
  type StoredParentCredentialRecord,
} from './parentVault'
import {
  readLearnerCredential,
  type CredentialStorage,
} from './vault'

export const LEGACY_PARENT_CREDENTIAL_MIGRATION_SCHEMA_VERSION = 1 as const
export const LEGACY_PARENT_CREDENTIAL_MIGRATION_NAMESPACE =
  'homeschool-hq:security:parent-pin-migration:v1' as const

export type LegacyParentPinClassification =
  | 'migratable'
  | 'parent-setup-required'
  | 'reset-required'

export type LegacyParentMigrationStage =
  | 'classified'
  | 'credential-persisted'
  | 'verifier-verified'
  | 'educational-data-persisted'
  | 'complete'

export interface LegacyParentCredentialMigrationRecord {
  readonly schemaVersion: typeof LEGACY_PARENT_CREDENTIAL_MIGRATION_SCHEMA_VERSION
  readonly storage: 'device-local-migration-journal'
  readonly binding: ParentCredentialBindingReference
  readonly classification: LegacyParentPinClassification
  readonly stage: LegacyParentMigrationStage
  readonly credentialCommitmentBase64: string | null
  readonly educationalDataCommitmentBase64: string
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

export interface DurableParentMigrationPersistence {
  /**
   * Atomically writes only if current durable raw state exactly matches the
   * supplied pre-migration snapshot. The expected snapshot is memory-only.
   */
  writeIfUnchanged(
    expectedRawData: unknown,
    educationalData: CredentialFreeJsonValue,
  ): boolean | Promise<boolean>
  read(): unknown | Promise<unknown>
}

export interface LegacyParentCredentialMigrationOptions
  extends ParentCredentialOperationOptions {
  readonly educationalDataPersistence?: DurableParentMigrationPersistence
  readonly afterStage?: (
    stage: LegacyParentMigrationStage,
  ) => void | Promise<void>
}

const STAGES: readonly LegacyParentMigrationStage[] = Object.freeze([
  'classified',
  'credential-persisted',
  'verifier-verified',
  'educational-data-persisted',
  'complete',
])

const JOURNAL_KEYS = Object.freeze([
  'schemaVersion',
  'storage',
  'binding',
  'classification',
  'stage',
  'credentialCommitmentBase64',
  'educationalDataCommitmentBase64',
  'updatedAt',
] as const)

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function storageFrom(options?: LegacyParentCredentialMigrationOptions): CredentialStorage {
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

async function credentialSetCommitment(
  value: unknown,
  binding: InstallationBinding,
  options?: LegacyParentCredentialMigrationOptions,
): Promise<string> {
  const parent = readParentCredentialRecord(binding, options)
  const learners = canonicalProfileIds(value).map((profileId) => [
    profileId,
    readLearnerCredential(profileId, options),
  ] as const)
  return sha256Commitment(JSON.stringify({ parent, learners }))
}

function detachedJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown
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
  if (!plainRecord(value)) throw new Error('Parent credential migration journal is malformed.')
  const keys = Object.keys(value)
  if (
    keys.length !== 3 ||
    !keys.every((key) => ['schemaVersion', 'installationId', 'householdId'].includes(key)) ||
    value.schemaVersion !== 1 ||
    typeof value.installationId !== 'string' ||
    typeof value.householdId !== 'string'
  ) {
    throw new Error('Parent credential migration journal is malformed.')
  }
  return value as unknown as ParentCredentialBindingReference
}

function parseMigrationRecord(
  value: unknown,
  expectedBinding: ParentCredentialBindingReference,
): LegacyParentCredentialMigrationRecord {
  if (!plainRecord(value)) throw new Error('Parent credential migration journal is malformed.')
  const keys = Object.keys(value)
  const binding = parseJournalBinding(value.binding)
  const updatedAt = typeof value.updatedAt === 'string' ? Date.parse(value.updatedAt) : NaN
  if (
    keys.length !== JOURNAL_KEYS.length ||
    !keys.every((key) => JOURNAL_KEYS.includes(key as never)) ||
    value.schemaVersion !== LEGACY_PARENT_CREDENTIAL_MIGRATION_SCHEMA_VERSION ||
    value.storage !== 'device-local-migration-journal' ||
    !bindingMatches(binding, expectedBinding) ||
    (value.classification !== 'migratable' &&
      value.classification !== 'parent-setup-required' &&
      value.classification !== 'reset-required') ||
    !STAGES.includes(value.stage as LegacyParentMigrationStage) ||
    (value.credentialCommitmentBase64 !== null &&
      !validCommitment(value.credentialCommitmentBase64)) ||
    !validCommitment(value.educationalDataCommitmentBase64) ||
    !Number.isFinite(updatedAt) ||
    new Date(updatedAt).toISOString() !== value.updatedAt
  ) {
    throw new Error('Parent credential migration journal is malformed.')
  }
  return value as unknown as LegacyParentCredentialMigrationRecord
}

export function readLegacyParentCredentialMigrationRecord(
  binding: InstallationBinding,
  options?: LegacyParentCredentialMigrationOptions,
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

async function advanceMigrationStage(
  binding: InstallationBinding,
  classification: LegacyParentPinClassification,
  stage: LegacyParentMigrationStage,
  educationalDataCommitmentBase64: string,
  credentialCommitmentBase64: string | null,
  options?: LegacyParentCredentialMigrationOptions,
): Promise<LegacyParentCredentialMigrationRecord> {
  const reference = parentCredentialBindingReference(binding)
  const existing = readLegacyParentCredentialMigrationRecord(binding, options)
  if (existing && existing.classification !== classification) {
    throw new Error('Legacy Parent credential classification changed during interrupted migration.')
  }
  if (existing && existing.educationalDataCommitmentBase64 !== educationalDataCommitmentBase64) {
    throw new Error('Credential-free educational data changed during interrupted Parent migration.')
  }
  if (
    existing &&
    existing.credentialCommitmentBase64 !== null &&
    credentialCommitmentBase64 !== null &&
    existing.credentialCommitmentBase64 !== credentialCommitmentBase64
  ) {
    throw new Error('Verified credential set changed during interrupted Parent migration.')
  }
  const effectiveCredentialCommitment =
    credentialCommitmentBase64 ?? existing?.credentialCommitmentBase64 ?? null
  if (
    STAGES.indexOf(stage) >= STAGES.indexOf('verifier-verified') &&
    effectiveCredentialCommitment === null
  ) {
    throw new Error('Verified credential commitment is required before educational persistence.')
  }
  if (existing && STAGES.indexOf(existing.stage) >= STAGES.indexOf(stage)) return existing

  const record: LegacyParentCredentialMigrationRecord = {
    schemaVersion: LEGACY_PARENT_CREDENTIAL_MIGRATION_SCHEMA_VERSION,
    storage: 'device-local-migration-journal',
    binding: reference,
    classification,
    stage,
    credentialCommitmentBase64: effectiveCredentialCommitment,
    educationalDataCommitmentBase64,
    updatedAt: timestamp(options),
  }
  const storage = storageFrom(options)
  const key = journalStorageKey(reference)
  const serialized = JSON.stringify(record)
  storage.setItem(key, serialized)
  const readBack = storage.getItem(key)
  if (readBack !== serialized) {
    throw new Error('Parent credential migration journal failed durable read-back verification.')
  }
  const persisted = parseMigrationRecord(JSON.parse(readBack) as unknown, reference)
  await options?.afterStage?.(stage)
  return persisted
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

function stageAtLeast(
  record: LegacyParentCredentialMigrationRecord,
  stage: LegacyParentMigrationStage,
): boolean {
  return STAGES.indexOf(record.stage) >= STAGES.indexOf(stage)
}

function resolveClassification(
  legacy: ExactLegacyParentPin,
  journal: LegacyParentCredentialMigrationRecord | null,
): LegacyParentPinClassification {
  if (!journal) return legacy.classification
  if (legacy.present) {
    if (legacy.classification !== journal.classification) {
      throw new Error('Legacy root parentPin changed during interrupted Parent migration.')
    }
    return journal.classification
  }
  if (
    journal.classification === 'parent-setup-required' ||
    stageAtLeast(journal, 'verifier-verified')
  ) {
    return journal.classification
  }
  throw new Error('Legacy root parentPin disappeared before its Parent verifier was durably verified.')
}

function assertResumableCredential(
  classification: LegacyParentPinClassification,
  record: StoredParentCredentialRecord | null,
): 'enrolled' | 'reset-required' | 'parent-setup-required' {
  if (classification === 'parent-setup-required') {
    if (record !== null) {
      throw new Error('A Parent credential exists without a qualifying legacy migration journal.')
    }
    return 'parent-setup-required'
  }
  if (classification === 'migratable' && record?.state === 'enrolled') return 'enrolled'
  if (classification === 'reset-required' && record?.state === 'reset-required') return 'reset-required'
  throw new Error('Parent migration journal and device-local credential state do not agree.')
}

function completedMigrationCredentialState(
  journal: LegacyParentCredentialMigrationRecord,
  record: StoredParentCredentialRecord | null,
): LegacyParentCredentialMigrationOutcome['credentialState'] {
  if (
    journal.classification === 'migratable' &&
    (record?.state === 'enrolled' || record?.state === 'reset-required')
  ) {
    return record.state
  }
  if (journal.classification === 'reset-required' && record?.state === 'reset-required') {
    return 'reset-required'
  }
  if (journal.classification === 'parent-setup-required' && record === null) {
    return 'parent-setup-required'
  }
  throw new Error('Completed Parent migration and device-local credential state do not agree.')
}

function learnerStageVerified(stage: string): boolean {
  return stage === 'verifier-verified' ||
    stage === 'educational-data-sanitized' ||
    stage === 'complete'
}

function resumePreparedLearners(
  value: unknown,
  educationalData: CredentialFreeJsonValue,
  options?: LegacyParentCredentialMigrationOptions,
): LegacyCredentialMigrationResult {
  const outcomes: LegacyCredentialMigrationOutcome[] = []
  for (const profileId of canonicalProfileIds(value)) {
    const journal = readLegacyCredentialMigrationRecord(profileId, learnerMigrationOptions(options))
    if (!journal) continue
    const credential = readLearnerCredential(profileId, options)
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

async function publishCredentialFreeEducationalData(
  sourceSnapshot: unknown,
  educationalData: CredentialFreeJsonValue,
  persistence: DurableParentMigrationPersistence,
): Promise<void> {
  const detachedEducationalData = detachedJson(educationalData) as CredentialFreeJsonValue
  const written = await persistence.writeIfUnchanged(
    detachedJson(sourceSnapshot),
    detachedEducationalData,
  )
  if (written !== true) {
    throw new Error('Durable educational data changed before coordinated credential migration could publish.')
  }
  const verificationPort: DurableEducationalDataPersistence = {
    write: () => undefined,
    read: () => persistence.read(),
  }
  await persistAndVerifyEducationalData(educationalData, {
    educationalDataPersistence: verificationPort,
  })
}

async function validateParentStateBeforeJournal(
  legacy: ExactLegacyParentPin,
  classification: LegacyParentPinClassification,
  credential: StoredParentCredentialRecord | null,
  binding: InstallationBinding,
  options?: LegacyParentCredentialMigrationOptions,
): Promise<void> {
  if (!credential) return
  if (classification === 'parent-setup-required') {
    throw new Error('A Parent credential exists without a qualifying legacy migration journal.')
  }
  if (classification === 'reset-required') {
    if (credential.state === 'enrolled') {
      throw new Error('Malformed legacy Parent PIN cannot replace an enrolled Parent credential.')
    }
    return
  }
  if (!legacy.present || credential.state !== 'enrolled') {
    throw new Error('Parent migration journal and device-local credential state do not agree.')
  }
  if (!(await verifyParentCredentialRecord(credential, binding, legacy.value, options))) {
    throw new Error('Existing Parent credential conflicts with the exact legacy Parent PIN.')
  }
}

/**
 * Consumes only exact root AppState.parentPin. Resolution means the bound
 * verifier (or fail-closed tombstone) and credential-free educational state
 * both passed durable read-back. The raw caller object is never mutated.
 */
export async function migrateLegacyParentCredential(
  value: unknown,
  binding: InstallationBinding,
  options?: LegacyParentCredentialMigrationOptions,
): Promise<LegacyParentCredentialMigrationResult> {
  // Validate and detach the complete raw snapshot before any await, journal,
  // verifier, or educational-data write. Every later classification and CAS
  // comparison is derived from this one immutable-by-ownership snapshot.
  sanitizeCredentialFreeEducationalData(value)
  assertSnapshotSafeLegacyCredentialValues(value)
  const sourceSnapshot = detachedJson(value)
  const educationalData = sanitizeCredentialFreeEducationalData(sourceSnapshot)
  const legacy = exactLegacyParentPin(sourceSnapshot)
  const learnerMode = legacyLearnerPinMode(sourceSnapshot)
  const persistence = options?.educationalDataPersistence
  if (!persistence) {
    throw new Error('Durable educational-data persistence and read-back are required for Parent migration.')
  }

  return withParentCredentialMutationLock(binding, options, async (lockedBinding) => {
    const priorJournal = readLegacyParentCredentialMigrationRecord(lockedBinding, options)
    const priorCredential = readParentCredentialRecord(lockedBinding, options)
    if (
      priorJournal?.stage === 'complete' &&
      !legacy.present &&
      learnerMode === 'none'
    ) {
      return {
        educationalData,
        outcome: {
          classification: priorJournal.classification,
          credentialState: completedMigrationCredentialState(priorJournal, priorCredential),
          resumed: true,
        },
      }
    }

    const dataCommitment = await educationalDataCommitment(educationalData)
    const classification = resolveClassification(legacy, priorJournal)
    if (
      priorJournal &&
      priorJournal.educationalDataCommitmentBase64 !== dataCommitment
    ) {
      throw new Error('Credential-free educational data changed during interrupted Parent migration.')
    }
    if (!(!legacy.present && priorJournal && stageAtLeast(priorJournal, 'verifier-verified'))) {
      await validateParentStateBeforeJournal(
        legacy,
        classification,
        priorCredential,
        lockedBinding,
        options,
      )
    }
    const resumed = priorJournal !== null || priorCredential !== null
    await advanceMigrationStage(
      lockedBinding,
      classification,
      'classified',
      dataCommitment,
      null,
      options,
    )

    let credentialState: LegacyParentCredentialMigrationOutcome['credentialState']
    if (
      !legacy.present &&
      priorJournal !== null &&
      stageAtLeast(priorJournal, 'verifier-verified')
    ) {
      credentialState = assertResumableCredential(classification, priorCredential)
    } else if (classification === 'parent-setup-required') {
      credentialState = assertResumableCredential(classification, priorCredential)
    } else if (classification === 'reset-required') {
      const reset = await markParentCredentialResetRequiredForMigration(lockedBinding, options)
      await advanceMigrationStage(
        lockedBinding,
        classification,
        'credential-persisted',
        dataCommitment,
        null,
        options,
      )
      const readBack = readParentCredentialRecord(lockedBinding, options)
      if (!readBack || readBack.state !== 'reset-required' || JSON.stringify(readBack) !== JSON.stringify(reset)) {
        throw new Error('Reset-required Parent credential failed migration read-back verification.')
      }
      credentialState = 'reset-required'
    } else {
      const rawPin = legacy.value as string
      const enrolled = await enrollLegacyParentPinForMigration(lockedBinding, rawPin, options)
      await advanceMigrationStage(
        lockedBinding,
        classification,
        'credential-persisted',
        dataCommitment,
        null,
        options,
      )
      const readBack = readParentCredentialRecord(lockedBinding, options)
      if (
        !readBack ||
        JSON.stringify(readBack) !== JSON.stringify(enrolled) ||
        !(await verifyParentCredentialRecord(readBack, lockedBinding, rawPin, options))
      ) {
        throw new Error('Migrated Parent verifier failed correctness verification.')
      }
      credentialState = 'enrolled'
    }

    const preparedLearners = learnerMode === 'all'
      ? await prepareLegacyEducationalCredentials(sourceSnapshot, learnerMigrationOptions(options))
      : resumePreparedLearners(sourceSnapshot, educationalData, options)
    if (
      canonicalCredentialFreeJson(preparedLearners.educationalData) !==
      canonicalCredentialFreeJson(educationalData)
    ) {
      throw new Error('Learner and Parent migrations produced different credential-free data.')
    }

    const credentialCommitment = await credentialSetCommitment(
      sourceSnapshot,
      lockedBinding,
      options,
    )
    if (
      priorJournal?.credentialCommitmentBase64 !== null &&
      priorJournal?.credentialCommitmentBase64 !== undefined &&
      priorJournal.credentialCommitmentBase64 !== credentialCommitment
    ) {
      throw new Error('Verified credential set changed during interrupted Parent migration.')
    }
    await advanceMigrationStage(
      lockedBinding,
      classification,
      'verifier-verified',
      dataCommitment,
      credentialCommitment,
      options,
    )

    // Revalidate active binding immediately before the single CAS publication.
    parentCredentialBindingReference(lockedBinding)
    await publishCredentialFreeEducationalData(sourceSnapshot, educationalData, persistence)
    await finalizePreparedLegacyEducationalCredentials(
      preparedLearners,
      learnerMigrationOptions(options),
    )
    await advanceMigrationStage(
      lockedBinding,
      classification,
      'educational-data-persisted',
      dataCommitment,
      credentialCommitment,
      options,
    )
    await advanceMigrationStage(
      lockedBinding,
      classification,
      'complete',
      dataCommitment,
      credentialCommitment,
      options,
    )
    return {
      educationalData,
      outcome: { classification, credentialState, resumed },
    }
  })
}
