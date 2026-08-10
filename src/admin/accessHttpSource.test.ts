import { describe, expect, it, vi } from 'vitest'
import { createAdminAccessHttpSource, AdminAccessError } from './accessHttpSource'

const PRINCIPAL_REF = '00000000-0000-4000-8000-000000000311'
const ASSIGNMENT_REF = '10000000-0000-4000-8000-000000000311'
const REQUEST_ID = '20000000-0000-4000-8000-000000000311'

const projection = {
  schemaVersion: 2,
  principals: [{
    principalRef: PRINCIPAL_REF,
    assignmentRef: ASSIGNMENT_REF,
    role: 'viewer',
    status: 'active',
    revision: '1',
    isCurrent: true,
  }],
}

describe('Admin access HTTP source', () => {
  it('reads with bearer authority and never sends browser role or capability claims', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => ({ status: 200, json: async () => projection }))
    const source = createAdminAccessHttpSource({
      getAccessToken: async () => 'private-token',
      fetchImpl,
    })
    await expect(source.read()).resolves.toMatchObject({ schemaVersion: 2 })
    const [url, request] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/admin/v1/access')
    expect(request.method).toBe('GET')
    expect(request).not.toHaveProperty('body')
    expect(JSON.stringify(request)).not.toMatch(/admin_roles:manage|service.?role|password/i)
  })

  it('sends only a canonical role and bounded mutation facts', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => ({
      status: 200,
      json: async () => ({
        schemaVersion: 2,
        assignmentRef: ASSIGNMENT_REF,
        role: 'admin',
        status: 'active',
        revision: '1',
        idempotencyResult: 'applied',
      }),
    }))
    const source = createAdminAccessHttpSource({
      getAccessToken: async () => 'private-token',
      fetchImpl,
    })
    await source.mutate({
      action: 'change-role',
      assignmentRef: ASSIGNMENT_REF,
      expectedRevision: '1',
      newRole: 'admin',
      reasonCode: 'operator.request',
      requestId: REQUEST_ID,
    })
    const [url, request] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/admin/v1/access/change-role')
    expect(JSON.parse(request.body as string)).toEqual({
      assignmentRef: ASSIGNMENT_REF,
      expectedRevision: '1',
      newRole: 'admin',
      reasonCode: 'operator.request',
      requestId: REQUEST_ID,
    })
    expect(request.body).not.toMatch(/capabilit|actor|token|email|password/i)
  })

  it('fails closed for missing auth, malformed responses, and safe conflict codes', async () => {
    await expect(createAdminAccessHttpSource({ getAccessToken: async () => null }).read())
      .rejects.toMatchObject({ code: 'access_unauthorized' })
    const malformed = createAdminAccessHttpSource({
      getAccessToken: async () => 'token',
      fetchImpl: async () => ({ status: 200, json: async () => ({ ...projection, sessionId: 'secret' }) }),
    })
    await expect(malformed.read()).rejects.toMatchObject({ code: 'access_malformed' })
    const conflict = createAdminAccessHttpSource({
      getAccessToken: async () => 'token',
      fetchImpl: async () => ({
        status: 409,
        json: async () => ({ error: { code: 'sole_owner_protected' } }),
      }),
    })
    await expect(conflict.mutate({
      action: 'revoke', assignmentRef: ASSIGNMENT_REF, expectedRevision: '1',
      reasonCode: 'operator.request', requestId: REQUEST_ID,
    })).rejects.toEqual(new AdminAccessError('sole_owner_protected'))
  })
})
