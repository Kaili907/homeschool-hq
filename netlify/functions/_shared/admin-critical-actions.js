import { errorResponse } from './http.js'

export const ADMIN_CRITICAL_ACTIONS = Object.freeze({
  CHANGE_ADMIN_ROLE: 'admin.role.change',
  REVOKE_ADMIN_ROLE: 'admin.role.revoke',
  COMMIT_CONFIGURATION: 'admin.configuration.commit',
  COMMIT_PROVIDER_PRICING: 'admin.provider-pricing.commit',
  END_PROVIDER_PRICING: 'admin.provider-pricing.end',
  PUBLISH_CURRICULUM: 'admin.curriculum.publish',
  TOMBSTONE_CURRICULUM_ENTITY: 'admin.curriculum.entity.tombstone',
  ACTIVATE_RELEASE: 'admin.release.activate',
  ROLLBACK_RELEASE: 'admin.release.rollback',
  DESTRUCTIVE_OPERATION: 'admin.destructive.execute',
  RESET_OPERATION: 'admin.reset.execute',
  PURGE_OPERATION: 'admin.purge.execute',
  OVERRIDE_SAFETY: 'admin.safety.override',
  CLOSE_SAFETY_TERMINAL: 'admin.safety.terminal-close',
  ENABLE_PRODUCTION: 'admin.production.enable',
  RESUME_PRODUCTION: 'admin.production.resume',
  BYPASS_PRODUCTION_CONTROL: 'admin.production.bypass',
})

const CRITICAL_ACTIONS = new Set(Object.values(ADMIN_CRITICAL_ACTIONS))
const DENIAL_REASONS = new Set(['required', 'invalid', 'expired', 'replayed'])
const SAFE_VALUE = /^[^\u0000-\u001f\u007f]{1,512}$/u

/**
 * @typedef {object} StepUpAssurance
 * @property {(input: {
 *   event: unknown,
 *   binding: { actorId: string, action: string, resource: { type: string, id: string } },
 * }) => Promise<{
 *   ok: true,
 *   binding: { actorId: string, action: string, resource: { type: string, id: string } },
 * } | { ok: false, reason: string }>} consume
 */

function validValue(value) {
  return typeof value === 'string' && value.trim() === value && SAFE_VALUE.test(value)
}

function validResource(resource) {
  return resource !== null
    && typeof resource === 'object'
    && !Array.isArray(resource)
    && validValue(resource.type)
    && validValue(resource.id)
}

function validBinding(binding) {
  return binding !== null
    && typeof binding === 'object'
    && !Array.isArray(binding)
    && validValue(binding.actorId)
    && CRITICAL_ACTIONS.has(binding.action)
    && validResource(binding.resource)
}

function sameBinding(actual, expected) {
  return validBinding(actual)
    && actual.actorId === expected.actorId
    && actual.action === expected.action
    && actual.resource.type === expected.resource.type
    && actual.resource.id === expected.resource.id
}

function defaultAudit() {
  return Object.freeze({
    async record(event) {
      console.info('admin-critical-action', JSON.stringify(event))
    },
  })
}

function auditEvent(binding, outcome, reason, occurredAt) {
  return Object.freeze({
    schemaVersion: 1,
    eventType: 'admin.critical_action.assurance',
    occurredAt,
    actor: Object.freeze({ id: binding.actorId }),
    action: binding.action,
    resource: Object.freeze({ ...binding.resource }),
    outcome,
    reason,
  })
}

async function record(audit, event) {
  try {
    await audit.record(event)
    return true
  } catch {
    return false
  }
}

/**
 * Server-only enforcement seam for critical Admin mutations.
 *
 * StepUpAssurance.consume must atomically validate freshness, bind the proof to
 * the supplied actor/action/resource tuple, and consume it so the same proof
 * cannot be replayed. The port receives the raw server event only so a future
 * SEC-4 adapter can locate its credential; this module never reads, stores, or
 * audits that credential.
 */
export function createAdminCriticalActionEnforcer({
  stepUpAssurance,
  audit = defaultAudit(),
  now = () => new Date(),
} = {}) {
  return Object.freeze({
    async enforce(event, binding) {
      if (!validBinding(binding)) {
        return { ok: false, response: errorResponse(503, 'step_up_unavailable') }
      }

      const canonicalBinding = Object.freeze({
        actorId: binding.actorId,
        action: binding.action,
        resource: Object.freeze({ type: binding.resource.type, id: binding.resource.id }),
      })
      const occurredAt = now().toISOString()

      if (!stepUpAssurance || typeof stepUpAssurance.consume !== 'function') {
        await record(audit, auditEvent(canonicalBinding, 'denied', 'unavailable', occurredAt))
        return { ok: false, response: errorResponse(503, 'step_up_unavailable') }
      }

      let assurance
      try {
        assurance = await stepUpAssurance.consume(Object.freeze({
          event,
          binding: canonicalBinding,
        }))
      } catch {
        assurance = { ok: false, reason: 'unavailable' }
      }

      const exact = assurance?.ok === true && sameBinding(assurance.binding, canonicalBinding)
      const reason = exact
        ? 'assured'
        : assurance?.ok === true
          ? 'binding_mismatch'
          : DENIAL_REASONS.has(assurance?.reason) ? assurance.reason : 'unavailable'
      const audited = await record(
        audit,
        auditEvent(canonicalBinding, exact ? 'allowed' : 'denied', reason, occurredAt),
      )

      if (!exact || !audited) {
        const unavailable = reason === 'unavailable' || !audited
        return {
          ok: false,
          response: errorResponse(
            unavailable ? 503 : 403,
            unavailable ? 'step_up_unavailable' : 'step_up_required',
          ),
        }
      }
      return { ok: true }
    },
  })
}

export function isAdminCriticalAction(action) {
  return CRITICAL_ACTIONS.has(action)
}
