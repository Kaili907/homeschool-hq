import { describe, expect, it, vi } from 'vitest'
import {
  ADMIN_CURRICULUM_RELEASE_LIST_LIMIT,
  createAdminCurriculumRegistryReader,
} from './admin-curriculum-registry-reader.js'

const summary = {
  packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
  version: '1.0.0',
  status: 'published',
  registeredAt: '2026-08-09T16:00:00.000Z',
  authoredOn: '2026-08-03',
  provenanceClass: 'legacy_import',
  sourceCommit: '4056e31d8beb36622be5ac27ea7f20145266343b',
  sourceRoot: 'curriculum-content/manuel-academy/1.0.0',
  fileCount: 1,
  byteCount: 2951,
  counts: { courses: 30, units: 232, lessons: 2736, assessments: 232, texts: 18, schedules: 3 },
}

const gradeCounts = {
  '5': { courses: 10, units: 77, lessons: 900, assessments: 77, texts: 6, schedules: 1 },
  '7': { courses: 10, units: 77, lessons: 900, assessments: 77, texts: 6, schedules: 1 },
  '8': { courses: 10, units: 78, lessons: 936, assessments: 78, texts: 6, schedules: 1 },
}

const hash = 'a'.repeat(64)
const projections = {
  academy_admin_list_curriculum_releases_v1: { schemaVersion: 1, releases: [summary] },
  academy_admin_read_curriculum_release_v1: {
    schemaVersion: 1,
    ...summary,
    digests: {
      packageManifestSha256: hash,
      checksumManifestSha256: hash,
      curriculumManifestSha256: hash,
      fileInventorySha256: hash,
    },
    gradeCounts,
    files: [{
      path: 'README.md',
      byteCount: 2951,
      sha256: hash,
      contentType: 'text/markdown;charset=utf-8',
      safeClassification: 'metadata_only_internal_source',
      immutableLocator: 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/README.md',
    }],
  },
  academy_admin_read_curriculum_production_pointer_v1: {
    schemaVersion: 1,
    environment: 'production',
    packageId: summary.packageId,
    releaseVersion: '1.0.0',
    revision: 1,
    changeKind: 'migration_seed',
    bindingMode: 'registry_only',
    registryOnly: true,
    runtimeBinding: 'hard-coded',
    registeredAt: '2026-08-09T16:00:00.000Z',
  },
}

function clientFor(values = projections) {
  return {
    rpc: vi.fn((name) => ({
      abortSignal: vi.fn(async () => ({ data: values[name], error: null })),
    })),
  }
}

describe('ADMIN-16A curriculum registry reader', () => {
  it('uses only the three service RPCs with the fixed curriculum:read marker', async () => {
    const client = clientFor()
    const reader = createAdminCurriculumRegistryReader({ client })
    await expect(reader.list()).resolves.toMatchObject({ schemaVersion: 1, releases: [{ version: '1.0.0' }] })
    await expect(reader.details('1.0.0')).resolves.toMatchObject({ version: '1.0.0', files: [{ path: 'README.md' }] })
    await expect(reader.productionPointer()).resolves.toMatchObject({
      releaseVersion: '1.0.0', registryOnly: true, runtimeBinding: 'hard-coded',
    })
    expect(client.rpc.mock.calls).toEqual([
      ['academy_admin_list_curriculum_releases_v1', { p_required_capability: 'curriculum:read' }],
      ['academy_admin_read_curriculum_release_v1', { p_version: '1.0.0', p_required_capability: 'curriculum:read' }],
      ['academy_admin_read_curriculum_production_pointer_v1', { p_required_capability: 'curriculum:read' }],
    ])
  })

  it('allowlists metadata fields and never copies unknown source data', async () => {
    const sentinel = 'private source body'
    const values = structuredClone(projections)
    values.academy_admin_read_curriculum_release_v1.sourceBody = sentinel
    values.academy_admin_read_curriculum_release_v1.files[0].contents = sentinel
    const result = await createAdminCurriculumRegistryReader({ client: clientFor(values) }).details('1.0.0')
    expect(JSON.stringify(result)).not.toContain(sentinel)
    expect(result.files[0]).not.toHaveProperty('contents')
  })

  it('fails closed on malformed custody metadata', async () => {
    const values = structuredClone(projections)
    values.academy_admin_read_curriculum_release_v1.files[0].path = '../private'
    await expect(createAdminCurriculumRegistryReader({ client: clientFor(values) }).details('1.0.0'))
      .rejects.toThrow('curriculum_registry_unavailable')

    const mismatched = structuredClone(projections)
    mismatched.academy_admin_read_curriculum_release_v1.files[0].immutableLocator =
      'git_commit_path:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:curriculum-content/manuel-academy/1.0.0/README.md'
    await expect(createAdminCurriculumRegistryReader({ client: clientFor(mismatched) }).details('1.0.0'))
      .rejects.toThrow('curriculum_registry_unavailable')
  })

  it('distinguishes an absent immutable version from registry failure', async () => {
    const missing = { ...projections, academy_admin_read_curriculum_release_v1: null }
    await expect(createAdminCurriculumRegistryReader({ client: clientFor(missing) }).details('9.9.9'))
      .rejects.toMatchObject({ code: 'not-found' })
    const errorClient = { rpc: vi.fn(() => ({ abortSignal: vi.fn(async () => ({ data: null, error: { code: 'XX000' } })) })) }
    await expect(createAdminCurriculumRegistryReader({ client: errorClient }).list())
      .rejects.toThrow('curriculum_registry_unavailable')
  })

  it('accepts the structural registry maximum and marks limit + 1 as incomplete', async () => {
    const releases = Array.from({ length: ADMIN_CURRICULUM_RELEASE_LIST_LIMIT }, (_, index) => ({
      ...summary,
      version: `${index + 1}.0.0`,
      sourceRoot: `curriculum-content/manuel-academy/${index + 1}.0.0`,
    }))
    const reader = createAdminCurriculumRegistryReader({ client: clientFor({
      ...projections,
      academy_admin_list_curriculum_releases_v1: { schemaVersion: 1, releases },
    }) })
    await expect(reader.list()).resolves.toHaveProperty('releases.length', ADMIN_CURRICULUM_RELEASE_LIST_LIMIT)

    const overflowReader = createAdminCurriculumRegistryReader({ client: clientFor({
      ...projections,
      academy_admin_list_curriculum_releases_v1: {
        schemaVersion: 1,
        releases: [...releases, { ...summary, version: '1001.0.0', sourceRoot: 'curriculum-content/manuel-academy/1001.0.0' }],
      },
    }) })
    await expect(overflowReader.list()).rejects.toMatchObject({ code: 'incomplete' })

    const databaseOverflow = {
      rpc: vi.fn(() => ({
        abortSignal: vi.fn(async () => ({
          data: null, error: { message: 'CURRICULUM_RELEASE_LIST_LIMIT' },
        })),
      })),
    }
    await expect(createAdminCurriculumRegistryReader({ client: databaseOverflow }).list())
      .rejects.toMatchObject({ code: 'incomplete' })
  })

  it('reads staged-publish registry metadata without exposing embedded artifact bodies', async () => {
    const stagingId = '20000000-0000-4000-8000-000000000001'
    const stagedSummary = {
      ...summary,
      version: '2.0.0-rc.1',
      authoredOn: null,
      provenanceClass: 'staged_publish',
      sourceCommit: null,
      sourceRoot: null,
      stagingId,
      fileCount: 1,
      byteCount: 2,
    }
    const values = {
      ...projections,
      academy_admin_list_curriculum_releases_v1: { schemaVersion: 1, releases: [summary, stagedSummary] },
      academy_admin_read_curriculum_release_v1: {
        schemaVersion: 1,
        ...stagedSummary,
        digests: projections.academy_admin_read_curriculum_release_v1.digests,
        publicationEvidence: {
          stagingId,
          contentHash: hash,
          manifestHash: hash,
          packageHash: hash,
          activationStatus: 'not_active',
        },
        gradeCounts,
        files: [{
          path: 'snapshot/manifest.json',
          byteCount: 2,
          sha256: hash,
          contentType: 'application/json',
          safeClassification: 'immutable_embedded_json',
          immutableLocator: `curriculum_registry:${stagingId}:snapshot/manifest.json`,
          contents: 'must not cross the metadata reader',
        }],
      },
    }
    const reader = createAdminCurriculumRegistryReader({ client: clientFor(values) })
    await expect(reader.list()).resolves.toMatchObject({ releases: [{ version: '1.0.0' }, { version: '2.0.0-rc.1' }] })
    const detail = await reader.details('2.0.0-rc.1')
    expect(detail).toMatchObject({
      version: '2.0.0-rc.1', provenanceClass: 'staged_publish', stagingId,
      publicationEvidence: { activationStatus: 'not_active' },
      files: [{ safeClassification: 'immutable_embedded_json' }],
    })
    expect(JSON.stringify(detail)).not.toContain('must not cross')
  })

  it('projects every canonical release grade and verifies aggregate counts', async () => {
    const release2Counts = {
      courses: 90, units: 698, lessons: 8292, assessments: 699, texts: 0, schedules: 9,
    }
    const release2GradeCounts = Object.fromEntries([
      [3, 10, 77, 900, 77], [4, 10, 77, 900, 77], [5, 10, 77, 900, 77],
      [7, 10, 77, 900, 77], [8, 10, 78, 936, 79], [9, 10, 78, 936, 78],
      [10, 10, 78, 936, 78], [11, 10, 78, 936, 78], [12, 10, 78, 948, 78],
    ].map(([grade, courses, units, lessons, assessments]) => [String(grade), {
      courses, units, lessons, assessments, texts: 0, schedules: 1,
    }]))
    const values = structuredClone(projections)
    values.academy_admin_read_curriculum_release_v1 = {
      ...values.academy_admin_read_curriculum_release_v1,
      version: '2.0.0',
      sourceRoot: 'curriculum-content/manuel-academy/2.0.0',
      counts: release2Counts,
      gradeCounts: release2GradeCounts,
    }
    values.academy_admin_read_curriculum_release_v1.files[0].immutableLocator =
      'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/2.0.0/README.md'

    const reader = createAdminCurriculumRegistryReader({ client: clientFor(values) })
    await expect(reader.details('2.0.0')).resolves.toMatchObject({
      version: '2.0.0', counts: release2Counts, gradeCounts: release2GradeCounts,
    })

    values.academy_admin_read_curriculum_release_v1.counts.lessons--
    await expect(createAdminCurriculumRegistryReader({ client: clientFor(values) }).details('2.0.0'))
      .rejects.toThrow('curriculum_registry_unavailable')
  })

  it('projects governed default authority without claiming existing learner repins', async () => {
    const values = structuredClone(projections)
    values.academy_admin_read_curriculum_production_pointer_v1 = {
      ...values.academy_admin_read_curriculum_production_pointer_v1,
      releaseVersion: '2.0.0',
      revision: 2,
      changeKind: 'activation',
      bindingMode: 'default_authority',
      registryOnly: false,
      runtimeBinding: 'default-authority',
      existingLearnersRepinned: false,
    }
    await expect(createAdminCurriculumRegistryReader({ client: clientFor(values) }).productionPointer())
      .resolves.toMatchObject({
        releaseVersion: '2.0.0', revision: 2, changeKind: 'activation',
        bindingMode: 'default_authority', registryOnly: false,
        runtimeBinding: 'default-authority', existingLearnersRepinned: false,
      })

    delete values.academy_admin_read_curriculum_production_pointer_v1.existingLearnersRepinned
    await expect(createAdminCurriculumRegistryReader({ client: clientFor(values) }).productionPointer())
      .rejects.toThrow('curriculum_registry_unavailable')
  })

  it('projects the Study bridge for new sessions without repinning existing sessions', async () => {
    const values = structuredClone(projections)
    values.academy_admin_read_curriculum_production_pointer_v1 = {
      ...values.academy_admin_read_curriculum_production_pointer_v1,
      revision: 2,
      changeKind: 'bridge_activation',
      bindingMode: 'study_new_sessions',
      registryOnly: false,
      runtimeBinding: 'study-new-sessions',
    }
    await expect(createAdminCurriculumRegistryReader({ client: clientFor(values) }).productionPointer())
      .resolves.toMatchObject({
        revision: 2,
        changeKind: 'bridge_activation',
        bindingMode: 'study_new_sessions',
        registryOnly: false,
        runtimeBinding: 'study-new-sessions',
        existingLearnersRepinned: false,
      })
  })
})
