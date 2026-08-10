import { isCanonicalIntegerMicros } from '../../../src/admin/contracts.ts'
import {
  ADMIN_CONFIGURATION_KEYS,
  ADMIN_CONFIGURATION_RUNTIME_STATUS,
} from '../../../src/admin/configurationModel.ts'
import {
  AdminConfigurationSourceError,
  createAdminConfigurationSource,
} from './admin-configuration-source.js'
import { dailyLimit } from './gateway-access.js'
import { envFlagEnabled } from './http.js'

export const EFFECTIVE_CONFIGURATION_CACHE_TTL_MS = 15_000
export const EFFECTIVE_CONFIGURATION_ERROR_TTL_MS = 1_000

const DEFAULT_AI_DAILY_LIMIT = 50
const DEFAULT_TTS_DAILY_LIMIT = 100
const UNAVAILABLE_REASONS = new Set([
  'configuration_not_enforced',
  'revision_inconsistent',
  'revision_regression',
  'source_timeout',
  'source_unavailable',
])

const SAFE_VALUES = Object.freeze({
  runtime: Object.freeze({ aiEnabled: false, ttsEnabled: false }),
  quotas: Object.freeze({
    aiRequestsPerAccountDay: 1,
    ttsRequestsPerAccountDay: 1,
  }),
  costThresholds: Object.freeze({
    warningMonthlyMicros: '1',
    criticalMonthlyMicros: '1',
  }),
  ai: Object.freeze({ approvedTiers: Object.freeze([]), defaultTier: null }),
})

function milliseconds(value) {
  const candidate = value instanceof Date ? value.getTime() : value
  return Number.isFinite(candidate) ? candidate : Date.now()
}

function boundedTtl(value, fallback) {
  return Number.isSafeInteger(value) && value >= 1 && value <= 60_000 ? value : fallback
}

function sourceReason(error) {
  if (error instanceof AdminConfigurationSourceError && UNAVAILABLE_REASONS.has(error.code)) {
    return error.code
  }
  return 'source_unavailable'
}

function unavailable(reason, loadedAtMs, ttlMs) {
  return Object.freeze({
    schemaVersion: 1,
    status: 'unavailable',
    reason: UNAVAILABLE_REASONS.has(reason) ? reason : 'source_unavailable',
    loadedAt: new Date(loadedAtMs).toISOString(),
    expiresAt: new Date(loadedAtMs + ttlMs).toISOString(),
    revisions: null,
    ...SAFE_VALUES,
  })
}

function snapshot(projection) {
  if (projection.integrationStatus !== ADMIN_CONFIGURATION_RUNTIME_STATUS) {
    throw new AdminConfigurationSourceError('configuration_not_enforced')
  }
  const settings = new Map(projection.settings.map((setting) => [setting.key, setting]))
  if (ADMIN_CONFIGURATION_KEYS.some((key) => (
    settings.get(key)?.integrationStatus !== ADMIN_CONFIGURATION_RUNTIME_STATUS
  ))) {
    throw new AdminConfigurationSourceError('configuration_not_enforced')
  }
  return Object.freeze(Object.fromEntries(ADMIN_CONFIGURATION_KEYS.map((key) => {
    const setting = settings.get(key)
    return [key, Object.freeze({ revision: setting.revision, value: setting.value })]
  })))
}

function revisionProblem(previous, next) {
  if (!previous) return null
  for (const key of ADMIN_CONFIGURATION_KEYS) {
    const before = previous[key]
    const after = next[key]
    const comparison = BigInt(after.revision) - BigInt(before.revision)
    if (comparison < 0n) return 'revision_regression'
    if (comparison === 0n && JSON.stringify(after.value) !== JSON.stringify(before.value)) {
      return 'revision_inconsistent'
    }
  }
  return null
}

function available(next, env, loadedAtMs, ttlMs) {
  const approvedTiers = Object.freeze([...next['ai.approved_tiers'].value])
  const defaultTier = next['ai.default_tier'].value
  if (!approvedTiers.includes(defaultTier)) {
    throw new AdminConfigurationSourceError('source_unavailable')
  }
  const revisions = Object.freeze(Object.fromEntries(
    ADMIN_CONFIGURATION_KEYS.map((key) => [key, next[key].revision]),
  ))
  return Object.freeze({
    schemaVersion: 1,
    status: 'available',
    reason: null,
    loadedAt: new Date(loadedAtMs).toISOString(),
    expiresAt: new Date(loadedAtMs + ttlMs).toISOString(),
    revisions,
    runtime: Object.freeze({
      aiEnabled: envFlagEnabled(env, 'ACADEMY_AI_ENABLED')
        && next['runtime.ai.enabled'].value,
      ttsEnabled: envFlagEnabled(env, 'ACADEMY_TTS_ENABLED')
        && next['runtime.tts.enabled'].value,
    }),
    quotas: Object.freeze({
      aiRequestsPerAccountDay: Math.min(
        next['quota.ai.requests_per_account_day'].value,
        dailyLimit(env, 'ACADEMY_AI_DAILY_LIMIT', DEFAULT_AI_DAILY_LIMIT),
      ),
      ttsRequestsPerAccountDay: Math.min(
        next['quota.tts.requests_per_account_day'].value,
        dailyLimit(env, 'ACADEMY_TTS_DAILY_LIMIT', DEFAULT_TTS_DAILY_LIMIT),
      ),
    }),
    costThresholds: Object.freeze({
      warningMonthlyMicros: next['cost.warning.monthly_micros'].value,
      criticalMonthlyMicros: next['cost.critical.monthly_micros'].value,
    }),
    ai: Object.freeze({ approvedTiers, defaultTier }),
  })
}

/**
 * Server-owned, short-lived view of durable Admin configuration. Expired or
 * regressed authority is never served stale for provider-enabling decisions.
 */
export function createEffectiveConfigurationReader({
  env = process.env,
  fetchImpl = globalThis.fetch,
  source,
  now = () => Date.now(),
  cacheTtlMs = EFFECTIVE_CONFIGURATION_CACHE_TTL_MS,
  errorTtlMs = EFFECTIVE_CONFIGURATION_ERROR_TTL_MS,
} = {}) {
  const reader = source ?? createAdminConfigurationSource({ env, fetchImpl })
  const availableTtl = boundedTtl(cacheTtlMs, EFFECTIVE_CONFIGURATION_CACHE_TTL_MS)
  const unavailableTtl = boundedTtl(errorTtlMs, EFFECTIVE_CONFIGURATION_ERROR_TTL_MS)
  let cached = null
  let lastObserved = null
  let pending = null

  async function load() {
    const loadedAtMs = milliseconds(now())
    try {
      const next = snapshot(await reader.read())
      const problem = revisionProblem(lastObserved, next)
      if (problem) return unavailable(problem, loadedAtMs, unavailableTtl)
      const result = available(next, env, loadedAtMs, availableTtl)
      lastObserved = next
      return result
    } catch (error) {
      return unavailable(sourceReason(error), loadedAtMs, unavailableTtl)
    }
  }

  return Object.freeze({
    async read({ forceRefresh = false } = {}) {
      const observedAt = milliseconds(now())
      if (!forceRefresh && cached && Date.parse(cached.expiresAt) > observedAt) return cached
      if (!forceRefresh && pending) return pending
      pending = load().then((result) => {
        cached = result
        return result
      }).finally(() => {
        pending = null
      })
      return pending
    },
  })
}

/** Compare monthly calculated usage cost with exact IntegerMicros semantics. */
export function evaluateMonthlyCostThreshold({ rangeKind, calculatedCost, configuration }) {
  const base = {
    basis: 'calculated_usage_estimate',
    observedMicros: null,
    warningMicros: null,
    criticalMicros: null,
    configurationRevisions: null,
  }
  if (rangeKind !== 'month') {
    return Object.freeze({ ...base, status: 'not_applicable', reason: 'range_not_month' })
  }
  if (configuration?.status !== 'available') {
    return Object.freeze({ ...base, status: 'unavailable', reason: 'configuration_unavailable' })
  }
  const warningMicros = configuration.costThresholds.warningMonthlyMicros
  const criticalMicros = configuration.costThresholds.criticalMonthlyMicros
  const configured = {
    ...base,
    warningMicros,
    criticalMicros,
    configurationRevisions: Object.freeze({
      warning: configuration.revisions['cost.warning.monthly_micros'],
      critical: configuration.revisions['cost.critical.monthly_micros'],
    }),
  }
  if (
    !calculatedCost
    || (calculatedCost.status !== 'available' && calculatedCost.status !== 'partial')
    || typeof calculatedCost.micros !== 'string'
    || !isCanonicalIntegerMicros(calculatedCost.micros)
  ) {
    return Object.freeze({ ...configured, status: 'unavailable', reason: 'calculated_cost_unavailable' })
  }
  const observed = BigInt(calculatedCost.micros)
  const withObserved = { ...configured, observedMicros: calculatedCost.micros }
  if (observed >= BigInt(criticalMicros)) {
    return Object.freeze({ ...withObserved, status: 'critical', reason: null })
  }
  if (observed >= BigInt(warningMicros)) {
    return Object.freeze({ ...withObserved, status: 'warning', reason: null })
  }
  if (calculatedCost.status === 'partial') {
    return Object.freeze({ ...withObserved, status: 'unavailable', reason: 'calculated_cost_partial' })
  }
  return Object.freeze({ ...withObserved, status: 'below_warning', reason: null })
}
