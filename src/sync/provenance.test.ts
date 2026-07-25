import { beforeEach, describe, expect, it } from 'vitest'
import { defaultAppState } from '../migration'
import {
  APP_STATE_STORAGE_KEY,
  datasetFingerprint,
  persistDatasetVerified,
  readPersistedDataset,
  verifyOwnedDatasetProvenance,
} from './provenance'
import { emptyHouseholdMeta } from './types'

class MemStorage implements Storage {
  private values = new Map<string, string>()
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

describe('persisted Academy dataset provenance', () => {
  let storage: Storage

  beforeEach(() => {
    storage = new MemStorage()
  })

  it('is deterministic for equivalent data and ignores only active UI selection', () => {
    const left = defaultAppState()
    const right = {
      parentPin: left.parentPin,
      activeProfileId: 'p3',
      profiles: Object.fromEntries(Object.entries(left.profiles).reverse()),
      schemaVersion: left.schemaVersion,
    }
    expect(datasetFingerprint(right)).toBe(datasetFingerprint(left))
  })

  it('changes whenever profile data changes', () => {
    const before = defaultAppState()
    const after = structuredClone(before)
    after.profiles.p1.name = 'Different student'
    expect(datasetFingerprint(after)).not.toBe(datasetFingerprint(before))
  })

  it('re-reads and verifies the actual persisted AppState', () => {
    const state = defaultAppState()
    const result = persistDatasetVerified(state, storage)
    expect(result).toEqual({
      ok: true,
      state,
      fingerprint: datasetFingerprint(state),
    })
    expect(readPersistedDataset(storage)).toEqual(result)
  })

  it('blocks bound metadata when persisted AppState has another fingerprint', () => {
    const owned = defaultAppState()
    storage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(owned))
    const meta = {
      ...emptyHouseholdMeta('household-a'),
      binding: 'bound' as const,
      ownsLocalData: true,
      datasetFingerprint: datasetFingerprint(owned),
    }
    const replaced = structuredClone(owned)
    replaced.profiles.p1.name = 'Household B student'
    storage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(replaced))

    expect(verifyOwnedDatasetProvenance(meta, replaced, storage)).toEqual({
      ok: false,
      error: 'Persisted Academy data differs from household ownership.',
    })
  })

  it('blocks a stale tab whose memory differs from persisted AppState', () => {
    const stale = defaultAppState()
    const persisted = structuredClone(stale)
    persisted.profiles.p2.name = 'Changed in another tab'
    storage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(persisted))
    const meta = {
      ...emptyHouseholdMeta('household-a'),
      binding: 'bound' as const,
      ownsLocalData: true,
      datasetFingerprint: datasetFingerprint(persisted),
    }

    expect(verifyOwnedDatasetProvenance(meta, stale, storage)).toEqual({
      ok: false,
      error: 'In-memory Academy data differs from persisted Academy data.',
    })
  })
})
