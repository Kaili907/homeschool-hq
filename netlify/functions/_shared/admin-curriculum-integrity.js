import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const TIMEOUT_MS = 30_000
const HASH = /^[0-9a-f]{64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/
const PATH = /^(?!\/)(?!.*(?:^|\/)\.\.?(?:\/|$))(?!.*\/\/)(?!.*\\).{1,240}$/
const PACKAGE_FORMAT = 'manuel-academy-curriculum-staged-v1'
const PACKAGE_ID = 'manuel-academy-grades-5-7-8-curriculum-v1'
const STAGED_COLLECTIONS = Object.freeze([
  'courses', 'units', 'lessons', 'assessments', 'assessment_interpretations',
  'schedules', 'standard_frameworks', 'resources', 'policy_sets',
])
const STAGED_ARTIFACT_PATHS = new Set([
  'snapshot/manifest.json',
  ...STAGED_COLLECTIONS.map((collection) => `snapshot/${collection}.json`),
])
const MAX_FINDINGS = 100
const SOURCE_ROOT = new URL('../../../curriculum-content/manuel-academy/', import.meta.url)

export const INTEGRITY_STATUSES = Object.freeze([
  'VERIFIED', 'MISMATCH', 'INCOMPLETE', 'UNVERIFIED', 'UNAVAILABLE',
])

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

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

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!record(value)) return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value))
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function sameJson(left, right) {
  try {
    return canonicalJson(left) === canonicalJson(right)
  } catch {
    return false
  }
}

function safePath(value) {
  return typeof value === 'string' && PATH.test(value) ? value : 'unavailable artifact'
}

function statusFor(checks, gaps = []) {
  if (checks.includes('MISMATCH')) return 'MISMATCH'
  if (gaps.length > 0 || checks.includes('INCOMPLETE')) {
    return checks.includes('VERIFIED') ? 'INCOMPLETE' : 'UNAVAILABLE'
  }
  if (checks.includes('UNVERIFIED')) return 'UNVERIFIED'
  if (checks.length > 0 && checks.every((status) => status === 'VERIFIED')) return 'VERIFIED'
  return 'UNAVAILABLE'
}

function overallStatus(subjects, sourceGaps) {
  const statuses = subjects.map((subject) => subject.status)
  if (statuses.includes('MISMATCH')) return 'MISMATCH'
  if (sourceGaps.length > 0 && statuses.length === 0) return 'UNAVAILABLE'
  if (sourceGaps.length > 0 || statuses.includes('INCOMPLETE')) return 'INCOMPLETE'
  if (statuses.includes('UNAVAILABLE')) return statuses.includes('VERIFIED') ? 'INCOMPLETE' : 'UNAVAILABLE'
  if (statuses.includes('UNVERIFIED')) return 'UNVERIFIED'
  return statuses.length > 0 ? 'VERIFIED' : 'UNAVAILABLE'
}

function addFinding(target, code, subject, message) {
  if (target.length >= MAX_FINDINGS) return
  target.push(Object.freeze({ code, subject: safePath(subject), message }))
}

function addGap(target, code, message) {
  if (target.length >= MAX_FINDINGS) return
  target.push(Object.freeze({ code, message }))
}

function metadataMismatch(findings, subject, expected, observed, label) {
  if (expected === observed) return false
  addFinding(findings, 'metadata_mismatch', subject, `${label} does not match the staged release metadata.`)
  return true
}

function validHash(value) {
  return typeof value === 'string' && HASH.test(value)
}

function validIdentity(value) {
  return typeof value === 'string' && UUID.test(value)
}

function provenanceLink(kind, label, status, identity = null, detail = null) {
  return Object.freeze({ kind, label, status, identity, detail })
}

function invalidStagedResult(evidence) {
  const version = typeof evidence?.targetVersion === 'string' && VERSION.test(evidence.targetVersion)
    ? evidence.targetVersion : 'Unavailable'
  return Object.freeze({
    subjectId: validIdentity(evidence?.stagingId) ? `staged:${evidence.stagingId}` : 'staged:unavailable',
    kind: 'staged', version, state: 'STAGED', status: 'UNAVAILABLE', packageId: null,
    baseReleaseVersion: null, schemaSetVersion: null,
    manifestStatus: 'UNAVAILABLE', packageStatus: 'UNAVAILABLE', metadataStatus: 'UNAVAILABLE',
    artifacts: Object.freeze({ status: 'UNAVAILABLE', expectedCount: null, observedCount: null, verifiedCount: 0 }),
    provenance: Object.freeze({
      status: 'UNAVAILABLE',
      links: Object.freeze([
        provenanceLink('draft', 'Draft revision', 'UNAVAILABLE'),
        provenanceLink('validation', 'Validation', 'UNAVAILABLE'),
        provenanceLink('approval', 'Approval', 'UNAVAILABLE'),
        provenanceLink('staging', 'Staging', 'UNAVAILABLE'),
        provenanceLink('published', 'Published release', 'UNAVAILABLE', null, 'Candidate publication is not established.'),
      ]),
    }),
    mismatches: Object.freeze([]),
    evidenceGaps: Object.freeze([Object.freeze({
      code: 'malformed_evidence', message: 'The staged evidence envelope is malformed and cannot be verified.',
    })]),
  })
}

/** Independently verifies persisted staged bytes against their recorded package evidence. */
export function verifyStagedCandidate(evidence) {
  if (!record(evidence) || !Array.isArray(evidence.artifacts) || !record(evidence.manifest)) {
    return invalidStagedResult(evidence)
  }
  const findings = []
  const gaps = []
  const manifest = evidence.manifest
  const manifestFiles = Array.isArray(manifest.files) ? manifest.files : null
  if (!manifestFiles) addGap(gaps, 'malformed_evidence', 'The staged manifest file inventory is unavailable or malformed.')

  let artifactMismatch = false
  const observed = new Map()
  const invalidObserved = new Set()
  for (const artifact of evidence.artifacts) {
    const path = safePath(artifact?.relativePath)
    if (!record(artifact) || path === 'unavailable artifact' || observed.has(path)
      || typeof artifact.canonicalContent !== 'string') {
      artifactMismatch = true
      invalidObserved.add(path)
      addFinding(findings, 'malformed_evidence', path, 'A persisted staged artifact record is malformed or duplicated.')
      continue
    }
    try {
      const content = JSON.parse(artifact.canonicalContent)
      const canonicalContent = canonicalJson(content)
      const byteCount = Buffer.byteLength(canonicalContent, 'utf8')
      const digest = sha256(canonicalContent)
      observed.set(path, { byteCount, sha256: digest })
      if (canonicalContent !== artifact.canonicalContent) {
        artifactMismatch = true
        invalidObserved.add(path)
        addFinding(findings, 'artifact_canonical_mismatch', path, 'Persisted artifact bytes do not use the canonical JSON encoding.')
      }
      if (artifact.byteCount !== byteCount) {
        artifactMismatch = true
        invalidObserved.add(path)
        addFinding(findings, 'artifact_size_mismatch', path, 'Recorded and observed artifact byte counts differ.')
      }
      if (artifact.sha256 !== digest) {
        artifactMismatch = true
        invalidObserved.add(path)
        addFinding(findings, 'artifact_hash_mismatch', path, 'Recorded and observed artifact SHA-256 values differ.')
      }
    } catch {
      artifactMismatch = true
      invalidObserved.add(path)
      addFinding(findings, 'malformed_evidence', path, 'Persisted artifact bytes are not valid canonical JSON.')
    }
  }

  const expected = new Map()
  if (manifestFiles) {
    for (const file of manifestFiles) {
      const path = safePath(file?.relativePath)
      if (!record(file) || path === 'unavailable artifact' || expected.has(path)
        || !Number.isSafeInteger(file.byteCount) || !validHash(file.sha256)) {
        artifactMismatch = true
        addFinding(findings, 'malformed_evidence', path, 'The staged manifest contains a malformed or duplicated artifact entry.')
        continue
      }
      expected.set(path, file)
    }
    for (const [path, file] of expected) {
      const actual = observed.get(path)
      if (!actual) {
        artifactMismatch = true
        addFinding(findings, 'artifact_missing', path, 'An artifact required by the staged manifest is missing.')
        continue
      }
      if (file.byteCount !== actual.byteCount) {
        artifactMismatch = true
        invalidObserved.add(path)
        addFinding(findings, 'artifact_size_mismatch', path, 'Manifest and observed artifact byte counts differ.')
      }
      if (file.sha256 !== actual.sha256) {
        artifactMismatch = true
        invalidObserved.add(path)
        addFinding(findings, 'artifact_hash_mismatch', path, 'Manifest and observed artifact SHA-256 values differ.')
      }
    }
    for (const path of observed.keys()) {
      if (!expected.has(path)) {
        artifactMismatch = true
        invalidObserved.add(path)
        addFinding(findings, 'artifact_extra', path, 'A persisted artifact is not allowed by the staged manifest.')
      }
    }
    for (const path of STAGED_ARTIFACT_PATHS) {
      if (!expected.has(path)) {
        artifactMismatch = true
        addFinding(findings, 'artifact_missing', path, 'The canonical staged package requires this artifact in its manifest.')
      }
    }
    for (const path of expected.keys()) {
      if (!STAGED_ARTIFACT_PATHS.has(path)) {
        artifactMismatch = true
        invalidObserved.add(path)
        addFinding(findings, 'artifact_extra', path, 'The canonical staged package format prohibits this artifact path.')
      }
    }
  }

  const inventory = [...observed].sort(([left], [right]) => left.localeCompare(right))
    .map(([path, file]) => `${path}\u0000${file.byteCount}\u0000${file.sha256}\n`).join('')
  const observedContentHash = sha256(inventory)
  if (evidence.contentHash !== observedContentHash || manifest.contentHash !== observedContentHash) {
    artifactMismatch = true
    addFinding(findings, 'content_hash_mismatch', 'artifact inventory', 'The recalculated artifact inventory hash does not match all recorded content hashes.')
  }

  const manifestCanonical = canonicalJson(manifest)
  const observedManifestHash = sha256(manifestCanonical)
  let manifestMismatch = false
  if (evidence.manifestCanonical !== manifestCanonical) {
    manifestMismatch = true
    addFinding(findings, 'manifest_canonical_mismatch', 'staging manifest', 'The persisted manifest bytes do not match the canonical manifest encoding.')
  }
  if (evidence.manifestHash !== observedManifestHash) {
    manifestMismatch = true
    addFinding(findings, 'manifest_hash_mismatch', 'staging manifest', 'The recorded manifest SHA-256 does not match the recalculated manifest.')
  }

  const observedPackageHash = sha256(`${PACKAGE_FORMAT}\n${observedContentHash}\n${observedManifestHash}\n`)
  const packageMismatch = evidence.packageHash !== observedPackageHash
  if (packageMismatch) {
    addFinding(findings, 'package_hash_mismatch', 'staged package', 'The recorded package SHA-256 does not match the canonical package identity.')
  }

  let metadataInvalid = false
  const metadataPairs = [
    [1, evidence.schemaVersion, 'Staging schema version'],
    [evidence.schemaVersion, manifest.schemaVersion, 'Manifest schema version'],
    [PACKAGE_FORMAT, manifest.packageFormat, 'Package format'],
    [PACKAGE_ID, manifest.releaseIdentity?.packageId, 'Package identity'],
    [evidence.targetVersion, manifest.releaseIdentity?.version, 'Release identity version'],
    [evidence.baseReleaseVersion, manifest.baseReleaseVersion, 'Base release'],
    [evidence.targetVersion, manifest.targetVersion, 'Target version'],
    [evidence.schemaSetVersion, manifest.schemaSetVersion, 'Schema Set'],
    [evidence.draftId, manifest.draft?.id, 'Draft identity'],
    [evidence.draftRevision, manifest.draft?.revision, 'Draft revision'],
    [evidence.validationSnapshotId, manifest.validation?.id, 'Validation identity'],
    [evidence.validationResultDigest, manifest.validation?.resultDigest, 'Validation digest'],
    [evidence.approvalId, manifest.approval?.id, 'Approval identity'],
    [evidence.fileCount, manifest.fileCount, 'Artifact count'],
    [evidence.byteCount, manifest.byteCount, 'Package byte count'],
  ]
  for (const [expectedValue, observedValue, label] of metadataPairs) {
    metadataInvalid = metadataMismatch(findings, label, expectedValue, observedValue, label) || metadataInvalid
  }
  if (!sameJson(evidence.entityCounts, manifest.entityCounts)) {
    metadataInvalid = true
    addFinding(findings, 'metadata_mismatch', 'Entity counts', 'Manifest and staged entity counts differ.')
  }
  if (evidence.fileCount !== observed.size || manifest.fileCount !== observed.size) {
    metadataInvalid = true
    addFinding(findings, 'count_mismatch', 'Artifact count', 'Recorded and observed artifact counts differ.')
  }
  const observedBytes = [...observed.values()].reduce((sum, file) => sum + file.byteCount, 0)
  if (evidence.byteCount !== observedBytes || manifest.byteCount !== observedBytes) {
    metadataInvalid = true
    addFinding(findings, 'metadata_mismatch', 'Package byte count', 'Recorded and observed package byte totals differ.')
  }
  if (record(evidence.entityCounts)) {
    if (Object.keys(evidence.entityCounts).length !== STAGED_COLLECTIONS.length
      || STAGED_COLLECTIONS.some((collection) => !Object.hasOwn(evidence.entityCounts, collection))) {
      metadataInvalid = true
      addFinding(findings, 'count_mismatch', 'Entity counts', 'The staged entity-count inventory is incomplete or contains an unsupported collection.')
    }
    for (const [collection, count] of Object.entries(evidence.entityCounts)) {
      const artifact = evidence.artifacts.find((item) => item?.relativePath === `snapshot/${collection}.json`)
      if (!artifact || typeof artifact.canonicalContent !== 'string') continue
      try {
        const values = JSON.parse(artifact.canonicalContent)
        if (!Array.isArray(values) || values.length !== count) {
          metadataInvalid = true
          addFinding(findings, 'count_mismatch', `snapshot/${collection}.json`, 'Observed collection length does not match the staged entity count.')
        }
      } catch {
        // The malformed artifact finding already records this condition.
      }
    }
  }

  const validation = evidence.validation
  const approval = evidence.approval
  let provenanceMismatch = false
  const validationPairs = [
    [evidence.validationSnapshotId, validation?.validationSnapshotId],
    [evidence.draftId, validation?.draftId], [evidence.draftRevision, validation?.draftRevision],
    [evidence.baseReleaseVersion, validation?.baseReleaseVersion],
    [evidence.targetVersion, validation?.targetVersion], [evidence.schemaSetVersion, validation?.schemaSetVersion],
    [evidence.validationResultDigest, validation?.resultDigest],
  ]
  const approvalPairs = [
    [evidence.approvalId, approval?.approvalId], [evidence.draftId, approval?.draftId],
    [evidence.draftRevision, approval?.draftRevision], [evidence.baseReleaseVersion, approval?.baseReleaseVersion],
    [evidence.targetVersion, approval?.targetVersion], [evidence.schemaSetVersion, approval?.schemaSetVersion],
    [evidence.validationSnapshotId, approval?.validationSnapshotId],
    [evidence.validationResultDigest, approval?.validationResultDigest],
  ]
  if (!record(validation) || validationPairs.some(([left, right]) => left !== right)
    || validation.status !== 'valid' || validation.publicationReady !== true) provenanceMismatch = true
  if (!record(approval) || approvalPairs.some(([left, right]) => left !== right)
    || approval.decision !== 'approved' || approval.reasonCode !== 'approval.ready') provenanceMismatch = true
  if (provenanceMismatch) {
    addFinding(findings, 'provenance_mismatch', 'staged provenance', 'Draft, validation, approval, and staging identities do not form one exact chain.')
  }

  const coreFieldsValid = validIdentity(evidence.stagingId) && validIdentity(evidence.draftId)
    && validIdentity(evidence.validationSnapshotId) && validIdentity(evidence.approvalId)
    && VERSION.test(evidence.targetVersion ?? '') && VERSION.test(evidence.baseReleaseVersion ?? '')
    && evidence.schemaVersion === 1 && evidence.status === 'staged' && evidence.publicationStatus === 'not_published'
    && evidence.schemaSetVersion === '2.0.0' && validHash(evidence.contentHash)
    && validHash(evidence.manifestHash) && validHash(evidence.packageHash)
  if (!coreFieldsValid) addGap(gaps, 'malformed_evidence', 'Required staged release identity or digest evidence is malformed.')

  const artifactStatus = gaps.length > 0 && observed.size === 0 ? 'UNAVAILABLE' : artifactMismatch ? 'MISMATCH' : 'VERIFIED'
  const manifestStatus = gaps.length > 0 && !validHash(evidence.manifestHash) ? 'UNAVAILABLE' : manifestMismatch ? 'MISMATCH' : 'VERIFIED'
  const packageStatus = gaps.length > 0 && !validHash(evidence.packageHash) ? 'UNAVAILABLE' : packageMismatch ? 'MISMATCH' : 'VERIFIED'
  const metadataStatus = metadataInvalid || provenanceMismatch ? 'MISMATCH' : coreFieldsValid ? 'VERIFIED' : 'INCOMPLETE'
  const provenanceStatus = provenanceMismatch ? 'MISMATCH' : coreFieldsValid ? 'VERIFIED' : 'INCOMPLETE'
  const status = statusFor([artifactStatus, manifestStatus, packageStatus, metadataStatus, provenanceStatus], gaps)

  return Object.freeze({
    subjectId: validIdentity(evidence.stagingId) ? `staged:${evidence.stagingId}` : 'staged:unavailable',
    kind: 'staged', version: VERSION.test(evidence.targetVersion ?? '') ? evidence.targetVersion : 'Unavailable',
    state: 'STAGED', status, packageId: manifest.releaseIdentity?.packageId === PACKAGE_ID ? PACKAGE_ID : null,
    baseReleaseVersion: VERSION.test(evidence.baseReleaseVersion ?? '') ? evidence.baseReleaseVersion : null,
    schemaSetVersion: evidence.schemaSetVersion === '2.0.0' ? evidence.schemaSetVersion : null,
    manifestStatus, packageStatus, metadataStatus,
    artifacts: Object.freeze({
      status: artifactStatus, expectedCount: manifestFiles ? expected.size : null,
      observedCount: observed.size,
      verifiedCount: [...observed.keys()].filter((path) => !invalidObserved.has(path)).length,
    }),
    provenance: Object.freeze({
      status: provenanceStatus,
      links: Object.freeze([
        provenanceLink('draft', `Draft revision ${Number.isSafeInteger(evidence.draftRevision) ? evidence.draftRevision : 'unavailable'}`, provenanceMismatch ? 'MISMATCH' : 'VERIFIED', validIdentity(evidence.draftId) ? evidence.draftId : null),
        provenanceLink('validation', 'Validation', provenanceMismatch ? 'MISMATCH' : 'VERIFIED', validIdentity(evidence.validationSnapshotId) ? evidence.validationSnapshotId : null),
        provenanceLink('approval', 'Approval', provenanceMismatch ? 'MISMATCH' : 'VERIFIED', validIdentity(evidence.approvalId) ? evidence.approvalId : null),
        provenanceLink('staging', 'Staging', status === 'MISMATCH' ? 'MISMATCH' : 'VERIFIED', validIdentity(evidence.stagingId) ? evidence.stagingId : null),
        provenanceLink('published', 'Published release', 'UNAVAILABLE', null, 'Candidate is staged and explicitly not published.'),
      ]),
    }),
    mismatches: Object.freeze(findings), evidenceGaps: Object.freeze(gaps),
  })
}

function publishedGapResult(release, message) {
  const gaps = [Object.freeze({ code: 'artifact_source_unavailable', message })]
  return Object.freeze({
    subjectId: `published:${release.version}`, kind: 'published', version: release.version,
    state: 'PUBLISHED', status: 'UNAVAILABLE', packageId: release.packageId,
    baseReleaseVersion: null, schemaSetVersion: null,
    manifestStatus: 'UNAVAILABLE', packageStatus: 'UNVERIFIED', metadataStatus: 'UNAVAILABLE',
    artifacts: Object.freeze({ status: 'UNAVAILABLE', expectedCount: release.fileCount, observedCount: null, verifiedCount: 0 }),
    provenance: legacyPublishedProvenance(release), mismatches: Object.freeze([]), evidenceGaps: Object.freeze(gaps),
  })
}

function legacyPublishedProvenance(release) {
  const sourceDetail = release.provenanceClass === 'legacy_import'
    ? `Legacy import from commit ${release.sourceCommit}.` : 'Published registry identity is available.'
  return Object.freeze({
    status: 'INCOMPLETE',
    links: Object.freeze([
      provenanceLink('draft', 'Draft revision', 'UNVERIFIED', null, 'No draft identity is recorded.'),
      provenanceLink('validation', 'Validation', 'UNVERIFIED', null, 'No revision-bound validation identity is recorded.'),
      provenanceLink('approval', 'Approval', 'UNVERIFIED', null, 'No approval identity is recorded.'),
      provenanceLink('staging', 'Staging', 'UNVERIFIED', null, 'No staged candidate identity is recorded.'),
      provenanceLink('published', 'Published release', 'VERIFIED', release.version, sourceDetail),
    ]),
  })
}

function manifestEntries(value) {
  if (!record(value) || !Array.isArray(value.files) || !Array.isArray(value.exclusions)) return null
  const entries = new Map()
  for (const entry of value.files) {
    if (!record(entry) || !PATH.test(entry.path ?? '') || entries.has(entry.path)
      || !Number.isSafeInteger(entry.bytes) || !validHash(entry.sha256)) return null
    entries.set(entry.path, { byteCount: entry.bytes, sha256: entry.sha256 })
  }
  if (value.exclusions.some((path) => typeof path !== 'string' || !PATH.test(path))) return null
  return { entries, exclusions: new Set(value.exclusions) }
}

/** Verifies a published registry projection against independently loaded artifact bytes. */
export function verifyPublishedRelease(release, observedSource) {
  if (!record(release) || !VERSION.test(release.version ?? '') || !Array.isArray(release.files)) {
    return publishedGapResult({ version: 'Unavailable', packageId: null, fileCount: null }, 'Published registry evidence is malformed.')
  }
  if (!observedSource || observedSource.unavailable) {
    return publishedGapResult(release, 'The repository release bytes named by the commit-pinned locator are unavailable to the verifier.')
  }
  const findings = []
  const gaps = []
  const expected = new Map(release.files.map((file) => [file.path, file]))
  const observed = observedSource.files
  let artifactMismatch = false
  let verifiedCount = 0
  for (const [path, file] of expected) {
    const bytes = observed.get(path)
    if (!bytes) {
      artifactMismatch = true
      addFinding(findings, 'artifact_missing', path, 'A registry artifact is missing from the commit-pinned source root.')
      continue
    }
    const observedBytes = bytes.byteLength
    const observedHash = sha256(bytes)
    let valid = true
    if (file.byteCount !== observedBytes) {
      valid = false
      artifactMismatch = true
      addFinding(findings, 'artifact_size_mismatch', path, 'Registry and observed artifact byte counts differ.')
    }
    if (file.sha256 !== observedHash) {
      valid = false
      artifactMismatch = true
      addFinding(findings, 'artifact_hash_mismatch', path, 'Registry and observed artifact SHA-256 values differ.')
    }
    if (valid) verifiedCount++
  }
  for (const path of observed.keys()) {
    if (!expected.has(path)) {
      artifactMismatch = true
      addFinding(findings, 'artifact_extra', path, 'The repository release source contains an artifact absent from the registry inventory.')
    }
  }
  const expectedByteCount = release.files.reduce((sum, file) => sum + file.byteCount, 0)
  if (release.fileCount !== expected.size || release.fileCount !== observed.size) {
    artifactMismatch = true
    addFinding(findings, 'count_mismatch', 'Published artifact count', 'Registry, inventory, and observed artifact counts differ.')
  }
  if (release.byteCount !== expectedByteCount) {
    artifactMismatch = true
    addFinding(findings, 'metadata_mismatch', 'Published byte count', 'Release byte metadata does not equal the registry file inventory total.')
  }
  const inventoryHash = sha256(release.files.map((file) => `${file.path}\u0000${file.byteCount}\u0000${file.sha256}\n`).join(''))
  if (release.digests?.fileInventorySha256 !== inventoryHash) {
    artifactMismatch = true
    addFinding(findings, 'content_hash_mismatch', 'Published inventory', 'The canonical registry inventory hash does not match the recorded digest.')
  }

  let manifestMismatch = false
  const packageManifestBytes = observed.get('MANIFEST.json')
  const checksumBytes = observed.get('SHA256SUMS.txt')
  const curriculumManifestBytes = observed.get('curriculum-manifest.json')
  const digestChecks = [
    ['MANIFEST.json', packageManifestBytes, release.digests?.packageManifestSha256],
    ['SHA256SUMS.txt', checksumBytes, release.digests?.checksumManifestSha256],
    ['curriculum-manifest.json', curriculumManifestBytes, release.digests?.curriculumManifestSha256],
  ]
  for (const [path, bytes, digest] of digestChecks) {
    if (!bytes || !validHash(digest)) {
      manifestMismatch = true
      addFinding(findings, 'manifest_hash_mismatch', path, 'Required published manifest digest evidence is unavailable or malformed.')
    } else if (sha256(bytes) !== digest) {
      manifestMismatch = true
      addFinding(findings, 'manifest_hash_mismatch', path, 'The observed manifest does not match its recorded release digest.')
    }
  }

  try {
    const parsed = JSON.parse(packageManifestBytes.toString('utf8'))
    const projected = manifestEntries(parsed)
    if (!projected || parsed.package_id !== release.packageId || parsed.version !== release.version) throw new Error('malformed')
    if (projected.exclusions.size !== 2
      || !projected.exclusions.has('MANIFEST.json')
      || !projected.exclusions.has('SHA256SUMS.txt')) {
      manifestMismatch = true
      addFinding(findings, 'manifest_mismatch', 'MANIFEST.json', 'Package manifest self-coverage exclusions are not canonical.')
    }
    for (const [path, file] of expected) {
      if (projected.exclusions.has(path)) continue
      const entry = projected.entries.get(path)
      if (!entry || entry.byteCount !== file.byteCount || entry.sha256 !== file.sha256) {
        manifestMismatch = true
        addFinding(findings, 'manifest_mismatch', path, 'Package manifest and registry artifact evidence differ.')
      }
    }
    for (const path of projected.entries.keys()) {
      if (!expected.has(path) || projected.exclusions.has(path)) {
        manifestMismatch = true
        addFinding(findings, 'manifest_mismatch', path, 'Package manifest contains an unexpected artifact entry.')
      }
    }
    for (const path of projected.exclusions) {
      if (!expected.has(path)) {
        manifestMismatch = true
        addFinding(findings, 'manifest_mismatch', path, 'Package manifest excludes an artifact absent from the registry.')
      }
    }
  } catch {
    manifestMismatch = true
    addFinding(findings, 'manifest_mismatch', 'MANIFEST.json', 'The published package manifest is malformed or inconsistent.')
  }

  if (record(release.gradeCounts)) {
    for (const key of ['courses', 'units', 'lessons', 'assessments', 'texts', 'schedules']) {
      const gradeTotal = ['5', '7', '8'].reduce((sum, grade) => sum + (release.gradeCounts[grade]?.[key] ?? Number.NaN), 0)
      if (!Number.isSafeInteger(gradeTotal) || gradeTotal !== release.counts[key]) {
        manifestMismatch = true
        addFinding(findings, 'metadata_mismatch', 'Published grade counts', 'Grade-level counts do not reconcile to the release total counts.')
        break
      }
    }
  } else {
    manifestMismatch = true
    addFinding(findings, 'metadata_mismatch', 'Published grade counts', 'Grade-level release count evidence is unavailable.')
  }

  try {
    const lines = checksumBytes.toString('utf8').trim().split(/\r?\n/)
    const sums = new Map()
    for (const line of lines) {
      const match = /^([0-9a-f]{64})  (.+)$/.exec(line)
      if (!match || !PATH.test(match[2]) || sums.has(match[2])) throw new Error('malformed')
      sums.set(match[2], match[1])
    }
    for (const [path, file] of expected) {
      if (path === 'SHA256SUMS.txt') continue
      if (sums.get(path) !== file.sha256) {
        manifestMismatch = true
        addFinding(findings, 'checksum_manifest_mismatch', path, 'Checksum manifest and registry artifact evidence differ.')
      }
    }
    if (sums.has('SHA256SUMS.txt') || [...sums.keys()].some((path) => !expected.has(path))) throw new Error('malformed')
  } catch {
    manifestMismatch = true
    addFinding(findings, 'checksum_manifest_mismatch', 'SHA256SUMS.txt', 'The published checksum manifest is malformed or inconsistent.')
  }

  try {
    const parsed = JSON.parse(curriculumManifestBytes.toString('utf8'))
    if (parsed.package_id !== release.packageId || parsed.version !== release.version
      || parsed.counts?.courses !== release.counts.courses || parsed.counts?.units !== release.counts.units
      || parsed.counts?.lessons !== release.counts.lessons || parsed.counts?.original_practice_texts !== release.counts.texts) {
      manifestMismatch = true
      addFinding(findings, 'metadata_mismatch', 'curriculum-manifest.json', 'Curriculum manifest identity or counts differ from the release registry.')
    }
  } catch {
    manifestMismatch = true
    addFinding(findings, 'manifest_mismatch', 'curriculum-manifest.json', 'The curriculum manifest is malformed.')
  }

  addGap(gaps, 'package_hash_unavailable', 'This legacy published release records manifest and inventory digests, but no canonical package hash.')
  addGap(gaps, 'draft_provenance_unavailable', 'No draft revision identity is recorded for this legacy published release.')
  addGap(gaps, 'validation_provenance_unavailable', 'No revision-bound validation identity is recorded for this legacy published release.')
  addGap(gaps, 'approval_provenance_unavailable', 'No approval identity is recorded for this legacy published release.')
  addGap(gaps, 'staging_provenance_unavailable', 'No staged candidate identity is recorded for this legacy published release.')

  const artifactStatus = artifactMismatch ? 'MISMATCH' : 'VERIFIED'
  const manifestStatus = manifestMismatch ? 'MISMATCH' : 'VERIFIED'
  const metadataStatus = artifactMismatch || manifestMismatch ? 'MISMATCH' : 'VERIFIED'
  return Object.freeze({
    subjectId: `published:${release.version}`, kind: 'published', version: release.version,
    state: 'PUBLISHED', status: statusFor([artifactStatus, manifestStatus, metadataStatus, 'UNVERIFIED'], gaps),
    packageId: release.packageId, baseReleaseVersion: null, schemaSetVersion: null,
    manifestStatus, packageStatus: 'UNVERIFIED', metadataStatus,
    artifacts: Object.freeze({ status: artifactStatus, expectedCount: expected.size, observedCount: observed.size, verifiedCount }),
    provenance: legacyPublishedProvenance(release),
    mismatches: Object.freeze(findings), evidenceGaps: Object.freeze(gaps),
  })
}

async function walk(root, relative = '') {
  const entries = await readdir(new URL(relative, root), { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = `${relative}${entry.name}`
    if (entry.isDirectory()) files.push(...await walk(root, `${path}/`))
    else if (entry.isFile()) files.push(path)
    else throw new Error('unsupported source entry')
  }
  return files.sort((left, right) => left.localeCompare(right))
}

export async function loadPublishedSource(release, root = SOURCE_ROOT) {
  if (!VERSION.test(release?.version ?? '') || release.sourceRoot !== `curriculum-content/manuel-academy/${release.version}`) {
    return { unavailable: true }
  }
  try {
    const releaseRoot = new URL(`${release.version}/`, root)
    const paths = await walk(releaseRoot)
    const files = new Map()
    for (const path of paths) files.set(path, await readFile(new URL(path, releaseRoot)))
    return { unavailable: false, files }
  } catch {
    return { unavailable: true }
  }
}

export function createAdminCurriculumIntegrityEvidenceReader({ env, fetchImpl, client } = {}) {
  let database = client
  function getClient() {
    if (database) return database
    const config = serviceConfig(env)
    if (!config) return null
    database = createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { fetch: fetchImpl },
    })
    return database
  }
  return Object.freeze({
    async staged(actorUserRef) {
      const target = getClient()
      if (!target) throw new Error('curriculum_integrity_unavailable')
      const signal = AbortSignal.timeout(TIMEOUT_MS)
      const { data, error } = await target.rpc('academy_admin_read_curriculum_staging_integrity_v1', {
        p_actor_user_ref: actorUserRef,
        p_required_capability: 'curriculum:read',
      }).abortSignal(signal)
      if (signal.aborted || error || !record(data) || data.schemaVersion !== 1
        || !Array.isArray(data.candidates) || data.candidates.length > 100) {
        throw new Error('curriculum_integrity_unavailable')
      }
      return data.candidates
    },
  })
}

export function createAdminCurriculumIntegrityService({ evidence, registry, sourceLoader = loadPublishedSource } = {}) {
  return Object.freeze({
    async verify(actorUserRef) {
      const subjects = []
      const sourceGaps = []
      try {
        const candidates = await evidence.staged(actorUserRef)
        subjects.push(...candidates.map(verifyStagedCandidate))
      } catch {
        addGap(sourceGaps, 'staged_evidence_unavailable', 'Staged release evidence is currently unavailable.')
      }
      try {
        const list = await registry.list()
        for (const summary of list.releases) {
          try {
            const release = await registry.details(summary.version)
            subjects.push(verifyPublishedRelease(release, await sourceLoader(release)))
          } catch {
            subjects.push(publishedGapResult(summary, 'Published registry or artifact evidence is currently unavailable.'))
          }
        }
      } catch {
        addGap(sourceGaps, 'published_evidence_unavailable', 'Published release registry evidence is currently unavailable.')
      }
      subjects.sort((left, right) => left.version.localeCompare(right.version) || left.kind.localeCompare(right.kind))
      return Object.freeze({
        schemaVersion: 1,
        status: overallStatus(subjects, sourceGaps),
        subjects: Object.freeze(subjects),
        evidenceGaps: Object.freeze(sourceGaps),
        readOnly: true,
      })
    },
  })
}
