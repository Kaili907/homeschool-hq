import { describe, expect, it, vi } from 'vitest'
import { createAdminCurriculumHandler } from './admin-curriculum.js'

const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const report = {
  schemaVersion: 1, status: 'INCOMPLETE', readOnly: true, evidenceGaps: [],
  subjects: [{
    subjectId: 'published:1.0.0', kind: 'published', version: '1.0.0', state: 'PUBLISHED',
    status: 'INCOMPLETE', packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
    baseReleaseVersion: null, schemaSetVersion: null, manifestStatus: 'VERIFIED',
    packageStatus: 'UNVERIFIED', metadataStatus: 'VERIFIED',
    artifacts: { status: 'VERIFIED', expectedCount: 182, observedCount: 182, verifiedCount: 182 },
    provenance: { status: 'INCOMPLETE', links: [] }, mismatches: [], evidenceGaps: [],
  }],
}

function event(method = 'GET') {
  return {
    httpMethod: method,
    path: '/api/admin/curriculum/integrity',
    headers: { authorization: 'Bearer verified' },
  }
}

function setup(authorizationResult = {
  ok: true,
  principal: { userId: ACTOR, role: 'viewer', capabilities: ['curriculum:read'] },
}) {
  const authorization = { require: vi.fn(async () => authorizationResult) }
  const integrity = { verify: vi.fn(async () => report) }
  const handler = createAdminCurriculumHandler({
    authorization, integrity, source: {}, registry: {}, authoring: {}, approval: {}, staging: {}, studio: {},
  })
  return { authorization, integrity, handler }
}

describe('Admin curriculum integrity HTTP boundary', () => {
  it('authorizes curriculum:read and returns only the safe read-only report', async () => {
    const { authorization, integrity, handler } = setup()
    const response = await handler(event())
    expect(response.statusCode).toBe(200)
    expect(authorization.require).toHaveBeenCalledWith(expect.anything(), 'curriculum:read')
    expect(integrity.verify).toHaveBeenCalledWith(ACTOR)
    expect(JSON.parse(response.body)).toEqual(report)
    expect(response.headers['cache-control']).toBe('no-store')
  })

  it('fails before evidence reads when curriculum:read is denied', async () => {
    const denial = { ok: false, response: { statusCode: 403, body: '{"error":{"code":"admin_access_denied"}}' } }
    const { integrity, handler } = setup(denial)
    const response = await handler(event())
    expect(response.statusCode).toBe(403)
    expect(integrity.verify).not.toHaveBeenCalled()
  })

  it('has no POST, repair, publish, activation, rollback, or pointer mutation route', async () => {
    const { integrity, handler } = setup()
    expect((await handler(event('POST'))).statusCode).toBe(405)
    for (const suffix of ['repair', 'publish', 'activate', 'rollback', 'pointer']) {
      const response = await handler({ ...event('POST'), path: `/api/admin/curriculum/integrity/${suffix}` })
      expect(response.statusCode).toBe(404)
    }
    expect(integrity.verify).not.toHaveBeenCalled()
  })

  it('maps internal verifier failures to a bounded response without raw errors', async () => {
    const { integrity, handler } = setup()
    integrity.verify.mockRejectedValueOnce(new Error('private database curriculum payload'))
    const response = await handler(event())
    expect(response.statusCode).toBe(503)
    expect(response.body).not.toMatch(/private|payload|database/i)
  })
})
