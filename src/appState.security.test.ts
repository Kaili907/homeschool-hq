import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadAppState } from './appState'
import { defaultAppState } from './migration'
import { APP_STATE_STORAGE_KEY, validateAppStateForSync } from './sync/provenance'

const V1_KEY = 'homeschool-hq:profile:v1'
const QUARANTINE_PREFIX = 'homeschool-hq:quarantine:app:'

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

function quarantineValues(): string[] {
  return Array.from({ length: localStorage.length }, (_, index) =>
    localStorage.key(index),
  )
    .filter((key): key is string => !!key?.startsWith(QUARANTINE_PREFIX))
    .map((key) => localStorage.getItem(key)!)
}

describe('bounded AppState loading and migration', () => {
  beforeEach(() => {
    ;(globalThis as unknown as { localStorage: Storage }).localStorage =
      new MemStorage()
  })

  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: Storage }).localStorage
  })

  it('quarantines malformed persisted V2 JSON instead of publishing it', () => {
    const raw = '{"schemaVersion":2,"profiles":'
    localStorage.setItem(APP_STATE_STORAGE_KEY, raw)

    const loaded = loadAppState()

    expect(loaded.recoveryError).toContain('preserved for recovery')
    expect(quarantineValues()).toContain(raw)
    expect(validateAppStateForSync(loaded.state)).toMatchObject({ ok: true })
  })

  it.each([
    ['malformed nested value', (state: ReturnType<typeof defaultAppState>) => {
      ;(state.profiles.p1.totals as unknown as Record<string, unknown>).sessions =
        null
    }],
    ['invalid date', (state: ReturnType<typeof defaultAppState>) => {
      state.profiles.p1.missions['2026-02-30'] = { items: [] }
    }],
    ['mixed valid data with one unsupported field', (state: ReturnType<typeof defaultAppState>) => {
      ;(state.profiles.p1 as unknown as Record<string, unknown>).additive = {
        constructor: { unsafe: true },
      }
    }],
  ])('quarantines persisted V2 state with %s', (_label, mutate) => {
    const state = defaultAppState()
    mutate(state)
    const raw = JSON.stringify(state)
    localStorage.setItem(APP_STATE_STORAGE_KEY, raw)

    const loaded = loadAppState()

    expect(loaded.recoveryError).toBeDefined()
    expect(quarantineValues()).toContain(raw)
    expect(loaded.state).not.toEqual(state)
  })

  it('quarantines sparse-array and excessive-depth V2 encodings', () => {
    const sparse = defaultAppState()
    sparse.profiles.p1.tutorCalls = new Array(2)
    const sparseRaw = JSON.stringify(sparse)
    localStorage.setItem(APP_STATE_STORAGE_KEY, sparseRaw)
    const sparseLoaded = loadAppState()
    expect(sparseLoaded.recoveryError).toBeDefined()
    expect(quarantineValues()).toContain(sparseRaw)

    const deep = defaultAppState() as unknown as Record<string, unknown>
    let cursor = deep
    for (let index = 0; index < 140; index += 1) {
      const next: Record<string, unknown> = {}
      cursor.additive = next
      cursor = next
    }
    const deepRaw = JSON.stringify(deep)
    localStorage.setItem(APP_STATE_STORAGE_KEY, deepRaw)
    const loaded = loadAppState()
    expect(loaded.recoveryError).toBeDefined()
    expect(quarantineValues()).toContain(deepRaw)
    expect(sparseRaw).not.toBe(deepRaw)
  })

  it('validates a V1 migration fully before persistence or React publication', () => {
    const malformedLegacy = JSON.stringify({
      version: 1,
      name: 'Legacy student',
      createdAt: '2025-01-01T00:00:00.000Z',
      placementDone: true,
      skillStats: {
        malformed: { attempts: 'many', correct: 0, mastery: 20 },
      },
      totals: {
        questionsAnswered: 0,
        correct: 0,
        bestStreak: 0,
        sessions: 0,
      },
    })
    localStorage.setItem(V1_KEY, malformedLegacy)

    const loaded = loadAppState()

    expect(loaded.migrated).toBe(false)
    expect(loaded.recoveryError).toContain('could not be migrated safely')
    expect(quarantineValues()).toContain(malformedLegacy)
    expect(localStorage.getItem(V1_KEY)).toBe(malformedLegacy)
    expect(validateAppStateForSync(loaded.state)).toMatchObject({ ok: true })
  })

  it('persists the guarded v2 identity correction without a recovery reset', () => {
    const legacy = defaultAppState()
    delete legacy.learnerIdentityVersion
    legacy.profiles.p3 = {
      ...legacy.profiles.p3,
      name: '6th Grader',
      grade: '6',
      pin: '4321',
      workingLevels: { mathematics: '5' },
      totals: { questionsAnswered: 18, correct: 14, bestStreak: 4, sessions: 2 },
    }
    legacy.profiles.p2 = { ...legacy.profiles.p2, name: 'Custom Name' }
    localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(legacy))

    const loaded = loadAppState()
    const persisted = JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY)!)

    expect(loaded.recoveryError).toBeUndefined()
    expect(loaded.migrated).toBe(false)
    expect(loaded.state.profiles.p3).toMatchObject({
      id: 'p3', name: 'Stephanie Manuel', grade: '7', pin: '4321',
      workingLevels: { mathematics: '5' },
      totals: { questionsAnswered: 18, correct: 14, bestStreak: 4, sessions: 2 },
    })
    expect(loaded.state.profiles.p2.name).toBe('Custom Name')
    expect(persisted).toEqual(loaded.state)
  })
})

describe('Study Engine state isolation', () => {
  it('keeps provisional Study evidence and adult-private fields out of AppState', () => {
    const serialized = JSON.stringify(defaultAppState())
    expect(serialized).not.toMatch(/studyCheckpoint|studyEvidence|adultPrivate|rawAnswer|transcript/i)
  })
})
