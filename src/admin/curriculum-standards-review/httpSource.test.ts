import { describe, expect, it, vi } from 'vitest'
import { createCurriculumStandardsReviewHttpSource } from './httpSource'

const decision = {
  schemaVersion: 1 as const, reviewKey: 'csr-1234567890abcdef', contextKind: 'published_release' as const,
  contextRef: '1.0.0', sourceLabel: '2', grade: 5, courseRef: 'ma-g5-physical-education',
  findingRule: 'standards.human_review_required' as const, affectedCount: 1,
  findingIds: ['cvf-1234567890abcdef'], status: 'in_review' as const,
  canonicalStandardId: null, frameworkVersion: null, canonicalTitle: null,
  evidenceSource: null, reviewerNote: null, revision: 1, updatedAt: '2026-08-10T12:00:00Z',
}

describe('curriculum standards review HTTP source', () => {
  it('reads and writes through credential-minimized requests without serializing entity drill-down', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ schemaVersion: 1, decisions: [decision] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ schemaVersion: 1, replayed: false, decision }) })
    const source = createCurriculumStandardsReviewHttpSource(fetchImpl, async () => 'trusted-token')
    await source.list('published_release', '1.0.0')
    await source.update({
      ...decision,
      entities: [{ findingId: decision.findingIds[0], entityType: 'lesson', entityRef: 'lesson:one', path: 'lessons[0].standards[0]' }],
      expectedRevision: 1,
      idempotencyKey: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    })
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/admin/curriculum/standards-reviews/published_release/1.0.0')
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' })
    const sent = JSON.parse(fetchImpl.mock.calls[1][1].body as string)
    expect(sent.findingIds).toEqual(decision.findingIds)
    expect(sent).not.toHaveProperty('entities')
    expect(sent).not.toHaveProperty('actorUserRef')
  })

  it('fails closed without an access token or with a malformed response', async () => {
    await expect(createCurriculumStandardsReviewHttpSource(vi.fn(), async () => null).list('published_release', '1.0.0'))
      .rejects.toMatchObject({ code: 'unauthenticated' })
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ decisions: [{ raw: 'secret' }] }) })
    await expect(createCurriculumStandardsReviewHttpSource(fetchImpl, async () => 'token').list('published_release', '1.0.0'))
      .rejects.toMatchObject({ code: 'unavailable' })
  })

  it('rejects nested unexpected keys and cross-context decision identities', async () => {
    for (const injected of [
      { ...decision, reviewerNote: null, providerData: { secret: true } },
      { ...decision, contextRef: '2.0.0' },
    ]) {
      const fetchImpl = vi.fn().mockResolvedValue({
        ok: true, status: 200, json: async () => ({ schemaVersion: 1, decisions: [injected] }),
      })
      await expect(createCurriculumStandardsReviewHttpSource(fetchImpl, async () => 'token')
        .list('published_release', '1.0.0')).rejects.toMatchObject({ code: 'unavailable' })
    }
  })
})
