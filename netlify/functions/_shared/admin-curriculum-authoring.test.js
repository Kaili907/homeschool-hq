import { describe, expect, it, vi } from 'vitest'
import {
  ADMIN_CURRICULUM_DRAFT_ENTITY_LIMIT,
  ADMIN_CURRICULUM_DRAFT_LIST_LIMIT,
  createAdminCurriculumAuthoringService,
} from './admin-curriculum-authoring.js'

const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const DRAFT = '10000000-0000-4000-8000-000000000001'
const REQUEST = '20000000-0000-4000-8000-000000000001'
const HASH = 'a'.repeat(64)
const TIMESTAMP = '2026-08-10T12:00:00Z'

function draftSummary() {
  return {
    schemaVersion: 1, draftId: DRAFT, baseReleaseVersion: '1.0.0',
    targetVersion: '2.0.0-draft.1', authoringSchemaVersion: '2.0.0',
    lifecycleState: 'draft', revision: 1, createdAt: TIMESTAMP, updatedAt: TIMESTAMP,
  }
}

function entityDetail() {
  return {
    schemaVersion: 1, draftId: DRAFT, entityType: 'course',
    entityRef: 'course:math-5', origin: 'base_override', revision: 1,
    position: 0, tombstoned: false, digest: HASH,
    createdAt: TIMESTAMP, updatedAt: TIMESTAMP, payload: {},
  }
}

function client(value, error = null) {
  const abortSignal = vi.fn().mockResolvedValue({ data: value, error })
  return { rpc: vi.fn(() => ({ abortSignal })), abortSignal }
}

describe('Admin curriculum authoring server service', () => {
  it('uses only narrow service RPCs with server-derived actor and exact capability markers', async () => {
    const database = client({ schemaVersion: 1, replayed: false, draftId: DRAFT, draftRevision: 1 })
    const service = createAdminCurriculumAuthoringService({ client: database })
    await expect(service.createDraft(ACTOR, {
      baseReleaseVersion: '1.0.0', targetVersion: '2.0.0-draft.1',
      authoringSchemaVersion: '2.0.0', idempotencyKey: REQUEST, requestDigest: HASH,
    })).resolves.toMatchObject({ draftId: DRAFT, draftRevision: 1 })
    expect(database.rpc).toHaveBeenCalledWith('academy_admin_create_curriculum_draft_v1', {
      p_actor_user_ref: ACTOR,
      p_base_release_version: '1.0.0',
      p_target_version: '2.0.0-draft.1',
      p_authoring_schema_version: '2.0.0',
      p_request_id: REQUEST,
      p_request_digest: HASH,
      p_required_capability: 'curriculum:drafts:write',
    })
  })

  it('projects bounded navigation reads and fails closed on malformed database output', async () => {
    const valid = {
      schemaVersion: 1,
      drafts: [draftSummary()],
    }
    const database = client(valid)
    const service = createAdminCurriculumAuthoringService({ client: database })
    await expect(service.list(ACTOR)).resolves.toEqual(valid)
    expect(database.rpc).toHaveBeenCalledWith('academy_admin_list_curriculum_drafts_v1', {
      p_actor_user_ref: ACTOR, p_required_capability: 'curriculum:read',
    })

    const malformed = createAdminCurriculumAuthoringService({ client: client({ ...valid, actorUserRef: ACTOR }) })
    await expect(malformed.list(ACTOR)).rejects.toMatchObject({ code: 'unavailable' })
  })

  it('accepts one revision-pinned entity batch and rejects every authoritative overflow explicitly', async () => {
    const entities = Array.from({ length: ADMIN_CURRICULUM_DRAFT_ENTITY_LIMIT }, entityDetail)
    const database = client({
      schemaVersion: 1, draftId: DRAFT, draftRevision: 7, entities,
    })
    const service = createAdminCurriculumAuthoringService({ client: database })
    await expect(service.readEntities(ACTOR, DRAFT, 7)).resolves.toMatchObject({
      draftId: DRAFT, draftRevision: 7,
    })
    expect(database.rpc).toHaveBeenCalledWith('academy_admin_read_curriculum_draft_entities_v1', {
      p_actor_user_ref: ACTOR,
      p_draft_id: DRAFT,
      p_expected_revision: 7,
      p_required_capability: 'curriculum:read',
    })

    const draftOverflow = createAdminCurriculumAuthoringService({ client: client({
      schemaVersion: 1,
      drafts: Array.from({ length: ADMIN_CURRICULUM_DRAFT_LIST_LIMIT + 1 }, draftSummary),
    }) })
    await expect(draftOverflow.list(ACTOR)).rejects.toMatchObject({ code: 'incomplete' })

    const entityOverflow = createAdminCurriculumAuthoringService({ client: client({
      ...draftSummary(),
      entities: Array.from({ length: ADMIN_CURRICULUM_DRAFT_ENTITY_LIMIT + 1 }, () => {
        const { schemaVersion: _schemaVersion, draftId: _draftId, payload: _payload, ...summary } = entityDetail()
        return summary
      }),
    }) })
    await expect(entityOverflow.read(ACTOR, DRAFT)).rejects.toMatchObject({ code: 'incomplete' })

    const databaseOverflow = createAdminCurriculumAuthoringService({
      client: client(null, { message: 'CURRICULUM_DRAFT_MATERIALIZATION_LIMIT' }),
    })
    await expect(databaseOverflow.read(ACTOR, DRAFT)).rejects.toMatchObject({ code: 'incomplete' })
  })

  it('maps database CAS and replay markers to stable server-only errors', async () => {
    const database = client(null, { message: `private path CURRICULUM_CAS_CONFLICT ${ACTOR}` })
    const service = createAdminCurriculumAuthoringService({ client: database })
    await expect(service.tombstoneEntity(ACTOR, {
      draftId: DRAFT, entityType: 'course', entityRef: 'course:math-5',
      expectedRevision: 1, expectedDraftRevision: 2,
      idempotencyKey: REQUEST, requestDigest: HASH,
    })).rejects.toMatchObject({ code: 'conflict', message: 'curriculum_authoring_unavailable' })
  })

  it('projects collaborator RPCs and passes only stable principal identity plus CAS metadata', async () => {
    const collaborator = {
      principalRef: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      responsibility: 'reviewer', status: 'active', assignmentRevision: 1,
      assignedAt: '2026-08-10T12:00:00Z', revokedAt: null,
    }
    const database = client({
      schemaVersion: 1, replayed: false, draftId: DRAFT, draftRevision: 2,
      collaborator,
    })
    const service = createAdminCurriculumAuthoringService({ client: database })
    await expect(service.addCollaborator(ACTOR, {
      draftId: DRAFT, principalRef: collaborator.principalRef,
      responsibility: 'reviewer', expectedDraftRevision: 1,
      idempotencyKey: REQUEST, requestDigest: HASH,
    })).resolves.toMatchObject({ collaborator })
    expect(database.rpc).toHaveBeenCalledWith(
      'academy_admin_add_curriculum_draft_collaborator_v1',
      {
        p_actor_user_ref: ACTOR,
        p_draft_id: DRAFT,
        p_principal_user_ref: collaborator.principalRef,
        p_responsibility: 'reviewer',
        p_expected_draft_revision: 1,
        p_request_id: REQUEST,
        p_request_digest: HASH,
        p_required_capability: 'curriculum:drafts:write',
      },
    )

    const listDatabase = client({
      schemaVersion: 1, draftId: DRAFT, draftRevision: 2,
      currentResponsibility: 'editor', collaborators: [collaborator],
    })
    await expect(
      createAdminCurriculumAuthoringService({ client: listDatabase }).listCollaborators(ACTOR, DRAFT),
    ).resolves.toMatchObject({ currentResponsibility: 'editor', collaborators: [collaborator] })
  })

  it('fails closed on malformed collaborator projections and maps assignment denial', async () => {
    const malformed = createAdminCurriculumAuthoringService({ client: client({
      schemaVersion: 1, draftId: DRAFT, draftRevision: 1,
      currentResponsibility: 'editor',
      collaborators: [{ principalRef: 'admin@example.test', responsibility: 'editor' }],
    }) })
    await expect(malformed.listCollaborators(ACTOR, DRAFT)).rejects.toMatchObject({ code: 'unavailable' })

    const denied = createAdminCurriculumAuthoringService({
      client: client(null, { message: 'CURRICULUM_COLLABORATION_REQUIRED private detail' }),
    })
    await expect(denied.listCollaborators(ACTOR, DRAFT)).rejects.toMatchObject({
      code: 'forbidden', message: 'curriculum_authoring_unavailable',
    })
  })
})
