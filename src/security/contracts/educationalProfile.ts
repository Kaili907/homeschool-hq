import type { Profile } from '../../types'

/** Fields that can never cross the credential-free educational boundary. */
export interface ForbiddenSyncedSecurityFields {
  readonly pin?: never
  readonly rawPin?: never
  readonly learnerPin?: never
  readonly pinVerifier?: never
  readonly pinSalt?: never
  readonly credential?: never
  readonly credentials?: never
  readonly credentialMetadata?: never
  readonly activeLearnerAuthorization?: never
  readonly activeLearnerSession?: never
  readonly recoverySecret?: never
}

/** The only Profile shape future sync serializers may accept. */
export type CredentialFreeEducationalProfile = Readonly<
  Omit<Profile, 'pin'> & ForbiddenSyncedSecurityFields
>

const FORBIDDEN_SECURITY_KEYS = new Set([
  'pin',
  'rawpin',
  'learnerpin',
  'pinverifier',
  'pinsalt',
  'verifier',
  'verifierbase64',
  'verifierscheme',
  'verifierschemeversion',
  'salt',
  'saltbase64',
  'credential',
  'credentials',
  'credentialkind',
  'credentialmetadata',
  'credentialstate',
  'costparameters',
  'activelearnerauthorization',
  'activelearnersession',
  'learnersession',
  'recoverysecret',
])

function normalizedKey(key: string): string {
  return key.replace(/[-_]/g, '').toLowerCase()
}

function cloneCredentialFreeValue(value: unknown, path: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => cloneCredentialFreeValue(item, `${path}[${index}]`))
  }
  if (value === null || typeof value !== 'object') return value

  const clone: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_SECURITY_KEYS.has(normalizedKey(key))) {
      throw new Error(`Credential-like material is forbidden in synchronized Profile data at ${path}.${key}`)
    }
    clone[key] = cloneCredentialFreeValue(child, `${path}.${key}`)
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
  return cloneCredentialFreeValue(educationalData, 'profile') as CredentialFreeEducationalProfile
}
