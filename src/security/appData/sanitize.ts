import type { Profile } from '../../types'
import {
  assertPortableSecurityKeyFree,
  isProhibitedPortableSecurityKey,
  parseProfileId,
  PortableSecurityStructureError,
  toCredentialFreeEducationalProfile,
  type CredentialFreeEducationalProfile,
  type PortableSecurityKeyFreeJsonValue,
} from '../contracts'

export type CredentialFreeJsonValue = PortableSecurityKeyFreeJsonValue
export { PortableSecurityStructureError as CredentialSanitizationError }

function propertyPath(parent: readonly string[], key: string): string {
  return `$.${[...parent, key].join('.')}`
}

function valuePath(path: readonly string[]): string {
  return path.length === 0 ? '$' : `$.${path.join('.')}`
}

function fail(path: string, message: string): never {
  throw new PortableSecurityStructureError(path, message)
}

function isKnownLegacyCredentialPath(path: readonly string[], key: string): boolean {
  if (path.length === 0 && key === 'parentPin') return true
  return (
    path.length === 2 &&
    path[0] === 'profiles' &&
    parseProfileId(path[1]) !== null &&
    key === 'pin'
  )
}

function assertCanonicalProfilesCollection(value: unknown): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('$.profiles', 'Legacy profiles must be a plain canonical ProfileId record')
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    fail('$.profiles', 'Legacy profiles must be a plain canonical ProfileId record')
  }

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'symbol') {
      fail('$.profiles', 'Portable data contains a symbol key')
    }
    if (parseProfileId(key) === null) {
      fail(`$.profiles.${key}`, 'Legacy profile key must be a canonical ProfileId')
    }
  }
}

function stripKnownLegacyCredentialFields(
  value: unknown,
  path: readonly string[],
  activeObjects: WeakSet<object>,
): PortableSecurityKeyFreeJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      fail(valuePath(path), 'Portable data contains a non-finite number')
    }
    return value
  }
  if (typeof value !== 'object') {
    fail(valuePath(path), 'Portable data contains a non-JSON value')
  }
  if (activeObjects.has(value)) {
    fail(valuePath(path), 'Portable data contains a cycle')
  }

  activeObjects.add(value)
  try {
    if (Array.isArray(value)) {
      const keys = Reflect.ownKeys(value)
      if (keys.some((key) => typeof key === 'symbol')) {
        fail(valuePath(path), 'Portable data contains a symbol key')
      }
      if (keys.length !== value.length + 1 || !keys.includes('length')) {
        fail(valuePath(path), 'Portable data contains a sparse array or a non-index property')
      }

      const clone: PortableSecurityKeyFreeJsonValue[] = []
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
          fail(`${valuePath(path)}[${index}]`, 'Portable data contains a sparse or accessor array entry')
        }
        clone.push(stripKnownLegacyCredentialFields(descriptor.value, [...path, `[${index}]`], activeObjects))
      }
      return clone
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      fail(valuePath(path), 'Portable data contains a non-plain object')
    }

    const clone: Record<string, PortableSecurityKeyFreeJsonValue> = {}
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === 'symbol') {
        fail(valuePath(path), 'Portable data contains a symbol key')
      }
      const childPath = propertyPath(path, key)
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        fail(childPath, 'Portable data contains a non-JSON or accessor property')
      }
      if (path.length === 0 && key === 'profiles') {
        assertCanonicalProfilesCollection(descriptor.value)
      }
      if (isKnownLegacyCredentialPath(path, key)) continue
      if (isProhibitedPortableSecurityKey(key)) {
        fail(childPath, 'Portable security material is forbidden')
      }
      Object.defineProperty(clone, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: stripKnownLegacyCredentialFields(descriptor.value, [...path, key], activeObjects),
      })
    }
    return clone
  } finally {
    activeObjects.delete(value)
  }
}

/**
 * Canonical whole-dataset boundary. Only the two accepted legacy fields are
 * stripped: AppState.parentPin and Profile.pin under AppState.profiles.
 * Credential-like aliases anywhere else fail closed rather than disappearing.
 */
export function sanitizeCredentialFreeEducationalData(value: unknown): CredentialFreeJsonValue {
  const stripped = stripKnownLegacyCredentialFields(value, [], new WeakSet())
  assertPortableSecurityKeyFree(stripped)
  return stripped
}

export function serializeCredentialFreeEducationalData(value: unknown, space = 2): string {
  return JSON.stringify(sanitizeCredentialFreeEducationalData(value), null, space)
}

/** Uses the foundation Profile contract for the single-profile boundary. */
export function sanitizeCredentialFreeEducationalProfile(profile: Profile): CredentialFreeEducationalProfile {
  return toCredentialFreeEducationalProfile(profile)
}
