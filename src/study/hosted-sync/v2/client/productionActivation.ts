/**
 * R2 remains deliberately inactive. The production serializer is now present,
 * but this module exposes no network client, environment switch, or App wiring.
 */
export const HOSTED_SYNC_PRODUCTION_ACTIVATION = Object.freeze({
  enabled: false as const,
  reason: 'HOSTED_SYNC_R2_INACTIVE_PENDING_STAGING' as const,
})

export function requireHostedSyncProductionPrivacySerializer(): true {
  return true
}
