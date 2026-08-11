import { describe, expect, it, vi } from 'vitest'
import { createAdminCurriculumHandler } from './admin-curriculum.js'

const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const REQUEST = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const DRAFT = '10000000-0000-4000-8000-000000000001'
const principal = { userId: ACTOR, role: 'owner', capabilities: ['curriculum:read', 'curriculum:drafts:write', 'curriculum:approve'] }

function event(path, method = 'GET', body) {
  return {
    path, httpMethod: method, queryStringParameters: null,
    headers: { authorization: 'Bearer verified', ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body), isBase64Encoded: false } : {}),
  }
}

function body(overrides = {}) {
  return {
    reviewKey: 'csr-1234567890abcdef', contextKind: 'published_release', contextRef: '1.0.0',
    sourceLabel: '2', grade: 5, courseRef: 'ma-g5-physical-education',
    findingRule: 'standards.human_review_required', affectedCount: 2,
    findingIds: ['cvf-1234567890abcdef', 'cvf-fedcba0987654321'], status: 'in_review',
    canonicalStandardId: null, frameworkVersion: null, canonicalTitle: null,
    evidenceSource: null, reviewerNote: null, expectedRevision: 0, idempotencyKey: REQUEST,
    ...overrides,
  }
}

function handler(overrides = {}) {
  return createAdminCurriculumHandler({
    source: { loadCatalog: vi.fn(), loadLesson: vi.fn(), loadValidationEvidence: vi.fn() },
    registry: { list: vi.fn(), details: vi.fn(), productionPointer: vi.fn() },
    authoring: {},
    ...overrides,
  })
}

describe('curriculum standards review API', () => {
  it('reads only the requested draft revision workspace identity', async () => {
    const studio = {
      readStandardsReview: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        draftId: DRAFT,
        draftRevision: 7,
        baseReleaseVersion: '1.0.0',
        targetVersion: '2.0.0-draft.1',
        occurrences: [],
        decisions: [],
      }),
    }
    const authorization = { require: vi.fn().mockResolvedValue({ ok: true, principal }) }
    const handle = handler({ studio, authorization })

    const response = await handle(event(`/api/admin/curriculum/drafts/${DRAFT}/standards-review/7`))
    expect(response.statusCode).toBe(200)
    expect(authorization.require).toHaveBeenCalledWith(expect.anything(), 'curriculum:read')
    expect(studio.readStandardsReview).toHaveBeenCalledWith(ACTOR, DRAFT, 7)
    expect(JSON.parse(response.body)).toMatchObject({ draftId: DRAFT, draftRevision: 7 })
    expect((await handle(event(`/api/admin/curriculum/drafts/${DRAFT}/standards-review/7`, 'POST', {}))).statusCode).toBe(405)
  })

  it('reads decisions with curriculum:read and no browser authority parameters', async () => {
    const standardsReview = { list: vi.fn().mockResolvedValue({ schemaVersion: 1, decisions: [] }), update: vi.fn() }
    const authorization = { require: vi.fn().mockResolvedValue({ ok: true, principal }) }
    const handle = handler({ standardsReview, authorization })

    const response = await handle(event('/api/admin/curriculum/standards-reviews/published_release/1.0.0'))
    expect(response.statusCode).toBe(200)
    expect(authorization.require).toHaveBeenCalledWith(expect.anything(), 'curriculum:read')
    expect(standardsReview.list).toHaveBeenCalledWith(ACTOR, 'published_release', '1.0.0')
  })

  it('does not expose draft decisions to a globally capable unassigned principal', async () => {
    const standardsReview = { list: vi.fn(), update: vi.fn() }
    const authoring = {
      read: vi.fn().mockRejectedValue(Object.assign(new Error('private draft row'), { code: 'forbidden' })),
    }
    const handle = handler({
      authoring,
      standardsReview,
      authorization: { require: vi.fn().mockResolvedValue({ ok: true, principal }) },
    })
    const response = await handle(event(`/api/admin/curriculum/standards-reviews/draft/${DRAFT}`))
    expect(response.statusCode).toBe(403)
    expect(response.body).toContain('curriculum_collaboration_required')
    expect(response.body).not.toContain('private')
    expect(standardsReview.list).not.toHaveBeenCalled()
  })

  it('uses draft write capability for workflow states and preserves unresolved labels', async () => {
    const standardsReview = { list: vi.fn(), update: vi.fn().mockResolvedValue({ schemaVersion: 1, replayed: false }) }
    const authorization = { require: vi.fn().mockResolvedValue({ ok: true, principal }) }
    const handle = handler({ standardsReview, authorization })

    for (const [index, status] of ['in_review', 'rejected_mapping', 'needs_evidence'].entries()) {
      const response = await handle(event('/api/admin/curriculum/standards-reviews', 'POST', body({
        status,
        reviewerNote: status === 'in_review' ? null : 'Repository evidence is not sufficient.',
        idempotencyKey: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${index}`,
      })))
      expect(response.statusCode).toBe(200)
    }
    expect(authorization.require.mock.calls.map((call) => call[1])).toEqual([
      'curriculum:drafts:write', 'curriculum:drafts:write', 'curriculum:drafts:write',
    ])
    for (const call of standardsReview.update.mock.calls) {
      expect(call[1]).toMatchObject({ sourceLabel: '2', canonicalStandardId: null, frameworkVersion: null })
      expect(call[1].requestDigest).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it('requires a current draft assignment before changing draft-context review evidence', async () => {
    const standardsReview = { list: vi.fn(), update: vi.fn() }
    const authoring = {
      read: vi.fn().mockRejectedValue(Object.assign(new Error('private assignment'), { code: 'forbidden' })),
    }
    const handle = handler({
      authoring,
      standardsReview,
      authorization: { require: vi.fn().mockResolvedValue({ ok: true, principal }) },
    })
    const response = await handle(event('/api/admin/curriculum/standards-reviews', 'POST', body({
      contextKind: 'draft',
      contextRef: DRAFT,
    })))
    expect(response.statusCode).toBe(403)
    expect(response.body).toContain('curriculum_collaboration_required')
    expect(standardsReview.update).not.toHaveBeenCalled()
  })

  it('keeps an assigned globally capable reviewer from changing standards evidence', async () => {
    const standardsReview = { list: vi.fn(), update: vi.fn() }
    const authoring = {
      read: vi.fn().mockResolvedValue({ draftId: DRAFT }),
      listCollaborators: vi.fn().mockResolvedValue({ currentResponsibility: 'reviewer' }),
    }
    const handle = handler({
      authoring,
      standardsReview,
      authorization: { require: vi.fn().mockResolvedValue({ ok: true, principal }) },
    })
    const response = await handle(event('/api/admin/curriculum/standards-reviews', 'POST', body({
      contextKind: 'draft', contextRef: DRAFT,
    })))
    expect(response.statusCode).toBe(403)
    expect(response.body).not.toContain('reviewer')
    expect(standardsReview.update).not.toHaveBeenCalled()
  })

  it('requires curriculum:approve and every explicit evidence field for an approved mapping', async () => {
    const standardsReview = { list: vi.fn(), update: vi.fn().mockResolvedValue({ schemaVersion: 1, replayed: false }) }
    const authorization = { require: vi.fn().mockResolvedValue({ ok: true, principal }) }
    const handle = handler({ standardsReview, authorization })
    const approved = body({
      status: 'approved_mapping', canonicalStandardId: 'verified-id',
      frameworkVersion: 'verified-version', canonicalTitle: 'Verified standard title',
      evidenceSource: 'Official source reference supplied by the reviewer',
      reviewerNote: 'Verified against the cited source.',
    })

    expect((await handle(event('/api/admin/curriculum/standards-reviews', 'POST', approved))).statusCode).toBe(200)
    expect(authorization.require).toHaveBeenCalledWith(expect.anything(), 'curriculum:approve')
    expect(standardsReview.update).toHaveBeenCalledWith(ACTOR, expect.objectContaining({
      canonicalStandardId: 'verified-id', frameworkVersion: 'verified-version',
    }))

    for (const field of ['canonicalStandardId', 'frameworkVersion', 'canonicalTitle', 'evidenceSource', 'reviewerNote']) {
      const missing = await handle(event('/api/admin/curriculum/standards-reviews', 'POST', {
        ...approved, [field]: null, idempotencyKey: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      }))
      expect(missing.statusCode).toBe(422)
      expect(missing.body).toContain('standards_mapping_evidence_required')
    }
    expect(standardsReview.update).toHaveBeenCalledTimes(1)
  })

  it('rejects invented authority fields, duplicate finding IDs, and mapping data on non-approval states', async () => {
    const standardsReview = { list: vi.fn(), update: vi.fn() }
    const handle = handler({ standardsReview, authorization: { require: vi.fn() } })
    const attempts = [
      { ...body(), actorUserRef: 'forged-owner' },
      body({ findingIds: ['cvf-1234567890abcdef', 'cvf-1234567890abcdef'] }),
      body({ canonicalStandardId: 'silently-invented-id' }),
    ]
    for (const attempt of attempts) {
      expect((await handle(event('/api/admin/curriculum/standards-reviews', 'POST', attempt))).statusCode).toBe(400)
    }
    expect(standardsReview.update).not.toHaveBeenCalled()
  })

  it('maps CAS and replay conflicts without returning raw database details', async () => {
    for (const code of ['conflict', 'replay-conflict']) {
      const standardsReview = {
        list: vi.fn(),
        update: vi.fn().mockRejectedValue(Object.assign(new Error('private review row'), { code })),
      }
      const handle = handler({
        standardsReview,
        authorization: { require: vi.fn().mockResolvedValue({ ok: true, principal }) },
      })
      const response = await handle(event('/api/admin/curriculum/standards-reviews', 'POST', body()))
      expect(response.statusCode).toBe(409)
      expect(response.body).not.toContain('private')
    }
  })
})
