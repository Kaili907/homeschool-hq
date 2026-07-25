import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  APP_STATE_IMPORT_EVENT,
  importBackup,
  isImportedAppState,
  saveAppState,
} from '../appState'
import { defaultAppState } from '../migration'
import {
  claimLocalData,
  loadHouseholdMeta,
} from './config'
import {
  APP_STATE_STORAGE_KEY,
  datasetFingerprint,
  ensureDatasetProvenance,
  readDatasetProvenance,
  verifyOwnedDatasetProvenance,
} from './provenance'
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

describe('durable binding-aware backup import', () => {
  let eventTarget: EventTarget

  beforeEach(() => {
    ;(globalThis as unknown as { localStorage: Storage }).localStorage =
      new MemStorage()
    eventTarget = new EventTarget()
    ;(globalThis as unknown as { window: EventTarget }).window = eventTarget
  })

  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: Storage }).localStorage
    delete (globalThis as unknown as { window?: EventTarget }).window
  })

  async function bindCurrent() {
    const current = defaultAppState()
    localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(current))
    await ensureDatasetProvenance()
    await claimLocalData(
      'household-b',
      'b@example.com',
      emptyHouseholdMeta('household-b'),
      await datasetFingerprint(current),
      finalizationGuardForTestSetup('household-b'),
    )
    return current
  }

  it('backs up and durably invalidates sync before exposing imported state', async () => {
    const current = await bindCurrent()
    const imported = structuredClone(current)
    imported.profiles.p1.name = 'Household A backup'
    const listener = vi.fn()
    eventTarget.addEventListener(APP_STATE_IMPORT_EVENT, listener)

    const result = importBackup(current, JSON.stringify(imported))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const replacement = result.state
    expect(listener).toHaveBeenCalledOnce()
    expect(isImportedAppState(replacement)).toBe(true)
    expect(loadHouseholdMeta('household-b').ownsLocalData).toBe(false)
    expect(readDatasetProvenance()?.importTransition).not.toBeNull()
    expect(
      [...Array(localStorage.length).keys()]
        .map((index) => localStorage.key(index))
        .some((key) => key?.startsWith('homeschool-hq:backup:import:')),
    ).toBe(true)

    await saveAppState(replacement)
    expect(readDatasetProvenance()?.importTransition).toBeNull()
    expect(loadHouseholdMeta('household-b').binding).toBe('unbound')
  })

  it('invalidates an exact-value import and remains unbound after persistence/reload', async () => {
    const current = await bindCurrent()
    const before = readDatasetProvenance()!
    const result = importBackup(current, JSON.stringify(current))
    if (!result.ok) throw new Error(result.error)
    const replacement = result.state
    const during = readDatasetProvenance()!

    expect(during.importEpoch).not.toBe(before.importEpoch)
    expect(loadHouseholdMeta('household-b').ownsLocalData).toBe(false)
    await saveAppState(replacement)

    expect(readDatasetProvenance()?.importEpoch).toBe(during.importEpoch)
    expect(readDatasetProvenance()?.importTransition).toBeNull()
    expect(loadHouseholdMeta('household-b').binding).toBe('unbound')
  })

  it('invalidates activeProfileId-only imports despite an equal dataset fingerprint', async () => {
    const current = await bindCurrent()
    const imported = { ...current, activeProfileId: 'p2' }
    expect(await datasetFingerprint(imported)).toBe(
      await datasetFingerprint(current),
    )
    const beforeEpoch = readDatasetProvenance()!.importEpoch
    const result = importBackup(current, JSON.stringify(imported))
    if (!result.ok) throw new Error(result.error)
    const replacement = result.state

    expect(readDatasetProvenance()!.importEpoch).not.toBe(beforeEpoch)
    expect(loadHouseholdMeta('household-b').ownsLocalData).toBe(false)
    await saveAppState(replacement)
    expect(loadHouseholdMeta('household-b').binding).toBe('unbound')
  })

  it('cannot satisfy the previously bound household provenance', async () => {
    const current = await bindCurrent()
    const oldMeta = {
      ...loadHouseholdMeta('household-b'),
    }
    const imported = structuredClone(current)
    imported.profiles.p1.name = 'Household A backup'
    const result = importBackup(current, JSON.stringify(imported))
    if (!result.ok) throw new Error(result.error)
    const replacement = result.state
    await saveAppState(replacement)

    await expect(
      verifyOwnedDatasetProvenance(oldMeta, replacement, localStorage),
    ).resolves.toMatchObject({ ok: false })
  })

  it('prevents destructive import when the safety backup cannot be written', () => {
    const storage = new MemStorage()
    storage.setItem = (key: string, value: string) => {
      if (key.startsWith('homeschool-hq:backup:import:')) {
        throw new Error('quota exceeded')
      }
      MemStorage.prototype.setItem.call(storage, key, value)
    }
    ;(globalThis as unknown as { localStorage: Storage }).localStorage = storage
    const current = defaultAppState()

    expect(importBackup(current, JSON.stringify(current))).toEqual({
      ok: false,
      error:
        'A local safety backup could not be created, so no data was imported.',
    })
  })

  it('rejects malformed v2 backup data before ownership invalidation', async () => {
    const current = await bindCurrent()
    const malformed = structuredClone(current) as unknown as {
      profiles: Record<string, Record<string, unknown>>
    }
    delete malformed.profiles.p1.totals
    const beforeEpoch = readDatasetProvenance()!.importEpoch

    expect(importBackup(current, JSON.stringify(malformed))).toEqual({
      ok: false,
      error: 'That file is not a Homeschool HQ backup.',
    })
    expect(readDatasetProvenance()!.importEpoch).toBe(beforeEpoch)
    expect(loadHouseholdMeta('household-b').binding).toBe('bound')
  })
})
