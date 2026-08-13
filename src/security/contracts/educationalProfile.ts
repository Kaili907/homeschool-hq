import type { Profile } from '../../types'
import {
  assertPortableSecurityKeyFree,
  PortableSecurityStructureError,
  type PortableSecurityKeyFreeJsonValue,
} from './portableSecurity'
import { parseProfileId } from './profileId'

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

function assertPortableStructureAllowingLegacyRootPin(value: unknown): void {
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      !Object.prototype.hasOwnProperty.call(value, 'pin')
    ) {
      assertPortableSecurityKeyFree(value)
      return
    }

    const portableView = Object.create(Object.getPrototypeOf(value)) as Record<
      PropertyKey,
      unknown
    >
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor) {
        throw new PortableSecurityStructureError(
          '$',
          'Portable data could not be safely inspected',
        )
      }
      if (key === 'pin') {
        if (!descriptor.enumerable || !('value' in descriptor)) {
          throw new PortableSecurityStructureError(
            '$.pin',
            'Portable data contains a non-JSON or accessor property',
          )
        }
        continue
      }
      Object.defineProperty(portableView, key, descriptor)
    }
    assertPortableSecurityKeyFree(portableView)
  } catch (cause) {
    if (cause instanceof PortableSecurityStructureError) throw cause
    throw new PortableSecurityStructureError(
      '$',
      'Portable data could not be safely inspected',
    )
  }
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
  try {
    if (options.allowLegacyRootPin === true) {
      assertPortableStructureAllowingLegacyRootPin(value)
      return
    }
    assertPortableSecurityKeyFree(value)
  } catch (cause) {
    if (
      cause instanceof PortableSecurityStructureError &&
      /portable security material is forbidden/i.test(cause.message)
    ) {
      throw new Error(
        `Credential-like material is forbidden in synchronized Profile data at ${cause.path}`,
      )
    }
    throw cause
  }
}

function fail(path: string, message: string): never {
  throw new PortableSecurityStructureError(path, message)
}

function withoutExactLegacyRootPin(profile: Profile): Record<string, unknown> {
  if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) {
    fail('$', 'Educational Profile must be a plain object')
  }
  const prototype = Object.getPrototypeOf(profile)
  if (prototype !== Object.prototype && prototype !== null) {
    fail('$', 'Educational Profile must be a plain object')
  }

  const educationalData: Record<string, unknown> = {}
  for (const key of Reflect.ownKeys(profile)) {
    if (typeof key === 'symbol') {
      fail('$', 'Portable data contains a symbol key')
    }
    const descriptor = Object.getOwnPropertyDescriptor(profile, key)
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      fail(`$.${key}`, 'Portable data contains a non-JSON or accessor property')
    }
    if (key === 'pin') continue
    Object.defineProperty(educationalData, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: descriptor.value,
    })
  }
  return educationalData
}

/**
 * Removes the one accepted legacy field and fails closed on any other
 * credential, recovery, or active-authorization material at any depth.
 * Profile.pin is accepted only as the exact legacy field and is never included
 * in the returned educational profile.
 */
export function toCredentialFreeEducationalProfile(
  profile: Profile,
): CredentialFreeEducationalProfile {
  const educationalData = withoutExactLegacyRootPin(profile)
  assertPortableSecurityKeyFree(educationalData)
  if (parseProfileId(educationalData.id) === null) {
    fail('$.id', 'Educational Profile requires a canonical ProfileId')
  }

  const detached = JSON.parse(JSON.stringify(educationalData)) as PortableSecurityKeyFreeJsonValue
  assertPortableSecurityKeyFree(detached)
  return detached as unknown as CredentialFreeEducationalProfile
}
