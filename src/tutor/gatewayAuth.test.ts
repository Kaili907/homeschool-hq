import { describe, expect, it } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { getGatewayAccessTokenWith } from './gatewayAuth'

const stored = (token = 'OLD_TOKEN'): Session => ({
  access_token: token,
  token_type: 'bearer',
  expires_in: 60 * 60,
  refresh_token: 'REFRESH_TOKEN',
  expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
  user: {
    id: 'household-user',
    email: 'dad@example.test',
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  },
})

describe('gateway access-token seam', () => {
  it('fails closed when there is no signed-in Supabase session', async () => {
    const result = await getGatewayAccessTokenWith({
      getSession: async () => null,
    })
    expect(result).toBe(null)
  })

  it('returns a current access token without rotating the sync session', async () => {
    const session = stored()
    const result = await getGatewayAccessTokenWith({
      getSession: async () => session,
      now: () => (session.expires_at ?? 0) * 1000 - 1,
    })
    expect(result).toBe('OLD_TOKEN')
  })

  it('fails closed for an expired stored access token', async () => {
    const session = stored()
    const result = await getGatewayAccessTokenWith({
      getSession: async () => session,
      now: () => (session.expires_at ?? 0) * 1000,
    })
    expect(result).toBe(null)
  })

  it('fails closed for malformed expiry metadata', async () => {
    const session = stored()
    session.expires_at = Number.NaN
    const result = await getGatewayAccessTokenWith({
      getSession: async () => session,
    })
    expect(result).toBe(null)
  })
})
