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
} from './parentMigration'
import { PARENT_PIN_VERIFIER_DOMAIN } from './parentPinVerifier'
import {
  createParentCredentialRecordForMigration,
  parentFailedAttemptSubject,
  PARENT_CREDENTIAL_STORAGE_NAMESPACE,
  type ParentCredentialLockManager,
  type StoredParentCredentialRecord,
} from './parentVault'
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

class ImmediateLockManager implements ParentCredentialLockManager {
  async request<T>(
    _name: string,
    _options: { readonly mode: 'exclusive' },
    callback: () => T | Promise<T>,
  ): Promise<T> {
    return callback()
  }
}

const lockManager = new ImmediateLockManager()

describe('Parent credential portable-data boundaries', () => {
  let parentCredential: StoredParentCredentialRecord

  beforeAll(async () => {
    parentCredential = await createParentCredentialRecordForMigration(binding, '8642', {
      now: () => new Date(NOW),
    })
  })

  it('builds realistic verifier metadata and rejects it at the whole-dataset sanitizer', () => {
    expect(parentCredential).toMatchObject({
      storage: 'device-local-only',
      credentialKind: 'parent-pin',
      verifierScheme: 'pbkdf2-sha256',
      state: 'enrolled',
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

  it('rejects Parent verifier metadata during Parent migration preflight before any write', async () => {
    const storage = new MemoryCredentialStorage()
    const writeIfUnchanged = vi.fn(() => true)
    const read = vi.fn()

    await expect(
      migrateLegacyParentCredential(
        legacyEducationalData({ deviceLocalMaterial: parentCredential }),
        binding,
        {
          storage,
          lockManager,
          educationalDataPersistence: { writeIfUnchanged, read },
        },
      ),
    ).rejects.toBeInstanceOf(CredentialSanitizationError)

    expect(storage.entries()).toEqual([])
    expect(writeIfUnchanged).not.toHaveBeenCalled()
    expect(read).not.toHaveBeenCalled()
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
    for (const forbiddenExport of [
      'enrollParentPin',
      'setParentPin',
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
    ]) {
      expect(Object.hasOwn(credentials, forbiddenExport)).toBe(false)
    }
  })

  it('freezes the Parent domain, device-local namespaces, and attempt-ledger subject shape', () => {
    expect(PARENT_PIN_VERIFIER_DOMAIN).toBe('manuel-academy:parent-pin:v1')
    expect(PARENT_CREDENTIAL_STORAGE_NAMESPACE).toBe(
      'homeschool-hq:security:parent-credentials:v1',
    )
    expect(LEGACY_PARENT_CREDENTIAL_MIGRATION_NAMESPACE).toBe(
      'homeschool-hq:security:parent-pin-migration:v1',
    )

    const subject = parentFailedAttemptSubject(binding)
    expect(subject).toEqual({ kind: 'parent', householdId: HOUSEHOLD_ID })
    expect(Object.keys(subject)).toEqual(['kind', 'householdId'])
    expect(Object.isFrozen(subject)).toBe(true)
  })
})
