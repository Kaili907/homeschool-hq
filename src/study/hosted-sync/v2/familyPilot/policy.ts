import { isFamilyCloudBrowserEnabledFromHost } from '../../../family-pilot/cloud-auth/browserConfiguration'

/** The configuration import is pure and cannot construct a client or make a call. */
export const FAMILY_HOSTED_SYNC_CONVERGENCE_R1 = Object.freeze({
  enabled: isFamilyCloudBrowserEnabledFromHost(),
  localFirst: true as const,
  plannerPersistence: 'LOCAL_AND_HOSTED_CHECKPOINT' as const,
  hostedContract: 'hosted-study-sync-state.r2.v1' as const,
})
