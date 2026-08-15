import { describe, expect, it, vi } from 'vitest'
import type { LearnerResponseAssessor } from '../final-app/learner-response'
import {
  FAMILY_SERVICES_DEFAULTS,
  resolveFamilyServicesR1,
  type FamilyServicesPilotConfigurationR1,
} from './configuration'

const assessor: LearnerResponseAssessor = Object.freeze({
  assessorRef: 'trusted:production-item:r1',
  assess: vi.fn(),
})

function configuration(environment: FamilyServicesPilotConfigurationR1['environment'] = 'staging'):
FamilyServicesPilotConfigurationR1 {
  return Object.freeze({
    environment,
    trustedScorer: assessor,
  })
}

describe('Family Services staging configuration', () => {
  it('defaults the independent scorer off and leaves Family Cloud local-only', () => {
    expect(FAMILY_SERVICES_DEFAULTS).toEqual({ trustedScorer: false })
    expect(resolveFamilyServicesR1({
      trustedScorerFeatureFlagValue: undefined,
    })).toEqual({ mode: 'NEITHER_ENABLED', parentSyncStatus: 'LOCAL_ONLY' })
  })

  it('resolves scorer configuration without contacting the injected service', () => {
    resolveFamilyServicesR1({
      trustedScorerFeatureFlagValue: 'true',
      configuration: configuration(),
    })
    expect(assessor.assess).not.toHaveBeenCalled()
  })

  it.each([
    [undefined, 'NEITHER_ENABLED'],
    ['true', 'SCORER_ONLY'],
  ] as const)('resolves the staging scorer flag as %s', (scorer, mode) => {
    expect(resolveFamilyServicesR1({
      trustedScorerFeatureFlagValue: scorer,
      configuration: configuration(),
    })).toMatchObject({ mode, parentSyncStatus: 'LOCAL_ONLY' })
  })

  it('requires the exact scorer flag and injected port', () => {
    expect(resolveFamilyServicesR1({
      trustedScorerFeatureFlagValue: '1',
      configuration: configuration(),
    })).toEqual({ mode: 'NEITHER_ENABLED', parentSyncStatus: 'LOCAL_ONLY' })
    expect(resolveFamilyServicesR1({
      trustedScorerFeatureFlagValue: 'true',
      configuration: { environment: 'staging' },
    })).toEqual({ mode: 'NEITHER_ENABLED', parentSyncStatus: 'LOCAL_ONLY' })
  })

  it('mechanically disables scorer integration in production', () => {
    expect(resolveFamilyServicesR1({
      trustedScorerFeatureFlagValue: 'true',
      configuration: configuration('production'),
    })).toEqual({ mode: 'NEITHER_ENABLED', parentSyncStatus: 'LOCAL_ONLY' })
  })
})
