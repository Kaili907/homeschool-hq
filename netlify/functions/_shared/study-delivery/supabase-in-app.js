import { createSupabaseServiceRpc } from '../study-adult-review/supabase-ports.js'
import { workerContextForRpc } from '../study-worker/context.js'
import {
  assertExactInAppDeliveryPayload,
  assertExactInAppVerifyBinding,
} from './in-app-receipt-validator.js'

export function createSupabaseInAppPersistence(options = {}) {
  const rpc = options.rpc ?? createSupabaseServiceRpc(options)
  const leaseContext = options.leaseContext
  const configured = () => rpc?.isConfigured?.() === true
    && typeof leaseContext?.forAttempt === 'function'

  return Object.freeze({
    isDurable: true,
    isReady: configured,
    async insertNotification(input) {
      if (!configured()) throw new Error('in_app_persistence_not_ready')
      const workerContext = workerContextForRpc(input.workerContext)
      const lease = await leaseContext.forAttempt({
        jobId: input.jobId,
        attemptId: input.attemptId,
        workerContext,
      })
      if (!lease || typeof lease.leaseToken !== 'string'
        || !Number.isSafeInteger(lease.expectedRevision)
        || lease.active !== true
        || lease.currentAttempt !== true) {
        throw new Error('in_app_lease_context_invalid')
      }
      return rpc.call('academy_study_deliver_in_app_notification_v2', {
        p_worker_id: workerContext.workerIdentity,
        p_delivery: assertExactInAppDeliveryPayload({
          schemaVersion: 2,
          jobId: input.jobId,
          leaseToken: lease.leaseToken,
          expectedRevision: lease.expectedRevision,
          attemptId: input.attemptId,
          deliveryIdempotencyKey: input.deliveryIdempotencyKey,
          recipientRef: input.recipientRef,
          routeRef: input.routeRef,
          proposalId: input.proposalId,
          householdId: input.householdId,
          studentId: input.studentId,
          providerName: input.providerName,
          providerConfigVersion: input.providerConfigVersion,
        }),
      }, { requireWorkerCredential: true, workerContext })
    },
    async verifyNotificationReceipt(binding) {
      if (!configured()) throw new Error('in_app_persistence_not_ready')
      const workerContext = workerContextForRpc(binding.workerContext)
      const { workerContext: _ignored, ...receiptBinding } = binding
      return rpc.call('academy_study_verify_in_app_notification_v2', {
        p_worker_id: workerContext.workerIdentity,
        p_binding: assertExactInAppVerifyBinding(receiptBinding),
      }, { requireWorkerCredential: true, workerContext })
    },
  })
}
