import { describe, expect, it, vi } from 'vitest'
import { createCurriculumDraftAuthoringHttpSource } from './httpSource'

const DRAFT = '10000000-0000-4000-8000-000000000001'
const REQUEST = '20000000-0000-4000-8000-000000000001'

describe('Curriculum Studio authoring HTTP source', () => {
  it('sends only the exact create contract and bearer credential', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true, status: 201,
      json: vi.fn().mockResolvedValue({ schemaVersion: 1, replayed: false, draftId: DRAFT, draftRevision: 1 }),
    })
    const source = createCurriculumDraftAuthoringHttpSource(fetchImpl, async () => 'verified-token')
    await source.createDraft({
      baseReleaseVersion: '1.0.0', targetVersion: '2.0.0-draft.1',
      authoringSchemaVersion: '2.0.0', idempotencyKey: REQUEST,
    })
    expect(fetchImpl).toHaveBeenCalledWith('/api/admin/curriculum/drafts', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer verified-token' }),
    }))
    const request = fetchImpl.mock.calls[0][1]
    expect(JSON.parse(request.body)).toEqual({
      baseReleaseVersion: '1.0.0', targetVersion: '2.0.0-draft.1',
      authoringSchemaVersion: '2.0.0', idempotencyKey: REQUEST,
    })
    expect(request.body).not.toMatch(/actor|role|capabilit|timestamp|digest/i)
  })

  it('keeps route identity out of the CAS body and maps conflicts safely', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false, status: 409,
      json: vi.fn().mockResolvedValue({ error: { code: 'idempotency_conflict' } }),
    })
    const source = createCurriculumDraftAuthoringHttpSource(fetchImpl, async () => 'verified-token')
    await expect(source.tombstoneEntity({
      draftId: DRAFT, entityType: 'course', entityRef: 'course:math-5',
      expectedRevision: 2, expectedDraftRevision: 3, idempotencyKey: REQUEST,
    })).rejects.toMatchObject({ code: 'conflict', reason: 'idempotency-conflict' })
    expect(fetchImpl.mock.calls[0][0]).toBe(
      `/api/admin/curriculum/drafts/${DRAFT}/entities/course/course%3Amath-5/tombstone`,
    )
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      expectedRevision: 2, expectedDraftRevision: 3, idempotencyKey: REQUEST,
    })
  })

  it('uses narrow GET routes for immutable entities, materialization, and revision-bound validation', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue({ schemaVersion: 1 }) })
    const source = createCurriculumDraftAuthoringHttpSource(fetchImpl, async () => 'verified-token')
    await source.readBaseIndex('1.0.0')
    await source.readBaseEntity('1.0.0', 'course', 'course:math-5')
    await source.readMaterialization(DRAFT, 4)
    await source.validateDraft(DRAFT, 4)
    expect(fetchImpl.mock.calls.map((call) => [call[0], call[1].method])).toEqual([
      ['/api/admin/curriculum/releases/1.0.0/authoring-index', 'GET'],
      ['/api/admin/curriculum/releases/1.0.0/authoring/entities/course/course%3Amath-5', 'GET'],
      [`/api/admin/curriculum/drafts/${DRAFT}/materialization/4`, 'GET'],
      [`/api/admin/curriculum/drafts/${DRAFT}/validation/4`, 'GET'],
    ])
  })

  it('uses draft-scoped collaborator routes without browser authority claims', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: vi.fn().mockResolvedValue({
        schemaVersion: 1, replayed: false, draftId: DRAFT, draftRevision: 4,
        collaborator: {
          principalRef: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          responsibility: 'reviewer', status: 'active', assignmentRevision: 1,
          assignedAt: '2026-08-10T12:00:00Z', revokedAt: null,
        },
      }),
    })
    const source = createCurriculumDraftAuthoringHttpSource(fetchImpl, async () => 'verified-token')
    const principalRef = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    await source.addCollaborator({
      draftId: DRAFT, principalRef, responsibility: 'reviewer',
      expectedDraftRevision: 3, idempotencyKey: REQUEST,
    })
    expect(fetchImpl.mock.calls[0][0]).toBe(`/api/admin/curriculum/drafts/${DRAFT}/collaborators`)
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body)
    expect(body).toEqual({
      principalRef, responsibility: 'reviewer', expectedDraftRevision: 3,
      idempotencyKey: REQUEST,
    })
    expect(JSON.stringify(body)).not.toMatch(/actor|globalRole|capabilit|email|name/i)

    await source.revokeCollaborator({
      draftId: DRAFT, principalRef, expectedDraftRevision: 4, idempotencyKey: REQUEST,
    })
    expect(fetchImpl.mock.calls[1][0]).toBe(
      `/api/admin/curriculum/drafts/${DRAFT}/collaborators/${principalRef}/revoke`,
    )
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({
      expectedDraftRevision: 4, idempotencyKey: REQUEST,
    })
  })

  it('maps verified-principal and collaborator CAS failures to bounded client reasons', async () => {
    const principalRef = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const invalidSource = createCurriculumDraftAuthoringHttpSource(
      vi.fn().mockResolvedValue({
        ok: false, status: 422,
        json: vi.fn().mockResolvedValue({ error: { code: 'verified_admin_principal_required' } }),
      }),
      async () => 'verified-token',
    )
    await expect(invalidSource.addCollaborator({
      draftId: DRAFT, principalRef, responsibility: 'editor',
      expectedDraftRevision: 3, idempotencyKey: REQUEST,
    })).rejects.toMatchObject({ code: 'invalid', reason: 'verified-principal-required' })

    const staleSource = createCurriculumDraftAuthoringHttpSource(
      vi.fn().mockResolvedValue({
        ok: false, status: 409,
        json: vi.fn().mockResolvedValue({ error: { code: 'revision_conflict' } }),
      }),
      async () => 'verified-token',
    )
    await expect(staleSource.revokeCollaborator({
      draftId: DRAFT, principalRef, expectedDraftRevision: 3, idempotencyKey: REQUEST,
    })).rejects.toMatchObject({ code: 'conflict', reason: 'revision-conflict' })
  })

  it('does not issue a request without an access token', async () => {
    const fetchImpl = vi.fn()
    const source = createCurriculumDraftAuthoringHttpSource(fetchImpl, async () => null)
    await expect(source.listDrafts()).rejects.toMatchObject({ code: 'unauthenticated' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
