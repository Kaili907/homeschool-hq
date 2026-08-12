import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { defaultAppState } from '../migration'
import { toWireProfile } from '../portableProfile'
import {
  getVerifiedAuthContext,
  pushProfiles,
  verifyPinnedAuthContext,
  type VerifiedAuthContext,
} from './supabase'
import type { RemoteProfileRow } from './types'

const ACCESS_TOKEN = 'header.payload.signature'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function rows(): RemoteProfileRow[] {
  const profile = defaultAppState().profiles.p1
  return [
    {
      profile_id: profile.id,
      data: toWireProfile(profile),
      updated_at: '2026-07-25T12:00:00.000Z',
    },
  ]
}

async function verifiedContext(
  userId = 'household-a',
): Promise<VerifiedAuthContext> {
  const context = await getVerifiedAuthContext({
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: ACCESS_TOKEN } },
        error: null,
      })),
      getUser: vi.fn(async (token: string) => ({
        data: {
          user: token === ACCESS_TOKEN ? { id: userId, email: 'a@example.com' } : null,
        },
        error: token === ACCESS_TOKEN ? null : new Error('invalid'),
      })),
    },
  } as never)
  if (!context) throw new Error('Test auth context was not verified.')
  return context
}

function canonicalVerificationClient(userId = 'household-a') {
  return {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: 'refreshed.header.signature',
            user: { id: userId },
          },
        },
        error: null,
      })),
      getUser: vi.fn(async () => ({
        data: { user: { id: userId } },
        error: null,
      })),
    },
  }
}

function successfulWriter(result: unknown = { status: 'applied', revision: '1' }) {
  const rpc = vi.fn(
    async (_name: string, _arguments: Record<string, unknown>) => ({
      data: result,
      error: null,
    }),
  )
  const factory = vi.fn(() => ({
    rpc,
  }))
  return { factory, rpc }
}

describe('fixed-token low-level cloud writes', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-public-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('refuses missing, arbitrary, and refresh-token values without a write', async () => {
    const verificationClient = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'household-a' } },
          error: null,
        })),
      },
    }
    for (const candidate of [
      '',
      'arbitrary-token',
      'supabase-refresh-token-value',
      {
        kind: 'supabase-access-token',
        accessToken: 'not-a-jwt',
        verifiedAt: Date.now(),
        user: { id: 'household-a', email: 'a@example.com' },
      },
    ]) {
      const writer = successfulWriter()
      await expect(
        pushProfiles(
          rows(),
          '0',
          'mutation-a',
          candidate,
          'household-a',
          () => true,
          undefined,
          verificationClient as never,
          writer.factory as never,
        ),
      ).resolves.toMatchObject({ ok: false })
      expect(writer.factory).not.toHaveBeenCalled()
    }
  })

  it('rejects a token verified for another household', async () => {
    const context = await verifiedContext('household-b')
    const writer = successfulWriter()
    await expect(
      pushProfiles(
        rows(),
        '0',
        'mutation-a',
        context,
        'household-a',
        () => true,
        undefined,
        {
          ...canonicalVerificationClient('household-b'),
        } as never,
        writer.factory as never,
      ),
    ).resolves.toMatchObject({ ok: false })
    expect(writer.factory).not.toHaveBeenCalled()
  })

  it('fails safely when the pinned access token is expired', async () => {
    const context = await verifiedContext()
    const writer = successfulWriter()
    await expect(
      pushProfiles(
        rows(),
        '0',
        'mutation-a',
        context,
        'household-a',
        () => true,
        undefined,
        {
          auth: {
            getSession: vi.fn(async () => ({
              data: {
                session: {
                  access_token: ACCESS_TOKEN,
                  user: { id: 'household-a' },
                },
              },
              error: null,
            })),
            getUser: vi.fn(async () => ({
              data: { user: null },
              error: new Error('expired'),
            })),
          },
        } as never,
        writer.factory as never,
      ),
    ).resolves.toMatchObject({ ok: false })
    expect(writer.factory).not.toHaveBeenCalled()
  })

  it('blocks an account switch after token verification but before dispatch', async () => {
    const context = await verifiedContext()
    const writer = successfulWriter()
    let currentHousehold: string | null = 'household-a'
    const verificationClient = {
      auth: {
        getSession: vi.fn(async () => ({
          data: {
            session: {
              access_token: ACCESS_TOKEN,
              user: { id: 'household-a' },
            },
          },
          error: null,
        })),
        getUser: vi.fn(async () => {
          currentHousehold = 'household-b'
          return {
            data: { user: { id: 'household-a' } },
            error: null,
          }
        }),
      },
    }
    await expect(
      pushProfiles(
        rows(),
        '0',
        'mutation-a',
        context,
        'household-a',
        () => currentHousehold === 'household-a',
        undefined,
        verificationClient as never,
        writer.factory as never,
      ),
    ).resolves.toEqual({
      ok: false,
      error: 'The household session changed before cloud write dispatch.',
    })
    expect(writer.factory).not.toHaveBeenCalled()
  })

  it.each([
    'lease expiry',
    'lease takeover',
    'heartbeat loss',
    'operation abort',
    'component unmount',
    'account change',
    'persisted fingerprint change',
    'memory fingerprint change',
    'provenance change',
    'import epoch change',
    'transition replacement',
    'household binding change',
  ])('re-runs the complete synchronous dispatch guard after paused auth: %s', async () => {
    const context = await verifiedContext()
    const writer = successfulWriter()
    const auth = deferred<void>()
    let authorized = true
    const verificationClient = canonicalVerificationClient()
    verificationClient.auth.getUser.mockImplementation(async () => {
      await auth.promise
      return { data: { user: { id: 'household-a' } }, error: null }
    })
    verificationClient.auth.getSession.mockImplementation(async () => {
      await auth.promise
      return {
        data: {
          session: {
            access_token: 'refreshed.header.signature',
            user: { id: 'household-a' },
          },
        },
        error: null,
      }
    })
    const pending = pushProfiles(
      rows(),
      '0',
      'mutation-paused-auth',
      context,
      'household-a',
      () => authorized,
      undefined,
      verificationClient as never,
      writer.factory as never,
    )
    authorized = false
    auth.resolve(undefined)

    await expect(pending).resolves.toMatchObject({ ok: false })
    expect(writer.factory).not.toHaveBeenCalled()
    expect(writer.rpc).not.toHaveBeenCalled()
  })

  it('uses only the exact verified access token and never reads a global session', async () => {
    const context = await verifiedContext()
    const writer = successfulWriter()
    const getUser = vi.fn(async (token?: string) => ({
      data: { user: { id: 'household-a' } },
      error:
        token === undefined || token === ACCESS_TOKEN
          ? null
          : new Error('wrong token'),
    }))

    await expect(
      pushProfiles(
        rows(),
        '0',
        'mutation-a',
        context,
        'household-a',
        () => true,
        undefined,
        {
          auth: {
            getUser,
            getSession: vi.fn(async () => ({
              data: {
                session: {
                  access_token: 'refreshed.header.signature',
                  user: { id: 'household-a' },
                },
              },
              error: null,
            })),
          },
        } as never,
        writer.factory as never,
      ),
    ).resolves.toEqual({ ok: true, revision: '1' })
    expect(getUser).toHaveBeenCalledWith(ACCESS_TOKEN)
    expect(writer.factory).toHaveBeenCalledWith(
      ACCESS_TOKEN,
      expect.any(Function),
    )
    expect(writer.rpc).toHaveBeenCalledOnce()
    expect(writer.rpc).toHaveBeenCalledWith(
      'academy_apply_profile_mutation',
      expect.objectContaining({
        p_expected_revision: '0',
        p_mutation_id: 'mutation-a',
        p_profiles: expect.any(Array),
      }),
    )
    expect(writer.rpc.mock.calls[0][1]).not.toHaveProperty('household_id')
  })

  it('returns a typed CAS conflict and never disguises it as upload success', async () => {
    const context = await verifiedContext()
    const writer = successfulWriter({ status: 'conflict', revision: '7' })
    await expect(
      pushProfiles(
        rows(),
        '6',
        'mutation-conflict',
        context,
        'household-a',
        () => true,
        undefined,
        canonicalVerificationClient() as never,
        writer.factory as never,
      ),
    ).resolves.toEqual({
      ok: false,
      conflict: true,
      revision: '7',
      error:
        'Another device updated this household first. Review the refreshed cloud data.',
    })
    expect(writer.rpc).toHaveBeenCalledOnce()
  })

  it('recognizes a server idempotency receipt as the same successful logical mutation', async () => {
    const context = await verifiedContext()
    const writer = successfulWriter({ status: 'replayed', revision: '7' })
    await expect(
      pushProfiles(
        rows(),
        '6',
        'mutation-retry',
        context,
        'household-a',
        () => true,
        undefined,
        canonicalVerificationClient() as never,
        writer.factory as never,
      ),
    ).resolves.toEqual({ ok: true, revision: '7', replayed: true })
  })

  it('does not include token values in returned errors or console output', async () => {
    const context = await verifiedContext()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const writer = successfulWriter()
    const result = await pushProfiles(
      rows(),
      '0',
      'mutation-a',
      context,
      'household-a',
      () => true,
      undefined,
      {
        auth: {
          getSession: vi.fn(async () => ({
            data: {
              session: {
                access_token: ACCESS_TOKEN,
                user: { id: 'household-a' },
              },
            },
            error: null,
          })),
          getUser: vi.fn(async () => ({
            data: { user: null },
            error: new Error(`expired ${ACCESS_TOKEN}`),
          })),
        },
      } as never,
      writer.factory as never,
    )

    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN)
    expect(consoleError).not.toHaveBeenCalled()

    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: `provider echoed ${ACCESS_TOKEN}` },
    }))
    const writeError = await pushProfiles(
      rows(),
      '0',
      'mutation-b',
      context,
      'household-a',
      () => true,
      undefined,
      {
        auth: {
          getSession: vi.fn(async () => ({
            data: {
              session: {
                access_token: ACCESS_TOKEN,
                user: { id: 'household-a' },
              },
            },
            error: null,
          })),
          getUser: vi.fn(async () => ({
            data: { user: { id: 'household-a' } },
            error: null,
          })),
        },
      } as never,
      (() => ({ rpc })) as never,
    )
    expect(JSON.stringify(writeError)).not.toContain(ACCESS_TOKEN)
    expect(JSON.stringify(writeError)).toContain('[redacted]')
  })
})

describe('real Supabase SDK mutation fetch boundary', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-public-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  function actualSdkFactory(tokenGate?: ReturnType<typeof deferred<void>>) {
    return vi.fn((accessToken: string, guardedFetch: typeof fetch) =>
      createClient('https://example.supabase.co', 'anon-public-key', {
        accessToken: async () => {
          if (tokenGate) await tokenGate.promise
          return accessToken
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: { fetch: guardedFetch },
      }),
    )
  }

  function appliedResponse() {
    return new Response(JSON.stringify({ status: 'applied', revision: '1' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  it('reaches the native fetch exactly once for a valid operation', async () => {
    const context = await verifiedContext()
    const nativeFetch = vi.fn(async () => appliedResponse())
    const factory = actualSdkFactory()

    await expect(
      pushProfiles(
        rows(),
        '0',
        'real-sdk-valid',
        context,
        'household-a',
        () => true,
        undefined,
        canonicalVerificationClient() as never,
        factory,
        nativeFetch,
      ),
    ).resolves.toEqual({ ok: true, revision: '1' })
    expect(nativeFetch).toHaveBeenCalledOnce()
  })

  it.each([
    'lease expiry',
    'lease ownership change',
    'heartbeat loss',
    'persisted data change',
    'memory fingerprint change',
    'provenance change',
    'import epoch change',
    'transition replacement',
    'household binding change',
    'component unmount',
    'operation supersession',
    'canonical household change',
    'canonical session removal',
  ])(
    'denies native fetch when %s occurs during SDK token preparation',
    async () => {
      const context = await verifiedContext()
      const tokenGate = deferred<void>()
      let authorized = true
      const nativeFetch = vi.fn(async () => appliedResponse())
      const factory = actualSdkFactory(tokenGate)
      const pending = pushProfiles(
        rows(),
        '0',
        'real-sdk-denied',
        context,
        'household-a',
        () => authorized,
        undefined,
        canonicalVerificationClient() as never,
        factory,
        nativeFetch,
      )
      await vi.waitFor(() => expect(factory).toHaveBeenCalledOnce())
      authorized = false
      tokenGate.resolve(undefined)

      await expect(pending).resolves.toEqual({
        ok: false,
        error: 'The household authorization changed at mutation dispatch.',
      })
      expect(nativeFetch).not.toHaveBeenCalled()
    },
  )

  it('combines operation abort with the SDK request signal and denies dispatch', async () => {
    const context = await verifiedContext()
    const tokenGate = deferred<void>()
    const controller = new AbortController()
    const nativeFetch = vi.fn(async () => appliedResponse())
    const factory = actualSdkFactory(tokenGate)
    const pending = pushProfiles(
      rows(),
      '0',
      'real-sdk-abort',
      context,
      'household-a',
      () => true,
      controller.signal,
      canonicalVerificationClient() as never,
      factory,
      nativeFetch,
    )
    await vi.waitFor(() => expect(factory).toHaveBeenCalledOnce())
    controller.abort()
    tokenGate.resolve(undefined)

    await expect(pending).resolves.toMatchObject({ ok: false })
    expect(nativeFetch).not.toHaveBeenCalled()
  })

  it('allows a same-household refresh while the operation remains authorized', async () => {
    const context = await verifiedContext()
    const tokenGate = deferred<void>()
    const nativeFetch = vi.fn(async () => appliedResponse())
    const factory = actualSdkFactory(tokenGate)
    const pending = pushProfiles(
      rows(),
      '0',
      'real-sdk-refresh',
      context,
      'household-a',
      () => true,
      undefined,
      canonicalVerificationClient('household-a') as never,
      factory,
      nativeFetch,
    )
    await vi.waitFor(() => expect(factory).toHaveBeenCalledOnce())
    tokenGate.resolve(undefined)

    await expect(pending).resolves.toEqual({ ok: true, revision: '1' })
    expect(nativeFetch).toHaveBeenCalledOnce()
  })

  it.each([
    ['another household', 'household-b'],
    ['no canonical session', null],
  ])(
    'denies the real fetch when canonical auth becomes %s during SDK preparation',
    async (_label, nextHousehold) => {
      const context = await verifiedContext()
      const tokenGate = deferred<void>()
      let currentHousehold: string | null = 'household-a'
      const verificationClient = {
        auth: {
          getSession: vi.fn(async () => ({
            data: {
              session: currentHousehold
                ? {
                    access_token: 'refreshed.header.signature',
                    user: { id: currentHousehold },
                  }
                : null,
            },
            error: null,
          })),
          getUser: vi.fn(async (token?: string) => ({
            data: {
              user:
                token === ACCESS_TOKEN
                  ? { id: 'household-a' }
                  : currentHousehold
                    ? { id: currentHousehold }
                    : null,
            },
            error: null,
          })),
        },
      }
      const nativeFetch = vi.fn(async () => appliedResponse())
      const factory = actualSdkFactory(tokenGate)
      const pending = pushProfiles(
        rows(),
        '0',
        'real-sdk-canonical-change',
        context,
        'household-a',
        () => true,
        undefined,
        verificationClient as never,
        factory,
        nativeFetch,
      )
      await vi.waitFor(() => expect(factory).toHaveBeenCalledOnce())
      currentHousehold = nextHousehold
      tokenGate.resolve(undefined)

      await expect(pending).resolves.toEqual({
        ok: false,
        error: 'The household authorization changed at mutation dispatch.',
      })
      expect(nativeFetch).not.toHaveBeenCalled()
    },
  )
})

describe('bounded canonical and pinned authorization', () => {
  it('times out a never-resolving authorization and ignores its late result', async () => {
    const late = deferred<{
      data: { session: { access_token: string } | null }
      error: null
    }>()
    const client = {
      auth: {
        getSession: vi.fn(() => late.promise),
        getUser: vi.fn(),
      },
    }
    await expect(
      getVerifiedAuthContext(client as never, undefined, 5),
    ).resolves.toBeNull()
    late.resolve({
      data: { session: { access_token: ACCESS_TOKEN } },
      error: null,
    })
    await Promise.resolve()
    expect(client.auth.getUser).not.toHaveBeenCalled()
  })

  it('stops waiting when the operation aborts', async () => {
    const never = new Promise<never>(() => undefined)
    const controller = new AbortController()
    const pending = getVerifiedAuthContext(
      {
        auth: {
          getSession: vi.fn(() => never),
          getUser: vi.fn(),
        },
      } as never,
      controller.signal,
      60_000,
    )
    controller.abort()
    await expect(pending).resolves.toBeNull()
  })

  it('permits same-household token refresh without requiring token-string equality', async () => {
    const context = await verifiedContext()
    await expect(
      verifyPinnedAuthContext(
        context,
        'household-a',
        canonicalVerificationClient('household-a') as never,
      ),
    ).resolves.toBe(true)
  })

  it.each([
    ['another current household', 'household-b'],
    ['a null canonical session', null],
  ])('rejects an old valid pinned token when canonical auth becomes %s', async (_label, current) => {
    const context = await verifiedContext()
    const client = canonicalVerificationClient(current ?? 'household-a')
    if (current === null) {
      client.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      } as never)
      client.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never)
    }
    await expect(
      verifyPinnedAuthContext(
        context,
        'household-a',
        client as never,
      ),
    ).resolves.toBe(false)
  })
})
