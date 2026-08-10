import { describe, expect, it } from 'vitest'
import type { AdminEngineId } from '../../admin/admin0Vocabulary'
import { ADMIN_ROLE_CAPABILITIES } from '../../admin/contracts'
import { adminRouteEngine, adminRouteSection, presentationAuthorization } from './AdminConsoleRoute'

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
    ['/academy/admin/curriculum/studio', 'curriculum-studio'],
    ['/academy/admin/curriculum/validation', 'curriculum-validation'],
    ['/academy/admin/curriculum/preview', 'curriculum-preview'],
    ['/academy/admin/curriculum/activation', 'curriculum-activation'],
    ['/academy/admin/health', 'system-health'],
    ['/academy/admin/health/gateway', 'system-health'],
    ['/academy/admin/system-health', 'system-health'],
    ['/academy/admin/audit-log', 'audit-log'],
  ] as const)('maps %s to %s', (pathname, section) => {
    expect(adminRouteSection(pathname)).toBe(section)
  })

  it.each([
    'tutor', 'study', 'assessment', 'curriculum', 'jarvis', 'tts', 'gateway', 'sync',
  ] as const)('supports the canonical %s engine deep link', (engine: AdminEngineId) => {
    const pathname = '/academy/admin/engines/' + engine
    expect(adminRouteEngine(pathname)).toBe(engine)
    expect(adminRouteSection(pathname)).toBe('engines')
  })

  it('fails closed for invalid or trailing engine deep links', () => {
    expect(adminRouteEngine('/academy/admin/engines/not-an-engine')).toBeNull()
    expect(adminRouteSection('/academy/admin/engines/not-an-engine')).toBe('unknown')
    expect(adminRouteSection('/academy/admin/engines/tutor/details')).toBe('unknown')
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
