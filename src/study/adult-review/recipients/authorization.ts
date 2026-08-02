import {
  isStableRecipientReferenceV2,
  type DeliveryRoute,
  type StableRecipientReferenceV2,
} from '../../contracts/recipients'

export type RecipientProposalState = 'proposed' | 'accepted'

/**
 * The binding already held by the server-owned proposal/job. Values in this
 * object are never copied from a recipient-resolution request body.
 */
export interface RecipientAuthorizationBinding {
  readonly householdRef: string
  readonly learnerRef: string
  readonly proposalRef: string
  readonly proposalRevision: number
  readonly proposalState: RecipientProposalState
  readonly recipientRef: string
  readonly permissionRef: string
  readonly permissionRevision: number
  readonly route: DeliveryRoute
  readonly routeRef: string
  readonly routeRevision: number
}

/** A live, server-loaded snapshot of every row that grants delivery access. */
export interface ServerRecipientAuthorizationSnapshot {
  readonly evidenceSource: 'server-live'
  readonly observedAt: string
  readonly householdRef: string
  readonly learnerRef: string
  readonly proposalRef: string
  readonly proposalRevision: number
  readonly proposalState: 'proposed' | 'accepted' | 'cancelled' | 'expired' | 'rejected'
  readonly membership: Readonly<{
    householdRef: string
    status: 'active' | 'invited' | 'revoked'
    role: 'guardian' | 'other'
  }>
  readonly relationship: Readonly<{
    householdRef: string
    learnerRef: string
    status: 'active' | 'revoked'
  }>
  readonly permission: Readonly<{
    householdRef: string
    learnerRef: string
    recipientRef: string
    permissionRef: string
    revision: number
    status: 'active' | 'revoked'
    effectiveAt: string
    expiresAt: string | null
    revokedAt: string | null
    allowedRoutes: readonly DeliveryRoute[]
  }>
  readonly route: Readonly<{
    householdRef: string
    learnerRef: string
    recipientRef: string
    permissionRef: string
    routeRef: string
    revision: number
    channel: DeliveryRoute
    status: 'active' | 'revoked'
    revokedAt: string | null
  }>
  readonly reference: StableRecipientReferenceV2
}

export type RecipientAuthorizationDecision =
  | Readonly<{ authorized: true; reference: StableRecipientReferenceV2 }>
  | Readonly<{ authorized: false; reasonCode: string }>

function validRevision(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

function validTime(value: string): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function objectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

/**
 * Compares a server-owned binding with a freshly loaded authorization graph.
 * The returned reference is always the live server value, never caller input.
 */
export function authorizeRecipient(
  binding: RecipientAuthorizationBinding,
  snapshot: ServerRecipientAuthorizationSnapshot,
): RecipientAuthorizationDecision {
  if (
    !objectRecord(binding) || !objectRecord(snapshot) ||
    !objectRecord(snapshot.membership) || !objectRecord(snapshot.relationship) ||
    !objectRecord(snapshot.permission) || !objectRecord(snapshot.route) ||
    !Array.isArray(snapshot.permission.allowedRoutes)
  ) {
    return { authorized: false, reasonCode: 'recipient-evidence-invalid' }
  }
  if (snapshot.evidenceSource !== 'server-live') {
    return { authorized: false, reasonCode: 'recipient-evidence-not-server-derived' }
  }
  if (!validTime(snapshot.observedAt)) {
    return { authorized: false, reasonCode: 'recipient-evidence-time-invalid' }
  }
  if (!validRevision(binding.proposalRevision) || !validRevision(snapshot.proposalRevision)) {
    return { authorized: false, reasonCode: 'proposal-revision-invalid' }
  }
  if (snapshot.householdRef !== binding.householdRef) {
    return { authorized: false, reasonCode: 'household-mismatch' }
  }
  if (snapshot.learnerRef !== binding.learnerRef) {
    return { authorized: false, reasonCode: 'learner-mismatch' }
  }
  if (snapshot.proposalRef !== binding.proposalRef) {
    return { authorized: false, reasonCode: 'proposal-mismatch' }
  }
  if (snapshot.proposalRevision !== binding.proposalRevision) {
    return { authorized: false, reasonCode: 'proposal-revision-stale' }
  }
  if (snapshot.proposalState !== binding.proposalState) {
    return { authorized: false, reasonCode: 'proposal-state-invalid' }
  }
  if (snapshot.membership.householdRef !== binding.householdRef) {
    return { authorized: false, reasonCode: 'membership-household-mismatch' }
  }
  if (snapshot.membership.status !== 'active') {
    return { authorized: false, reasonCode: 'membership-inactive' }
  }
  if (snapshot.membership.role !== 'guardian') {
    return { authorized: false, reasonCode: 'guardian-role-required' }
  }
  if (
    snapshot.relationship.householdRef !== binding.householdRef ||
    snapshot.relationship.learnerRef !== binding.learnerRef
  ) {
    return { authorized: false, reasonCode: 'guardian-relationship-mismatch' }
  }
  if (snapshot.relationship.status !== 'active') {
    return { authorized: false, reasonCode: 'guardian-relationship-inactive' }
  }
  if (
    snapshot.permission.householdRef !== binding.householdRef ||
    snapshot.permission.learnerRef !== binding.learnerRef ||
    snapshot.permission.recipientRef !== binding.recipientRef ||
    snapshot.permission.permissionRef !== binding.permissionRef
  ) {
    return { authorized: false, reasonCode: 'notification-permission-binding-mismatch' }
  }
  if (snapshot.permission.revision !== binding.permissionRevision) {
    return { authorized: false, reasonCode: 'notification-permission-revision-stale' }
  }
  if (snapshot.permission.status !== 'active' || snapshot.permission.revokedAt !== null) {
    return { authorized: false, reasonCode: 'notification-permission-revoked' }
  }
  const observedAt = Date.parse(snapshot.observedAt)
  const effectiveAt = Date.parse(snapshot.permission.effectiveAt)
  const expiresAt = snapshot.permission.expiresAt === null
    ? null
    : Date.parse(snapshot.permission.expiresAt)
  if (
    !Number.isFinite(effectiveAt) || effectiveAt > observedAt ||
    (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= observedAt))
  ) {
    return { authorized: false, reasonCode: 'notification-permission-not-effective' }
  }
  if (!snapshot.permission.allowedRoutes.includes(binding.route)) {
    return { authorized: false, reasonCode: 'notification-route-not-allowed' }
  }
  if (
    snapshot.route.householdRef !== binding.householdRef ||
    snapshot.route.learnerRef !== binding.learnerRef ||
    snapshot.route.recipientRef !== binding.recipientRef ||
    snapshot.route.permissionRef !== binding.permissionRef ||
    snapshot.route.routeRef !== binding.routeRef ||
    snapshot.route.channel !== binding.route
  ) {
    return { authorized: false, reasonCode: 'notification-route-binding-mismatch' }
  }
  if (snapshot.route.revision !== binding.routeRevision) {
    return { authorized: false, reasonCode: 'notification-route-revision-stale' }
  }
  if (snapshot.route.status !== 'active' || snapshot.route.revokedAt !== null) {
    return { authorized: false, reasonCode: 'notification-route-revoked' }
  }
  if (!isStableRecipientReferenceV2(snapshot.reference)) {
    return { authorized: false, reasonCode: 'recipient-reference-invalid' }
  }
  if (
    snapshot.reference.recipientRef !== binding.recipientRef ||
    snapshot.reference.permissionRef !== binding.permissionRef ||
    snapshot.reference.permissionRevision !== binding.permissionRevision ||
    snapshot.reference.effectiveAt !== snapshot.permission.effectiveAt ||
    snapshot.reference.route !== binding.route ||
    snapshot.reference.routeRef !== binding.routeRef ||
    snapshot.reference.routeRevision !== binding.routeRevision
  ) {
    return { authorized: false, reasonCode: 'recipient-reference-stale' }
  }
  return { authorized: true, reference: snapshot.reference }
}

/**
 * Enforces delivery-job cardinality. The same channel may be used for multiple
 * guardians; only the exact proposal/recipient/route tuple is a duplicate.
 */
export function authorizeRecipientBatch(
  entries: readonly Readonly<{
    binding: RecipientAuthorizationBinding
    snapshot: ServerRecipientAuthorizationSnapshot
  }>[],
):
  | Readonly<{ authorized: true; references: readonly StableRecipientReferenceV2[] }>
  | Readonly<{ authorized: false; reasonCode: string }> {
  const seen = new Set<string>()
  const references: StableRecipientReferenceV2[] = []
  for (const entry of entries) {
    const tuple = [
      entry.binding.proposalRef,
      entry.binding.recipientRef,
      entry.binding.routeRef,
    ].join('\u001f')
    if (seen.has(tuple)) {
      return { authorized: false, reasonCode: 'recipient-route-duplicate' }
    }
    seen.add(tuple)
    const decision = authorizeRecipient(entry.binding, entry.snapshot)
    if (!decision.authorized) return decision
    references.push(decision.reference)
  }
  return { authorized: true, references }
}
