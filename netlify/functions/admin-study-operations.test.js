import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { STUDY_OPERATION_GATE_IDS } from '../../src/admin/studyOperationsModel.ts'
import { createAdminStudyOperationsHandler } from './admin-study-operations.js'

function request(overrides = {}) {
  return {
    httpMethod: 'GET',
    path: '/api/admin/v1/study-operations',
    headers: { authorization: 'Bearer verified.access.token' },
    ...overrides,
  }
}

function projection() {
  const gates = STUDY_OPERATION_GATE_IDS.map((id) => ({
    id,
    status: 'unknown',
    reasonCode: 'unknown_evidence',
    contractVersion: null,
    lastVerifiedAt: null,
    operatorAction: 'retry_evidence',
  }))
  return {
    contractVersion: 2,
    schemaVersion: 1,
    generatedAt: '2026-08-10T16:00:00.000Z',
    overallStatus: 'unknown',
    gates,
  }
}

describe('authorized Admin Study Operations endpoint', () => {
  it.each(['viewer', 'admin', 'owner'])('uses health:read for the canonical %s role', async (role) => {
    const require = vi.fn().mockResolvedValue({ ok: true, principal: { role } })
    const source = { read: vi.fn().mockResolvedValue(projection()) }
    const handler = createAdminStudyOperationsHandler({ authorization: { require }, source })
    const response = await handler(request())

    expect(response.statusCode).toBe(200)
    expect(require).toHaveBeenCalledWith(expect.anything(), 'health:read')
    expect(source.read).toHaveBeenCalledOnce()
    expect(JSON.parse(response.body).gates).toHaveLength(10)
  })

  it('fails closed before probing sources when permission is denied', async () => {
    const source = { read: vi.fn() }
    const handler = createAdminStudyOperationsHandler({
      authorization: {
        require: vi.fn().mockResolvedValue({ ok: false, response: { statusCode: 403, body: '{}' } }),
      },
      source,
    })
    expect((await handler(request())).statusCode).toBe(403)
    expect(source.read).not.toHaveBeenCalled()
  })

  it('rejects malformed or privacy-bearing source projections without echoing them', async () => {
    const unsafe = { ...projection(), learnerName: 'Private Learner', rawError: 'provider SECRET' }
    const handler = createAdminStudyOperationsHandler({
      authorization: { require: vi.fn().mockResolvedValue({ ok: true }) },
      source: { read: vi.fn().mockResolvedValue(unsafe) },
    })
    const response = await handler(request())
    expect(response.statusCode).toBe(503)
    expect(response.body).toBe(JSON.stringify({ error: { code: 'study_operations_source_unavailable' } }))
    expect(response.body).not.toMatch(/Private Learner|provider SECRET/)
  })

  it('returns only vetted failure codes when authorization or evidence throws', async () => {
    const authFailure = createAdminStudyOperationsHandler({
      authorization: { require: vi.fn().mockRejectedValue(new Error('private auth SECRET')) },
      source: { read: vi.fn() },
    })
    expect((await authFailure(request())).body).toBe(JSON.stringify({ error: { code: 'authorization_unavailable' } }))

    const sourceFailure = createAdminStudyOperationsHandler({
      authorization: { require: vi.fn().mockResolvedValue({ ok: true }) },
      source: { read: vi.fn().mockRejectedValue(new Error('raw provider SECRET')) },
    })
    const response = await sourceFailure(request())
    expect(response.statusCode).toBe(503)
    expect(response.body).not.toContain('SECRET')
  })

  it('accepts only GET, exact paths, and no query parameters', async () => {
    const authorization = { require: vi.fn() }
    const handler = createAdminStudyOperationsHandler({ authorization, source: { read: vi.fn() } })
    expect((await handler(request({ httpMethod: 'POST' }))).statusCode).toBe(405)
    expect((await handler(request({ path: '/api/admin/v1/study-operations/raw' }))).statusCode).toBe(404)
    expect((await handler(request({ queryStringParameters: { details: 'true' } }))).statusCode).toBe(400)
    expect(authorization.require).not.toHaveBeenCalled()
  })

  it('declares the fixed Admin redirect before the SPA fallback', async () => {
    const config = await readFile('netlify.toml', 'utf8')
    const adminRedirect = config.indexOf('from = "/api/admin/v1/study-operations"')
    const functionTarget = config.indexOf('to = "/.netlify/functions/admin-study-operations"')
    const fallback = config.indexOf('from = "/*"')
    expect(adminRedirect).toBeGreaterThanOrEqual(0)
    expect(functionTarget).toBeGreaterThan(adminRedirect)
    expect(fallback).toBeGreaterThan(functionTarget)
  })
})
