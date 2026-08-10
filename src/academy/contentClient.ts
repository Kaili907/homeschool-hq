import type { AcademyGrade } from '../types'
import {
  ACADEMY_RELEASE_VERSION,
  type AcademyCatalog,
  type AcademyRelease,
  type AcademySchedule,
  type AcademyUnitChunk,
} from './contentTypes'

/**
 * CURR-1 — lazy, versioned curriculum content loader. Chunks are fetched from
 * /curriculum/<version>/… on demand (one unit at a time) and memoized for the
 * page lifetime, so the app never ships the whole release on initial load.
 * Content is immutable per release version, which makes the cache safe.
 */

const cache = new Map<string, Promise<unknown>>()

async function fetchChunk<T>(path: string): Promise<T> {
  const key = path
  const existing = cache.get(key)
  if (existing) return existing as Promise<T>
  const request = fetch(path).then(async (res) => {
    if (!res.ok) {
      cache.delete(key)
      if (res.status === 504) {
        throw new Error(`pinned curriculum chunk ${path} is unavailable offline`)
      }
      throw new Error(`curriculum chunk ${path}: HTTP ${res.status}`)
    }
    return (await res.json()) as unknown
  }, () => {
    cache.delete(key)
    throw new Error(`pinned curriculum chunk ${path} is unavailable offline`)
  })
  cache.set(key, request)
  request.catch(() => cache.delete(key))
  return request as Promise<T>
}

const base = (version: string) => `/curriculum/${version}`

export function loadRelease(version = ACADEMY_RELEASE_VERSION): Promise<AcademyRelease> {
  return fetchChunk(`${base(version)}/release.json`)
}

export function loadCatalog(
  grade: AcademyGrade,
  version = ACADEMY_RELEASE_VERSION,
): Promise<AcademyCatalog> {
  return fetchChunk(`${base(version)}/grade-${grade}/catalog.json`)
}

export function loadSchedule(
  grade: AcademyGrade,
  version = ACADEMY_RELEASE_VERSION,
): Promise<AcademySchedule> {
  return fetchChunk(`${base(version)}/grade-${grade}/schedule.json`)
}

export function loadUnit(
  courseId: string,
  unitNumber: number,
  version = ACADEMY_RELEASE_VERSION,
): Promise<AcademyUnitChunk> {
  const nn = String(unitNumber).padStart(2, '0')
  return fetchChunk(`${base(version)}/courses/${courseId}/unit-${nn}.json`)
}

/** Test seam: forget every cached chunk. */
export function resetAcademyContentCache(): void {
  cache.clear()
}
