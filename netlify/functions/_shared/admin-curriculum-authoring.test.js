import { describe, expect, it, vi } from 'vitest'
import { createAdminCurriculumAuthoringService } from './admin-curriculum-authoring.js'

const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const DRAFT = '10000000-0000-4000-8000-000000000001'
const REQUEST = '20000000-0000-4000-8000-000000000001'
const HASH = 'a'.repeat(64)

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
      drafts: [{
        schemaVersion: 1, draftId: DRAFT, baseReleaseVersion: '1.0.0',
        targetVersion: '2.0.0-draft.1', authoringSchemaVersion: '2.0.0',
        lifecycleState: 'draft', revision: 1,
        createdAt: '2026-08-10T12:00:00Z', updatedAt: '2026-08-10T12:00:00Z',
      }],
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

  it('maps database CAS and replay markers to stable server-only errors', async () => {
    const database = client(null, { message: `private path CURRICULUM_CAS_CONFLICT ${ACTOR}` })
    const service = createAdminCurriculumAuthoringService({ client: database })
    await expect(service.tombstoneEntity(ACTOR, {
      draftId: DRAFT, entityType: 'course', entityRef: 'course:math-5',
      expectedRevision: 1, expectedDraftRevision: 2,
      idempotencyKey: REQUEST, requestDigest: HASH,
    })).rejects.toMatchObject({ code: 'conflict', message: 'curriculum_authoring_unavailable' })
  })
})
