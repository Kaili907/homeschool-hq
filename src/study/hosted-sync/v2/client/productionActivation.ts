import { isFamilyCloudBrowserEnabledFromHost } from '../../../family-pilot/cloud-auth/browserConfiguration'

export const HOSTED_SYNC_PRODUCTION_ACTIVATION = Object.freeze({
  enabled: isFamilyCloudBrowserEnabledFromHost(),
  reason: isFamilyCloudBrowserEnabledFromHost()
    ? 'HOSTED_SYNC_R2_EXPLICITLY_CONFIGURED' as const
    : 'HOSTED_SYNC_R2_DEFAULT_OFF' as const,
})

export function requireHostedSyncProductionPrivacySerializer(): true {
  return true
}
