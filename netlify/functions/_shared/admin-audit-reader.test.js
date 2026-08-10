import { describe, expect, it, vi } from 'vitest'
import { AdminAuditReadError, createAdminAuditReader } from './admin-audit-reader.js'

const EVENT = Object.freeze({
  schemaVersion: 2,
  eventId: '10000000-0000-4000-8000-000000000001',
  occurredAt: '2026-08-09T13:00:00.000Z',
  actorRole: 'admin',
  action: 'configuration.update',
  resourceType: 'configuration',
  resourceRef: 'ai.enabled',
  resourceVersion: null,
  resourceRevision: '2',
  previousValue: { value: false },
  newValue: { value: true },
  reasonCode: 'configuration.changed',
  correlationId: '20000000-0000-4000-8000-000000000001',
})

function clientWith(data, error = null) {
  const abortSignal = vi.fn(async () => ({ data, error }))
  const rpc = vi.fn(() => ({ abortSignal }))
  return { rpc, abortSignal }
}

describe('Admin audit service reader', () => {
  it('calls only the bounded service RPC with exact audit capability', async () => {
    const client = clientWith({ schemaVersion: 2, events: [EVENT], hasMore: false })
    const reader = createAdminAuditReader({ client })
    await expect(reader.list({
      limit: 25,
      action: 'configuration.update',
      resourceType: 'configuration',
      resourceRef: 'ai.enabled',
      cursor: { occurredAt: EVENT.occurredAt, eventId: EVENT.eventId },
    })).resolves.toEqual({ events: [EVENT], hasMore: false })
    expect(client.rpc).toHaveBeenCalledWith('academy_admin_read_audit_events_v1', {
      p_limit: 25,
      p_before_at: EVENT.occurredAt,
      p_before_event_id: EVENT.eventId,
      p_action: 'configuration.update',
      p_resource_type: 'configuration',
      p_resource_ref: 'ai.enabled',
      p_required_capability: 'audit:read',
    })
  })

  it('reconstructs a safe DTO and drops unexpected database fields', async () => {
    const client = clientWith({
      schemaVersion: 2,
      events: [{
        ...EVENT,
        actorUserRef: 'private-user',
        actorAssignmentRef: 'private-assignment',
        bearerToken: 'SECRET',
        databaseError: 'SECRET SQL',
      }],
      hasMore: false,
      rawRows: [{ secret: true }],
    })
    const result = await createAdminAuditReader({ client }).list({ limit: 50 })
    expect(result.events).toEqual([EVENT])
    expect(JSON.stringify(result)).not.toMatch(/private-user|private-assignment|SECRET|rawRows|databaseError/)
  })

  it.each([
    { ...EVENT, actorRole: 'student' },
    { ...EVENT, action: 'configuration.*' },
    { ...EVENT, newValue: { prompt: 'private' } },
    { ...EVENT, newValue: { value: { nested: 'private' } } },
    { ...EVENT, newValue: { value: 'https://example.test?secret=x' } },
    { ...EVENT, newValue: { value: 'secret' } },
    { ...EVENT, eventId: 'not-a-uuid' },
  ])('fails closed on an unsafe projection %#', async (event) => {
    const client = clientWith({ schemaVersion: 2, events: [event], hasMore: false })
    await expect(createAdminAuditReader({ client }).list({ limit: 50 }))
      .rejects.toEqual(expect.objectContaining({ code: 'source_unavailable' }))
  })

  it('fails closed on database errors and missing server configuration', async () => {
    const failed = clientWith(null, { message: 'raw database SECRET' })
    await expect(createAdminAuditReader({ client: failed }).list({ limit: 50 }))
      .rejects.toEqual(expect.objectContaining({ code: 'source_unavailable' }))
    await expect(createAdminAuditReader({ env: {} }).list({ limit: 50 }))
      .rejects.toEqual(expect.any(AdminAuditReadError))
  })
})
