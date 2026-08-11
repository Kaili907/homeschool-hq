import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
import { withAdminDependencyTimeout } from '../adminDependencyTimeout'
import { parseCurriculumActivationStatus } from '../curriculum-activation/httpSource'
import type { CurriculumActivationStatus } from '../curriculum-activation'
import {
  CurriculumReleaseHistoryError,
  type CurriculumReleaseHistorySource,
  type CurriculumReleaseRegistryCounts,
  type CurriculumReleaseRegistrySummary,
} from './contracts'
import { buildCurriculumReleaseHistoryModel } from './model'

type FetchLike = (input: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>
const VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/
const PACKAGE_ID = /^[a-z0-9][a-z0-9-]{0,119}$/
const COMMIT = /^[0-9a-f]{40}$/
const SOURCE_ROOT = /^curriculum-content\/manuel-academy\/\d+\.\d+\.\d+$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return record(value) && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key))
}

function integer(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function timestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))
}

function counts(value: unknown): CurriculumReleaseRegistryCounts | null {
  const keys = ['courses', 'units', 'lessons', 'assessments', 'texts', 'schedules'] as const
  if (!exact(value, keys) || keys.some((key) => !integer(value[key]))) return null
  return Object.freeze(value as unknown as CurriculumReleaseRegistryCounts)
}

function releaseSummary(value: unknown): CurriculumReleaseRegistrySummary | null {
  if (!exact(value, [
    'packageId', 'version', 'status', 'registeredAt', 'authoredOn', 'provenanceClass',
    'sourceCommit', 'sourceRoot', 'stagingId', 'fileCount', 'byteCount', 'counts',
  ]) || typeof value.packageId !== 'string' || !PACKAGE_ID.test(value.packageId)
    || typeof value.version !== 'string' || !VERSION.test(value.version)
    || value.status !== 'published' || !timestamp(value.registeredAt)
    || (value.authoredOn !== null
      && (typeof value.authoredOn !== 'string' || !DATE.test(value.authoredOn)))
    || !integer(value.fileCount) || value.fileCount < 1
    || !integer(value.byteCount) || value.byteCount < 1) return null
  const projectedCounts = counts(value.counts)
  if (!projectedCounts) return null
  const common = {
    packageId: value.packageId,
    version: value.version,
    status: 'published',
    registeredAt: value.registeredAt,
    authoredOn: value.authoredOn as string | null,
    fileCount: value.fileCount,
    byteCount: value.byteCount,
    counts: projectedCounts,
  } as const
  if (value.provenanceClass === 'legacy_import') {
    if (typeof value.sourceCommit !== 'string' || !COMMIT.test(value.sourceCommit)
      || typeof value.sourceRoot !== 'string' || !SOURCE_ROOT.test(value.sourceRoot)
      || value.sourceRoot !== `curriculum-content/manuel-academy/${value.version}`
      || value.stagingId !== null) return null
    return Object.freeze({
      ...common,
      provenanceClass: 'legacy_import',
      sourceCommit: value.sourceCommit,
      sourceRoot: value.sourceRoot,
      stagingId: null,
    })
  }
  if (value.provenanceClass === 'staged_publish') {
    if (value.sourceCommit !== null || value.sourceRoot !== null
      || typeof value.stagingId !== 'string' || !UUID.test(value.stagingId)) return null
    return Object.freeze({
      ...common,
      provenanceClass: 'staged_publish',
      sourceCommit: null,
      sourceRoot: null,
      stagingId: value.stagingId,
    })
  }
  return null
}

export function parseCurriculumReleaseHistory(value: unknown) {
  if (!exact(value, ['schemaVersion', 'releaseRegistry', 'activation'])
    || value.schemaVersion !== 1
    || !exact(value.releaseRegistry, ['schemaVersion', 'releases'])
    || value.releaseRegistry.schemaVersion !== 1
    || !Array.isArray(value.releaseRegistry.releases)
    || value.releaseRegistry.releases.length > 1_000) {
    throw new CurriculumReleaseHistoryError('unavailable')
  }
  const releases = value.releaseRegistry.releases.map(releaseSummary)
  if (releases.some((release) => release === null)) {
    throw new CurriculumReleaseHistoryError('unavailable')
  }
  let activation: CurriculumActivationStatus
  try {
    activation = parseCurriculumActivationStatus(value.activation)
    return buildCurriculumReleaseHistoryModel(
      releases as CurriculumReleaseRegistrySummary[],
      activation,
    )
  } catch {
    throw new CurriculumReleaseHistoryError('unavailable')
  }
}

export function createCurriculumReleaseHistoryHttpSource(
  fetchImpl: FetchLike = fetch,
  getAccessToken: () => Promise<string | null> = getGatewayAccessToken,
  path = '/api/admin/curriculum/history',
  timeoutMs = 10_000,
): CurriculumReleaseHistorySource {
  const boundedToken = () => withAdminDependencyTimeout(() => getAccessToken(), timeoutMs)
  const boundedFetch: FetchLike = (input, init) => withAdminDependencyTimeout(
    (signal) => fetchImpl(input, { ...init, signal }), timeoutMs,
  )
  return Object.freeze({
    async read() {
      let token: string | null
      try {
        token = await boundedToken()
      } catch {
        throw new CurriculumReleaseHistoryError('unavailable')
      }
      if (!token) throw new CurriculumReleaseHistoryError('unauthenticated')
      let response: Pick<Response, 'ok' | 'status' | 'json'>
      try {
        response = await boundedFetch(path, {
          method: 'GET',
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          cache: 'no-store',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        })
      } catch {
        throw new CurriculumReleaseHistoryError('unavailable')
      }
      if (!response.ok) {
        if (response.status === 401) throw new CurriculumReleaseHistoryError('unauthenticated')
        if (response.status === 403) throw new CurriculumReleaseHistoryError('forbidden')
        throw new CurriculumReleaseHistoryError('unavailable')
      }
      try {
        return parseCurriculumReleaseHistory(await response.json())
      } catch (error) {
        if (error instanceof CurriculumReleaseHistoryError) throw error
        throw new CurriculumReleaseHistoryError('unavailable')
      }
    },
  })
}
