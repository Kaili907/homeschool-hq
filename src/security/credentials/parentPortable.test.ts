import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { Profile } from '../../types'
import {
  CredentialSanitizationError,
  sanitizeCredentialFreeEducationalData,
  sanitizeCredentialFreeEducationalProfile,
  serializeCredentialFreeEducationalData,
} from '../appData'
import {
  createInstallationId,
  INSTALLATION_BINDING_SCHEMA_VERSION,
  type InstallationBinding,
} from '../contracts'
import * as credentials from './index'
import { sanitizeAndEnrollLegacyImportCredentials } from './importCompatibility'
import {
  LEGACY_PARENT_CREDENTIAL_MIGRATION_NAMESPACE,
  migrateLegacyParentCredential,
  type DurableParentMigrationPersistence,
} from './parentMigration'
import { PARENT_PIN_VERIFIER_DOMAIN } from './parentPinVerifier'
import {
  parentFailedAttemptSubject,
  PARENT_CREDENTIAL_STORAGE_NAMESPACE,
  type ParentCredentialLockManager,
  type StoredParentCredentialRecord,
} from './parentVault'
import { createPreparedParentCredentialRecordForTest } from './parentVault.internal'
import { MemoryCredentialStorage } from './testStorage'

const INSTALLATION_ID = 'd9428888-122b-4f9b-9424-1f35c63d5750'
const HOUSEHOLD_ID = 'household-parent-portable-test'
const NOW = '2026-08-11T12:00:00.000Z'

const binding: InstallationBinding = Object.freeze({
  schemaVersion: INSTALLATION_BINDING_SCHEMA_VERSION,
  bindingId: 'binding-parent-portable-test',
  installationId: createInstallationId(() => INSTALLATION_ID),
  householdId: HOUSEHOLD_ID,
  datasetEpoch: 'dataset-epoch-parent-portable-test',
  verifiedActorId: 'verified-parent-portable-test',
  status: 'active',
  boundAt: NOW,
})

function legacyEducationalData(additional: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 2,
    activeProfileId: 'p1',
    parentPin: '8642',
    profiles: {
      p1: {
        id: 'p1',
        name: 'Synthetic learner',
        pin: '1234',
        progress: { completed: true },
      },
    },
    ...additional,
  }
}

let parentCredential: StoredParentCredentialRecord

describe('Parent credential portable-data boundaries', () => {

  beforeAll(async () => {
    parentCredential = await createPreparedParentCredentialRecordForTest(
      binding,
      '8642',
      1,
      { now: () => new Date(NOW) },
    )
  })

  it('builds realistic verifier metadata and rejects it at the whole-dataset sanitizer', () => {
    expect(parentCredential).toMatchObject({
      storage: 'device-local-only',
      credentialKind: 'parent-pin',
      verifierScheme: 'pbkdf2-sha256',
      state: 'prepared',
    })
    expect(parentCredential.saltBase64).not.toBe('')
    expect(parentCredential.verifierBase64).not.toBe('')

    expect(() =>
      sanitizeCredentialFreeEducationalData(
        legacyEducationalData({ deviceLocalMaterial: parentCredential }),
      ),
    ).toThrow(CredentialSanitizationError)
  })

  it('rejects Parent verifier metadata at the credential-free serializer/export seam', () => {
    expect(() =>
      serializeCredentialFreeEducationalData(
        legacyEducationalData({ deviceLocalMaterial: parentCredential }),
      ),
    ).toThrow(CredentialSanitizationError)
  })

  it('rejects Parent verifier metadata at the single-profile sanitizer', () => {
    const profile = {
      id: 'p1',
      name: 'Synthetic learner',
      grade: '5',
      pin: '1234',
      deviceLocalMaterial: parentCredential,
    } as unknown as Profile

    expect(() => sanitizeCredentialFreeEducationalProfile(profile)).toThrow(
      CredentialSanitizationError,
    )
  })

  it('rejects authoritative Parent verifier metadata before writes or authority access', async () => {
    const storage = new MemoryCredentialStorage()
    const durableWrite = vi.fn()
    const durableRead = vi.fn()
    const durableCommitLock = vi.fn()
    const credentialLock = vi.fn()
    const authorityRead = vi.fn()
    const authorityWrite = vi.fn()
    const authoritativeSnapshot = {
      educationalData: legacyEducationalData({
        deviceLocalMaterial: parentCredential,
      }),
      revision: 'portable-preflight-r1',
      migrationReceiptBase64: null,
      migrationPreparationCommitmentBase64: null,
      migrationCompletionCommitmentBase64: null,
    }
    const educationalDataPersistence: DurableParentMigrationPersistence = {
      writeIfUnchanged(): never {
        durableWrite()
        throw new Error('Parent migration preflight unexpectedly wrote durable state.')
      },
      read() {
        durableRead()
        return authoritativeSnapshot
      },
      withMigrationCommitLock<T>(): T | Promise<T> {
        durableCommitLock()
        throw new Error('Parent migration preflight unexpectedly acquired the commit lock.')
      },
    }
    const preflightLockManager: ParentCredentialLockManager = {
      async request<T>(
        _name: string,
        _options: { readonly mode: 'exclusive' },
        callback: () => T | Promise<T>,
      ): Promise<T> {
        credentialLock()
        return callback()
      },
    }

    await expect(
      migrateLegacyParentCredential(
        binding,
        {
          storage,
          generationAuthority: {
            read(): never {
              authorityRead()
              throw new Error('Parent migration preflight unexpectedly read authority.')
            },
            compareAndSwap(): never {
              authorityWrite()
              throw new Error('Parent migration preflight unexpectedly changed authority.')
            },
          },
          lockManager: preflightLockManager,
          educationalDataPersistence,
        },
      ),
    ).rejects.toBeInstanceOf(CredentialSanitizationError)

    expect(storage.entries()).toEqual([])
    expect(durableWrite).not.toHaveBeenCalled()
    expect(durableRead).toHaveBeenCalledTimes(1)
    expect(durableCommitLock).not.toHaveBeenCalled()
    expect(credentialLock).toHaveBeenCalledTimes(1)
    expect(authorityRead).not.toHaveBeenCalled()
    expect(authorityWrite).not.toHaveBeenCalled()
  })

  it('rejects Parent verifier metadata during legacy import preflight before any write', async () => {
    const storage = new MemoryCredentialStorage()
    const write = vi.fn()
    const read = vi.fn()

    await expect(
      sanitizeAndEnrollLegacyImportCredentials(
        legacyEducationalData({ deviceLocalMaterial: parentCredential }),
        {
          storage,
          educationalDataPersistence: { write, read },
        },
      ),
    ).rejects.toBeInstanceOf(CredentialSanitizationError)

    expect(storage.entries()).toEqual([])
    expect(write).not.toHaveBeenCalled()
    expect(read).not.toHaveBeenCalled()
  })

  it('does not expose unauthenticated Parent enrollment or raw record creation centrally', () => {
    expect(credentials.migrateLegacyParentCredential).toBe(migrateLegacyParentCredential)
    // Enrollment exists, but only behind explicit installation claim authority.
    expect(typeof credentials.claimParentPinAuthorized).toBe('function')
    for (const forbiddenExport of [
      'enrollParentPin',
      'setParentPin',
      'claimParentPin',
      'claimParentPinUnauthorized',
      'parentInstallationClaimGrantEvidence',
      'parentInstallationRecoveryGrantEvidence',
      'createParentCredentialRecord',
      'createParentCredentialRecordForMigration',
      'enrollLegacyParentPinForMigration',
      'markParentCredentialResetRequiredForMigration',
      'writeParentCredentialRecord',
      'withParentCredentialMutationLock',
      'canonicalCredentialFreeJson',
      'persistAndVerifyEducationalData',
      'prepareLegacyEducationalCredentials',
      'finalizePreparedLegacyEducationalCredentials',
      'classifyLegacyParentPin',
      'readLegacyParentCredentialMigrationRecord',
      'LEGACY_PARENT_CREDENTIAL_MIGRATION_NAMESPACE',
      'LEGACY_PARENT_CREDENTIAL_MIGRATION_SCHEMA_VERSION',
      'createPreparedParentCredentialRecordForTest',
      'prepareLegacyParentPinForMigration',
      'prepareParentCredential',
      'prepareMigrationAttempt',
      'publishPreparedMigration',
      'stagePreparedParentCredentialForMigration',
      'stagePreparedParentResetForMigration',
      'activateParentCredentialForMigration',
      'resolveOrStageParentPromotion',
      'verifyPreparedParentCredentialForMigration',
      'verifyParentCredentialRecord',
      'parseParentCredentialRecord',
      'readParentCredentialRecord',
      'readParentCredentialSnapshot',
      'persistParentCredentialRecord',
      'parentCredentialRecordCommitment',
      'persistJournalRecord',
      'ensurePreparedJournal',
      'advanceMigrationStage',
      'assertCompletionSeal',
      'finishCompletedMigration',
      'compareAndSwapParentGeneration',
      'parentGenerationSnapshotsEqual',
      'parentCredentialSnapshotsEqual',
    ]) {
      expect(Object.hasOwn(credentials, forbiddenExport)).toBe(false)
    }
    // Exact pin, not an emptiness check: any other Parent-migration-shaped
    // export must still fail this sweep.
    expect(
      Object.keys(credentials).filter((name) =>
        /parent.*migration|migration.*parent/i.test(name),
      ),
    ).toEqual(['ParentMigrationCompletionError'])
  })

  it('freezes the Parent domain, device-local namespaces, and attempt-ledger subject shape', () => {
    expect(PARENT_PIN_VERIFIER_DOMAIN).toBe('manuel-academy:parent-pin:v1')
    expect(PARENT_CREDENTIAL_STORAGE_NAMESPACE).toBe(
      'homeschool-hq:security:parent-credentials:v2',
    )
    expect(LEGACY_PARENT_CREDENTIAL_MIGRATION_NAMESPACE).toBe(
      'homeschool-hq:security:parent-pin-migration:v2',
    )

    const subject = parentFailedAttemptSubject(binding)
    expect(subject).toEqual({ kind: 'parent', householdId: HOUSEHOLD_ID })
    expect(Object.keys(subject)).toEqual(['kind', 'householdId'])
    expect(Object.isFrozen(subject)).toBe(true)
  })
})

describe('Parent credential-shaped keys at the educational projection', () => {
  // Renaming is the whole attack: several of these survive the shared key-name
  // policy precisely because `pin`/`salt` sit mid-word. The explicit schema
  // projection is what stops them, so it is what these tests exercise.
  const CREDENTIAL_SHAPED_KEYS = [
    'parentPinValue',
    'parentPinBackup',
    'parentVerifierValue',
    'parentSaltBase64',
    'parentCredentialRecord',
    'parentCredentialGeneration',
    'parentAuthorizationGrant',
    'parentPinHash',
    'parentPinRecovery',
    'parentGrantEnvelope',
    'deviceLocalMaterial',
  ] as const

  function educationalProfile(additional: Record<string, unknown> = {}): Profile {
    return {
      id: 'p1',
      name: 'Synthetic learner',
      grade: '5',
      pin: '1234',
      ...additional,
    } as unknown as Profile
  }

  it.each(CREDENTIAL_SHAPED_KEYS)(
    'refuses a flat credential-shaped value named %s',
    (key) => {
      expect(() =>
        sanitizeCredentialFreeEducationalProfile(educationalProfile({ [key]: '8642' })),
      ).toThrow(CredentialSanitizationError)
    },
  )

  // Defence in depth, and deliberately not labelled as projector coverage: a
  // whole record is already refused by the shared structural contract through
  // its own interior keys, so this sweep would still pass without the explicit
  // projection. The flat-value sweep above is what pins the projector.
  it.each(CREDENTIAL_SHAPED_KEYS)(
    'refuses whole Parent verifier metadata named %s by structure alone',
    (key) => {
      expect(() =>
        sanitizeCredentialFreeEducationalProfile(
          educationalProfile({ [key]: parentCredential }),
        ),
      ).toThrow(CredentialSanitizationError)
    },
  )

  it('names the offending field rather than failing generically', () => {
    expect(() =>
      sanitizeCredentialFreeEducationalProfile(
        educationalProfile({ parentSaltBase64: 'AAAA' }),
      ),
    ).toThrow(/parentSaltBase64/)
  })

  it('still projects the educational schema, including generic-sounding fields', () => {
    // Control: a projector that rejected everything would pass the sweeps above
    // while destroying the feature.
    const projected = sanitizeCredentialFreeEducationalProfile(
      educationalProfile({
        theme: 'aurora',
        streaks: { current: 3 },
        totals: { stars: 12 },
        placementDone: true,
        createdAt: NOW,
        missions: {},
        skills: {},
      }),
    )
    expect(projected).toMatchObject({
      id: 'p1',
      name: 'Synthetic learner',
      grade: '5',
      theme: 'aurora',
      placementDone: true,
    })
    expect(projected).not.toHaveProperty('pin')
  })
})
