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

/**
 * Lease-based post-commit delivery. A missing acknowledgement is safe: the
 * lease expires and the canonical telemetry execution key replays idempotently.
 */
export function createStudySessionTelemetryWorker({ outbox, telemetry }) {
  if (!outbox || typeof outbox.claim !== 'function'
      || typeof outbox.complete !== 'function' || typeof outbox.retry !== 'function'
      || !telemetry || typeof telemetry.record !== 'function') {
    throw new TypeError('study_session_telemetry_worker_invalid')
  }

  return Object.freeze({
    async run({ limit = 25, leaseSeconds = 30 } = {}) {
      const claims = await outbox.claim({ limit, leaseSeconds })
      const summary = {
        claimed: claims.length,
        delivered: 0,
        replayed: 0,
        retryScheduled: 0,
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
          } catch {
            summary.acknowledgementFailed += 1
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
          } catch {
            summary.acknowledgementFailed += 1
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
        } catch {
          summary.acknowledgementFailed += 1
        }
      }
      return Object.freeze(summary)
    },
  })
}

export const studySessionTelemetryObservationForTests = observation
