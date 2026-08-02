const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const CHANNELS = new Set(['email', 'in-app', 'sms'])
const OPAQUE_REF = Object.freeze({
  householdRef: /^household:[0-9a-f]{64}$/,
  learnerRef: /^learner:[0-9a-f]{64}$/,
  recipientRef: /^recipient:[0-9a-f]{64}$/,
  permissionRef: /^permission:[0-9a-f]{64}$/,
  routeRef: /^route:[0-9a-f]{64}$/,
})
const TEST_RESOLUTIONS = new WeakSet()

function validRef(value) {
  return typeof value === 'string' && REF.test(value)
}

function exactKeys(value, expected) {
  const keys = Object.keys(value)
  return keys.length === expected.length && keys.every((key) => expected.includes(key))
}

function positiveRevision(value) {
  return Number.isSafeInteger(value) && value > 0
}

function validStableRecipientReference(value) {
  return Boolean(
    value && typeof value === 'object' && !Array.isArray(value) &&
    exactKeys(value, [
      'schemaVersion', 'recipientRef', 'permissionRef', 'permissionRevision',
      'recipientVersion', 'effectiveAt', 'route', 'routeRef', 'routeRevision',
    ]) &&
    value.schemaVersion === 2 &&
    value.recipientVersion === 2 &&
    OPAQUE_REF.recipientRef.test(value.recipientRef) &&
    OPAQUE_REF.permissionRef.test(value.permissionRef) &&
    positiveRevision(value.permissionRevision) &&
    typeof value.effectiveAt === 'string' && Number.isFinite(Date.parse(value.effectiveAt)) &&
    CHANNELS.has(value.route) &&
    OPAQUE_REF.routeRef.test(value.routeRef) &&
    positiveRevision(value.routeRevision),
  )
}

function validExpectedBinding(expected) {
  return Boolean(
    expected && typeof expected === 'object' && !Array.isArray(expected) &&
    exactKeys(expected, ['householdRef', 'learnerRef', 'proposalRef', 'proposalRevision']) &&
    OPAQUE_REF.householdRef.test(expected.householdRef) &&
    OPAQUE_REF.learnerRef.test(expected.learnerRef) &&
    validRef(expected.proposalRef) &&
    positiveRevision(expected.proposalRevision),
  )
}

function validLiveResolution(value, expected) {
  if (
    !value || value.state !== 'resolved' ||
    !exactKeys(value, [
      'householdRef', 'learnerRef', 'proposalRef', 'proposalRevision', 'state',
      'resolutionRef', 'policyVersion', 'recipients',
    ]) ||
    !OPAQUE_REF.householdRef.test(value.householdRef) ||
    !OPAQUE_REF.learnerRef.test(value.learnerRef) ||
    !validRef(value.proposalRef) ||
    !positiveRevision(value.proposalRevision) ||
    !/^resolution:[0-9a-f]{64}$/.test(value.resolutionRef) ||
    !validRef(value.policyVersion) ||
    !Array.isArray(value.recipients) ||
    value.recipients.length < 1 || value.recipients.length > 32
  ) return false
  if (expected !== undefined) {
    if (!validExpectedBinding(expected)) return false
    if (
      value.householdRef !== expected.householdRef ||
      value.learnerRef !== expected.learnerRef ||
      value.proposalRef !== expected.proposalRef ||
      value.proposalRevision !== expected.proposalRevision
    ) return false
  }
  const routeTuples = new Set()
  for (const recipient of value.recipients) {
    if (!validStableRecipientReference(recipient)) return false
    const tuple = `${value.proposalRef}\u001f${recipient.recipientRef}\u001f${recipient.routeRef}`
    if (routeTuples.has(tuple)) return false
    routeTuples.add(tuple)
  }
  return true
}

function validTestRecipientResolution(value) {
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

/**
 * Validates the exact server-derived v2 envelope. Supplying `expected` binds
 * the response to the server-owned proposal claim and rejects stale/replayed
 * responses. The legacy grouped shape is accepted only for objects minted by
 * createTestRecipientResolver and cannot cross a JSON/RPC boundary.
 */
export function validRecipientResolution(value, expected) {
  return TEST_RESOLUTIONS.has(value)
    ? expected === undefined && validTestRecipientResolution(value)
    : validLiveResolution(value, expected)
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
  if (!validTestRecipientResolution(resolution)) throw new TypeError('invalid_test_recipients')
  return Object.freeze({
    isDurable: false,
    isReady: () => true,
    async resolve({ proposalRef }) {
      if (proposalRef !== boundProposalRef) {
        return { state: 'indeterminate', reasonCode: 'invalid-proposal-ref' }
      }
      const testResolution = structuredClone(resolution)
      TEST_RESOLUTIONS.add(testResolution)
      return testResolution
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
