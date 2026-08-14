/**
 * R2 convergence is deliberately non-activatable. The parallel production
 * privacy-gate work is not an input to this isolated branch, so no runtime
 * configuration can turn hosted Study sync on here.
 */
export const HOSTED_SYNC_PRODUCTION_ACTIVATION = Object.freeze({
  enabled: false as const,
  reason: 'PRODUCTION_PRIVACY_SERIALIZER_REQUIRED' as const,
})

export function requireHostedSyncProductionPrivacySerializer(): never {
  throw new Error(HOSTED_SYNC_PRODUCTION_ACTIVATION.reason)
}
