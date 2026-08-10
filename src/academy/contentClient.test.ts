import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  loadCatalog,
  loadSchedule,
  loadUnit,
  resetAcademyContentCache,
} from './contentClient'

describe('Academy versioned content client', () => {
  afterEach(() => {
    resetAcademyContentCache()
    vi.unstubAllGlobals()
  })

  it('requires and uses the explicit release for catalog, schedule, and unit paths', async () => {
    const seen: string[] = []
    vi.stubGlobal('fetch', vi.fn((path: string) => {
      seen.push(path)
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ releaseVersion: '1.0.0' }),
      })
    }))

    await Promise.all([
      loadCatalog('5', '1.0.0'),
      loadSchedule('5', '1.0.0'),
      loadUnit('ma-g5-mathematics', 1, '1.0.0'),
    ])

    expect(seen.sort()).toEqual([
      '/curriculum/1.0.0/courses/ma-g5-mathematics/unit-01.json',
      '/curriculum/1.0.0/grade-5/catalog.json',
      '/curriculum/1.0.0/grade-5/schedule.json',
    ])
  })

  it.each([
    ['catalog', () => loadCatalog('5', '1.0.0')],
    ['schedule', () => loadSchedule('5', '1.0.0')],
    ['unit', () => loadUnit('ma-g5-mathematics', 1, '1.0.0')],
  ])('rejects a %s payload from a different release', async (_kind, load) => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ releaseVersion: '0.9.0' }),
    })))

    await expect(load()).rejects.toMatchObject({
      code: 'release-mismatch',
      requestedVersion: '1.0.0',
      actualVersion: '0.9.0',
    })
  })

  it('rejects an unsupported release without requesting the current release', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(loadCatalog('5', '2.0.0')).rejects.toMatchObject({
      code: 'unsupported-release',
      requestedVersion: '2.0.0',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
