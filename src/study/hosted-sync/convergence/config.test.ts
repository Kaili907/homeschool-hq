import { describe, expect, it } from 'vitest'
import { evaluateHostedStudySyncConfig, hostedStudySyncEnabledForHousehold } from './config'
import { evaluateHostedStudySyncReadiness } from './readiness'
import { emptyHostedStudyLocalSyncState, enqueueHostedStudyOperation } from './syncMetadata'

const identity = {
  householdRef: 'household:one',
  studentRef: '11111111-2222-4333-8444-555555555555',
  assignmentRef: 'assignment:one',
  sessionRef: 'session:one',
}

describe('hosted Study convergence configuration and readiness', () => {
  it('defaults to local-only and fails closed on partial hosted configuration', () => {
    expect(evaluateHostedStudySyncConfig({})).toEqual({ status: 'disabled', mode: 'WEB_PILOT_LOCAL_ONLY' })
    expect(evaluateHostedStudySyncConfig({ mode: 'HOSTED_SYNC_STAGING' })).toMatchObject({
      status: 'invalid', reason: 'INCOMPLETE_HOSTED_SYNC_CONFIG',
    })
    expect(evaluateHostedStudySyncConfig({
      mode: 'HOSTED_SYNC_FAMILY_ENABLED',
      rpcBaseUrl: 'https://example.supabase.co/rest/v1/rpc',
      publicClientKey: 'sb_publishable_example',
    })).toMatchObject({ status: 'invalid', reason: 'FAMILY_ALLOWLIST_REQUIRED' })
  })

  it('requires an explicit family allowlist and rejects service-role-shaped keys', () => {
    const enabled = evaluateHostedStudySyncConfig({
      mode: 'HOSTED_SYNC_FAMILY_ENABLED',
      rpcBaseUrl: 'https://example.supabase.co/rest/v1/rpc',
      publicClientKey: 'sb_publishable_example',
      allowedHouseholdRefs: ['household:one'],
    })
    expect(hostedStudySyncEnabledForHousehold(enabled, 'household:one')).toBe(true)
    expect(hostedStudySyncEnabledForHousehold(enabled, 'household:two')).toBe(false)
    expect(evaluateHostedStudySyncConfig({
      mode: 'HOSTED_SYNC_STAGING',
      rpcBaseUrl: 'https://example.supabase.co/rest/v1/rpc',
      publicClientKey: 'service_role_secret',
    }).status).toBe('invalid')
  })

  it('reports sync separately from local storage readiness', () => {
    const config = evaluateHostedStudySyncConfig({
      mode: 'HOSTED_SYNC_STAGING',
      rpcBaseUrl: '/rest/v1/rpc',
      publicClientKey: 'sb_publishable_example',
    })
    const initial = emptyHostedStudyLocalSyncState({
      identity,
      deviceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })
    const queued = enqueueHostedStudyOperation({
      state: initial,
      operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      operation: 'checkpoint:compare-and-swap',
    })
    expect(evaluateHostedStudySyncReadiness({ config, syncState: queued, localStorageReady: true })).toEqual({
      state: 'SYNC_OFFLINE_QUEUED', localStudyMayContinue: true, queuedOperationCount: 1,
    })
    expect(evaluateHostedStudySyncReadiness({
      config,
      syncState: { ...queued, lastOutcome: 'AUTH_REQUIRED' },
      localStorageReady: true,
    })).toMatchObject({ state: 'SYNC_AUTH_REQUIRED', localStudyMayContinue: true })
  })
})
