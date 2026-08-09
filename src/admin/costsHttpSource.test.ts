import { describe, expect, it, vi } from 'vitest'
import { costsModelFixture } from './costsTestFixtures'
import { AdminCostsReadError, readAdminCosts } from './costsHttpSource'

describe('authorized Admin costs browser reader', () => {
  it('sends only the bearer and bounded range to the server endpoint', async () => {
    const fetchImpl = vi.fn(async (_input: string, _init: RequestInit) => ({ status: 200, json: async () => costsModelFixture() }))
    await expect(readAdminCosts(
      { kind: 'preset', preset: 'today' },
      { getAccessToken: async () => 'verified-token', fetchImpl },
    )).resolves.toMatchObject({ contractVersion: 2, currency: 'USD' })
    expect(fetchImpl).toHaveBeenCalledWith('/api/admin/v1/costs?range=today', {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: 'Bearer verified-token' },
      credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: expect.any(AbortSignal),
    })
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toContain('role')
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toContain('capabilities')
  })

  it('encodes a valid custom range and maps malformed or failed responses to bounded codes', async () => {
    const fetchImpl = vi.fn(async (_input: string, _init: RequestInit) => ({ status: 200, json: async () => costsModelFixture() }))
    await readAdminCosts(
      { kind: 'custom', start: '2026-08-01', end: '2026-08-08' },
      { getAccessToken: async () => 'verified-token', fetchImpl },
    )
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/admin/v1/costs?range=custom&start=2026-08-01&end=2026-08-08')

    await expect(readAdminCosts(
      { kind: 'preset', preset: 'today' },
      { getAccessToken: async () => 'verified-token', fetchImpl: async () => ({ status: 200, json: async () => ({ rawError: 'SECRET' }) }) },
    )).rejects.toMatchObject({ code: 'costs_unavailable' })
    await expect(readAdminCosts(
      { kind: 'preset', preset: 'today' },
      { getAccessToken: async () => 'verified-token', fetchImpl: async () => ({ status: 400, json: async () => ({}) }) },
    )).rejects.toEqual(expect.any(AdminCostsReadError))
  })

  it('does not contact the endpoint without an access token', async () => {
    const fetchImpl = vi.fn()
    await expect(readAdminCosts(
      { kind: 'preset', preset: 'today' },
      { getAccessToken: async () => null, fetchImpl },
    )).rejects.toMatchObject({ code: 'costs_unauthorized' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([401, 403])('returns a distinct fail-closed authorization result for HTTP %s', async (status) => {
    await expect(readAdminCosts(
      { kind: 'preset', preset: 'today' },
      {
        getAccessToken: async () => 'expired-or-revoked-token',
        fetchImpl: async () => ({ status, json: async () => ({}) }),
      },
    )).rejects.toMatchObject({ code: 'costs_unauthorized' })
  })

  it.each([
    [503, 'cost_source_unavailable', 'costs_unavailable'],
    [504, 'cost_source_timeout', 'costs_timeout'],
    [503, 'authorization_unavailable', 'costs_unauthorized'],
    [504, 'upstream_timeout', 'costs_unauthorized'],
  ])('distinguishes authorized source state from authorization uncertainty', async (status, serverCode, clientCode) => {
    await expect(readAdminCosts(
      { kind: 'preset', preset: 'today' },
      {
        getAccessToken: async () => 'verified-token',
        fetchImpl: async () => ({
          status,
          json: async () => ({ error: { code: serverCode } }),
        }),
      },
    )).rejects.toMatchObject({ code: clientCode })
  })
})
