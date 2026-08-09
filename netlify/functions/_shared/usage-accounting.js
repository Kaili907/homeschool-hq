import { randomUUID } from 'node:crypto'
import { reject } from './http.js'

const MAX_USAGE_QUANTITY = 1_000_000_000
const MAX_LATENCY_MS = 300_000
const REQUEST_KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/
const ENGINE_VERSION_ENV = Object.freeze({
  tutor: 'ACADEMY_TUTOR_ENGINE_VERSION',
  jarvis: 'ACADEMY_JARVIS_ENGINE_VERSION',
  tts: 'ACADEMY_TTS_ENGINE_VERSION',
})

function nonnegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_USAGE_QUANTITY
}

function optionalUsageInteger(usage, name) {
  if (!(name in usage)) return 0
  return nonnegativeInteger(usage[name]) ? usage[name] : null
}

export function parseAnthropicUsage(providerData) {
  if (!providerData || typeof providerData !== 'object' || Array.isArray(providerData)) {
    return { kind: 'missing' }
  }
  const usage = providerData.usage
  if (usage === undefined || usage === null) return { kind: 'missing' }
  if (typeof usage !== 'object' || Array.isArray(usage)) return { kind: 'malformed' }

  if (!nonnegativeInteger(usage.input_tokens) || !nonnegativeInteger(usage.output_tokens)) {
    return { kind: 'malformed' }
  }
  const cacheReadInputTokens = optionalUsageInteger(usage, 'cache_read_input_tokens')
  const cacheWriteInputTokens = optionalUsageInteger(usage, 'cache_creation_input_tokens')
  if (cacheReadInputTokens === null || cacheWriteInputTokens === null) {
    return { kind: 'malformed' }
  }

  return {
    kind: 'valid',
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadInputTokens,
    cacheWriteInputTokens,
  }
}

export function usageRequestKey(event, context, createId = randomUUID) {
  const candidates = [context?.awsRequestId, event?.requestContext?.requestId]
  const trusted = candidates.find(
    (value) => typeof value === 'string' && REQUEST_KEY_PATTERN.test(value),
  )
  return trusted ?? createId()
}

export function elapsedMilliseconds(startedAt, now = Date.now()) {
  if (!Number.isFinite(startedAt) || !Number.isFinite(now)) return 0
  return Math.min(MAX_LATENCY_MS, Math.max(0, Math.round(now - startedAt)))
}

export function submittedCharacterCount(text) {
  return Array.from(text).length
}

function optionalVersion(value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !VERSION_PATTERN.test(value)) {
    reject(503, 'service_unavailable')
  }
  return value
}

export function trustedUsageVersions(env, engine) {
  const appVersion = [env?.ACADEMY_APP_VERSION, env?.COMMIT_REF, env?.DEPLOY_ID]
    .find((value) => typeof value === 'string' && value !== '')
  if (typeof appVersion !== 'string' || !VERSION_PATTERN.test(appVersion)) {
    reject(503, 'service_unavailable')
  }
  return {
    appVersion,
    engineVersion: optionalVersion(env?.[ENGINE_VERSION_ENV[engine]]),
    // Current account-authenticated provider calls carry no trusted immutable
    // curriculum binding. Never infer this from browser problem/context data.
    curriculumVersion: null,
  }
}

/** Accounting must never replace the established learner-facing response. */
export async function persistProviderUsage(access, record) {
  try {
    await access.recordProviderUsage(record)
    return true
  } catch {
    return false
  }
}

export const usageAccountingBounds = Object.freeze({
  maxUsageQuantity: MAX_USAGE_QUANTITY,
  maxLatencyMs: MAX_LATENCY_MS,
})
