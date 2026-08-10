import { describe, expect, it, vi } from 'vitest'
import { AdminAuditReadError, readAdminAuditPage } from './auditHttpSource'

const EVENT = {
  schemaVersion: 2,
  eventId: '10000000-0000-4000-8000-000000000001',
  occurredAt: '2026-08-09T13:00:00.000Z',
  actorRole: 'viewer',
  action: 'configuration.update',
  resourceType: 'configuration',
  resourceRef: 'ai.enabled',
  resourceVersion: null,
  resourceRevision: null,
  previousValue: { value: false },
  newValue: { value: true },
  reasonCode: 'configuration.changed',
  correlationId: '20000000-0000-4000-8000-000000000001',
} as const

const filters = { action: 'configuration.update', resourceType: 'configuration', resourceRef: 'ai.enabled', limit: 50 } as const

describe('authorized Admin audit browser reader', () => {
  it('sends only the bearer, safe filters, limit, and cursor', async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 200, json: async () => ({ schemaVersion: 2, events: [EVENT], nextCursor: 'opaque_cursor' }),
    }))
    await expect(readAdminAuditPage(filters, 'older_cursor', {
      getAccessToken: async () => 'verified-token', fetchImpl: fetchImpl as unknown as typeof fetch,
    })).resolves.toEqual({ events: [EVENT], nextCursor: 'opaque_cursor' })
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/admin/v1/audit?action=configuration.update&resourceType=configuration&resourceRef=ai.enabled&limit=50&cursor=older_cursor',
      {
        method: 'GET', headers: { Accept: 'application/json', Authorization: 'Bearer verified-token' },
        credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: expect.any(AbortSignal),
      },
    )
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toMatch(/role|capabilit|assignment/)
  })

  it('does not contact the endpoint without an access token', async () => {
    const fetchImpl = vi.fn()
    await expect(readAdminAuditPage({ limit: 50 }, null, {
      getAccessToken: async () => null, fetchImpl,
    })).rejects.toMatchObject({ code: 'audit_unauthorized' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    [401, 'audit_unauthorized'], [403, 'audit_unauthorized'], [400, 'invalid_query'],
    [503, 'audit_unavailable'], [504, 'audit_timeout'],
  ] as const)('maps HTTP %s to %s', async (status, code) => {
    await expect(readAdminAuditPage({ limit: 50 }, null, {
      getAccessToken: async () => 'token',
      fetchImpl: (async () => ({ status, json: async () => ({ error: { code: 'raw SECRET' } }) })) as unknown as typeof fetch,
    })).rejects.toMatchObject({ code })
  })

  it.each([
    { ...EVENT, actorRole: 'student' },
    { ...EVENT, action: 'configuration.*' },
    { ...EVENT, newValue: { prompt: 'private learner content' } },
    { ...EVENT, newValue: { value: { nested: 'private' } } },
    { ...EVENT, newValue: { value: 'https://example.test?token=secret' } },
    { ...EVENT, newValue: { value: 'secret' } },
  ])('rejects an unsafe browser DTO %#', async (event) => {
    await expect(readAdminAuditPage({ limit: 50 }, null, {
      getAccessToken: async () => 'token',
      fetchImpl: (async () => ({
        status: 200,
        json: async () => ({ schemaVersion: 2, events: [event], nextCursor: null }),
      })) as unknown as typeof fetch,
    })).rejects.toEqual(expect.any(AdminAuditReadError))
  })

  it('rebuilds the DTO without unexpected raw fields', async () => {
    const result = await readAdminAuditPage({ limit: 50 }, null, {
      getAccessToken: async () => 'token',
      fetchImpl: (async () => ({
        status: 200,
        json: async () => ({
          schemaVersion: 2,
          events: [{ ...EVENT, actorUserRef: 'private', rawJson: { secret: 'SECRET' } }],
          nextCursor: null,
          databaseError: 'SECRET',
        }),
      })) as unknown as typeof fetch,
    })
    expect(result).toEqual({ events: [EVENT], nextCursor: null })
    expect(JSON.stringify(result)).not.toMatch(/private|SECRET|rawJson|databaseError/)
  })
})
