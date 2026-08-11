import { describe, expect, it, vi } from 'vitest'
import {
  createCurriculumReleaseHistoryHttpSource,
  parseCurriculumReleaseHistory,
} from './httpSource'

const COMMIT = '4056e31d8beb36622be5ac27ea7f20145266343b'
const STAGING_ID = '20000000-0000-4000-8000-000000000001'

function envelope(): any {
  const legacyRegisteredAt = '2026-08-09T16:00:00.000Z'
  const stagedRegisteredAt = '2026-08-10T15:00:00.000Z'
  return {
    schemaVersion: 1,
    releaseRegistry: {
      schemaVersion: 1,
      releases: [
        {
          packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
          version: '1.0.0',
          status: 'published',
          registeredAt: legacyRegisteredAt,
          authoredOn: '2026-08-03',
          provenanceClass: 'legacy_import',
          sourceCommit: COMMIT,
          sourceRoot: 'curriculum-content/manuel-academy/1.0.0',
          stagingId: null,
          fileCount: 182,
          byteCount: 23196845,
          counts: { courses: 30, units: 232, lessons: 2736, assessments: 232, texts: 18, schedules: 3 },
        },
        {
          packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
          version: '2.0.0-rc.1',
          status: 'published',
          registeredAt: stagedRegisteredAt,
          authoredOn: null,
          provenanceClass: 'staged_publish',
          sourceCommit: null,
          sourceRoot: null,
          stagingId: STAGING_ID,
          fileCount: 12,
          byteCount: 4096,
          counts: { courses: 1, units: 2, lessons: 3, assessments: 1, texts: 0, schedules: 1 },
        },
      ],
    },
    activation: {
      schemaVersion: 1,
      environment: 'production',
      authority: 'default_current_curriculum',
      existingLearnersRepinned: false,
      pointer: {
        releaseVersion: '2.0.0-rc.1', revision: 2, transitionKind: 'activation',
        bindingMode: 'default_authority', transitionedAt: '2026-08-10T16:00:00.000Z',
      },
      candidates: [
        {
          releaseVersion: '1.0.0', status: 'published', registeredAt: legacyRegisteredAt,
          artifactState: 'available', eligible: true, previouslyActive: true, active: false,
        },
        {
          releaseVersion: '2.0.0-rc.1', status: 'published', registeredAt: stagedRegisteredAt,
          artifactState: 'available', eligible: true, previouslyActive: true, active: true,
        },
      ],
      history: [
        {
          pointerRevision: 2, previousReleaseVersion: '1.0.0', newReleaseVersion: '2.0.0-rc.1',
          transitionKind: 'activation', reasonCode: 'release.activated',
          correlationId: '50000000-0000-4000-8000-000000000001',
          transitionedAt: '2026-08-10T16:00:00.000Z',
        },
        {
          pointerRevision: 1, previousReleaseVersion: null, newReleaseVersion: '1.0.0',
          transitionKind: 'migration_seed', reasonCode: null, correlationId: null,
          transitionedAt: legacyRegisteredAt,
        },
      ],
      historyTruncated: false,
    },
  }
}

describe('curriculum release history HTTP source', () => {
  it('performs one bearer-authenticated GET with no client authority or mutation input', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, status: 200, json: async () => envelope() }))
    const source = createCurriculumReleaseHistoryHttpSource(
      fetcher,
      async () => 'verified-token',
      '/api/admin/curriculum/history',
    )
    await expect(source.read()).resolves.toMatchObject({
      activeReleaseVersion: '2.0.0-rc.1',
      releases: expect.arrayContaining([expect.objectContaining({
        version: '2.0.0-rc.1',
        provenanceKind: 'staged_publish',
        provenanceCompleteness: 'complete',
        sourceCommit: null,
        sourceRoot: null,
        stagingId: STAGING_ID,
      })]),
    })
    expect(fetcher).toHaveBeenCalledWith('/api/admin/curriculum/history', {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: 'Bearer verified-token' },
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
    expect(JSON.stringify(fetcher.mock.calls)).not.toMatch(/releases:manage|actor|learner|student/i)
  })

  it('fails closed on malformed provenance, transition, or privacy-expanding evidence', () => {
    const malformedProvenance = envelope()
    malformedProvenance.releaseRegistry.releases[0].sourceRoot = '../private'
    expect(() => parseCurriculumReleaseHistory(malformedProvenance)).toThrow('unavailable')

    const crossedStagedProvenance = envelope()
    crossedStagedProvenance.releaseRegistry.releases[1].sourceCommit = COMMIT
    expect(() => parseCurriculumReleaseHistory(crossedStagedProvenance)).toThrow('unavailable')

    const crossedLegacyProvenance = envelope()
    crossedLegacyProvenance.releaseRegistry.releases[0].stagingId = STAGING_ID
    expect(() => parseCurriculumReleaseHistory(crossedLegacyProvenance)).toThrow('unavailable')

    const malformedStagingIdentity = envelope()
    malformedStagingIdentity.releaseRegistry.releases[1].stagingId = '../private'
    expect(() => parseCurriculumReleaseHistory(malformedStagingIdentity)).toThrow('unavailable')

    const missingControlsFinalField = envelope()
    delete missingControlsFinalField.releaseRegistry.releases[0].stagingId
    expect(() => parseCurriculumReleaseHistory(missingControlsFinalField)).toThrow('unavailable')

    const malformedTransition = envelope()
    malformedTransition.activation.history[0].actorUserRef = 'full-actor-identity'
    expect(() => parseCurriculumReleaseHistory(malformedTransition)).toThrow('unavailable')

    const repinningClaim = envelope()
    repinningClaim.activation.existingLearnersRepinned = true
    expect(() => parseCurriculumReleaseHistory(repinningClaim)).toThrow('unavailable')
  })

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [503, 'unavailable'],
  ])('maps HTTP %s to bounded %s state without reading an error body', async (status, code) => {
    const json = vi.fn(async () => ({ rawError: '/private/source' }))
    const source = createCurriculumReleaseHistoryHttpSource(
      async () => ({ ok: false, status, json }),
      async () => 'verified-token',
    )
    await expect(source.read()).rejects.toMatchObject({ code })
    expect(json).not.toHaveBeenCalled()
  })
})
