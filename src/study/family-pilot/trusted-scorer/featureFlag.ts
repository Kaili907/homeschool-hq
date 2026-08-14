import type { LearnerResponseAssessor } from '../final-app/learner-response'

export const FAMILY_PILOT_TRUSTED_SCORER_FEATURE_FLAG =
  'VITE_FAMILY_PILOT_TRUSTED_SCORER_ENABLED' as const

export type FamilyPilotTrustedScorerEnvironment =
  | 'local'
  | 'test'
  | 'staging'
  | 'production'

export interface FamilyPilotTrustedScorerPilotConfiguration {
  readonly environment: FamilyPilotTrustedScorerEnvironment
  readonly assessor: LearnerResponseAssessor
}

/** Exact opt-in plus an injected, explicitly non-production composition. */
export function resolveFamilyPilotTrustedScorer(input: {
  readonly featureFlagValue: string | undefined
  readonly configuration?: FamilyPilotTrustedScorerPilotConfiguration
}): LearnerResponseAssessor | undefined {
  if (input.featureFlagValue !== 'true' || !input.configuration ||
    input.configuration.environment === 'production') return undefined
  return input.configuration.assessor
}
