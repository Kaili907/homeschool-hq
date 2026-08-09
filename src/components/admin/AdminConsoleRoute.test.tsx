import { describe, expect, it } from 'vitest'
import { ADMIN_ROLE_CAPABILITIES } from '../../admin/contracts'
import { adminRouteSection, presentationAuthorization } from './AdminConsoleRoute'

describe('Admin Console integration route', () => {
  it.each([
    ['/academy/admin', 'overview'],
    ['/academy/admin/', 'overview'],
    ['/academy/admin/learners', 'learners'],
    ['/academy/admin/engines', 'engines'],
    ['/academy/admin/engines/tutor', 'engines'],
    ['/academy/admin/costs', 'costs'],
    ['/academy/admin/safety/events/one', 'safety'],
    ['/academy/admin/curriculum', 'curriculum'],
    ['/academy/admin/curriculum/validation', 'curriculum-validation'],
    ['/academy/admin/health', 'system-health'],
    ['/academy/admin/health/gateway', 'system-health'],
    ['/academy/admin/system-health', 'system-health'],
  ] as const)('maps %s to %s', (pathname, section) => {
    expect(adminRouteSection(pathname)).toBe(section)
  })

  it('never matches the learner administrator-like path', () => {
    expect(adminRouteSection('/academy/administrator')).toBeNull()
  })

  it('keeps authorization unresolved and unavailable states fail closed', () => {
    expect(presentationAuthorization({ status: 'resolving' })).toEqual({ status: 'resolving' })
    expect(presentationAuthorization({ status: 'unavailable' })).toEqual({
      status: 'unauthorized', reasonCode: 'authorization_unavailable',
    })
    expect(presentationAuthorization({ status: 'unauthenticated' })).toEqual({
      status: 'unauthorized', reasonCode: 'admin_assignment_required',
    })
    expect(presentationAuthorization({ status: 'forbidden' })).toEqual({
      status: 'unauthorized', reasonCode: 'admin_assignment_required',
    })
  })

  it.each(['viewer', 'admin', 'owner'] as const)('preserves the canonical %s presentation capabilities', (role) => {
    expect(presentationAuthorization({
      contractVersion: 2,
      status: 'authorized',
      role,
      capabilities: ADMIN_ROLE_CAPABILITIES[role],
    })).toEqual({ status: 'authorized', role, capabilities: ADMIN_ROLE_CAPABILITIES[role] })
  })
})
