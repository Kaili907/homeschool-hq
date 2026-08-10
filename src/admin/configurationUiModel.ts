import {
  type AdminAiTier,
  type AdminConfigurationKey,
  type AdminConfigurationProjection,
  type AdminConfigurationSetting,
  type AdminConfigurationValue,
  isAdminConfigurationValue,
} from './configurationModel'

export type AdminConfigurationDraft = boolean | string | readonly AdminAiTier[]

export type AdminConfigurationDraftResult =
  | { readonly ok: true; readonly value: AdminConfigurationValue }
  | { readonly ok: false; readonly error: string }

export const ADMIN_CONFIGURATION_REASON_OPTIONS = [
  ['operator.request', 'Operator request'],
  ['scheduled.change', 'Scheduled change'],
  ['policy.enforcement', 'Policy enforcement'],
  ['incident.response', 'Incident response'],
  ['corrective.action', 'Corrective action'],
  ['emergency.response', 'Emergency response'],
  ['configuration.changed', 'Configuration change'],
] as const

export type AdminConfigurationReasonCode =
  (typeof ADMIN_CONFIGURATION_REASON_OPTIONS)[number][0]

const USD_INPUT = /^(0|[1-9]\d*)(?:\.(\d{1,6}))?$/

function settingValue(
  projection: AdminConfigurationProjection,
  key: AdminConfigurationKey,
): AdminConfigurationValue | null {
  return projection.settings.find((setting) => setting.key === key)?.value ?? null
}

function microsFromUsd(input: string): string | null {
  const match = USD_INPUT.exec(input.trim())
  if (!match) return null
  const whole = BigInt(match[1])
  const fraction = (match[2] ?? '').padEnd(6, '0')
  return (whole * 1_000_000n + BigInt(fraction || '0')).toString()
}

export function usdFromMicros(value: string): string {
  const micros = BigInt(value)
  const whole = micros / 1_000_000n
  const fraction = (micros % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole.toString()
}

export function draftForAdminConfigurationSetting(
  setting: AdminConfigurationSetting,
): AdminConfigurationDraft {
  if (setting.key === 'cost.warning.monthly_micros'
    || setting.key === 'cost.critical.monthly_micros') {
    return usdFromMicros(setting.value as string)
  }
  if (Array.isArray(setting.value)) return [...setting.value]
  if (typeof setting.value === 'number') return String(setting.value)
  return setting.value as boolean | string
}

export function parseAdminConfigurationDraft(
  key: AdminConfigurationKey,
  draft: AdminConfigurationDraft,
  projection: AdminConfigurationProjection,
): AdminConfigurationDraftResult {
  let value: AdminConfigurationValue
  if (key === 'runtime.ai.enabled' || key === 'runtime.tts.enabled') {
    if (typeof draft !== 'boolean') return { ok: false, error: 'Choose enabled or disabled.' }
    value = draft
  } else if (key === 'quota.ai.requests_per_account_day'
    || key === 'quota.tts.requests_per_account_day') {
    if (typeof draft !== 'string' || !/^[1-9]\d*$/.test(draft.trim())) {
      return { ok: false, error: 'Enter a whole-number daily request limit.' }
    }
    value = Number(draft)
  } else if (key === 'cost.warning.monthly_micros'
    || key === 'cost.critical.monthly_micros') {
    if (typeof draft !== 'string') return { ok: false, error: 'Enter a valid USD amount.' }
    const micros = microsFromUsd(draft)
    if (micros === null) {
      return { ok: false, error: 'Enter USD with no more than six decimal places.' }
    }
    value = micros
  } else if (key === 'ai.approved_tiers') {
    if (!Array.isArray(draft)) return { ok: false, error: 'Choose at least one approved tier.' }
    value = draft
  } else {
    if (draft !== 'sonnet' && draft !== 'haiku') {
      return { ok: false, error: 'Choose an approved logical AI tier.' }
    }
    value = draft
  }

  if (!isAdminConfigurationValue(key, value)) {
    if (key === 'quota.ai.requests_per_account_day') {
      return { ok: false, error: 'AI requests must be between 1 and 200 per account per day.' }
    }
    if (key === 'quota.tts.requests_per_account_day') {
      return { ok: false, error: 'TTS requests must be between 1 and 1,000 per account per day.' }
    }
    if (key.startsWith('cost.')) {
      return { ok: false, error: 'The monthly amount must be between $0.000001 and $1,000,000.' }
    }
    return { ok: false, error: 'Choose at least one unique approved logical tier.' }
  }

  if (key === 'cost.warning.monthly_micros') {
    const critical = settingValue(projection, 'cost.critical.monthly_micros')
    if (typeof critical !== 'string' || BigInt(value as string) >= BigInt(critical)) {
      return { ok: false, error: 'The warning amount must remain below the critical amount.' }
    }
  }
  if (key === 'cost.critical.monthly_micros') {
    const warning = settingValue(projection, 'cost.warning.monthly_micros')
    if (typeof warning !== 'string' || BigInt(value as string) <= BigInt(warning)) {
      return { ok: false, error: 'The critical amount must remain above the warning amount.' }
    }
  }
  if (key === 'ai.approved_tiers') {
    const currentDefault = settingValue(projection, 'ai.default_tier')
    if (typeof currentDefault !== 'string' || !(value as readonly string[]).includes(currentDefault)) {
      return { ok: false, error: 'Approved tiers must retain the current default tier.' }
    }
  }
  if (key === 'ai.default_tier') {
    const approved = settingValue(projection, 'ai.approved_tiers')
    if (!Array.isArray(approved) || !approved.includes(value as AdminAiTier)) {
      return { ok: false, error: 'The default tier must be in the current approved set.' }
    }
  }
  return { ok: true, value }
}

export function adminConfigurationValuesEqual(
  left: AdminConfigurationValue,
  right: AdminConfigurationValue,
): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => value === right[index])
  }
  return left === right
}

export function formatAdminConfigurationValue(
  key: AdminConfigurationKey,
  value: AdminConfigurationValue,
): string {
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled'
  if (key === 'cost.warning.monthly_micros' || key === 'cost.critical.monthly_micros') {
    const micros = BigInt(value as string)
    const whole = micros / 1_000_000n
    const exactFraction = (micros % 1_000_000n).toString().padStart(6, '0')
    const fraction = exactFraction.replace(/0+$/, '').padEnd(2, '0')
    return `$${whole.toLocaleString('en-US')}.${fraction}`
  }
  if (Array.isArray(value)) return value.map((tier) => tier[0].toUpperCase() + tier.slice(1)).join(', ')
  if (typeof value === 'number') return value.toLocaleString('en-US')
  return value[0].toUpperCase() + value.slice(1)
}
