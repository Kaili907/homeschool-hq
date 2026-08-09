import type { Profile } from '../../types'
import {
  toCredentialFreeEducationalProfile,
  type CredentialFreeEducationalProfile,
} from '../contracts'

export type CredentialFreeJsonValue =
  | null
  | boolean
  | number
  | string
  | CredentialFreeJsonValue[]
  | { [key: string]: CredentialFreeJsonValue }

export class CredentialSanitizationError extends Error {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(`${message} at ${path}`)
    this.name = 'CredentialSanitizationError'
  }
}

/** Mirrors the aliases locked by the foundation contracts, plus AppState.parentPin. */
const FORBIDDEN_SECURITY_KEYS = new Set([
  'pin',
  'parentpin',
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
  'credentialcontainer',
  'credentialvault',
  'learnercredential',
  'costparameters',
  'recoverysecret',
  'recoverycode',
  'recoverykey',
  'activeauthorization',
  'activelearnerauthorization',
  'activelearnersession',
  'learnersession',
  'parentsession',
  'sessiontoken',
  'accesstoken',
  'refreshtoken',
])

const RESERVED_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

function normalizedKey(key: string): string {
  return key.replace(/[-_\s]/g, '').toLowerCase()
}

function propertyPath(parent: readonly string[], key: string): string {
  return [...parent, key].join('.') || '<root>'
}

function isKnownLegacyCredentialPath(path: readonly string[], key: string): boolean {
  if (path.length === 0 && key === 'parentPin') return true
  return path.length === 2 && path[0] === 'profiles' && key === 'pin'
}

function cloneCredentialFreeValue(
  value: unknown,
  path: readonly string[],
  activeObjects: WeakSet<object>,
): CredentialFreeJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new CredentialSanitizationError(
        path.join('.') || '<root>',
        'Educational data contains a non-finite number',
      )
    }
    return value
  }
  if (typeof value !== 'object') {
    throw new CredentialSanitizationError(
      path.join('.') || '<root>',
      'Educational data contains a non-JSON value',
    )
  }
  if (activeObjects.has(value)) {
    throw new CredentialSanitizationError(
      path.join('.') || '<root>',
      'Educational data contains a cycle',
    )
  }

  activeObjects.add(value)
  try {
    if (Array.isArray(value)) {
      const clone: CredentialFreeJsonValue[] = []
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) {
          throw new CredentialSanitizationError(
            `${path.join('.')}[${index}]`,
            'Educational data contains a sparse array entry',
          )
        }
        clone.push(
          cloneCredentialFreeValue(value[index], [...path, `[${index}]`], activeObjects),
        )
      }
      return clone
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new CredentialSanitizationError(
        path.join('.') || '<root>',
        'Educational data contains a non-plain object',
      )
    }

    const clone: Record<string, CredentialFreeJsonValue> = {}
    for (const key of Object.keys(value)) {
      const childPath = propertyPath(path, key)
      if (RESERVED_KEYS.has(key)) {
        throw new CredentialSanitizationError(childPath, 'Reserved object key is forbidden')
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor || !('value' in descriptor)) {
        throw new CredentialSanitizationError(
          childPath,
          'Accessor properties are forbidden in educational data',
        )
      }
      if (isKnownLegacyCredentialPath(path, key)) continue
      if (FORBIDDEN_SECURITY_KEYS.has(normalizedKey(key))) {
        throw new CredentialSanitizationError(
          childPath,
          'Credential, recovery, or active-session material is forbidden',
        )
      }
      clone[key] = cloneCredentialFreeValue(
        descriptor.value,
        [...path, key],
        activeObjects,
      )
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
export function sanitizeCredentialFreeEducationalData(
  value: unknown,
): CredentialFreeJsonValue {
  return cloneCredentialFreeValue(value, [], new WeakSet())
}

export function serializeCredentialFreeEducationalData(
  value: unknown,
  space = 2,
): string {
  return JSON.stringify(sanitizeCredentialFreeEducationalData(value), null, space)
}

/** Uses the foundation Profile contract for the single-profile boundary. */
export function sanitizeCredentialFreeEducationalProfile(
  profile: Profile,
): CredentialFreeEducationalProfile {
  return toCredentialFreeEducationalProfile(profile)
}
