import { describe, expect, it, vi } from 'vitest'
import type { LearnerResponseAssessor } from '../final-app/learner-response'
import type { HostedSyncRpcAdapter } from '../../hosted-sync/v2/client'
import {
  FAMILY_SERVICES_DEFAULTS,
  resolveFamilyServicesR1,
  type FamilyServicesPilotConfigurationR1,
} from './configuration'

const assessor: LearnerResponseAssessor = Object.freeze({
  assessorRef: 'trusted:production-item:r1',
  assess: vi.fn(),
})

const syncCalls = Object.freeze({
  firstLink: vi.fn(),
  resolveMapping: vi.fn(),
  hydrate: vi.fn(),
  write: vi.fn(),
})
const syncAdapter = syncCalls as unknown as HostedSyncRpcAdapter

function configuration(environment: FamilyServicesPilotConfigurationR1['environment'] = 'staging'):
FamilyServicesPilotConfigurationR1 {
  return Object.freeze({
    environment,
    hostedSync: Object.freeze({ adapter: syncAdapter, parentStatus: 'SYNC_READY' }),
    trustedScorer: assessor,
  })
}

describe('Family Services staging configuration', () => {
  it('defaults both services off even when no host composition exists', () => {
    expect(FAMILY_SERVICES_DEFAULTS).toEqual({ hostedSync: false, trustedScorer: false })
    expect(resolveFamilyServicesR1({
      hostedSyncFeatureFlagValue: undefined,
      trustedScorerFeatureFlagValue: undefined,
    })).toEqual({ mode: 'NEITHER_ENABLED', parentSyncStatus: 'LOCAL_ONLY' })
  })

  it('resolves configuration without contacting either injected service', () => {
    resolveFamilyServicesR1({
      hostedSyncFeatureFlagValue: 'true',
      trustedScorerFeatureFlagValue: 'true',
      configuration: configuration(),
    })
    expect(syncCalls.firstLink).not.toHaveBeenCalled()
    expect(syncCalls.resolveMapping).not.toHaveBeenCalled()
    expect(syncCalls.hydrate).not.toHaveBeenCalled()
    expect(syncCalls.write).not.toHaveBeenCalled()
    expect(assessor.assess).not.toHaveBeenCalled()
  })

  it.each([
    [undefined, undefined, 'NEITHER_ENABLED', 'LOCAL_ONLY'],
    ['true', undefined, 'SYNC_ONLY', 'SYNC_READY'],
    [undefined, 'true', 'SCORER_ONLY', 'LOCAL_ONLY'],
    ['true', 'true', 'BOTH_ENABLED', 'SYNC_READY'],
  ] as const)('resolves the independent staging flags as %s/%s', (sync, scorer, mode, parentStatus) => {
    expect(resolveFamilyServicesR1({
      hostedSyncFeatureFlagValue: sync,
      trustedScorerFeatureFlagValue: scorer,
      configuration: configuration(),
    })).toMatchObject({ mode, parentSyncStatus: parentStatus })
  })

  it('requires exact flags and the corresponding injected port', () => {
    expect(resolveFamilyServicesR1({
      hostedSyncFeatureFlagValue: 'TRUE',
      trustedScorerFeatureFlagValue: '1',
      configuration: configuration(),
    })).toEqual({ mode: 'NEITHER_ENABLED', parentSyncStatus: 'LOCAL_ONLY' })
    expect(resolveFamilyServicesR1({
      hostedSyncFeatureFlagValue: 'true',
      trustedScorerFeatureFlagValue: 'true',
      configuration: { environment: 'staging' },
    })).toEqual({ mode: 'NEITHER_ENABLED', parentSyncStatus: 'LOCAL_ONLY' })
  })

  it('mechanically disables both integrations in production', () => {
    expect(resolveFamilyServicesR1({
      hostedSyncFeatureFlagValue: 'true',
      trustedScorerFeatureFlagValue: 'true',
      configuration: configuration('production'),
    })).toEqual({ mode: 'NEITHER_ENABLED', parentSyncStatus: 'LOCAL_ONLY' })
  })
})
