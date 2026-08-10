import { describe, expect, it } from 'vitest'
import type { AdminEngineId } from '../../admin/admin0Vocabulary'
import { ADMIN_ROLE_CAPABILITIES } from '../../admin/contracts'
import {
  adminRouteEngine,
  adminRouteLearnerRef,
  adminRouteSection,
  configurationReadStateAfterCommit,
  configurationRetryAfterCommit,
  defaultIncidentFilters,
  curriculumWorkflowIdentityFromSearch,
  presentationAuthorization,
} from './AdminConsoleRoute'

describe('Admin Console integration route', () => {
  it.each([
    ['/academy/admin', 'overview'],
    ['/academy/admin/', 'overview'],
    ['/academy/admin/attention', 'attention'],
    ['/academy/admin/learners', 'learners'],
    ['/academy/admin/learners/p1', 'learners'],
    ['/academy/admin/engines', 'engines'],
    ['/academy/admin/engines/tutor', 'engines'],
    ['/academy/admin/costs', 'costs'],
    ['/academy/admin/safety/events/one', 'safety'],
    ['/academy/admin/curriculum', 'curriculum'],
    ['/academy/admin/curriculum/studio', 'curriculum-studio'],
    ['/academy/admin/curriculum/integrity', 'curriculum-integrity'],
    ['/academy/admin/curriculum/validation', 'curriculum-validation'],
    ['/academy/admin/curriculum/preview', 'curriculum-preview'],
    ['/academy/admin/curriculum/standards-review', 'curriculum-standards-review'],
    ['/academy/admin/health', 'system-health'],
    ['/academy/admin/health/gateway', 'system-health'],
    ['/academy/admin/system-health', 'system-health'],
    ['/academy/admin/configuration', 'configuration'],
    ['/academy/admin/audit-log', 'audit-log'],
    ['/academy/admin/incidents', 'incidents'],
    ['/academy/admin/correlations', 'incidents'],
    ['/academy/admin/access', 'access'],
    ['/academy/admin/production-readiness', 'releases'],
    ['/academy/admin/readiness', 'releases'],
    ['/academy/admin/releases', 'releases'],
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

  it('supports only canonical learner detail deep links and fails closed for unknown references', () => {
    expect(adminRouteLearnerRef('/academy/admin/learners/p1')).toBe('p1')
    expect(adminRouteLearnerRef('/academy/admin/learners/p5/')).toBe('p5')
    expect(adminRouteLearnerRef('/academy/admin/learners')).toBeNull()
    expect(adminRouteLearnerRef('/academy/admin/learners/other')).toBeNull()
    expect(adminRouteSection('/academy/admin/learners/other')).toBe('unknown')
    expect(adminRouteSection('/academy/admin/learners/p1/history')).toBe('unknown')
  })

  it('never matches the learner administrator-like path', () => {
    expect(adminRouteSection('/academy/administrator')).toBeNull()
  })

  it('accepts only a complete exact draft workflow identity', () => {
    const draftId = '10000000-0000-4000-8000-000000000001'
    expect(curriculumWorkflowIdentityFromSearch(`?draft=${draftId}&revision=12`)).toEqual({
      draftId,
      draftRevision: 12,
    })
    expect(curriculumWorkflowIdentityFromSearch(`?draft=${draftId}`)).toBeNull()
    expect(curriculumWorkflowIdentityFromSearch('?draft=not-a-uuid&revision=12')).toBeNull()
    expect(curriculumWorkflowIdentityFromSearch(`?draft=${draftId}&revision=0`)).toBeNull()
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

  it('invalidates browser state after commit and triggers an authoritative reread', () => {
    expect(configurationReadStateAfterCommit()).toEqual({ status: 'loading' })
    expect(configurationRetryAfterCommit(4)).toBe(5)
  })

  it('starts the incident explorer with a bounded trailing 24-hour query', () => {
    expect(defaultIncidentFilters(new Date('2026-08-10T16:00:00.000Z'))).toEqual({
      occurredFrom: '2026-08-09T16:00:00.000Z',
      occurredTo: '2026-08-10T16:00:00.000Z',
      domain: 'all',
      limit: 50,
    })
  })
})
