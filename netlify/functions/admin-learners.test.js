import { describe, expect, it, vi } from 'vitest'
import { ADMIN_ROLE_CAPABILITIES } from '../../src/admin/contracts.ts'
import { errorResponse } from './_shared/http.js'
import { AdminLearnerProjectionError } from './_shared/admin-learner-reader.js'
import { createAdminLearnersHandler } from './admin-learners.js'

function event(overrides = {}) {
  return {
    httpMethod: 'GET',
    path: '/api/admin/v1/learners',
    headers: { authorization: 'Bearer verified.access.token' },
    ...overrides,
  }
}

function permitted(role = 'viewer') {
  return {
    require: vi.fn(async () => ({
      ok: true,
      accessToken: 'verified.access.token',
      principal: { userId: 'private-user', role, capabilities: ADMIN_ROLE_CAPABILITIES[role] },
    })),
  }
}

function denied(statusCode, code) {
  return { require: vi.fn(async () => ({ ok: false, response: errorResponse(statusCode, code) })) }
}

describe('authorized learner analytics endpoint', () => {
  it.each(['viewer', 'admin', 'owner'])('allows canonical %s learners:read access', async (role) => {
    const authorization = permitted(role)
    const projection = { observedAt: '2026-09-09T18:00:00.000Z', learners: [], details: {} }
    const reader = { readSnapshot: vi.fn(async () => projection), readDetail: vi.fn() }
    const response = await createAdminLearnersHandler({ authorization, reader })(event())
    expect(authorization.require).toHaveBeenCalledWith(expect.anything(), 'learners:read')
    expect(reader.readSnapshot).toHaveBeenCalledWith({ accessToken: 'verified.access.token' })
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual(projection)
  })

  it.each([
    ['unauthenticated', 401, 'unauthenticated'],
    ['student', 401, 'unauthenticated'],
    ['ordinary guardian', 403, 'admin_access_denied'],
    ['revoked Admin', 403, 'admin_access_denied'],
    ['expired Admin', 403, 'admin_access_denied'],
    ['authorization uncertainty', 503, 'authorization_unavailable'],
  ])('denies %s before learner persistence is read', async (_label, statusCode, code) => {
    const authorization = denied(statusCode, code)
    const reader = { readSnapshot: vi.fn(), readDetail: vi.fn() }
    const response = await createAdminLearnersHandler({ authorization, reader })(event())
    expect(response.statusCode).toBe(statusCode)
    expect(JSON.parse(response.body)).toEqual({ error: { code } })
    expect(reader.readSnapshot).not.toHaveBeenCalled()
  })

  it('independently authorizes detail reads and returns only an in-scope learner', async () => {
    const authorization = permitted()
    const reader = {
      readSnapshot: vi.fn(),
      readDetail: vi.fn(async () => ({ observedAt: '2026-09-09T18:00:00.000Z', detail: { learnerRef: 'p1' } })),
    }
    const response = await createAdminLearnersHandler({ authorization, reader })(event({ path: '/api/admin/v1/learners/p1' }))
    expect(authorization.require).toHaveBeenCalledWith(expect.anything(), 'learners:read')
    expect(reader.readDetail).toHaveBeenCalledWith({ accessToken: 'verified.access.token', learnerRef: 'p1' })
    expect(response.statusCode).toBe(200)
  })

  it('accepts only a canonical local-date selector for today evidence', async () => {
    const authorization = permitted()
    const reader = { readSnapshot: vi.fn(async () => ({ observedAt: '2026-09-09T18:00:00.000Z', learners: [], details: {} })), readDetail: vi.fn() }
    const handler = createAdminLearnersHandler({ authorization, reader })
    const response = await handler(event({ queryStringParameters: { today: '2026-09-09' }, rawQueryString: 'today=2026-09-09' }))
    expect(response.statusCode).toBe(200)
    expect(reader.readSnapshot).toHaveBeenCalledWith({ accessToken: 'verified.access.token', today: '2026-09-09' })
    for (const today of ['2026-02-30', '09-09-2026', '']) {
      expect((await handler(event({ queryStringParameters: { today } }))).statusCode).toBe(400)
    }
  })

  it('returns bounded stable codes for out-of-scope and source failures', async () => {
    const outOfScope = createAdminLearnersHandler({
      authorization: permitted(),
      reader: { readSnapshot: vi.fn(), readDetail: vi.fn(async () => { throw new AdminLearnerProjectionError('learner_not_found') }) },
    })
    expect(JSON.parse((await outOfScope(event({ path: '/api/admin/v1/learners/p2' }))).body)).toEqual({ error: { code: 'learner_not_found' } })

    const failed = createAdminLearnersHandler({
      authorization: permitted(),
      reader: { readSnapshot: vi.fn(async () => { throw new Error('SQL PRIVATE DATA') }), readDetail: vi.fn() },
    })
    const response = await failed(event())
    expect(response.statusCode).toBe(503)
    expect(JSON.parse(response.body)).toEqual({ error: { code: 'learner_source_unavailable' } })
    expect(response.body).not.toContain('SQL PRIVATE DATA')
  })

  it('refuses to serialize fields outside the learner operations allowlist', async () => {
    const reader = {
      readSnapshot: vi.fn(async () => ({
        observedAt: '2026-09-09T18:00:00.000Z',
        learners: [],
        details: {},
        messages: [{ prompt: 'RAW LEARNER PROMPT', response: 'RAW MODEL RESPONSE' }],
      })),
      readDetail: vi.fn(),
    }
    const response = await createAdminLearnersHandler({ authorization: permitted(), reader })(event())
    expect(response.statusCode).toBe(503)
    expect(JSON.parse(response.body)).toEqual({ error: { code: 'learner_source_unavailable' } })
    expect(response.body).not.toContain('RAW LEARNER PROMPT')
    expect(response.body).not.toContain('RAW MODEL RESPONSE')
  })

  it('accepts no browser household, role, capability, or mutation input', async () => {
    const authorization = permitted('viewer')
    const reader = { readSnapshot: vi.fn(), readDetail: vi.fn() }
    const handler = createAdminLearnersHandler({ authorization, reader })
    for (const forged of [
      event({ queryStringParameters: { householdId: 'other-household' } }),
      event({ body: JSON.stringify({ role: 'owner', capabilities: ['learners:read'], householdId: 'other' }) }),
      event({ path: '/api/admin/v1/learners/other-household/p1' }),
      event({ httpMethod: 'POST' }),
    ]) {
      const response = await handler(forged)
      expect([400, 404, 405]).toContain(response.statusCode)
    }
    expect(authorization.require).not.toHaveBeenCalled()
    expect(reader.readSnapshot).not.toHaveBeenCalled()
  })
})
