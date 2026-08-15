import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  FAMILY_CLOUD_FORBIDDEN_PRODUCTION_REF,
  FAMILY_CLOUD_STAGING_PROJECT_REF,
  resolveFamilyCloudBrowserConfigurationR1,
} from './browserConfiguration'
import {
  createSupabaseFamilyCloudRemoteDirectory,
  createSupabaseHostedSyncAuthorization,
  createSupabaseHostedSyncRpcProvider,
} from './browserTransport'
import { createFamilyCloudBrowserRuntimeR1 } from './browserRuntime'

afterEach(() => { vi.unstubAllGlobals() })

const STAGING_URL = `https://${FAMILY_CLOUD_STAGING_PROJECT_REF}.supabase.co`
const USER = '00000000-0000-4000-8000-000000000101'
const SESSION = {
  access_token: 'header.payload.signature',
  expires_at: Math.floor(Date.now() / 1_000) + 3_600,
  user: { id: USER, email: 'parent@example.test' },
}

function client(options: { accessToken?: string; rpc?: ReturnType<typeof vi.fn> } = {}) {
  const session = { ...SESSION, access_token: options.accessToken ?? SESSION.access_token }
  return {
    auth: {
      getSession: vi.fn(async () => ({ data: { session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: session.user }, error: null })),
    },
    rpc: options.rpc ?? vi.fn(() => ({
      abortSignal: vi.fn(async () => ({ data: { schemaVersion: 2, status: 'unavailable' }, error: null })),
      then: undefined,
    })),
  } as unknown as SupabaseClient
}

describe('real Family Pilot browser cloud composition', () => {
  it('is inert by default and rejects missing, malformed, and production configuration', () => {
    expect(resolveFamilyCloudBrowserConfigurationR1({})).toEqual({
      enabled: false, url: '', anonKey: '', projectRef: null, reason: 'FEATURE_DISABLED',
    })
    expect(resolveFamilyCloudBrowserConfigurationR1({
      VITE_FAMILY_PILOT_HOSTED_SYNC_ENABLED: 'true',
    }).reason).toBe('CONFIGURATION_MISSING')
    expect(resolveFamilyCloudBrowserConfigurationR1({
      VITE_FAMILY_PILOT_HOSTED_SYNC_ENABLED: 'true',
      VITE_SUPABASE_URL: `https://${FAMILY_CLOUD_FORBIDDEN_PRODUCTION_REF}.supabase.co`,
      VITE_SUPABASE_ANON_KEY: 'public-test-key',
    })).toMatchObject({ enabled: false, reason: 'TARGET_REFUSED', projectRef: FAMILY_CLOUD_FORBIDDEN_PRODUCTION_REF })
    expect(resolveFamilyCloudBrowserConfigurationR1({
      VITE_FAMILY_PILOT_HOSTED_SYNC_ENABLED: 'true',
      VITE_SUPABASE_URL: STAGING_URL,
      VITE_SUPABASE_ANON_KEY: 'sb_secret_forbidden-browser-key',
    })).toMatchObject({ enabled: false, reason: 'BROWSER_KEY_REFUSED', anonKey: '' })
    expect(resolveFamilyCloudBrowserConfigurationR1({
      VITE_FAMILY_PILOT_HOSTED_SYNC_ENABLED: 'true',
      VITE_SUPABASE_URL: STAGING_URL,
      VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature',
    })).toMatchObject({ enabled: false, reason: 'BROWSER_KEY_REFUSED', anonKey: '' })
  })

  it('accepts only the existing exact flag plus the authorized staging public configuration', () => {
    const configuration = resolveFamilyCloudBrowserConfigurationR1({
      VITE_FAMILY_PILOT_HOSTED_SYNC_ENABLED: 'true',
      VITE_SUPABASE_URL: STAGING_URL,
      VITE_SUPABASE_ANON_KEY: 'public-test-key',
    })
    expect(configuration).toEqual({
      enabled: true, url: STAGING_URL, anonKey: 'public-test-key',
      projectRef: FAMILY_CLOUD_STAGING_PROJECT_REF, reason: 'ENABLED_STAGING',
    })
    const storage = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value) },
      removeItem: (key: string) => { storage.delete(key) },
    } })
    const composition = createFamilyCloudBrowserRuntimeR1(configuration)
    expect(composition.auth.snapshot()).toMatchObject({ status: 'SIGNED_OUT' })
    expect(storage.get('manuel-academy.family-cloud.device-ref.r1')).toMatch(/^device:/)
    expect(JSON.stringify([...storage.entries()])).not.toMatch(/public-test-key|service.role|header\.payload/i)
  })

  it('pins RPC dispatch to the current verified provider identity and token', async () => {
    const rpc = vi.fn(() => ({ abortSignal: vi.fn(async () => ({ data: { ok: true }, error: null })) }))
    const supabase = client({ rpc })
    const provider = createSupabaseHostedSyncRpcProvider(supabase, USER, SESSION.access_token)
    await expect(provider.rpc('academy_study_sync_hydrate_v2', {})).resolves.toEqual({ data: { ok: true }, error: null })
    expect(rpc).toHaveBeenCalledWith('academy_study_sync_hydrate_v2', {})

    ;(supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { session: { ...SESSION, access_token: 'new.header.signature' } }, error: null,
    })
    await expect(provider.rpc('academy_study_sync_hydrate_v2', {})).resolves.toMatchObject({
      data: null, error: { code: 'SESSION_EXPIRED' },
    })
    expect(rpc).toHaveBeenCalledOnce()
  })

  it('returns a releasable authenticated lease and denies it after release', async () => {
    const supabase = client()
    const authorization = createSupabaseHostedSyncAuthorization(supabase)
    const result = await authorization.acquire()
    expect(result.status).toBe('AUTHORIZED')
    if (result.status !== 'AUTHORIZED') return
    result.lease.release?.()
    await expect(result.lease.provider.rpc('academy_study_sync_hydrate_v2', {})).resolves.toMatchObject({
      data: null, error: { code: 'ABORTED' },
    })
  })

  it('sends only local learner descriptors to the narrow onboarding RPC', async () => {
    const rpc = vi.fn((..._args: unknown[]) => ({ abortSignal: vi.fn(async () => ({
      data: {
        schemaVersion: 1,
        status: 'ready',
        householdRef: '00000000-0000-4000-8000-000000000201',
        learners: [{
          learnerRef: 'student:ada',
          hostedStudentId: '00000000-0000-4000-8000-000000000301',
          tokenDigest: 'a'.repeat(64),
          hostedAssignmentRef: 'family-cloud:learner-authority',
          hostedSessionRef: 'family-cloud:session:student:ada',
        }],
      },
      error: null,
    })) }))
    const supabase = client({ rpc })
    const directory = createSupabaseFamilyCloudRemoteDirectory({
      client: supabase,
      localLearners: () => [{ learnerRef: 'student:ada', displayName: 'Ada', gradeLevel: '4' }],
    })
    await expect(directory.resolve({
      householdRef: '00000000-0000-4000-8000-000000000201',
      authorization: {
        kind: 'supabase-access-token', verifiedAt: Date.now(),
        user: SESSION.user, accessToken: SESSION.access_token,
      },
    })).resolves.toMatchObject({ status: 'READY', learners: [{ learnerRef: 'student:ada' }] })
    expect(rpc).toHaveBeenCalledWith('academy_family_cloud_bootstrap_r1', {
      p_local_learners: [{ learnerRef: 'student:ada', displayName: 'Ada', gradeLevel: '4' }],
    })
    expect(JSON.stringify(rpc.mock.calls[0]?.[1])).not.toMatch(/token|password|userId|householdRef|role/i)
  })

  it('wires the real application roots through the guarded cloud composition', () => {
    const root = readFileSync(new URL('../../../App.tsx', import.meta.url), 'utf8')
    const dedicatedRoot = readFileSync(new URL('../web/FamilyPilotWebApp.tsx', import.meta.url), 'utf8')
    const cloudRoot = readFileSync(new URL('./FamilyPilotCloudRoot.tsx', import.meta.url), 'utf8')
    for (const source of [root, dedicatedRoot]) {
      expect(source).toContain('isFamilyCloudBrowserEnabledFromHost()')
      expect(source).toContain('familyCloudAuth={auth}')
    }
    expect(cloudRoot).toContain('children(composition.auth)')
    expect(cloudRoot).toContain('createFamilyCloudBrowserRuntimeR1')
  })
})
