import { describe, expect, it, vi } from 'vitest'
import { adaptCurriculumPreview, createCurriculumDraftAuthoringHttpSource } from './httpSource'

const DRAFT = '10000000-0000-4000-8000-000000000001'
const REQUEST = '20000000-0000-4000-8000-000000000001'

const emptyTotals = {
  resources: 0, active: 0, referenced: 0, unreferenced: 0, overridden: 0,
  draftCreated: 0, tombstoned: 0, missingReferences: 0, invalidReferences: 0,
  referenceOccurrences: 0, validationInvalid: 0,
}

function emptyLibrary(origin: 'published-release' | 'draft') {
  return {
    schemaVersion: 1,
    source: {
      origin, baseReleaseVersion: '1.0.0',
      draftId: origin === 'draft' ? DRAFT : null,
      draftRevision: origin === 'draft' ? 4 : null,
    },
    totals: emptyTotals,
    items: [],
  }
}

function validationResult() {
  return {
    schemaVersion: 1, draftId: DRAFT, draftRevision: 4,
    baseReleaseVersion: '1.0.0', targetVersion: '2.0.0-draft.1',
    validationSnapshot: {
      validationSnapshotId: '30000000-0000-4000-8000-000000000001', draftRevision: 4,
      engineVersion: 'curriculum-validation-v2', resultDigest: 'b'.repeat(64), status: 'valid',
      publicationReady: true, blockingCount: 0, blockingErrorCount: 0,
      humanReviewBlockerCount: 0, validatedAt: '2026-08-10T12:00:00Z',
    },
    run: {
      engineVersion: 'curriculum-validation-v2', status: 'valid', statusMessage: 'Valid.', publicationReady: true,
      source: { origin: 'draft', snapshotId: `${DRAFT}@4`, curriculumVersion: '2.0.0-draft.1', schemaSetVersion: '2.0.0' },
      summary: { total: 0, errors: 0, warnings: 0, info: 0, blocking: 0, nonBlocking: 0 }, findings: [],
    },
  }
}

function preview(validationRevision = 4) {
  const zero = { unchanged: 0, added: 0, modified: 0, removed: 0 }
  return {
    schemaVersion: 1,
    previewRef: `curriculum-preview:${DRAFT}:4:${'a'.repeat(64)}`,
    authority: {
      draftId: DRAFT, draftRevision: 4, baseReleaseVersion: '1.0.0', targetVersion: '2.0.0-draft.1',
      schemaSetVersion: '2.0.0', candidateDigest: 'a'.repeat(64),
    },
    freshness: 'current',
    summary: {
      baseEntities: 1, candidateEntities: 1, totalCompared: 1,
      unchanged: 0, added: 0, modified: 1, removed: 0,
      byEntityType: {
        course: { unchanged: 0, added: 0, modified: 1, removed: 0 },
        unit: zero, lesson: zero, assessment: zero, media_resource: zero,
      },
      validationStatus: 'invalid', publicationReady: false, validationBlockers: 1,
      humanReviewBlockers: 1, standardsBlockers: 1,
    },
    validation: {
      state: 'current', draftRevision: validationRevision,
      run: {
        engineVersion: 'curriculum-validation-v2', status: 'invalid', statusMessage: 'Blocking findings.',
        publicationReady: false,
        source: { origin: 'draft', snapshotId: `${DRAFT}@${validationRevision}`, curriculumVersion: '2.0.0-draft.1', schemaSetVersion: '2.0.0' },
        summary: { total: 1, errors: 1, warnings: 0, info: 0, blocking: 1, nonBlocking: 0 },
        findings: [{
          id: 'cvf-safe', severity: 'error', category: 'standards', entity: { type: 'course', id: 'course:math-5' },
          path: 'courses[0].standards', rule: 'standards.human_review_required',
          explanation: 'A standards mapping requires human review.', blocking: true,
        }],
      },
    },
    entities: [{
      entityType: 'course', entityRef: 'course:math-5', label: 'Mathematics 5', context: 'mathematics',
      changeType: 'modified', basePosition: 0, candidatePosition: 0,
      fieldChangeCount: 1, fieldChangesLimited: false,
      fieldChanges: [{
        path: 'title', label: 'Title', category: 'identity',
        before: { kind: 'text', display: 'Math' }, after: { kind: 'text', display: 'Mathematics' },
      }],
    }],
  }
}

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
    const fetchImpl = vi.fn().mockImplementation(async (path: string) => ({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(
        path.includes('/authoring/entities/') ? {
          schemaVersion: 1,
          baseReleaseVersion: '1.0.0',
          entityType: 'course',
          entityRef: 'course:math-5',
          payload: {
            schema_set_version: '2.0.0', course_id: 'course:math-5', grade: 5,
            subject: 'mathematics', title: 'Mathematics 5',
            description: 'A complete fifth grade mathematics course.', days: 180, order: 1,
            unit_refs: ['unit:math-5-1'],
            standards: [{ framework_ref: 'framework:legacy', legacy_label: '5.NBT', mapping_status: 'human-review' }],
          },
        } : path.endsWith('/authoring-index') ? {
          schemaVersion: 1, baseReleaseVersion: '1.0.0', entities: [],
          resourceLibrary: emptyLibrary('published-release'),
        } : path.includes('/materialization/') ? {
          schemaVersion: 1, draftId: DRAFT, draftRevision: 4, baseReleaseVersion: '1.0.0',
          entities: [], resourceLibrary: emptyLibrary('draft'),
        } : validationResult(),
      ),
    }))
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

  it('rejects unexpected keys from materialization and validation success DTOs', async () => {
    for (const injected of [
      { ...validationResult(), rawBackendError: '/private/database' },
      {
        schemaVersion: 1, draftId: DRAFT, draftRevision: 4, baseReleaseVersion: '1.0.0', entities: [],
        resourceLibrary: { ...emptyLibrary('draft'), providerData: { signedUrl: 'secret' } },
      },
    ]) {
      const source = createCurriculumDraftAuthoringHttpSource(
        vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue(injected) }),
        async () => 'verified-token',
      )
      const operation = 'run' in injected
        ? source.validateDraft(DRAFT, 4)
        : source.readMaterialization(DRAFT, 4)
      await expect(operation).rejects.toMatchObject({ code: 'unavailable' })
    }
  })

  it('loads preview through the exact revision GET route and rejects malformed/raw payload responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue(preview()) })
    const source = createCurriculumDraftAuthoringHttpSource(fetchImpl, async () => 'verified-token')
    await expect(source.readPreview(DRAFT, 4)).resolves.toMatchObject({
      authority: { draftId: DRAFT, draftRevision: 4 },
      validation: { state: 'current', draftRevision: 4 },
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/admin/curriculum/drafts/${DRAFT}/preview/4`,
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    )

    const malformed = preview()
    malformed.entities[0] = { ...malformed.entities[0], payload: { privateNote: 'must not cross' } } as typeof malformed.entities[0]
    expect(adaptCurriculumPreview(malformed, DRAFT, 4)).toBeNull()
  })

  it('never treats validation from another draft revision as current', () => {
    const adapted = adaptCurriculumPreview(preview(3), DRAFT, 4)
    expect(adapted?.validation).toEqual({ state: 'not-current', draftRevision: 3, run: null })
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
