import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultAppState } from '../migration'
import { serializeAllBackup } from '../appState'
import { emptyMeta } from '../sync/types'
import { markDirty, pendingRows } from '../sync/engine'
import type { ReadingRecognition } from './recognition'
import { createRecognition } from './recognition'
import {
  azureSpeechConfigured,
  getAzureSpeechKey,
  getAzureSpeechRegion,
  maskAzureSpeechKey,
  requestAzureSpeechToken,
  setAzureSpeechKey,
  setAzureSpeechRegion,
} from './azure'
import {
  readingModeLabel,
  sessionFromAlignment,
  sessionFromAssessment,
} from './fluency'
import { alignReading } from './align'

class MemStorage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
  removeItem(key: string) { this.values.delete(key) }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null }
}

const recognition = (provider: 'azure' | 'browser', supported = true): ReadingRecognition => ({
  provider,
  supported: () => supported,
  start: () => {},
  stop: () => {},
})

describe('Azure recognition selection and fallback', () => {
  it('selects Azure when it is configured and online', () => {
    const selected = createRecognition(
      'azure',
      { referenceText: 'A short passage.' },
      {
        isOnline: () => true,
        azureConfigured: () => true,
        createBrowser: () => recognition('browser'),
        createAzure: () => recognition('azure'),
      },
    )
    expect(selected.provider).toBe('azure')
  })

  it('silently falls back to browser when Azure is unconfigured or offline', () => {
    const base = {
      createBrowser: () => recognition('browser'),
      createAzure: vi.fn(() => recognition('azure')),
    }
    expect(
      createRecognition(
        'azure',
        { referenceText: 'text' },
        { ...base, isOnline: () => true, azureConfigured: () => false },
      ).provider,
    ).toBe('browser')
    expect(
      createRecognition(
        'azure',
        { referenceText: 'text' },
        { ...base, isOnline: () => false, azureConfigured: () => true },
      ).provider,
    ).toBe('browser')
    expect(base.createAzure).not.toHaveBeenCalled()
  })
})

describe('Azure key storage and proxy isolation', () => {
  beforeEach(() => {
    ;(globalThis as unknown as { localStorage: Storage }).localStorage =
      new MemStorage() as unknown as Storage
  })
  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: Storage }).localStorage
  })

  it('keeps key and region in dedicated slots outside backup and sync payloads', () => {
    const secret = 'azure-SUPER-SECRET-key'
    setAzureSpeechKey(secret)
    setAzureSpeechRegion('EastUS')
    expect(azureSpeechConfigured('')).toBe(true)
    expect(getAzureSpeechKey()).toBe(secret)
    expect(getAzureSpeechRegion()).toBe('eastus')
    expect(maskAzureSpeechKey(secret)).not.toContain('SECRET')

    const state = defaultAppState()
    expect(serializeAllBackup(state)).not.toContain(secret)
    const rows = pendingRows(
      state.profiles,
      markDirty(emptyMeta(), Object.keys(state.profiles), Date.now()),
    )
    expect(JSON.stringify(rows)).not.toContain(secret)
  })

  it('proxy token request sends no subscription key from the browser', async () => {
    const fetchImpl = vi.fn(async (
      _url: string,
      _init?: { method?: string; headers?: Record<string, string> },
    ) => ({
      ok: true,
      status: 200,
      json: async () => ({ token: 'short-lived', region: 'eastus' }),
    }))
    await expect(requestAzureSpeechToken('/api/azure-speech', fetchImpl)).resolves.toEqual({
      token: 'short-lived',
      region: 'eastus',
    })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/azure-speech/token')
    expect(init?.headers).toBeUndefined()
  })
})

describe('Azure score persistence and labels', () => {
  it('creates assessed WCPM from per-word accuracy and persists scores, never sound', () => {
    const log = sessionFromAssessment(
      '2026-07-24',
      'g3-01',
      [
        { word: 'Bright', accuracyScore: 92, errorType: 'None' },
        { word: 'river', accuracyScore: 42, errorType: 'Mispronunciation' },
      ],
      60,
    )
    expect(log.mode).toBe('assessed')
    expect(log.wcpm).toBe(1)
    expect(log.wordsPracticed).toEqual(['river'])
    expect(log.wordScores).toHaveLength(2)

    const persisted = JSON.stringify(log).toLowerCase()
    expect(persisted).not.toContain('audio')
    expect(persisted).not.toContain('blob')
    expect(persisted).not.toContain('base64')
  })

  it('distinguishes assessed, estimated, and counted labels', () => {
    const estimated = sessionFromAlignment(
      '2026-07-24',
      'g3-01',
      alignReading('one two', 'one two'),
      60,
    )
    expect(estimated.mode).toBe('estimated')
    expect(readingModeLabel(estimated.mode)).toBe('estimated')
    expect(readingModeLabel('assessed')).toBe('assessed')
    expect(readingModeLabel('manual')).toBe('counted')
  })
})
