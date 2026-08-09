import type { Profile } from '../../types'

/** Fields that can never cross the credential-free educational boundary. */
export interface ForbiddenSyncedSecurityFields {
  readonly pin?: never
  readonly parentPin?: never
  readonly rawPin?: never
  readonly learnerPin?: never
  readonly pinHash?: never
  readonly pinVerifier?: never
  readonly pinSalt?: never
  readonly verifier?: never
  readonly salt?: never
  readonly password?: never
  readonly credential?: never
  readonly credentials?: never
  readonly credentialMetadata?: never
  readonly accessToken?: never
  readonly refreshToken?: never
  readonly sessionToken?: never
  readonly authorization?: never
  readonly bearer?: never
  readonly activeSession?: never
  readonly session?: never
  readonly grant?: never
  readonly secret?: never
  readonly activeLearnerAuthorization?: never
  readonly activeLearnerSession?: never
  readonly recoverySecret?: never
  readonly recoveryToken?: never
}

/** The only Profile shape future sync serializers may accept. */
export type CredentialFreeEducationalProfile = Readonly<
  Omit<Profile, 'pin'> & ForbiddenSyncedSecurityFields
>

const FORBIDDEN_SECURITY_KEYS = new Set([
  'pin',
  'parentpin',
  'rawpin',
  'learnerpin',
  'pinhash',
  'pinverifier',
  'pinsalt',
  'verifier',
  'verifierbase64',
  'verifierscheme',
  'verifierschemeversion',
  'salt',
  'saltbase64',
  'password',
  'credential',
  'credentials',
  'credentialkind',
  'credentialmetadata',
  'credentialstate',
  'costparameters',
  'activelearnerauthorization',
  'activelearnersession',
  'learnersession',
  'session',
  'sessiontoken',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'bearer',
  'grant',
  'secret',
  'recoverysecret',
  'recoverytoken',
])

function normalizedKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function isForbiddenSecurityKey(key: string): boolean {
  const normalized = normalizedKey(key)
  if (FORBIDDEN_SECURITY_KEYS.has(normalized)) return true
  if (
    normalized.includes('credential') ||
    normalized.includes('authorization') ||
    normalized.includes('bearer') ||
    normalized.includes('verifier') ||
    normalized.includes('password') ||
    normalized.includes('secret') ||
    normalized.includes('recoverytoken') ||
    normalized.endsWith('token') ||
    normalized.endsWith('pin') ||
    normalized.startsWith('pin') ||
    normalized.endsWith('salt') ||
    normalized.startsWith('salt') ||
    normalized.endsWith('grant')
  ) {
    return true
  }
  return (
    normalized !== 'sessions' &&
    normalized !== 'sessioncount' &&
    (normalized.startsWith('session') || normalized.endsWith('session'))
  )
}

function assertCredentialFreeValue(
  value: unknown,
  path: string,
  active: Set<object>,
  allowLegacyRootPin: boolean,
): void {
  if (Array.isArray(value)) {
    if (active.has(value))
      throw new Error('Credential-free educational data cannot be cyclic.')
    active.add(value)
    value.forEach((item, index) =>
      assertCredentialFreeValue(
        item,
        `${path}[${index}]`,
        active,
        allowLegacyRootPin,
      ),
    )
    active.delete(value)
    return
  }
  if (value === null || typeof value !== 'object') return

  if (active.has(value))
    throw new Error('Credential-free educational data cannot be cyclic.')
  active.add(value)
  for (const [key, child] of Object.entries(value)) {
    if (
      !(allowLegacyRootPin && path === 'profile' && key === 'pin') &&
      isForbiddenSecurityKey(key)
    ) {
      throw new Error(
        `Credential-like material is forbidden in synchronized Profile data at ${path}.${key}`,
      )
    }
    assertCredentialFreeValue(
      child,
      `${path}.${key}`,
      active,
      allowLegacyRootPin,
    )
  }
  active.delete(value)
}

/**
 * Structural security-key inspection only. It deliberately ignores string
 * values, so learner-authored educational text is never treated as a secret.
 * Sync Protocol v2 follows this inspection with its stricter schema projector.
 */
export function assertCredentialFreeEducationalStructure(
  value: unknown,
  options: Readonly<{ allowLegacyRootPin?: boolean }> = {},
): void {
  assertCredentialFreeValue(
    value,
    'profile',
    new Set<object>(),
    options.allowLegacyRootPin === true,
  )
}

function cloneEducationalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneEducationalValue)
  if (value === null || typeof value !== 'object') return value

  const clone: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    clone[key] = cloneEducationalValue(child)
  }
  return clone
}

/**
 * Removes the one accepted legacy field and fails closed on any other
 * credential, recovery, or active-authorization material at any depth.
 * Profile.pin remains in the legacy model until final integration.
 */
export function toCredentialFreeEducationalProfile(
  profile: Profile,
): CredentialFreeEducationalProfile {
  const { pin: _legacyPin, ...educationalData } = profile
  assertCredentialFreeEducationalStructure(educationalData)
  return cloneEducationalValue(
    educationalData,
  ) as CredentialFreeEducationalProfile
}
