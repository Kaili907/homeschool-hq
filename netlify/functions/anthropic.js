/** Authenticated, policy-owned Netlify gateway for Anthropic Messages. */

import {
  ANTHROPIC_REQUEST_LIMIT_BYTES,
  buildAnthropicProviderBody,
  extractAnthropicText,
  sanitizeGatewayText,
  validateAnthropicRequest,
} from './_shared/anthropic-policy.js'
import {
  GatewayError,
  envFlagEnabled,
  errorResponse,
  hasQuery,
  isTimeoutError,
  jsonResponse,
  readBoundedResponseBytes,
  readJsonBody,
  responseForError,
} from './_shared/http.js'
import { verifySupabaseBearer } from './_shared/supabase-auth.js'
import { createGatewayAccess, dailyLimit } from './_shared/gateway-access.js'
import {
  elapsedMilliseconds,
  parseAnthropicUsage,
  persistProviderUsage,
  usageRequestKey,
} from './_shared/usage-accounting.js'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const ANTHROPIC_TIMEOUT_MS = 30_000
const MAX_ANTHROPIC_RESPONSE_BYTES = 256 * 1024
const DEFAULT_ANTHROPIC_DAILY_LIMIT = 50
const ALLOWED_PATHS = new Set(['/api/anthropic/v1/messages', '/.netlify/functions/anthropic'])

export function createAnthropicHandler(overrides = {}) {
  return async (event, context) => {
    if (event?.httpMethod !== 'POST') {
      return errorResponse(405, 'method_not_allowed', { allow: 'POST' })
    }
    if (!ALLOWED_PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')

    const env = overrides.env ?? process.env
    const fetchImpl = overrides.fetchImpl ?? globalThis.fetch

    try {
      const auth = await verifySupabaseBearer(event, { fetchImpl, env })
      if (!auth.ok) return auth.response

      if (!envFlagEnabled(env, 'ACADEMY_AI_ENABLED')) {
        return errorResponse(503, 'gateway_disabled')
      }

      const access = overrides.gatewayAccess ?? createGatewayAccess({ env, fetchImpl })
      await access.requireEntitlement(auth.user.id)

      const request = validateAnthropicRequest(readJsonBody(event, ANTHROPIC_REQUEST_LIMIT_BYTES))

      const apiKey = typeof env.ANTHROPIC_API_KEY === 'string' ? env.ANTHROPIC_API_KEY.trim() : ''
      if (!apiKey) return errorResponse(503, 'service_unavailable')

      await access.consumeUsage(
        auth.user.id,
        'anthropic',
        dailyLimit(env, 'ACADEMY_AI_DAILY_LIMIT', DEFAULT_ANTHROPIC_DAILY_LIMIT),
      )

      let upstream
      let providerData
      const providerBody = buildAnthropicProviderBody(request)
      const occurredAt = new Date().toISOString()
      const startedAt = Date.now()
      const requestKey = usageRequestKey(event, context, overrides.requestIdFactory)
      const recordUsage = async (status, usage, billingBasis) =>
        persistProviderUsage(access, {
          requestKey,
          occurredAt,
          userId: auth.user.id,
          engine: request.mode,
          provider: 'anthropic',
          logicalModelTier: request.modelTier,
          providerProduct: providerBody.model,
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
          cacheReadInputTokens: usage?.cacheReadInputTokens,
          cacheWriteInputTokens: usage?.cacheWriteInputTokens,
          latencyMs: elapsedMilliseconds(startedAt),
          status,
          billingBasis,
        })
      const signal = AbortSignal.timeout(ANTHROPIC_TIMEOUT_MS)
      try {
        upstream = await fetchImpl(ANTHROPIC_URL, {
          method: 'POST',
          redirect: 'error',
          signal,
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify(providerBody),
        })
        if (upstream.status === 429) {
          await recordUsage('provider_throttled', null, 'none')
          return errorResponse(429, 'usage_limit')
        }
        if (!upstream.ok) {
          await recordUsage('provider_error', null, 'unknown')
          return errorResponse(502, 'provider_failure')
        }

        const bytes = await readBoundedResponseBytes(upstream, MAX_ANTHROPIC_RESPONSE_BYTES)
        providerData = JSON.parse(new TextDecoder().decode(bytes))
      } catch (error) {
        if (isTimeoutError(error, signal)) {
          await recordUsage('timeout', null, 'unknown')
          return errorResponse(504, 'upstream_timeout')
        }
        await recordUsage('provider_error', null, 'unknown')
        if (error instanceof GatewayError) throw error
        return errorResponse(502, 'provider_failure')
      }
      const usage = parseAnthropicUsage(providerData)
      let text
      try {
        text = sanitizeGatewayText(request, extractAnthropicText(providerData))
      } catch (error) {
        await recordUsage(
          'response_sanitization_failure',
          usage.kind === 'valid' ? usage : null,
          usage.kind === 'valid' ? 'estimate' : 'unknown',
        )
        throw error
      }
      if (!text) {
        await recordUsage(
          'response_sanitization_failure',
          usage.kind === 'valid' ? usage : null,
          usage.kind === 'valid' ? 'estimate' : 'unknown',
        )
        return errorResponse(502, 'provider_failure')
      }

      await recordUsage(
        usage.kind === 'valid' ? 'success' : `${usage.kind}_usage`,
        usage.kind === 'valid' ? usage : null,
        usage.kind === 'valid' ? 'estimate' : 'unknown',
      )

      return jsonResponse(200, { text })
    } catch (error) {
      return responseForError(error)
    }
  }
}

export const handler = createAnthropicHandler()
