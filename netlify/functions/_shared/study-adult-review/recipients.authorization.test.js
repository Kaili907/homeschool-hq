import { describe, expect, it } from 'vitest'
import { validRecipientResolution } from './recipients.js'

const binding = Object.freeze({
  householdRef: `household:${'1'.repeat(64)}`,
  learnerRef: `learner:${'2'.repeat(64)}`,
  proposalRef: `proposal:${'3'.repeat(64)}`,
  proposalRevision: 4,
})

function recipient(seed, routeSeed = seed) {
  return {
    schemaVersion: 2,
    recipientRef: `recipient:${seed.repeat(64)}`,
    permissionRef: `permission:${seed.repeat(64)}`,
    permissionRevision: 3,
    recipientVersion: 2,
    effectiveAt: '2026-08-01T12:00:00.000Z',
    route: 'in-app',
    routeRef: `route:${routeSeed.repeat(64)}`,
    routeRevision: 2,
  }
}

function resolution(recipients = [recipient('4')]) {
  return {
    ...binding,
    state: 'resolved',
    resolutionRef: `resolution:${'5'.repeat(64)}`,
    policyVersion: 'adult-notification-policy-v2',
    recipients,
  }
}

describe('server-bound recipient resolution', () => {
  it('accepts only the exact household, learner, proposal, and current revision', () => {
    expect(validRecipientResolution(resolution(), binding)).toBe(true)
    expect(validRecipientResolution(resolution(), {
      ...binding,
      householdRef: `household:${'9'.repeat(64)}`,
    })).toBe(false)
    expect(validRecipientResolution(resolution(), {
      ...binding,
      proposalRevision: binding.proposalRevision - 1,
    })).toBe(false)
    expect(validRecipientResolution({
      ...resolution(),
      callerAuthorizationEvidence: true,
    }, binding)).toBe(false)
  })

  it('allows two guardians on one channel and rejects a duplicate guardian route', () => {
    const first = recipient('4')
    const second = recipient('6')
    expect(validRecipientResolution(resolution([first, second]), binding)).toBe(true)
    expect(validRecipientResolution(resolution([first, { ...first }]), binding)).toBe(false)
  })

  it('rejects stale, contact-shaped, and caller-expanded recipient evidence', () => {
    const first = recipient('4')
    expect(validRecipientResolution(resolution([{
      ...first,
      permissionRevision: 0,
    }]), binding)).toBe(false)
    expect(validRecipientResolution(resolution([{
      ...first,
      recipientRef: 'guardian@example.test',
    }]), binding)).toBe(false)
    expect(validRecipientResolution(resolution([{
      ...first,
      destination: 'guardian@example.test',
    }]), binding)).toBe(false)
  })
})
