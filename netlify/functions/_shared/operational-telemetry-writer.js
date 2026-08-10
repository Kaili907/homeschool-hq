import {
  OperationalTelemetryValidationError,
  createOperationalTelemetry,
} from '../../../src/telemetry/operationalTelemetry.ts'

const VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/
const PROHIBITED_FIELD = /(?:raw|messages?|conversation|transcript|prompt|response|audio|speech|emotion|personality|psycholog|diagnos|answer|journal|secret|credential|bearer|token|password|api.?key|contact|email|phone|protected.?work|body|content)/i
const OBSERVATION_FIELDS = new Set([
  'executionKey', 'engine', 'eventType', 'result', 'durationMs', 'metadata',
  'courseRef', 'unitRef', 'lessonRef', 'skillRef',
])

export const TELEMETRY_ENGINE_VERSION_ENV = Object.freeze({
  tutor: 'ACADEMY_TUTOR_ENGINE_VERSION',
  study: 'ACADEMY_STUDY_ENGINE_VERSION',
  assessment: 'ACADEMY_ASSESSMENT_ENGINE_VERSION',
  curriculum: 'ACADEMY_CURRICULUM_ENGINE_VERSION',
  jarvis: 'ACADEMY_JARVIS_ENGINE_VERSION',
  tts: 'ACADEMY_TTS_ENGINE_VERSION',
  gateway: 'ACADEMY_GATEWAY_ENGINE_VERSION',
  sync: 'ACADEMY_SYNC_ENGINE_VERSION',
})

function plainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function exactObservation(value) {
  if (!plainRecord(value)) {
    throw new OperationalTelemetryValidationError('telemetry_input_invalid')
  }
  for (const key of Object.keys(value)) {
    if (OBSERVATION_FIELDS.has(key)) continue
    throw new OperationalTelemetryValidationError(
      PROHIBITED_FIELD.test(key) ? 'telemetry_prohibited_field' : 'telemetry_field_not_allowed',
    )
  }
  if ([...OBSERVATION_FIELDS].some((key) => !Object.hasOwn(value, key))) {
    throw new OperationalTelemetryValidationError('telemetry_input_invalid')
  }
  return value
}

function requiredVersion(value, code) {
  if (typeof value !== 'string' || !VERSION.test(value)) {
    throw new OperationalTelemetryValidationError(code)
  }
  return value
}

/** Deployment identity is server configuration, never a request-body value. */
export function resolveTrustedAppVersion(env) {
  const value = [env?.ACADEMY_APP_VERSION, env?.COMMIT_REF, env?.DEPLOY_ID]
    .find((candidate) => typeof candidate === 'string' && candidate.length > 0)
  return requiredVersion(value, 'telemetry_app_version_invalid')
}

/** Every instrumented engine registers an immutable server-side version. */
export function resolveTrustedEngineVersion(env, engine) {
  const variable = TELEMETRY_ENGINE_VERSION_ENV[engine]
  return requiredVersion(
    variable ? env?.[variable] : undefined,
    'telemetry_engine_version_invalid',
  )
}

function assertServerRuntime() {
  if (typeof window !== 'undefined' || typeof document !== 'undefined') {
    throw new Error('operational_telemetry_server_only')
  }
}

/**
 * Shared emission primitive for later engine instrumentation cards.
 *
 * `observation` deliberately has no identity or version fields. `resolveScope`
 * must map already-verified server authority to either system scope or an
 * active household/learner relationship. Curriculum versions follow the same
 * trusted-resolver pattern and are never copied from browser context.
 */
export function createServerOperationalTelemetryWriter({
  env = process.env,
  store,
  resolveScope,
  resolveCurriculumVersion = async () => null,
  resolveAppVersion = () => resolveTrustedAppVersion(env),
  resolveEngineVersion = (engine) => resolveTrustedEngineVersion(env, engine),
  onPersistenceFailure,
} = {}) {
  assertServerRuntime()
  if (!store || typeof resolveScope !== 'function') {
    throw new TypeError('operational_telemetry_writer_configuration_invalid')
  }
  const telemetry = createOperationalTelemetry({ store, onPersistenceFailure })

  return Object.freeze({
    async record(observation, trustedAuthority) {
      const facts = exactObservation(observation)
      const [scope, appVersion, engineVersion, curriculumVersion] = await Promise.all([
        resolveScope(trustedAuthority),
        resolveAppVersion(trustedAuthority),
        resolveEngineVersion(facts.engine, trustedAuthority),
        resolveCurriculumVersion(facts, trustedAuthority),
      ])
      return telemetry.record({
        ...facts,
        ...scope,
        appVersion,
        engineVersion,
        curriculumVersion,
      })
    },
  })
}
