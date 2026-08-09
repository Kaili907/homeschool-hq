import { describe, expect, it, vi } from 'vitest'
import { createVoiceCatalogAccess } from './voiceCatalog'

function projection(overrides: Record<string, unknown> = {}) {
  return {
    catalogVersion: 'test-v1',
    synthesisEnabled: true,
    defaultVoiceRef: 'academy.tts.synthetic',
    voices: [{
      voiceRef: 'academy.tts.synthetic', voiceVersion: 'v1',
      displayLabel: 'Synthetic', providerClass: 'premium', status: 'active',
      deploymentAvailable: true, cachedPlaybackAllowed: true,
    }],
    ...overrides,
  }
}

describe('sanitized TTS catalog client', () => {
  it('uses authenticated GET and resolves only an exact logical ref/version', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true, status: 200, json: async () => projection(),
    }))
    const catalog = createVoiceCatalogAccess({
      getAccessToken: async () => 'access-token', fetchImpl,
    })
    await expect(catalog.resolve('academy.tts.synthetic', 'v1')).resolves.toMatchObject({
      voiceRef: 'academy.tts.synthetic', voiceVersion: 'v1', synthesisEnabled: true,
    })
    await expect(catalog.resolve('academy.tts.synthetic', 'stale')).resolves.toBeNull()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledWith('/api/tts/catalog', {
      method: 'GET', headers: { Authorization: 'Bearer access-token' },
    })
  })

  it('fails closed for unknown projection keys or missing auth', async () => {
    const extraKey = createVoiceCatalogAccess({
      getAccessToken: async () => 'access-token',
      fetchImpl: async () => ({
        ok: true, status: 200, json: async () => projection({ mapping: 'private' }),
      }),
    })
    expect((await extraKey.load()).voices).toEqual([])

    const fetchImpl = vi.fn()
    const signedOut = createVoiceCatalogAccess({ getAccessToken: async () => null, fetchImpl })
    expect((await signedOut.load()).synthesisEnabled).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
