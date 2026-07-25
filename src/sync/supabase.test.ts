import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultAppState } from '../migration'
import {
  getVerifiedAuthContext,
  pushProfiles,
  type VerifiedAuthContext,
} from './supabase'
import type { RemoteProfileRow } from './types'

const ACCESS_TOKEN = 'header.payload.signature'

function rows(): RemoteProfileRow[] {
  const profile = defaultAppState().profiles.p1
  return [
    {
      profile_id: profile.id,
      data: profile,
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

function successfulWriter() {
  const upsert = vi.fn(async () => ({ error: null }))
  const factory = vi.fn(() => ({
    from: vi.fn(() => ({ upsert })),
  }))
  return { factory, upsert }
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
        context,
        'household-a',
        () => true,
        undefined,
        {
          auth: {
            getUser: vi.fn(async () => ({
              data: { user: { id: 'household-b' } },
              error: null,
            })),
          },
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
        context,
        'household-a',
        () => true,
        undefined,
        {
          auth: {
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

  it('uses only the exact verified access token and never reads a global session', async () => {
    const context = await verifiedContext()
    const writer = successfulWriter()
    const getUser = vi.fn(async (token: string) => ({
      data: { user: { id: 'household-a' } },
      error: token === ACCESS_TOKEN ? null : new Error('wrong token'),
    }))

    await expect(
      pushProfiles(
        rows(),
        context,
        'household-a',
        () => true,
        undefined,
        { auth: { getUser } } as never,
        writer.factory as never,
      ),
    ).resolves.toEqual({ ok: true })
    expect(getUser).toHaveBeenCalledWith(ACCESS_TOKEN)
    expect(writer.factory).toHaveBeenCalledWith(ACCESS_TOKEN)
    expect(writer.upsert).toHaveBeenCalledOnce()
  })

  it('does not include token values in returned errors or console output', async () => {
    const context = await verifiedContext()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const writer = successfulWriter()
    const result = await pushProfiles(
      rows(),
      context,
      'household-a',
      () => true,
      undefined,
      {
        auth: {
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

    const upsert = vi.fn(async () => ({
      error: { message: `provider echoed ${ACCESS_TOKEN}` },
    }))
    const writeError = await pushProfiles(
      rows(),
      context,
      'household-a',
      () => true,
      undefined,
      {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: 'household-a' } },
            error: null,
          })),
        },
      } as never,
      (() => ({ from: () => ({ upsert }) })) as never,
    )
    expect(JSON.stringify(writeError)).not.toContain(ACCESS_TOKEN)
    expect(JSON.stringify(writeError)).toContain('[redacted]')
  })
})
