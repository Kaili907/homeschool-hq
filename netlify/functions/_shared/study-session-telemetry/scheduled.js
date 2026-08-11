import {
  runProductionStudySessionTelemetryDelivery,
  studySessionTelemetryDeliveryWireResult,
  unavailableStudySessionTelemetryDeliveryResult,
} from './entrypoint.js'

export const STUDY_SESSION_TELEMETRY_SCHEDULE_STATUS = 'not_configured'

/**
 * Platform-private scheduled-function seam. Keep this module under `_shared`
 * until an approved cadence can bind it through Netlify `config.schedule`.
 * It accepts no request, header, body, batch, lease, or version input.
 */
export function createStudySessionTelemetryScheduledEntrypoint({
  runDelivery = runProductionStudySessionTelemetryDelivery,
} = {}) {
  if (typeof runDelivery !== 'function') {
    throw new TypeError('study_session_telemetry_scheduled_entrypoint_invalid')
  }
  return async () => {
    try {
      return studySessionTelemetryDeliveryWireResult(await runDelivery())
    } catch {
      return unavailableStudySessionTelemetryDeliveryResult()
    }
  }
}

export const runScheduledStudySessionTelemetryDelivery =
  createStudySessionTelemetryScheduledEntrypoint()

export default runScheduledStudySessionTelemetryDelivery
