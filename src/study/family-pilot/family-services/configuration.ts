import type { LearnerResponseAssessor } from '../final-app/learner-response'
import type { FamilyPilotTrustedScorerEnvironment } from '../trusted-scorer'
import { resolveFamilyPilotTrustedScorer } from '../trusted-scorer'
import type { ParentSyncStatusR1 } from '../../hosted-sync/v2/familyPilot/status'

export const FAMILY_SERVICES_FEATURE_FLAGS = Object.freeze({
  trustedScorer: 'VITE_FAMILY_PILOT_TRUSTED_SCORER_ENABLED',
} as const)

export const FAMILY_SERVICES_DEFAULTS = Object.freeze({
  trustedScorer: false as const,
})

export type FamilyServicesModeR1 =
  | 'NEITHER_ENABLED'
  | 'SCORER_ONLY'

/** Scoring remains a separately injected, non-production-only service. */
export interface FamilyServicesPilotConfigurationR1 {
  readonly environment: FamilyPilotTrustedScorerEnvironment
  readonly trustedScorer?: LearnerResponseAssessor
}

export interface ResolvedFamilyServicesR1 {
  readonly mode: FamilyServicesModeR1
  readonly trustedScorer?: LearnerResponseAssessor
  readonly parentSyncStatus: ParentSyncStatusR1
}

export function resolveFamilyServicesR1(input: {
  readonly trustedScorerFeatureFlagValue: string | undefined
  readonly configuration?: FamilyServicesPilotConfigurationR1
}): ResolvedFamilyServicesR1 {
  const configuration = input.configuration
  const nonProduction = configuration !== undefined && configuration.environment !== 'production'
  const trustedScorer = resolveFamilyPilotTrustedScorer({
    featureFlagValue: input.trustedScorerFeatureFlagValue,
    configuration: nonProduction && configuration.trustedScorer
      ? { environment: configuration.environment, assessor: configuration.trustedScorer }
      : undefined,
  })
  return Object.freeze({
    mode: trustedScorer ? 'SCORER_ONLY' : 'NEITHER_ENABLED',
    ...(trustedScorer ? { trustedScorer } : {}),
    // Family Cloud is composed only through FamilyCloudAuthRuntime; this
    // scorer configuration can never imply cloud availability.
    parentSyncStatus: 'LOCAL_ONLY',
  })
}
