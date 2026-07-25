/** Authenticated, policy-owned Netlify gateway for Anthropic Messages. */

import {
  ANTHROPIC_REQUEST_LIMIT_BYTES,
  buildAnthropicProviderBody,
  extractAnthropicText,
  sanitizeGatewayText,
  validateAnthropicRequest,
} from './_shared/anthropic-policy.js'
import {
  envFlagEnabled,
  errorResponse,
  hasQuery,
  jsonResponse,
  readJsonBody,
  responseForError,
} from './_shared/http.js'
import { verifySupabaseBearer } from './_shared/supabase-auth.js'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
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
      // auth.user.id is the verified household identity. It is intentionally
      // neither accepted from the request nor forwarded to the AI provider.

      if (!envFlagEnabled(env, 'ACADEMY_AI_ENABLED')) {
        return errorResponse(503, 'gateway_disabled')
      }

      const request = validateAnthropicRequest(readJsonBody(event, ANTHROPIC_REQUEST_LIMIT_BYTES))

      const apiKey = typeof env.ANTHROPIC_API_KEY === 'string' ? env.ANTHROPIC_API_KEY.trim() : ''
      if (!apiKey) return errorResponse(503, 'service_unavailable')

      let upstream
      try {
        upstream = await fetchImpl(ANTHROPIC_URL, {
          method: 'POST',
          redirect: 'error',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify(buildAnthropicProviderBody(request)),
        })
      } catch {
        return errorResponse(502, 'provider_failure')
      }

      if (upstream.status === 429) return errorResponse(429, 'usage_limit')
      if (!upstream.ok) return errorResponse(502, 'provider_failure')

      let providerData
      try {
        providerData = await upstream.json()
      } catch {
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
