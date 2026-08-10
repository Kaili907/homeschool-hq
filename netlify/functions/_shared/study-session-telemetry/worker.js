function failureCode(error) {
  if (error?.name === 'AbortError' || error?.code === 'timeout') return 'timeout'
  if (typeof error?.code === 'string' && error.code.startsWith('telemetry_')) {
    return 'validation_error'
  }
  return 'telemetry_unavailable'
}

function observation(claim) {
  return Object.freeze({
    executionKey: claim.executionKey,
    engine: 'study',
    eventType: 'study.session',
    result: claim.result,
    durationMs: null,
    metadata: Object.freeze({
      operation: claim.operation,
      reason_code: claim.reasonCode,
      source: 'study-session-outbox',
    }),
    courseRef: null,
    unitRef: null,
    lessonRef: claim.lessonRef,
    skillRef: null,
  })
}

function authority(claim) {
  return Object.freeze({
    householdRef: claim.householdRef,
    curriculumVersion: claim.curriculumVersion,
  })
}

export const STUDY_SESSION_TELEMETRY_DELIVERY_CATEGORIES = Object.freeze([
  'no_work',
  'processed',
  'partial_with_retryable_failures',
  'failed',
  'unavailable',
])

function deliveryResult(category, counts = {}) {
  return Object.freeze({
    schemaVersion: 1,
    category,
    claimed: counts.claimed ?? 0,
    delivered: counts.delivered ?? 0,
    replayed: counts.replayed ?? 0,
    retryScheduled: counts.retryScheduled ?? 0,
    leaseLost: counts.leaseLost ?? 0,
    acknowledgementFailed: counts.acknowledgementFailed ?? 0,
  })
}

function healthResult(worker, deliveryResultCategory = null) {
  return Object.freeze({
    schemaVersion: 1,
    worker,
    pendingCount: null,
    oldestPendingAgeBucket: null,
    deliveryResultCategory,
  })
}

function acknowledgementFailure(summary, error) {
  if (error?.code === 'lease-lost') summary.leaseLost += 1
  else summary.acknowledgementFailed += 1
}

/**
 * Lease-based post-commit delivery. A missing acknowledgement is safe: the
 * lease expires and the canonical telemetry execution key replays idempotently.
 */
export function createStudySessionTelemetryWorker({ outbox, telemetry }) {
  if (!outbox || typeof outbox.readiness !== 'function' || typeof outbox.claim !== 'function'
      || typeof outbox.complete !== 'function' || typeof outbox.retry !== 'function'
      || !telemetry || typeof telemetry.record !== 'function') {
    throw new TypeError('study_session_telemetry_worker_invalid')
  }

  return Object.freeze({
    async health({ deliveryResultCategory = null } = {}) {
      if (deliveryResultCategory !== null
          && !STUDY_SESSION_TELEMETRY_DELIVERY_CATEGORIES.includes(deliveryResultCategory)) {
        throw new TypeError('study_session_telemetry_health_invalid')
      }
      try {
        const readiness = await outbox.readiness()
        const available = readiness?.status === 'ready'
          && deliveryResultCategory !== 'unavailable'
        return healthResult(available ? 'available' : 'unavailable', deliveryResultCategory)
      } catch {
        return healthResult('unavailable', deliveryResultCategory)
      }
    },

    async run({ limit = 25, leaseSeconds = 30 } = {}) {
      let claims
      try {
        claims = await outbox.claim({ limit, leaseSeconds })
      } catch {
        return deliveryResult('unavailable')
      }
      if (claims.length === 0) return deliveryResult('no_work')
      const summary = {
        claimed: claims.length,
        delivered: 0,
        replayed: 0,
        retryScheduled: 0,
        leaseLost: 0,
        acknowledgementFailed: 0,
      }
      for (const claim of claims) {
        let result
        try {
          result = await telemetry.record(observation(claim), authority(claim))
        } catch (error) {
          try {
            await outbox.retry({
              outboxId: claim.outboxId,
              leaseToken: claim.leaseToken,
              failureCode: failureCode(error),
            })
            summary.retryScheduled += 1
          } catch (acknowledgementError) {
            acknowledgementFailure(summary, acknowledgementError)
          }
          continue
        }

        if (result?.status === 'recorded' || result?.status === 'replayed') {
          try {
            await outbox.complete({
              outboxId: claim.outboxId,
              leaseToken: claim.leaseToken,
              operationalEventId: result.event.eventId,
            })
            summary.delivered += 1
            if (result.status === 'replayed') summary.replayed += 1
          } catch (acknowledgementError) {
            acknowledgementFailure(summary, acknowledgementError)
          }
          continue
        }

        const mappedFailure = result?.status === 'reconciliation_conflict'
          ? 'reconciliation_conflict'
          : 'telemetry_unavailable'
        try {
          await outbox.retry({
            outboxId: claim.outboxId,
            leaseToken: claim.leaseToken,
            failureCode: mappedFailure,
          })
          summary.retryScheduled += 1
        } catch (acknowledgementError) {
          acknowledgementFailure(summary, acknowledgementError)
        }
      }
      const retryableFailures = summary.retryScheduled
        + summary.leaseLost + summary.acknowledgementFailed
      const category = retryableFailures === 0
        ? 'processed'
        : summary.delivered > 0
          ? 'partial_with_retryable_failures'
          : 'failed'
      return deliveryResult(category, summary)
    },
  })
}

export const studySessionTelemetryObservationForTests = observation
