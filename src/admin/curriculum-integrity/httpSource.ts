import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
import { withAdminDependencyTimeout } from '../adminDependencyTimeout'
import {
  CURRICULUM_INTEGRITY_STATUSES,
  CurriculumIntegrityError,
  type CurriculumIntegrityGap,
  type CurriculumIntegrityFinding,
  type CurriculumIntegrityReport,
  type CurriculumIntegrityStatus,
  type CurriculumIntegritySource,
  type CurriculumIntegritySubject,
  type CurriculumProvenanceLink,
} from './contracts'

type FetchLike = (input: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const PACKAGE_ID = 'manuel-academy-grades-5-7-8-curriculum-v1'
const STATUS = new Set<string>(CURRICULUM_INTEGRITY_STATUSES)
const LINK_KINDS = ['draft', 'validation', 'approval', 'staging', 'published'] as const
const FINDING_CODES = new Set([
  'metadata_mismatch', 'malformed_evidence', 'artifact_canonical_mismatch',
  'artifact_size_mismatch', 'artifact_hash_mismatch', 'artifact_missing',
  'artifact_extra', 'content_hash_mismatch', 'manifest_canonical_mismatch',
  'manifest_hash_mismatch', 'package_hash_mismatch', 'count_mismatch',
  'provenance_mismatch', 'manifest_mismatch', 'checksum_manifest_mismatch',
])
const GAP_CODES = new Set([
  'malformed_evidence', 'artifact_source_unavailable', 'package_hash_unavailable',
  'draft_provenance_unavailable', 'validation_provenance_unavailable',
  'approval_provenance_unavailable', 'staging_provenance_unavailable',
  'staged_evidence_unavailable', 'published_evidence_unavailable',
])

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return record(value) && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key))
}

function status(value: unknown): value is CurriculumIntegrityStatus {
  return typeof value === 'string' && STATUS.has(value)
}

function count(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}

function fixedFinding(value: unknown): CurriculumIntegrityFinding | null {
  if (!exact(value, ['code', 'subject', 'message']) || typeof value.code !== 'string'
    || !FINDING_CODES.has(value.code) || typeof value.subject !== 'string'
    || value.subject.length === 0 || value.subject.length > 240 || typeof value.message !== 'string'
    || value.message.length > 500) return null
  return Object.freeze({
    code: value.code,
    subject: 'Release evidence',
    message: 'The release evidence does not match its recorded authority.',
  })
}

function fixedGap(value: unknown): CurriculumIntegrityGap | null {
  if (!exact(value, ['code', 'message']) || typeof value.code !== 'string'
    || !GAP_CODES.has(value.code) || typeof value.message !== 'string' || value.message.length > 500) return null
  return Object.freeze({
    code: value.code,
    message: 'Required release evidence is unavailable or cannot be verified.',
  })
}

function parseArray<T>(value: unknown, maximum: number, parse: (entry: unknown) => T | null): readonly T[] | null {
  if (!Array.isArray(value) || value.length > maximum) return null
  const parsed = value.map(parse)
  return parsed.some((entry) => entry === null) ? null : Object.freeze(parsed as T[])
}

function safeLink(value: unknown, expectedKind: typeof LINK_KINDS[number]): CurriculumProvenanceLink | null {
  if (!exact(value, ['kind', 'label', 'status', 'identity', 'detail']) || value.kind !== expectedKind
    || typeof value.label !== 'string' || value.label.length > 160 || !status(value.status)
    || (value.identity !== null && typeof value.identity !== 'string')
    || (value.detail !== null && (typeof value.detail !== 'string' || value.detail.length > 500))) return null
  const identity = value.identity === null ? null : value.identity
  if (identity !== null && (expectedKind === 'published' ? !VERSION.test(identity) : !UUID.test(identity))) return null
  const labels = {
    draft: 'Draft revision', validation: 'Validation', approval: 'Approval',
    staging: 'Staging', published: 'Published release',
  } as const
  return Object.freeze({
    kind: expectedKind,
    label: labels[expectedKind],
    status: value.status,
    identity,
    detail: value.detail === null ? null : 'Additional provenance evidence is recorded.',
  })
}

function statusFor(checks: readonly CurriculumIntegrityStatus[], gaps: readonly CurriculumIntegrityGap[]) {
  if (checks.includes('MISMATCH')) return 'MISMATCH'
  if (gaps.length > 0 || checks.includes('INCOMPLETE')) {
    return checks.includes('VERIFIED') ? 'INCOMPLETE' : 'UNAVAILABLE'
  }
  if (checks.includes('UNVERIFIED')) return 'UNVERIFIED'
  if (checks.length > 0 && checks.every((entry) => entry === 'VERIFIED')) return 'VERIFIED'
  return 'UNAVAILABLE'
}

function safeSubject(value: unknown): CurriculumIntegritySubject | null {
  if (!exact(value, [
    'subjectId', 'kind', 'version', 'state', 'status', 'packageId', 'baseReleaseVersion',
    'schemaSetVersion', 'manifestStatus', 'packageStatus', 'metadataStatus', 'artifacts',
    'provenance', 'mismatches', 'evidenceGaps',
  ]) || !['staged', 'published'].includes(String(value.kind))
    || value.state !== (value.kind === 'staged' ? 'STAGED' : 'PUBLISHED')
    || typeof value.subjectId !== 'string' || typeof value.version !== 'string'
    || !status(value.status) || !status(value.manifestStatus) || !status(value.packageStatus)
    || !status(value.metadataStatus) || (value.packageId !== null && value.packageId !== PACKAGE_ID)
    || (value.baseReleaseVersion !== null && (typeof value.baseReleaseVersion !== 'string'
      || !VERSION.test(value.baseReleaseVersion)))
    || (value.schemaSetVersion !== null && value.schemaSetVersion !== '2.0.0')) return null
  const stagedIdentity = value.subjectId.startsWith('staged:') ? value.subjectId.slice(7) : ''
  const validSubject = value.kind === 'staged'
    ? ((stagedIdentity === 'unavailable' || UUID.test(stagedIdentity))
      && (value.version === 'Unavailable' || VERSION.test(value.version)))
    : value.subjectId === `published:${value.version}` && VERSION.test(value.version)
  if (!validSubject || !exact(value.artifacts, [
    'status', 'expectedCount', 'observedCount', 'verifiedCount',
  ]) || !status(value.artifacts.status)
    || (value.artifacts.expectedCount !== null && !count(value.artifacts.expectedCount))
    || (value.artifacts.observedCount !== null && !count(value.artifacts.observedCount))
    || !count(value.artifacts.verifiedCount)
    || (value.artifacts.observedCount !== null && value.artifacts.verifiedCount > value.artifacts.observedCount)
    || !exact(value.provenance, ['status', 'links'])) return null
  const provenance = value.provenance
  const provenanceLinks = provenance.links
  if (!status(provenance.status) || !Array.isArray(provenanceLinks)
    || provenanceLinks.length !== LINK_KINDS.length) return null
  const links = LINK_KINDS.map((kind, index) => safeLink(provenanceLinks[index], kind))
  const mismatches = parseArray(value.mismatches, 100, fixedFinding)
  const gaps = parseArray(value.evidenceGaps, 100, fixedGap)
  if (links.some((link) => link === null) || !mismatches || !gaps) return null
  const derived = statusFor([
    value.artifacts.status, value.manifestStatus, value.packageStatus,
    value.metadataStatus, provenance.status,
  ], gaps)
  if (value.status !== derived || (value.status === 'MISMATCH' && mismatches.length === 0)
    || (value.status !== 'MISMATCH' && mismatches.length > 0)) return null
  return Object.freeze({
    ...value,
    kind: value.kind,
    state: value.state,
    status: value.status,
    packageId: value.packageId,
    baseReleaseVersion: value.baseReleaseVersion,
    schemaSetVersion: value.schemaSetVersion,
    manifestStatus: value.manifestStatus,
    packageStatus: value.packageStatus,
    metadataStatus: value.metadataStatus,
    artifacts: Object.freeze({ ...value.artifacts }),
    provenance: Object.freeze({ status: provenance.status, links: Object.freeze(links) }),
    mismatches,
    evidenceGaps: gaps,
  }) as unknown as CurriculumIntegritySubject
}

function overallStatus(subjects: readonly CurriculumIntegritySubject[], gaps: readonly CurriculumIntegrityGap[]) {
  const statuses = subjects.map((subject) => subject.status)
  if (statuses.includes('MISMATCH')) return 'MISMATCH'
  if (gaps.length > 0 && statuses.length === 0) return 'UNAVAILABLE'
  if (gaps.length > 0 || statuses.includes('INCOMPLETE')) return 'INCOMPLETE'
  if (statuses.includes('UNAVAILABLE')) return statuses.includes('VERIFIED') ? 'INCOMPLETE' : 'UNAVAILABLE'
  if (statuses.includes('UNVERIFIED')) return 'UNVERIFIED'
  return statuses.length > 0 ? 'VERIFIED' : 'UNAVAILABLE'
}

export function parseCurriculumIntegrityReport(value: unknown): CurriculumIntegrityReport | null {
  if (!exact(value, ['schemaVersion', 'status', 'subjects', 'evidenceGaps', 'readOnly'])
    || value.schemaVersion !== 1 || !status(value.status) || value.readOnly !== true) return null
  const subjects = parseArray(value.subjects, 200, safeSubject)
  const gaps = parseArray(value.evidenceGaps, 100, fixedGap)
  if (!subjects || !gaps || value.status !== overallStatus(subjects, gaps)
    || new Set(subjects.map((subject) => subject.subjectId)).size !== subjects.length) return null
  return Object.freeze({ schemaVersion: 1, status: value.status, subjects, evidenceGaps: gaps, readOnly: true })
}

export function createCurriculumIntegrityHttpSource(
  fetchImpl: FetchLike = fetch,
  getAccessToken: () => Promise<string | null> = getGatewayAccessToken,
  path = '/api/admin/curriculum/integrity',
  timeoutMs = 10_000,
): CurriculumIntegritySource {
  const boundedToken = () => withAdminDependencyTimeout(() => getAccessToken(), timeoutMs)
  const boundedFetch: FetchLike = (input, init) => withAdminDependencyTimeout(
    (signal) => fetchImpl(input, { ...init, signal }), timeoutMs,
  )
  return Object.freeze({
    async readIntegrity() {
      let token: string | null
      try {
        token = await boundedToken()
      } catch {
        throw new CurriculumIntegrityError('unavailable')
      }
      if (!token) throw new CurriculumIntegrityError('unauthenticated')
      let response: Pick<Response, 'ok' | 'status' | 'json'>
      try {
        response = await boundedFetch(path, {
          method: 'GET',
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
        })
      } catch {
        throw new CurriculumIntegrityError('unavailable')
      }
      if (!response.ok) {
        if (response.status === 401) throw new CurriculumIntegrityError('unauthenticated')
        if (response.status === 403) throw new CurriculumIntegrityError('forbidden')
        throw new CurriculumIntegrityError('unavailable')
      }
      try {
        const projected = parseCurriculumIntegrityReport(await response.json())
        if (!projected) throw new CurriculumIntegrityError('unavailable')
        return projected
      } catch {
        throw new CurriculumIntegrityError('unavailable')
      }
    },
  })
}
