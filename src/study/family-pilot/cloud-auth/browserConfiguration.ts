export const FAMILY_CLOUD_FEATURE_FLAG = 'VITE_FAMILY_PILOT_HOSTED_SYNC_ENABLED' as const
export const FAMILY_CLOUD_STAGING_PROJECT_REF = 'fqzcxrkvpaivpnzdbuol' as const
export const FAMILY_CLOUD_FORBIDDEN_PRODUCTION_REF = 'ymtvzmqhfvwjtxjdmybs' as const

export interface FamilyCloudBrowserConfigurationR1 {
  readonly enabled: boolean
  readonly url: string
  readonly anonKey: string
  readonly projectRef: string | null
  readonly reason: 'ENABLED_STAGING' | 'FEATURE_DISABLED' | 'CONFIGURATION_MISSING' | 'TARGET_REFUSED' | 'BROWSER_KEY_REFUSED'
}

type FamilyCloudBrowserEnvironment = Readonly<{
  VITE_FAMILY_PILOT_HOSTED_SYNC_ENABLED?: string
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}>

function hostEnvironment(): FamilyCloudBrowserEnvironment {
  // Read only the approved public names. Passing import.meta.env wholesale
  // causes Vite to serialize unrelated VITE_* values into the browser bundle.
  return Object.freeze({
    VITE_FAMILY_PILOT_HOSTED_SYNC_ENABLED: import.meta.env.VITE_FAMILY_PILOT_HOSTED_SYNC_ENABLED,
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  })
}

function projectRef(url: string): string | null {
  try {
    const parsed = new URL(url)
    const match = /^([a-z0-9]{20})\.supabase\.co$/u.exec(parsed.hostname)
    return parsed.protocol === 'https:' && parsed.pathname === '/' ? match?.[1] ?? null : null
  } catch { return null }
}

function browserKeyIsAllowed(key: string): boolean {
  if (/sb_secret_|service[._-]?role|database[._-]?password/i.test(key)) return false
  const segments = key.split('.')
  if (segments.length !== 3) return true
  try {
    const encoded = segments[1]!.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='))) as { role?: unknown }
    return payload.role === 'anon'
  } catch { return false }
}

/**
 * The reviewed Hosted Sync flag is the only activation switch. It remains
 * exact-true/default-off and, for this R1 candidate, can target only the
 * explicitly authorized staging project. A browser key is public by design;
 * secret/service credentials have no accepted configuration field.
 */
export function resolveFamilyCloudBrowserConfigurationR1(
  environment: FamilyCloudBrowserEnvironment = hostEnvironment(),
): FamilyCloudBrowserConfigurationR1 {
  const url = (environment.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const anonKey = environment.VITE_SUPABASE_ANON_KEY ?? ''
  const ref = projectRef(url)
  if (environment.VITE_FAMILY_PILOT_HOSTED_SYNC_ENABLED !== 'true') {
    return Object.freeze({ enabled: false, url: '', anonKey: '', projectRef: null, reason: 'FEATURE_DISABLED' })
  }
  if (!url || !anonKey || !ref) {
    return Object.freeze({ enabled: false, url: '', anonKey: '', projectRef: ref, reason: 'CONFIGURATION_MISSING' })
  }
  if (!browserKeyIsAllowed(anonKey)) {
    return Object.freeze({ enabled: false, url: '', anonKey: '', projectRef: ref, reason: 'BROWSER_KEY_REFUSED' })
  }
  if (ref === FAMILY_CLOUD_FORBIDDEN_PRODUCTION_REF || ref !== FAMILY_CLOUD_STAGING_PROJECT_REF) {
    return Object.freeze({ enabled: false, url: '', anonKey: '', projectRef: ref, reason: 'TARGET_REFUSED' })
  }
  return Object.freeze({ enabled: true, url, anonKey, projectRef: ref, reason: 'ENABLED_STAGING' })
}

export function isFamilyCloudBrowserEnabledFromHost(): boolean {
  return resolveFamilyCloudBrowserConfigurationR1().enabled
}
