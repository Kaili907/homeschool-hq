import { describe, expect, it, vi } from 'vitest'
import { createAdminCurriculumStandardsReviewService } from './admin-curriculum-standards-review.js'

const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function decision(overrides = {}) {
  return {
    schemaVersion: 1, reviewKey: 'csr-1234567890abcdef', contextKind: 'published_release',
    contextRef: '1.0.0', sourceLabel: '2', grade: 5, courseRef: 'ma-g5-physical-education',
    findingRule: 'standards.human_review_required', affectedCount: 1,
    findingIds: ['cvf-1234567890abcdef'], status: 'in_review', canonicalStandardId: null,
    frameworkVersion: null, canonicalTitle: null, evidenceSource: null, reviewerNote: null,
    revision: 1, updatedAt: '2026-08-10T12:00:00Z', ...overrides,
  }
}

function client(result) {
  const abortSignal = vi.fn().mockResolvedValue(result)
  return { rpc: vi.fn(() => ({ abortSignal })), abortSignal }
}

describe('curriculum standards review database service', () => {
  it('uses narrow read and mutation RPCs with server-derived capabilities', async () => {
    const database = client({ data: { schemaVersion: 1, decisions: [decision()] }, error: null })
    const service = createAdminCurriculumStandardsReviewService({ client: database })
    expect((await service.list(ACTOR, 'published_release', '1.0.0')).decisions).toHaveLength(1)
    expect(database.rpc).toHaveBeenCalledWith('academy_admin_list_curriculum_standard_reviews_v1', {
      p_actor_user_ref: ACTOR, p_context_kind: 'published_release', p_context_ref: '1.0.0',
      p_required_capability: 'curriculum:read',
    })

    database.abortSignal.mockResolvedValue({ data: {
      schemaVersion: 1, replayed: false, decision: decision({
        status: 'approved_mapping', canonicalStandardId: 'verified-id', frameworkVersion: 'verified-version',
        canonicalTitle: 'Verified title', evidenceSource: 'Official source reference',
        reviewerNote: 'Evidence reviewed.', revision: 2,
      }),
    }, error: null })
    await service.update(ACTOR, {
      ...decision(), status: 'approved_mapping', canonicalStandardId: 'verified-id',
      frameworkVersion: 'verified-version', canonicalTitle: 'Verified title',
      evidenceSource: 'Official source reference', reviewerNote: 'Evidence reviewed.',
      expectedRevision: 1, idempotencyKey: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      requestDigest: 'a'.repeat(64),
    })
    expect(database.rpc.mock.calls.at(-1)[1]).toMatchObject({
      p_required_capability: 'curriculum:approve', p_status: 'approved_mapping',
      p_canonical_standard_id: 'verified-id',
    })
  })

  it('fails closed on malformed projections and maps known conflicts', async () => {
    const malformed = client({ data: { schemaVersion: 1, decisions: [{ secret: 'raw' }] }, error: null })
    await expect(createAdminCurriculumStandardsReviewService({ client: malformed }).list(ACTOR, 'published_release', '1.0.0'))
      .rejects.toMatchObject({ code: 'unavailable' })

    const conflict = client({ data: null, error: { message: 'CURRICULUM_STANDARDS_REVIEW_CAS_CONFLICT private' } })
    await expect(createAdminCurriculumStandardsReviewService({ client: conflict }).update(ACTOR, {
      ...decision(), expectedRevision: 1, idempotencyKey: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', requestDigest: 'a'.repeat(64),
    })).rejects.toMatchObject({ code: 'conflict' })
  })
})
