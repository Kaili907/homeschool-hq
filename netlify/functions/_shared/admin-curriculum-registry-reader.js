import { createClient } from '@supabase/supabase-js'

const READ_TIMEOUT_MS = 5_000
const HASH = /^[0-9a-f]{64}$/
const COMMIT = /^[0-9a-f]{40}$/
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.-]+)?$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PACKAGE_ID = /^[a-z0-9][a-z0-9-]{0,119}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const SOURCE_ROOT = /^curriculum-content\/manuel-academy\/[0-9]+\.[0-9]+\.[0-9]+$/
const FILE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.?(?:\/|$))(?!.*\/\/)(?!.*\\).+$/
const LOCATOR = /^git_commit_path:[0-9a-f]{40}:curriculum-content\/manuel-academy\/[0-9]+\.[0-9]+\.[0-9]+\/.+$/
const REGISTRY_LOCATOR = /^curriculum_registry:[0-9a-f-]{36}:snapshot\/[a-z][a-z_]{0,63}\.json$/
const CONTENT_TYPES = new Set([
  'application/json',
  'application/x-ndjson',
  'text/csv;charset=utf-8',
  'text/markdown;charset=utf-8',
  'text/plain;charset=utf-8',
])

function serviceConfig(env) {
  const rawUrl = (env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || '').trim()
  const serviceRoleKey = (env?.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' || url.username || url.password || !serviceRoleKey) return null
    return { url: url.toString().replace(/\/+$/, ''), serviceRoleKey }
  } catch {
    return null
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function integer(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}

function timestamp(value) {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))
    ? value
    : null
}

function counts(value) {
  if (!isRecord(value)) return null
  const projected = {
    courses: integer(value.courses), units: integer(value.units), lessons: integer(value.lessons),
    assessments: integer(value.assessments), texts: integer(value.texts), schedules: integer(value.schedules),
  }
  return Object.values(projected).some((item) => item === null) ? null : Object.freeze(projected)
}

function summary(value) {
  if (
    !isRecord(value)
    || typeof value.packageId !== 'string'
    || !PACKAGE_ID.test(value.packageId)
    || typeof value.version !== 'string'
    || !VERSION.test(value.version)
    || value.status !== 'published'
    || timestamp(value.registeredAt) === null
    || (value.authoredOn !== null && (typeof value.authoredOn !== 'string' || !DATE.test(value.authoredOn)))
    || !['legacy_import', 'staged_publish'].includes(value.provenanceClass)
    || integer(value.fileCount) === null
    || integer(value.byteCount) === null
  ) return null
  const legacy = value.provenanceClass === 'legacy_import'
  if (
    (legacy && (
      typeof value.sourceCommit !== 'string' || !COMMIT.test(value.sourceCommit)
      || typeof value.sourceRoot !== 'string' || !SOURCE_ROOT.test(value.sourceRoot)
      || (value.stagingId !== undefined && value.stagingId !== null)
    ))
    || (!legacy && (
      value.sourceCommit !== null || value.sourceRoot !== null
      || typeof value.stagingId !== 'string' || !UUID.test(value.stagingId)
    ))
  ) return null
  const projectedCounts = counts(value.counts)
  if (!projectedCounts) return null
  return Object.freeze({
    packageId: value.packageId,
    version: value.version,
    status: value.status,
    registeredAt: value.registeredAt,
    authoredOn: value.authoredOn,
    provenanceClass: value.provenanceClass,
    sourceCommit: value.sourceCommit,
    sourceRoot: value.sourceRoot,
    stagingId: value.stagingId ?? null,
    fileCount: value.fileCount,
    byteCount: value.byteCount,
    counts: projectedCounts,
  })
}

function adaptList(value) {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.releases) || value.releases.length > 1000) return null
  const releases = value.releases.map(summary)
  if (releases.some((release) => release === null)) return null
  return Object.freeze({ schemaVersion: 1, releases: Object.freeze(releases) })
}

function adaptDetails(value) {
  const release = summary(value)
  if (!release || value.schemaVersion !== 1 || !isRecord(value.digests) || !isRecord(value.gradeCounts) || !Array.isArray(value.files)) return null
  const digests = {
    packageManifestSha256: value.digests.packageManifestSha256,
    checksumManifestSha256: value.digests.checksumManifestSha256,
    curriculumManifestSha256: value.digests.curriculumManifestSha256,
    fileInventorySha256: value.digests.fileInventorySha256,
  }
  if (Object.values(digests).some((digest) => typeof digest !== 'string' || !HASH.test(digest))) return null
  const gradeCounts = { '5': counts(value.gradeCounts['5']), '7': counts(value.gradeCounts['7']), '8': counts(value.gradeCounts['8']) }
  if (Object.values(gradeCounts).some((grade) => grade === null)) return null
  if (value.files.length !== release.fileCount || value.files.length > 10_000) return null
  const staged = release.provenanceClass === 'staged_publish'
  if (staged) {
    if (
      !isRecord(value.publicationEvidence)
      || value.publicationEvidence.stagingId !== release.stagingId
      || !HASH.test(value.publicationEvidence.contentHash)
      || !HASH.test(value.publicationEvidence.manifestHash)
      || !HASH.test(value.publicationEvidence.packageHash)
      || value.publicationEvidence.activationStatus !== 'not_active'
    ) return null
  } else if (value.publicationEvidence !== undefined && value.publicationEvidence !== null) return null
  const files = value.files.map((file) => {
    if (
      !isRecord(file)
      || typeof file.path !== 'string'
      || !FILE_PATH.test(file.path)
      || integer(file.byteCount) === null
      || typeof file.sha256 !== 'string'
      || !HASH.test(file.sha256)
      || !CONTENT_TYPES.has(file.contentType)
      || file.safeClassification !== (staged ? 'immutable_embedded_json' : 'metadata_only_internal_source')
      || typeof file.immutableLocator !== 'string'
      || !(staged ? REGISTRY_LOCATOR : LOCATOR).test(file.immutableLocator)
      || file.immutableLocator !== (staged
        ? `curriculum_registry:${release.stagingId}:${file.path}`
        : `git_commit_path:${release.sourceCommit}:${release.sourceRoot}/${file.path}`)
    ) return null
    return Object.freeze({
      path: file.path, byteCount: file.byteCount, sha256: file.sha256,
      contentType: file.contentType, safeClassification: file.safeClassification,
      immutableLocator: file.immutableLocator,
    })
  })
  if (files.some((file) => file === null)) return null
  return Object.freeze({
    schemaVersion: 1,
    ...release,
    digests: Object.freeze(digests),
    gradeCounts: Object.freeze(gradeCounts),
    files: Object.freeze(files),
    ...(staged ? { publicationEvidence: Object.freeze({
      stagingId: value.publicationEvidence.stagingId,
      contentHash: value.publicationEvidence.contentHash,
      manifestHash: value.publicationEvidence.manifestHash,
      packageHash: value.publicationEvidence.packageHash,
      activationStatus: 'not_active',
    }) } : {}),
  })
}

function adaptPointer(value) {
  if (
    !isRecord(value)
    || value.schemaVersion !== 1
    || value.environment !== 'production'
    || typeof value.packageId !== 'string'
    || typeof value.releaseVersion !== 'string'
    || !VERSION.test(value.releaseVersion)
    || integer(value.revision) === null
    || value.revision < 1
    || value.changeKind !== 'migration_seed'
    || value.bindingMode !== 'registry_only'
    || value.registryOnly !== true
    || value.runtimeBinding !== 'hard-coded'
    || timestamp(value.registeredAt) === null
  ) return null
  return Object.freeze({
    schemaVersion: 1,
    environment: value.environment,
    packageId: value.packageId,
    releaseVersion: value.releaseVersion,
    revision: value.revision,
    changeKind: value.changeKind,
    bindingMode: value.bindingMode,
    registryOnly: true,
    runtimeBinding: value.runtimeBinding,
    registeredAt: value.registeredAt,
  })
}

function notFound() {
  return Object.assign(new Error('curriculum_release_unavailable'), { code: 'not-found' })
}

export function createAdminCurriculumRegistryReader({ env, fetchImpl, client } = {}) {
  let serviceClient = client

  function getClient() {
    if (serviceClient) return serviceClient
    const config = serviceConfig(env)
    if (!config) return null
    serviceClient = createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { fetch: fetchImpl },
    })
    return serviceClient
  }

  async function call(name, args, adapt, missingIsNotFound = false) {
    const database = getClient()
    if (!database) throw new Error('curriculum_registry_unavailable')
    const signal = AbortSignal.timeout(READ_TIMEOUT_MS)
    const { data, error } = await database.rpc(name, args).abortSignal(signal)
    if (signal.aborted || error) throw new Error('curriculum_registry_unavailable')
    if (missingIsNotFound && data === null) throw notFound()
    const projected = adapt(data)
    if (!projected) throw new Error('curriculum_registry_unavailable')
    return projected
  }

  return Object.freeze({
    list() {
      return call(
        'academy_admin_list_curriculum_releases_v1',
        { p_required_capability: 'curriculum:read' },
        adaptList,
      )
    },
    details(version) {
      return call(
        'academy_admin_read_curriculum_release_v1',
        { p_version: version, p_required_capability: 'curriculum:read' },
        adaptDetails,
        true,
      )
    },
    productionPointer() {
      return call(
        'academy_admin_read_curriculum_production_pointer_v1',
        { p_required_capability: 'curriculum:read' },
        adaptPointer,
      )
    },
  })
}
