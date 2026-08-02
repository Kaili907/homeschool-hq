import { describe, expect, it, vi } from 'vitest'
import { createGatewayAccess, dailyLimit } from '../../netlify/functions/_shared/gateway-access.js'

function membershipClient(result) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    abortSignal: vi.fn(async () => result),
  }
  return { client: { from: vi.fn(() => builder) }, builder }
}

describe('gateway service-role access', () => {
  it('queries only an active, non-revoked membership for the verified user id', async () => {
    const { client, builder } = membershipClient({ data: [{ id: 'membership-id' }], error: null })
    const access = createGatewayAccess({ client })
    await expect(access.requireEntitlement('verified-user-id')).resolves.toBeUndefined()
    expect(client.from).toHaveBeenCalledWith('academy_household_memberships')
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'user_id', 'verified-user-id')
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'status', 'active')
    expect(builder.is).toHaveBeenCalledWith('revoked_at', null)
    expect(builder.limit).toHaveBeenCalledWith(1)
  })

  it('fails closed when the verified user has no current membership', async () => {
    const { client } = membershipClient({ data: [], error: null })
    const access = createGatewayAccess({ client })
    await expect(access.requireEntitlement('verified-user-id')).rejects.toMatchObject({
      statusCode: 403,
      code: 'not_entitled',
    })
  })

  it('calls the atomic usage RPC and rejects a false reservation', async () => {
    const rpcBuilder = {
      abortSignal: vi.fn(async () => ({ data: false, error: null })),
    }
    const client = { rpc: vi.fn(() => rpcBuilder) }
    const access = createGatewayAccess({ client })
    await expect(access.consumeUsage('verified-user-id', 'anthropic', 50)).rejects.toMatchObject({
      statusCode: 429,
      code: 'usage_limit',
    })
    expect(client.rpc).toHaveBeenCalledWith('academy_consume_gateway_usage', {
      p_user_id: 'verified-user-id',
      p_endpoint: 'anthropic',
      p_limit: 50,
    })
  })

  it('uses safe defaults for absent, malformed, zero, or excessive limits', () => {
    expect(dailyLimit({}, 'LIMIT', 50)).toBe(50)
    expect(dailyLimit({ LIMIT: 'nope' }, 'LIMIT', 50)).toBe(50)
    expect(dailyLimit({ LIMIT: '0' }, 'LIMIT', 50)).toBe(50)
    expect(dailyLimit({ LIMIT: '100001' }, 'LIMIT', 50)).toBe(50)
    expect(dailyLimit({ LIMIT: '75' }, 'LIMIT', 50)).toBe(75)
  })
})
