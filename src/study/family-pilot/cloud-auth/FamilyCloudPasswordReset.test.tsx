import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js'
import {
  FamilyCloudPasswordReset,
  observeFamilyCloudRecoverySession,
  updateFamilyCloudPassword,
  validateFamilyCloudPassword,
} from './FamilyCloudPasswordReset'

const SESSION = {
  access_token: 'header.payload.signature',
  refresh_token: 'refresh-token',
  token_type: 'bearer',
  expires_in: 3_600,
  expires_at: Math.floor(Date.now() / 1_000) + 3_600,
  user: { id: '30000000-0000-4000-8000-000000000003', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '2026-08-15T00:00:00.000Z' },
} as Session

describe('Family Cloud password recovery', () => {
  it('validates mismatch without retaining or submitting either value', () => {
    expect(validateFamilyCloudPassword('long-enough-password', 'different-password')).toBe('MISMATCH')
    expect(validateFamilyCloudPassword('short', 'short')).toBe('TOO_SHORT')
    expect(validateFamilyCloudPassword('long-enough-password', 'long-enough-password')).toBe('VALID')
  })

  it('turns the canonical PASSWORD_RECOVERY event into a verified reset session', async () => {
    let listener: ((event: AuthChangeEvent, session: Session | null) => void) | undefined
    let resolveSession: ((value: { data: { session: Session | null }; error: null }) => void) | undefined
    const getSession = vi.fn(() => new Promise<{ data: { session: Session | null }; error: null }>((resolve) => { resolveSession = resolve }))
    const unsubscribe = vi.fn()
    const client = { auth: {
      onAuthStateChange: vi.fn((callback: typeof listener) => {
        listener = callback
        return { data: { subscription: { unsubscribe } } }
      }),
      getSession,
      getUser: vi.fn(async () => ({ data: { user: SESSION.user }, error: null })),
    } } as unknown as SupabaseClient
    const updates: string[] = []
    const stop = observeFamilyCloudRecoverySession(client, (status) => updates.push(status))
    expect(listener).toBeTypeOf('function')
    listener?.('PASSWORD_RECOVERY', SESSION)
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(updates).toContain('READY')
    resolveSession?.({ data: { session: SESSION }, error: null })
    stop()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('submits the new password only to authenticated updateUser', async () => {
    const updateUser = vi.fn(async () => ({ data: { user: SESSION.user }, error: null }))
    const getSession = vi.fn(async () => ({ data: { session: SESSION }, error: null }))
    const getUser = vi.fn(async () => ({ data: { user: SESSION.user }, error: null }))
    const client = { auth: { updateUser, getSession, getUser } } as unknown as SupabaseClient
    await expect(updateFamilyCloudPassword(client, 'provider-owned-password')).resolves.toBe(true)
    expect(updateUser).toHaveBeenCalledWith({ password: 'provider-owned-password' })
    expect(getSession).toHaveBeenCalledTimes(2)
    expect(getUser).toHaveBeenCalledOnce()
  })

  it('shows an expired/invalid message and a safe reset-request path without a session', () => {
    const html = renderToStaticMarkup(<FamilyCloudPasswordReset client={null} />)
    expect(html).toContain('This reset link is invalid or has expired')
    expect(html).toContain('Request another reset')
    expect(html).not.toContain('New password')
  })
})
