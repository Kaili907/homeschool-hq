import { describe, expect, it, vi } from 'vitest'
import {
  createCurriculumReleaseHistoryHttpSource,
  parseCurriculumReleaseHistory,
} from './httpSource'

const COMMIT = '4056e31d8beb36622be5ac27ea7f20145266343b'

function envelope(): any {
  const registeredAt = '2026-08-09T16:00:00.000Z'
  return {
    schemaVersion: 1,
    releaseRegistry: {
      schemaVersion: 1,
      releases: [{
        packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
        version: '1.0.0',
        status: 'published',
        registeredAt,
        authoredOn: '2026-08-03',
        provenanceClass: 'legacy_import',
        sourceCommit: COMMIT,
        sourceRoot: 'curriculum-content/manuel-academy/1.0.0',
        fileCount: 182,
        byteCount: 23196845,
        counts: { courses: 30, units: 232, lessons: 2736, assessments: 232, texts: 18, schedules: 3 },
      }],
    },
    activation: {
      schemaVersion: 1,
      environment: 'production',
      authority: 'default_current_curriculum',
      existingLearnersRepinned: false,
      pointer: {
        releaseVersion: '1.0.0', revision: 1, transitionKind: 'migration_seed',
        bindingMode: 'registry_only', transitionedAt: registeredAt,
      },
      candidates: [{
        releaseVersion: '1.0.0', status: 'published', registeredAt,
        artifactState: 'available', eligible: true, previouslyActive: true, active: true,
      }],
      history: [{
        pointerRevision: 1, previousReleaseVersion: null, newReleaseVersion: '1.0.0',
        transitionKind: 'migration_seed', reasonCode: null, correlationId: null,
        transitionedAt: registeredAt,
      }],
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
    await expect(source.read()).resolves.toMatchObject({ activeReleaseVersion: '1.0.0' })
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
