const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/

export function isCanonicalStudyIdentifier(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER.test(value)
}

export function isExpectedMutationResult(
  value: unknown,
): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const status = (value as Record<string, unknown>).status
  return typeof status === 'string' && [
    'stored',
    'created',
    'revision-conflict',
    'idempotency-collision',
    'appended',
    'duplicate-ignored',
    'quarantined',
  ].includes(status)
}
