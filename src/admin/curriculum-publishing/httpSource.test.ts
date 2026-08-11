import { describe, expect, it, vi } from 'vitest'
import { CurriculumPublishingError } from './contracts'
import { createCurriculumPublishingHttpSource } from './httpSource'

const DRAFT = '10000000-0000-4000-8000-000000000001'
const STAGING = '20000000-0000-4000-8000-000000000001'
const REQUEST = '30000000-0000-4000-8000-000000000001'
const VALIDATION = '40000000-0000-4000-8000-000000000001'
const APPROVAL = '50000000-0000-4000-8000-000000000001'
const HASH = 'a'.repeat(64)

function status(isPublished = false) {
  return {
    schemaVersion: 1, draftId: DRAFT, draftRevision: 4,
    baseReleaseVersion: '1.0.0', targetVersion: '2.0.0-rc.1', schemaSetVersion: '2.0.0',
    publicationState: isPublished ? 'published' : 'eligible', eligible: !isPublished,
    blockingReasons: [],
    candidate: {
      stagingId: STAGING, status: 'staged', draftRevision: 4,
      validationSnapshotId: VALIDATION, validationStatus: 'publication_ready',
      approvalId: APPROVAL, approvalStatus: 'current', humanReviewStatus: 'clear',
      fileCount: 10, byteCount: 2000, contentHash: HASH,
      manifestHash: 'b'.repeat(64), packageHash: 'c'.repeat(64),
      verification: {
        artifactSetComplete: true, contentVerified: true, manifestVerified: true,
        packageVerified: true, actualFileCount: 10, actualByteCount: 2000,
      },
    },
    published: isPublished ? {
      releaseId: STAGING, version: '2.0.0-rc.1', status: 'published', activationStatus: 'not_active',
      stagingId: STAGING, contentHash: HASH, manifestHash: 'b'.repeat(64), packageHash: 'c'.repeat(64),
      fileCount: 10, byteCount: 2000, publishedAt: '2026-08-10T14:00:00.000Z',
      authority: 'curriculum:publish',
    } : null,
  }
}

describe('Curriculum publishing HTTP source', () => {
  it('sends only staging and idempotency identities to the bounded route', async () => {
    const json = vi.fn().mockResolvedValueOnce(status()).mockResolvedValueOnce({ ...status(true), replayed: false })
    const fetchImpl = vi.fn(async (_input: string, _init: RequestInit) => ({ ok: true, status: 200, json }))
    const source = createCurriculumPublishingHttpSource(fetchImpl, async () => 'trusted-token')
    await source.readPublication(DRAFT)
    await source.publishStaged({ draftId: DRAFT, stagingId: STAGING, idempotencyKey: REQUEST })
    expect(fetchImpl.mock.calls[0][0]).toBe(`/api/admin/curriculum/drafts/${DRAFT}/publishing`)
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ stagingId: STAGING, idempotencyKey: REQUEST }),
      credentials: 'omit',
      cache: 'no-store',
    })
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toMatch(/actor|role|capabilities/i)
  })

  it.each([
    [401, undefined, 'unauthenticated', undefined],
    [403, undefined, 'forbidden', undefined],
    [409, 'publication_artifact_invalid', 'conflict', 'artifact-invalid'],
    [409, 'publication_manifest_mismatch', 'conflict', 'manifest-mismatch'],
    [409, 'publication_package_mismatch', 'conflict', 'package-mismatch'],
    [409, 'publication_approval_stale', 'conflict', 'approval-stale'],
    [409, 'publication_validation_blocked', 'conflict', 'validation-blocked'],
    [409, 'publication_human_review_blocked', 'conflict', 'human-review-blocked'],
    [503, undefined, 'unavailable', undefined],
  ] as const)('maps HTTP %s / %s safely', async (httpStatus, responseCode, code, reason) => {
    const source = createCurriculumPublishingHttpSource(
      vi.fn(async () => ({
        ok: false,
        status: httpStatus,
        json: vi.fn(async () => ({ error: { code: responseCode, detail: 'private' } })),
      })),
      async () => 'trusted-token',
    )
    await expect(source.readPublication(DRAFT)).rejects.toEqual(new CurriculumPublishingError(code, reason))
  })

  it('fails closed before fetch without an authenticated token', async () => {
    const fetchImpl = vi.fn()
    const source = createCurriculumPublishingHttpSource(fetchImpl, async () => null)
    await expect(source.readPublication(DRAFT)).rejects.toMatchObject({ code: 'unauthenticated' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects false eligibility, incomplete verification, and a 200 mutation that did not publish', async () => {
    const forged = status()
    forged.candidate.verification.packageVerified = false
    const malformedSource = createCurriculumPublishingHttpSource(
      vi.fn(async () => ({ ok: true, status: 200, json: async () => forged })),
      async () => 'token',
    )
    await expect(malformedSource.readPublication(DRAFT)).rejects.toMatchObject({ code: 'unavailable' })

    const noPublication = createCurriculumPublishingHttpSource(
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ...status(), replayed: false }) })),
      async () => 'token',
    )
    await expect(noPublication.publishStaged({
      draftId: DRAFT, stagingId: STAGING, idempotencyKey: REQUEST,
    })).rejects.toMatchObject({ code: 'unavailable' })
  })

  it('rejects unexpected success keys and raw exception-shaped payloads', async () => {
    const source = createCurriculumPublishingHttpSource(
      vi.fn(async () => ({
        ok: true, status: 200,
        json: async () => ({ ...status(), rawException: 'private database body' }),
      })),
      async () => 'token',
    )
    await expect(source.readPublication(DRAFT)).rejects.toEqual(new CurriculumPublishingError('unavailable'))
  })

  it('bounds a token dependency that never settles', async () => {
    vi.useFakeTimers()
    try {
      const source = createCurriculumPublishingHttpSource(
        vi.fn(), () => new Promise(() => {}), '/api/admin/curriculum/drafts', 25,
      )
      const read = source.readPublication(DRAFT)
      const rejected = expect(read).rejects.toEqual(new CurriculumPublishingError('unavailable'))
      await vi.advanceTimersByTimeAsync(26)
      await rejected
    } finally {
      vi.useRealTimers()
    }
  })
})
