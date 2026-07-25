import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultAppState } from '../migration'
import {
  claimLocalData,
  cleanupLegacySyncStorage,
  beginConfirmedImportInvalidation,
  invalidateAllLocalOwnership,
  legacySyncKeysForTests,
  loadHouseholdMeta,
  loadOwnershipTransition,
  localDataOwner,
  prepareOwnershipTransition,
  persistOwnershipTransitionDataset,
  recoverOwnershipTransitions,
  recoverDurableImportTransition,
  removeRecreatedLegacySyncKey,
} from './config'
import {
  APP_STATE_STORAGE_KEY,
  datasetFingerprint,
  ensureDatasetProvenance,
  readDatasetProvenance,
} from './provenance'
import { signOutRemote } from './supabase'
import { emptyHouseholdMeta } from './types'

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
    )
  })

  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: Storage }).localStorage
  })

  function prepare() {
    return prepareOwnershipTransition(
      'household-b',
      'b@example.com',
      emptyHouseholdMeta('household-b'),
      replacement,
      100,
    )
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
        emptyHouseholdMeta('household-b'),
        replacement,
        100,
        expected,
      ),
    ).rejects.toThrow('changed immediately before ownership replacement')
    expect(loadOwnershipTransition('household-b')).toBeNull()
    expect(localDataOwner()?.householdId).toBe('household-a')
  })

  it('recovers a crash after transition creation using the old fingerprint', async () => {
    await prepare()
    expect(await recoverOwnershipTransitions()).toContainEqual({
      kind: 'restored-old',
      householdId: 'household-b',
    })
    expect(localDataOwner()?.householdId).toBe('household-a')
    expect(loadOwnershipTransition('household-b')).toBeNull()
  })

  it('finishes a crash after AppState write using the new fingerprint', async () => {
    const transition = await prepare()
    await persistOwnershipTransitionDataset(transition, replacement)
    expect(await recoverOwnershipTransitions()).toContainEqual({
      kind: 'finished-new',
      householdId: 'household-b',
    })
    expect(localDataOwner()?.householdId).toBe('household-b')
    expect(loadHouseholdMeta('household-b').datasetFingerprint).toBe(
      await datasetFingerprint(replacement),
    )
  })

  it('fails closed when persisted data matches neither transition fingerprint', async () => {
    await prepare()
    const unknown = structuredClone(replacement)
    unknown.profiles.p2.name = 'Unknown third dataset'
    localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(unknown))

    expect(await recoverOwnershipTransitions()).toContainEqual({
      kind: 'review',
      householdId: 'household-b',
      reason: expect.stringContaining('interrupted household transition'),
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
