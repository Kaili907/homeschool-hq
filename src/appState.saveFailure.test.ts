import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveAppState } from './appState'
import { defaultAppState } from './migration'
import { MAX_SYNC_ARRAY_ITEMS, APP_STATE_STORAGE_KEY } from './sync/provenance'
import type { ScheduleExtension } from './types'

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

const VALIDATION_ERROR =
  'Stored Academy data is not safe to synchronize: Academy data contains an oversized or sparse array.'

const extensionAt = (index: number): ScheduleExtension => ({
  id: `sx-${index}`,
  label: 'Block',
  days: ['Mon'],
  start: '09:00',
  end: '09:30',
})

describe('saveAppState validation failure signal', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemStorage())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('logs and returns the validator reason without replacing the last-good persisted state', async () => {
    const lastGood = defaultAppState()
    const lastGoodRaw = JSON.stringify(lastGood)
    localStorage.setItem(APP_STATE_STORAGE_KEY, lastGoodRaw)

    const candidate = structuredClone(lastGood)
    candidate.profiles.p1.scheduleExtensions = Array.from(
      { length: MAX_SYNC_ARRAY_ITEMS + 1 },
      (_, index) => extensionAt(index),
    )
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await saveAppState(candidate)

    expect(result).toEqual({
      ok: false,
      error: VALIDATION_ERROR,
      wrote: false,
    })
    expect(consoleError).toHaveBeenCalledWith(
      'Academy changes were not saved.',
      VALIDATION_ERROR,
    )
    expect(localStorage.getItem(APP_STATE_STORAGE_KEY)).toBe(lastGoodRaw)
  })
})
