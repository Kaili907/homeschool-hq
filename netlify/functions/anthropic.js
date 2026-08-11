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
  errorResponse,
  hasQuery,
  isTimeoutError,
  jsonResponse,
  readBoundedResponseBytes,
  readJsonBody,
  reject,
  responseForError,
} from './_shared/http.js'
import { verifySupabaseBearer } from './_shared/supabase-auth.js'
import { createGatewayAccess } from './_shared/gateway-access.js'
import { createEffectiveConfigurationReader } from './_shared/effective-configuration.js'
import {
  createGatewayOperationalTelemetry,
  gatewayErrorTerminal,
  recordGatewayTerminal,
} from './_shared/gateway-telemetry.js'
import {
  elapsedMilliseconds,
  parseAnthropicUsage,
  persistProviderUsage,
  trustedUsageVersions,
  usageRequestKey,
} from './_shared/usage-accounting.js'
import {
  beginGatewayProviderAttempt,
  createGatewayProviderAttemptJournal,
  finishGatewayProviderAttempt,
  gatewayProviderExecutionKey,
} from './_shared/provider-gateway-attempt.js'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const ANTHROPIC_TIMEOUT_MS = 30_000
const MAX_ANTHROPIC_RESPONSE_BYTES = 256 * 1024
const ALLOWED_PATHS = new Set(['/api/anthropic/v1/messages', '/.netlify/functions/anthropic'])

export function createAnthropicHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
  const configurationReader = overrides.effectiveConfigurationReader
    ?? createEffectiveConfigurationReader({ env, fetchImpl })
  return async (event, context) => {
    if (event?.httpMethod !== 'POST') {
      return errorResponse(405, 'method_not_allowed', { allow: 'POST' })
    }
    if (!ALLOWED_PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')

    let finalizeTelemetry
    let telemetryRecorded = false

    try {
      const auth = await verifySupabaseBearer(event, { fetchImpl, env })
      if (!auth.ok) return auth.response

      const startedAt = Date.now()
      const access = overrides.gatewayAccess ?? createGatewayAccess({ env, fetchImpl })
      let authority = Object.freeze({
        householdRef: null,
        householdAttribution: 'lookup_unavailable',
      })
      let requestKey = usageRequestKey(event, context, overrides.requestIdFactory)
      const telemetry = overrides.telemetry
        ?? createGatewayOperationalTelemetry({ env, access })
      let mode
      let providerReceiptDurationMs
      finalizeTelemetry = async ({
        result, statusCode, reasonCode, accountingAvailable,
      }) => {
        telemetryRecorded = true
        return recordGatewayTerminal(telemetry, {
          requestKey,
          authority,
          mode,
          operation: 'anthropic_messages',
          provider: 'anthropic',
          route: 'anthropic',
          result,
          statusCode,
          durationMs: providerReceiptDurationMs ?? elapsedMilliseconds(startedAt),
          reasonCode,
          accountingAvailable,
        })
      }

      const rawRequest = readJsonBody(event, ANTHROPIC_REQUEST_LIMIT_BYTES)
      const callerSelectedTier = Object.prototype.hasOwnProperty.call(rawRequest, 'modelTier')
      const validatedRequest = validateAnthropicRequest(rawRequest)
      let configuration
      try {
        configuration = await configurationReader.read()
      } catch {
        reject(503, 'configuration_unavailable')
      }
      if (configuration.status !== 'available') reject(503, 'configuration_unavailable')
      if (!configuration.runtime.aiEnabled) reject(503, 'gateway_disabled')
      const selectedTier = callerSelectedTier
        ? validatedRequest.modelTier
        : configuration.ai.defaultTier
      if (!configuration.ai.approvedTiers.includes(selectedTier)) {
        reject(403, 'model_tier_not_approved')
      }
      const request = Object.freeze({ ...validatedRequest, modelTier: selectedTier })

      const entitlement = await access.requireEntitlement(auth.user.id)
      authority = entitlement

      mode = request.mode
      requestKey = gatewayProviderExecutionKey({
        event,
        accountRef: auth.user.id,
        engine: request.mode,
        fallbackRequestKey: requestKey,
      })
      const versions = trustedUsageVersions(env, request.mode)

      const apiKey = typeof env.ANTHROPIC_API_KEY === 'string' ? env.ANTHROPIC_API_KEY.trim() : ''
      if (!apiKey) {
        await finalizeTelemetry({
          result: 'provider_error', statusCode: 503, reasonCode: 'service_unavailable',
        })
        return errorResponse(503, 'service_unavailable')
      }

      await access.consumeUsage(
        auth.user.id,
        'anthropic',
        configuration.quotas.aiRequestsPerAccountDay,
      )

      let upstream
      let providerData
      const providerBody = buildAnthropicProviderBody(request)
      const journal = overrides.providerAttemptJournal
        ?? createGatewayProviderAttemptJournal({ env, access })
      const providerAttempt = await beginGatewayProviderAttempt({
        journal,
        requestKey,
        engine: request.mode,
        purpose: request.mode === 'tutor' ? 'tutor_turn' : 'jarvis_turn',
        provider: 'anthropic',
        providerProductId: providerBody.model,
        providerModelId: providerBody.model,
        logicalModelTier: request.modelTier,
        authority: {
          accountRef: auth.user.id,
          householdRef: entitlement.householdRef,
          householdAttribution: entitlement.householdAttribution,
        },
        versions,
      })
      const recordUsage = async (result, resultReasonCode, usage, billingDisposition) => {
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
            engine: request.mode,
            provider: 'anthropic',
            logicalModelTier: request.modelTier,
            providerProductId: providerBody.model,
            providerModelId: providerBody.model,
            inputTokens: usage?.inputTokens,
            outputTokens: usage?.outputTokens,
            cachedInputReadTokens: usage?.cacheReadInputTokens,
            cachedInputWriteTokens: usage?.cacheWriteInputTokens,
            ttsCharacters: null,
            latencyMs: providerReceiptDurationMs,
            result,
            resultReasonCode,
            billingDisposition,
          }),
        })
        return finalized.accountingAvailable
      }
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
          const accountingAvailable = await recordUsage('rejected', 'provider_throttled', null, 'unknown')
          await finalizeTelemetry({
            result: 'rejected', statusCode: 429, reasonCode: 'provider_throttled',
            accountingAvailable,
          })
          return errorResponse(429, 'usage_limit')
        }
        if (!upstream.ok) {
          const accountingAvailable = await recordUsage('provider_error', 'provider_rejected', null, 'unknown')
          await finalizeTelemetry({
            result: 'provider_error', statusCode: 502, reasonCode: 'provider_rejected',
            accountingAvailable,
          })
          return errorResponse(502, 'provider_failure')
        }

        const bytes = await readBoundedResponseBytes(upstream, MAX_ANTHROPIC_RESPONSE_BYTES)
        providerData = JSON.parse(new TextDecoder().decode(bytes))
      } catch (error) {
        if (isTimeoutError(error, signal)) {
          const accountingAvailable = await recordUsage('timeout', 'upstream_timeout', null, 'unknown')
          await finalizeTelemetry({
            result: 'timeout', statusCode: 504, reasonCode: 'upstream_timeout',
            accountingAvailable,
          })
          return errorResponse(504, 'upstream_timeout')
        }
        const reasonCode = 'invalid_provider_response'
        const accountingAvailable = await recordUsage(
          'provider_error',
          reasonCode,
          null,
          upstream?.ok ? 'billable' : 'unknown',
        )
        await finalizeTelemetry({
          result: 'provider_error', statusCode: 502, reasonCode, accountingAvailable,
        })
        if (error instanceof GatewayError) throw error
        return errorResponse(502, 'provider_failure')
      }
      const usage = parseAnthropicUsage(providerData)
      let text
      try {
        text = sanitizeGatewayText(request, extractAnthropicText(providerData))
      } catch (error) {
        const reasonCode = 'response_sanitization_rejected'
        const accountingAvailable = await recordUsage(
          'validation_error',
          reasonCode,
          usage.kind === 'valid' ? usage : null,
          'billable',
        )
        await finalizeTelemetry({
          result: 'validation_error', statusCode: 502, reasonCode, accountingAvailable,
        })
        throw error
      }
      if (!text) {
        const reasonCode = 'response_sanitization_rejected'
        const accountingAvailable = await recordUsage(
          'validation_error',
          reasonCode,
          usage.kind === 'valid' ? usage : null,
          'billable',
        )
        await finalizeTelemetry({
          result: 'validation_error', statusCode: 502, reasonCode, accountingAvailable,
        })
        return errorResponse(502, 'provider_failure')
      }

      const usageReason = usage.kind === 'valid' ? null : `${usage.kind}_provider_usage`
      const accountingAvailable = await recordUsage(
        'success',
        usageReason,
        usage.kind === 'valid' ? usage : null,
        'billable',
      )

      await finalizeTelemetry({
        result: 'success',
        statusCode: 200,
        reasonCode: usageReason ?? 'completed',
        accountingAvailable,
      })
      return jsonResponse(200, { text })
    } catch (error) {
      if (finalizeTelemetry && !telemetryRecorded) {
        await finalizeTelemetry(gatewayErrorTerminal(error))
      }
      return responseForError(error)
    }
  }
}

export const handler = createAnthropicHandler()
