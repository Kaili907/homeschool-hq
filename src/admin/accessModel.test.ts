import { describe, expect, it } from 'vitest'
import { ADMIN_ROLE_CAPABILITIES } from './contracts'
import {
  sanitizeAdminAccessMutationResult,
  sanitizeAdminAccessProjection,
} from './accessModel'

const OWNER_REF = '00000000-0000-4000-8000-000000000301'
const ADMIN_REF = '00000000-0000-4000-8000-000000000302'
const OWNER_ASSIGNMENT = '10000000-0000-4000-8000-000000000301'
const ADMIN_ASSIGNMENT = '10000000-0000-4000-8000-000000000302'

function projection() {
  return {
    schemaVersion: 2,
    principals: [
      {
        principalRef: OWNER_REF,
        assignmentRef: OWNER_ASSIGNMENT,
        role: 'owner',
        status: 'active',
        revision: '1',
        isCurrent: true,
      },
      {
        principalRef: ADMIN_REF,
        assignmentRef: ADMIN_ASSIGNMENT,
        role: 'admin',
        status: 'active',
        revision: '1',
        isCurrent: false,
      },
    ],
  }
}

describe('Admin access browser-safe contract', () => {
  it('derives exact effective capabilities from each canonical server role', () => {
    const value = sanitizeAdminAccessProjection(projection())
    expect(value?.principals[0].capabilities).toBe(ADMIN_ROLE_CAPABILITIES.owner)
    expect(value?.principals[1].capabilities).toBe(ADMIN_ROLE_CAPABILITIES.admin)
    expect(value?.principals[1].capabilities).not.toContain('admin_roles:manage')
  })

  it('rejects extra account/security internals and malformed or ambiguous principals', () => {
    for (const value of [
      { ...projection(), token: 'secret' },
      { ...projection(), principals: [{ ...projection().principals[0], email: 'private@example.test' }] },
      { ...projection(), principals: [{ ...projection().principals[0], role: 'superuser' }] },
      { ...projection(), principals: [{ ...projection().principals[0], capabilities: ['admin_roles:manage'] }] },
      { ...projection(), principals: projection().principals.map((item) => ({ ...item, isCurrent: false })) },
      { ...projection(), principals: [projection().principals[0], projection().principals[0]] },
    ]) expect(sanitizeAdminAccessProjection(value)).toBeNull()
  })

  it('accepts only the exact minimized mutation result', () => {
    const result = {
      schemaVersion: 2,
      assignmentRef: ADMIN_ASSIGNMENT,
      role: 'viewer',
      status: 'active',
      revision: '1',
      idempotencyResult: 'applied',
    }
    expect(sanitizeAdminAccessMutationResult(result)).toEqual(result)
    expect(sanitizeAdminAccessMutationResult({ ...result, capabilities: ['admin_roles:manage'] }))
      .toBeNull()
    expect(sanitizeAdminAccessMutationResult({ ...result, role: 'superuser' })).toBeNull()
  })
})
