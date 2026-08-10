import { describe, expect, it, vi } from 'vitest'
import { createAdminAccessSource, AdminAccessSourceError } from './admin-access-source.js'

const PRINCIPAL_REF = '00000000-0000-4000-8000-000000000331'
const ASSIGNMENT_REF = '10000000-0000-4000-8000-000000000331'
const REQUEST_ID = '20000000-0000-4000-8000-000000000331'

function clientFor(result) {
  const builder = { abortSignal: vi.fn(async () => result) }
  return { client: { rpc: vi.fn(() => builder) }, builder }
}

describe('Admin access authenticated RPC source', () => {
  it('pins the bearer and reauthorizes reads in the database', async () => {
    const { client } = clientFor({ data: {
      schemaVersion: 2,
      principals: [{
        principalRef: PRINCIPAL_REF,
        assignmentRef: ASSIGNMENT_REF,
        role: 'viewer', status: 'active', revision: '1', isCurrent: true,
      }],
    }, error: null })
    const clientFactory = vi.fn(() => client)
    const source = createAdminAccessSource({ clientFactory })
    await expect(source.read('private-token')).resolves.toMatchObject({ schemaVersion: 2 })
    expect(clientFactory).toHaveBeenCalledWith('private-token')
    expect(client.rpc).toHaveBeenCalledWith('academy_admin_read_access_v1', {
      p_required_capability: 'overview:read',
    })
  })

  it('passes only canonical role mutation facts and the fixed manage capability', async () => {
    const { client } = clientFor({ data: {
      schemaVersion: 2,
      assignmentRef: ASSIGNMENT_REF,
      role: 'admin', status: 'active', revision: '1', idempotencyResult: 'applied',
    }, error: null })
    const source = createAdminAccessSource({ clientFactory: () => client })
    await source.mutate('private-token', {
      assignmentRef: ASSIGNMENT_REF,
      expectedRevision: '1',
      newRole: 'admin',
      reasonCode: 'operator.request',
      requestId: REQUEST_ID,
    })
    expect(client.rpc).toHaveBeenCalledWith('academy_admin_mutate_access_v1', {
      p_target_assignment_ref: ASSIGNMENT_REF,
      p_expected_revision: '1',
      p_new_role: 'admin',
      p_reason_code: 'operator.request',
      p_request_id: REQUEST_ID,
      p_required_capability: 'admin_roles:manage',
    })
  })

  it('fails closed for malformed data and maps only known database markers', async () => {
    const malformed = clientFor({ data: { schemaVersion: 2, principals: [], token: 'secret' }, error: null })
    await expect(createAdminAccessSource({ clientFactory: () => malformed.client }).read('token'))
      .rejects.toEqual(new AdminAccessSourceError('source_unavailable'))
    const denied = clientFor({ data: null, error: { message: 'ADMIN_ACCESS_MANAGE_REQUIRED secret internals' } })
    await expect(createAdminAccessSource({ clientFactory: () => denied.client }).mutate('token', {
      assignmentRef: ASSIGNMENT_REF, expectedRevision: '1', newRole: null,
      reasonCode: 'operator.request', requestId: REQUEST_ID,
    })).rejects.toEqual(new AdminAccessSourceError('manage_required'))
  })
})
