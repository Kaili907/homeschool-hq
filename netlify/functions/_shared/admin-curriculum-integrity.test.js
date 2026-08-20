import { describe, expect, it, vi } from 'vitest'
import {
  canonicalJson,
  createAdminCurriculumIntegrityEvidenceReader,
  createAdminCurriculumIntegrityService,
  loadPublishedSource,
  reconcilePublishedGradeCounts,
  sha256,
  verifyPublishedRelease,
  verifyStagedCandidate,
} from './admin-curriculum-integrity.js'

const STAGING_ID = '10000000-0000-4000-8000-000000000001'
const DRAFT_ID = '20000000-0000-4000-8000-000000000001'
const VALIDATION_ID = '30000000-0000-4000-8000-000000000001'
const APPROVAL_ID = '40000000-0000-4000-8000-000000000001'
const COLLECTIONS = [
  'courses', 'units', 'lessons', 'assessments', 'assessment_interpretations',
  'schedules', 'standard_frameworks', 'resources', 'policy_sets',
]

function stagedFixture(packageId = 'manuel-academy-grades-5-7-8-curriculum-v1') {
  const values = Object.fromEntries(COLLECTIONS.map((name) => [name, name === 'courses' ? [{ course_id: 'course-1' }] : []]))
  const contentByPath = {
    'snapshot/manifest.json': { schema_set_version: '2.0.0' },
    ...Object.fromEntries(COLLECTIONS.map((name) => [`snapshot/${name}.json`, values[name]])),
  }
  const artifacts = Object.entries(contentByPath).map(([relativePath, content]) => {
    const canonicalContent = canonicalJson(content)
    return {
      relativePath,
      byteCount: Buffer.byteLength(canonicalContent),
      sha256: sha256(canonicalContent),
      canonicalContent,
    }
  }).sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  const entityCounts = Object.fromEntries(COLLECTIONS.map((name) => [name, values[name].length]))
  const byteCount = artifacts.reduce((sum, artifact) => sum + artifact.byteCount, 0)
  const contentHash = sha256(artifacts.map((artifact) => (
    `${artifact.relativePath}\0${artifact.byteCount}\0${artifact.sha256}\n`
  )).join(''))
  const validationResultDigest = 'd'.repeat(64)
  const manifest = {
    schemaVersion: 1,
    packageFormat: 'manuel-academy-curriculum-staged-v1',
    releaseIdentity: { packageId, version: '2.0.0-rc.1' },
    baseReleaseVersion: '1.0.0', targetVersion: '2.0.0-rc.1', schemaSetVersion: '2.0.0',
    draft: { id: DRAFT_ID, revision: 3 },
    validation: { id: VALIDATION_ID, resultDigest: validationResultDigest },
    approval: { id: APPROVAL_ID }, entityCounts, fileCount: artifacts.length, byteCount,
    files: artifacts.map(({ relativePath, byteCount: bytes, sha256: digest }) => ({
      relativePath, byteCount: bytes, sha256: digest,
    })),
    contentHash,
  }
  const manifestCanonical = canonicalJson(manifest)
  const manifestHash = sha256(manifestCanonical)
  return {
    stagingId: STAGING_ID, schemaVersion: 1, status: 'staged', publicationStatus: 'not_published',
    draftId: DRAFT_ID, draftRevision: 3, baseReleaseVersion: '1.0.0',
    targetVersion: '2.0.0-rc.1', schemaSetVersion: '2.0.0', validationSnapshotId: VALIDATION_ID,
    validationResultDigest, approvalId: APPROVAL_ID, entityCounts, fileCount: artifacts.length,
    byteCount, contentHash, manifestHash,
    packageHash: sha256(`manuel-academy-curriculum-staged-v1\n${contentHash}\n${manifestHash}\n`),
    manifest, manifestCanonical, artifacts,
    validation: {
      validationSnapshotId: VALIDATION_ID, draftId: DRAFT_ID, draftRevision: 3,
      baseReleaseVersion: '1.0.0', targetVersion: '2.0.0-rc.1', schemaSetVersion: '2.0.0',
      resultDigest: validationResultDigest, status: 'valid', publicationReady: true,
    },
    approval: {
      approvalId: APPROVAL_ID, draftId: DRAFT_ID, draftRevision: 3,
      baseReleaseVersion: '1.0.0', targetVersion: '2.0.0-rc.1', schemaSetVersion: '2.0.0',
      validationSnapshotId: VALIDATION_ID, validationResultDigest, decision: 'approved', reasonCode: 'approval.ready',
    },
  }
}

async function publishedFixture() {
  const sourceIdentity = {
    version: '1.0.0', sourceRoot: 'curriculum-content/manuel-academy/1.0.0',
  }
  const observed = await loadPublishedSource(sourceIdentity)
  if (observed.unavailable) throw new Error('fixture unavailable')
  const files = [...observed.files].map(([path, bytes]) => ({
    path, byteCount: bytes.byteLength, sha256: sha256(bytes),
  })).sort((left, right) => left.path.localeCompare(right.path))
  const byPath = new Map(files.map((file) => [file.path, file]))
  return {
    observed,
    release: {
      schemaVersion: 1, packageId: 'manuel-academy-grades-5-7-8-curriculum-v1', version: '1.0.0',
      status: 'published', provenanceClass: 'legacy_import',
      sourceCommit: '4056e31d8beb36622be5ac27ea7f20145266343b', sourceRoot: sourceIdentity.sourceRoot,
      fileCount: files.length, byteCount: files.reduce((sum, file) => sum + file.byteCount, 0),
      counts: { courses: 30, units: 232, lessons: 2736, assessments: 232, texts: 18, schedules: 3 },
      gradeCounts: {
        '5': { courses: 10, units: 77, lessons: 900, assessments: 77, texts: 6, schedules: 1 },
        '7': { courses: 10, units: 77, lessons: 900, assessments: 77, texts: 6, schedules: 1 },
        '8': { courses: 10, units: 78, lessons: 936, assessments: 78, texts: 6, schedules: 1 },
      },
      files,
      digests: {
        packageManifestSha256: byPath.get('MANIFEST.json').sha256,
        checksumManifestSha256: byPath.get('SHA256SUMS.txt').sha256,
        curriculumManifestSha256: byPath.get('curriculum-manifest.json').sha256,
        fileInventorySha256: sha256(files.map((file) => `${file.path}\0${file.byteCount}\0${file.sha256}\n`).join('')),
      },
    },
  }
}

describe('curriculum staged release integrity algorithm', () => {
  it('verifies every canonical artifact, byte count, manifest, package identity, metadata, and provenance link', () => {
    const result = verifyStagedCandidate(stagedFixture())
    expect(result).toMatchObject({
      status: 'VERIFIED', manifestStatus: 'VERIFIED', packageStatus: 'VERIFIED', metadataStatus: 'VERIFIED',
      artifacts: { status: 'VERIFIED', expectedCount: 10, observedCount: 10, verifiedCount: 10 },
      provenance: { status: 'VERIFIED' },
    })
    expect(result.provenance.links.at(-1)).toMatchObject({ status: 'UNAVAILABLE', detail: expect.stringContaining('not published') })
    expect(result.mismatches).toEqual([])
  })

  it('accepts the expanded governed-grade package identity without rewriting package evidence', () => {
    const packageId = 'manuel-academy-grades-3-4-5-7-8-9-10-11-12-curriculum-v1'
    expect(verifyStagedCandidate(stagedFixture(packageId))).toMatchObject({
      status: 'VERIFIED', packageId, metadataStatus: 'VERIFIED',
    })
  })

  it('detects tampered, missing, and prohibited extra artifacts', () => {
    const tampered = stagedFixture()
    tampered.artifacts[0].canonicalContent = '{"tampered":true}'
    expect(verifyStagedCandidate(tampered)).toMatchObject({ status: 'MISMATCH', artifacts: { status: 'MISMATCH' } })

    const missing = stagedFixture()
    missing.artifacts = missing.artifacts.slice(1)
    expect(verifyStagedCandidate(missing).mismatches.map((item) => item.code)).toContain('artifact_missing')

    const extra = stagedFixture()
    extra.artifacts.push({ relativePath: 'snapshot/extra.json', byteCount: 2, sha256: sha256('{}'), canonicalContent: '{}' })
    expect(verifyStagedCandidate(extra).mismatches.map((item) => item.code)).toContain('artifact_extra')
  })

  it.each([
    ['hash mismatch', (value) => { value.artifacts[0].sha256 = 'f'.repeat(64) }, 'artifact_hash_mismatch'],
    ['byte mismatch', (value) => { value.artifacts[0].byteCount += 1 }, 'artifact_size_mismatch'],
    ['manifest mismatch', (value) => { value.manifestHash = 'f'.repeat(64) }, 'manifest_hash_mismatch'],
    ['package mismatch', (value) => { value.packageHash = 'f'.repeat(64) }, 'package_hash_mismatch'],
    ['metadata mismatch', (value) => { value.manifest.targetVersion = '2.0.0-wrong' }, 'metadata_mismatch'],
    ['provenance gap', (value) => { value.approval = null }, 'provenance_mismatch'],
  ])('reports %s without repairing evidence', (_label, mutate, code) => {
    const value = stagedFixture()
    const before = structuredClone(value)
    mutate(value)
    const changed = structuredClone(value)
    const result = verifyStagedCandidate(value)
    expect(result.status).toBe('MISMATCH')
    expect(result.mismatches.map((item) => item.code)).toContain(code)
    expect(value).toEqual(changed)
    expect(value).not.toEqual(before)
  })

  it('returns UNAVAILABLE for malformed evidence instead of treating file existence as verification', () => {
    expect(verifyStagedCandidate({ targetVersion: '2.0.0' })).toMatchObject({
      status: 'UNAVAILABLE', manifestStatus: 'UNAVAILABLE', evidenceGaps: [{ code: 'malformed_evidence' }],
    })
  })
})

describe('published release integrity and legacy provenance ruling', () => {
  it('reconciles every grade bucket named by old and expanded package identities', () => {
    const count = (courses) => ({ courses, units: courses * 2, lessons: courses * 3, assessments: courses, texts: 0, schedules: 1 })
    const grades = [3, 4, 5, 7, 8, 9, 10, 11, 12]
    const gradeCounts = Object.fromEntries(grades.map((grade) => [String(grade), count(1)]))
    const totals = { courses: 9, units: 18, lessons: 27, assessments: 9, texts: 0, schedules: 9 }
    const expanded = 'manuel-academy-grades-3-4-5-7-8-9-10-11-12-curriculum-v1'

    expect(reconcilePublishedGradeCounts(expanded, gradeCounts, totals)).toBe(true)
    expect(reconcilePublishedGradeCounts(expanded, { ...gradeCounts, '12': undefined }, totals)).toBe(false)
    expect(reconcilePublishedGradeCounts(expanded, { ...gradeCounts, '6': count(1) }, totals)).toBe(false)
    expect(reconcilePublishedGradeCounts(
      'manuel-academy-grades-5-7-8-curriculum-v1',
      { '5': count(1), '7': count(1), '8': count(1) },
      { courses: 3, units: 6, lessons: 9, assessments: 3, texts: 0, schedules: 3 },
    )).toBe(true)
  })

  it('verifies available 1.0.0 artifacts and manifests but rules the release INCOMPLETE', async () => {
    const { release, observed } = await publishedFixture()
    const result = verifyPublishedRelease(release, observed)
    expect(result).toMatchObject({
      version: '1.0.0', status: 'INCOMPLETE', manifestStatus: 'VERIFIED',
      packageStatus: 'UNVERIFIED', metadataStatus: 'VERIFIED',
      artifacts: { status: 'VERIFIED', expectedCount: 182, observedCount: 182, verifiedCount: 182 },
      provenance: { status: 'INCOMPLETE' },
    })
    expect(result.evidenceGaps.map((gap) => gap.code)).toEqual(expect.arrayContaining([
      'package_hash_unavailable', 'draft_provenance_unavailable', 'validation_provenance_unavailable',
      'approval_provenance_unavailable', 'staging_provenance_unavailable',
    ]))
  })

  it('detects a published artifact mismatch and does not expose source bytes', async () => {
    const { release, observed } = await publishedFixture()
    observed.files.set('README.md', Buffer.from('tampered'))
    const result = verifyPublishedRelease(release, observed)
    expect(result.status).toBe('MISMATCH')
    expect(result.mismatches.map((item) => item.code)).toEqual(expect.arrayContaining([
      'artifact_size_mismatch', 'artifact_hash_mismatch',
    ]))
    expect(JSON.stringify(result)).not.toContain('tampered')
  })
})

describe('integrity service evidence and read-only boundary', () => {
  it('uses the service-only curriculum:read evidence RPC and allowlists only its envelope', async () => {
    const rpc = vi.fn(() => ({ abortSignal: vi.fn(async () => ({
      data: { schemaVersion: 1, candidates: [stagedFixture()], ignored: 'private' }, error: null,
    })) }))
    const reader = createAdminCurriculumIntegrityEvidenceReader({ client: { rpc } })
    const candidates = await reader.staged('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    expect(candidates).toHaveLength(1)
    expect(rpc).toHaveBeenCalledWith('academy_admin_read_curriculum_staging_integrity_v1', {
      p_actor_user_ref: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', p_required_capability: 'curriculum:read',
    })
  })

  it('performs reads only and returns bounded unavailable sources without mutation fallbacks', async () => {
    const evidence = { staged: vi.fn(async () => { throw new Error('private database error') }) }
    const registry = { list: vi.fn(async () => { throw new Error('private registry error') }) }
    const report = await createAdminCurriculumIntegrityService({ evidence, registry }).verify(DRAFT_ID)
    expect(report).toMatchObject({ status: 'UNAVAILABLE', subjects: [], readOnly: true })
    expect(report.evidenceGaps).toHaveLength(2)
    expect(JSON.stringify(report)).not.toMatch(/private database|private registry/i)
    expect(Object.keys(evidence)).toEqual(['staged'])
    expect(Object.keys(registry)).toEqual(['list'])
  })

  it('never returns staged canonical curriculum payloads to the browser report', async () => {
    const evidence = { staged: vi.fn(async () => [stagedFixture()]) }
    const registry = { list: vi.fn(async () => ({ schemaVersion: 1, releases: [] })) }
    const report = await createAdminCurriculumIntegrityService({ evidence, registry }).verify(DRAFT_ID)
    expect(report.status).toBe('VERIFIED')
    expect(JSON.stringify(report)).not.toMatch(/course-1|course_id|canonicalContent|schema_set_version/i)
  })
})
