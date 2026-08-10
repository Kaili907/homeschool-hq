import { describe, expect, it, vi } from 'vitest'
import { createAdminCurriculumHandler } from './admin-curriculum.js'

const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const DRAFT = '10000000-0000-4000-8000-000000000001'
const REQUEST = '20000000-0000-4000-8000-000000000001'

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

function stageStatus(replayed) {
  return {
    schemaVersion: 1,
    ...(replayed === undefined ? {} : { replayed }),
    draftId: DRAFT,
    draftRevision: 3,
    baseReleaseVersion: '1.0.0',
    targetVersion: '2.0.0-rc.1',
    schemaSetVersion: '2.0.0',
    stageState: replayed === undefined ? 'eligible' : 'staged',
    eligible: replayed === undefined,
    blockingReasons: [],
    validation: { status: 'valid', validationSnapshotId: '30000000-0000-4000-8000-000000000001' },
    approval: { status: 'approved', approvalId: '40000000-0000-4000-8000-000000000001' },
    candidate: replayed === undefined ? null : {
      stagingId: REQUEST,
      status: 'staged',
      publicationStatus: 'not_published',
      validationSnapshotId: '30000000-0000-4000-8000-000000000001',
      approvalId: '40000000-0000-4000-8000-000000000001',
      entityCounts: { courses: 30 },
      fileCount: 10,
      byteCount: 1000,
      contentHash: 'a'.repeat(64),
      manifestHash: 'b'.repeat(64),
      packageHash: 'c'.repeat(64),
      stagedAt: '2026-08-10T12:00:00Z',
      authority: 'curriculum:publish',
    },
  }
}

function setup(authorizationResult = {
  ok: true,
  principal: { userId: ACTOR, role: 'owner', capabilities: ['curriculum:read', 'curriculum:publish'] },
}) {
  const authorization = { require: vi.fn(async () => authorizationResult) }
  const studio = {
    readStaging: vi.fn(async () => stageStatus()),
    stageDraft: vi.fn(async () => stageStatus(false)),
  }
  const handler = createAdminCurriculumHandler({
    authorization,
    studio,
    authoring: {}, approval: {}, staging: {}, registry: {}, source: {},
  })
  return { authorization, studio, handler }
}

describe('Admin curriculum release staging HTTP boundary', () => {
  it('reads status with curriculum:read and stages with curriculum:publish', async () => {
    const { authorization, studio, handler } = setup()
    const read = await handler(event('GET', `/api/admin/curriculum/drafts/${DRAFT}/staging`))
    const stage = await handler(event('POST', `/api/admin/curriculum/drafts/${DRAFT}/staging`, {
      draftRevision: 3,
      idempotencyKey: REQUEST,
    }))
    expect(read.statusCode).toBe(200)
    expect(stage.statusCode).toBe(201)
    expect(authorization.require.mock.calls.map((call) => call[1])).toEqual([
      'curriculum:read', 'curriculum:publish',
    ])
    expect(studio.readStaging).toHaveBeenCalledWith(ACTOR, DRAFT)
    expect(studio.stageDraft).toHaveBeenCalledWith(ACTOR, DRAFT, 3, REQUEST)
    expect(JSON.parse(stage.body).candidate.publicationStatus).toBe('not_published')
  })

  it('ignores forged role headers and fails before staging when authorization denies', async () => {
    const denial = { ok: false, response: { statusCode: 403, body: '{"error":{"code":"admin_access_denied"}}' } }
    const { studio, handler } = setup(denial)
    const response = await handler(event('POST', `/api/admin/curriculum/drafts/${DRAFT}/staging`, {
      draftRevision: 3,
      idempotencyKey: REQUEST,
      role: 'owner',
      capability: 'curriculum:publish',
    }))
    expect(response.statusCode).toBe(403)
    expect(studio.stageDraft).not.toHaveBeenCalled()
  })

  it('rejects malformed or extra client authority and exposes no publish/activate route', async () => {
    const { handler } = setup()
    const malformed = await handler(event('POST', `/api/admin/curriculum/drafts/${DRAFT}/staging`, {
      draftRevision: 3,
      idempotencyKey: REQUEST,
      actor: ACTOR,
    }))
    const activate = await handler(event('POST', `/api/admin/curriculum/drafts/${DRAFT}/activate`, {}))
    expect(malformed.statusCode).toBe(400)
    expect(activate.statusCode).toBe(404)
  })

  it.each([
    ['gate-blocked', 'staging_gate_blocked'],
    ['target-collision', 'target_version_collision'],
    ['package-conflict', 'staging_package_conflict'],
    ['replay-conflict', 'idempotency_conflict'],
  ])('maps %s conflicts to a bounded safe error', async (code, expected) => {
    const { studio, handler } = setup()
    studio.stageDraft.mockRejectedValueOnce(Object.assign(new Error('private detail'), { code }))
    const response = await handler(event('POST', `/api/admin/curriculum/drafts/${DRAFT}/staging`, {
      draftRevision: 3,
      idempotencyKey: REQUEST,
    }))
    expect(response.statusCode).toBe(409)
    expect(JSON.parse(response.body).error.code).toBe(expected)
    expect(response.body).not.toContain('private detail')
  })
})
