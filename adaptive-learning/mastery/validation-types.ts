export interface ValidationIssue {
  readonly path: string
  readonly code: string
  readonly message: string
}

export type ValidationResult<T> =
  | {
      readonly ok: true
      readonly value: T
      readonly issues: readonly []
    }
  | {
      readonly ok: false
      readonly issues: readonly ValidationIssue[]
    }

export class MasteryValidationError extends Error {
  readonly issues: readonly ValidationIssue[]

  constructor(message: string, issues: readonly ValidationIssue[]) {
    super(message)
    this.name = 'MasteryValidationError'
    this.issues = issues
  }
}

export function validationSuccess<T>(value: T): ValidationResult<T> {
  return { ok: true, value, issues: [] }
}

export function validationFailure<T>(
  issues: readonly ValidationIssue[],
): ValidationResult<T> {
  return { ok: false, issues }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isNonEmptyString(value: unknown, maximum = 500): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maximum
  )
}

export function isFiniteNumberInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  )
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

export function isIsoDateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const milliseconds = Date.parse(value)
  return (
    Number.isFinite(milliseconds) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  )
}

export function isOneOf<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
): value is Values[number] {
  return typeof value === 'string' && values.includes(value)
}

