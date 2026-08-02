import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultAppState } from '../migration'
import {
  claimLocalData,
  cleanupLegacySyncStorage,
  beginConfirmedImportInvalidation,
  invalidateAllLocalOwnership,
  legacySyncKeysForTests,
  listOwnershipTransitions,
  loadHouseholdMeta,
  loadOwnershipTransition,
  localDataOwner,
  prepareOwnershipTransition,
  persistOwnershipTransitionDataset,
  replaceDatasetAndClaim,
  recoverOwnershipTransitions,
  recoverDurableImportTransition,
  removeRecreatedLegacySyncKey,
  transitionPrefixForTests,
} from './config'
import {
  APP_STATE_STORAGE_KEY,
  datasetFingerprint,
  ensureDatasetProvenance,
  readDatasetProvenance,
} from './provenance'
import { signOutRemote } from './supabase'
import { emptyHouseholdMeta } from './types'
import { finalizationGuardForTestSetup } from './finalizationGuard.test-helper'

class MemStorage implements Storage {
  protected values = new Map<string, string>()
  get length() {
    return this.values.size
  }
  clear() {
    this.values.clear()
  }
  getItem(key: string) {
    return this.values.get(key) ?? null
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.values.delete(key)
  }
  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

class FaultStorage extends MemStorage {
  failSet: ((key: string, value: string) => boolean) | null = null
  failRemove: ((key: string) => boolean) | null = null

  constructor(source: Storage) {
    super()
    for (let index = 0; index < source.length; index += 1) {
      const key = source.key(index)
      if (key) this.values.set(key, source.getItem(key)!)
    }
  }

  override setItem(key: string, value: string) {
    if (this.failSet?.(key, value)) throw new Error('Injected storage failure')
    super.setItem(key, value)
  }

  override removeItem(key: string) {
    if (this.failRemove?.(key)) return
    super.removeItem(key)
  }
}

describe('crash-safe household ownership recovery', () => {
  let original: ReturnType<typeof defaultAppState>
  let replacement: ReturnType<typeof defaultAppState>

  beforeEach(async () => {
    ;(globalThis as unknown as { localStorage: Storage }).localStorage =
      new MemStorage()
    original = defaultAppState()
    original.profiles.p1.name = 'Household A'
    replacement = structuredClone(original)
    replacement.profiles.p1.name = 'Household B'
    localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(original))
    await ensureDatasetProvenance()
    await claimLocalData(
      'household-a',
      'a@example.com',
      emptyHouseholdMeta('household-a'),
      await datasetFingerprint(original),
      finalizationGuardForTestSetup('household-a'),
    )
  })

  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: Storage }).localStorage
  })

  function prepare() {
    return prepareOwnershipTransition(
      'household-b',
      'b@example.com',
      { ...emptyHouseholdMeta('household-b'), cloudRevision: '1' },
      replacement,
      finalizationGuardForTestSetup('household-b'),
      100,
    )
  }

  function recoveryOptions(
    authenticatedHousehold: string | null,
    inMemoryState = original,
  ) {
    return {
      authenticatedUser: authenticatedHousehold
        ? {
            id: authenticatedHousehold,
            email: `${authenticatedHousehold}@example.com`,
          }
        : null,
      inMemoryState,
      verifyCurrentHousehold: vi.fn(async () => !!authenticatedHousehold),
      lifecycleValid: vi.fn(() => true),
      publish: vi.fn(),
    }
  }

  function transitionStorageKey() {
    return Array.from(
      { length: localStorage.length },
      (_, index) => localStorage.key(index),
    ).find((key) => key?.startsWith(transitionPrefixForTests))!
  }

  it('does not make the target binding durable before AppState persistence', async () => {
    await prepare()
    expect(localDataOwner()?.householdId).toBe('household-a')
    expect(loadHouseholdMeta('household-b').ownsLocalData).toBe(false)
  })

  it('refuses replacement when another tab changes AppState before transition creation', async () => {
    const expected = await datasetFingerprint(original)
    const changed = structuredClone(original)
    changed.profiles.p3.name = 'Changed in another tab'
    localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(changed))

    await expect(
      prepareOwnershipTransition(
        'household-b',
        'b@example.com',
        { ...emptyHouseholdMeta('household-b'), cloudRevision: '1' },
        replacement,
        finalizationGuardForTestSetup('household-b'),
        100,
        expected,
      ),
    ).rejects.toThrow('changed immediately before ownership replacement')
    expect(loadOwnershipTransition('household-b')).toBeNull()
    expect(localDataOwner()?.householdId).toBe('household-a')
  })

  it('recovers a crash after transition creation using the old fingerprint', async () => {
    await prepare()
    expect(
      await recoverOwnershipTransitions(recoveryOptions('household-b')),
    ).toContainEqual({
      kind: 'review',
      householdId: 'household-b',
      reason: expect.stringContaining('before the new dataset was durable'),
    })
    expect(localDataOwner()).toBeNull()
    expect(loadOwnershipTransition('household-b')?.phase).toBe('review')
  })

  it('finishes a crash after AppState write using the new fingerprint', async () => {
    const transition = await prepare()
    await persistOwnershipTransitionDataset(
      transition,
      replacement,
      finalizationGuardForTestSetup('household-b'),
    )
    expect(
      await recoverOwnershipTransitions(
        recoveryOptions('household-b', replacement),
      ),
    ).toContainEqual({
      kind: 'finished-new',
      householdId: 'household-b',
    })
    expect(localDataOwner()?.householdId).toBe('household-b')
    expect(loadHouseholdMeta('household-b').datasetFingerprint).toBe(
      await datasetFingerprint(replacement),
    )
  })

  it('never auto-finalizes a review transition, even for the matching household', async () => {
    await prepare()
    const key = transitionStorageKey()
    const transition = JSON.parse(localStorage.getItem(key)!)
    localStorage.setItem(
      key,
      JSON.stringify({
        ...transition,
        phase: 'review',
        failureReason: 'A controlled security denial requires review.',
      }),
    )

    expect(
      await recoverOwnershipTransitions(recoveryOptions('household-b')),
    ).toContainEqual({
      kind: 'review',
      householdId: 'household-b',
      reason: 'A controlled security denial requires review.',
    })
    expect(loadOwnershipTransition('household-b')?.phase).toBe('review')
    expect(localDataOwner()).toBeNull()
  })

  it('leaves a pending transition unbound on unauthenticated startup', async () => {
    await prepare()
    expect(
      await recoverOwnershipTransitions(recoveryOptions(null)),
    ).toContainEqual({
      kind: 'review',
      householdId: 'household-b',
      reason: expect.stringContaining('Sign in'),
    })
    expect(loadOwnershipTransition('household-b')?.phase).toBe('prepared')
    expect(localDataOwner()).toBeNull()
  })

  it('does not rewrite or remove another household transition', async () => {
    await prepare()
    const before = loadOwnershipTransition('household-b')
    expect(
      await recoverOwnershipTransitions(recoveryOptions('household-c')),
    ).toContainEqual({
      kind: 'review',
      householdId: 'household-b',
      reason: expect.stringContaining('does not match'),
    })
    expect(loadOwnershipTransition('household-b')).toEqual(before)
    expect(localDataOwner()).toBeNull()
  })

  it('treats two transitions for one household as ambiguous', async () => {
    await prepare()
    await prepare()
    expect(listOwnershipTransitions()).toHaveLength(2)
    const result = await recoverOwnershipTransitions(
      recoveryOptions('household-b'),
    )
    expect(result).toHaveLength(2)
    expect(result.every((item) => item.kind === 'review')).toBe(true)
    expect(listOwnershipTransitions()).toHaveLength(2)
    expect(localDataOwner()).toBeNull()
  })

  it('treats transitions for two households as ambiguous without storage-order ownership', async () => {
    await prepare()
    await prepareOwnershipTransition(
      'household-c',
      'c@example.com',
      { ...emptyHouseholdMeta('household-c'), cloudRevision: '1' },
      replacement,
      finalizationGuardForTestSetup('household-c'),
      101,
    )
    const result = await recoverOwnershipTransitions(
      recoveryOptions('household-b'),
    )
    expect(result.map((item) => item.kind)).toEqual(['review', 'review'])
    expect(localDataOwner()).toBeNull()
    expect(listOwnershipTransitions()).toHaveLength(2)
  })

  it('rejects malformed transition metadata without deleting local data', async () => {
    const before = localStorage.getItem(APP_STATE_STORAGE_KEY)
    localStorage.setItem(
      `${transitionPrefixForTests}household-b:malformed`,
      JSON.stringify({
        version: 2,
        transitionId: 'malformed',
        targetHouseholdId: 'household-b',
        phase: 'dataset-written',
      }),
    )
    expect(
      await recoverOwnershipTransitions(recoveryOptions('household-b')),
    ).toContainEqual({
      kind: 'review',
      householdId: 'unknown',
      reason: expect.stringContaining('ambiguous or malformed'),
    })
    expect(localStorage.getItem(APP_STATE_STORAGE_KEY)).toBe(before)
    expect(localDataOwner()).toBeNull()
  })

  it('fails recovery closed when the component unmounts or account changes during verification', async () => {
    const transition = await prepare()
    await persistOwnershipTransitionDataset(
      transition,
      replacement,
      finalizationGuardForTestSetup('household-b'),
    )
    let live = true
    const options = recoveryOptions('household-b', replacement)
    options.lifecycleValid.mockImplementation(() => live)
    options.verifyCurrentHousehold.mockImplementation(async () => {
      live = false
      return true
    })
    expect(await recoverOwnershipTransitions(options)).toContainEqual({
      kind: 'review',
      householdId: 'household-b',
      reason: expect.any(String),
    })
    expect(loadOwnershipTransition('household-b')?.phase).toBe('dataset-written')
    expect(localDataOwner()).toBeNull()
  })

  it('keeps replacement data unbound with a review marker when React publication throws', async () => {
    const expectedFingerprint = await datasetFingerprint(replacement)
    await expect(
      replaceDatasetAndClaim(
        'household-b',
        'b@example.com',
        { ...emptyHouseholdMeta('household-b'), cloudRevision: '1' },
        replacement,
        finalizationGuardForTestSetup('household-b'),
        () => {
          throw new Error('Injected React publication failure')
        },
        await datasetFingerprint(original),
      ),
    ).rejects.toThrow('Injected React publication failure')

    expect(
      await datasetFingerprint(
        JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY)!),
      ),
    ).toBe(expectedFingerprint)
    expect(readDatasetProvenance()?.fingerprint).toBe(expectedFingerprint)
    expect(localDataOwner()).toBeNull()
    expect(loadOwnershipTransition('household-b')?.phase).toBe('review')
    expect(
      await recoverOwnershipTransitions(
        recoveryOptions('household-b', replacement),
      ),
    ).toContainEqual({
      kind: 'review',
      householdId: 'household-b',
      reason: 'Injected React publication failure',
    })
  })

  it('fails closed coherently when the new ownership metadata write fails', async () => {
    const storage = new FaultStorage(localStorage)
    storage.failSet = (key, value) =>
      key.includes('homeschool-hq:sync:household:household-b') &&
      JSON.parse(value).ownsLocalData === true
    ;(globalThis as unknown as { localStorage: Storage }).localStorage = storage

    await expect(
      replaceDatasetAndClaim(
        'household-b',
        'b@example.com',
        { ...emptyHouseholdMeta('household-b'), cloudRevision: '1' },
        replacement,
        finalizationGuardForTestSetup('household-b'),
        undefined,
        await datasetFingerprint(original),
      ),
    ).rejects.toThrow('could not be saved safely')

    expect(
      await datasetFingerprint(
        JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY)!),
      ),
    ).toBe(await datasetFingerprint(replacement))
    expect(readDatasetProvenance()?.fingerprint).toBe(
      await datasetFingerprint(replacement),
    )
    expect(localDataOwner()).toBeNull()
    expect(loadOwnershipTransition('household-b')?.phase).toBe('review')
  })

  it('retains coherent committed ownership when only transition cleanup fails', async () => {
    const storage = new FaultStorage(localStorage)
    storage.failRemove = (key) => key.startsWith(transitionPrefixForTests)
    ;(globalThis as unknown as { localStorage: Storage }).localStorage = storage
    let published = false

    await expect(
      replaceDatasetAndClaim(
        'household-b',
        'b@example.com',
        { ...emptyHouseholdMeta('household-b'), cloudRevision: '1' },
        replacement,
        finalizationGuardForTestSetup('household-b'),
        () => {
          published = true
        },
        await datasetFingerprint(original),
      ),
    ).rejects.toThrow('was not cleared')

    expect(published).toBe(true)
    expect(localDataOwner()?.householdId).toBe('household-b')
    expect(loadOwnershipTransition('household-b')?.phase).toBe('committed')
    expect(readDatasetProvenance()?.fingerprint).toBe(
      loadHouseholdMeta('household-b').datasetFingerprint,
    )
    storage.failRemove = null
    expect(
      await recoverOwnershipTransitions(
        recoveryOptions('household-b', replacement),
      ),
    ).toContainEqual({
      kind: 'finished-new',
      householdId: 'household-b',
    })
    expect(loadOwnershipTransition('household-b')).toBeNull()
  })

  it('fails closed when persisted data matches neither transition fingerprint', async () => {
    await prepare()
    const unknown = structuredClone(replacement)
    unknown.profiles.p2.name = 'Unknown third dataset'
    localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(unknown))

    expect(
      await recoverOwnershipTransitions(
        recoveryOptions('household-b', unknown),
      ),
    ).toContainEqual({
      kind: 'review',
      householdId: 'household-b',
      reason: expect.stringContaining('changed during interrupted recovery'),
    })
    expect(localDataOwner()).toBeNull()
    expect(loadHouseholdMeta('household-a').profiles).toEqual({})
    expect(loadOwnershipTransition('household-b')?.phase).toBe('review')
  })

  it('quarantines an old-dataset pending queue when ownership is invalidated', async () => {
    const a = loadHouseholdMeta('household-a')
    a.profiles.p1 = { updatedAt: 1, dirty: true }
    await claimLocalData(
      'household-a',
      'a@example.com',
      a,
      await datasetFingerprint(original),
      finalizationGuardForTestSetup('household-a'),
    )
    invalidateAllLocalOwnership('Imported data requires review.')
    expect(loadHouseholdMeta('household-a').ownsLocalData).toBe(false)
    expect(loadHouseholdMeta('household-a').profiles.p1.dirty).toBe(false)
  })

  it('recovers an import crash before AppState write without restoring trust', async () => {
    const before = readDatasetProvenance()!
    beginConfirmedImportInvalidation('Import started.')
    expect(readDatasetProvenance()!.importEpoch).not.toBe(before.importEpoch)
    expect(readDatasetProvenance()!.importTransition).not.toBeNull()

    await expect(recoverDurableImportTransition()).resolves.toBe(true)
    expect(readDatasetProvenance()!.importTransition).toBeNull()
    expect(loadHouseholdMeta('household-a').binding).toBe('unbound')
    expect(localDataOwner()).toBeNull()
  })

  it('recovers an import crash after AppState write and keeps the new data unbound', async () => {
    beginConfirmedImportInvalidation('Import started.')
    localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(replacement))

    await expect(recoverDurableImportTransition()).resolves.toBe(true)
    expect(readDatasetProvenance()!.fingerprint).toBe(
      await datasetFingerprint(replacement),
    )
    expect(loadHouseholdMeta('household-a').binding).toBe('unbound')
    expect(localDataOwner()).toBeNull()
  })
})

describe('legacy custom auth cleanup', () => {
  beforeEach(() => {
    ;(globalThis as unknown as { localStorage: Storage }).localStorage =
      new MemStorage()
    localStorage.setItem(
      legacySyncKeysForTests.session,
      JSON.stringify({ access_token: 'old', refresh_token: 'secret' }),
    )
    localStorage.setItem(
      legacySyncKeysForTests.meta,
      JSON.stringify({ binding: 'bound', householdId: 'attacker-value' }),
    )
  })

  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: Storage }).localStorage
  })

  it('removes legacy auth and metadata during upgrade without creating a binding', () => {
    cleanupLegacySyncStorage()
    expect(localStorage.getItem(legacySyncKeysForTests.session)).toBeNull()
    expect(localStorage.getItem(legacySyncKeysForTests.meta)).toBeNull()
    expect(localDataOwner()).toBeNull()
  })

  it('removes the legacy token during official sign-out', async () => {
    const signOut = vi.fn(async () => ({ error: null }))
    await signOutRemote({ auth: { signOut } } as never)
    expect(localStorage.getItem(legacySyncKeysForTests.session)).toBeNull()
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('removes legacy keys recreated by a stale tab without touching official auth', () => {
    const officialKey = 'sb-example-auth-token'
    localStorage.setItem(officialKey, 'official-session')
    cleanupLegacySyncStorage()
    localStorage.setItem(legacySyncKeysForTests.session, 'stale-session')
    localStorage.setItem(legacySyncKeysForTests.meta, 'stale-meta')

    expect(removeRecreatedLegacySyncKey(legacySyncKeysForTests.session)).toBe(
      true,
    )
    expect(removeRecreatedLegacySyncKey(legacySyncKeysForTests.meta)).toBe(true)
    expect(localStorage.getItem(legacySyncKeysForTests.session)).toBeNull()
    expect(localStorage.getItem(legacySyncKeysForTests.meta)).toBeNull()
    expect(localStorage.getItem(officialKey)).toBe('official-session')
  })
})
