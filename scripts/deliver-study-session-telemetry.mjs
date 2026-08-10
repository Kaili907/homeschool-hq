import { runProductionStudySessionTelemetryDelivery } from '../netlify/functions/_shared/study-session-telemetry/entrypoint.js'

const result = await runProductionStudySessionTelemetryDelivery()
process.stdout.write(`${JSON.stringify(result)}\n`)

if (result.health.worker !== 'available'
    || !['no_work', 'processed'].includes(result.delivery.category)) {
  process.exitCode = 1
}
