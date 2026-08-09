const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuidV4(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4.test(value)
}

/**
 * Generates an opaque local identifier without a fingerprint or deterministic
 * fallback. Callers must fail closed when Web Crypto is unavailable.
 */
export function createRandomUuidV4(
  randomUUID: () => string = () => globalThis.crypto.randomUUID(),
): string {
  const value = randomUUID()
  if (!isUuidV4(value)) throw new Error('crypto.randomUUID() did not return a UUIDv4')
  return value
}
