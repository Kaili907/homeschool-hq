import { describe, expect, it, vi } from 'vitest'
import { createAdminCurriculumHandler } from './admin-curriculum.js'

const principal = { userId: 'adult-ref', role: 'viewer', capabilities: ['curriculum:read'] }

function event(path, httpMethod = 'GET') {
  return { path, httpMethod, headers: { authorization: 'Bearer token' }, queryStringParameters: null }
}

describe('admin curriculum handler', () => {
  it('authorizes catalog and lesson reads independently on the server', async () => {
    const authorization = { require: vi.fn().mockResolvedValue({ ok: true, principal }) }
    const source = {
      loadCatalog: vi.fn().mockResolvedValue({ source: { version: '1.0.0' } }),
      loadLesson: vi.fn().mockResolvedValue({ lessonId: 'ma-g5-mathematics-u01-l01' }),
      loadValidationEvidence: vi.fn().mockResolvedValue({ validation: { overall: 'PASS' } }),
    }
    const handler = createAdminCurriculumHandler({ authorization, source })

    expect((await handler(event('/api/admin/curriculum/catalog'))).statusCode).toBe(200)
    expect((await handler(event('/api/admin/curriculum/lessons/ma-g5-mathematics-u01-l01'))).statusCode).toBe(200)
    expect((await handler(event('/api/admin/curriculum/validation'))).statusCode).toBe(200)
    expect(authorization.require).toHaveBeenNthCalledWith(1, expect.anything(), 'curriculum:read')
    expect(authorization.require).toHaveBeenNthCalledWith(3, expect.anything(), 'curriculum:read')
    expect(source.loadCatalog).toHaveBeenCalledOnce()
    expect(source.loadLesson).toHaveBeenCalledWith('ma-g5-mathematics-u01-l01')
    expect(source.loadValidationEvidence).toHaveBeenCalledOnce()
  })

  it('fails closed before touching curriculum when authorization is denied', async () => {
    const source = { loadCatalog: vi.fn(), loadLesson: vi.fn(), loadValidationEvidence: vi.fn() }
    const handler = createAdminCurriculumHandler({
      authorization: { require: vi.fn().mockResolvedValue({ ok: false, response: { statusCode: 403, body: '{}' } }) },
      source,
    })
    expect((await handler(event('/api/admin/curriculum/catalog'))).statusCode).toBe(403)
    expect(source.loadCatalog).not.toHaveBeenCalled()
  })

  it('permits only GET, no query input, and vetted lesson references', async () => {
    const handler = createAdminCurriculumHandler({
      authorization: { require: vi.fn() },
      source: { loadCatalog: vi.fn(), loadLesson: vi.fn(), loadValidationEvidence: vi.fn() },
    })
    expect((await handler(event('/api/admin/curriculum/catalog', 'POST'))).statusCode).toBe(405)
    expect((await handler({ ...event('/api/admin/curriculum/catalog'), queryStringParameters: { role: 'owner' } })).statusCode).toBe(400)
    expect((await handler(event('/api/admin/curriculum/lessons/..%2Fsecret'))).statusCode).toBe(404)
  })

  it('never returns raw source exceptions', async () => {
    const handler = createAdminCurriculumHandler({
      authorization: { require: vi.fn().mockResolvedValue({ ok: true, principal }) },
      source: { loadCatalog: vi.fn().mockRejectedValue(new Error('C:\\private\\curriculum')), loadLesson: vi.fn(), loadValidationEvidence: vi.fn() },
    })
    const response = await handler(event('/api/admin/curriculum/catalog'))
    expect(response.statusCode).toBe(503)
    expect(response.body).not.toContain('private')
  })
})
