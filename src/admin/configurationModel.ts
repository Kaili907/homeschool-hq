import {
  ADMIN_CONTRACT_VERSION,
  isCanonicalIntegerMicros,
  type AdminCapability,
  type IntegerMicros,
} from './contracts'

export const ADMIN_CONFIGURATION_KEYS = [
  'runtime.ai.enabled',
  'runtime.tts.enabled',
  'quota.ai.requests_per_account_day',
  'quota.tts.requests_per_account_day',
  'cost.warning.monthly_micros',
  'cost.critical.monthly_micros',
  'ai.approved_tiers',
  'ai.default_tier',
] as const

export type AdminConfigurationKey = (typeof ADMIN_CONFIGURATION_KEYS)[number]
export type AdminAiTier = 'sonnet' | 'haiku'
export type AdminConfigurationValue =
  | boolean
  | number
  | IntegerMicros
  | AdminAiTier
  | readonly AdminAiTier[]

export const ADMIN_CONFIGURATION_INTEGRATION_STATUS =
  'pending_runtime_integration' as const
export const ADMIN_CONFIGURATION_RUNTIME_STATUS =
  'partial_runtime_enforcement' as const

/** The saved Admin projection remains the source-of-truth mutation contract. */
export interface AdminConfigurationSetting {
  readonly key: AdminConfigurationKey
  readonly value: AdminConfigurationValue
  readonly revision: string
  readonly requiredCapability: 'configuration:manage'
  readonly protectiveCapability: 'engines:operate' | null
  readonly warningLevel: 'warning' | 'critical'
  readonly bounds: { readonly minimum: string; readonly maximum: string } | null
  readonly allowlist: readonly AdminAiTier[] | null
  readonly deploymentCeilingType:
    | 'boolean_enablement'
    | 'integer_maximum'
    | 'integer_micros_maximum'
    | 'allowlist_subset'
    | 'allowlist_member'
  readonly registryVersion: 1
  readonly integrationStatus: typeof ADMIN_CONFIGURATION_INTEGRATION_STATUS
}

export interface AdminConfigurationProjection {
  readonly schemaVersion: typeof ADMIN_CONTRACT_VERSION
  readonly integrationStatus: typeof ADMIN_CONFIGURATION_INTEGRATION_STATUS
  readonly settings: readonly AdminConfigurationSetting[]
}

// Compatibility names for server callers that distinguish the raw saved contract.
export type AdminSavedConfigurationSetting = AdminConfigurationSetting
export type AdminSavedConfigurationProjection = AdminConfigurationProjection

export type AdminRuntimeConfigurationClassification =
  | 'ENFORCEABLE_NOW'
  | 'NOT_YET_ENFORCEABLE'
  | 'UNSUPPORTED'
export type AdminRuntimeConfigurationEnforcement = 'enforced' | 'unavailable' | 'error'
export type AdminRuntimeConfigurationResolution =
  | 'saved'
  | 'constraint'
  | 'fallback'
  | 'unavailable'
  | 'error'
export type AdminRuntimeConfigurationReason =
  | 'saved_value_enforced'
  | 'deployment_disabled'
  | 'deployment_quota_ceiling'
  | 'safe_fallback_disabled'
  | 'safe_fallback_quota_ceiling'
  | 'browser_speech_fallback'
  | 'runtime_consumer_unavailable'
  | 'configuration_resolution_failed'
export type AdminRuntimeConfigurationTrustedConsumer =
  | 'anthropic_gateway'
  | 'tts_gateway'
export type AdminRuntimeConfigurationStudyStatus = 'unavailable' | 'not_applicable'

export interface AdminRuntimeConfigurationState {
  readonly classification: AdminRuntimeConfigurationClassification
  readonly effectiveValue: AdminConfigurationValue | null
  readonly enforcement: AdminRuntimeConfigurationEnforcement
  readonly resolution: AdminRuntimeConfigurationResolution
  readonly reason: AdminRuntimeConfigurationReason
  readonly trustedConsumer: AdminRuntimeConfigurationTrustedConsumer | null
  readonly studyStatus: AdminRuntimeConfigurationStudyStatus
}

export interface AdminRuntimeConfigurationSetting extends AdminConfigurationSetting {
  readonly runtime: AdminRuntimeConfigurationState
}

/** Strict browser projection; saved values and runtime-effective values stay separate. */
export interface AdminRuntimeConfigurationProjection {
  readonly schemaVersion: typeof ADMIN_CONTRACT_VERSION
  readonly integrationStatus: typeof ADMIN_CONFIGURATION_INTEGRATION_STATUS
  readonly runtimeStatus: typeof ADMIN_CONFIGURATION_RUNTIME_STATUS
  readonly settings: readonly AdminRuntimeConfigurationSetting[]
}

const KEY_SET = new Set<string>(ADMIN_CONFIGURATION_KEYS)
const TIERS = new Set<AdminAiTier>(['sonnet', 'haiku'])
const POSITIVE_REVISION = /^[1-9]\d*$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

export function isAdminConfigurationKey(value: unknown): value is AdminConfigurationKey {
  return typeof value === 'string' && KEY_SET.has(value)
}

export function isAdminConfigurationValue(
  key: AdminConfigurationKey,
  value: unknown,
): value is AdminConfigurationValue {
  if (key === 'runtime.ai.enabled' || key === 'runtime.tts.enabled') {
    return typeof value === 'boolean'
  }
  if (key === 'quota.ai.requests_per_account_day') {
    return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 200
  }
  if (key === 'quota.tts.requests_per_account_day') {
    return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 1000
  }
  if (key === 'cost.warning.monthly_micros' || key === 'cost.critical.monthly_micros') {
    return typeof value === 'string'
      && isCanonicalIntegerMicros(value)
      && BigInt(value) >= 1n
      && BigInt(value) <= 1_000_000_000_000n
  }
  if (key === 'ai.default_tier') return value === 'sonnet' || value === 'haiku'
  return Array.isArray(value)
    && value.length >= 1
    && value.length <= 2
    && value.every((tier): tier is AdminAiTier => typeof tier === 'string' && TIERS.has(tier as AdminAiTier))
    && new Set(value).size === value.length
}

function sanitizeBounds(value: unknown) {
  if (value === null) return null
  if (!isRecord(value) || !hasExactKeys(value, ['minimum', 'maximum'])) return undefined
  if (typeof value.minimum !== 'string' || typeof value.maximum !== 'string') return undefined
  return Object.freeze({ minimum: value.minimum, maximum: value.maximum })
}

function sanitizeAllowlist(value: unknown) {
  if (value === null) return null
  if (!Array.isArray(value) || value.length !== 2 || value[0] !== 'sonnet' || value[1] !== 'haiku') {
    return undefined
  }
  return Object.freeze(['sonnet', 'haiku'] as const)
}

function sanitizeSetting(value: unknown): AdminConfigurationSetting | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    'key', 'value', 'revision', 'requiredCapability', 'protectiveCapability',
    'warningLevel', 'bounds', 'allowlist', 'deploymentCeilingType',
    'registryVersion', 'integrationStatus',
  ])) return null
  if (!isAdminConfigurationKey(value.key) || !isAdminConfigurationValue(value.key, value.value)) return null
  if (typeof value.revision !== 'string' || !POSITIVE_REVISION.test(value.revision)) return null
  if (value.requiredCapability !== 'configuration:manage') return null
  if (value.protectiveCapability !== null && value.protectiveCapability !== 'engines:operate') return null
  if (value.warningLevel !== 'warning' && value.warningLevel !== 'critical') return null
  const bounds = sanitizeBounds(value.bounds)
  const allowlist = sanitizeAllowlist(value.allowlist)
  if (bounds === undefined || allowlist === undefined) return null
  if (![
    'boolean_enablement', 'integer_maximum', 'integer_micros_maximum',
    'allowlist_subset', 'allowlist_member',
  ].includes(String(value.deploymentCeilingType))) return null
  if (value.registryVersion !== 1 || value.integrationStatus !== ADMIN_CONFIGURATION_INTEGRATION_STATUS) return null
  const protectiveExpected = value.key === 'runtime.ai.enabled' || value.key === 'runtime.tts.enabled'
  if ((value.protectiveCapability === 'engines:operate') !== protectiveExpected) return null
  return Object.freeze({
    key: value.key,
    value: value.value,
    revision: value.revision,
    requiredCapability: value.requiredCapability,
    protectiveCapability: value.protectiveCapability,
    warningLevel: value.warningLevel,
    bounds,
    allowlist,
    deploymentCeilingType: value.deploymentCeilingType as AdminConfigurationSetting['deploymentCeilingType'],
    registryVersion: 1,
    integrationStatus: ADMIN_CONFIGURATION_INTEGRATION_STATUS,
  })
}

export function sanitizeAdminConfigurationProjection(
  value: unknown,
): AdminConfigurationProjection | null {
  if (!isRecord(value) || !hasExactKeys(value, ['schemaVersion', 'integrationStatus', 'settings'])) return null
  if (value.schemaVersion !== ADMIN_CONTRACT_VERSION
    || value.integrationStatus !== ADMIN_CONFIGURATION_INTEGRATION_STATUS
    || !Array.isArray(value.settings)
    || value.settings.length !== ADMIN_CONFIGURATION_KEYS.length) return null
  const settings = value.settings.map(sanitizeSetting)
  if (settings.some((setting) => setting === null)) return null
  if (new Set(settings.map((setting) => setting?.key)).size !== ADMIN_CONFIGURATION_KEYS.length) return null
  return Object.freeze({
    schemaVersion: ADMIN_CONTRACT_VERSION,
    integrationStatus: ADMIN_CONFIGURATION_INTEGRATION_STATUS,
    settings: Object.freeze(settings as AdminConfigurationSetting[]),
  })
}

export const sanitizeSavedAdminConfigurationProjection = sanitizeAdminConfigurationProjection

export const ADMIN_RUNTIME_CONFIGURATION_CLASSIFICATIONS = Object.freeze({
  'runtime.ai.enabled': 'ENFORCEABLE_NOW',
  'runtime.tts.enabled': 'ENFORCEABLE_NOW',
  'quota.ai.requests_per_account_day': 'ENFORCEABLE_NOW',
  'quota.tts.requests_per_account_day': 'ENFORCEABLE_NOW',
  'cost.warning.monthly_micros': 'NOT_YET_ENFORCEABLE',
  'cost.critical.monthly_micros': 'NOT_YET_ENFORCEABLE',
  'ai.approved_tiers': 'ENFORCEABLE_NOW',
  'ai.default_tier': 'ENFORCEABLE_NOW',
} satisfies Readonly<Record<AdminConfigurationKey, AdminRuntimeConfigurationClassification>>)

export const ADMIN_RUNTIME_CONFIGURATION_TRUSTED_CONSUMERS = Object.freeze({
  'runtime.ai.enabled': 'anthropic_gateway',
  'runtime.tts.enabled': 'tts_gateway',
  'quota.ai.requests_per_account_day': 'anthropic_gateway',
  'quota.tts.requests_per_account_day': 'tts_gateway',
  'cost.warning.monthly_micros': null,
  'cost.critical.monthly_micros': null,
  'ai.approved_tiers': 'anthropic_gateway',
  'ai.default_tier': 'anthropic_gateway',
} satisfies Readonly<Record<AdminConfigurationKey, AdminRuntimeConfigurationTrustedConsumer | null>>)

const RUNTIME_ENFORCEMENTS = new Set<AdminRuntimeConfigurationEnforcement>([
  'enforced', 'unavailable', 'error',
])
const RUNTIME_RESOLUTIONS = new Set<AdminRuntimeConfigurationResolution>([
  'saved', 'constraint', 'fallback', 'unavailable', 'error',
])
const RUNTIME_REASONS = new Set<AdminRuntimeConfigurationReason>([
  'saved_value_enforced',
  'deployment_disabled',
  'deployment_quota_ceiling',
  'safe_fallback_disabled',
  'safe_fallback_quota_ceiling',
  'browser_speech_fallback',
  'runtime_consumer_unavailable',
  'configuration_resolution_failed',
])

function resolutionMatchesReason(
  resolution: AdminRuntimeConfigurationResolution,
  reason: AdminRuntimeConfigurationReason,
): boolean {
  if (resolution === 'saved') return reason === 'saved_value_enforced'
  if (resolution === 'constraint') {
    return reason === 'deployment_disabled' || reason === 'deployment_quota_ceiling'
  }
  if (resolution === 'fallback') {
    return reason === 'safe_fallback_disabled'
      || reason === 'safe_fallback_quota_ceiling'
      || reason === 'browser_speech_fallback'
  }
  if (resolution === 'unavailable') return reason === 'runtime_consumer_unavailable'
  return reason === 'configuration_resolution_failed'
}

function sanitizeRuntimeState(
  key: AdminConfigurationKey,
  value: unknown,
): AdminRuntimeConfigurationState | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    'classification', 'effectiveValue', 'enforcement', 'resolution',
    'reason', 'trustedConsumer', 'studyStatus',
  ])) return null
  if (value.classification !== ADMIN_RUNTIME_CONFIGURATION_CLASSIFICATIONS[key]
    || !RUNTIME_ENFORCEMENTS.has(value.enforcement as AdminRuntimeConfigurationEnforcement)
    || !RUNTIME_RESOLUTIONS.has(value.resolution as AdminRuntimeConfigurationResolution)
    || !RUNTIME_REASONS.has(value.reason as AdminRuntimeConfigurationReason)
    || value.trustedConsumer !== ADMIN_RUNTIME_CONFIGURATION_TRUSTED_CONSUMERS[key]) return null

  const classification = value.classification as AdminRuntimeConfigurationClassification
  const enforcement = value.enforcement as AdminRuntimeConfigurationEnforcement
  const resolution = value.resolution as AdminRuntimeConfigurationResolution
  const reason = value.reason as AdminRuntimeConfigurationReason
  if (!resolutionMatchesReason(resolution, reason)) return null

  if (classification === 'NOT_YET_ENFORCEABLE') {
    if (value.effectiveValue !== null
      || enforcement !== 'unavailable'
      || resolution !== 'unavailable'
      || value.studyStatus !== 'not_applicable') return null
  } else {
    if (!isAdminConfigurationValue(key, value.effectiveValue)
      || enforcement !== 'enforced'
      || resolution === 'unavailable'
      || value.studyStatus !== 'unavailable') return null
  }

  return Object.freeze({
    classification,
    effectiveValue: Array.isArray(value.effectiveValue)
      ? Object.freeze([...value.effectiveValue])
      : value.effectiveValue as AdminConfigurationValue | null,
    enforcement,
    resolution,
    reason,
    trustedConsumer: value.trustedConsumer as AdminRuntimeConfigurationTrustedConsumer | null,
    studyStatus: value.studyStatus as AdminRuntimeConfigurationStudyStatus,
  })
}

function sanitizeRuntimeSetting(value: unknown): AdminRuntimeConfigurationSetting | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    'key', 'value', 'revision', 'requiredCapability', 'protectiveCapability',
    'warningLevel', 'bounds', 'allowlist', 'deploymentCeilingType',
    'registryVersion', 'integrationStatus', 'runtime',
  ])) return null
  const { runtime: rawRuntime, ...rawSetting } = value
  const saved = sanitizeSetting(rawSetting)
  if (!saved) return null
  const runtime = sanitizeRuntimeState(saved.key, rawRuntime)
  return runtime ? Object.freeze({ ...saved, runtime }) : null
}

export function sanitizeAdminRuntimeConfigurationProjection(
  value: unknown,
): AdminRuntimeConfigurationProjection | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    'schemaVersion', 'integrationStatus', 'runtimeStatus', 'settings',
  ])) return null
  if (value.schemaVersion !== ADMIN_CONTRACT_VERSION
    || value.integrationStatus !== ADMIN_CONFIGURATION_INTEGRATION_STATUS
    || value.runtimeStatus !== ADMIN_CONFIGURATION_RUNTIME_STATUS
    || !Array.isArray(value.settings)
    || value.settings.length !== ADMIN_CONFIGURATION_KEYS.length) return null
  const settings = value.settings.map(sanitizeRuntimeSetting)
  if (settings.some((setting) => setting === null)) return null
  if (new Set(settings.map((setting) => setting?.key)).size !== ADMIN_CONFIGURATION_KEYS.length) return null
  return Object.freeze({
    schemaVersion: ADMIN_CONTRACT_VERSION,
    integrationStatus: ADMIN_CONFIGURATION_INTEGRATION_STATUS,
    runtimeStatus: ADMIN_CONFIGURATION_RUNTIME_STATUS,
    settings: Object.freeze(settings as AdminRuntimeConfigurationSetting[]),
  })
}

export const CONFIGURATION_READ_CAPABILITY: AdminCapability = 'configuration:read'
export const CONFIGURATION_MANAGE_CAPABILITY: AdminCapability = 'configuration:manage'
