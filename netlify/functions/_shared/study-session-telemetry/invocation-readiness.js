import {
  createServerOperationalTelemetryWriter,
  resolveTrustedAppVersion,
  resolveTrustedEngineVersion,
} from '../operational-telemetry-writer.js'
import { createProductionStudySessionTelemetryWorker } from './production.js'
import {
  runScheduledStudySessionTelemetryDelivery,
  STUDY_SESSION_TELEMETRY_SCHEDULE_STATUS,
} from './scheduled.js'

const STATUS = Object.freeze({ true: 'configured', false: 'not_configured' })

function manualAuthorityConfigured(env) {
  const rawUrl = (env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || '').trim()
  const anonKey = (env?.SUPABASE_ANON_KEY || env?.VITE_SUPABASE_ANON_KEY || '').trim()
  try {
    const url = new URL(rawUrl)
    return url.protocol === 'https:' && !url.username && !url.password && anonKey.length > 0
  } catch {
    return false
  }
}

function deploymentVersionsConfigured(env) {
  try {
    resolveTrustedAppVersion(env)
    resolveTrustedEngineVersion(env, 'study')
    return true
  } catch {
    return false
  }
}

export function studySessionTelemetryInvocationReadiness({
  env = process.env,
  workerFactory = createProductionStudySessionTelemetryWorker,
  scheduledEntrypoint = runScheduledStudySessionTelemetryDelivery,
  telemetryWriterFactory = createServerOperationalTelemetryWriter,
  manualAuthority,
} = {}) {
  return Object.freeze({
    schemaVersion: 1,
    workerCode: typeof workerFactory === 'function' ? 'available' : 'unavailable',
    manualAuthority: STATUS[String(manualAuthority ?? manualAuthorityConfigured(env))],
    scheduledEntrypoint: typeof scheduledEntrypoint === 'function' ? 'available' : 'unavailable',
    schedule: STUDY_SESSION_TELEMETRY_SCHEDULE_STATUS,
    deploymentVersions: STATUS[String(deploymentVersionsConfigured(env))],
    telemetryWriter: typeof telemetryWriterFactory === 'function' ? 'available' : 'unavailable',
  })
}
