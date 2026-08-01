const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const CHANNELS = new Set(['email', 'in-app', 'sms'])

function validRef(value) {
  return typeof value === 'string' && REF.test(value)
}

export function validRecipientResolution(value) {
  if (
    !value || value.state !== 'resolved' ||
    !/^resolution:[A-Za-z0-9._/-]{1,96}$/.test(value.resolutionRef) ||
    !/^policy:[A-Za-z0-9._/-]{1,96}$/.test(value.policyVersion)
  ) return false
  if (Object.keys(value).length !== 4 || Object.keys(value).some((key) => !['state', 'resolutionRef', 'policyVersion', 'recipients'].includes(key))) return false
  if (!Array.isArray(value.recipients) || value.recipients.length < 1 || value.recipients.length > 32) return false
  const recipientRefs = new Set()
  const routeRefs = new Set()
  for (const recipient of value.recipients) {
    if (
      !recipient ||
      Object.keys(recipient).length !== 6 ||
      Object.keys(recipient).some((key) => ![
        'recipientRef', 'membershipRef', 'learnerRelationshipRef', 'notificationPermissionRef', 'relationship', 'routes',
      ].includes(key)) ||
      recipient.relationship !== 'guardian' ||
      !/^recipient:[A-Za-z0-9._/-]{1,96}$/.test(recipient.recipientRef) ||
      !/^membership:[A-Za-z0-9._/-]{1,96}$/.test(recipient.membershipRef) ||
      !/^relationship:[A-Za-z0-9._/-]{1,96}$/.test(recipient.learnerRelationshipRef) ||
      !/^notification-permission:[A-Za-z0-9._/-]{1,96}$/.test(recipient.notificationPermissionRef) ||
      !Array.isArray(recipient.routes) ||
      recipient.routes.length < 1 ||
      recipient.routes.length > 3 ||
      ['email', 'phone', 'address', 'destination'].some((key) => key in recipient)
    ) return false
    if (recipientRefs.has(recipient.recipientRef)) return false
    recipientRefs.add(recipient.recipientRef)
    for (const route of recipient.routes) {
      if (
        !route ||
        Object.keys(route).length !== 2 ||
        Object.keys(route).some((key) => !['channel', 'routeRef'].includes(key)) ||
        !CHANNELS.has(route.channel) ||
        !/^(?:email|in-app|sms)-route:[A-Za-z0-9._/-]{1,96}$/.test(route.routeRef) ||
        routeRefs.has(route.routeRef)
      ) return false
      routeRefs.add(route.routeRef)
    }
  }
  return true
}

/** Test-only resolver containing opaque refs and explicit permission evidence. */
export function createTestRecipientResolver({ proposalRef: boundProposalRef, recipients, revokedRouteRefs = new Set() }) {
  if (!validRef(boundProposalRef)) throw new TypeError('invalid_test_proposal_ref')
  const resolution = {
    state: 'resolved',
    resolutionRef: 'resolution:test-v1',
    policyVersion: 'policy:adult-notification-v1',
    recipients: recipients.map((recipient) => ({
      recipientRef: recipient.recipientRef,
      membershipRef: recipient.membershipRef,
      learnerRelationshipRef: recipient.learnerRelationshipRef,
      notificationPermissionRef: recipient.notificationPermissionRef,
      relationship: recipient.relationship,
      routes: recipient.routes.map((route) => ({ channel: route.channel, routeRef: route.routeRef })),
    })),
  }
  if (!validRecipientResolution(resolution)) throw new TypeError('invalid_test_recipients')
  return Object.freeze({
    isDurable: false,
    isReady: () => true,
    async resolve({ proposalRef }) {
      return proposalRef === boundProposalRef
        ? structuredClone(resolution)
        : { state: 'indeterminate', reasonCode: 'invalid-proposal-ref' }
    },
    async reauthorizeForDelivery(input) {
      const { recipientRef, routeRef } = input
      const exists = input.proposalRef === boundProposalRef && resolution.recipients.some(
        (recipient) => recipient.recipientRef === recipientRef && recipient.routes.some((route) => route.routeRef === routeRef),
      )
      if (!exists || revokedRouteRefs.has(routeRef)) return { state: 'revoked', reasonCode: 'recipient-route-revoked' }
      const channel = resolution.recipients.flatMap((recipient) => recipient.routes).find((route) => route.routeRef === routeRef)?.channel
      return { state: 'authorized', authorizationEvidenceRef: `authorization-evidence:test-${recipientRef.slice(-12)}-${routeRef.slice(-12)}`, channel }
    },
  })
}
