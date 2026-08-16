import { describe, expect, it } from 'vitest'
import {
  ADMIN_REQUEST_SOURCE_FAILURE_CODE,
  guardAdminRequestSource,
  parseAdminRequestSourceConfig,
} from '../../netlify/functions/_shared/admin-request-source.js'

const PRODUCTION_ORIGIN = 'https://academy.example'
const DEVELOPMENT_ORIGIN = 'http://localhost:5173'
const PRODUCTION_ENV = Object.freeze({
  ACADEMY_TRUSTED_ORIGIN: PRODUCTION_ORIGIN,
  CONTEXT: 'production',
})

const FAILURE = Object.freeze({ ok: false, code: ADMIN_REQUEST_SOURCE_FAILURE_CODE })

function browserEvent({ origin = PRODUCTION_ORIGIN, fetchSite = 'same-origin', headers = {}, multiValueHeaders } = {}) {
  const event = {
    headers: {
      origin,
      'sec-fetch-site': fetchSite,
      ...headers,
    },
  }
  if (multiValueHeaders !== undefined) event.multiValueHeaders = multiValueHeaders
  return event
}

function expectRejected(event, env = PRODUCTION_ENV) {
  expect(guardAdminRequestSource(event, { env })).toEqual(FAILURE)
}

describe('Admin browser request-source guard', () => {
  it('accepts the exact configured production Origin with same-origin fetch metadata', () => {
    expect(guardAdminRequestSource(browserEvent(), { env: PRODUCTION_ENV })).toEqual({ ok: true })
  })

  it('accepts an explicitly configured localhost origin only in Netlify development context', () => {
    const env = {
      ...PRODUCTION_ENV,
      CONTEXT: 'dev',
      ACADEMY_DEV_TRUSTED_ORIGINS: JSON.stringify([DEVELOPMENT_ORIGIN]),
    }
    expect(guardAdminRequestSource(browserEvent({ origin: DEVELOPMENT_ORIGIN }), { env })).toEqual({ ok: true })
  })

  it('treats header names case-insensitively', () => {
    const event = {
      headers: {
        OrIgIn: PRODUCTION_ORIGIN,
        'SeC-FeTcH-SiTe': 'same-origin',
      },
    }
    expect(guardAdminRequestSource(event, { env: PRODUCTION_ENV })).toEqual({ ok: true })
  })

  it('accepts Netlify single-value multiValueHeaders when the ordinary map is absent', () => {
    const event = {
      multiValueHeaders: {
        Origin: [PRODUCTION_ORIGIN],
        'Sec-Fetch-Site': ['same-origin'],
      },
    }
    expect(guardAdminRequestSource(event, { env: PRODUCTION_ENV })).toEqual({ ok: true })
  })

  it('accepts identical single-value headers and multiValueHeaders mirrors', () => {
    const event = browserEvent({
      multiValueHeaders: {
        origin: [PRODUCTION_ORIGIN],
        'sec-fetch-site': ['same-origin'],
      },
    })
    expect(guardAdminRequestSource(event, { env: PRODUCTION_ENV })).toEqual({ ok: true })
  })

  it.each([
    ['missing Origin', { headers: { 'sec-fetch-site': 'same-origin' } }],
    ['null Origin', browserEvent({ origin: 'null' })],
    ['wrong Origin', browserEvent({ origin: 'https://other.example' })],
    ['suffix attack', browserEvent({ origin: 'https://academy.example.attacker.com' })],
    ['userinfo URL trick', browserEvent({ origin: 'https://attacker.example@academy.example' })],
    ['port mismatch', browserEvent({ origin: 'https://academy.example:8443' })],
    ['HTTP production Origin', browserEvent({ origin: 'http://academy.example' })],
    ['Origin path', browserEvent({ origin: 'https://academy.example/admin' })],
    ['Origin trailing slash', browserEvent({ origin: 'https://academy.example/' })],
    ['Origin query', browserEvent({ origin: 'https://academy.example?admin=true' })],
    ['Origin fragment', browserEvent({ origin: 'https://academy.example#admin' })],
    ['same-site fetch metadata', browserEvent({ fetchSite: 'same-site' })],
    ['cross-site fetch metadata', browserEvent({ fetchSite: 'cross-site' })],
    ['none fetch metadata', browserEvent({ fetchSite: 'none' })],
    ['empty fetch metadata', browserEvent({ fetchSite: '' })],
    ['unknown fetch metadata', browserEvent({ fetchSite: 'future-token' })],
    ['mixed-case fetch metadata value', browserEvent({ fetchSite: 'Same-Origin' })],
    ['missing fetch metadata', { headers: { origin: PRODUCTION_ORIGIN } }],
  ])('rejects %s', (_label, event) => {
    expectRejected(event)
  })

  it.each([
    ['Origin', `${PRODUCTION_ORIGIN}, https://attacker.example`],
    ['Sec-Fetch-Site', 'same-origin, cross-site'],
  ])('rejects comma-joined %s values', (header, value) => {
    const event = browserEvent()
    event.headers[header] = value
    if (header === 'Origin') delete event.headers.origin
    else delete event.headers['sec-fetch-site']
    expectRejected(event)
  })

  it.each([
    ['Origin', { origin: [PRODUCTION_ORIGIN, 'https://attacker.example'] }],
    ['Sec-Fetch-Site', { 'sec-fetch-site': ['same-origin', 'cross-site'] }],
  ])('rejects duplicate %s values in multiValueHeaders', (header, multiValueHeaders) => {
    expectRejected(browserEvent({ multiValueHeaders }))
  })

  it('rejects duplicate logical Origin names with different casing', () => {
    expectRejected(browserEvent({ headers: { Origin: PRODUCTION_ORIGIN } }))
  })

  it('rejects duplicate logical Sec-Fetch-Site names with different casing', () => {
    expectRejected(browserEvent({ headers: { 'Sec-Fetch-Site': 'same-origin' } }))
  })

  it('rejects disagreement between headers and multiValueHeaders', () => {
    expectRejected(browserEvent({
      multiValueHeaders: {
        origin: ['https://attacker.example'],
        'sec-fetch-site': ['same-origin'],
      },
    }))
  })

  it('does not trust a development allowlist in production or preview contexts', () => {
    for (const context of ['production', 'deploy-preview', 'branch-deploy', undefined]) {
      const env = {
        ACADEMY_TRUSTED_ORIGIN: PRODUCTION_ORIGIN,
        ACADEMY_DEV_TRUSTED_ORIGINS: JSON.stringify([DEVELOPMENT_ORIGIN]),
      }
      if (context !== undefined) env.CONTEXT = context
      expectRejected(browserEvent({ origin: DEVELOPMENT_ORIGIN }), env)
    }
  })

  it('does not use Host or forwarding headers as authority', () => {
    const spoofedHost = browserEvent({
      headers: {
        host: 'attacker.example',
        'x-forwarded-host': 'attacker.example',
        referer: 'https://attacker.example/admin',
      },
    })
    expect(guardAdminRequestSource(spoofedHost, { env: PRODUCTION_ENV })).toEqual({ ok: true })

    const trustedHostWithWrongOrigin = browserEvent({
      origin: 'https://attacker.example',
      headers: {
        host: 'academy.example',
        'x-forwarded-host': 'academy.example',
        referer: 'https://academy.example/admin',
      },
    })
    expectRejected(trustedHostWithWrongOrigin)
  })

  it('does not authorize Admin capabilities, roles, sessions, AAL, or step-up grants', () => {
    const result = guardAdminRequestSource(browserEvent(), { env: PRODUCTION_ENV })
    expect(result).toEqual({ ok: true })
    expect(Object.keys(result)).toEqual(['ok'])
    for (const authority of ['role', 'capability', 'session', 'aal', 'stepUp', 'grant']) {
      expect(result).not.toHaveProperty(authority)
    }
  })

  it('does not encode method authorization policy in the source guard', () => {
    for (const httpMethod of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      const event = { ...browserEvent(), httpMethod }
      expect(guardAdminRequestSource(event, { env: PRODUCTION_ENV })).toEqual({ ok: true })
    }
  })

  it('returns one bounded failure shape without request or configuration details', () => {
    const result = guardAdminRequestSource(browserEvent({ origin: 'https://attacker.example' }), {
      env: {
        ACADEMY_TRUSTED_ORIGIN: PRODUCTION_ORIGIN,
        SECRET: 'do-not-disclose',
      },
    })
    expect(result).toEqual(FAILURE)
    expect(JSON.stringify(result)).not.toContain('academy.example')
    expect(JSON.stringify(result)).not.toContain('attacker.example')
    expect(JSON.stringify(result)).not.toContain('do-not-disclose')
  })
})

describe('Admin request-source configuration parser', () => {
  it('parses one canonical HTTPS production origin', () => {
    expect(parseAdminRequestSourceConfig(PRODUCTION_ENV)).toEqual({
      development: false,
      trustedOrigins: [PRODUCTION_ORIGIN],
    })
  })

  it('adds exact loopback origins only in explicit development context', () => {
    const env = {
      ACADEMY_TRUSTED_ORIGIN: PRODUCTION_ORIGIN,
      ACADEMY_DEV_TRUSTED_ORIGINS: JSON.stringify([
        'http://localhost:5173',
        'http://127.0.0.1:8888',
        'http://[::1]:9999',
      ]),
      CONTEXT: 'dev',
    }
    expect(parseAdminRequestSourceConfig(env)).toEqual({
      development: true,
      trustedOrigins: [
        PRODUCTION_ORIGIN,
        'http://localhost:5173',
        'http://127.0.0.1:8888',
        'http://[::1]:9999',
      ],
    })
  })

  it.each([
    ['missing production origin', {}],
    ['wildcard production origin', { ACADEMY_TRUSTED_ORIGIN: '*' }],
    ['wildcard host production origin', { ACADEMY_TRUSTED_ORIGIN: 'https://*.example.com' }],
    ['HTTP production config', { ACADEMY_TRUSTED_ORIGIN: 'http://academy.example' }],
    ['localhost production config', { ACADEMY_TRUSTED_ORIGIN: 'https://localhost' }],
    ['production config with user-info', { ACADEMY_TRUSTED_ORIGIN: 'https://user@academy.example' }],
    ['production config with a path', { ACADEMY_TRUSTED_ORIGIN: 'https://academy.example/admin' }],
    ['production config with a query', { ACADEMY_TRUSTED_ORIGIN: 'https://academy.example?x=1' }],
    ['production config with a fragment', { ACADEMY_TRUSTED_ORIGIN: 'https://academy.example#x' }],
    ['non-JSON development config', { ...PRODUCTION_ENV, ACADEMY_DEV_TRUSTED_ORIGINS: DEVELOPMENT_ORIGIN }],
    ['wildcard development config', { ...PRODUCTION_ENV, ACADEMY_DEV_TRUSTED_ORIGINS: '["http://*.localhost:5173"]' }],
    ['non-local development config', { ...PRODUCTION_ENV, ACADEMY_DEV_TRUSTED_ORIGINS: '["https://dev.example"]' }],
    ['localhost suffix config', { ...PRODUCTION_ENV, ACADEMY_DEV_TRUSTED_ORIGINS: '["http://localhost.attacker.example:5173"]' }],
    ['duplicate development config', { ...PRODUCTION_ENV, ACADEMY_DEV_TRUSTED_ORIGINS: '["http://localhost:5173","http://localhost:5173"]' }],
  ])('fails closed for %s', (_label, env) => {
    expect(parseAdminRequestSourceConfig(env)).toBeNull()
    expectRejected(browserEvent(), env)
  })
})
