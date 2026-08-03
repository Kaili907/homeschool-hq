import { supabaseAuthConfigured } from '../supabase-auth.js'
import { validRateLimitPort } from './rate-limit.js'

function readyPort(port, method, requireDurable = true) {
  return Boolean(
    port &&
    typeof port[method] === 'function' &&
    typeof port.isReady === 'function' &&
    port.isReady() === true &&
    (!requireDurable || port.isDurable === true),
  )
}

function readyProductionCollection(ports, method) {
  return Array.isArray(ports) && ports.length > 0 && ports.every((port) =>
    readyPort(port, method) && port.isTestProvider !== true,
  )
}

export function evaluateStudySafetyReadiness(dependencies, env = process.env) {
  const missing = []
  if (!supabaseAuthConfigured(env)) missing.push('authentication')
  if (typeof env.STUDY_SAFETY_RATE_LIMIT_HMAC_KEY !== 'string' || env.STUDY_SAFETY_RATE_LIMIT_HMAC_KEY.trim() === '') {
    missing.push('rate-limit-correlation-key')
  }
  if (!dependencies.classifier?.isConfigured?.()) missing.push('classifier-provider')
  if (!readyPort(dependencies.learnerAuthorization, 'resolve') || dependencies.learnerAuthorization?.verifiesSession !== true) {
    missing.push('learner-session-authorization')
  }
  if (!validRateLimitPort(dependencies.rateLimiter, true)) missing.push('durable-rate-limit')
  if (!readyPort(dependencies.monitoring, 'record')) missing.push('monitoring')
  if (!readyPort(dependencies.proposalPersistence, 'createProposal')) missing.push('adult-review-persistence')
  if (
    !readyPort(dependencies.outbox, 'claim') ||
    typeof dependencies.outbox?.recordRecipientResolutionAndEnqueue !== 'function'
  ) missing.push('adult-review-outbox')
  if (
    !readyPort(dependencies.recipientResolver, 'resolve') ||
    typeof dependencies.recipientResolver?.reauthorizeForDelivery !== 'function'
  ) missing.push('authorized-recipient-resolver')
  if (
    !readyProductionCollection(dependencies.deliveryProviders, 'deliver') ||
    dependencies.deliveryProviders.some((provider) => provider.supportsDurableIdempotency !== true)
  ) missing.push('delivery-provider')
  if (!readyProductionCollection(dependencies.receiptValidators, 'verifyReceipt')) {
    missing.push('receipt-validator')
  }
  const circuitState = dependencies.classifier?.circuitState?.()
  return Object.freeze({
    status: missing.length > 0 ? 'not-ready' : circuitState && circuitState !== 'closed' ? 'degraded' : 'ready',
    // Internal diagnostics only. The HTTP readiness projection omits them.
    missing: Object.freeze(missing),
  })
}

export function readinessWireResult(readiness) {
  return Object.freeze({ status: readiness.status })
}
