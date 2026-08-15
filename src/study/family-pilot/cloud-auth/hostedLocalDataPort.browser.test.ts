import { describe, expect, it, vi } from 'vitest'
import type { HostedSyncRpcAdapter } from '../../hosted-sync/v2/client'
import {
  HostedFamilyCloudLocalDataPortR1,
  type FamilyCloudLocalLearnerStateR1,
} from './hostedLocalDataPort'

const HOUSEHOLD = '00000000-0000-4000-8000-000000000201'
const AUTHORIZATION = Object.freeze({
  kind: 'supabase-access-token' as const,
  verifiedAt: Date.now(),
  user: Object.freeze({ id: '00000000-0000-4000-8000-000000000101', email: 'parent@example.test' }),
  accessToken: 'header.payload.signature',
})

describe('browser Family Cloud local-data activation', () => {
  it('publishes an authenticated fresh household with zero learners without inventing a learner', async () => {
    let published = false
    const repository = {
      hasHousehold: () => published,
      readHousehold: vi.fn(async () => Object.freeze([])),
      commitVerifiedHydration: vi.fn(async ({ learners, expectedLocal }: {
        learners: readonly FamilyCloudLocalLearnerStateR1[]
        expectedLocal: readonly FamilyCloudLocalLearnerStateR1[]
      }) => {
        expect(learners).toEqual([])
        expect(expectedLocal).toEqual([])
        published = true
        return true
      }),
      retainConflict: vi.fn(async () => undefined),
    }
    const directory = { resolve: vi.fn(async () => Object.freeze({ status: 'READY' as const, learners: Object.freeze([]) })) }
    const client = {
      firstLink: vi.fn(), hydrate: vi.fn(), write: vi.fn(), clearAuthorization: vi.fn(),
    } as unknown as HostedSyncRpcAdapter
    const port = new HostedFamilyCloudLocalDataPortR1({
      repository, directory, client, deviceRef: 'device:fresh',
    })

    await expect(port.establish({ householdRef: HOUSEHOLD, authorization: AUTHORIZATION })).resolves.toBe('READY')
    expect(repository.commitVerifiedHydration).toHaveBeenCalledOnce()
    expect(client.firstLink).not.toHaveBeenCalled()
    expect(client.hydrate).not.toHaveBeenCalled()
    expect(port.hasLocalHousehold(HOUSEHOLD)).toBe(true)
  })
})
