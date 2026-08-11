import { isCanonicalIntegerMicros, type IntegerMicros } from './admin0Vocabulary'

export const PROVIDER_PRICING_SCHEMA_VERSION = 1 as const
export const PROVIDER_PRICING_MAX_INTEGER = 1_000_000_000n

export const PROVIDER_PRICING_PROVIDERS = ['anthropic', 'elevenlabs'] as const
export type ProviderPricingProvider = (typeof PROVIDER_PRICING_PROVIDERS)[number]

export const ANTHROPIC_PRICING_TIERS = ['sonnet', 'haiku'] as const
export type AnthropicPricingTier = (typeof ANTHROPIC_PRICING_TIERS)[number]

export const ANTHROPIC_PRICING_UNITS = [
  'input_token',
  'output_token',
  'cached_input_read_token',
  'request',
] as const
export const ELEVENLABS_PRICING_UNITS = ['tts_character', 'request'] as const
export type ProviderPricingUnit =
  | (typeof ANTHROPIC_PRICING_UNITS)[number]
  | (typeof ELEVENLABS_PRICING_UNITS)[number]

export const PROVIDER_PRICING_REASON_CODES = [
  'operator.request',
  'scheduled.change',
  'corrective.action',
  'configuration.changed',
] as const
export type ProviderPricingReasonCode = (typeof PROVIDER_PRICING_REASON_CODES)[number]

export type ProviderPricingTermStatus = 'published' | 'ended' | 'disabled'

export interface ProviderPricingTerm {
  readonly termId: string
  readonly provider: ProviderPricingProvider
  readonly providerProductId: string
  readonly providerModelId: string
  readonly logicalModelTier: AnthropicPricingTier | null
  readonly usageUnit: ProviderPricingUnit
  readonly priceMicrosPerUnitSize: IntegerMicros
  readonly unitSize: string
  readonly currency: 'USD'
  readonly effectiveFrom: string
  readonly effectiveUntil: string | null
  readonly revision: string
  readonly status: ProviderPricingTermStatus
  readonly supersedesTermId: string | null
  readonly verificationRef: string
  readonly createdAt: string
  readonly createdAuthority: { readonly role: 'owner' }
}

export interface ProviderPricingModel {
  readonly schemaVersion: typeof PROVIDER_PRICING_SCHEMA_VERSION
  readonly pricingStatus: 'pricing_unconfigured' | 'configured'
  readonly currency: 'USD'
  readonly terms: readonly ProviderPricingTerm[]
}

export interface ProviderPricingTermRequest {
  readonly provider: ProviderPricingProvider
  readonly providerProductId: string
  readonly providerModelId: string
  readonly logicalModelTier: AnthropicPricingTier | null
  readonly usageUnit: ProviderPricingUnit
  readonly priceMicrosPerUnitSize: IntegerMicros
  readonly unitSize: string
  readonly effectiveFrom: string
  readonly effectiveUntil: string | null
  readonly replacesTermId: string | null
  readonly verificationRef: string
  readonly reasonCode: ProviderPricingReasonCode
}

export interface ProviderPricingPreview {
  readonly schemaVersion: typeof PROVIDER_PRICING_SCHEMA_VERSION
  readonly operation: 'create' | 'replace'
  readonly expectedRevision: string
  readonly newRevision: string
  readonly term: Omit<
    ProviderPricingTermRequest,
    'verificationRef' | 'reasonCode'
  > & { readonly currency: 'USD' }
  readonly confirmationId: string
  readonly confirmationExpiresAt: string
  readonly confirmationToken: string
}

export interface ProviderPricingMutationResult {
  readonly schemaVersion: typeof PROVIDER_PRICING_SCHEMA_VERSION
  readonly termId: string
  readonly revision: string
  readonly status: ProviderPricingTermStatus
  readonly effectiveFrom?: string
  readonly effectiveUntil: string | null
  readonly supersedesTermId?: string | null
  readonly idempotencyResult: 'created' | 'replayed'
}

export interface ProviderPricingEndRequest {
  readonly termId: string
  readonly expectedRevision: string
  readonly mode: 'end' | 'disable'
  readonly effectiveUntil: string | null
  readonly reasonCode: ProviderPricingReasonCode
  readonly requestId: string
}

export type ProviderPricingErrorCode =
  | 'read_denied'
  | 'manage_denied'
  | 'source_timeout'
  | 'source_unavailable'
  | 'invalid_request'
  | 'unsupported_dimension'
  | 'overlap'
  | 'replacement_invalid'
  | 'revision_conflict'
  | 'status_conflict'
  | 'idempotency_conflict'
  | 'request_in_progress'
  | 'confirmation_expired'
  | 'confirmation_reused'
  | 'confirmation_mismatch'
  | 'confirmation_invalid'
  | 'disable_unsafe'
  | 'end_unsafe'
  | 'term_not_found'

export type ProviderPricingReadState =
  | { readonly status: 'idle' | 'loading' }
  | { readonly status: 'unauthorized' }
  | { readonly status: 'error'; readonly code: 'source_timeout' | 'source_unavailable' }
  | { readonly status: 'ready'; readonly model: ProviderPricingModel }

export interface ProviderPricingDraft {
  readonly provider: '' | ProviderPricingProvider
  readonly providerProductId: string
  readonly providerModelId: string
  readonly logicalModelTier: '' | AnthropicPricingTier
  readonly usageUnit: '' | ProviderPricingUnit
  readonly exactUsd: string
  readonly unitSize: string
  readonly effectiveFrom: string
  readonly effectiveUntil: string
  readonly replacesTermId: string | null
  readonly verificationRef: string
  readonly reasonCode: '' | ProviderPricingReasonCode
}

export type ProviderPricingDraftField = Exclude<keyof ProviderPricingDraft, 'replacesTermId'>
export type ProviderPricingDraftErrors = Partial<Readonly<Record<ProviderPricingDraftField, string>>>

export const EMPTY_PROVIDER_PRICING_DRAFT: ProviderPricingDraft = Object.freeze({
  provider: '',
  providerProductId: '',
  providerModelId: '',
  logicalModelTier: '',
  usageUnit: '',
  exactUsd: '',
  unitSize: '',
  effectiveFrom: '',
  effectiveUntil: '',
  replacesTermId: null,
  verificationRef: '',
  reasonCode: '',
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DECIMAL = /^(0|[1-9]\d*)$/
const POSITIVE_DECIMAL = /^[1-9]\d*$/
const CONFIRMATION_TOKEN = /^[A-Za-z0-9_-]{43}$/
const VERIFICATION_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const SECRET_MARKER = /(?:^|[._:/-])(?:sk|pk|secret|credential|bearer|token|password|jwt|api.?key)(?:[._:/-]|$)/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function canonicalIso(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 40) return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null
}

function boundedIdentifier(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= 120
    && value.trim() === value
    && !/[\u0000-\u001f\u007f]/u.test(value)
}

function boundedDecimal(value: unknown, positive: boolean): value is string {
  if (typeof value !== 'string' || !(positive ? POSITIVE_DECIMAL : DECIMAL).test(value)) return false
  return value.length <= 19 && BigInt(value) <= PROVIDER_PRICING_MAX_INTEGER
}

function validDimension(value: Record<string, unknown>): boolean {
  if (!PROVIDER_PRICING_PROVIDERS.includes(value.provider as ProviderPricingProvider)
    || !boundedIdentifier(value.providerProductId)
    || !boundedIdentifier(value.providerModelId)) return false
  if (value.provider === 'anthropic') {
    return ANTHROPIC_PRICING_TIERS.includes(value.logicalModelTier as AnthropicPricingTier)
      && ANTHROPIC_PRICING_UNITS.includes(value.usageUnit as (typeof ANTHROPIC_PRICING_UNITS)[number])
  }
  return value.logicalModelTier === null
    && ELEVENLABS_PRICING_UNITS.includes(value.usageUnit as (typeof ELEVENLABS_PRICING_UNITS)[number])
}

function validVerificationRef(value: unknown): value is string {
  return typeof value === 'string'
    && VERIFICATION_REF.test(value)
    && !value.includes('://')
    && !SECRET_MARKER.test(value)
}

function parseTerm(value: unknown): ProviderPricingTerm | null {
  if (!hasExactKeys(value, [
    'termId', 'provider', 'providerProductId', 'providerModelId', 'logicalModelTier',
    'usageUnit', 'priceMicrosPerUnitSize', 'unitSize', 'currency', 'effectiveFrom',
    'effectiveUntil', 'revision', 'status', 'supersedesTermId', 'verificationRef',
    'createdAt', 'createdAuthority',
  ]) || !validDimension(value)
    || typeof value.termId !== 'string' || !UUID.test(value.termId)
    || !boundedDecimal(value.priceMicrosPerUnitSize, false)
    || !boundedDecimal(value.unitSize, true)
    || value.currency !== 'USD'
    || typeof value.revision !== 'string' || !POSITIVE_DECIMAL.test(value.revision)
    || typeof value.status !== 'string' || !['published', 'ended', 'disabled'].includes(value.status)
    || !(value.supersedesTermId === null || (typeof value.supersedesTermId === 'string' && UUID.test(value.supersedesTermId)))
    || !validVerificationRef(value.verificationRef)
    || !hasExactKeys(value.createdAuthority, ['role']) || value.createdAuthority.role !== 'owner') return null
  const effectiveFrom = canonicalIso(value.effectiveFrom)
  const effectiveUntil = value.effectiveUntil === null ? null : canonicalIso(value.effectiveUntil)
  const createdAt = canonicalIso(value.createdAt)
  if (!effectiveFrom || (value.effectiveUntil !== null && !effectiveUntil) || !createdAt
    || (effectiveUntil !== null && effectiveUntil <= effectiveFrom)) return null
  return Object.freeze({
    ...(value as unknown as ProviderPricingTerm),
    termId: value.termId.toLowerCase(),
    effectiveFrom,
    effectiveUntil,
    supersedesTermId: typeof value.supersedesTermId === 'string'
      ? value.supersedesTermId.toLowerCase() : null,
    createdAt,
    createdAuthority: Object.freeze({ role: 'owner' as const }),
  })
}

export function parseProviderPricingModel(value: unknown): ProviderPricingModel | null {
  if (!hasExactKeys(value, ['schemaVersion', 'pricingStatus', 'currency', 'terms'])
    || value.schemaVersion !== PROVIDER_PRICING_SCHEMA_VERSION
    || !['pricing_unconfigured', 'configured'].includes(String(value.pricingStatus))
    || value.currency !== 'USD'
    || !Array.isArray(value.terms)
    || value.terms.length > 500) return null
  const terms = value.terms.map(parseTerm)
  if (terms.some((term) => term === null)
    || (terms.length === 0) !== (value.pricingStatus === 'pricing_unconfigured')) return null
  return Object.freeze({
    schemaVersion: PROVIDER_PRICING_SCHEMA_VERSION,
    pricingStatus: value.pricingStatus as ProviderPricingModel['pricingStatus'],
    currency: 'USD',
    terms: Object.freeze(terms as ProviderPricingTerm[]),
  })
}

function parsePreviewTerm(value: unknown): ProviderPricingPreview['term'] | null {
  if (!hasExactKeys(value, [
    'provider', 'providerProductId', 'providerModelId', 'logicalModelTier', 'usageUnit',
    'priceMicrosPerUnitSize', 'unitSize', 'currency', 'effectiveFrom', 'effectiveUntil',
    'replacesTermId',
  ]) || !validDimension(value)
    || !boundedDecimal(value.priceMicrosPerUnitSize, false)
    || !boundedDecimal(value.unitSize, true)
    || value.currency !== 'USD'
    || !(value.replacesTermId === null || (typeof value.replacesTermId === 'string' && UUID.test(value.replacesTermId)))) return null
  const effectiveFrom = canonicalIso(value.effectiveFrom)
  const effectiveUntil = value.effectiveUntil === null ? null : canonicalIso(value.effectiveUntil)
  if (!effectiveFrom || (value.effectiveUntil !== null && !effectiveUntil)
    || (effectiveUntil !== null && effectiveUntil <= effectiveFrom)) return null
  return Object.freeze({
    ...(value as unknown as ProviderPricingPreview['term']),
    effectiveFrom,
    effectiveUntil,
    replacesTermId: typeof value.replacesTermId === 'string'
      ? value.replacesTermId.toLowerCase() : null,
  })
}

export function parseProviderPricingPreview(value: unknown): ProviderPricingPreview | null {
  if (!hasExactKeys(value, [
    'schemaVersion', 'operation', 'expectedRevision', 'newRevision', 'term',
    'confirmationId', 'confirmationExpiresAt', 'confirmationToken',
  ]) || value.schemaVersion !== PROVIDER_PRICING_SCHEMA_VERSION
    || !['create', 'replace'].includes(String(value.operation))
    || typeof value.expectedRevision !== 'string' || !DECIMAL.test(value.expectedRevision)
    || typeof value.newRevision !== 'string' || !POSITIVE_DECIMAL.test(value.newRevision)
    || typeof value.confirmationId !== 'string' || !UUID.test(value.confirmationId)
    || typeof value.confirmationToken !== 'string' || !CONFIRMATION_TOKEN.test(value.confirmationToken)) return null
  const term = parsePreviewTerm(value.term)
  const confirmationExpiresAt = canonicalIso(value.confirmationExpiresAt)
  if (!term || !confirmationExpiresAt
    || (value.operation === 'create') !== (term.replacesTermId === null)) return null
  return Object.freeze({
    schemaVersion: PROVIDER_PRICING_SCHEMA_VERSION,
    operation: value.operation as ProviderPricingPreview['operation'],
    expectedRevision: value.expectedRevision,
    newRevision: value.newRevision,
    term,
    confirmationId: value.confirmationId.toLowerCase(),
    confirmationExpiresAt,
    confirmationToken: value.confirmationToken,
  })
}

export function parseProviderPricingMutationResult(value: unknown): ProviderPricingMutationResult | null {
  const commit = isRecord(value) && Object.hasOwn(value, 'effectiveFrom')
  const keys = commit
    ? ['schemaVersion', 'termId', 'revision', 'status', 'effectiveFrom', 'effectiveUntil', 'supersedesTermId', 'idempotencyResult']
    : ['schemaVersion', 'termId', 'revision', 'status', 'effectiveUntil', 'idempotencyResult']
  if (!hasExactKeys(value, keys)
    || value.schemaVersion !== PROVIDER_PRICING_SCHEMA_VERSION
    || typeof value.termId !== 'string' || !UUID.test(value.termId)
    || typeof value.revision !== 'string' || !POSITIVE_DECIMAL.test(value.revision)
    || typeof value.status !== 'string' || !['published', 'ended', 'disabled'].includes(value.status)
    || typeof value.idempotencyResult !== 'string' || !['created', 'replayed'].includes(value.idempotencyResult)) return null
  const effectiveUntil = value.effectiveUntil === null ? null : canonicalIso(value.effectiveUntil)
  if (value.effectiveUntil !== null && !effectiveUntil) return null
  if (commit) {
    if (value.status !== 'published') return null
    const effectiveFrom = canonicalIso(value.effectiveFrom)
    if (!effectiveFrom || !(value.supersedesTermId === null
      || (typeof value.supersedesTermId === 'string' && UUID.test(value.supersedesTermId)))) return null
    return Object.freeze({
      ...(value as unknown as ProviderPricingMutationResult),
      termId: value.termId.toLowerCase(),
      effectiveFrom,
      effectiveUntil,
      supersedesTermId: typeof value.supersedesTermId === 'string'
        ? value.supersedesTermId.toLowerCase() : null,
    })
  }
  if (!['ended', 'disabled'].includes(value.status)) return null
  return Object.freeze({
    ...(value as unknown as ProviderPricingMutationResult),
    termId: value.termId.toLowerCase(),
    effectiveUntil,
  })
}

/** Exact USD input to canonical IntegerMicros; no Number conversion occurs. */
export function exactUsdToIntegerMicros(value: string):
  | { readonly ok: true; readonly micros: IntegerMicros }
  | { readonly ok: false; readonly message: string } {
  if (!value) return { ok: false, message: 'Enter the exact USD price.' }
  if (value.trim() !== value || /[$,]/.test(value)) {
    return { ok: false, message: 'Use plain USD digits without spaces, currency symbols, or commas.' }
  }
  if (!/^(0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    return { ok: false, message: 'Enter a non-negative USD amount with no leading zeros.' }
  }
  const [dollars, fraction = ''] = value.split('.')
  if (fraction.length > 6) {
    return { ok: false, message: 'USD pricing supports at most six decimal places (one microdollar).' }
  }
  const micros = (BigInt(dollars) * 1_000_000n + BigInt(fraction.padEnd(6, '0') || '0')).toString()
  if (BigInt(micros) > PROVIDER_PRICING_MAX_INTEGER) {
    return { ok: false, message: 'The exact price must not exceed $1,000.000000 USD.' }
  }
  if (!isCanonicalIntegerMicros(micros)) {
    return { ok: false, message: 'The exact USD price could not be represented canonically.' }
  }
  return { ok: true, micros }
}

/** Canonical IntegerMicros to an exact, fixed six-decimal USD representation. */
export function formatExactUsdMicros(value: IntegerMicros): string {
  if (!isCanonicalIntegerMicros(value)) throw new Error('Invalid canonical IntegerMicros value.')
  const micros = BigInt(value)
  const dollars = (micros / 1_000_000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fraction = (micros % 1_000_000n).toString().padStart(6, '0')
  return `$${dollars}.${fraction}`
}

export function formatExactInteger(value: string): string {
  if (!POSITIVE_DECIMAL.test(value)) return value
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function utcDateTimeInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}:00.000Z`)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null
}

export function draftForReplacement(term: ProviderPricingTerm): ProviderPricingDraft {
  return {
    ...EMPTY_PROVIDER_PRICING_DRAFT,
    provider: term.provider,
    providerProductId: term.providerProductId,
    providerModelId: term.providerModelId,
    logicalModelTier: term.logicalModelTier ?? '',
    usageUnit: term.usageUnit,
    unitSize: term.unitSize,
    replacesTermId: term.termId,
  }
}

export function validateProviderPricingDraft(draft: ProviderPricingDraft):
  | { readonly ok: true; readonly request: ProviderPricingTermRequest }
  | { readonly ok: false; readonly errors: ProviderPricingDraftErrors } {
  const errors: Partial<Record<ProviderPricingDraftField, string>> = {}
  if (!PROVIDER_PRICING_PROVIDERS.includes(draft.provider as ProviderPricingProvider)) {
    errors.provider = 'Choose a supported provider.'
  }
  if (!boundedIdentifier(draft.providerProductId)) {
    errors.providerProductId = 'Enter the exact provider product identifier (1–120 characters, without surrounding spaces).'
  }
  if (!boundedIdentifier(draft.providerModelId)) {
    errors.providerModelId = 'Enter the exact provider model identifier (1–120 characters, without surrounding spaces).'
  }
  if (draft.provider === 'anthropic'
    && !ANTHROPIC_PRICING_TIERS.includes(draft.logicalModelTier as AnthropicPricingTier)) {
    errors.logicalModelTier = 'Choose the Anthropic logical model tier.'
  }
  const supportedUnits = draft.provider === 'anthropic'
    ? ANTHROPIC_PRICING_UNITS as readonly string[]
    : draft.provider === 'elevenlabs' ? ELEVENLABS_PRICING_UNITS as readonly string[] : []
  if (!supportedUnits.includes(draft.usageUnit)) {
    errors.usageUnit = 'Choose a unit supported for this provider.'
  }
  const price = exactUsdToIntegerMicros(draft.exactUsd)
  if (!price.ok) errors.exactUsd = price.message
  if (!POSITIVE_DECIMAL.test(draft.unitSize)
    || draft.unitSize.length > 19
    || BigInt(draft.unitSize || '0') > PROVIDER_PRICING_MAX_INTEGER) {
    errors.unitSize = 'Enter a whole unit size from 1 through 1,000,000,000 without commas.'
  }
  const effectiveFrom = utcDateTimeInputToIso(draft.effectiveFrom)
  const effectiveUntil = draft.effectiveUntil ? utcDateTimeInputToIso(draft.effectiveUntil) : null
  if (!effectiveFrom) errors.effectiveFrom = 'Enter a valid effective-from date and time in UTC.'
  if (draft.effectiveUntil && !effectiveUntil) {
    errors.effectiveUntil = 'Enter a valid effective-until date and time in UTC.'
  } else if (effectiveFrom && effectiveUntil && effectiveUntil <= effectiveFrom) {
    errors.effectiveUntil = 'Effective-until must be later than effective-from.'
  }
  if (!validVerificationRef(draft.verificationRef)) {
    errors.verificationRef = 'Use a 1–128 character verification reference without a URL, secret, credential, or token.'
  }
  if (!PROVIDER_PRICING_REASON_CODES.includes(draft.reasonCode as ProviderPricingReasonCode)) {
    errors.reasonCode = 'Choose a reason for this pricing change.'
  }
  if (Object.keys(errors).length > 0 || !price.ok || !effectiveFrom || !draft.provider
    || !draft.usageUnit || !draft.reasonCode) return { ok: false, errors }
  return {
    ok: true,
    request: Object.freeze({
      provider: draft.provider,
      providerProductId: draft.providerProductId,
      providerModelId: draft.providerModelId,
      logicalModelTier: draft.provider === 'anthropic' ? draft.logicalModelTier as AnthropicPricingTier : null,
      usageUnit: draft.usageUnit,
      priceMicrosPerUnitSize: price.micros,
      unitSize: draft.unitSize,
      effectiveFrom,
      effectiveUntil,
      replacesTermId: draft.replacesTermId,
      verificationRef: draft.verificationRef,
      reasonCode: draft.reasonCode,
    }),
  }
}

export type ProviderPricingTiming = 'current' | 'scheduled' | 'historical' | 'disabled'

export function providerPricingTiming(term: ProviderPricingTerm, now: string): ProviderPricingTiming {
  if (term.status === 'disabled') return 'disabled'
  const nowMs = new Date(now).getTime()
  if (new Date(term.effectiveFrom).getTime() > nowMs) return 'scheduled'
  if (term.effectiveUntil !== null && new Date(term.effectiveUntil).getTime() <= nowMs) return 'historical'
  return 'current'
}

export function providerPricingErrorMessage(code: ProviderPricingErrorCode): string {
  const messages: Readonly<Record<ProviderPricingErrorCode, string>> = {
    read_denied: 'This Admin session does not have costs:read access to provider pricing.',
    manage_denied: 'The server did not confirm configuration:manage access for this change.',
    source_timeout: 'The provider pricing request timed out. Try again.',
    source_unavailable: 'Verified provider pricing is temporarily unavailable. No substitute prices are shown.',
    invalid_request: 'The server rejected one or more pricing fields. Review the exact values and try again.',
    unsupported_dimension: 'That provider, tier, and unit combination is not supported by the pricing authority.',
    overlap: 'This effective interval overlaps another term for the same exact pricing dimension.',
    replacement_invalid: 'The selected term can no longer be replaced at that effective boundary. Refresh and review it.',
    revision_conflict: 'Pricing changed after this screen was loaded. Refresh before attempting the change again.',
    status_conflict: 'The term status changed after this screen was loaded. Refresh before attempting the change again.',
    idempotency_conflict: 'This change request identifier was already used for different pricing details.',
    request_in_progress: 'The pricing change is already being processed. Refresh before retrying.',
    confirmation_expired: 'The confirmation expired. Generate a new preview before committing.',
    confirmation_reused: 'That confirmation was already consumed. Refresh pricing before continuing.',
    confirmation_mismatch: 'The confirmation no longer matches the proposed pricing details. Generate a new preview.',
    confirmation_invalid: 'The server could not verify this confirmation. Generate a new preview.',
    disable_unsafe: 'This future term cannot be disabled because it has started or is already referenced by usage.',
    end_unsafe: 'The requested end boundary would invalidate recorded usage or falls outside the safe interval.',
    term_not_found: 'The selected pricing term no longer exists in the authorized projection. Refresh pricing.',
  }
  return messages[code]
}
