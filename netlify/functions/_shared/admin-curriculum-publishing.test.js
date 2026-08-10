import { describe, expect, it, vi } from 'vitest'
import {
  adminCurriculumPublishingInternals,
  createAdminCurriculumPublishingPersistence,
} from './admin-curriculum-publishing.js'

const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const DRAFT = '10000000-0000-4000-8000-000000000001'
const STAGING = '20000000-0000-4000-8000-000000000001'
const REQUEST = '30000000-0000-4000-8000-000000000001'
const HASH = 'a'.repeat(64)

function status(published = false) {
  return {
    schemaVersion: 1,
    draftId: DRAFT,
    draftRevision: 4,
    baseReleaseVersion: '1.0.0',
    targetVersion: '2.0.0-rc.1',
    schemaSetVersion: '2.0.0',
    publicationState: published ? 'published' : 'eligible',
    eligible: !published,
    blockingReasons: [],
    candidate: {
      stagingId: STAGING,
      status: 'staged',
      draftRevision: 4,
      validationSnapshotId: '40000000-0000-4000-8000-000000000001',
      validationStatus: 'publication_ready',
      approvalId: '50000000-0000-4000-8000-000000000001',
      approvalStatus: 'current',
      humanReviewStatus: 'clear',
      fileCount: 10,
      byteCount: 2000,
      contentHash: HASH,
      manifestHash: 'b'.repeat(64),
      packageHash: 'c'.repeat(64),
      verification: {
        artifactSetComplete: true,
        contentVerified: true,
        manifestVerified: true,
        packageVerified: true,
        actualFileCount: 10,
        actualByteCount: 2000,
      },
    },
    published: published ? {
      releaseId: STAGING,
      version: '2.0.0-rc.1',
      status: 'published',
      activationStatus: 'not_active',
      stagingId: STAGING,
      contentHash: HASH,
      manifestHash: 'b'.repeat(64),
      packageHash: 'c'.repeat(64),
      fileCount: 10,
      byteCount: 2000,
      publishedAt: '2026-08-10T14:00:00.000Z',
      authority: 'curriculum:publish',
    } : null,
  }
}

describe('curriculum publication persistence boundary', () => {
  it('uses narrow read/publish RPCs, server-generated digest, and exact capability markers', async () => {
    const rpc = vi.fn()
      .mockReturnValueOnce({ abortSignal: vi.fn().mockResolvedValue({ data: status(), error: null }) })
      .mockReturnValueOnce({ abortSignal: vi.fn().mockResolvedValue({ data: { ...status(true), replayed: false }, error: null }) })
    const persistence = createAdminCurriculumPublishingPersistence({ client: { rpc } })
    await expect(persistence.read(ACTOR, DRAFT)).resolves.toMatchObject({ publicationState: 'eligible' })
    await expect(persistence.publish(ACTOR, STAGING, REQUEST)).resolves.toMatchObject({
      publicationState: 'published', replayed: false,
      published: { activationStatus: 'not_active' },
    })
    expect(rpc.mock.calls[0]).toEqual(['academy_admin_read_curriculum_publication_v1', {
      p_actor_user_ref: ACTOR,
      p_draft_id: DRAFT,
      p_required_capability: 'curriculum:read',
    }])
    expect(rpc.mock.calls[1][0]).toBe('academy_admin_publish_curriculum_release_v1')
    expect(rpc.mock.calls[1][1]).toMatchObject({
      p_actor_user_ref: ACTOR,
      p_staging_id: STAGING,
      p_request_id: REQUEST,
      p_required_capability: 'curriculum:publish',
    })
    expect(rpc.mock.calls[1][1].p_request_digest).toMatch(/^[0-9a-f]{64}$/)
  })

  it('fails closed on malformed projections and database verification conflicts', async () => {
    const malformed = structuredClone(status())
    malformed.candidate.verification.packageVerified = 'yes'
    expect(adminCurriculumPublishingInternals.status(malformed)).toBeNull()

    for (const [marker, code] of [
      ['CURRICULUM_PUBLICATION_ARTIFACT_INVALID', 'artifact-invalid'],
      ['CURRICULUM_PUBLICATION_MANIFEST_MISMATCH', 'manifest-mismatch'],
      ['CURRICULUM_PUBLICATION_PACKAGE_MISMATCH', 'package-mismatch'],
      ['CURRICULUM_PUBLICATION_APPROVAL_STALE', 'approval-stale'],
      ['CURRICULUM_PUBLICATION_VALIDATION_BLOCKED', 'validation-blocked'],
      ['CURRICULUM_PUBLICATION_HUMAN_REVIEW_BLOCKED', 'human-review-blocked'],
      ['CURRICULUM_PUBLICATION_REPLAY_CONFLICT', 'replay-conflict'],
    ]) {
      const client = {
        rpc: vi.fn(() => ({
          abortSignal: vi.fn(async () => ({ data: null, error: { message: marker } })),
        })),
      }
      await expect(createAdminCurriculumPublishingPersistence({ client }).publish(ACTOR, STAGING, REQUEST))
        .rejects.toMatchObject({ code })
    }
  })
})
