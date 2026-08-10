import { createClient } from '@supabase/supabase-js'

const SOURCE_TIMEOUT_MS = 5_000
const DECIMAL = /^(0|[1-9]\d*)$/
const POSITIVE_DECIMAL = /^[1-9]\d*$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PROVIDERS = new Set(['anthropic', 'elevenlabs'])
const TIERS = new Set(['sonnet', 'haiku'])
const UNITS = new Set([
  'input_token', 'output_token', 'cached_input_read_token',
  'tts_character', 'request',
])
const STATUSES = new Set(['published', 'ended', 'disabled'])
const VERIFICATION_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/

export class AdminProviderPricingSourceError extends Error {
  constructor(code) {
    super(code)
    this.name = 'AdminProviderPricingSourceError'
    this.code = code
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(value, keys) {
  if (!isRecord(value)) return false
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index])
}

function canonicalIso(value) {
  if (typeof value !== 'string' || value.length > 40) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function boundedIdentifier(value) {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= 120
    && value.trim() === value
    && !/[\u0000-\u001f\u007f]/u.test(value)
}

function validDimension(value) {
  if (!isRecord(value)
    || !PROVIDERS.has(value.provider)
    || !boundedIdentifier(value.providerProductId)
    || !boundedIdentifier(value.providerModelId)
    || !UNITS.has(value.usageUnit)) return false
  return value.provider === 'anthropic'
    ? TIERS.has(value.logicalModelTier)
      && ['input_token', 'output_token', 'cached_input_read_token', 'request'].includes(value.usageUnit)
    : value.logicalModelTier === null
      && ['tts_character', 'request'].includes(value.usageUnit)
}

function validMoney(value, positive) {
  if (typeof value !== 'string'
    || !(positive ? POSITIVE_DECIMAL : DECIMAL).test(value)
    || value.length > 19) return false
  const parsed = BigInt(value)
  return parsed <= 1_000_000_000n && (!positive || parsed > 0n)
}

function safeTerm(value) {
  if (!hasExactKeys(value, [
    'termId', 'provider', 'providerProductId', 'providerModelId',
    'logicalModelTier', 'usageUnit', 'priceMicrosPerUnitSize', 'unitSize',
    'currency', 'effectiveFrom', 'effectiveUntil', 'revision', 'status',
    'supersedesTermId', 'verificationRef', 'createdAt', 'createdAuthority',
  ])) return null
  if (!UUID.test(value.termId)
    || !validDimension(value)
    || !validMoney(value.priceMicrosPerUnitSize, false)
    || !validMoney(value.unitSize, true)
    || value.currency !== 'USD'
    || canonicalIso(value.effectiveFrom) === null
    || !(value.effectiveUntil === null || canonicalIso(value.effectiveUntil) !== null)
    || typeof value.revision !== 'string'
    || !POSITIVE_DECIMAL.test(value.revision)
    || !STATUSES.has(value.status)
    || !(value.supersedesTermId === null || (
      typeof value.supersedesTermId === 'string' && UUID.test(value.supersedesTermId)
    ))
    || typeof value.verificationRef !== 'string'
    || !VERIFICATION_REF.test(value.verificationRef)
    || value.verificationRef.includes('://')
    || /(?:^|[._:/-])(?:sk|pk|secret|credential|bearer|token|password|jwt|api.?key)(?:[._:/-]|$)/i
      .test(value.verificationRef)
    || canonicalIso(value.createdAt) === null
    || !hasExactKeys(value.createdAuthority, ['role'])
    || value.createdAuthority.role !== 'owner') return null
  return Object.freeze({
    ...value,
    termId: value.termId.toLowerCase(),
    effectiveFrom: canonicalIso(value.effectiveFrom),
    effectiveUntil: value.effectiveUntil === null ? null : canonicalIso(value.effectiveUntil),
    supersedesTermId: value.supersedesTermId?.toLowerCase() ?? null,
    createdAt: canonicalIso(value.createdAt),
    createdAuthority: Object.freeze({ role: 'owner' }),
  })
}

function safeRead(value) {
  if (!hasExactKeys(value, ['schemaVersion', 'pricingStatus', 'currency', 'terms'])
    || value.schemaVersion !== 1
    || !['pricing_unconfigured', 'configured'].includes(value.pricingStatus)
    || value.currency !== 'USD'
    || !Array.isArray(value.terms)
    || value.terms.length > 500) return null
  const terms = value.terms.map(safeTerm)
  if (terms.some((term) => term === null)
    || (value.terms.length === 0) !== (value.pricingStatus === 'pricing_unconfigured')) return null
  return Object.freeze({
    schemaVersion: 1,
    pricingStatus: value.pricingStatus,
    currency: 'USD',
    terms: Object.freeze(terms),
  })
}

function safePreview(value) {
  if (!hasExactKeys(value, [
    'schemaVersion', 'operation', 'expectedRevision', 'newRevision', 'term',
    'confirmationId', 'confirmationExpiresAt',
  ])
    || value.schemaVersion !== 1
    || !['create', 'replace'].includes(value.operation)
    || typeof value.expectedRevision !== 'string'
    || !DECIMAL.test(value.expectedRevision)
    || typeof value.newRevision !== 'string'
    || !POSITIVE_DECIMAL.test(value.newRevision)
    || typeof value.confirmationId !== 'string'
    || !UUID.test(value.confirmationId)
    || canonicalIso(value.confirmationExpiresAt) === null
    || !hasExactKeys(value.term, [
      'provider', 'providerProductId', 'providerModelId', 'logicalModelTier',
      'usageUnit', 'priceMicrosPerUnitSize', 'unitSize', 'currency',
      'effectiveFrom', 'effectiveUntil', 'replacesTermId',
    ])
    || !validDimension(value.term)
    || !validMoney(value.term.priceMicrosPerUnitSize, false)
    || !validMoney(value.term.unitSize, true)
    || value.term.currency !== 'USD'
    || canonicalIso(value.term.effectiveFrom) === null
    || !(value.term.effectiveUntil === null || canonicalIso(value.term.effectiveUntil) !== null)
    || !(value.term.replacesTermId === null || UUID.test(value.term.replacesTermId))) return null
  return Object.freeze({
    ...value,
    confirmationId: value.confirmationId.toLowerCase(),
    confirmationExpiresAt: canonicalIso(value.confirmationExpiresAt),
    term: Object.freeze({
      ...value.term,
      effectiveFrom: canonicalIso(value.term.effectiveFrom),
      effectiveUntil: value.term.effectiveUntil === null
        ? null : canonicalIso(value.term.effectiveUntil),
      replacesTermId: value.term.replacesTermId?.toLowerCase() ?? null,
    }),
  })
}

function safeMutation(value) {
  const isCommit = isRecord(value) && Object.hasOwn(value, 'effectiveFrom')
  const keys = isCommit
    ? ['schemaVersion', 'termId', 'revision', 'status', 'effectiveFrom',
      'effectiveUntil', 'supersedesTermId', 'idempotencyResult']
    : ['schemaVersion', 'termId', 'revision', 'status', 'effectiveUntil', 'idempotencyResult']
  if (!hasExactKeys(value, keys)
    || value.schemaVersion !== 1
    || typeof value.termId !== 'string'
    || !UUID.test(value.termId)
    || typeof value.revision !== 'string'
    || !POSITIVE_DECIMAL.test(value.revision)
    || !STATUSES.has(value.status)
    || !(value.effectiveUntil === null || canonicalIso(value.effectiveUntil) !== null)
    || !['created', 'replayed'].includes(value.idempotencyResult)
    || (isCommit && (
      canonicalIso(value.effectiveFrom) === null
      || !(value.supersedesTermId === null || UUID.test(value.supersedesTermId))
    ))) return null
  return Object.freeze({
    ...value,
    termId: value.termId.toLowerCase(),
    ...(isCommit ? {
      effectiveFrom: canonicalIso(value.effectiveFrom),
      supersedesTermId: value.supersedesTermId?.toLowerCase() ?? null,
    } : {}),
    effectiveUntil: value.effectiveUntil === null ? null : canonicalIso(value.effectiveUntil),
  })
}

function supabaseUrl(env) {
  const raw = (env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || '').trim()
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return url.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

function sourceCode(error) {
  const message = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ')
  const mappings = [
    ['PROVIDER_PRICING_DIMENSION_UNSUPPORTED', 'unsupported_dimension'],
    ['PROVIDER_PRICING_OVERLAP', 'overlap'],
    ['PROVIDER_PRICING_REPLACEMENT_INVALID', 'replacement_invalid'],
    ['PROVIDER_PRICING_REVISION_CONFLICT', 'revision_conflict'],
    ['PROVIDER_PRICING_STATUS_CONFLICT', 'status_conflict'],
    ['PROVIDER_PRICING_IDEMPOTENCY_CONFLICT', 'idempotency_conflict'],
    ['PROVIDER_PRICING_REQUEST_IN_PROGRESS', 'request_in_progress'],
    ['PROVIDER_PRICING_CONFIRMATION_EXPIRED', 'confirmation_expired'],
    ['PROVIDER_PRICING_CONFIRMATION_REUSED', 'confirmation_reused'],
    ['PROVIDER_PRICING_CONFIRMATION_MISMATCH', 'confirmation_mismatch'],
    ['PROVIDER_PRICING_CONFIRMATION_INVALID', 'confirmation_invalid'],
    ['PROVIDER_PRICING_DISABLE_UNSAFE', 'disable_unsafe'],
    ['PROVIDER_PRICING_END_UNSAFE', 'end_unsafe'],
    ['PROVIDER_PRICING_TERM_NOT_FOUND', 'term_not_found'],
    ['PROVIDER_PRICING_MANAGE_REQUIRED', 'manage_required'],
    ['PROVIDER_PRICING_READ_REQUIRED', 'read_required'],
    ['PROVIDER_PRICING_REQUEST_INVALID', 'invalid_request'],
  ]
  return mappings.find(([marker]) => message.includes(marker))?.[1] ?? 'source_unavailable'
}

export function createAdminProviderPricingSource({
  env,
  fetchImpl,
  serviceClient,
  mutationClientFactory,
} = {}) {
  let reader = serviceClient

  function getReader() {
    if (reader) return reader
    const url = supabaseUrl(env)
    const key = (env?.SUPABASE_SERVICE_ROLE_KEY || '').trim()
    if (!url || !key) return null
    reader = createClient(url, key, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { fetch: fetchImpl },
    })
    return reader
  }

  function getWriter(accessToken) {
    if (mutationClientFactory) return mutationClientFactory(accessToken)
    const url = supabaseUrl(env)
    const key = (env?.SUPABASE_ANON_KEY || env?.VITE_SUPABASE_ANON_KEY || '').trim()
    if (!url || !key) return null
    return createClient(url, key, {
      accessToken: async () => accessToken,
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { fetch: fetchImpl },
    })
  }

  async function invoke(client, rpc, parameters, sanitize) {
    if (!client) throw new AdminProviderPricingSourceError('source_unavailable')
    const signal = AbortSignal.timeout(SOURCE_TIMEOUT_MS)
    try {
      const builder = client.rpc(rpc, parameters)
      const { data, error } = typeof builder.abortSignal === 'function'
        ? await builder.abortSignal(signal)
        : await builder
      if (signal.aborted) throw new AdminProviderPricingSourceError('source_timeout')
      if (error) throw new AdminProviderPricingSourceError(sourceCode(error))
      const projection = sanitize(data)
      if (!projection) throw new AdminProviderPricingSourceError('source_unavailable')
      return projection
    } catch (error) {
      if (error instanceof AdminProviderPricingSourceError) throw error
      if (signal.aborted || error?.name === 'TimeoutError') {
        throw new AdminProviderPricingSourceError('source_timeout')
      }
      throw new AdminProviderPricingSourceError('source_unavailable')
    }
  }

  const termParameters = (request) => ({
    p_provider: request.provider,
    p_provider_product_id: request.providerProductId,
    p_provider_model_id: request.providerModelId,
    p_logical_model_tier: request.logicalModelTier,
    p_usage_unit: request.usageUnit,
    p_price_micros: request.priceMicrosPerUnitSize,
    p_unit_quantity: request.unitSize,
    p_effective_from: request.effectiveFrom,
    p_effective_until: request.effectiveUntil,
    p_replaces_term_id: request.replacesTermId,
    p_verification_ref: request.verificationRef,
    p_reason_code: request.reasonCode,
  })

  return Object.freeze({
    async read() {
      return invoke(getReader(), 'academy_admin_read_provider_pricing_terms_v1', {
        p_required_capability: 'costs:read',
      }, safeRead)
    },
    async preview(accessToken, request, confirmationDigest) {
      return invoke(
        getWriter(accessToken),
        'academy_admin_preview_provider_pricing_term_v1',
        {
          ...termParameters(request),
          p_confirmation_digest: confirmationDigest,
          p_required_capability: 'configuration:manage',
        },
        safePreview,
      )
    },
    async commit(accessToken, request, confirmationDigest) {
      return invoke(
        getWriter(accessToken),
        'academy_admin_commit_provider_pricing_term_v1',
        {
          ...termParameters(request),
          p_expected_revision: request.expectedRevision,
          p_request_id: request.requestId,
          p_confirmation_digest: confirmationDigest,
          p_required_capability: 'configuration:manage',
        },
        safeMutation,
      )
    },
    async end(accessToken, request) {
      return invoke(
        getWriter(accessToken),
        'academy_admin_end_provider_pricing_term_v1',
        {
          p_term_id: request.termId,
          p_expected_revision: request.expectedRevision,
          p_mode: request.mode,
          p_effective_until: request.effectiveUntil,
          p_reason_code: request.reasonCode,
          p_request_id: request.requestId,
          p_required_capability: 'configuration:manage',
        },
        safeMutation,
      )
    },
  })
}
