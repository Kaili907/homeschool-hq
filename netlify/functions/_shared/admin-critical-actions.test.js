import { describe, expect, it, vi } from 'vitest'
import {
  ADMIN_CRITICAL_ACTIONS,
  createAdminCriticalActionEnforcer,
  isAdminCriticalAction,
} from './admin-critical-actions.js'

const BINDING = Object.freeze({
  actorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  action: ADMIN_CRITICAL_ACTIONS.COMMIT_CONFIGURATION,
  resource: Object.freeze({ type: 'admin-configuration', id: 'runtime.ai.enabled' }),
})
const NOW = new Date('2026-08-16T12:00:00.000Z')

function request() {
  return {
    headers: {
      authorization: 'Bearer credential-that-must-never-be-audited',
      'x-step-up-assurance': 'private-step-up-proof',
    },
    body: JSON.stringify({ password: 'also-private' }),
  }
}

function audit() {
  return { record: vi.fn(async () => {}) }
}

function signedToken(payload) {
  return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`
}

function enforcer(options) {
  return createAdminCriticalActionEnforcer({
    requestSourceGuard: () => ({ ok: true }),
    ...options,
  })
}

describe('Admin critical-action enforcement seam', () => {
  it('classifies every required high-authority mutation while excluding reads and previews', () => {
    for (const action of Object.values(ADMIN_CRITICAL_ACTIONS)) {
      expect(isAdminCriticalAction(action)).toBe(true)
    }
    for (const action of [
      'admin.audit.read',
      'admin.configuration.read',
      'admin.configuration.preview',
      'admin.provider-pricing.read',
      'admin.curriculum.read',
    ]) expect(isAdminCriticalAction(action)).toBe(false)
  })

  it('fails closed when StepUpAssurance is absent or unavailable', async () => {
    for (const stepUpAssurance of [
      undefined,
      { consume: vi.fn(async () => { throw new Error('private provider detail') }) },
      { consume: vi.fn(async () => ({ ok: false, reason: 'unavailable' })) },
    ]) {
      const sink = audit()
      const result = await enforcer({
        stepUpAssurance,
        audit: sink,
        now: () => NOW,
      }).enforce(request(), BINDING)
      expect(result.ok).toBe(false)
      expect(result.response.statusCode).toBe(503)
      expect(JSON.parse(result.response.body)).toEqual({ error: { code: 'step_up_unavailable' } })
      expect(sink.record).toHaveBeenCalledWith({
        schemaVersion: 1,
        eventType: 'admin.critical_action.assurance',
        occurredAt: NOW.toISOString(),
        actor: { id: BINDING.actorId },
        action: BINDING.action,
        resource: BINDING.resource,
        outcome: 'denied',
        reason: 'unavailable',
      })
      expect(JSON.stringify(sink.record.mock.calls)).not.toMatch(
        /Bearer|credential|private-step-up-proof|password|also-private/i,
      )
    }
  })

  it('passes the exact server-derived binding to an atomic consume and allows only the same receipt', async () => {
    const sink = audit()
    const consume = vi.fn(async ({ binding }) => ({ ok: true, binding }))
    const event = request()
    const result = await enforcer({
      stepUpAssurance: { consume },
      audit: sink,
      now: () => NOW,
    }).enforce(event, BINDING)
    expect(result).toEqual({ ok: true })
    expect(consume).toHaveBeenCalledWith({ event, binding: BINDING })
    expect(sink.record).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'allowed', reason: 'assured',
    }))
    expect(JSON.stringify(sink.record.mock.calls)).not.toContain('private-step-up-proof')
  })

  it.each([
    ['actor', { ...BINDING, actorId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }],
    ['action', { ...BINDING, action: ADMIN_CRITICAL_ACTIONS.COMMIT_PROVIDER_PRICING }],
    ['resource', { ...BINDING, resource: { ...BINDING.resource, id: 'runtime.tts.enabled' } }],
  ])('rejects a consumed receipt rebound to another %s', async (_dimension, returnedBinding) => {
    const sink = audit()
    const result = await enforcer({
      stepUpAssurance: { consume: vi.fn(async () => ({ ok: true, binding: returnedBinding })) },
      audit: sink,
      now: () => NOW,
    }).enforce(request(), BINDING)
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(403)
    expect(JSON.parse(result.response.body)).toEqual({ error: { code: 'step_up_required' } })
    expect(sink.record).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'denied', reason: 'binding_mismatch',
    }))
  })

  it.each(['required', 'invalid', 'expired', 'replayed'])(
    'denies a %s assurance without weakening the response',
    async (reason) => {
      const result = await enforcer({
        stepUpAssurance: { consume: vi.fn(async () => ({ ok: false, reason })) },
        audit: audit(),
        now: () => NOW,
      }).enforce(request(), BINDING)
      expect(result.ok).toBe(false)
      expect(result.response.statusCode).toBe(403)
      expect(JSON.parse(result.response.body)).toEqual({ error: { code: 'step_up_required' } })
    },
  )

  it('fails closed after consumption when the safe audit record cannot be persisted', async () => {
    const result = await enforcer({
      stepUpAssurance: { consume: vi.fn(async ({ binding }) => ({ ok: true, binding })) },
      audit: { record: vi.fn(async () => { throw new Error('audit unavailable') }) },
      now: () => NOW,
    }).enforce(request(), BINDING)
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(503)
  })

  it('uses the real SEC-4 assurance implementation on the default mounted path', async () => {
    const nowSeconds = Math.floor(NOW.getTime() / 1_000)
    const accessToken = signedToken({
      sub: BINDING.actorId,
      session_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      iat: nowSeconds,
      exp: nowSeconds + 600,
      aal: 'aal2',
      amr: [{ method: 'totp', timestamp: nowSeconds }],
    })
    const authVerifier = vi.fn(async () => ({
      ok: true,
      user: { id: BINDING.actorId },
      accessToken,
    }))
    const result = await createAdminCriticalActionEnforcer({
      env: { ACADEMY_TRUSTED_ORIGIN: 'https://academy.example', CONTEXT: 'production' },
      authVerifier,
      audit: audit(),
      now: () => NOW,
    }).enforce({
      headers: {
        authorization: `Bearer ${accessToken}`,
        origin: 'https://academy.example',
        'sec-fetch-site': 'same-origin',
      },
    }, BINDING)

    expect(result).toEqual({ ok: true })
    expect(authVerifier).toHaveBeenCalledOnce()
  })

  it('rejects an invalid browser request source before assurance consumption', async () => {
    const consume = vi.fn()
    const result = await createAdminCriticalActionEnforcer({
      stepUpAssurance: { consume },
      requestSourceGuard: () => ({ ok: false, code: 'invalid_request_source' }),
    }).enforce(request(), BINDING)
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(403)
    expect(JSON.parse(result.response.body)).toEqual({
      error: { code: 'invalid_request_source' },
    })
    expect(consume).not.toHaveBeenCalled()
  })
})
