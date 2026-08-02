import {
  isStableRecipientReferenceV2,
  type StableRecipientReferenceV2,
} from '../../contracts/recipients'

export interface RecipientAuthorizationEvidence {
  readonly householdMatches: boolean
  readonly learnerMatches: boolean
  readonly membershipActive: boolean
  readonly guardianRole: boolean
  readonly relationshipActive: boolean
  readonly permissionExplicit: boolean
  readonly permissionEffective: boolean
  readonly permissionRevoked: boolean
  readonly routeAllowed: boolean
  readonly reference: StableRecipientReferenceV2
}

export type RecipientAuthorizationDecision =
  | Readonly<{ authorized: true; reference: StableRecipientReferenceV2 }>
  | Readonly<{ authorized: false; reasonCode: string }>

export function authorizeRecipient(
  evidence: RecipientAuthorizationEvidence,
): RecipientAuthorizationDecision {
  if (!isStableRecipientReferenceV2(evidence.reference)) {
    return { authorized: false, reasonCode: 'recipient-reference-invalid' }
  }
  const checks: readonly (readonly [boolean, string])[] = [
    [evidence.householdMatches, 'household-mismatch'],
    [evidence.learnerMatches, 'learner-mismatch'],
    [evidence.membershipActive, 'membership-inactive'],
    [evidence.guardianRole, 'guardian-role-required'],
    [evidence.relationshipActive, 'guardian-relationship-inactive'],
    [evidence.permissionExplicit, 'notification-permission-missing'],
    [evidence.permissionEffective, 'notification-permission-stale'],
    [!evidence.permissionRevoked, 'notification-permission-revoked'],
    [evidence.routeAllowed, 'notification-route-not-allowed'],
  ]
  const failed = checks.find(([allowed]) => !allowed)
  return failed
    ? { authorized: false, reasonCode: failed[1] }
    : { authorized: true, reference: evidence.reference }
}
