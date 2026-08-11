import { describe, expect, it, vi } from 'vitest'
import { CurriculumStagingError } from './contracts'
import { createCurriculumStagingHttpSource } from './httpSource'

const DRAFT = '10000000-0000-4000-8000-000000000001'
const REQUEST = '20000000-0000-4000-8000-000000000001'

function status(replayed?: boolean) {
  return {
    schemaVersion: 1,
    ...(replayed === undefined ? {} : { replayed }),
    draftId: DRAFT,
    draftRevision: 9,
    baseReleaseVersion: '1.0.0',
    targetVersion: '2.0.0-rc.1',
    schemaSetVersion: '2.0.0',
    stageState: replayed === undefined ? 'eligible' : 'staged',
    eligible: replayed === undefined,
    blockingReasons: [],
    validation: { status: 'valid', validationSnapshotId: '30000000-0000-4000-8000-000000000001' },
    approval: { status: 'approved', approvalId: '40000000-0000-4000-8000-000000000001' },
    candidate: replayed === undefined ? null : {
      stagingId: REQUEST, status: 'staged', publicationStatus: 'not_published',
      validationSnapshotId: '30000000-0000-4000-8000-000000000001',
      approvalId: '40000000-0000-4000-8000-000000000001', entityCounts: { courses: 30 },
      fileCount: 10, byteCount: 1000, contentHash: 'a'.repeat(64), manifestHash: 'b'.repeat(64),
      packageHash: 'c'.repeat(64), stagedAt: '2026-08-10T12:00:00Z', authority: 'curriculum:publish',
    },
  }
}

describe('Curriculum staging HTTP source', () => {
  it('sends only the exact revision and idempotency identity to the stage route', async () => {
    const json = vi.fn()
      .mockResolvedValueOnce(status())
      .mockResolvedValueOnce(status(false))
    const fetchImpl = vi.fn(async (_input: string, _init: RequestInit) => ({ ok: true, status: 200, json }))
    const source = createCurriculumStagingHttpSource(fetchImpl, async () => 'trusted-token')
    await source.readStaging(DRAFT)
    await source.stageDraft({ draftId: DRAFT, draftRevision: 9, idempotencyKey: REQUEST })
    expect(fetchImpl.mock.calls[0][0]).toBe(`/api/admin/curriculum/drafts/${DRAFT}/staging`)
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: 'GET', credentials: 'omit', cache: 'no-store' })
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ draftRevision: 9, idempotencyKey: REQUEST }),
    })
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toMatch(/actor|role|capabilities/i)
  })

  it.each([
    [401, undefined, 'unauthenticated', undefined],
    [403, undefined, 'forbidden', undefined],
    [409, 'staging_gate_blocked', 'conflict', 'gate-blocked'],
    [409, 'target_version_collision', 'conflict', 'target-version-collision'],
    [409, 'staging_package_conflict', 'conflict', 'package-conflict'],
    [503, undefined, 'unavailable', undefined],
  ] as const)('maps HTTP %s / %s without leaking response details', async (httpStatus, responseCode, code, reason) => {
    const source = createCurriculumStagingHttpSource(
      vi.fn(async () => ({
        ok: false,
        status: httpStatus,
        json: vi.fn(async () => ({ error: { code: responseCode, detail: 'private' } })),
      })),
      async () => 'trusted-token',
    )
    await expect(source.readStaging(DRAFT)).rejects.toEqual(new CurriculumStagingError(code, reason))
  })

  it('fails closed without an authenticated token', async () => {
    const fetchImpl = vi.fn()
    const source = createCurriculumStagingHttpSource(fetchImpl, async () => null)
    await expect(source.readStaging(DRAFT)).rejects.toMatchObject({ code: 'unauthenticated' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects malformed success DTOs instead of retaining injected data', async () => {
    const source = createCurriculumStagingHttpSource(
      vi.fn(async () => ({
        ok: true, status: 200,
        json: vi.fn(async () => ({ ...status(), providerData: { signedUrl: 'secret' } })),
      })),
      async () => 'trusted-token',
    )
    await expect(source.readStaging(DRAFT)).rejects.toEqual(new CurriculumStagingError('unavailable'))
  })
})
