import { describe, expect, it } from 'vitest'
import { authorizeRecipient, type RecipientAuthorizationEvidence } from './authorization'

const allowed: RecipientAuthorizationEvidence = {
  householdMatches: true,
  learnerMatches: true,
  membershipActive: true,
  guardianRole: true,
  relationshipActive: true,
  permissionExplicit: true,
  permissionEffective: true,
  permissionRevoked: false,
  routeAllowed: true,
  reference: {
    schemaVersion: 2,
    recipientRef: `recipient:${'b'.repeat(64)}`,
    permissionRef: `permission:${'a'.repeat(64)}`,
    permissionRevision: 3,
    recipientVersion: 2,
    effectiveAt: '2026-08-01T12:00:00.000Z',
    route: 'in-app',
    routeRef: 'route:synthetic-in-app',
    routeRevision: 2,
  },
}

describe('recipient authorization', () => {
  it('requires every explicit authorization condition', () => {
    expect(authorizeRecipient(allowed)).toEqual({ authorized: true, reference: allowed.reference })
    expect(authorizeRecipient({ ...allowed, guardianRole: false })).toEqual({
      authorized: false, reasonCode: 'guardian-role-required',
    })
    expect(authorizeRecipient({ ...allowed, permissionExplicit: false })).toEqual({
      authorized: false, reasonCode: 'notification-permission-missing',
    })
    expect(authorizeRecipient({ ...allowed, permissionRevoked: true })).toEqual({
      authorized: false, reasonCode: 'notification-permission-revoked',
    })
  })

  it('rejects contact-shaped recipient references', () => {
    expect(authorizeRecipient({
      ...allowed,
      reference: { ...allowed.reference, recipientRef: 'synthetic@example.test' },
    })).toEqual({ authorized: false, reasonCode: 'recipient-reference-invalid' })
  })
})
