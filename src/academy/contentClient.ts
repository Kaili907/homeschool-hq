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

export type AcademyContentVersionErrorCode = 'unsupported-release' | 'release-mismatch'

/** A bounded, user-safe failure for curriculum content that cannot be used. */
export class AcademyContentVersionError extends Error {
  constructor(
    readonly code: AcademyContentVersionErrorCode,
    readonly requestedVersion: string,
    readonly actualVersion?: string,
  ) {
    super(
      code === 'unsupported-release'
        ? `curriculum release ${requestedVersion} is not supported by this runtime`
        : `curriculum release mismatch: requested ${requestedVersion}, received ${actualVersion ?? 'unknown'}`,
    )
    this.name = 'AcademyContentVersionError'
  }
}

export function isAcademyContentVersionError(
  error: unknown,
): error is AcademyContentVersionError {
  return error instanceof AcademyContentVersionError
}

export function assertSupportedAcademyRelease(version: string): void {
  if (version !== ACADEMY_RELEASE_VERSION) {
    throw new AcademyContentVersionError('unsupported-release', version)
  }
}

async function fetchChunk<T>(path: string): Promise<T> {
  const key = path
  const existing = cache.get(key)
  if (existing) return existing as Promise<T>
  const request = fetch(path).then(async (res) => {
    if (!res.ok) {
      cache.delete(key)
      throw new Error(`curriculum chunk ${path}: HTTP ${res.status}`)
    }
    return (await res.json()) as unknown
  })
  cache.set(key, request)
  request.catch(() => cache.delete(key))
  return request as Promise<T>
}

const base = (version: string) => `/curriculum/${version}`

async function loadVersionedChunk<T extends { releaseVersion: string }>(
  path: string,
  version: string,
): Promise<T> {
  assertSupportedAcademyRelease(version)
  const chunk = await fetchChunk<T>(path)
  if (chunk.releaseVersion !== version) {
    throw new AcademyContentVersionError('release-mismatch', version, chunk.releaseVersion)
  }
  return chunk
}

export function loadRelease(version: string): Promise<AcademyRelease> {
  return loadVersionedChunk(`${base(version)}/release.json`, version)
}

export function loadCatalog(
  grade: AcademyGrade,
  version: string,
): Promise<AcademyCatalog> {
  return loadVersionedChunk(`${base(version)}/grade-${grade}/catalog.json`, version)
}

export function loadSchedule(
  grade: AcademyGrade,
  version: string,
): Promise<AcademySchedule> {
  return loadVersionedChunk(`${base(version)}/grade-${grade}/schedule.json`, version)
}

export function loadUnit(
  courseId: string,
  unitNumber: number,
  version: string,
): Promise<AcademyUnitChunk> {
  const nn = String(unitNumber).padStart(2, '0')
  return loadVersionedChunk(`${base(version)}/courses/${courseId}/unit-${nn}.json`, version)
}

/** Test seam: forget every cached chunk. */
export function resetAcademyContentCache(): void {
  cache.clear()
}
