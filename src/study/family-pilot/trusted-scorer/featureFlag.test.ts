import { describe, expect, it } from 'vitest'
import type { LearnerResponseAssessor } from '../final-app/learner-response'
import { resolveFamilyPilotTrustedScorer } from './featureFlag'

const assessor: LearnerResponseAssessor = Object.freeze({
  assessorRef: 'trusted:test',
  assess: async () => { throw new Error('not called') },
})

describe('Family Pilot trusted scorer feature gate', () => {
  it.each([
    [undefined, undefined],
    ['false', { environment: 'staging' as const, assessor }],
    ['true', undefined],
    ['true', { environment: 'production' as const, assessor }],
  ])('stays disabled without both explicit non-production locks', (featureFlagValue, configuration) => {
    expect(resolveFamilyPilotTrustedScorer({ featureFlagValue, configuration })).toBeUndefined()
  })

  it.each(['local', 'test', 'staging'] as const)('admits explicit %s composition', (environment) => {
    expect(resolveFamilyPilotTrustedScorer({
      featureFlagValue: 'true',
      configuration: { environment, assessor },
    })).toBe(assessor)
  })
})
