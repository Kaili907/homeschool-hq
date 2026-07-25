import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  APP_STATE_IMPORT_EVENT,
  importBackup,
  isImportedAppState,
} from '../appState'
import { defaultAppState } from '../migration'
import { emptyHouseholdMeta } from './types'
import {
  APP_STATE_STORAGE_KEY,
  datasetFingerprint,
  verifyOwnedDatasetProvenance,
} from './provenance'

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

describe('binding-aware backup import', () => {
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

  it('backs up current data and signals sync before applying imported state', () => {
    const current = defaultAppState()
    current.profiles.p1.name = 'Household B'
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
    expect(
      [...Array(localStorage.length).keys()]
        .map((index) => localStorage.key(index))
        .some((key) => key?.startsWith('homeschool-hq:backup:import:')),
    ).toBe(true)
    expect(result.note).toContain('remain unbound')
  })

  it('cannot satisfy the currently bound household provenance', () => {
    const current = defaultAppState()
    current.profiles.p1.name = 'Household B'
    localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(current))
    const meta = {
      ...emptyHouseholdMeta('household-b'),
      binding: 'bound' as const,
      ownsLocalData: true,
      datasetFingerprint: datasetFingerprint(current),
    }
    const imported = structuredClone(current)
    imported.profiles.p1.name = 'Household A backup'
    const result = importBackup(current, JSON.stringify(imported))
    if (!result.ok) throw new Error(result.error)
    localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(result.state))

    expect(
      verifyOwnedDatasetProvenance(meta, result.state, localStorage),
    ).toMatchObject({ ok: false })
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
})
