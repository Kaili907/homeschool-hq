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
  readonly rawPin?: never
  readonly learnerPin?: never
  readonly pinVerifier?: never
  readonly pinSalt?: never
  readonly parentPin?: never
  readonly parentPinVerifier?: never
  readonly parentCredential?: never
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
 * Profile.pin remains in the legacy model until final integration.
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
