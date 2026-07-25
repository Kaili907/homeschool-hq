import { describe, expect, it } from 'vitest'
import type { StoredSession } from '../sync/config'
import { getGatewayAccessTokenWith } from './gatewayAuth'

const stored = (token = 'OLD_TOKEN'): StoredSession => ({
  access_token: token,
  refresh_token: 'REFRESH_TOKEN',
  expires_at: Date.now() + 60 * 60 * 1000,
  user: { id: 'household-user', email: 'dad@example.test' },
})

describe('gateway access-token seam', () => {
  it('fails closed when there is no signed-in Supabase session', async () => {
    const result = await getGatewayAccessTokenWith({
      getSession: () => null,
    })
    expect(result).toBe(null)
  })

  it('returns a current access token without rotating the sync session', async () => {
    const session = stored()
    const result = await getGatewayAccessTokenWith({
      getSession: () => session,
      now: () => session.expires_at - 1,
    })
    expect(result).toBe('OLD_TOKEN')
  })

  it('fails closed for an expired stored access token', async () => {
    const session = stored()
    const result = await getGatewayAccessTokenWith({
      getSession: () => session,
      now: () => session.expires_at,
    })
    expect(result).toBe(null)
  })

  it('fails closed for malformed expiry metadata', async () => {
    const session = stored()
    session.expires_at = Number.NaN
    const result = await getGatewayAccessTokenWith({
      getSession: () => session,
    })
    expect(result).toBe(null)
  })
})
