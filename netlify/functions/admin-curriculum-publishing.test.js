import { describe, expect, it, vi } from 'vitest'
import { createAdminCurriculumHandler } from './admin-curriculum.js'

const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const DRAFT = '10000000-0000-4000-8000-000000000001'
const STAGING = '20000000-0000-4000-8000-000000000001'
const REQUEST = '30000000-0000-4000-8000-000000000001'

function event(method, path, body) {
  return {
    httpMethod: method,
    path,
    headers: {
      authorization: 'Bearer verified',
      'x-admin-role': 'owner',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }
}

function result(replayed) {
  return {
    schemaVersion: 1,
    ...(replayed === undefined ? {} : { replayed }),
    draftId: DRAFT,
    draftRevision: 4,
    baseReleaseVersion: '1.0.0',
    targetVersion: '2.0.0-rc.1',
    schemaSetVersion: '2.0.0',
    publicationState: replayed === undefined ? 'eligible' : 'published',
    eligible: replayed === undefined,
    blockingReasons: [],
    candidate: { stagingId: STAGING },
    published: replayed === undefined ? null : {
      releaseId: STAGING, version: '2.0.0-rc.1', status: 'published', activationStatus: 'not_active',
    },
  }
}

function setup(authorizationResult = {
  ok: true,
  principal: { userId: ACTOR, role: 'owner', capabilities: ['curriculum:read', 'curriculum:publish'] },
}) {
  const authorization = { require: vi.fn(async () => authorizationResult) }
  const publishing = {
    read: vi.fn(async () => result()),
    publish: vi.fn(async () => result(false)),
  }
  const authoring = {
    listCollaborators: vi.fn(async () => ({ currentResponsibility: 'editor' })),
  }
  const handler = createAdminCurriculumHandler({
    authorization,
    publishing,
    studio: {}, authoring, approval: {}, staging: {}, registry: {}, source: {},
  })
  return { authorization, authoring, publishing, handler }
}

describe('Admin curriculum publishing HTTP boundary', () => {
  it('reads with curriculum:read and publishes with curriculum:publish', async () => {
    const { authorization, authoring, publishing, handler } = setup()
    const read = await handler(event('GET', `/api/admin/curriculum/drafts/${DRAFT}/publishing`))
    const publish = await handler(event('POST', `/api/admin/curriculum/drafts/${DRAFT}/publishing`, {
      stagingId: STAGING,
      idempotencyKey: REQUEST,
    }))
    expect(read.statusCode).toBe(200)
    expect(publish.statusCode).toBe(201)
    expect(authorization.require.mock.calls.map((call) => call[1])).toEqual([
      'curriculum:read', 'curriculum:publish',
    ])
    expect(publishing.read).toHaveBeenCalledWith(ACTOR, DRAFT)
    expect(authoring.listCollaborators).toHaveBeenCalledWith(ACTOR, DRAFT)
    expect(publishing.publish).toHaveBeenCalledWith(ACTOR, STAGING, REQUEST)
    expect(JSON.parse(publish.body).published.activationStatus).toBe('not_active')
  })

  it('rejects publishing when the verified actor is not the assigned draft editor', async () => {
    const { authoring, publishing, handler } = setup()
    authoring.listCollaborators.mockResolvedValueOnce({ currentResponsibility: 'reviewer' })
    const response = await handler(event('POST', `/api/admin/curriculum/drafts/${DRAFT}/publishing`, {
      stagingId: STAGING,
      idempotencyKey: REQUEST,
    }))
    expect(response.statusCode).toBe(403)
    expect(JSON.parse(response.body).error.code).toBe('admin_access_denied')
    expect(publishing.publish).not.toHaveBeenCalled()
  })

  it('ignores browser role claims, rejects extra fields, and exposes no activation action', async () => {
    const denial = { ok: false, response: { statusCode: 403, body: '{"error":{"code":"admin_access_denied"}}' } }
    const denied = setup(denial)
    const response = await denied.handler(event('POST', `/api/admin/curriculum/drafts/${DRAFT}/publishing`, {
      stagingId: STAGING, idempotencyKey: REQUEST, role: 'owner', capability: 'curriculum:publish',
    }))
    expect(response.statusCode).toBe(403)
    expect(denied.publishing.publish).not.toHaveBeenCalled()

    const { handler } = setup()
    const malformed = await handler(event('POST', `/api/admin/curriculum/drafts/${DRAFT}/publishing`, {
      stagingId: STAGING, idempotencyKey: REQUEST, actor: ACTOR,
    }))
    const activate = await handler(event('POST', `/api/admin/curriculum/drafts/${DRAFT}/activate`, {}))
    expect(malformed.statusCode).toBe(400)
    expect(activate.statusCode).toBe(404)
  })

  it.each([
    ['artifact-invalid', 'publication_artifact_invalid'],
    ['manifest-mismatch', 'publication_manifest_mismatch'],
    ['package-mismatch', 'publication_package_mismatch'],
    ['approval-stale', 'publication_approval_stale'],
    ['validation-blocked', 'publication_validation_blocked'],
    ['human-review-blocked', 'publication_human_review_blocked'],
    ['target-collision', 'target_version_collision'],
    ['replay-conflict', 'idempotency_conflict'],
  ])('maps %s to a bounded safe conflict', async (code, expected) => {
    const { publishing, handler } = setup()
    publishing.publish.mockRejectedValueOnce(Object.assign(new Error('private detail'), { code }))
    const response = await handler(event('POST', `/api/admin/curriculum/drafts/${DRAFT}/publishing`, {
      stagingId: STAGING, idempotencyKey: REQUEST,
    }))
    expect(response.statusCode).toBe(409)
    expect(JSON.parse(response.body).error.code).toBe(expected)
    expect(response.body).not.toContain('private detail')
  })
})
