import { describe, expect, it, vi } from 'vitest'
import { CurriculumPublishingError } from './contracts'
import { createCurriculumPublishingHttpSource } from './httpSource'

const DRAFT = '10000000-0000-4000-8000-000000000001'
const STAGING = '20000000-0000-4000-8000-000000000001'
const REQUEST = '30000000-0000-4000-8000-000000000001'

describe('Curriculum publishing HTTP source', () => {
  it('sends only staging and idempotency identities to the bounded route', async () => {
    const json = vi.fn(async () => ({ schemaVersion: 1 }))
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
})
