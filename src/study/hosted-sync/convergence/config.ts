export const HOSTED_STUDY_SYNC_MODES = Object.freeze([
  'WEB_PILOT_LOCAL_ONLY',
  'HOSTED_SYNC_STAGING',
  'HOSTED_SYNC_FAMILY_ENABLED',
] as const)

export type HostedStudySyncMode = typeof HOSTED_STUDY_SYNC_MODES[number]

export interface HostedStudySyncConfigInput {
  readonly mode?: string | null
  readonly rpcBaseUrl?: string | null
  readonly publicClientKey?: string | null
  readonly allowedHouseholdRefs?: readonly string[] | null
}

export type HostedStudySyncConfig =
  | Readonly<{
      status: 'disabled'
      mode: 'WEB_PILOT_LOCAL_ONLY'
    }>
  | Readonly<{
      status: 'enabled'
      mode: 'HOSTED_SYNC_STAGING' | 'HOSTED_SYNC_FAMILY_ENABLED'
      rpcBaseUrl: string
      publicClientKey: string
      allowedHouseholdRefs: readonly string[]
    }>
  | Readonly<{
      status: 'invalid'
      mode: 'HOSTED_SYNC_STAGING' | 'HOSTED_SYNC_FAMILY_ENABLED' | null
      reason: 'INVALID_MODE' | 'INCOMPLETE_HOSTED_SYNC_CONFIG' | 'FAMILY_ALLOWLIST_REQUIRED'
    }>

const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/

function endpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  if (value.startsWith('/')) return !value.startsWith('//') && !/[?#\\]/.test(value)
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.search && !parsed.hash
  } catch {
    return false
  }
}

export function isHostedStudyBrowserPublicKey(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 8 || /service[_ -]?role/i.test(value)) return false
  const parts = value.split('.')
  if (parts.length === 3) {
    try {
      const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      const decoded = typeof atob === 'function' ? atob(normalized) : ''
      if (decoded && /"role"\s*:\s*"service_role"/i.test(decoded)) return false
    } catch { return false }
  }
  return true
}

/**
 * Closed deployment gate. Missing or malformed hosted configuration never
 * turns the current pilot into a network-dependent build.
 */
export function evaluateHostedStudySyncConfig(input: HostedStudySyncConfigInput): HostedStudySyncConfig {
  const rawMode = input.mode ?? 'WEB_PILOT_LOCAL_ONLY'
  if (!HOSTED_STUDY_SYNC_MODES.includes(rawMode as HostedStudySyncMode)) {
    return Object.freeze({ status: 'invalid', mode: null, reason: 'INVALID_MODE' })
  }
  const mode = rawMode as HostedStudySyncMode
  if (mode === 'WEB_PILOT_LOCAL_ONLY') return Object.freeze({ status: 'disabled', mode })
  if (!endpoint(input.rpcBaseUrl) || !isHostedStudyBrowserPublicKey(input.publicClientKey)) {
    return Object.freeze({ status: 'invalid', mode, reason: 'INCOMPLETE_HOSTED_SYNC_CONFIG' })
  }
  const allowedHouseholdRefs = input.allowedHouseholdRefs ?? []
  if (!Array.isArray(allowedHouseholdRefs) || allowedHouseholdRefs.some((ref) => !REF.test(ref)) ||
      new Set(allowedHouseholdRefs).size !== allowedHouseholdRefs.length) {
    return Object.freeze({ status: 'invalid', mode, reason: 'INCOMPLETE_HOSTED_SYNC_CONFIG' })
  }
  if (mode === 'HOSTED_SYNC_FAMILY_ENABLED' && allowedHouseholdRefs.length === 0) {
    return Object.freeze({ status: 'invalid', mode, reason: 'FAMILY_ALLOWLIST_REQUIRED' })
  }
  return Object.freeze({
    status: 'enabled',
    mode,
    rpcBaseUrl: input.rpcBaseUrl,
    publicClientKey: input.publicClientKey,
    allowedHouseholdRefs: Object.freeze([...allowedHouseholdRefs]),
  })
}

export function hostedStudySyncEnabledForHousehold(
  config: HostedStudySyncConfig,
  householdRef: string,
): boolean {
  if (config.status !== 'enabled') return false
  return config.mode === 'HOSTED_SYNC_STAGING' || config.allowedHouseholdRefs.includes(householdRef)
}
