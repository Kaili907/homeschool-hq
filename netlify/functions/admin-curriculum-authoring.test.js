import { describe, expect, it, vi } from 'vitest'
import { createAdminCurriculumHandler } from './admin-curriculum.js'

const DRAFT_ID = '10000000-0000-4000-8000-000000000001'
const REQUEST_ID = '20000000-0000-4000-8000-000000000001'
const principal = {
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'admin',
  capabilities: ['curriculum:read', 'curriculum:drafts:write'],
}

const course = {
  schema_set_version: '2.0.0',
  course_id: 'course:math-5',
  grade: 5,
  subject: 'mathematics',
  title: 'Mathematics 5',
  description: 'A complete fifth grade mathematics course.',
  days: 180,
  order: 1,
  unit_refs: ['unit:math-5-1'],
  standards: [{ framework_ref: 'framework:legacy', legacy_label: '5.NBT', mapping_status: 'human-review' }],
}

function event(path, method = 'GET', body) {
  return {
    path,
    httpMethod: method,
    headers: { authorization: 'Bearer verified', ...(body ? { 'content-type': 'application/json' } : {}) },
    queryStringParameters: null,
    ...(body ? { body: JSON.stringify(body), isBase64Encoded: false } : {}),
  }
}

function authoring() {
  const entity = {
    entityType: 'course', entityRef: 'course:math-5', origin: 'base_override',
    revision: 1, position: 10, tombstoned: false, digest: 'a'.repeat(64),
    createdAt: '2026-08-10T12:00:00Z', updatedAt: '2026-08-10T12:00:00Z',
  }
  return {
    list: vi.fn().mockResolvedValue({ schemaVersion: 1, drafts: [] }),
    read: vi.fn().mockResolvedValue({
      schemaVersion: 1, draftId: DRAFT_ID, baseReleaseVersion: '1.0.0',
      targetVersion: '2.0.0-draft.1', authoringSchemaVersion: '2.0.0',
      lifecycleState: 'draft', revision: 1,
      createdAt: '2026-08-10T12:00:00Z', updatedAt: '2026-08-10T12:00:00Z', entities: [],
    }),
    readEntity: vi.fn().mockResolvedValue({ schemaVersion: 1, draftId: DRAFT_ID, ...entity, payload: course }),
    createDraft: vi.fn().mockResolvedValue({ schemaVersion: 1, replayed: false, draftId: DRAFT_ID, draftRevision: 1 }),
    createEntity: vi.fn().mockResolvedValue({ schemaVersion: 1, replayed: false, draftId: DRAFT_ID, draftRevision: 2, entity }),
    updateEntity: vi.fn().mockResolvedValue({ schemaVersion: 1, replayed: false, draftId: DRAFT_ID, draftRevision: 3, entity: { ...entity, revision: 2 } }),
    tombstoneEntity: vi.fn().mockResolvedValue({ schemaVersion: 1, replayed: false, draftId: DRAFT_ID, draftRevision: 4, entity: { ...entity, revision: 3, tombstoned: true } }),
    listCollaborators: vi.fn().mockResolvedValue({
      schemaVersion: 1, draftId: DRAFT_ID, draftRevision: 1,
      currentResponsibility: 'editor', collaborators: [],
    }),
    addCollaborator: vi.fn().mockResolvedValue({
      schemaVersion: 1, replayed: false, draftId: DRAFT_ID, draftRevision: 2,
      collaborator: {
        principalRef: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', responsibility: 'reviewer',
        status: 'active', assignmentRevision: 1,
        assignedAt: '2026-08-10T12:00:00Z', revokedAt: null,
      },
    }),
    revokeCollaborator: vi.fn().mockResolvedValue({
      schemaVersion: 1, replayed: false, draftId: DRAFT_ID, draftRevision: 3,
      collaborator: {
        principalRef: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', responsibility: 'reviewer',
        status: 'revoked', assignmentRevision: 2,
        assignedAt: '2026-08-10T12:00:00Z', revokedAt: '2026-08-10T12:05:00Z',
      },
    }),
  }
}

function handler(overrides = {}) {
  const source = { loadCatalog: vi.fn(), loadLesson: vi.fn(), loadValidationEvidence: vi.fn() }
  const registry = { list: vi.fn(), details: vi.fn(), productionPointer: vi.fn() }
  return createAdminCurriculumHandler({ source, registry, ...overrides })
}

describe('ADMIN-16B curriculum authoring API', () => {
  it('serves authorized revision-bound materialization and validation without granting a write', async () => {
    const service = authoring()
    const studio = {
      readMaterialization: vi.fn().mockResolvedValue({ schemaVersion: 1, draftId: DRAFT_ID, draftRevision: 3, entities: [] }),
      validateDraft: vi.fn().mockResolvedValue({ schemaVersion: 1, draftId: DRAFT_ID, draftRevision: 3, run: { status: 'valid' } }),
      readBaseIndex: vi.fn(), readBaseEntity: vi.fn(),
    }
    const authorization = { require: vi.fn().mockResolvedValue({ ok: true, principal }) }
    const handle = handler({ authoring: service, studio, authorization })
    expect((await handle(event(`/api/admin/curriculum/drafts/${DRAFT_ID}/materialization/3`))).statusCode).toBe(200)
    expect((await handle(event(`/api/admin/curriculum/drafts/${DRAFT_ID}/validation/3`))).statusCode).toBe(200)
    expect(studio.readMaterialization).toHaveBeenCalledWith(principal.userId, DRAFT_ID, 3)
    expect(studio.validateDraft).toHaveBeenCalledWith(principal.userId, DRAFT_ID, 3)
    expect(authorization.require.mock.calls.map((call) => call[1])).toEqual(['curriculum:read', 'curriculum:read'])
  })

  it('routes workspace and entity reads with curriculum:read', async () => {
    const service = authoring()
    const authorization = { require: vi.fn().mockResolvedValue({ ok: true, principal }) }
    const handle = handler({ authoring: service, authorization })
    expect((await handle(event('/api/admin/curriculum/drafts'))).statusCode).toBe(200)
    expect((await handle(event(`/api/admin/curriculum/drafts/${DRAFT_ID}`))).statusCode).toBe(200)
    expect((await handle(event(`/api/admin/curriculum/drafts/${DRAFT_ID}/entities/course/course%3Amath-5`))).statusCode).toBe(200)
    expect(service.list).toHaveBeenCalledWith(principal.userId)
    expect(service.read).toHaveBeenCalledWith(principal.userId, DRAFT_ID)
    expect(service.readEntity).toHaveBeenCalledWith(principal.userId, DRAFT_ID, 'course', 'course:math-5')
    expect(authorization.require.mock.calls.map((call) => call[1])).toEqual([
      'curriculum:read', 'curriculum:read', 'curriculum:read',
    ])
  })

  it('creates a base-bound workspace and never accepts client actor or authority fields', async () => {
    const service = authoring()
    const authorization = { require: vi.fn().mockResolvedValue({ ok: true, principal }) }
    const handle = handler({ authoring: service, authorization })
    const body = {
      baseReleaseVersion: '1.0.0', targetVersion: '2.0.0-draft.1',
      authoringSchemaVersion: '2.0.0', idempotencyKey: REQUEST_ID,
    }
    const response = await handle(event('/api/admin/curriculum/drafts', 'POST', body))
    expect(response.statusCode).toBe(201)
    expect(authorization.require).toHaveBeenCalledWith(expect.anything(), 'curriculum:drafts:write')
    expect(service.createDraft).toHaveBeenCalledWith(principal.userId, expect.objectContaining(body))
    expect(service.createDraft.mock.calls[0][1].requestDigest).toMatch(/^[0-9a-f]{64}$/)

    const injected = await handle(event('/api/admin/curriculum/drafts', 'POST', {
      ...body, actorUserRef: 'forged', role: 'owner', revision: 99, createdAt: '2000-01-01T00:00:00Z',
    }))
    expect(injected.statusCode).toBe(400)
    expect(service.createDraft).toHaveBeenCalledTimes(1)
  })

  it('enforces exact Schema Set v2 payloads before create/update RPCs', async () => {
    const service = authoring()
    const handle = handler({
      authoring: service,
      authorization: { require: vi.fn().mockResolvedValue({ ok: true, principal }) },
    })
    const createBody = {
      entityType: 'course', entityRef: 'course:math-5', origin: 'base_override',
      position: 10, payload: course, expectedDraftRevision: 1, idempotencyKey: REQUEST_ID,
    }
    const created = await handle(event(`/api/admin/curriculum/drafts/${DRAFT_ID}/entities`, 'POST', createBody))
    expect(created.statusCode).toBe(201)
    expect(service.createEntity).toHaveBeenCalledWith(principal.userId, expect.objectContaining({
      draftId: DRAFT_ID, entityType: 'course', payloadDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
    }))

    const malformed = await handle(event(`/api/admin/curriculum/drafts/${DRAFT_ID}/entities`, 'POST', {
      ...createBody, payload: { ...course, unknown_authority: true }, idempotencyKey: '30000000-0000-4000-8000-000000000001',
    }))
    expect(malformed.statusCode).toBe(422)
    expect(malformed.body).toContain('schema_v2_rejected')
    expect(service.createEntity).toHaveBeenCalledTimes(1)

    const mismatched = await handle(event(`/api/admin/curriculum/drafts/${DRAFT_ID}/entities/course/course%3Amath-5`, 'PUT', {
      payload: { ...course, course_id: 'course:other' }, position: 11,
      expectedRevision: 1, expectedDraftRevision: 2,
      idempotencyKey: '30000000-0000-4000-8000-000000000002',
    }))
    expect(mismatched.statusCode).toBe(422)
    expect(service.updateEntity).not.toHaveBeenCalled()
  })

  it('rejects protected entity classes and supports explicit CAS tombstone operations', async () => {
    const service = authoring()
    const handle = handler({
      authoring: service,
      authorization: { require: vi.fn().mockResolvedValue({ ok: true, principal }) },
    })
    const protectedResponse = await handle(event(`/api/admin/curriculum/drafts/${DRAFT_ID}/entities`, 'POST', {
      entityType: 'policy_set', entityRef: 'policy:global', origin: 'draft_created', position: 1,
      payload: { schema_set_version: '2.0.0' }, expectedDraftRevision: 1, idempotencyKey: REQUEST_ID,
    }))
    expect(protectedResponse.statusCode).toBe(400)
    expect(service.createEntity).not.toHaveBeenCalled()

    const tombstone = await handle(event(
      `/api/admin/curriculum/drafts/${DRAFT_ID}/entities/course/course%3Amath-5/tombstone`,
      'POST',
      { expectedRevision: 2, expectedDraftRevision: 3, idempotencyKey: REQUEST_ID },
    ))
    expect(tombstone.statusCode).toBe(200)
    expect(service.tombstoneEntity).toHaveBeenCalledWith(principal.userId, expect.objectContaining({
      expectedRevision: 2, expectedDraftRevision: 3,
    }))
  })

  it('lists, adds, and revokes bounded collaborators with per-request capability checks', async () => {
    const service = authoring()
    const authorization = { require: vi.fn().mockResolvedValue({ ok: true, principal }) }
    const handle = handler({ authoring: service, authorization })
    const principalRef = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

    expect((await handle(event(`/api/admin/curriculum/drafts/${DRAFT_ID}/collaborators`))).statusCode).toBe(200)
    expect(service.listCollaborators).toHaveBeenCalledWith(principal.userId, DRAFT_ID)

    const addBody = {
      principalRef, responsibility: 'reviewer', expectedDraftRevision: 1,
      idempotencyKey: REQUEST_ID,
    }
    const added = await handle(event(
      `/api/admin/curriculum/drafts/${DRAFT_ID}/collaborators`, 'POST', addBody,
    ))
    expect(added.statusCode).toBe(201)
    expect(service.addCollaborator).toHaveBeenCalledWith(principal.userId, expect.objectContaining({
      draftId: DRAFT_ID, ...addBody, requestDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
    }))
    expect(JSON.stringify(service.addCollaborator.mock.calls[0][1])).not.toMatch(/email|name|globalRole|capabilities/i)

    const revoked = await handle(event(
      `/api/admin/curriculum/drafts/${DRAFT_ID}/collaborators/${principalRef}/revoke`,
      'POST',
      { expectedDraftRevision: 2, idempotencyKey: REQUEST_ID },
    ))
    expect(revoked.statusCode).toBe(200)
    expect(service.revokeCollaborator).toHaveBeenCalledWith(principal.userId, expect.objectContaining({
      draftId: DRAFT_ID, principalRef, expectedDraftRevision: 2,
    }))
    expect(authorization.require.mock.calls.map((call) => call[1])).toEqual([
      'curriculum:read', 'curriculum:drafts:write', 'curriculum:drafts:write',
    ])
  })

  it('rejects collaborator authority injection and maps verified-principal, permission, and CAS failures', async () => {
    const service = authoring()
    const handle = handler({
      authoring: service,
      authorization: { require: vi.fn().mockResolvedValue({ ok: true, principal }) },
    })
    const principalRef = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const injected = await handle(event(
      `/api/admin/curriculum/drafts/${DRAFT_ID}/collaborators`,
      'POST',
      {
        principalRef, responsibility: 'editor', expectedDraftRevision: 1,
        idempotencyKey: REQUEST_ID, role: 'owner', capability: 'curriculum:drafts:write',
      },
    ))
    expect(injected.statusCode).toBe(400)
    expect(service.addCollaborator).not.toHaveBeenCalled()

    service.addCollaborator.mockRejectedValueOnce(Object.assign(new Error('private'), { code: 'verified-principal' }))
    const invalid = await handle(event(
      `/api/admin/curriculum/drafts/${DRAFT_ID}/collaborators`,
      'POST',
      { principalRef, responsibility: 'editor', expectedDraftRevision: 1, idempotencyKey: REQUEST_ID },
    ))
    expect(invalid.statusCode).toBe(422)
    expect(invalid.body).toContain('verified_admin_principal_required')

    service.listCollaborators.mockRejectedValueOnce(Object.assign(new Error('private'), { code: 'forbidden' }))
    const denied = await handle(event(`/api/admin/curriculum/drafts/${DRAFT_ID}/collaborators`))
    expect(denied.statusCode).toBe(403)
    expect(denied.body).not.toContain('private')

    service.revokeCollaborator.mockRejectedValueOnce(Object.assign(new Error('private'), { code: 'conflict' }))
    const stale = await handle(event(
      `/api/admin/curriculum/drafts/${DRAFT_ID}/collaborators/${principalRef}/revoke`,
      'POST',
      { expectedDraftRevision: 2, idempotencyKey: REQUEST_ID },
    ))
    expect(stale.statusCode).toBe(409)
    expect(stale.body).toContain('revision_conflict')
  })

  it('fails closed before mutations and maps CAS/replay failures without leaking service detail', async () => {
    const service = authoring()
    const denied = handler({
      authoring: service,
      authorization: { require: vi.fn().mockResolvedValue({ ok: false, response: { statusCode: 403, body: '{}' } }) },
    })
    const body = {
      baseReleaseVersion: '1.0.0', targetVersion: '2.0.0-draft.1',
      authoringSchemaVersion: '2.0.0', idempotencyKey: REQUEST_ID,
    }
    expect((await denied(event('/api/admin/curriculum/drafts', 'POST', body))).statusCode).toBe(403)
    expect(service.createDraft).not.toHaveBeenCalled()

    service.createDraft.mockRejectedValue(Object.assign(new Error('/private/database/detail'), { code: 'conflict' }))
    const conflicted = handler({
      authoring: service,
      authorization: { require: vi.fn().mockResolvedValue({ ok: true, principal }) },
    })
    const response = await conflicted(event('/api/admin/curriculum/drafts', 'POST', body))
    expect(response.statusCode).toBe(409)
    expect(response.body).toContain('revision_conflict')
    expect(response.body).not.toContain('private')
  })
})
