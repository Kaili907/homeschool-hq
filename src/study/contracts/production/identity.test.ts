import { describe, expect, it } from 'vitest'
import {
  authorizeAdultNotification,
  authorizeGuardianStudy,
  authorizeStaffStudy,
  authorizeStudentSessionStudy,
  findBrowserSuppliedAuthorityClaims,
  isProductionIdentityId,
  isScopeAuthorized,
  validateCurrentAuthority,
  type AuthorizationWindow,
  type ServerAdultNotificationEvidence,
  type ServerGuardianAuthorizationEvidence,
  type ServerStaffAuthorizationEvidence,
  type ServerStudentSessionAuthorizationEvidence,
} from './identity'

const IDS = Object.freeze({
  user: '41ad27ea-c9a7-4e27-8a35-a73c3ebac5df',
  household: '2cc71706-06b9-44a4-8783-b11189f28c61',
  otherHousehold: '74a041a5-9cf9-42a8-a29f-a0e1ecea5925',
  student: '87b9e08a-74f7-42a5-84bd-04bac646d3be',
  otherStudent: 'fb577669-6531-4f5b-95d1-6906992b44db',
  learnerSession: '5dd97f4b-2743-405f-824f-76c1cf769757',
  membership: '35e38826-fc57-4211-935f-e240fef0bef5',
  relationship: 'fbc5a728-35ad-42bb-a642-9e7034fb0cef',
  grant: '9fd94040-68e2-4bbe-bbf1-7a665c7a3298',
  staff: 'b7b105ee-a2d0-4149-a51c-e5bec667fd3b',
  permission: '3093c19f-719e-4fb3-b5c5-6d0992b24e45',
})

const NOW = new Date('2026-08-01T16:00:00.000Z')
const epochs = Object.freeze({ authenticatedSession: 4, household: 7, learner: 9, membership: 3, relationship: 5 })
const window: AuthorizationWindow = Object.freeze({
  revision: 12,
  issuedAt: '2026-08-01T15:55:00.000Z',
  expiresAt: '2026-08-01T16:10:00.000Z',
  lifecycleEpochs: epochs,
})

const guardianEvidence = (overrides: Partial<ServerGuardianAuthorizationEvidence> = {}): ServerGuardianAuthorizationEvidence => ({
  authoritySource: 'verified-server',
  evidenceRef: 'authorization-evidence:9ae7ac118c2d45aa9e55',
  authenticatedUserId: IDS.user,
  householdId: IDS.household,
  studentId: IDS.student,
  learnerSessionId: IDS.learnerSession,
  membershipId: IDS.membership,
  relationshipId: IDS.relationship,
  householdStatus: 'active',
  learnerStatus: 'active',
  membershipStatus: 'active',
  memberRole: 'guardian',
  relationshipStatus: 'active',
  permission: 'learning_manager',
  window,
  ...overrides,
})

describe('canonical server-derived Study identity', () => {
  it('authorizes only an active guardian, household membership, learner relationship, and permission', () => {
    const result = authorizeGuardianStudy(guardianEvidence(), NOW)
    expect(result.status).toBe('authorized')
    if (result.status !== 'authorized') throw new Error('expected authorization')
    expect(result.authority).toMatchObject({
      authoritySource: 'verified-server',
      actorKind: 'guardian',
      householdId: IDS.household,
      studentId: IDS.student,
      membershipId: IDS.membership,
      relationshipId: IDS.relationship,
    })

    expect(authorizeGuardianStudy(guardianEvidence({ membershipStatus: 'revoked' }), NOW)).toEqual({
      status: 'denied', code: 'membership-not-active',
    })
    expect(authorizeGuardianStudy(guardianEvidence({ relationshipStatus: 'revoked' }), NOW)).toEqual({
      status: 'denied', code: 'relationship-not-active',
    })
    expect(authorizeGuardianStudy(guardianEvidence({ learnerStatus: 'paused' }), NOW)).toEqual({
      status: 'denied', code: 'learner-not-active',
    })
    expect(authorizeGuardianStudy(guardianEvidence({ permission: 'viewer' }), NOW, 'learning_manager')).toEqual({
      status: 'denied', code: 'learner-permission-required',
    })
  })

  it('rejects browser-supplied authority fields while allowing a learner selector', () => {
    expect(findBrowserSuppliedAuthorityClaims({
      requestId: 'opaque-request',
      studentRef: { kind: 'academy-student-id', value: IDS.student },
      householdId: IDS.otherHousehold,
      role: 'guardian',
      recipientRef: 'forged-recipient',
    })).toEqual(['householdId', 'recipientRef', 'role'])
    expect(findBrowserSuppliedAuthorityClaims({ requestId: 'opaque-request', studentRef: { value: IDS.student } })).toEqual([])
    expect(findBrowserSuppliedAuthorityClaims({ authority: { staffRole: 'staff', permissions: ['study:manage'] } })).toEqual([
      'permissions', 'staffRole',
    ])
    expect(authorizeGuardianStudy(guardianEvidence({ authoritySource: 'browser' as 'verified-server' }), NOW)).toEqual({
      status: 'denied', code: 'browser-authority-claim-rejected',
    })
  })

  it('rejects synthetic, sentinel, preview, test, and repeated UUID identifiers', () => {
    expect(isProductionIdentityId('learner:synthetic-grade5')).toBe(false)
    expect(isProductionIdentityId('student:preview')).toBe(false)
    expect(isProductionIdentityId('00000000-0000-0000-0000-000000000000')).toBe(false)
    expect(isProductionIdentityId('11111111-1111-1111-1111-111111111111')).toBe(false)
    expect(authorizeGuardianStudy(guardianEvidence({ studentId: 'learner:synthetic-grade5' }), NOW)).toEqual({
      status: 'denied', code: 'synthetic-identifier-rejected',
    })
  })

  it('invalidates stale work on learner switch, logout epoch change, revocation, and expiry', () => {
    const result = authorizeGuardianStudy(guardianEvidence(), NOW)
    if (result.status !== 'authorized') throw new Error('expected authorization')
    const current = {
      now: NOW,
      authorizationRevision: 12,
      householdId: IDS.household,
      studentId: IDS.student,
      learnerSessionId: IDS.learnerSession,
      lifecycleEpochs: epochs,
      revoked: false,
    }
    expect(validateCurrentAuthority(result.authority, current)).toEqual({ current: true })
    expect(validateCurrentAuthority(result.authority, { ...current, studentId: IDS.otherStudent })).toEqual({
      current: false, code: 'learner-mismatch',
    })
    expect(validateCurrentAuthority(result.authority, {
      ...current, lifecycleEpochs: { ...epochs, authenticatedSession: epochs.authenticatedSession + 1 },
    })).toEqual({ current: false, code: 'lifecycle-epoch-stale' })
    expect(validateCurrentAuthority(result.authority, { ...current, revoked: true })).toEqual({
      current: false, code: 'authorization-revoked',
    })
    expect(validateCurrentAuthority(result.authority, { ...current, now: new Date(window.expiresAt) })).toEqual({
      current: false, code: 'authorization-expired',
    })
  })

  it('binds checkpoint and resume scope to the exact household, learner, and learner session', () => {
    const result = authorizeGuardianStudy(guardianEvidence(), NOW)
    if (result.status !== 'authorized') throw new Error('expected authorization')
    expect(isScopeAuthorized(result.authority, {
      householdId: IDS.household, studentId: IDS.student, learnerSessionId: IDS.learnerSession,
    })).toBe(true)
    expect(isScopeAuthorized(result.authority, {
      householdId: IDS.otherHousehold, studentId: IDS.student, learnerSessionId: IDS.learnerSession,
    })).toBe(false)
    expect(isScopeAuthorized(result.authority, {
      householdId: IDS.household, studentId: IDS.otherStudent, learnerSessionId: IDS.learnerSession,
    })).toBe(false)
  })
})

describe('student-session, staff, and notification authority', () => {
  const studentEvidence = (overrides: Partial<ServerStudentSessionAuthorizationEvidence> = {}): ServerStudentSessionAuthorizationEvidence => ({
    authoritySource: 'verified-server',
    evidenceRef: 'authorization-evidence:student-78f19a887c2d',
    householdId: IDS.household,
    studentId: IDS.student,
    learnerSessionId: IDS.learnerSession,
    studentSessionGrantId: IDS.grant,
    householdStatus: 'active',
    learnerStatus: 'active',
    grantStatus: 'active',
    sessionVersion: 8,
    currentSessionVersion: 8,
    capabilities: ['student:assignments:read', 'student:attempts:create'],
    issuerAvailable: true,
    issuerVersion: 'academy-student-session-issuer.v1',
    window,
    ...overrides,
  })

  it('keeps direct student production not-ready without a trusted issuer', () => {
    expect(authorizeStudentSessionStudy(
      studentEvidence({ issuerAvailable: false, issuerVersion: null }),
      'student:assignments:read',
      NOW,
    )).toEqual({ status: 'not-ready', code: 'student-session-issuer-unavailable' })
  })

  it('requires a current, unrevoked, capable, unexpired student grant', () => {
    expect(authorizeStudentSessionStudy(studentEvidence(), 'student:attempts:create', NOW).status).toBe('authorized')
    expect(authorizeStudentSessionStudy(studentEvidence({ grantStatus: 'revoked' }), 'student:attempts:create', NOW)).toEqual({
      status: 'denied', code: 'student-session-revoked',
    })
    expect(authorizeStudentSessionStudy(studentEvidence({ currentSessionVersion: 9 }), 'student:attempts:create', NOW)).toEqual({
      status: 'denied', code: 'student-session-invalid',
    })
    expect(authorizeStudentSessionStudy(studentEvidence(), 'student:progress:read', NOW)).toEqual({
      status: 'denied', code: 'learner-permission-required',
    })
  })

  it('keeps staff disabled without an approved server model and required audit evidence', async () => {
    const evidence: ServerStaffAuthorizationEvidence = {
      authoritySource: 'verified-server',
      evidenceRef: 'authorization-evidence:staff-279d8c419ae7',
      authenticatedUserId: IDS.user,
      householdId: IDS.household,
      studentId: IDS.student,
      learnerSessionId: IDS.learnerSession,
      staffMembershipId: IDS.staff,
      staffStatus: 'active',
      householdStatus: 'active',
      learnerStatus: 'active',
      permissions: ['study:read'],
      approvedModelVersion: null,
      auditEvidenceRef: null,
      window,
    }
    expect(authorizeStaffStudy(evidence, 'study:read', NOW)).toEqual({
      status: 'not-ready', code: 'staff-authorization-disabled',
    })
    expect(authorizeStaffStudy({
      ...evidence,
      approvedModelVersion: 'academy-staff-study.v1',
      auditEvidenceRef: 'authorization-evidence:audit-4c4e9d743b98',
    }, 'study:manage', NOW)).toEqual({ status: 'denied', code: 'staff-permission-required' })
  })

  it('authorizes notification using active server-derived stable references, never contact addresses', () => {
    const evidence: ServerAdultNotificationEvidence = {
      authoritySource: 'verified-server',
      evidenceRef: 'authorization-evidence:recipient-b8d28a30dd9f',
      householdId: IDS.household,
      studentId: IDS.student,
      recipientRef: 'recipient-ref:3e7370cb4b7c4ab28ca4',
      routeRef: 'route-ref:e1b039ae8c674f2190b9',
      notificationPermissionId: IDS.permission,
      membershipId: IDS.membership,
      relationshipId: IDS.relationship,
      membershipStatus: 'active',
      relationshipStatus: 'active',
      permissionStatus: 'active',
      memberRole: 'guardian',
      channel: 'email',
      authorizationRevision: 7,
      expiresAt: '2026-08-01T16:05:00.000Z',
    }
    const result = authorizeAdultNotification(evidence, NOW)
    expect(result.status).toBe('authorized')
    expect(JSON.stringify(result)).not.toContain('@')
    expect(authorizeAdultNotification({ ...evidence, permissionStatus: 'revoked' }, NOW)).toEqual({
      status: 'denied', code: 'adult-notification-permission-required',
    })
    expect(authorizeAdultNotification({ ...evidence, relationshipStatus: 'revoked' }, NOW)).toEqual({
      status: 'denied', code: 'relationship-not-active',
    })
    expect(authorizeAdultNotification({ ...evidence, email: 'forged@example.invalid' } as ServerAdultNotificationEvidence, NOW)).toEqual({
      status: 'denied', code: 'recipient-not-authorized',
    })
  })
})
