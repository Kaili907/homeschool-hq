import { createHash, randomBytes } from 'node:crypto'
import { createAdminAuthorization } from './_shared/admin-authorization.js'
import {
  ADMIN_CRITICAL_ACTIONS,
  createAdminCriticalActionEnforcer,
} from './_shared/admin-critical-actions.js'
import {
  AdminProviderPricingSourceError,
  createAdminProviderPricingSource,
} from './_shared/admin-provider-pricing-source.js'
import {
  assertExactObject,
  errorResponse,
  hasQuery,
  jsonResponse,
  readJsonBody,
  reject,
  responseForError,
} from './_shared/http.js'

const READ_PATHS = new Set([
  '/api/admin/v1/provider-pricing-terms',
  '/.netlify/functions/admin-provider-pricing-terms',
])
const PREVIEW_PATH = '/api/admin/v1/provider-pricing-terms/preview'
const COMMIT_PATH = '/api/admin/v1/provider-pricing-terms/commit'
const END_PATH = '/api/admin/v1/provider-pricing-terms/end'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DECIMAL = /^(0|[1-9]\d{0,18})$/
const POSITIVE_DECIMAL = /^[1-9]\d{0,18}$/
const CONFIRMATION_TOKEN = /^[A-Za-z0-9_-]{43}$/
const IDENTIFIER = /^[^\u0000-\u001f\u007f]{1,120}$/u
const VERIFICATION_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const REASONS = new Set([
  'operator.request', 'scheduled.change', 'corrective.action', 'configuration.changed',
])
const ANTHROPIC_UNITS = new Set([
  'input_token', 'output_token', 'cached_input_read_token', 'request',
])
const ELEVENLABS_UNITS = new Set(['tts_character', 'request'])

function decimal(value, positive = false) {
  if (typeof value !== 'string'
    || !(positive ? POSITIVE_DECIMAL : DECIMAL).test(value)
    || BigInt(value) > 1_000_000_000n) reject(400, 'invalid_request')
  return value
}

function revision(value, allowZero = false) {
  const pattern = allowZero ? DECIMAL : POSITIVE_DECIMAL
  if (typeof value !== 'string'
    || !pattern.test(value)
    || BigInt(value) > 9_223_372_036_854_775_807n) reject(400, 'invalid_request')
  return value
}

function uuid(value) {
  if (typeof value !== 'string' || !UUID.test(value)) reject(400, 'invalid_request')
  return value.toLowerCase()
}

function timestamp(value) {
  if (typeof value !== 'string' || value.length > 40) reject(400, 'invalid_request')
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) reject(400, 'invalid_request')
  return parsed.toISOString()
}

function identifier(value) {
  if (typeof value !== 'string' || value.trim() !== value || !IDENTIFIER.test(value)) {
    reject(400, 'invalid_request')
  }
  return value
}

function termRequest(body, optionalKeys = []) {
  assertExactObject(body, [
    'provider', 'providerProductId', 'providerModelId', 'logicalModelTier',
    'usageUnit', 'priceMicrosPerUnitSize', 'unitSize', 'effectiveFrom',
    'effectiveUntil', 'replacesTermId', 'verificationRef', 'reasonCode',
  ], optionalKeys)
  const providerProductId = identifier(body.providerProductId)
  const providerModelId = identifier(body.providerModelId)
  const effectiveFrom = timestamp(body.effectiveFrom)
  const effectiveUntil = body.effectiveUntil === null ? null : timestamp(body.effectiveUntil)
  if (effectiveUntil !== null && effectiveUntil <= effectiveFrom) reject(400, 'invalid_request')
  if (typeof body.verificationRef !== 'string'
    || !VERIFICATION_REF.test(body.verificationRef)
    || body.verificationRef.includes('://')
    || /(?:^|[._:/-])(?:sk|pk|secret|credential|bearer|token|password|jwt|api.?key)(?:[._:/-]|$)/i
      .test(body.verificationRef)
    || typeof body.reasonCode !== 'string'
    || !REASONS.has(body.reasonCode)) reject(400, 'invalid_request')

  if (body.provider === 'anthropic') {
    if (!['sonnet', 'haiku'].includes(body.logicalModelTier)
      || !ANTHROPIC_UNITS.has(body.usageUnit)) reject(400, 'unsupported_dimension')
  } else if (body.provider === 'elevenlabs') {
    if (body.logicalModelTier !== null
      || !ELEVENLABS_UNITS.has(body.usageUnit)) reject(400, 'unsupported_dimension')
  } else reject(400, 'unsupported_dimension')

  return {
    provider: body.provider,
    providerProductId,
    providerModelId,
    logicalModelTier: body.logicalModelTier,
    usageUnit: body.usageUnit,
    priceMicrosPerUnitSize: decimal(body.priceMicrosPerUnitSize),
    unitSize: decimal(body.unitSize, true),
    effectiveFrom,
    effectiveUntil,
    replacesTermId: body.replacesTermId === null ? null : uuid(body.replacesTermId),
    verificationRef: body.verificationRef,
    reasonCode: body.reasonCode,
  }
}

export function parseProviderPricingPreviewRequest(event) {
  return Object.freeze(termRequest(readJsonBody(event, 4_096)))
}

export function parseProviderPricingCommitRequest(event) {
  const body = readJsonBody(event, 4_096)
  const term = termRequest(body, ['expectedRevision', 'requestId', 'confirmationToken'])
  if (typeof body.confirmationToken !== 'string' || !CONFIRMATION_TOKEN.test(body.confirmationToken)) {
    reject(400, 'invalid_request')
  }
  return Object.freeze({
    ...term,
    expectedRevision: revision(body.expectedRevision, true),
    requestId: uuid(body.requestId),
    confirmationToken: body.confirmationToken,
  })
}

export function parseProviderPricingEndRequest(event) {
  const body = readJsonBody(event, 2_048)
  assertExactObject(body, [
    'termId', 'expectedRevision', 'mode', 'effectiveUntil', 'reasonCode', 'requestId',
  ])
  if (!['end', 'disable'].includes(body.mode)
    || (body.mode === 'end') !== (body.effectiveUntil !== null)
    || typeof body.reasonCode !== 'string'
    || !REASONS.has(body.reasonCode)) reject(400, 'invalid_request')
  return Object.freeze({
    termId: uuid(body.termId),
    expectedRevision: revision(body.expectedRevision),
    mode: body.mode,
    effectiveUntil: body.effectiveUntil === null ? null : timestamp(body.effectiveUntil),
    reasonCode: body.reasonCode,
    requestId: uuid(body.requestId),
  })
}

function digest(token) {
  return createHash('sha256').update(token).digest('hex')
}

function errorForSource(error) {
  if (!(error instanceof AdminProviderPricingSourceError)) return responseForError(error)
  if (error.code === 'source_timeout') return errorResponse(504, 'provider_pricing_source_timeout')
  if (['source_unavailable', 'read_required'].includes(error.code)) {
    return errorResponse(503, 'provider_pricing_source_unavailable')
  }
  if (error.code === 'manage_required') return errorResponse(403, 'admin_access_denied')
  if ([
    'overlap', 'revision_conflict', 'status_conflict', 'idempotency_conflict',
    'request_in_progress', 'confirmation_expired', 'confirmation_reused',
  ].includes(error.code)) return errorResponse(409, error.code)
  if (['disable_unsafe', 'end_unsafe'].includes(error.code)) return errorResponse(409, error.code)
  if ([
    'unsupported_dimension', 'replacement_invalid', 'confirmation_mismatch',
    'confirmation_invalid', 'term_not_found', 'invalid_request',
  ].includes(error.code)) return errorResponse(400, error.code)
  return errorResponse(503, 'provider_pricing_source_unavailable')
}

export function createAdminProviderPricingTermsHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
  const authorization = overrides.authorization ?? createAdminAuthorization({
    env,
    fetchImpl,
    client: overrides.authorizationClient,
    authVerifier: overrides.authVerifier,
  })
  const source = overrides.source ?? createAdminProviderPricingSource({
    env,
    fetchImpl,
    serviceClient: overrides.serviceClient,
    mutationClientFactory: overrides.mutationClientFactory,
  })
  const tokenFactory = overrides.tokenFactory ?? (() => randomBytes(32).toString('base64url'))
  const criticalActions = overrides.criticalActions ?? createAdminCriticalActionEnforcer({
    stepUpAssurance: overrides.stepUpAssurance,
    audit: overrides.criticalActionAudit,
    now: overrides.criticalActionNow,
  })

  return async (event) => {
    const path = event?.path ?? ''
    const isRead = event?.httpMethod === 'GET' && READ_PATHS.has(path)
    const isPreview = event?.httpMethod === 'POST' && path === PREVIEW_PATH
    const isCommit = event?.httpMethod === 'POST' && path === COMMIT_PATH
    const isEnd = event?.httpMethod === 'POST' && path === END_PATH
    if (!isRead && !isPreview && !isCommit && !isEnd) {
      if (READ_PATHS.has(path)) return errorResponse(405, 'method_not_allowed', { allow: 'GET' })
      if ([PREVIEW_PATH, COMMIT_PATH, END_PATH].includes(path)) {
        return errorResponse(405, 'method_not_allowed', { allow: 'POST' })
      }
      return errorResponse(404, 'not_found')
    }
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')

    const capability = isRead ? 'costs:read' : 'configuration:manage'
    const authorized = await authorization.require(event, capability)
    if (!authorized.ok) return authorized.response
    try {
      if (isRead) return jsonResponse(200, await source.read())
      if (isPreview) {
        const request = parseProviderPricingPreviewRequest(event)
        const confirmationToken = tokenFactory()
        if (typeof confirmationToken !== 'string' || !CONFIRMATION_TOKEN.test(confirmationToken)) {
          throw new AdminProviderPricingSourceError('source_unavailable')
        }
        const preview = await source.preview(
          authorized.accessToken,
          request,
          digest(confirmationToken),
        )
        return jsonResponse(200, { ...preview, confirmationToken })
      }
      if (isCommit) {
        const request = parseProviderPricingCommitRequest(event)
        const resourceId = [
          request.provider,
          request.providerProductId,
          request.providerModelId,
          request.logicalModelTier ?? 'none',
          request.usageUnit,
          request.effectiveFrom,
        ].map(encodeURIComponent).join('/')
        const assured = await criticalActions.enforce(event, {
          actorId: authorized.principal.userId,
          action: ADMIN_CRITICAL_ACTIONS.COMMIT_PROVIDER_PRICING,
          resource: { type: 'provider-pricing-dimension', id: resourceId },
        })
        if (!assured.ok) return assured.response
        const { confirmationToken, ...immutableRequest } = request
        return jsonResponse(200, await source.commit(
          authorized.accessToken,
          immutableRequest,
          digest(confirmationToken),
        ))
      }
      const request = parseProviderPricingEndRequest(event)
      const assured = await criticalActions.enforce(event, {
        actorId: authorized.principal.userId,
        action: ADMIN_CRITICAL_ACTIONS.END_PROVIDER_PRICING,
        resource: { type: 'provider-pricing-term', id: request.termId },
      })
      if (!assured.ok) return assured.response
      return jsonResponse(200, await source.end(authorized.accessToken, request))
    } catch (error) {
      return errorForSource(error)
    }
  }
}

export const handler = createAdminProviderPricingTermsHandler()
