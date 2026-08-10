import { describe, expect, it, vi } from 'vitest'
import { createAdminCurriculumRegistryReader } from './admin-curriculum-registry-reader.js'

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
    revision: 2,
    changeKind: 'bridge_activation',
    bindingMode: 'study_new_sessions',
    registryOnly: false,
    runtimeBinding: 'study-new-sessions',
    registeredAt: '2026-08-10T15:30:00.000Z',
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
      releaseVersion: '1.0.0', registryOnly: false, runtimeBinding: 'study-new-sessions',
    })
    expect(client.rpc.mock.calls).toEqual([
      ['academy_admin_list_curriculum_releases_v1', { p_required_capability: 'curriculum:read' }],
      ['academy_admin_read_curriculum_release_v1', { p_version: '1.0.0', p_required_capability: 'curriculum:read' }],
      ['academy_admin_read_curriculum_production_pointer_v1', { p_required_capability: 'curriculum:read' }],
    ])
  })

  it('accepts the historical registry-only seed while rejecting mixed authority states', async () => {
    const historical = structuredClone(projections)
    historical.academy_admin_read_curriculum_production_pointer_v1 = {
      ...historical.academy_admin_read_curriculum_production_pointer_v1,
      revision: 1,
      changeKind: 'migration_seed',
      bindingMode: 'registry_only',
      registryOnly: true,
      runtimeBinding: 'hard-coded',
      registeredAt: '2026-08-09T16:00:00.000Z',
    }
    await expect(createAdminCurriculumRegistryReader({ client: clientFor(historical) })
      .productionPointer()).resolves.toMatchObject({ registryOnly: true })

    const mixed = structuredClone(projections)
    mixed.academy_admin_read_curriculum_production_pointer_v1.registryOnly = true
    await expect(createAdminCurriculumRegistryReader({ client: clientFor(mixed) })
      .productionPointer()).rejects.toThrow('curriculum_registry_unavailable')
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
})
