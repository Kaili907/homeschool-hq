import { describe, expect, it } from 'vitest'
import {
  FAMILY_PILOT_QUARANTINE_KEY,
  FAMILY_PILOT_STATE_KEY,
  loadFamilyPilotState,
  resetFamilyPilotState,
  saveFamilyPilotState,
  updateFamilyPilotState,
} from './store'
import { emptyFamilyPilotState } from './schema'
import { createFamilyPilotStudent, findFamilyPilotStudent } from './operations'

const NOW = '2026-08-12T09:00:00.000Z'
const LATER = '2026-08-12T11:00:00.000Z'

// The root-app project runs in Node and tests/node-test-setup.ts deletes
// globalThis.localStorage, so every test supplies its own Storage.
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
    this.values.set(key, String(value))
  }
}

function options(storage: Storage, now = NOW) {
  return { storage, now: () => now }
}

describe('family pilot store', () => {
  it('reads an absent key as a ready, empty state', () => {
    const snapshot = loadFamilyPilotState(options(new MemStorage()))
    expect(snapshot.status).toBe('ready')
    expect(snapshot.state.students).toEqual([])
  })

  it('round-trips saved state', () => {
    const storage = new MemStorage()
    const state = createFamilyPilotStudent(
      emptyFamilyPilotState(NOW), { studentRef: 'student:ada', displayName: 'Ada' }, NOW,
    )
    expect(saveFamilyPilotState(state, options(storage)).status).toBe('ready')
    expect(loadFamilyPilotState(options(storage)).state).toEqual(state)
  })

  it('keeps two students separated across a save and reload', () => {
    const storage = new MemStorage()
    let state = createFamilyPilotStudent(
      emptyFamilyPilotState(NOW), { studentRef: 'student:ada', displayName: 'Ada' }, NOW,
    )
    state = createFamilyPilotStudent(state, { studentRef: 'student:bo', displayName: 'Bo' }, NOW)
    saveFamilyPilotState(state, options(storage))
    const reloaded = loadFamilyPilotState(options(storage)).state
    expect(findFamilyPilotStudent(reloaded, 'student:ada')?.displayName).toBe('Ada')
    expect(findFamilyPilotStudent(reloaded, 'student:bo')?.displayName).toBe('Bo')
  })

  it('recovers from unparseable JSON and quarantines the original', () => {
    const storage = new MemStorage()
    storage.setItem(FAMILY_PILOT_STATE_KEY, '{not json')
    const snapshot = loadFamilyPilotState(options(storage))
    expect(snapshot.status).toBe('recovered')
    expect(snapshot.reasonCode).toBe('schema-unreadable')
    expect(snapshot.state.students).toEqual([])
    expect(storage.getItem(FAMILY_PILOT_QUARANTINE_KEY)).toBe('{not json')
  })

  it('recovers from structurally invalid state', () => {
    const storage = new MemStorage()
    storage.setItem(FAMILY_PILOT_STATE_KEY, JSON.stringify({ schemaVersion: 1, students: 'no' }))
    expect(loadFamilyPilotState(options(storage)).status).toBe('recovered')
  })

  it('preserves the first quarantined copy across repeated corruption', () => {
    const storage = new MemStorage()
    storage.setItem(FAMILY_PILOT_STATE_KEY, 'first-corruption')
    loadFamilyPilotState(options(storage))
    storage.setItem(FAMILY_PILOT_STATE_KEY, 'second-corruption')
    loadFamilyPilotState(options(storage))
    expect(storage.getItem(FAMILY_PILOT_QUARANTINE_KEY)).toBe('first-corruption')
  })

  it('refuses to overwrite state written by a newer build', () => {
    const storage = new MemStorage()
    const future = JSON.stringify({ schemaVersion: 99, updatedAt: NOW, students: [] })
    storage.setItem(FAMILY_PILOT_STATE_KEY, future)
    const snapshot = loadFamilyPilotState(options(storage))
    expect(snapshot.status).toBe('read-only')
    expect(snapshot.reasonCode).toBe('schema-version-ahead')

    // The mutation is declined and the newer payload is left exactly as it was.
    const attempted = updateFamilyPilotState(
      (state) => createFamilyPilotStudent(state, { studentRef: 'student:x', displayName: 'X' }, NOW),
      options(storage),
    )
    expect(attempted.status).toBe('read-only')
    expect(storage.getItem(FAMILY_PILOT_STATE_KEY)).toBe(future)
  })

  it('reports unavailable storage without throwing', () => {
    const denied = {
      getItem() { throw new Error('denied') },
      setItem() { throw new Error('denied') },
      removeItem() { throw new Error('denied') },
    }
    const snapshot = loadFamilyPilotState({ storage: denied, now: () => NOW })
    expect(snapshot.status).toBe('unavailable')
    expect(snapshot.reasonCode).toBe('storage-unavailable')
  })

  it('reports a write that does not land as unavailable', () => {
    // A quota-exceeded write that silently stores nothing must not read back as
    // saved work; the read-back check is what catches it.
    const storage = new MemStorage()
    const lying = {
      getItem: (key: string) => storage.getItem(key),
      setItem: () => {},
      removeItem: (key: string) => storage.removeItem(key),
    }
    const result = saveFamilyPilotState(emptyFamilyPilotState(NOW), { storage: lying, now: () => NOW })
    expect(result.status).toBe('unavailable')
    expect(result.reasonCode).toBe('storage-write-failed')
  })

  it('stamps updatedAt on update and persists the result', () => {
    const storage = new MemStorage()
    saveFamilyPilotState(emptyFamilyPilotState(NOW), options(storage))
    const updated = updateFamilyPilotState(
      (state) => createFamilyPilotStudent(state, { studentRef: 'student:ada', displayName: 'Ada' }, LATER),
      options(storage, LATER),
    )
    expect(updated.status).toBe('ready')
    expect(updated.state.updatedAt).toBe(LATER)
    expect(loadFamilyPilotState(options(storage)).state.students).toHaveLength(1)
  })

  it('keeps reporting recovered after a post-corruption write', () => {
    // The household must be told its history was reset, even though the
    // subsequent write succeeded.
    const storage = new MemStorage()
    storage.setItem(FAMILY_PILOT_STATE_KEY, '{not json')
    const updated = updateFamilyPilotState(
      (state) => createFamilyPilotStudent(state, { studentRef: 'student:ada', displayName: 'Ada' }, NOW),
      options(storage),
    )
    expect(updated.status).toBe('recovered')
    expect(loadFamilyPilotState(options(storage)).state.students).toHaveLength(1)
  })

  it('reset clears state and quarantine', () => {
    const storage = new MemStorage()
    storage.setItem(FAMILY_PILOT_STATE_KEY, '{not json')
    loadFamilyPilotState(options(storage))
    expect(storage.getItem(FAMILY_PILOT_QUARANTINE_KEY)).not.toBeNull()

    const reset = resetFamilyPilotState(options(storage))
    expect(reset.status).toBe('ready')
    expect(reset.state.students).toEqual([])
    expect(storage.getItem(FAMILY_PILOT_QUARANTINE_KEY)).toBeNull()
    expect(loadFamilyPilotState(options(storage)).status).toBe('ready')
  })
})
