import { describe, expect, it, vi } from 'vitest'
import { createAdminCurriculumHandler } from './admin-curriculum.js'

const principal = { userId: 'adult-ref', role: 'viewer', capabilities: ['curriculum:read'] }

function event(path, httpMethod = 'GET') {
  return { path, httpMethod, headers: { authorization: 'Bearer token' }, queryStringParameters: null }
}

function sources() {
  return {
    source: {
      loadCatalog: vi.fn().mockResolvedValue({ source: { version: '1.0.0' } }),
      loadLesson: vi.fn().mockResolvedValue({ lessonId: 'ma-g5-mathematics-u01-l01' }),
      loadValidationEvidence: vi.fn().mockResolvedValue({ validation: { overall: 'PASS' } }),
    },
    registry: {
      list: vi.fn().mockResolvedValue({ schemaVersion: 1, releases: [] }),
      details: vi.fn().mockResolvedValue({ schemaVersion: 1, version: '1.0.0' }),
      productionPointer: vi.fn().mockResolvedValue({ releaseVersion: '1.0.0', registryOnly: true }),
    },
    activation: {
      read: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        pointer: { releaseVersion: '1.0.0', revision: 1 },
        candidates: [],
        history: [],
      }),
    },
  }
}

describe('admin curriculum handler', () => {
  it('authorizes filesystem and immutable registry reads independently on the server', async () => {
    const authorization = { require: vi.fn().mockResolvedValue({ ok: true, principal }) }
    const { source, registry, activation } = sources()
    const handler = createAdminCurriculumHandler({ authorization, source, registry, activation })

    expect((await handler(event('/api/admin/curriculum/catalog'))).statusCode).toBe(200)
    expect((await handler(event('/api/admin/curriculum/lessons/ma-g5-mathematics-u01-l01'))).statusCode).toBe(200)
    expect((await handler(event('/api/admin/curriculum/validation'))).statusCode).toBe(200)
    const history = await handler(event('/api/admin/curriculum/history'))
    expect(history.statusCode).toBe(200)
    expect((await handler(event('/api/admin/curriculum/releases'))).statusCode).toBe(200)
    expect((await handler(event('/api/admin/curriculum/releases/1.0.0'))).statusCode).toBe(200)
    expect((await handler(event('/api/admin/curriculum/production-pointer'))).statusCode).toBe(200)
    expect(authorization.require).toHaveBeenCalledTimes(7)
    for (const call of authorization.require.mock.calls) expect(call[1]).toBe('curriculum:read')
    expect(source.loadCatalog).toHaveBeenCalledOnce()
    expect(source.loadLesson).toHaveBeenCalledWith('ma-g5-mathematics-u01-l01')
    expect(source.loadValidationEvidence).toHaveBeenCalledOnce()
    expect(registry.list).toHaveBeenCalledTimes(2)
    expect(activation.read).toHaveBeenCalledWith(principal.userId)
    expect(JSON.parse(history.body)).toEqual({
      schemaVersion: 1,
      releaseRegistry: { schemaVersion: 1, releases: [] },
      activation: {
        schemaVersion: 1,
        pointer: { releaseVersion: '1.0.0', revision: 1 },
        candidates: [],
        history: [],
      },
    })
    expect(registry.details).toHaveBeenCalledWith('1.0.0')
    expect(registry.productionPointer).toHaveBeenCalledOnce()
  })

  it('authorizes narrow immutable Schema v2 index and entity reads', async () => {
    const authorization = { require: vi.fn().mockResolvedValue({ ok: true, principal }) }
    const { source, registry } = sources()
    const studio = {
      readBaseIndex: vi.fn().mockReturnValue({ schemaVersion: 1, baseReleaseVersion: '1.0.0', entities: [] }),
      readBaseEntity: vi.fn().mockReturnValue({ schemaVersion: 1, baseReleaseVersion: '1.0.0', entityType: 'course', entityRef: 'course:math-5', payload: {} }),
    }
    const handler = createAdminCurriculumHandler({ authorization, source, registry, studio })
    expect((await handler(event('/api/admin/curriculum/releases/1.0.0/authoring-index'))).statusCode).toBe(200)
    expect((await handler(event('/api/admin/curriculum/releases/1.0.0/authoring/entities/course/course%3Amath-5'))).statusCode).toBe(200)
    expect(studio.readBaseIndex).toHaveBeenCalledWith('1.0.0')
    expect(studio.readBaseEntity).toHaveBeenCalledWith('1.0.0', 'course', 'course:math-5')
    expect(authorization.require.mock.calls.every((call) => call[1] === 'curriculum:read')).toBe(true)
  })

  it('fails closed before touching curriculum when authorization is denied', async () => {
    const { source, registry, activation } = sources()
    const handler = createAdminCurriculumHandler({
      authorization: { require: vi.fn().mockResolvedValue({ ok: false, response: { statusCode: 403, body: '{}' } }) },
      source,
      registry,
      activation,
    })
    expect((await handler(event('/api/admin/curriculum/catalog'))).statusCode).toBe(403)
    expect((await handler(event('/api/admin/curriculum/releases'))).statusCode).toBe(403)
    expect((await handler(event('/api/admin/curriculum/history'))).statusCode).toBe(403)
    expect(source.loadCatalog).not.toHaveBeenCalled()
    expect(registry.list).not.toHaveBeenCalled()
    expect(activation.read).not.toHaveBeenCalled()
  })

  it('permits only GET, no query input, and vetted immutable references', async () => {
    const { source, registry } = sources()
    const handler = createAdminCurriculumHandler({ authorization: { require: vi.fn() }, source, registry })
    expect((await handler(event('/api/admin/curriculum/catalog', 'POST'))).statusCode).toBe(405)
    expect((await handler({ ...event('/api/admin/curriculum/catalog'), queryStringParameters: { role: 'owner' } })).statusCode).toBe(400)
    expect((await handler(event('/api/admin/curriculum/lessons/..%2Fsecret'))).statusCode).toBe(404)
    expect((await handler(event('/api/admin/curriculum/releases/main'))).statusCode).toBe(404)
    expect((await handler(event('/api/admin/curriculum/activate'))).statusCode).toBe(404)
    expect((await handler(event('/api/admin/curriculum/rollback'))).statusCode).toBe(404)
  })

  it('never returns raw source exceptions', async () => {
    const { source, registry } = sources()
    source.loadCatalog.mockRejectedValue(new Error('C:\\private\\curriculum'))
    const handler = createAdminCurriculumHandler({
      authorization: { require: vi.fn().mockResolvedValue({ ok: true, principal }) },
      source,
      registry,
    })
    const response = await handler(event('/api/admin/curriculum/catalog'))
    expect(response.statusCode).toBe(503)
    expect(response.body).not.toContain('private')
  })

  it('keeps release history GET-only and returns no raw registry or pointer errors', async () => {
    const { source, registry, activation } = sources()
    activation.read.mockRejectedValue(Object.assign(new Error('private actor and pointer detail'), {
      code: 'unavailable',
    }))
    const handler = createAdminCurriculumHandler({
      authorization: { require: vi.fn().mockResolvedValue({ ok: true, principal }) },
      source,
      registry,
      activation,
    })
    expect((await handler(event('/api/admin/curriculum/history', 'POST'))).statusCode).toBe(405)
    const response = await handler(event('/api/admin/curriculum/history'))
    expect(response.statusCode).toBe(503)
    expect(response.body).not.toMatch(/private|actor|pointer detail/i)
  })

  it.each(['student', 'guardian'])('denies a %s identity with no active Admin assignment', async (identity) => {
    const { source, registry } = sources()
    const abortSignal = vi.fn().mockResolvedValue({ data: [], error: null })
    const authorizationClient = { rpc: vi.fn(() => ({ abortSignal })) }
    const handler = createAdminCurriculumHandler({
      authVerifier: vi.fn().mockResolvedValue({
        ok: true, user: { id: identity + '-identity' }, accessToken: 'verified-token',
      }),
      client: authorizationClient,
      source,
      registry,
    })
    expect((await handler(event('/api/admin/curriculum/releases'))).statusCode).toBe(403)
    expect(authorizationClient.rpc).toHaveBeenCalledWith('academy_admin_authorization_v2')
    expect(registry.list).not.toHaveBeenCalled()
  })

  it('maps a missing immutable release to a stable 404', async () => {
    const missing = Object.assign(new Error('private lookup detail'), { code: 'not-found' })
    const { source, registry } = sources()
    registry.details.mockRejectedValue(missing)
    const handler = createAdminCurriculumHandler({
      authorization: { require: vi.fn().mockResolvedValue({ ok: true, principal }) },
      source,
      registry,
    })
    const response = await handler(event('/api/admin/curriculum/releases/9.9.9'))
    expect(response.statusCode).toBe(404)
    expect(response.body).toContain('curriculum_release_unavailable')
    expect(response.body).not.toContain('private')
  })
})
