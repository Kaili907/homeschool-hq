/** Authenticated, single-operation Netlify gateway for ElevenLabs TTS. */

import {
  GatewayError,
  envFlagEnabled,
  errorResponse,
  hasQuery,
  isTimeoutError,
  readBoundedResponseBytes,
  readJsonBody,
  responseForError,
} from './_shared/http.js'
import { verifySupabaseBearer } from './_shared/supabase-auth.js'
import { createGatewayAccess, dailyLimit } from './_shared/gateway-access.js'
import {
  ELEVENLABS_MODEL_ID,
  TTS_REQUEST_LIMIT_BYTES,
  elevenLabsUrl,
  validateTtsRequest,
} from './_shared/tts-policy.js'

const ALLOWED_PATHS = new Set(['/api/tts/synthesize', '/.netlify/functions/tts'])
// Leaves room for base64 expansion beneath Netlify's buffered response ceiling.
const MAX_AUDIO_BYTES = 4 * 1024 * 1024
const TTS_TIMEOUT_MS = 30_000
const DEFAULT_TTS_DAILY_LIMIT = 100

export function createTtsHandler(overrides = {}) {
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

      if (!envFlagEnabled(env, 'ACADEMY_TTS_ENABLED')) {
        return errorResponse(503, 'gateway_disabled')
      }

      const access = overrides.gatewayAccess ?? createGatewayAccess({ env, fetchImpl })
      await access.requireEntitlement(auth.user.id)

      const request = validateTtsRequest(readJsonBody(event, TTS_REQUEST_LIMIT_BYTES), env)
      const apiKey = typeof env.ELEVENLABS_API_KEY === 'string' ? env.ELEVENLABS_API_KEY.trim() : ''
      if (!apiKey) return errorResponse(503, 'service_unavailable')

      await access.consumeUsage(
        auth.user.id,
        'tts',
        dailyLimit(env, 'ACADEMY_TTS_DAILY_LIMIT', DEFAULT_TTS_DAILY_LIMIT),
      )

      let upstream
      let bytes
      const signal = AbortSignal.timeout(TTS_TIMEOUT_MS)
      try {
        upstream = await fetchImpl(elevenLabsUrl(request.voiceId), {
          method: 'POST',
          redirect: 'error',
          signal,
          headers: {
            'xi-api-key': apiKey,
            'content-type': 'application/json',
            accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text: request.text,
            model_id: ELEVENLABS_MODEL_ID,
          }),
        })
        if (upstream.status === 429) return errorResponse(429, 'usage_limit')
        if (!upstream.ok) return errorResponse(502, 'provider_failure')
        const contentType = upstream.headers?.get?.('content-type') ?? ''
        if (!/^audio\/mpeg(?:\s*;|$)/i.test(contentType)) {
          return errorResponse(502, 'provider_failure')
        }
        bytes = await readBoundedResponseBytes(upstream, MAX_AUDIO_BYTES)
      } catch (error) {
        if (isTimeoutError(error, signal)) return errorResponse(504, 'upstream_timeout')
        if (error instanceof GatewayError) throw error
        return errorResponse(502, 'provider_failure')
      }
      if (bytes.byteLength === 0) {
        return errorResponse(502, 'provider_failure')
      }

      return {
        statusCode: 200,
        headers: {
          'content-type': 'audio/mpeg',
          'cache-control': 'private, no-store, max-age=0',
          'x-content-type-options': 'nosniff',
        },
        body: Buffer.from(bytes).toString('base64'),
        isBase64Encoded: true,
      }
    } catch (error) {
      return responseForError(error)
    }
  }
}

export const handler = createTtsHandler()
