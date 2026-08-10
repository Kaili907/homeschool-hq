import {
  ADMIN_CONFIGURATION_INTEGRATION_STATUS,
  ADMIN_CONFIGURATION_RUNTIME_STATUS,
  ADMIN_RUNTIME_CONFIGURATION_CLASSIFICATIONS,
  ADMIN_RUNTIME_CONFIGURATION_TRUSTED_CONSUMERS,
  sanitizeAdminConfigurationProjection,
  sanitizeAdminRuntimeConfigurationProjection,
} from '../../../src/admin/configurationModel.ts'
import { createAdminConfigurationSource } from './admin-configuration-source.js'
import { dailyLimit } from './gateway-access.js'
import { projectPublicTtsCatalog, TTS_VOICE_CATALOG } from './tts-catalog.js'

export const SAFE_AI_DAILY_LIMIT = 50
export const SAFE_TTS_DAILY_LIMIT = 100
export const KNOWN_AI_TIERS = Object.freeze(['sonnet', 'haiku'])
export const DEFAULT_AI_TIER = 'sonnet'

// Compatibility export names for the gateway integration layer.
export const RUNTIME_CONFIGURATION_CLASSIFICATIONS = ADMIN_RUNTIME_CONFIGURATION_CLASSIFICATIONS
export const RUNTIME_CONFIGURATION_TRUSTED_CONSUMERS =
  ADMIN_RUNTIME_CONFIGURATION_TRUSTED_CONSUMERS

const POSITIVE_FLAG_VALUES = new Set(['1', 'true', 'on', 'enabled'])
const NEGATIVE_FLAG_VALUES = new Set(['0', 'false', 'off', 'disabled'])
const MAX_DAILY_LIMIT = 100_000

function byKey(projection) {
  return new Map(projection.settings.map((setting) => [setting.key, setting.value]))
}

function deploymentFlag(env, name) {
  const raw = env?.[name]
  if (raw === undefined || raw === null || raw === '') {
    return Object.freeze({ value: false, kind: 'fallback' })
  }
  if (typeof raw !== 'string') return Object.freeze({ value: false, kind: 'invalid' })
  // Preserve the gateway's exact envFlagEnabled semantics: case-insensitive,
  // but whitespace is not normalized into an enabled value.
  const normalized = raw.toLowerCase()
  if (POSITIVE_FLAG_VALUES.has(normalized)) {
    return Object.freeze({ value: true, kind: 'configured' })
  }
  if (NEGATIVE_FLAG_VALUES.has(normalized)) {
    return Object.freeze({ value: false, kind: 'configured' })
  }
  return Object.freeze({ value: false, kind: 'invalid' })
}

function deploymentQuota(env, name, fallback) {
  const raw = env?.[name]
  const normalized = typeof raw === 'string' ? raw.trim() : ''
  const parsed = /^\d+$/.test(normalized) ? Number(normalized) : Number.NaN
  const configured = Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= MAX_DAILY_LIMIT
  return Object.freeze({
    value: dailyLimit(env, name, fallback),
    kind: configured
      ? 'configured'
      : raw === undefined || raw === null || (typeof raw === 'string' && normalized === '')
        ? 'fallback'
        : 'invalid',
  })
}

function runtimeState({
  key,
  effectiveValue,
  enforcement = 'enforced',
  resolution,
  reason,
}) {
  return Object.freeze({
    classification: RUNTIME_CONFIGURATION_CLASSIFICATIONS[key],
    effectiveValue: Array.isArray(effectiveValue)
      ? Object.freeze([...effectiveValue])
      : effectiveValue,
    enforcement,
    resolution,
    reason,
    trustedConsumer: RUNTIME_CONFIGURATION_TRUSTED_CONSUMERS[key],
    studyStatus: key.startsWith('cost.') ? 'not_applicable' : 'unavailable',
  })
}

function unavailableState(key) {
  return runtimeState({
    key,
    effectiveValue: null,
    enforcement: 'unavailable',
    resolution: 'unavailable',
    reason: 'runtime_consumer_unavailable',
  })
}

function flagState(key, savedValue, deployment, subsystemAvailable = true) {
  if (deployment.kind === 'invalid') {
    return runtimeState({
      key,
      effectiveValue: false,
      resolution: 'error',
      reason: 'configuration_resolution_failed',
    })
  }
  if (!savedValue) {
    return runtimeState({
      key,
      effectiveValue: false,
      resolution: 'saved',
      reason: 'saved_value_enforced',
    })
  }
  if (!deployment.value) {
    return runtimeState({
      key,
      effectiveValue: false,
      resolution: deployment.kind === 'configured' ? 'constraint' : 'fallback',
      reason: deployment.kind === 'configured' ? 'deployment_disabled' : 'safe_fallback_disabled',
    })
  }
  if (!subsystemAvailable) {
    return runtimeState({
      key,
      effectiveValue: false,
      resolution: 'fallback',
      reason: 'browser_speech_fallback',
    })
  }
  return runtimeState({
    key,
    effectiveValue: true,
    resolution: 'saved',
    reason: 'saved_value_enforced',
  })
}

function quotaState(key, savedValue, deployment) {
  const effectiveValue = Math.min(savedValue, deployment.value)
  if (deployment.kind === 'invalid') {
    return runtimeState({
      key,
      effectiveValue,
      resolution: 'error',
      reason: 'configuration_resolution_failed',
    })
  }
  if (effectiveValue === savedValue) {
    return runtimeState({
      key,
      effectiveValue,
      resolution: 'saved',
      reason: 'saved_value_enforced',
    })
  }
  return runtimeState({
    key,
    effectiveValue,
    resolution: deployment.kind === 'configured' ? 'constraint' : 'fallback',
    reason: deployment.kind === 'configured'
      ? 'deployment_quota_ceiling'
      : 'safe_fallback_quota_ceiling',
  })
}

function savedState(key, effectiveValue) {
  return runtimeState({
    key,
    effectiveValue,
    resolution: 'saved',
    reason: 'saved_value_enforced',
  })
}

function fallbackState(key, effectiveValue) {
  return runtimeState({
    key,
    effectiveValue,
    resolution: 'error',
    reason: 'configuration_resolution_failed',
  })
}

/**
 * Resolve runtime-effective values solely from a strict saved projection and
 * trusted server deployment/catalog inputs. Browser-supplied runtime fields are
 * never accepted as inputs to this function.
 */
export function resolveEffectiveRuntimeConfiguration(
  projection,
  { env = {}, catalog = TTS_VOICE_CATALOG } = {},
) {
  const saved = sanitizeAdminConfigurationProjection(projection)
  if (!saved) throw new TypeError('invalid saved Admin configuration projection')

  const settings = byKey(saved)
  const approvedTiers = Object.freeze([...settings.get('ai.approved_tiers')])
  const defaultTier = settings.get('ai.default_tier')
  if (!approvedTiers.includes(defaultTier)) {
    throw new TypeError('default AI tier must be included in the approved tiers')
  }

  const publicCatalog = projectPublicTtsCatalog(catalog, env)
  const deployableVoiceAvailable = publicCatalog.voices.some(
    (voice) => voice.status === 'active' && voice.deploymentAvailable,
  )

  const runtime = Object.freeze({
    'runtime.ai.enabled': flagState(
      'runtime.ai.enabled',
      settings.get('runtime.ai.enabled'),
      deploymentFlag(env, 'ACADEMY_AI_ENABLED'),
    ),
    'runtime.tts.enabled': flagState(
      'runtime.tts.enabled',
      settings.get('runtime.tts.enabled'),
      deploymentFlag(env, 'ACADEMY_TTS_ENABLED'),
      deployableVoiceAvailable,
    ),
    'quota.ai.requests_per_account_day': quotaState(
      'quota.ai.requests_per_account_day',
      settings.get('quota.ai.requests_per_account_day'),
      deploymentQuota(env, 'ACADEMY_AI_DAILY_LIMIT', SAFE_AI_DAILY_LIMIT),
    ),
    'quota.tts.requests_per_account_day': quotaState(
      'quota.tts.requests_per_account_day',
      settings.get('quota.tts.requests_per_account_day'),
      deploymentQuota(env, 'ACADEMY_TTS_DAILY_LIMIT', SAFE_TTS_DAILY_LIMIT),
    ),
    'cost.warning.monthly_micros': savedState(
      'cost.warning.monthly_micros', settings.get('cost.warning.monthly_micros'),
    ),
    'cost.critical.monthly_micros': savedState(
      'cost.critical.monthly_micros', settings.get('cost.critical.monthly_micros'),
    ),
    'ai.approved_tiers': savedState('ai.approved_tiers', approvedTiers),
    'ai.default_tier': savedState('ai.default_tier', defaultTier),
  })

  return Object.freeze({
    resolution: 'saved_configuration',
    values: Object.freeze({
      aiEnabled: runtime['runtime.ai.enabled'].effectiveValue,
      ttsEnabled: runtime['runtime.tts.enabled'].effectiveValue,
      aiDailyLimit: runtime['quota.ai.requests_per_account_day'].effectiveValue,
      ttsDailyLimit: runtime['quota.tts.requests_per_account_day'].effectiveValue,
      approvedTiers: runtime['ai.approved_tiers'].effectiveValue,
      defaultTier: runtime['ai.default_tier'].effectiveValue,
    }),
    runtime,
  })
}

export const resolveAdminRuntimeConfiguration = resolveEffectiveRuntimeConfiguration

const SAFE_RUNTIME_CONFIGURATION = (() => {
  const runtime = Object.freeze({
    'runtime.ai.enabled': fallbackState('runtime.ai.enabled', false),
    'runtime.tts.enabled': fallbackState('runtime.tts.enabled', false),
    'quota.ai.requests_per_account_day': fallbackState(
      'quota.ai.requests_per_account_day', SAFE_AI_DAILY_LIMIT,
    ),
    'quota.tts.requests_per_account_day': fallbackState(
      'quota.tts.requests_per_account_day', SAFE_TTS_DAILY_LIMIT,
    ),
    'cost.warning.monthly_micros': unavailableState('cost.warning.monthly_micros'),
    'cost.critical.monthly_micros': unavailableState('cost.critical.monthly_micros'),
    'ai.approved_tiers': fallbackState('ai.approved_tiers', KNOWN_AI_TIERS),
    'ai.default_tier': fallbackState('ai.default_tier', DEFAULT_AI_TIER),
  })
  return Object.freeze({
    resolution: 'safe_fallback',
    values: Object.freeze({
      aiEnabled: false,
      ttsEnabled: false,
      aiDailyLimit: SAFE_AI_DAILY_LIMIT,
      ttsDailyLimit: SAFE_TTS_DAILY_LIMIT,
      approvedTiers: KNOWN_AI_TIERS,
      defaultTier: DEFAULT_AI_TIER,
    }),
    runtime,
  })
})()

/** Configuration read, validation, or resolution failure disables provider use. */
export function safeRuntimeConfigurationFallback() {
  return SAFE_RUNTIME_CONFIGURATION
}

export const safeAdminRuntimeConfigurationFallback = safeRuntimeConfigurationFallback

export function createRuntimeConfigurationResolver({
  env = process.env,
  fetchImpl = globalThis.fetch,
  source,
  serviceClient,
} = {}) {
  const savedSource = source ?? createAdminConfigurationSource({ env, fetchImpl, serviceClient })
  return Object.freeze({
    async resolve({ catalog = TTS_VOICE_CATALOG } = {}) {
      try {
        const projection = await savedSource.read()
        return resolveEffectiveRuntimeConfiguration(projection, { env, catalog })
      } catch {
        return safeRuntimeConfigurationFallback()
      }
    },
  })
}

export const createAdminRuntimeConfigurationResolver = createRuntimeConfigurationResolver

/** Build the separately tagged, strict browser runtime projection. */
export function projectEffectiveAdminConfiguration(projection, resolved) {
  const saved = sanitizeAdminConfigurationProjection(projection)
  if (!saved || !resolved?.runtime) {
    throw new TypeError('effective Admin configuration projection unavailable')
  }
  const candidate = {
    schemaVersion: saved.schemaVersion,
    integrationStatus: ADMIN_CONFIGURATION_INTEGRATION_STATUS,
    runtimeStatus: ADMIN_CONFIGURATION_RUNTIME_STATUS,
    settings: saved.settings.map((setting) => ({
      ...setting,
      runtime: resolved.runtime[setting.key],
    })),
  }
  const browserProjection = sanitizeAdminRuntimeConfigurationProjection(candidate)
  if (!browserProjection) {
    throw new TypeError('invalid effective Admin configuration projection')
  }
  return browserProjection
}

export const projectAdminRuntimeConfiguration = projectEffectiveAdminConfiguration
