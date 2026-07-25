import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultAppState } from '../migration'
import {
  backupLocalForHousehold,
  claimLocalData,
  householdMetaPrefixForTests,
  listHouseholdMetas,
  loadHouseholdMeta,
  localDataOwner,
  saveHouseholdMeta,
  supabaseAnonKey,
  supabaseConfigured,
  supabaseUrl,
} from './config'
import {
  createSupabaseBrowserClient,
  getVerifiedAuthContext,
  getVerifiedCurrentUser,
  onAuthSessionChange,
  profileRowsForUpsert,
  pullProfiles,
  signOutRemote,
  userFromSession,
} from './supabase'
import { emptyHouseholdMeta, type RemoteProfileRow } from './types'
import {
  APP_STATE_STORAGE_KEY,
  datasetFingerprint,
  ensureDatasetProvenance,
} from './provenance'
import { finalizationGuardForTestSetup } from './finalizationGuard.test-helper'

class MemStorage {
  private values = new Map<string, string>()
  get length() {
    return this.values.size
  }
  clear() {
    this.values.clear()
  }
  getItem(key: string) {
    return this.values.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.values.set(key, String(value))
  }
  removeItem(key: string) {
    this.values.delete(key)
  }
  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null
  }
}

describe('keyless local mode', () => {
  it('is inert when Supabase environment variables are absent', () => {
    expect(supabaseUrl()).toBe('')
    expect(supabaseAnonKey()).toBe('')
    expect(supabaseConfigured()).toBe(false)
  })
})

describe('household-scoped persistence', () => {
  let fingerprint: string
  beforeEach(async () => {
    ;(globalThis as unknown as { localStorage: Storage }).localStorage =
      new MemStorage() as unknown as Storage
    const state = defaultAppState()
    localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(state))
    await ensureDatasetProvenance()
    fingerprint = await datasetFingerprint(state)
  })
  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: Storage }).localStorage
  })

  it('uses a separate metadata key for every verified household', () => {
    saveHouseholdMeta({
      ...emptyHouseholdMeta('household-a', 'a@example.com'),
      profiles: { p1: { updatedAt: 1, dirty: true } },
    })
    saveHouseholdMeta({
      ...emptyHouseholdMeta('household-b', 'b@example.com'),
      profiles: { p2: { updatedAt: 2, dirty: true } },
    })

    expect(loadHouseholdMeta('household-a').profiles).toHaveProperty('p1')
    expect(loadHouseholdMeta('household-a').profiles).not.toHaveProperty('p2')
    expect(loadHouseholdMeta('household-b').profiles).toHaveProperty('p2')
    expect(
      Array.from({ length: localStorage.length }, (_, i) =>
        localStorage.key(i),
      ),
    ).toEqual(
      expect.arrayContaining([
        `${householdMetaPrefixForTests}household-a`,
        `${householdMetaPrefixForTests}household-b`,
      ]),
    )
  })

  it('preserves Household A binding while Household B remains unbound', async () => {
    const boundA = await claimLocalData(
      'household-a',
      'a@example.com',
      {
        ...emptyHouseholdMeta('household-a'),
        reconciliation: 'ready',
      },
      fingerprint,
      finalizationGuardForTestSetup('household-a'),
    )
    const unboundB = loadHouseholdMeta('household-b', 'b@example.com')
    saveHouseholdMeta(unboundB)

    expect(boundA.ownsLocalData).toBe(true)
    expect(localDataOwner('household-b')?.householdId).toBe('household-a')
    expect(loadHouseholdMeta('household-b').binding).toBe('unbound')
    expect(loadHouseholdMeta('household-b').profiles).toEqual({})
  })

  it('moving to a confirmed household retains old binding metadata', async () => {
    await claimLocalData(
      'household-a',
      'a@example.com',
      emptyHouseholdMeta('household-a'),
      fingerprint,
      finalizationGuardForTestSetup('household-a'),
    )
    await claimLocalData(
      'household-b',
      'b@example.com',
      emptyHouseholdMeta('household-b'),
      fingerprint,
      finalizationGuardForTestSetup('household-b'),
    )

    expect(loadHouseholdMeta('household-a').binding).toBe('bound')
    expect(loadHouseholdMeta('household-a').ownsLocalData).toBe(false)
    expect(loadHouseholdMeta('household-b').ownsLocalData).toBe(true)
    expect(listHouseholdMetas()).toHaveLength(2)
  })

  it('sign-out clears only the supported local auth session and preserves local binding data', async () => {
    await claimLocalData(
      'household-a',
      'a@example.com',
      {
        ...emptyHouseholdMeta('household-a'),
        profiles: { p1: { updatedAt: 1, dirty: true } },
      },
      fingerprint,
      finalizationGuardForTestSetup('household-a'),
    )
    const signOut = vi.fn(async () => ({ error: null }))
    await signOutRemote({ auth: { signOut } } as never)
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(localDataOwner()?.householdId).toBe('household-a')
    expect(loadHouseholdMeta('household-a').profiles.p1.dirty).toBe(true)
  })

  it('creates a household-scoped safety backup before replacement', () => {
    const state = defaultAppState()
    state.profiles.p1.name = 'Local child'
    const key = backupLocalForHousehold('household-a', state)
    expect(key).toContain('homeschool-hq:backup:sync:household-a:')
    expect(JSON.parse(localStorage.getItem(key!)!).profiles.p1.name).toBe(
      'Local child',
    )
  })
})

describe('official Supabase auth and transport', () => {
  it('enables supported persisted sessions and automatic token refresh', () => {
    const client = createSupabaseBrowserClient(
      'https://example.supabase.co',
      'anon-key',
    )
    const auth = client.auth as unknown as {
      persistSession: boolean
      autoRefreshToken: boolean
      storageKey: string
    }
    expect(auth.persistSession).toBe(true)
    expect(auth.autoRefreshToken).toBe(true)
    expect(auth.storageKey).toContain('auth-token')
  })

  it('keeps the verified household identity on TOKEN_REFRESHED', () => {
    let callback: ((event: string, session: unknown) => void) | undefined
    const unsubscribe = vi.fn()
    const fakeClient = {
      auth: {
        onAuthStateChange: (
          next: (event: string, session: unknown) => void,
        ) => {
          callback = next
          return { data: { subscription: { unsubscribe } } }
        },
      },
    }
    let observed = null as ReturnType<typeof userFromSession>
    const stop = onAuthSessionChange((_event, session) => {
      observed = userFromSession(session)
    }, fakeClient as never)
    callback?.('TOKEN_REFRESHED', {
      user: { id: 'household-a', email: 'a@example.com' },
    })
    expect(observed).toEqual({ id: 'household-a', email: 'a@example.com' })
    stop()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('uses the server-verified Supabase user at the mutation boundary', async () => {
    const getUser = vi.fn(async () => ({
      data: { user: { id: 'household-a', email: 'a@example.com' } },
      error: null,
    }))
    await expect(
      getVerifiedCurrentUser({ auth: { getUser } } as never),
    ).resolves.toEqual({
      id: 'household-a',
      email: 'a@example.com',
    })
    expect(getUser).toHaveBeenCalledOnce()
  })

  it('captures the same server-verified token and identity for a scoped write', async () => {
    const getSession = vi.fn(async () => ({
      data: {
        session: {
          access_token: 'header.payload.signature',
        },
      },
      error: null,
    }))
    const getUser = vi.fn(async (token: string) => ({
      data: { user: { id: 'household-a', email: 'a@example.com' } },
      error:
        token === 'header.payload.signature' ? null : new Error('wrong token'),
    }))
    await expect(
      getVerifiedAuthContext({
        auth: { getSession, getUser },
      } as never),
    ).resolves.toEqual({
      user: { id: 'household-a', email: 'a@example.com' },
      accessToken: 'header.payload.signature',
      verifiedAt: expect.any(Number),
      kind: 'supabase-access-token',
    })
    expect(getUser).toHaveBeenCalledWith('header.payload.signature')
  })

  it('distinguishes a failed pull from a successful empty cloud', async () => {
    const failedClient = {
      from: () => ({
        select: async () => ({ data: null, error: { message: 'offline' } }),
      }),
    }
    const emptyClient = {
      from: () => ({ select: async () => ({ data: [], error: null }) }),
    }
    expect(await pullProfiles(failedClient as never)).toEqual({
      ok: false,
      error: 'offline',
    })
    expect(await pullProfiles(emptyClient as never)).toEqual({
      ok: true,
      rows: [],
    })
  })

  it('treats malformed cloud rows as a pull failure, not an empty household', async () => {
    const malformedClient = {
      from: () => ({
        select: async () => ({
          data: [{ profile_id: 'p1', data: {}, updated_at: 'not-a-date' }],
          error: null,
        }),
      }),
    }
    expect(await pullProfiles(malformedClient as never)).toEqual({
      ok: false,
      error: 'The cloud returned an invalid profile row.',
    })
  })

  it('builds writes with no household id, service-role key, or provider secret', () => {
    const rows: RemoteProfileRow[] = [
      {
        profile_id: 'p1',
        data: defaultAppState().profiles.p1,
        updated_at: '2026-07-24T10:00:00.000Z',
      },
    ]
    expect(profileRowsForUpsert(rows)).toEqual([
      expect.not.objectContaining({
        household_id: expect.anything(),
        service_role: expect.anything(),
      }),
    ])
  })
})
