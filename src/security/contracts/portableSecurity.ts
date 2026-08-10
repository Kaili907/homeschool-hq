/**
 * Exact normalized aliases preserved from the final Sync V2 and Local
 * Credentials policies. Pattern-based families below intentionally extend
 * this list and are part of the same policy.
 */
export const PROHIBITED_PORTABLE_SECURITY_KEY_ALIASES = Object.freeze([
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
  'credentialcontainer',
  'credentialvault',
  'learnercredential',
  'costparameters',
  'activeauthorization',
  'activelearnerauthorization',
  'activesession',
  'activelearnersession',
  'learnersession',
  'parentsession',
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
  'recoverycode',
  'recoverykey',
] as const)

const PROHIBITED_PORTABLE_SECURITY_KEYS = new Set<string>(
  PROHIBITED_PORTABLE_SECURITY_KEY_ALIASES,
)
const RESERVED_PROTOTYPE_KEYS = new Set([
  '__proto__',
  'prototype',
  'constructor',
])

export type PortableSecurityKeyFreeJsonValue =
  | null
  | boolean
  | number
  | string
  | PortableSecurityKeyFreeJsonValue[]
  | { [key: string]: PortableSecurityKeyFreeJsonValue }

export class PortableSecurityStructureError extends Error {
  readonly code = 'ACADEMY_PORTABLE_SECURITY_STRUCTURE_FORBIDDEN'

  constructor(
    readonly path: string,
    message: string,
  ) {
    super(`${message} at ${path}`)
    this.name = 'PortableSecurityStructureError'
  }
}

/** Matches the mature Sync V2 key normalization exactly. */
export function normalizePortableSecurityKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

/**
 * Structural field-name policy only. Callers must never apply this predicate
 * to string values or other learner-authored content.
 */
export function isProhibitedPortableSecurityKey(key: string): boolean {
  const normalized = normalizePortableSecurityKey(key)
  if (PROHIBITED_PORTABLE_SECURITY_KEYS.has(normalized)) return true
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

function childPath(parent: string, key: string): string {
  return `${parent}.${key}`
}

function fail(path: string, message: string): never {
  throw new PortableSecurityStructureError(path, message)
}

function assertArrayStructure(
  value: unknown[],
  path: string,
  activeObjects: WeakSet<object>,
): void {
  const keys = Reflect.ownKeys(value)
  if (keys.some((key) => typeof key === 'symbol')) {
    fail(path, 'Portable data contains a symbol key')
  }
  if (keys.length !== value.length + 1 || !keys.includes('length')) {
    fail(path, 'Portable data contains a sparse array or a non-index property')
  }

  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      fail(
        `${path}[${index}]`,
        'Portable data contains a sparse or accessor array entry',
      )
    }
    assertPortableValue(descriptor.value, `${path}[${index}]`, activeObjects)
  }
}

function assertObjectStructure(
  value: object,
  path: string,
  activeObjects: WeakSet<object>,
): void {
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    fail(path, 'Portable data contains a non-plain object')
  }

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'symbol') {
      fail(path, 'Portable data contains a symbol key')
    }

    const propertyPath = childPath(path, key)
    if (RESERVED_PROTOTYPE_KEYS.has(key)) {
      fail(propertyPath, 'Portable data contains a prototype-sensitive key')
    }
    if (isProhibitedPortableSecurityKey(key)) {
      fail(propertyPath, 'Portable security material is forbidden')
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      fail(
        propertyPath,
        'Portable data contains a non-JSON or accessor property',
      )
    }
    assertPortableValue(descriptor.value, propertyPath, activeObjects)
  }
}

function assertPortableValue(
  value: unknown,
  path: string,
  activeObjects: WeakSet<object>,
): void {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      fail(path, 'Portable data contains a non-finite number')
    return
  }
  if (typeof value !== 'object') {
    fail(path, 'Portable data contains a non-JSON value')
  }
  if (activeObjects.has(value)) fail(path, 'Portable data contains a cycle')

  activeObjects.add(value)
  try {
    if (Array.isArray(value)) {
      assertArrayStructure(value, path, activeObjects)
    } else {
      assertObjectStructure(value, path, activeObjects)
    }
  } finally {
    activeObjects.delete(value)
  }
}

/**
 * Recursively asserts a JSON-compatible structure with no portable credential,
 * recovery, authorization, session, grant, or secret field names at any depth.
 */
export function assertPortableSecurityKeyFree(
  value: unknown,
): asserts value is PortableSecurityKeyFreeJsonValue {
  try {
    assertPortableValue(value, '$', new WeakSet())
  } catch (cause) {
    if (cause instanceof PortableSecurityStructureError) throw cause
    throw new PortableSecurityStructureError(
      '$',
      'Portable data could not be safely inspected',
    )
  }
}
