import { describe, expect, it } from 'vitest'
import {
  authorizeRecipient,
  authorizeRecipientBatch,
  type RecipientAuthorizationBinding,
  type ServerRecipientAuthorizationSnapshot,
} from './authorization'

const binding: RecipientAuthorizationBinding = {
  householdRef: `household:${'1'.repeat(64)}`,
  learnerRef: `learner:${'2'.repeat(64)}`,
  proposalRef: `proposal:${'3'.repeat(64)}`,
  proposalRevision: 7,
  proposalState: 'accepted',
  recipientRef: `recipient:${'4'.repeat(64)}`,
  permissionRef: `permission:${'5'.repeat(64)}`,
  permissionRevision: 3,
  route: 'in-app',
  routeRef: `route:${'6'.repeat(64)}`,
  routeRevision: 2,
}

const snapshot: ServerRecipientAuthorizationSnapshot = {
  evidenceSource: 'server-live',
  observedAt: '2026-08-01T13:00:00.000Z',
  householdRef: binding.householdRef,
  learnerRef: binding.learnerRef,
  proposalRef: binding.proposalRef,
  proposalRevision: binding.proposalRevision,
  proposalState: 'accepted',
  membership: {
    householdRef: binding.householdRef,
    status: 'active',
    role: 'guardian',
  },
  relationship: {
    householdRef: binding.householdRef,
    learnerRef: binding.learnerRef,
    status: 'active',
  },
  permission: {
    householdRef: binding.householdRef,
    learnerRef: binding.learnerRef,
    recipientRef: binding.recipientRef,
    permissionRef: binding.permissionRef,
    revision: binding.permissionRevision,
    status: 'active',
    effectiveAt: '2026-08-01T12:00:00.000Z',
    expiresAt: '2026-08-02T12:00:00.000Z',
    revokedAt: null,
    allowedRoutes: ['in-app'],
  },
  route: {
    householdRef: binding.householdRef,
    learnerRef: binding.learnerRef,
    recipientRef: binding.recipientRef,
    permissionRef: binding.permissionRef,
    routeRef: binding.routeRef,
    revision: binding.routeRevision,
    channel: binding.route,
    status: 'active',
    revokedAt: null,
  },
  reference: {
    schemaVersion: 2,
    recipientRef: binding.recipientRef,
    permissionRef: binding.permissionRef,
    permissionRevision: binding.permissionRevision,
    recipientVersion: 2,
    effectiveAt: '2026-08-01T12:00:00.000Z',
    route: binding.route,
    routeRef: binding.routeRef,
    routeRevision: binding.routeRevision,
  },
}

describe('live recipient reauthorization', () => {
  it('authorizes only an exact server-derived current binding', () => {
    expect(authorizeRecipient(binding, snapshot)).toEqual({
      authorized: true,
      reference: snapshot.reference,
    })
    expect(authorizeRecipient(binding, {
      ...snapshot,
      evidenceSource: 'caller-authored' as 'server-live',
    })).toEqual({
      authorized: false,
      reasonCode: 'recipient-evidence-not-server-derived',
    })
    expect(authorizeRecipient(binding, {
      ...snapshot,
      membership: { ...snapshot.membership, status: 'revoked' },
    })).toEqual({ authorized: false, reasonCode: 'membership-inactive' })
    expect(authorizeRecipient(binding, {
      ...snapshot,
      relationship: { ...snapshot.relationship, status: 'revoked' },
    })).toEqual({ authorized: false, reasonCode: 'guardian-relationship-inactive' })
    expect(authorizeRecipient(binding, {
      ...snapshot,
      membership: { ...snapshot.membership, role: 'other' },
    })).toEqual({ authorized: false, reasonCode: 'guardian-role-required' })
  })

  it('rejects a revoked guardian and a recreated permission revision', () => {
    expect(authorizeRecipient(binding, {
      ...snapshot,
      permission: { ...snapshot.permission, status: 'revoked', revokedAt: snapshot.observedAt },
    })).toEqual({ authorized: false, reasonCode: 'notification-permission-revoked' })

    expect(authorizeRecipient(binding, {
      ...snapshot,
      permission: { ...snapshot.permission, revision: binding.permissionRevision + 1 },
      reference: {
        ...snapshot.reference,
        permissionRevision: binding.permissionRevision + 1,
      },
    })).toEqual({
      authorized: false,
      reasonCode: 'notification-permission-revision-stale',
    })
    expect(authorizeRecipient(binding, {
      ...snapshot,
      permission: { ...snapshot.permission, effectiveAt: '2026-08-01T14:00:00.000Z' },
    })).toEqual({ authorized: false, reasonCode: 'notification-permission-not-effective' })
    expect(authorizeRecipient(binding, {
      ...snapshot,
      permission: { ...snapshot.permission, expiresAt: snapshot.observedAt },
    })).toEqual({ authorized: false, reasonCode: 'notification-permission-not-effective' })
    expect(authorizeRecipient(binding, {
      ...snapshot,
      permission: { ...snapshot.permission, expiresAt: null },
    })).toEqual({ authorized: true, reference: snapshot.reference })
    expect(authorizeRecipient(binding, {
      ...snapshot,
      permission: { ...snapshot.permission, allowedRoutes: ['email'] },
    })).toEqual({ authorized: false, reasonCode: 'notification-route-not-allowed' })
  })

  it('rejects proposal replay and stale route evidence', () => {
    expect(authorizeRecipient(binding, {
      ...snapshot,
      proposalRevision: binding.proposalRevision + 1,
    })).toEqual({ authorized: false, reasonCode: 'proposal-revision-stale' })
    expect(authorizeRecipient(binding, {
      ...snapshot,
      proposalState: 'cancelled',
    })).toEqual({ authorized: false, reasonCode: 'proposal-state-invalid' })
    expect(authorizeRecipient(binding, {
      ...snapshot,
      route: { ...snapshot.route, revision: binding.routeRevision + 1 },
    })).toEqual({ authorized: false, reasonCode: 'notification-route-revision-stale' })
  })

  it('allows two guardians on the same channel and rejects the exact duplicate route', () => {
    const secondBinding: RecipientAuthorizationBinding = {
      ...binding,
      recipientRef: `recipient:${'7'.repeat(64)}`,
      permissionRef: `permission:${'8'.repeat(64)}`,
      routeRef: `route:${'9'.repeat(64)}`,
    }
    const secondSnapshot: ServerRecipientAuthorizationSnapshot = {
      ...snapshot,
      permission: {
        ...snapshot.permission,
        recipientRef: secondBinding.recipientRef,
        permissionRef: secondBinding.permissionRef,
      },
      route: {
        ...snapshot.route,
        recipientRef: secondBinding.recipientRef,
        permissionRef: secondBinding.permissionRef,
        routeRef: secondBinding.routeRef,
      },
      reference: {
        ...snapshot.reference,
        recipientRef: secondBinding.recipientRef,
        permissionRef: secondBinding.permissionRef,
        routeRef: secondBinding.routeRef,
      },
    }
    expect(authorizeRecipientBatch([
      { binding, snapshot },
      { binding: secondBinding, snapshot: secondSnapshot },
    ])).toEqual({
      authorized: true,
      references: [snapshot.reference, secondSnapshot.reference],
    })
    expect(authorizeRecipientBatch([
      { binding, snapshot },
      { binding, snapshot },
    ])).toEqual({ authorized: false, reasonCode: 'recipient-route-duplicate' })
  })
})
