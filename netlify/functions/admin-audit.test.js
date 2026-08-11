import { describe, expect, it, vi } from 'vitest'
import {
  createAdminAuditHandler,
  decodeAuditCursor,
  encodeAuditCursor,
  parseAuditQuery,
} from './admin-audit.js'
import { AdminAuditReadError } from './_shared/admin-audit-reader.js'

const EVENT = Object.freeze({
  schemaVersion: 2,
  eventId: '10000000-0000-4000-8000-000000000001',
  occurredAt: '2026-08-09T13:00:00.000Z',
  actorRole: 'owner',
  action: 'engine.control',
  resourceType: 'engine',
  resourceRef: 'tts',
  resourceVersion: null,
  resourceRevision: null,
  previousValue: { state: 'enabled' },
  newValue: { state: 'disabled' },
  reasonCode: 'engine.controlled',
  correlationId: '20000000-0000-4000-8000-000000000001',
})

const event = (overrides = {}) => ({
  httpMethod: 'GET',
  path: '/api/admin/v1/audit',
  headers: { authorization: 'Bearer verified-token' },
  queryStringParameters: null,
  ...overrides,
})

const authorized = Object.freeze({
  ok: true,
  principal: { userId: 'admin-user', role: 'viewer', capabilities: ['audit:read'] },
  accessToken: 'verified-token',
})

function handlerWith({ auth = authorized, result = { events: [EVENT], hasMore: false }, error } = {}) {
  const authorization = { require: vi.fn(async () => auth) }
  const reader = { list: vi.fn(async () => {
    if (error) throw error
    return result
  }) }
  return { handler: createAdminAuditHandler({ authorization, reader }), authorization, reader }
}

describe('GET /api/admin/v1/audit', () => {
  it('requires audit:read and returns the canonical safe DTO', async () => {
    const { handler, authorization, reader } = handlerWith()
    const response = await handler(event())
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({ schemaVersion: 2, events: [EVENT], nextCursor: null })
    expect(authorization.require).toHaveBeenCalledWith(expect.anything(), 'audit:read')
    expect(reader.list).toHaveBeenCalledWith({
      occurredFrom: undefined, occurredTo: undefined,
      action: undefined, resourceType: undefined, resourceRef: undefined,
      actorRole: undefined, reasonCode: undefined, correlationId: undefined,
      limit: 50, cursor: undefined,
    })
    expect(response.headers['cache-control']).toBe('no-store')
  })

  it.each([
    ['unauthenticated', 401, 'authentication_required'],
    ['student', 403, 'admin_access_denied'],
    ['guardian', 403, 'admin_access_denied'],
    ['revoked Admin', 403, 'admin_access_denied'],
    ['expired Admin', 403, 'admin_access_denied'],
    ['forged role', 403, 'admin_access_denied'],
  ])('denies %s before reading audit history', async (_label, statusCode, code) => {
    const { handler, reader } = handlerWith({
      auth: { ok: false, response: { statusCode, body: JSON.stringify({ error: { code } }) } },
    })
    const response = await handler(event())
    expect(response.statusCode).toBe(statusCode)
    expect(reader.list).not.toHaveBeenCalled()
  })

  it('supports bounded filters, max 100, and an opaque deterministic cursor', async () => {
    const cursor = encodeAuditCursor({ occurredAt: EVENT.occurredAt, eventId: EVENT.eventId })
    const { handler, reader } = handlerWith()
    const response = await handler(event({ rawQueryString: new URLSearchParams({
      occurredFrom: '2026-08-01T00:00:00Z', occurredTo: '2026-08-09T13:00:00Z',
      action: 'engine.control', resourceType: 'engine', resourceRef: 'tts',
      actorRole: 'owner', reasonCode: 'engine.controlled', correlationId: EVENT.correlationId,
      limit: '100', cursor,
    }).toString() }))
    expect(response.statusCode).toBe(200)
    expect(reader.list).toHaveBeenCalledWith({
      occurredFrom: '2026-08-01T00:00:00.000Z', occurredTo: '2026-08-09T13:00:00.000Z',
      action: 'engine.control', resourceType: 'engine', resourceRef: 'tts', limit: 100,
      actorRole: 'owner', reasonCode: 'engine.controlled', correlationId: EVENT.correlationId,
      cursor: { occurredAt: EVENT.occurredAt, eventId: EVENT.eventId },
    })
    expect(decodeAuditCursor(cursor)).toEqual({ occurredAt: EVENT.occurredAt, eventId: EVENT.eventId })
  })

  it('accepts granular curriculum filters without changing pagination shape', async () => {
    const { handler, reader } = handlerWith()
    const response = await handler(event({
      rawQueryString: 'action=curriculum_entity.update&resourceType=curriculum_entity&resourceRef=draft-1%2Flesson-1&limit=25',
    }))
    expect(response.statusCode).toBe(200)
    expect(reader.list).toHaveBeenCalledWith({
      action: 'curriculum_entity.update',
      resourceType: 'curriculum_entity',
      resourceRef: 'draft-1/lesson-1',
      limit: 25,
      cursor: undefined,
    })
    expect(JSON.parse(response.body)).toHaveProperty('nextCursor', null)
  })

  it('returns a cursor only when another page exists', async () => {
    const { handler } = handlerWith({ result: { events: [EVENT], hasMore: true } })
    const body = JSON.parse((await handler(event())).body)
    expect(decodeAuditCursor(body.nextCursor)).toEqual({
      occurredAt: EVENT.occurredAt,
      eventId: EVENT.eventId,
    })
  })

  it('returns exactly one bounded page from a deterministic long audit history', async () => {
    const events = Array.from({ length: 100 }, (_, index) => ({
      ...EVENT,
      eventId: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      occurredAt: new Date(Date.parse(EVENT.occurredAt) - index * 1_000).toISOString(),
    }))
    const { handler } = handlerWith({ result: { events, hasMore: true } })
    const started = performance.now()
    const response = await handler(event({ rawQueryString: 'limit=100' }))
    console.info(`[admin-performance] 100-row audit page ${(performance.now() - started).toFixed(1)}ms`)
    const body = JSON.parse(response.body)
    expect(body.events).toHaveLength(100)
    expect(decodeAuditCursor(body.nextCursor)).toEqual({
      occurredAt: events.at(-1).occurredAt,
      eventId: events.at(-1).eventId,
    })
    expect(response.body.length).toBeLessThan(150_000)
  })

  it.each([
    'limit=0', 'limit=101', 'limit=050', 'limit=1&limit=2',
    'action=wildcard.*', 'resourceType=all', 'resourceRef=has%20spaces',
    'actorRole=student', 'reasonCode=has%20spaces', 'correlationId=not-a-uuid',
    'occurredFrom=not-a-date', 'occurredFrom=August%209%2C%202026',
    'occurredFrom=2026-08-10T00%3A00%3A00Z&occurredTo=2026-08-09T00%3A00%3A00Z',
    'search=anything',
  ])('rejects unsafe query %s', async (rawQueryString) => {
    const { handler, reader } = handlerWith()
    const response = await handler(event({ rawQueryString }))
    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.body).error.code).toBe('invalid_query')
    expect(reader.list).not.toHaveBeenCalled()
  })

  it.each([
    'not-base64!',
    Buffer.from('{}').toString('base64url'),
    Buffer.from(JSON.stringify({ occurredAt: EVENT.occurredAt })).toString('base64url'),
    Buffer.from(JSON.stringify({ occurredAt: 'not-a-date', eventId: EVENT.eventId })).toString('base64url'),
    Buffer.from(JSON.stringify({ occurredAt: EVENT.occurredAt, eventId: 'not-a-uuid' })).toString('base64url'),
  ])('rejects malformed cursor %s', async (cursor) => {
    const { handler, reader } = handlerWith()
    const response = await handler(event({ rawQueryString: `cursor=${encodeURIComponent(cursor)}` }))
    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.body).error.code).toBe('invalid_cursor')
    expect(reader.list).not.toHaveBeenCalled()
  })

  it('does not expose source exceptions or private data', async () => {
    const { handler } = handlerWith({ error: new Error('database SECRET learner transcript') })
    const response = await handler(event())
    expect(response.statusCode).toBe(500)
    expect(response.body).toBe(JSON.stringify({ error: { code: 'internal_error' } }))
    expect(response.body).not.toMatch(/SECRET|learner|database/)
  })

  it.each([
    ['source_unavailable', 503, 'audit_source_unavailable'],
    ['source_timeout', 504, 'audit_source_timeout'],
    ['source_limit', 503, 'audit_source_incomplete'],
  ])('maps %s to a bounded response', async (code, statusCode, responseCode) => {
    const { handler } = handlerWith({ error: new AdminAuditReadError(code) })
    const response = await handler(event())
    expect(response.statusCode).toBe(statusCode)
    expect(JSON.parse(response.body)).toEqual({ error: { code: responseCode } })
  })

  it('rejects non-GET methods and unknown paths', async () => {
    const { handler } = handlerWith()
    expect((await handler(event({ httpMethod: 'POST' }))).statusCode).toBe(405)
    expect((await handler(event({ path: '/api/admin/v1/audit/export' }))).statusCode).toBe(404)
  })

  it('parses object query parameters without accepting arbitrary arrays', () => {
    expect(parseAuditQuery(event({ queryStringParameters: { limit: '1' } }))).toMatchObject({ limit: 1 })
    expect(() => parseAuditQuery(event({ multiValueQueryStringParameters: { limit: ['1', '2'] } })))
      .toThrow()
  })
})
