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
  createGatewayOperationalTelemetry,
  gatewayErrorTerminal,
  recordGatewayTerminal,
} from './_shared/gateway-telemetry.js'
import {
  ELEVENLABS_MODEL_ID,
  TTS_REQUEST_LIMIT_BYTES,
  elevenLabsUrl,
  validateTtsRequest,
} from './_shared/tts-policy.js'
import {
  elapsedMilliseconds,
  persistProviderUsage,
  submittedCharacterCount,
  trustedUsageVersions,
  usageRequestKey,
} from './_shared/usage-accounting.js'
import {
  beginGatewayProviderAttempt,
  createGatewayProviderAttemptJournal,
  finishGatewayProviderAttempt,
  gatewayProviderExecutionKey,
} from './_shared/provider-gateway-attempt.js'

const ALLOWED_PATHS = new Set(['/api/tts/synthesize', '/.netlify/functions/tts'])
// Leaves room for base64 expansion beneath Netlify's buffered response ceiling.
const MAX_AUDIO_BYTES = 4 * 1024 * 1024
const TTS_TIMEOUT_MS = 30_000
const DEFAULT_TTS_DAILY_LIMIT = 100

export function createTtsHandler(overrides = {}) {
  return async (event, context) => {
    if (event?.httpMethod !== 'POST') {
      return errorResponse(405, 'method_not_allowed', { allow: 'POST' })
    }
    if (!ALLOWED_PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')

    const env = overrides.env ?? process.env
    const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
    let finalizeTelemetry
    let telemetryRecorded = false

    try {
      const auth = await verifySupabaseBearer(event, { fetchImpl, env })
      if (!auth.ok) return auth.response

      if (!envFlagEnabled(env, 'ACADEMY_TTS_ENABLED')) {
        return errorResponse(503, 'gateway_disabled')
      }

      const access = overrides.gatewayAccess ?? createGatewayAccess({ env, fetchImpl })
      const entitlement = await access.requireEntitlement(auth.user.id)

      const startedAt = Date.now()
      let requestKey = usageRequestKey(event, context, overrides.requestIdFactory)
      const telemetry = overrides.telemetry
        ?? createGatewayOperationalTelemetry({ env, access })
      let providerReceiptDurationMs
      finalizeTelemetry = async ({
        result, statusCode, reasonCode, accountingAvailable,
      }) => {
        telemetryRecorded = true
        return recordGatewayTerminal(telemetry, {
          requestKey,
          authority: entitlement,
          mode: 'tts',
          operation: 'tts_synthesis',
          provider: 'elevenlabs',
          route: 'tts',
          result,
          statusCode,
          durationMs: providerReceiptDurationMs ?? elapsedMilliseconds(startedAt),
          reasonCode,
          accountingAvailable,
        })
      }

      const request = validateTtsRequest(readJsonBody(event, TTS_REQUEST_LIMIT_BYTES), env)
      requestKey = gatewayProviderExecutionKey({
        event,
        accountRef: auth.user.id,
        engine: 'tts',
        fallbackRequestKey: requestKey,
      })
      const versions = trustedUsageVersions(env, 'tts')
      const apiKey = typeof env.ELEVENLABS_API_KEY === 'string' ? env.ELEVENLABS_API_KEY.trim() : ''
      if (!apiKey) {
        await finalizeTelemetry({
          result: 'provider_error', statusCode: 503, reasonCode: 'service_unavailable',
        })
        return errorResponse(503, 'service_unavailable')
      }

      await access.consumeUsage(
        auth.user.id,
        'tts',
        dailyLimit(env, 'ACADEMY_TTS_DAILY_LIMIT', DEFAULT_TTS_DAILY_LIMIT),
      )

      let upstream
      let bytes
      const providerUrl = elevenLabsUrl(request.voiceId)
      const journal = overrides.providerAttemptJournal
        ?? createGatewayProviderAttemptJournal({ env, access })
      const providerAttempt = await beginGatewayProviderAttempt({
        journal,
        requestKey,
        engine: 'tts',
        purpose: 'tts_synthesis',
        provider: 'elevenlabs',
        providerProductId: ELEVENLABS_MODEL_ID,
        providerModelId: ELEVENLABS_MODEL_ID,
        logicalModelTier: null,
        authority: {
          accountRef: auth.user.id,
          householdRef: entitlement.householdRef,
          householdAttribution: entitlement.householdAttribution,
        },
        versions,
      })
      const recordUsage = async (result, resultReasonCode, billingDisposition) => {
        providerReceiptDurationMs = elapsedMilliseconds(startedAt)
        const finalized = await finishGatewayProviderAttempt({
          journal,
          attempt: providerAttempt,
          outcomeResult: result,
          persistUsage: () => persistProviderUsage(access, {
            requestKey: providerAttempt.ledgerExecutionKey,
            occurredAt: new Date().toISOString(),
            accountRef: auth.user.id,
            householdRef: entitlement.householdRef,
            householdAttribution: entitlement.householdAttribution,
            ...versions,
            engine: 'tts',
            provider: 'elevenlabs',
            providerProductId: ELEVENLABS_MODEL_ID,
            providerModelId: ELEVENLABS_MODEL_ID,
            logicalModelTier: null,
            inputTokens: null,
            outputTokens: null,
            cachedInputReadTokens: null,
            cachedInputWriteTokens: null,
            ttsCharacters: submittedCharacterCount(request.text),
            latencyMs: providerReceiptDurationMs,
            result,
            resultReasonCode,
            billingDisposition,
          }),
        })
        return finalized.accountingAvailable
      }
      const signal = AbortSignal.timeout(TTS_TIMEOUT_MS)
      try {
        upstream = await fetchImpl(providerUrl, {
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
        if (upstream.status === 429) {
          const accountingAvailable = await recordUsage('rejected', 'provider_throttled', 'unknown')
          await finalizeTelemetry({
            result: 'rejected', statusCode: 429, reasonCode: 'provider_throttled',
            accountingAvailable,
          })
          return errorResponse(429, 'usage_limit')
        }
        if (!upstream.ok) {
          const accountingAvailable = await recordUsage('provider_error', 'provider_rejected', 'unknown')
          await finalizeTelemetry({
            result: 'provider_error', statusCode: 502, reasonCode: 'provider_rejected',
            accountingAvailable,
          })
          return errorResponse(502, 'provider_failure')
        }
        const contentType = upstream.headers?.get?.('content-type') ?? ''
        if (!/^audio\/mpeg(?:\s*;|$)/i.test(contentType)) {
          const accountingAvailable = await recordUsage('provider_error', 'invalid_provider_audio', 'billable')
          await finalizeTelemetry({
            result: 'provider_error', statusCode: 502, reasonCode: 'invalid_provider_audio',
            accountingAvailable,
          })
          return errorResponse(502, 'provider_failure')
        }
        bytes = await readBoundedResponseBytes(upstream, MAX_AUDIO_BYTES)
      } catch (error) {
        if (isTimeoutError(error, signal)) {
          const accountingAvailable = await recordUsage('timeout', 'upstream_timeout', 'unknown')
          await finalizeTelemetry({
            result: 'timeout', statusCode: 504, reasonCode: 'upstream_timeout',
            accountingAvailable,
          })
          return errorResponse(504, 'upstream_timeout')
        }
        const reasonCode = upstream?.ok ? 'invalid_provider_audio' : 'provider_transport_error'
        const accountingAvailable = await recordUsage(
          'provider_error',
          reasonCode,
          upstream?.ok ? 'billable' : 'unknown',
        )
        await finalizeTelemetry({
          result: 'provider_error', statusCode: 502, reasonCode,
          accountingAvailable,
        })
        if (error instanceof GatewayError) throw error
        return errorResponse(502, 'provider_failure')
      }
      if (bytes.byteLength === 0) {
        const accountingAvailable = await recordUsage('provider_error', 'invalid_provider_audio', 'billable')
        await finalizeTelemetry({
          result: 'provider_error', statusCode: 502, reasonCode: 'invalid_provider_audio',
          accountingAvailable,
        })
        return errorResponse(502, 'provider_failure')
      }

      const accountingAvailable = await recordUsage('success', null, 'billable')
      await finalizeTelemetry({
        result: 'success', statusCode: 200, reasonCode: 'completed',
        accountingAvailable,
      })

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
      if (finalizeTelemetry && !telemetryRecorded) {
        await finalizeTelemetry(gatewayErrorTerminal(error))
      }
      return responseForError(error)
    }
  }
}

export const handler = createTtsHandler()
