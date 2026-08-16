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
      const result = await createAdminCriticalActionEnforcer({
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
    const result = await createAdminCriticalActionEnforcer({
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
    const result = await createAdminCriticalActionEnforcer({
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
      const result = await createAdminCriticalActionEnforcer({
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
    const result = await createAdminCriticalActionEnforcer({
      stepUpAssurance: { consume: vi.fn(async ({ binding }) => ({ ok: true, binding })) },
      audit: { record: vi.fn(async () => { throw new Error('audit unavailable') }) },
      now: () => NOW,
    }).enforce(request(), BINDING)
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(503)
  })
})
