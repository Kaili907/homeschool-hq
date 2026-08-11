import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { errorResponse, jsonResponse } from '../netlify/functions/_shared/http.js'

describe('Admin browser and server cache defense in depth', () => {
  it('marks successful and denied JSON responses as non-cacheable', () => {
    for (const response of [jsonResponse(200, { ok: true }), errorResponse(403, 'admin_access_denied')]) {
      expect(response.headers['cache-control']).toBe('no-store')
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8')
    }
  })

  it('declares explicit Netlify cache boundaries for the worker, Admin HTML/API, assets, and Curriculum', async () => {
    const config = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8')
    expect(config).toContain('for = "/sw.js"')
    expect(config).toContain('Cache-Control = "no-cache, no-store, must-revalidate"')
    expect(config).toContain('for = "/academy/admin/*"')
    expect(config).toContain('for = "/api/admin/*"')
    expect(config).toContain('for = "/.netlify/functions/admin-*"')
    expect(config.match(/Cache-Control = "private, no-store, max-age=0"/g)).toHaveLength(4)
    expect(config).toContain('for = "/assets/*"')
    expect(config).toContain('for = "/curriculum/*"')
    expect(config.match(/Cache-Control = "public, max-age=31536000, immutable"/g)).toHaveLength(2)
  })

  it('always revalidates the service-worker script during production registration', async () => {
    const source = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8')
    expect(source).toContain("register('/sw.js', { updateViaCache: 'none' })")
  })
})
