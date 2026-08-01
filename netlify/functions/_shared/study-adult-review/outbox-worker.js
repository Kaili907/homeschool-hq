import { createHash, randomUUID } from 'node:crypto'
import { validRecipientResolution } from './recipients.js'
import { createMonitoringEvent, NOOP_MONITORING_PORT } from '../study-safety/monitoring.js'

function deliveryKey(proposalId, recipientRef, routeRef, channel) {
  const hash = createHash('sha256')
    .update(['study-safety-delivery-v1', proposalId, recipientRef, routeRef, channel, 'study-safety-adult-review-v1'].join('\u001f'))
    .digest('hex')
  return `study-safety-delivery:${hash}`
}

function evidenceRef(prefix, value) {
  return `${prefix}:${createHash('sha256').update(String(value), 'utf8').digest('hex')}`
}

function retryAt(nowMs, attemptCount, baseMs, maxMs) {
  const delay = Math.min(maxMs, baseMs * (2 ** Math.max(0, attemptCount - 1)))
  return new Date(nowMs + delay).toISOString()
}

export function createAdultReviewOutboxWorker(options) {
  const store = options.store
  const recipientResolver = options.recipientResolver
  const providers = new Map(options.providers.map((provider) => [provider.channel, provider]))
  const now = options.now ?? Date.now
  const idFactory = options.idFactory ?? randomUUID
  const maxAttempts = options.maxAttempts ?? 4
  const baseRetryMs = options.baseRetryMs ?? 30_000
  const maxRetryMs = options.maxRetryMs ?? 30 * 60_000
  const allowProductionProviders = options.allowProductionProviders === true
  const monitoring = options.monitoring ?? NOOP_MONITORING_PORT
  const backlogAlertCount = options.backlogAlertCount ?? 25

  async function record(name, severity, code, fields = {}) {
    try {
      await monitoring.record(createMonitoringEvent(name, severity, code, fields, { now }))
    } catch {}
  }

  async function resolvePending(limit = 10) {
    const stamp = new Date(now()).toISOString()
    const claims = await store.claimUnresolvedProposals({ now: stamp, limit, leaseMs: 30_000 })
    let enqueued = 0
    for (const claim of claims) {
      let resolution
      try {
        resolution = await recipientResolver.resolve({ proposalRef: claim.proposal.proposalId })
      } catch {
        resolution = { state: 'indeterminate', reasonCode: 'resolver-unavailable' }
      }
      if (!validRecipientResolution(resolution)) {
        const failureState = resolution?.state === 'unavailable' ? 'unavailable' : 'indeterminate'
        await store.recordRecipientResolutionFailure({
          proposalId: claim.proposal.proposalId,
          proposalLeaseToken: claim.leaseToken,
          state: failureState,
          reasonCode: failureState === 'unavailable' ? 'no-authorized-recipient' : 'resolver-malformed-or-unavailable',
        })
        await record('study_safety.recipient_resolution_failure', 'warning', 'recipient-resolution-failure')
        continue
      }
      const routes = resolution.recipients.flatMap((recipient) => recipient.routes.map((route) => ({
        recipientRef: recipient.recipientRef,
        routeRef: route.routeRef,
        channel: route.channel,
        deliveryIdempotencyKey: deliveryKey(claim.proposal.proposalId, recipient.recipientRef, route.routeRef, route.channel),
      })))
      const jobs = await store.recordRecipientResolutionAndEnqueue({
        proposalId: claim.proposal.proposalId,
        proposalLeaseToken: claim.leaseToken,
        resolutionRef: resolution.resolutionRef,
        policyVersion: resolution.policyVersion,
        routes,
        enqueuedAt: stamp,
      })
      enqueued += jobs.length
    }
    const snapshot = store.operationalSnapshot?.(stamp)
    if (snapshot && snapshot.backlogCount >= backlogAlertCount) {
      await record('study_safety.outbox_backlog', 'warning', 'outbox-backlog', snapshot)
    }
    return { proposalsClaimed: claims.length, jobsEnqueued: enqueued }
  }

  async function deliver(limit = 10) {
    const nowMs = now()
    const stamp = new Date(nowMs).toISOString()
    const claims = await store.claim({ now: stamp, limit, leaseMs: 30_000 })
    const results = []
    for (const claim of claims) {
      const job = claim.record
      const proposal = await store.getProposal(job.proposalId)
      if (!proposal) {
        await store.recordPermanentFailure({ outboxId: job.outboxId, leaseToken: claim.leaseToken, failedAt: stamp, failureCode: 'proposal-not-found' })
        results.push({ outboxId: job.outboxId, state: 'permanent-failure' })
        continue
      }
      let authorization
      try {
        authorization = await recipientResolver.reauthorizeForDelivery({
          proposalRef: proposal.proposalId,
          recipientRef: job.recipientRef,
          routeRef: job.routeRef,
          now: stamp,
        })
      } catch {
        authorization = { state: 'indeterminate', reasonCode: 'recipient-reauthorization-unavailable' }
      }
      if (authorization?.state !== 'authorized' || authorization.channel !== job.channel) {
        const indeterminate = authorization?.state === 'indeterminate' || authorization?.state === 'unavailable'
        const transition = indeterminate ? store.recordIndeterminate.bind(store) : store.recordPermanentFailure.bind(store)
        await transition({
          outboxId: job.outboxId,
          leaseToken: claim.leaseToken,
          failedAt: stamp,
          failureCode: indeterminate ? 'recipient-reauthorization-indeterminate' : 'recipient-route-revoked',
        })
        results.push({ outboxId: job.outboxId, state: indeterminate ? 'indeterminate' : 'permanent-failure' })
        continue
      }
      const provider = providers.get(job.channel)
      if (
        !provider ||
        !provider.isReady?.() ||
        (!allowProductionProviders && provider.isTestProvider !== true) ||
        provider.supportsDurableIdempotency !== true
      ) {
        await store.recordIndeterminate({ outboxId: job.outboxId, leaseToken: claim.leaseToken, failedAt: stamp, failureCode: 'delivery-provider-not-ready' })
        results.push({ outboxId: job.outboxId, state: 'indeterminate' })
        continue
      }
      if (job.attemptCount >= maxAttempts) {
        await store.recordPermanentFailure({ outboxId: job.outboxId, leaseToken: claim.leaseToken, failedAt: stamp, failureCode: 'delivery-attempts-exhausted' })
        results.push({ outboxId: job.outboxId, state: 'permanent-failure' })
        continue
      }

      const attemptId = idFactory()
      const attempt = {
        outboxId: job.outboxId,
        leaseToken: claim.leaseToken,
        attemptId,
        deliveryIdempotencyKey: job.deliveryIdempotencyKey,
        recipientRef: job.recipientRef,
        routeRef: job.routeRef,
        channel: job.channel,
        providerVersion: provider.providerVersion,
        authorizationEvidenceRef: evidenceRef('authorization-evidence', authorization.authorizationEvidenceRef),
        attemptedAt: stamp,
      }
      const { attemptCount } = await store.recordAttempt(attempt)
      let delivered
      try {
        delivered = await provider.deliver({
          idempotencyKey: job.deliveryIdempotencyKey,
          recipientRef: job.recipientRef,
          routeRef: job.routeRef,
          templateCode: job.templateCode,
        })
      } catch {
        await store.recordTemporaryFailure({
          outboxId: job.outboxId,
          leaseToken: claim.leaseToken,
          failedAt: stamp,
          retryAt: retryAt(nowMs, attemptCount, baseRetryMs, maxRetryMs),
          failureCode: 'delivery-response-lost',
        })
        if (attemptCount >= 2) await record('study_safety.delivery_repeated_failure', 'warning', 'delivery-repeated-failure', { attemptCount })
        results.push({ outboxId: job.outboxId, state: 'retry-scheduled' })
        continue
      }

      if (delivered?.state === 'delivered' && delivered.verified === true) {
        let evidence
        try {
          evidence = await provider.verifyReceipt({
            deliveryIdempotencyKey: job.deliveryIdempotencyKey,
            recipientRef: job.recipientRef,
            routeRef: job.routeRef,
            providerReceiptRef: delivered.providerReceiptRef,
          })
        } catch {
          evidence = { verified: false }
        }
        if (evidence?.verified === true) {
          await store.recordDeliveryReceipt({
            ...attempt,
            deliveredAt: stamp,
            providerReceiptRef: evidenceRef('receipt', delivered.providerReceiptRef),
            receiptEvidenceRef: evidenceRef('receipt-evidence', evidence.evidenceRef),
          })
          await store.recordDelivered({ outboxId: job.outboxId, leaseToken: claim.leaseToken, deliveredAt: stamp })
          results.push({ outboxId: job.outboxId, state: 'delivered' })
          continue
        }
      }
      if (delivered?.state === 'temporary-failure') {
        await store.recordTemporaryFailure({
          outboxId: job.outboxId,
          leaseToken: claim.leaseToken,
          failedAt: stamp,
          retryAt: retryAt(nowMs, attemptCount, baseRetryMs, maxRetryMs),
          failureCode: 'delivery-temporary-failure',
        })
        if (attemptCount >= 2) await record('study_safety.delivery_repeated_failure', 'warning', 'delivery-repeated-failure', { attemptCount })
        results.push({ outboxId: job.outboxId, state: 'retry-scheduled' })
      } else if (delivered?.state === 'permanent-failure') {
        await store.recordPermanentFailure({ outboxId: job.outboxId, leaseToken: claim.leaseToken, failedAt: stamp, failureCode: 'delivery-permanent-failure' })
        if (attemptCount >= 2) await record('study_safety.delivery_repeated_failure', 'warning', 'delivery-repeated-failure', { attemptCount })
        results.push({ outboxId: job.outboxId, state: 'permanent-failure' })
      } else {
        await store.recordIndeterminate({ outboxId: job.outboxId, leaseToken: claim.leaseToken, failedAt: stamp, failureCode: 'delivery-evidence-indeterminate' })
        results.push({ outboxId: job.outboxId, state: 'indeterminate' })
      }
    }
    return results
  }

  return Object.freeze({ resolvePending, deliver })
}
