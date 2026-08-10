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
export const ADMIN_CONFIGURATION_RUNTIME_STATUS = 'runtime_enforced' as const
export const ADMIN_CONFIGURATION_INTEGRATION_STATUSES = [
  ADMIN_CONFIGURATION_INTEGRATION_STATUS,
  ADMIN_CONFIGURATION_RUNTIME_STATUS,
] as const
export type AdminConfigurationIntegrationStatus =
  (typeof ADMIN_CONFIGURATION_INTEGRATION_STATUSES)[number]

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
  readonly integrationStatus: AdminConfigurationIntegrationStatus
}

export interface AdminConfigurationProjection {
  readonly schemaVersion: typeof ADMIN_CONTRACT_VERSION
  readonly integrationStatus: AdminConfigurationIntegrationStatus
  readonly settings: readonly AdminConfigurationSetting[]
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

export function isAdminConfigurationIntegrationStatus(
  value: unknown,
): value is AdminConfigurationIntegrationStatus {
  return value === ADMIN_CONFIGURATION_INTEGRATION_STATUS
    || value === ADMIN_CONFIGURATION_RUNTIME_STATUS
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
  if (value.registryVersion !== 1 || !isAdminConfigurationIntegrationStatus(value.integrationStatus)) return null
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
    integrationStatus: value.integrationStatus,
  })
}

export function sanitizeAdminConfigurationProjection(
  value: unknown,
): AdminConfigurationProjection | null {
  if (!isRecord(value) || !hasExactKeys(value, ['schemaVersion', 'integrationStatus', 'settings'])) return null
  if (value.schemaVersion !== ADMIN_CONTRACT_VERSION
    || !isAdminConfigurationIntegrationStatus(value.integrationStatus)
    || !Array.isArray(value.settings)
    || value.settings.length !== ADMIN_CONFIGURATION_KEYS.length) return null
  const settings = value.settings.map(sanitizeSetting)
  if (settings.some((setting) => setting === null)) return null
  if (new Set(settings.map((setting) => setting?.key)).size !== ADMIN_CONFIGURATION_KEYS.length) return null
  if (settings.some((setting) => setting?.integrationStatus !== value.integrationStatus)) return null
  return Object.freeze({
    schemaVersion: ADMIN_CONTRACT_VERSION,
    integrationStatus: value.integrationStatus,
    settings: Object.freeze(settings as AdminConfigurationSetting[]),
  })
}

export const CONFIGURATION_READ_CAPABILITY: AdminCapability = 'configuration:read'
export const CONFIGURATION_MANAGE_CAPABILITY: AdminCapability = 'configuration:manage'
