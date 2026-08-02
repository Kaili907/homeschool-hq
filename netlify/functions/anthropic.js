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

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const ANTHROPIC_TIMEOUT_MS = 30_000
const MAX_ANTHROPIC_RESPONSE_BYTES = 256 * 1024
const DEFAULT_ANTHROPIC_DAILY_LIMIT = 50
const ALLOWED_PATHS = new Set(['/api/anthropic/v1/messages', '/.netlify/functions/anthropic'])

export function createAnthropicHandler(overrides = {}) {
  return async (event) => {
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
          body: JSON.stringify(buildAnthropicProviderBody(request)),
        })
        if (upstream.status === 429) return errorResponse(429, 'usage_limit')
        if (!upstream.ok) return errorResponse(502, 'provider_failure')

        const bytes = await readBoundedResponseBytes(upstream, MAX_ANTHROPIC_RESPONSE_BYTES)
        providerData = JSON.parse(new TextDecoder().decode(bytes))
      } catch (error) {
        if (isTimeoutError(error, signal)) return errorResponse(504, 'upstream_timeout')
        if (error instanceof GatewayError) throw error
        return errorResponse(502, 'provider_failure')
      }
      const text = sanitizeGatewayText(request, extractAnthropicText(providerData))
      if (!text) return errorResponse(502, 'provider_failure')

      return jsonResponse(200, { text })
    } catch (error) {
      return responseForError(error)
    }
  }
}

export const handler = createAnthropicHandler()
