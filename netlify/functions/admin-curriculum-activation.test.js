import { describe, expect, it, vi } from 'vitest'
import { createAdminCurriculumHandler } from './admin-curriculum.js'

const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const REQUEST = '50000000-0000-4000-8000-000000000001'

function event(method, body) {
  return {
    httpMethod: method,
    path: '/api/admin/curriculum/activation',
    headers: {
      authorization: 'Bearer verified',
      'x-admin-role': 'owner',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }
}

function status() {
  return {
    schemaVersion: 1,
    environment: 'production',
    authority: 'default_current_curriculum',
    existingLearnersRepinned: false,
    pointer: {
      releaseVersion: '1.0.0', revision: 1, transitionKind: 'migration_seed',
      bindingMode: 'registry_only', transitionedAt: '2026-08-09T16:00:00.000Z',
    },
    candidates: [], history: [], historyTruncated: false,
  }
}

function setup(authorizationResult = {
  ok: true,
  principal: { userId: ACTOR, role: 'owner', capabilities: ['curriculum:read', 'releases:manage'] },
}) {
  const authorization = { require: vi.fn(async () => authorizationResult) }
  const activation = {
    read: vi.fn(async () => status()),
    transition: vi.fn(async () => ({
      ...status(),
      pointer: { ...status().pointer, releaseVersion: '2.0.0', revision: 2, transitionKind: 'activation', bindingMode: 'default_authority' },
      transition: {
        state: 'transitioned', transitionKind: 'activation',
        previousReleaseVersion: '1.0.0', newReleaseVersion: '2.0.0',
        pointerRevision: 2, correlationId: REQUEST,
      },
      replayed: false,
    })),
  }
  const handler = createAdminCurriculumHandler({
    authorization, activation,
    studio: {}, authoring: {}, approval: {}, staging: {}, registry: {}, source: {},
  })
  return { activation, authorization, handler }
}

function activationBody(overrides = {}) {
  return {
    targetReleaseVersion: '2.0.0',
    expectedPointerRevision: 1,
    transitionKind: 'activation',
    reasonCode: 'release.activated',
    idempotencyKey: REQUEST,
    ...overrides,
  }
}

describe('Admin curriculum activation HTTP boundary', () => {
  it('reads with curriculum:read and transitions with releases:manage', async () => {
    const { activation, authorization, handler } = setup()
    const read = await handler(event('GET'))
    const write = await handler(event('POST', activationBody()))
    expect(read.statusCode).toBe(200)
    expect(write.statusCode).toBe(201)
    expect(authorization.require.mock.calls.map((call) => call[1])).toEqual([
      'curriculum:read', 'releases:manage',
    ])
    expect(activation.read).toHaveBeenCalledWith(ACTOR)
    expect(activation.transition).toHaveBeenCalledWith(ACTOR, activationBody())
    expect(JSON.parse(write.body).existingLearnersRepinned).toBe(false)
  })

  it('rejects forged authority and malformed reason/kind pairs before persistence', async () => {
    const { activation, handler } = setup()
    const forged = await handler(event('POST', activationBody({ role: 'owner' })))
    const mismatched = await handler(event('POST', activationBody({
      transitionKind: 'rollback', reasonCode: 'release.activated',
    })))
    expect(forged.statusCode).toBe(400)
    expect(mismatched.statusCode).toBe(400)
    expect(activation.transition).not.toHaveBeenCalled()
  })

  it('fails before mutation when current server authorization denies', async () => {
    const denial = { ok: false, response: { statusCode: 403, body: '{"error":{"code":"admin_access_denied"}}' } }
    const { activation, handler } = setup(denial)
    const response = await handler(event('POST', activationBody()))
    expect(response.statusCode).toBe(403)
    expect(activation.transition).not.toHaveBeenCalled()
  })

  it.each([
    ['pointer-conflict', 'pointer_revision_conflict', 409],
    ['replay-conflict', 'idempotency_conflict', 409],
    ['target-not-published', 'target_not_published', 409],
    ['artifacts-unavailable', 'release_artifacts_unavailable', 409],
    ['kind-conflict', 'transition_kind_conflict', 409],
    ['target-not-found', 'curriculum_release_unavailable', 404],
  ])('maps %s to a bounded %s response', async (code, responseCode, expectedStatus) => {
    const { activation, handler } = setup()
    activation.transition.mockRejectedValueOnce(Object.assign(new Error('private detail'), { code }))
    const response = await handler(event('POST', activationBody()))
    expect(response.statusCode).toBe(expectedStatus)
    expect(JSON.parse(response.body).error.code).toBe(responseCode)
    expect(response.body).not.toContain('private detail')
  })

  it('has no deployment or implicit hosted side effect on GET and rejects unsupported methods', async () => {
    const { activation, handler } = setup()
    const read = await handler(event('GET'))
    const deletion = await handler(event('DELETE'))
    expect(read.statusCode).toBe(200)
    expect(deletion.statusCode).toBe(405)
    expect(activation.transition).not.toHaveBeenCalled()
  })
})
