import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadRelease, resetAcademyContentCache } from './contentClient'

describe('Academy pinned curriculum content client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    resetAcademyContentCache()
  })

  it('keeps simulated curriculum versions independently keyed', async () => {
    const fetchMock = vi.fn(async (path: string) => ({
      ok: true,
      json: async () => ({ releaseVersion: path.split('/')[2] }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(loadRelease('release-A')).resolves.toMatchObject({ releaseVersion: 'release-A' })
    await expect(loadRelease('release-B')).resolves.toMatchObject({ releaseVersion: 'release-B' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('reports a service-worker offline miss as unavailable pinned content', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 504 })))

    await expect(loadRelease('1.0.0')).rejects.toThrow(
      'pinned curriculum chunk /curriculum/1.0.0/release.json is unavailable offline',
    )
  })

  it('reports a direct network failure without falling back to another release', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))

    await expect(loadRelease('release-A')).rejects.toThrow(
      'pinned curriculum chunk /curriculum/release-A/release.json is unavailable offline',
    )
  })
})
