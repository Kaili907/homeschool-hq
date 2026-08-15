import type { LearnerResponseAssessor } from '../final-app/learner-response'
import type { FamilyPilotTrustedScorerEnvironment } from '../trusted-scorer'
import { resolveFamilyPilotTrustedScorer } from '../trusted-scorer'
import type { HostedSyncRpcAdapter } from '../../hosted-sync/v2/client'
import type { ParentSyncStatusR1 } from '../../hosted-sync/v2/familyPilot/status'

export const FAMILY_SERVICES_FEATURE_FLAGS = Object.freeze({
  hostedSync: 'VITE_FAMILY_PILOT_HOSTED_SYNC_ENABLED',
  trustedScorer: 'VITE_FAMILY_PILOT_TRUSTED_SCORER_ENABLED',
} as const)

export const FAMILY_SERVICES_DEFAULTS = Object.freeze({
  hostedSync: false as const,
  trustedScorer: false as const,
})

export type FamilyServicesModeR1 =
  | 'NEITHER_ENABLED'
  | 'SYNC_ONLY'
  | 'SCORER_ONLY'
  | 'BOTH_ENABLED'

export interface FamilyHostedSyncPilotConfigurationR1 {
  /** Reuses the accepted Hosted Sync R2 adapter; this layer never creates another transport. */
  readonly adapter: HostedSyncRpcAdapter
  readonly parentStatus: Exclude<ParentSyncStatusR1, 'LOCAL_ONLY'>
}

/**
 * One injected non-production composition for the two independent services.
 * Flags alone are insufficient: each enabled service must also have its
 * reviewed port injected by the host.
 */
export interface FamilyServicesPilotConfigurationR1 {
  readonly environment: FamilyPilotTrustedScorerEnvironment
  readonly hostedSync?: FamilyHostedSyncPilotConfigurationR1
  readonly trustedScorer?: LearnerResponseAssessor
}

export interface ResolvedFamilyServicesR1 {
  readonly mode: FamilyServicesModeR1
  readonly hostedSync?: FamilyHostedSyncPilotConfigurationR1
  readonly trustedScorer?: LearnerResponseAssessor
  readonly parentSyncStatus: ParentSyncStatusR1
}

function mode(hostedSync: boolean, trustedScorer: boolean): FamilyServicesModeR1 {
  if (hostedSync && trustedScorer) return 'BOTH_ENABLED'
  if (hostedSync) return 'SYNC_ONLY'
  if (trustedScorer) return 'SCORER_ONLY'
  return 'NEITHER_ENABLED'
}

export function resolveFamilyServicesR1(input: {
  readonly hostedSyncFeatureFlagValue: string | undefined
  readonly trustedScorerFeatureFlagValue: string | undefined
  readonly configuration?: FamilyServicesPilotConfigurationR1
}): ResolvedFamilyServicesR1 {
  const configuration = input.configuration
  const nonProduction = configuration !== undefined && configuration.environment !== 'production'
  const hostedSync = nonProduction && input.hostedSyncFeatureFlagValue === 'true'
    ? configuration.hostedSync
    : undefined
  const trustedScorer = resolveFamilyPilotTrustedScorer({
    featureFlagValue: input.trustedScorerFeatureFlagValue,
    configuration: nonProduction && configuration.trustedScorer
      ? { environment: configuration.environment, assessor: configuration.trustedScorer }
      : undefined,
  })
  return Object.freeze({
    mode: mode(hostedSync !== undefined, trustedScorer !== undefined),
    ...(hostedSync ? { hostedSync } : {}),
    ...(trustedScorer ? { trustedScorer } : {}),
    parentSyncStatus: hostedSync?.parentStatus ?? 'LOCAL_ONLY',
  })
}
