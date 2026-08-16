import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VerifiedAuthContext } from '../../../auth/supabaseSession'
import { FamilyCloudAuthCoordinator } from './coordinator'
import { createLinkedFamilyDeviceStore, LINKED_FAMILY_DEVICE_KEY } from './deviceStore'
import { FamilyLearnerSession } from './learnerSession'
import { createHouseholdScopedStorage } from './scopedStorage'
import { createSupabaseFamilyCloudIdentity, createSupabaseFamilyHouseholdAuthority } from './supabase'
import { digestLocalPin } from '../final-app/state'
import type {
  FamilyCloudIdentityContext,
  FamilyCloudIdentityPort,
  FamilyCloudLocalDataPort,
  FamilyHouseholdAuthorityPort,
  FamilyLocalLearnerAccessPort,
} from './types'

const NOW = new Date('2026-08-14T16:00:00.000Z')
const HOUSEHOLD_A = '10000000-0000-4000-8000-000000000001'
const HOUSEHOLD_B = '20000000-0000-4000-8000-000000000002'
const USER_A = '30000000-0000-4000-8000-000000000003'

afterEach(() => { vi.unstubAllGlobals() })

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

function authorization(userId = USER_A): VerifiedAuthContext {
  return {
    kind: 'supabase-access-token', verifiedAt: NOW.getTime(),
    user: { id: userId, email: 'parent@example.test' },
    accessToken: 'header.payload.signature',
  }
}

function context(expiresAt = '2026-08-14T18:00:00.000Z'): FamilyCloudIdentityContext {
  return { authorization: authorization(), expiresAt }
}

function identity(current: FamilyCloudIdentityContext | null = null): FamilyCloudIdentityPort & { signOut: ReturnType<typeof vi.fn> } {
  const signOut = vi.fn(async () => 'SIGNED_OUT' as const)
  return {
    current: vi.fn(async () => current),
    signIn: vi.fn(async () => ({ status: 'SIGNED_IN' as const, context: context() })),
    signUp: vi.fn(async () => ({ status: 'SIGNED_IN' as const, context: context() })),
    requestPasswordRecovery: vi.fn(async () => 'SENT' as const),
    requestMagicLink: vi.fn(async () => 'SENT' as const),
    signOut,
  }
}

function data(initial: readonly string[] = []): FamilyCloudLocalDataPort & {
  local: Set<string>
  establish: ReturnType<typeof vi.fn>
  clearCloudAuthority: ReturnType<typeof vi.fn>
  reconcile: ReturnType<typeof vi.fn>
} {
  const local = new Set(initial)
  const establish = vi.fn(async ({ householdRef }: { householdRef: string }) => {
    local.add(householdRef)
    return 'READY' as const
  })
  const clearCloudAuthority = vi.fn()
  return {
    local, establish, clearCloudAuthority,
    hasLocalHousehold: (householdRef) => local.has(householdRef),
    reconcile: vi.fn(async () => 'UP_TO_DATE' as const),
  }
}

function authority(result: Awaited<ReturnType<FamilyHouseholdAuthorityPort['resolve']>> = { status: 'RESOLVED', householdRef: HOUSEHOLD_A }): FamilyHouseholdAuthorityPort {
  return { resolve: vi.fn(async () => result) }
}

function coordinator(options: {
  identity?: FamilyCloudIdentityPort
  authority?: FamilyHouseholdAuthorityPort
  data?: FamilyCloudLocalDataPort
  storage?: MemoryStorage
  online?: boolean
} = {}) {
  const storage = options.storage ?? new MemoryStorage()
  return new FamilyCloudAuthCoordinator({
    identity: options.identity ?? identity(), authority: options.authority ?? authority(),
    localData: options.data ?? data(), device: createLinkedFamilyDeviceStore(storage),
    isOnline: () => options.online ?? true, now: () => NOW,
  })
}

describe('family household cloud auth', () => {
  it('uses an already-authenticated provider session to skip sign-in and bootstrap the household', async () => {
    const auth = identity(context())
    const runtime = coordinator({ identity: auth })
    await expect(runtime.bootstrap()).resolves.toMatchObject({
      status: 'READY', householdRef: HOUSEHOLD_A, cloudAuthority: 'AUTHENTICATED_PARENT_HOUSEHOLD',
    })
    expect(auth.signIn).not.toHaveBeenCalled()
  })

  it('establishes a new computer from Parent cloud login without application credential persistence', async () => {
    const storage = new MemoryStorage()
    const local = data()
    const runtime = coordinator({ storage, data: local })

    await expect(runtime.signIn('parent@example.test', 'provider-password')).resolves.toEqual({
      status: 'READY', householdRef: HOUSEHOLD_A,
      cloudAuthority: 'AUTHENTICATED_PARENT_HOUSEHOLD', localData: 'AVAILABLE',
      expiresAt: '2026-08-14T18:00:00.000Z',
    })
    expect(local.establish).toHaveBeenCalledWith(expect.objectContaining({
      householdRef: HOUSEHOLD_A,
      authorization: expect.objectContaining({ kind: 'supabase-access-token', user: expect.objectContaining({ id: USER_A }) }),
    }))
    const serialized = [...storage.values.values()].join('\n')
    expect(serialized).not.toContain('provider-password')
    expect(serialized).not.toContain('header.payload.signature')
    expect(JSON.parse(storage.getItem(LINKED_FAMILY_DEVICE_KEY) ?? '{}')).toEqual({
      schemaVersion: 1, accountRef: USER_A, householdRef: HOUSEHOLD_A, linkedAt: NOW.toISOString(),
    })
  })

  it('keeps the provider session and local household after first-link failure, then retries the same household', async () => {
    const auth = identity()
    const local = data([HOUSEHOLD_A])
    local.establish.mockResolvedValueOnce('FIRST_LINK_FAILED').mockResolvedValueOnce('READY')
    const householdAuthority = authority()
    const runtime = coordinator({ identity: auth, authority: householdAuthority, data: local })

    await expect(runtime.signIn('parent@example.test', 'password')).resolves.toEqual({
      status: 'NEEDS_ATTENTION', householdRef: HOUSEHOLD_A,
      cloudAuthority: 'AUTHENTICATED_PARENT_HOUSEHOLD', localData: 'AVAILABLE',
      expiresAt: '2026-08-14T18:00:00.000Z', reason: 'CLOUD_FIRST_LINK_FAILED',
    })
    expect(local.local.has(HOUSEHOLD_A)).toBe(true)
    expect(auth.signIn).toHaveBeenCalledOnce()

    await expect(runtime.retryCloudSetup()).resolves.toMatchObject({
      status: 'READY', householdRef: HOUSEHOLD_A,
    })
    expect(auth.signIn).toHaveBeenCalledOnce()
    expect(householdAuthority.resolve).toHaveBeenCalledTimes(2)
    expect(local.establish).toHaveBeenNthCalledWith(2, expect.objectContaining({ householdRef: HOUSEHOLD_A }))
  })

  it('classifies rejected credentials as sign-in failure before cloud setup begins', async () => {
    const auth = identity()
    auth.signIn = vi.fn(async () => ({ status: 'INVALID_CREDENTIALS' as const }))
    const local = data()
    const runtime = coordinator({ identity: auth, data: local })
    await expect(runtime.signIn('parent@example.test', 'wrong')).resolves.toMatchObject({
      status: 'NEEDS_ATTENTION', cloudAuthority: 'NONE', reason: 'SIGN_IN_FAILED',
    })
    expect(local.establish).not.toHaveBeenCalled()
  })

  it('creates an account through the provider without persisting the password', async () => {
    const storage = new MemoryStorage()
    const auth = identity()
    const runtime = coordinator({ storage, identity: auth })
    await expect(runtime.createAccount('new-parent@example.test', 'new-provider-password')).resolves.toMatchObject({
      status: 'SESSION', state: { status: 'READY', householdRef: HOUSEHOLD_A },
    })
    expect(auth.signUp).toHaveBeenCalledWith('new-parent@example.test', 'new-provider-password', undefined)
    expect([...storage.values.values()].join('\n')).not.toContain('new-provider-password')
  })

  it('returns to signed out while email confirmation is pending', async () => {
    const auth = identity()
    auth.signUp = vi.fn(async () => ({ status: 'CONFIRM_EMAIL' as const }))
    const runtime = coordinator({ identity: auth })
    await expect(runtime.createAccount('new-parent@example.test', 'password')).resolves.toEqual({ status: 'CONFIRM_EMAIL' })
    expect(runtime.snapshot()).toEqual({
      status: 'SIGNED_OUT', householdRef: null, cloudAuthority: 'NONE', localData: 'UNAVAILABLE',
    })
  })

  it('refuses absent and ambiguous household memberships without opening local data', async () => {
    for (const status of ['NO_ACTIVE_HOUSEHOLD', 'AMBIGUOUS_HOUSEHOLD'] as const) {
      const local = data([HOUSEHOLD_B])
      const runtime = coordinator({ authority: authority({ status }), data: local })
      const result = await runtime.signIn('parent@example.test', 'password')
      expect(result).toMatchObject({ status: 'NEEDS_ATTENTION', householdRef: null, reason: status })
      expect(local.establish).not.toHaveBeenCalled()
    }
  })

  it('expires online but permits matching saved local data when an already-linked device is offline', async () => {
    const storage = new MemoryStorage()
    const store = createLinkedFamilyDeviceStore(storage)
    store.save({ schemaVersion: 1, accountRef: USER_A, householdRef: HOUSEHOLD_A, linkedAt: NOW.toISOString() })
    const expiredOnline = coordinator({
      storage, identity: identity(context('2026-08-14T15:59:59.000Z')),
      data: data([HOUSEHOLD_A]), online: true,
    })
    await expect(expiredOnline.bootstrap()).resolves.toMatchObject({ status: 'EXPIRED', householdRef: HOUSEHOLD_A })

    const offline = coordinator({ storage, identity: identity(null), data: data([HOUSEHOLD_A]), online: false })
    await expect(offline.bootstrap()).resolves.toEqual({
      status: 'OFFLINE_LOCAL', householdRef: HOUSEHOLD_A,
      cloudAuthority: 'NONE', localData: 'SAVED_ON_DEVICE',
    })
  })

  it('never grants offline access for an unlinked or wrong-household local dataset', async () => {
    const storage = new MemoryStorage()
    const store = createLinkedFamilyDeviceStore(storage)
    store.save({ schemaVersion: 1, accountRef: USER_A, householdRef: HOUSEHOLD_A, linkedAt: NOW.toISOString() })
    const runtime = coordinator({ storage, identity: identity(null), data: data([HOUSEHOLD_B]), online: false })
    await expect(runtime.bootstrap()).resolves.toMatchObject({ status: 'EXPIRED', householdRef: HOUSEHOLD_A, localData: 'UNAVAILABLE' })
  })

  it('does not use another account\'s linked household when membership resolution is offline', async () => {
    const storage = new MemoryStorage()
    createLinkedFamilyDeviceStore(storage).save({
      schemaVersion: 1, accountRef: USER_A, householdRef: HOUSEHOLD_A, linkedAt: NOW.toISOString(),
    })
    const otherAccount: FamilyCloudIdentityContext = {
      authorization: authorization('40000000-0000-4000-8000-000000000004'),
      expiresAt: '2026-08-14T18:00:00.000Z',
    }
    const runtime = coordinator({
      storage, identity: identity(otherAccount), authority: authority({ status: 'UNAVAILABLE' }),
      data: data([HOUSEHOLD_A]), online: false,
    })
    await expect(runtime.bootstrap()).resolves.toMatchObject({
      status: 'NEEDS_ATTENTION', householdRef: null,
      cloudAuthority: 'AUTHENTICATED_PARENT', reason: 'CLOUD_SETUP_FAILED',
    })
  })

  it('sign out clears provider and linked-device authority without deleting household data', async () => {
    const storage = new MemoryStorage()
    const local = data()
    const auth = identity()
    const runtime = coordinator({ storage, data: local, identity: auth })
    await runtime.signIn('parent@example.test', 'password')
    await expect(runtime.signOut()).resolves.toMatchObject({ status: 'SIGNED_OUT' })
    expect(auth.signOut).toHaveBeenCalledOnce()
    expect(local.clearCloudAuthority).toHaveBeenCalled()
    expect(storage.getItem(LINKED_FAMILY_DEVICE_KEY)).toBeNull()
    expect(local.local.has(HOUSEHOLD_A)).toBe(true)
  })

  it('does not report signed out when the provider logout fails', async () => {
    const storage = new MemoryStorage()
    const auth = identity()
    auth.signOut.mockResolvedValueOnce('UNAVAILABLE')
    const runtime = coordinator({ storage, identity: auth })
    await runtime.signIn('parent@example.test', 'password')
    await expect(runtime.signOut()).resolves.toMatchObject({
      status: 'NEEDS_ATTENTION', reason: 'AUTH_UNAVAILABLE', cloudAuthority: 'NONE',
    })
    expect(storage.getItem(LINKED_FAMILY_DEVICE_KEY)).not.toBeNull()
  })

  it('reconciles only through the established authenticated household context', async () => {
    const local = data()
    const runtime = coordinator({ data: local })
    await expect(runtime.reconcile()).resolves.toBe('UNAVAILABLE')
    await runtime.signIn('parent@example.test', 'password')
    await expect(runtime.reconcile()).resolves.toBe('UP_TO_DATE')
    expect(local.reconcile).toHaveBeenCalledWith(expect.objectContaining({
      householdRef: HOUSEHOLD_A,
      authorization: expect.objectContaining({ user: expect.objectContaining({ id: USER_A }) }),
    }))
    await runtime.signOut()
    await expect(runtime.reconcile()).resolves.toBe('UNAVAILABLE')
  })

  it('aborts in-flight cloud reconciliation when the household signs out', async () => {
    const local = data()
    let heldSignal: AbortSignal | undefined
    local.reconcile.mockImplementation(async ({ signal }: { signal?: AbortSignal }) => {
      heldSignal = signal
      if (!signal) return 'UNAVAILABLE'
      return new Promise<'UNAVAILABLE'>((resolve) => {
        signal.addEventListener('abort', () => resolve('UNAVAILABLE'), { once: true })
      })
    })
    const runtime = coordinator({ data: local })
    await runtime.signIn('parent@example.test', 'password')
    const pending = runtime.reconcile()
    await runtime.signOut()
    await expect(pending).resolves.toBe('UNAVAILABLE')
    expect(heldSignal?.aborted).toBe(true)
  })
})

describe('learner selection inside household authority', () => {
  function learnerAccess(): FamilyLocalLearnerAccessPort {
    const profiles = new Map([
      [HOUSEHOLD_A, [
        { learnerRef: 'learner:ada', displayName: 'Ada', pinRequired: true },
        { learnerRef: 'learner:bea', displayName: 'Bea', pinRequired: true },
      ]],
      [HOUSEHOLD_B, [{ learnerRef: 'learner:other', displayName: 'Other', pinRequired: true }]],
    ])
    const verifiers: Record<string, string> = {
      'learner:ada': digestLocalPin('1234'),
      'learner:bea': digestLocalPin('5678'),
      'learner:other': digestLocalPin('9999'),
    }
    return {
      list: (householdRef) => profiles.get(householdRef) ?? [],
      verifyPin: (_householdRef, learnerRef, pin) => verifiers[learnerRef] === digestLocalPin(pin),
      dashboard: (householdRef, learnerRef) => ({ householdRef, learnerRef, privateWork: `${learnerRef}:only` }),
    }
  }

  it('requires the selected learner PIN and isolates sibling and wrong-household dashboards', async () => {
    const runtime = coordinator()
    await runtime.signIn('parent@example.test', 'password')
    const session = new FamilyLearnerSession(runtime, learnerAccess())

    expect(session.authenticate('learner:ada', '0000')).toBe(false)
    expect(session.dashboard()).toBeNull()
    expect(session.authenticate('learner:other', '9999')).toBe(false)
    expect(session.authenticate('learner:ada', '1234')).toBe(true)
    expect(session.dashboard()).toEqual({ householdRef: HOUSEHOLD_A, learnerRef: 'learner:ada', privateWork: 'learner:ada:only' })
    expect(JSON.stringify(session.dashboard())).not.toContain('learner:bea:only')

    session.switchLearner()
    expect(session.authenticate('learner:bea', '5678')).toBe(true)
    expect(JSON.stringify(session.dashboard())).not.toContain('learner:ada:only')
    session.lock()
    expect(session.snapshot()).toEqual({ status: 'LOCKED', householdRef: HOUSEHOLD_A, learnerRef: null })
    expect(runtime.snapshot().status).toBe('READY')
  })

  it('learner sign out clears the household session while lock retains it', async () => {
    const runtime = coordinator()
    await runtime.signIn('parent@example.test', 'password')
    const session = new FamilyLearnerSession(runtime, learnerAccess())
    session.authenticate('learner:ada', '1234')
    session.lock()
    expect(runtime.snapshot().status).toBe('READY')
    await session.signOut()
    expect(runtime.snapshot().status).toBe('SIGNED_OUT')
  })
})

describe('canonical Supabase household membership adapter', () => {
  it('derives one household through the pinned bearer and never accepts a household selector', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      expect(url.pathname).toBe('/rest/v1/academy_household_memberships')
      expect(url.searchParams.get('user_id')).toBe(`eq.${USER_A}`)
      expect(url.searchParams.get('status')).toBe('eq.active')
      expect(url.searchParams.has('household_id')).toBe(false)
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer header.payload.signature' })
      expect(init?.body).toBeUndefined()
      return new Response(JSON.stringify([{
        household_id: HOUSEHOLD_A, academy_households: { status: 'active' },
      }]), { status: 200 })
    })
    const adapter = createSupabaseFamilyHouseholdAuthority({
      url: 'https://project.example.test', anonKey: 'anon-test-key', fetchImpl: fetchImpl as typeof fetch,
    })
    await expect(adapter.resolve(authorization())).resolves.toEqual({ status: 'RESOLVED', householdRef: HOUSEHOLD_A })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('fails closed for multiple households and malformed membership responses', async () => {
    const ambiguous = createSupabaseFamilyHouseholdAuthority({
      url: 'https://project.example.test', anonKey: 'anon-test-key',
      fetchImpl: vi.fn(async () => new Response(JSON.stringify([
        { household_id: HOUSEHOLD_A, academy_households: { status: 'active' } },
        { household_id: HOUSEHOLD_B, academy_households: { status: 'active' } },
      ]), { status: 200 })) as typeof fetch,
    })
    await expect(ambiguous.resolve(authorization())).resolves.toEqual({ status: 'AMBIGUOUS_HOUSEHOLD' })

    const malformed = createSupabaseFamilyHouseholdAuthority({
      url: 'https://project.example.test', anonKey: 'anon-test-key',
      fetchImpl: vi.fn(async () => new Response(JSON.stringify([{
        household_id: 'caller-forged', academy_households: { status: 'active' },
      }]), { status: 200 })) as typeof fetch,
    })
    await expect(malformed.resolve(authorization())).resolves.toEqual({ status: 'UNAVAILABLE' })
  })
})

describe('provider-managed Family Cloud account creation', () => {
  it('uses the staging origin Family Pilot return and reports email confirmation without retaining credentials', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://family-pilot-cloud-r1--manuel-academy.netlify.app' } })
    const signUp = vi.fn(async () => ({ data: { user: { id: USER_A }, session: null }, error: null }))
    const client = { auth: { signUp } } as unknown as SupabaseClient
    const adapter = createSupabaseFamilyCloudIdentity(client)

    await expect(adapter.signUp('new-parent@example.test', 'provider-owned-password')).resolves.toEqual({
      status: 'CONFIRM_EMAIL',
    })
    expect(signUp).toHaveBeenCalledWith({
      email: 'new-parent@example.test', password: 'provider-owned-password',
      options: { emailRedirectTo: 'https://family-pilot-cloud-r1--manuel-academy.netlify.app/family-pilot' },
    })
  })

  it('sends recovery and magic-link requests to explicit canonical application routes', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://family-pilot-cloud-r1--manuel-academy.netlify.app' } })
    const resetPasswordForEmail = vi.fn(async () => ({ data: {}, error: null }))
    const signInWithOtp = vi.fn(async () => ({ data: {}, error: null }))
    const client = { auth: { resetPasswordForEmail, signInWithOtp } } as unknown as SupabaseClient
    const adapter = createSupabaseFamilyCloudIdentity(client)

    await expect(adapter.requestPasswordRecovery('srkmanuel@gmail.com')).resolves.toBe('SENT')
    expect(resetPasswordForEmail).toHaveBeenCalledWith('srkmanuel@gmail.com', {
      redirectTo: 'https://family-pilot-cloud-r1--manuel-academy.netlify.app/family-pilot/reset-password',
    })
    await expect(adapter.requestMagicLink('srkmanuel@gmail.com')).resolves.toBe('SENT')
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'srkmanuel@gmail.com',
      options: {
        emailRedirectTo: 'https://family-pilot-cloud-r1--manuel-academy.netlify.app/family-pilot',
        shouldCreateUser: false,
      },
    })
  })

  it('passes the exact staging Parent email to signInWithPassword and accepts its verified session', async () => {
    const session = {
      access_token: 'header.payload.signature', expires_at: Math.floor(Date.now() / 1_000) + 3_600,
      user: { id: USER_A, email: 'srkmanuel@gmail.com' },
    }
    const signInWithPassword = vi.fn(async () => ({ data: { session }, error: null }))
    const client = { auth: {
      signInWithPassword,
      getSession: vi.fn(async () => ({ data: { session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: session.user }, error: null })),
    } } as unknown as SupabaseClient
    const adapter = createSupabaseFamilyCloudIdentity(client)
    await expect(adapter.signIn('srkmanuel@gmail.com', 'provider-owned-password')).resolves.toMatchObject({ status: 'SIGNED_IN' })
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'srkmanuel@gmail.com', password: 'provider-owned-password' })
  })

  it('requires canonical provider logout and verifies that the session is gone', async () => {
    const signOut = vi.fn(async () => ({ error: null }))
    const getSession = vi.fn(async () => ({ data: { session: null }, error: null }))
    const getUser = vi.fn(async () => ({ data: { user: null }, error: new Error('Auth session missing') }))
    const adapter = createSupabaseFamilyCloudIdentity({ auth: { signOut, getSession, getUser } } as unknown as SupabaseClient)
    await expect(adapter.signOut()).resolves.toBe('SIGNED_OUT')
    expect(signOut).toHaveBeenCalledWith({ scope: 'global' })
    expect(getSession).toHaveBeenCalledOnce()
    expect(getUser).toHaveBeenCalledOnce()
  })
})

describe('household-scoped Family Pilot storage', () => {
  it('cannot read or overwrite a sibling household storage namespace', () => {
    const storage = new MemoryStorage()
    const a = createHouseholdScopedStorage(storage, HOUSEHOLD_A)
    const b = createHouseholdScopedStorage(storage, HOUSEHOLD_B)
    a.setItem('app-state', 'household-a-private')
    b.setItem('app-state', 'household-b-private')
    expect(a.getItem('app-state')).toBe('household-a-private')
    expect(b.getItem('app-state')).toBe('household-b-private')
    a.removeItem('app-state')
    expect(b.getItem('app-state')).toBe('household-b-private')
  })
})
