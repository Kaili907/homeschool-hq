export interface SecurityStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type SecurityClock = () => number

export const systemSecurityClock: SecurityClock = () => Date.now()

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(value)
  return keys.length === expected.length && keys.every((key) => expected.includes(key))
}

export function parseCanonicalTimestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return null
  return new Date(timestamp).toISOString() === value ? timestamp : null
}

export function requireSafeTimestamp(clock: SecurityClock): number {
  const timestamp = clock()
  if (!Number.isFinite(timestamp) || !Number.isSafeInteger(timestamp) || timestamp < 0) {
    throw new Error('Security clock returned an invalid timestamp.')
  }
  return timestamp
}

export function safeRemove(storage: SecurityStorage, key: string): void {
  try {
    storage.removeItem(key)
  } catch {
    // The caller has already failed closed in memory. Storage cleanup is best effort.
  }
}
