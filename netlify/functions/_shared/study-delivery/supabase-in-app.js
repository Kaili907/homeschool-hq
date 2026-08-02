import { createSupabaseServiceRpc } from '../study-adult-review/supabase-ports.js'

export function createSupabaseInAppPersistence(options = {}) {
  const rpc = options.rpc ?? createSupabaseServiceRpc(options)
  const workerIdentity = options.workerIdentity
  const leaseContext = options.leaseContext
  const configured = () => typeof workerIdentity === 'string'
    && workerIdentity.length > 0
    && rpc?.isConfigured?.() === true
    && typeof leaseContext?.forAttempt === 'function'

  return Object.freeze({
    isDurable: true,
    isReady: configured,
    async insertNotification(input) {
      if (!configured()) throw new Error('in_app_persistence_not_ready')
      const lease = await leaseContext.forAttempt({
        jobId: input.jobId,
        attemptId: input.attemptId,
      })
      if (!lease || typeof lease.leaseToken !== 'string'
        || !Number.isSafeInteger(lease.expectedRevision)) {
        throw new Error('in_app_lease_context_invalid')
      }
      return rpc.call('academy_study_deliver_in_app_notification_v2', {
        p_worker_id: workerIdentity,
        p_delivery: {
          schemaVersion: 2,
          jobId: input.jobId,
          leaseToken: lease.leaseToken,
          expectedRevision: lease.expectedRevision,
          attemptId: input.attemptId,
          deliveryIdempotencyKey: input.deliveryIdempotencyKey,
          recipientRef: input.recipientRef,
          routeRef: input.routeRef,
          providerName: input.providerName,
          providerConfigVersion: input.providerConfigVersion,
        },
      })
    },
    async verifyNotificationReceipt(binding) {
      if (!configured()) throw new Error('in_app_persistence_not_ready')
      return rpc.call('academy_study_verify_in_app_notification_v2', {
        p_worker_id: workerIdentity,
        p_binding: binding,
      })
    },
  })
}
