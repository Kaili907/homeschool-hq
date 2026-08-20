import { describe, expect, it, vi } from 'vitest'
import { ADMIN_ROLE_CAPABILITIES } from '../../src/admin/contracts.ts'
import { errorResponse } from './_shared/http.js'
import { AdminAccessSourceError } from './_shared/admin-access-source.js'
import { createAdminAccessHandler, parseAccessMutationRequest } from './admin-access.js'

const ASSIGNMENT_REF = '10000000-0000-4000-8000-000000000321'
const PRINCIPAL_REF = '00000000-0000-4000-8000-000000000321'
const REQUEST_ID = '20000000-0000-4000-8000-000000000321'

function event(overrides = {}) {
  return {
    httpMethod: 'GET',
    path: '/api/admin/v1/access',
    headers: { authorization: 'Bearer verified.access.token' },
    ...overrides,
  }
}

function mutationEvent(path, body = {}) {
  return event({
    httpMethod: 'POST',
    path,
    headers: {
      authorization: 'Bearer verified.access.token',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      assignmentRef: ASSIGNMENT_REF,
      expectedRevision: '1',
      reasonCode: 'operator.request',
      requestId: REQUEST_ID,
      ...body,
    }),
  })
}

function authorized(role = 'owner') {
  return {
    ok: true,
    accessToken: 'private-token',
    principal: { userId: 'private-user', role, capabilities: ADMIN_ROLE_CAPABILITIES[role] },
  }
}

function assuredDependencies() {
  return {
    stepUpAssurance: {
      consume: vi.fn(async ({ binding }) => ({ ok: true, binding })),
    },
    criticalActionAudit: { record: vi.fn(async () => {}) },
    requestSourceGuard: () => ({ ok: true }),
  }
}

describe('Admin access endpoint', () => {
  it.each(['viewer', 'admin', 'owner'])('allows %s read through the canonical baseline capability', async (role) => {
    const require = vi.fn(async () => authorized(role))
    const source = { read: vi.fn(async () => ({
      schemaVersion: 2,
      principals: [{
        principalRef: PRINCIPAL_REF,
        assignmentRef: ASSIGNMENT_REF,
        role,
        status: 'active',
        revision: '1',
        isCurrent: true,
        capabilities: ADMIN_ROLE_CAPABILITIES[role],
      }],
    })) }
    const response = await createAdminAccessHandler({ authorization: { require }, source })(event())
    expect(require).toHaveBeenCalledWith(expect.anything(), 'overview:read')
    expect(source.read).toHaveBeenCalledWith('private-token')
    expect(response.statusCode).toBe(200)
    expect(response.body).not.toMatch(/private-token|private-user|password|session/i)
  })

  it('requires owner management capability for role change and forwards no client capability array', async () => {
    const require = vi.fn(async () => authorized())
    const source = { mutate: vi.fn(async () => ({
      schemaVersion: 2,
      assignmentRef: ASSIGNMENT_REF,
      role: 'admin',
      status: 'active',
      revision: '1',
      idempotencyResult: 'applied',
    })) }
    const assurance = assuredDependencies()
    const response = await createAdminAccessHandler({
      authorization: { require }, source, ...assurance,
    })(
      mutationEvent('/api/admin/v1/access/change-role', { newRole: 'admin' }),
    )
    expect(response.statusCode).toBe(200)
    expect(require).toHaveBeenCalledWith(expect.anything(), 'admin_roles:manage')
    expect(source.mutate).toHaveBeenCalledWith('private-token', {
      assignmentRef: ASSIGNMENT_REF,
      expectedRevision: '1',
      newRole: 'admin',
      reasonCode: 'operator.request',
      requestId: REQUEST_ID,
    })
    expect(JSON.stringify(source.mutate.mock.calls[0][1])).not.toMatch(/capabilit|actor|token/i)
    expect(assurance.stepUpAssurance.consume).toHaveBeenCalledWith({
      event: expect.anything(),
      binding: {
        actorId: 'private-user',
        action: 'admin.role.change',
        resource: { type: 'admin-role-assignment', id: ASSIGNMENT_REF },
      },
    })
  })

  it('preserves authorization denial for admin/viewer mutation attempts', async () => {
    const require = vi.fn(async () => ({
      ok: false,
      response: errorResponse(403, 'admin_access_denied'),
    }))
    const source = { mutate: vi.fn() }
    const response = await createAdminAccessHandler({ authorization: { require }, source })(
      mutationEvent('/api/admin/v1/access/revoke'),
    )
    expect(response.statusCode).toBe(403)
    expect(source.mutate).not.toHaveBeenCalled()
  })

  it('fails closed before role persistence when step-up is unavailable', async () => {
    const source = { mutate: vi.fn() }
    const response = await createAdminAccessHandler({
      authorization: { require: vi.fn(async () => authorized()) },
      source,
      requestSourceGuard: () => ({ ok: true }),
      criticalActionAudit: { record: vi.fn(async () => {}) },
    })(mutationEvent('/api/admin/v1/access/revoke'))
    expect(response.statusCode).toBe(503)
    expect(JSON.parse(response.body)).toEqual({ error: { code: 'step_up_unavailable' } })
    expect(source.mutate).not.toHaveBeenCalled()
  })

  it('binds revocation assurance to the exact actor and assignment', async () => {
    const assurance = assuredDependencies()
    const source = { mutate: vi.fn(async () => ({
      schemaVersion: 2,
      assignmentRef: ASSIGNMENT_REF,
      role: 'viewer',
      status: 'revoked',
      revision: '2',
      idempotencyResult: 'applied',
    })) }
    const response = await createAdminAccessHandler({
      authorization: { require: vi.fn(async () => authorized()) },
      source,
      ...assurance,
    })(mutationEvent('/api/admin/v1/access/revoke'))
    expect(response.statusCode).toBe(200)
    expect(assurance.stepUpAssurance.consume).toHaveBeenCalledWith({
      event: expect.anything(),
      binding: {
        actorId: 'private-user',
        action: 'admin.role.revoke',
        resource: { type: 'admin-role-assignment', id: ASSIGNMENT_REF },
      },
    })
  })

  it('rejects forged roles, capabilities, unknown roles, queries, methods, and oversized revisions', async () => {
    for (const body of [
      { newRole: 'owner', role: 'owner' },
      { newRole: 'owner', capabilities: ['admin_roles:manage'] },
      { newRole: 'superuser' },
      { newRole: 'owner', expectedRevision: '9223372036854775808' },
    ]) {
      expect(() => parseAccessMutationRequest(
        mutationEvent('/api/admin/v1/access/change-role', body),
        'change-role',
      )).toThrow()
    }
    const require = vi.fn()
    const handler = createAdminAccessHandler({ authorization: { require }, source: {} })
    expect((await handler(event({ httpMethod: 'DELETE' }))).statusCode).toBe(405)
    expect((await handler(event({ path: '/api/admin/v1/access/unknown' }))).statusCode).toBe(404)
    expect((await handler(event({ queryStringParameters: { role: 'owner' } }))).statusCode).toBe(400)
    expect(require).not.toHaveBeenCalled()
  })

  it.each([
    ['sole_owner_protected', 409, 'sole_owner_protected'],
    ['revision_conflict', 409, 'revision_conflict'],
    ['idempotency_conflict', 409, 'idempotency_conflict'],
    ['manage_required', 403, 'admin_access_denied'],
    ['source_timeout', 504, 'access_source_timeout'],
  ])('maps %s to a safe bounded response', async (sourceCode, status, responseCode) => {
    const handler = createAdminAccessHandler({
      authorization: { require: vi.fn(async () => authorized()) },
      source: { mutate: vi.fn(async () => { throw new AdminAccessSourceError(sourceCode) }) },
      ...assuredDependencies(),
    })
    const response = await handler(mutationEvent('/api/admin/v1/access/revoke'))
    expect(response.statusCode).toBe(status)
    expect(JSON.parse(response.body)).toEqual({ error: { code: responseCode } })
    expect(response.body).not.toContain('ADMIN_ACCESS_')
  })
})
