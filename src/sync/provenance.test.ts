import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  defaultAppState,
  migrateV1ToV2,
} from '../migration'
import type { AppState } from '../types'
import {
  APP_STATE_STORAGE_KEY,
  canonicalSerialize,
  datasetFingerprint,
  ensureDatasetProvenance,
  persistDatasetVerified,
  readPersistedDataset,
  sha256Hex,
  validateAppStateForSync,
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

describe('platform SHA-256', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    [
      '',
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    ],
    [
      'abc',
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    ],
    [
      'Academy ✓',
      'e7786d000cf8bd226c6fb647cd916915143d7486891141b9a33903633ff0fd5b',
    ],
  ])('hashes the UTF-8 vector %j', async (text, expected) => {
    await expect(sha256Hex(text)).resolves.toBe(expected)
  })

  it('fails closed when platform Web Crypto is unavailable', async () => {
    vi.stubGlobal('crypto', undefined)
    await expect(sha256Hex('Academy')).rejects.toThrow(
      'Web Crypto SHA-256 is unavailable',
    )
  })
})

describe('canonical Academy serialization', () => {
  it('uses deterministic code-unit object-key ordering', () => {
    expect(canonicalSerialize({ '\uE000': 1, '😀': 2, a: 3 })).toBe(
      '{"a":3,"😀":2,"":1}',
    )
  })

  it('treats undefined object properties as deliberately omitted', () => {
    expect(canonicalSerialize({ a: 1, optional: undefined })).toBe(
      canonicalSerialize({ a: 1 }),
    )
  })

  it('preserves array order and rejects undefined array elements', () => {
    expect(canonicalSerialize([1, 2])).not.toBe(canonicalSerialize([2, 1]))
    expect(() => canonicalSerialize([1, undefined])).toThrow(
      'undefined array element',
    )
  })

  it('keeps null distinct and rejects all non-finite numbers', () => {
    expect(canonicalSerialize(null)).toBe('null')
    expect(() => canonicalSerialize(Number.NaN)).toThrow('non-finite')
    expect(() => canonicalSerialize(Number.POSITIVE_INFINITY)).toThrow(
      'non-finite',
    )
    expect(() => canonicalSerialize(Number.NEGATIVE_INFINITY)).toThrow(
      'non-finite',
    )
  })

  it('rejects functions, symbols, accessors, and cyclic values', () => {
    expect(() => canonicalSerialize({ value: () => 1 })).toThrow('unsupported')
    expect(() => canonicalSerialize({ value: Symbol('x') })).toThrow(
      'unsupported',
    )
    const accessor = Object.defineProperty({}, 'value', {
      enumerable: true,
      get: () => 1,
    })
    expect(() => canonicalSerialize(accessor)).toThrow('accessor')
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(() => canonicalSerialize(cyclic)).toThrow('cyclic')
  })
})

describe('persisted Academy dataset provenance', () => {
  let storage: Storage

  beforeEach(() => {
    storage = new MemStorage()
  })

  it('is deterministic for reordered keys and excludes only active UI selection', async () => {
    const left = defaultAppState()
    const right = {
      parentPin: left.parentPin,
      activeProfileId: 'p3',
      profiles: Object.fromEntries(Object.entries(left.profiles).reverse()),
      schemaVersion: left.schemaVersion,
    }
    await expect(datasetFingerprint(right)).resolves.toBe(
      await datasetFingerprint(left),
    )
  })

  it('changes for reordered arrays and meaningful nested profile changes', async () => {
    const before = defaultAppState()
    before.profiles.p1.courses = [
      { id: 'a', name: 'A', units: [] },
      { id: 'b', name: 'B', units: [] },
    ]
    const reordered = structuredClone(before)
    reordered.profiles.p1.courses!.reverse()
    const changed = structuredClone(before)
    changed.profiles.p1.streaks.best += 1
    expect(await datasetFingerprint(reordered)).not.toBe(
      await datasetFingerprint(before),
    )
    expect(await datasetFingerprint(changed)).not.toBe(
      await datasetFingerprint(before),
    )
  })

  it('produces the same fingerprint for an exact duplicate persisted state', async () => {
    const state = defaultAppState()
    expect(await datasetFingerprint(structuredClone(state))).toBe(
      await datasetFingerprint(state),
    )
  })

  it('re-reads and verifies the actual persisted AppState', async () => {
    const state = defaultAppState()
    const result = await persistDatasetVerified(state, storage)
    expect(result).toEqual({
      ok: true,
      state,
      fingerprint: await datasetFingerprint(state),
    })
    expect(await readPersistedDataset(storage)).toEqual(result)
  })

  it('rejects malformed JSON, unsupported versions, and malformed required records', async () => {
    storage.setItem(APP_STATE_STORAGE_KEY, '{broken')
    await expect(readPersistedDataset(storage)).resolves.toMatchObject({
      ok: false,
    })

    storage.setItem(
      APP_STATE_STORAGE_KEY,
      JSON.stringify({ ...defaultAppState(), schemaVersion: 99 }),
    )
    await expect(readPersistedDataset(storage)).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('unsupported schema version'),
    })

    const malformed = defaultAppState() as unknown as {
      profiles: Record<string, Record<string, unknown>>
    }
    delete malformed.profiles.p1.totals
    expect(validateAppStateForSync(malformed)).toMatchObject({ ok: false })
  })

  it('supports a large valid state and a migrated legacy v1 state', async () => {
    const large = defaultAppState()
    for (let index = 0; index < 5_000; index += 1) {
      ;(large.profiles.p1.skills as Record<string, unknown>)[`skill-${index}`] =
        { attempts: index, correct: index, mastery: 50 }
    }
    await expect(datasetFingerprint(large)).resolves.toMatch(/^sha256-v2:/)

    const migrated = migrateV1ToV2({
      version: 1,
      name: 'Legacy student',
      createdAt: '2025-01-01T00:00:00.000Z',
      placementDone: true,
      skillStats: {},
      totals: {
        questionsAnswered: 0,
        correct: 0,
        bestStreak: 0,
        sessions: 0,
      },
    })
    expect(migrated).not.toBeNull()
    await expect(datasetFingerprint(migrated!)).resolves.toMatch(/^sha256-v2:/)
  })

  it('blocks bound metadata for persisted, memory, or import-epoch mismatch', async () => {
    const owned = defaultAppState()
    storage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(owned))
    const provenance = await ensureDatasetProvenance(storage)
    const fingerprint = await datasetFingerprint(owned)
    const meta = {
      ...emptyHouseholdMeta('household-a'),
      binding: 'bound' as const,
      ownsLocalData: true,
      datasetFingerprint: fingerprint,
      importEpoch: provenance.importEpoch,
    }

    const replaced = structuredClone(owned)
    replaced.profiles.p1.name = 'Household B student'
    storage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(replaced))
    await expect(
      verifyOwnedDatasetProvenance(meta, replaced, storage),
    ).resolves.toMatchObject({ ok: false })

    storage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(owned))
    const stale = structuredClone(owned)
    stale.profiles.p2.name = 'Changed in memory'
    await expect(
      verifyOwnedDatasetProvenance(meta, stale, storage),
    ).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('In-memory'),
    })

    await expect(
      verifyOwnedDatasetProvenance(
        { ...meta, importEpoch: 'older-import-generation' },
        owned,
        storage,
      ),
    ).resolves.toMatchObject({ ok: false })
  })

  it('rejects non-finite and cyclic in-memory AppState values', async () => {
    const nonfinite = defaultAppState()
    nonfinite.profiles.p1.totals.sessions = Number.NaN
    await expect(datasetFingerprint(nonfinite)).rejects.toThrow()

    const cyclic = defaultAppState() as AppState & { cycle?: unknown }
    cyclic.cycle = cyclic
    await expect(datasetFingerprint(cyclic)).rejects.toThrow('cyclic')
  })
})
