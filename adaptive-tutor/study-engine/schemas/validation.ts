import {
  STUDY_ENGINE_SCHEMA_VERSION,
  type ContractMetadata,
  type EffectiveWorkBlockRange,
  type MinuteRange,
} from '../contracts/index.ts'

export const VALIDATION_LIMITS = {
  maximumPayloadNodes: 20_000,
  maximumDepth: 24,
  maximumStringLength: 16_000,
  maximumArrayLength: 2_000,
  maximumObjectKeys: 500,
  maximumIdLength: 128,
} as const

export interface ValidationIssue {
  readonly code:
    | 'type'
    | 'required'
    | 'unknown-key'
    | 'literal'
    | 'format'
    | 'range'
    | 'duplicate'
    | 'reference'
    | 'sequence'
    | 'chronology'
    | 'invariant'
    | 'privacy'
    | 'safety'
    | 'limit'
    | 'json-safety'
  readonly path: string
  readonly message: string
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string; readonly issues: readonly ValidationIssue[] }

export interface JsonSchemaDocument {
  readonly $schema: 'https://json-schema.org/draft/2020-12/schema'
  readonly $id: string
  readonly title: string
  readonly type: 'object'
  readonly [key: string]: unknown
}

export interface RuntimeSchema<T> {
  readonly schemaId: string
  readonly kind: T extends { readonly kind: infer Kind } ? Kind : string
  readonly schemaVersion: typeof STUDY_ENGINE_SCHEMA_VERSION
  readonly jsonSchema: JsonSchemaDocument
  readonly validate: (value: unknown) => ValidationResult<T>
  readonly parse: (value: unknown) => T
  readonly is: (value: unknown) => value is T
}

export class ContractValidationError extends Error {
  readonly issues: readonly ValidationIssue[]

  constructor(schemaId: string, issues: readonly ValidationIssue[]) {
    super(`${schemaId} validation failed: ${formatIssues(issues)}`)
    this.name = 'ContractValidationError'
    this.issues = issues
  }
}

export class ValidationContext {
  readonly issues: ValidationIssue[] = []

  add(issue: ValidationIssue): void {
    this.issues.push(issue)
  }
}

export type SchemaValidator<T> = (value: unknown, context: ValidationContext) => value is T

export function defineRuntimeSchema<T>(configuration: {
  readonly schemaId: string
  readonly kind: RuntimeSchema<T>['kind']
  readonly jsonSchema: JsonSchemaDocument
  readonly validateValue: SchemaValidator<T>
}): RuntimeSchema<T> {
  const validate = (value: unknown): ValidationResult<T> => {
    const boundaryIssues = inspectJsonBoundary(value)
    if (boundaryIssues.length > 0) {
      return {
        ok: false,
        error: formatIssues(boundaryIssues),
        issues: boundaryIssues,
      }
    }

    const context = new ValidationContext()
    configuration.validateValue(value, context)
    if (context.issues.length > 0) {
      return {
        ok: false,
        error: formatIssues(context.issues),
        issues: context.issues,
      }
    }
    return { ok: true, value: value as T }
  }

  return {
    schemaId: configuration.schemaId,
    kind: configuration.kind,
    schemaVersion: STUDY_ENGINE_SCHEMA_VERSION,
    jsonSchema: configuration.jsonSchema,
    validate,
    parse(value: unknown): T {
      const result = validate(value)
      if (!result.ok) throw new ContractValidationError(configuration.schemaId, result.issues)
      return result.value
    },
    is(value: unknown): value is T {
      return validate(value).ok
    },
  }
}

export function formatIssues(issues: readonly ValidationIssue[]): string {
  return issues.map((issue) => `${issue.path} [${issue.code}] ${issue.message}`).join('; ')
}

export const propertyPath = (path: string, property: string): string =>
  /^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(property)
    ? `${path}.${property}`
    : `${path}[${JSON.stringify(property)}]`

export const indexPath = (path: string, index: number): string => `${path}[${index}]`

export function expectRecord(
  context: ValidationContext,
  value: unknown,
  path: string,
  allowedKeys?: readonly string[],
): Record<string, unknown> | undefined {
  if (!isPlainRecord(value)) {
    context.add({ code: 'type', path, message: 'Expected a plain object.' })
    return undefined
  }
  if (allowedKeys) rejectUnknownKeys(context, value, path, allowedKeys)
  return value
}

export function rejectUnknownKeys(
  context: ValidationContext,
  record: Record<string, unknown>,
  path: string,
  allowedKeys: readonly string[],
): void {
  const allowed = new Set(allowedKeys)
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      context.add({
        code: 'unknown-key',
        path: propertyPath(path, key),
        message: `Unknown property "${key}". Use metadata.extensions for namespaced additions.`,
      })
    }
  }
}

export function requireKey(
  context: ValidationContext,
  record: Record<string, unknown>,
  key: string,
  path: string,
): boolean {
  if (!Object.hasOwn(record, key)) {
    context.add({
      code: 'required',
      path: propertyPath(path, key),
      message: 'Required property is missing.',
    })
    return false
  }
  return true
}

export function expectString(
  context: ValidationContext,
  value: unknown,
  path: string,
  options: {
    readonly minimumLength?: number
    readonly maximumLength?: number
    readonly pattern?: RegExp
    readonly allowed?: readonly string[]
  } = {},
): value is string {
  if (typeof value !== 'string') {
    context.add({ code: 'type', path, message: 'Expected a string.' })
    return false
  }
  const minimumLength = options.minimumLength ?? 0
  const maximumLength = options.maximumLength ?? VALIDATION_LIMITS.maximumStringLength
  if (value.length < minimumLength || value.length > maximumLength) {
    context.add({
      code: 'range',
      path,
      message: `String length must be between ${minimumLength} and ${maximumLength}.`,
    })
  }
  if (options.pattern && !options.pattern.test(value)) {
    context.add({ code: 'format', path, message: 'String has an invalid format.' })
  }
  if (options.allowed && !options.allowed.includes(value)) {
    context.add({
      code: 'literal',
      path,
      message: `Expected one of: ${options.allowed.join(', ')}.`,
    })
  }
  return true
}

export function expectId(
  context: ValidationContext,
  value: unknown,
  path: string,
): value is string {
  return expectString(context, value, path, {
    minimumLength: 1,
    maximumLength: VALIDATION_LIMITS.maximumIdLength,
    pattern: /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/,
  })
}

export function expectBoolean(
  context: ValidationContext,
  value: unknown,
  path: string,
): value is boolean {
  if (typeof value !== 'boolean') {
    context.add({ code: 'type', path, message: 'Expected a boolean.' })
    return false
  }
  return true
}

export function expectNumber(
  context: ValidationContext,
  value: unknown,
  path: string,
  options: {
    readonly minimum?: number
    readonly maximum?: number
    readonly integer?: boolean
  } = {},
): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    context.add({ code: 'type', path, message: 'Expected a finite number.' })
    return false
  }
  if (options.integer && !Number.isInteger(value)) {
    context.add({ code: 'type', path, message: 'Expected an integer.' })
  }
  if (options.minimum !== undefined && value < options.minimum) {
    context.add({ code: 'range', path, message: `Value must be at least ${options.minimum}.` })
  }
  if (options.maximum !== undefined && value > options.maximum) {
    context.add({ code: 'range', path, message: `Value must be at most ${options.maximum}.` })
  }
  return true
}

export function expectArray(
  context: ValidationContext,
  value: unknown,
  path: string,
  options: { readonly minimumLength?: number; readonly maximumLength?: number } = {},
): readonly unknown[] | undefined {
  if (!Array.isArray(value)) {
    context.add({ code: 'type', path, message: 'Expected an array.' })
    return undefined
  }
  const minimumLength = options.minimumLength ?? 0
  const maximumLength = options.maximumLength ?? VALIDATION_LIMITS.maximumArrayLength
  if (value.length < minimumLength || value.length > maximumLength) {
    context.add({
      code: 'range',
      path,
      message: `Array length must be between ${minimumLength} and ${maximumLength}.`,
    })
  }
  return value
}

export function expectStringArray(
  context: ValidationContext,
  value: unknown,
  path: string,
  options: {
    readonly ids?: boolean
    readonly unique?: boolean
    readonly minimumLength?: number
    readonly maximumLength?: number
    readonly allowed?: readonly string[]
  } = {},
): readonly string[] | undefined {
  const values = expectArray(context, value, path, options)
  if (!values) return undefined
  const strings: string[] = []
  values.forEach((entry, index) => {
    const entryPath = indexPath(path, index)
    const valid = options.ids
      ? expectId(context, entry, entryPath)
      : expectString(context, entry, entryPath, {
          minimumLength: 1,
          maximumLength: 500,
          ...(options.allowed ? { allowed: options.allowed } : {}),
        })
    if (valid) strings.push(entry as string)
  })
  if (options.unique) {
    const seen = new Set<string>()
    strings.forEach((entry, index) => {
      if (seen.has(entry)) {
        context.add({
          code: 'duplicate',
          path: indexPath(path, index),
          message: `Duplicate value "${entry}".`,
        })
      }
      seen.add(entry)
    })
  }
  return strings
}

export function expectISODate(
  context: ValidationContext,
  value: unknown,
  path: string,
): value is string {
  if (!expectString(context, value, path, { pattern: /^\d{4}-\d{2}-\d{2}$/ })) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    context.add({ code: 'format', path, message: 'Expected a real calendar date in YYYY-MM-DD form.' })
  }
  return true
}

export function expectISODateTime(
  context: ValidationContext,
  value: unknown,
  path: string,
): value is string {
  if (
    !expectString(context, value, path, {
      pattern:
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/,
    })
  ) {
    return false
  }
  const calendarDate = value.slice(0, 10)
  const calendar = new Date(`${calendarDate}T00:00:00.000Z`)
  if (
    Number.isNaN(Date.parse(value)) ||
    Number.isNaN(calendar.valueOf()) ||
    calendar.toISOString().slice(0, 10) !== calendarDate
  ) {
    context.add({ code: 'format', path, message: 'Expected a valid RFC 3339 date-time.' })
  }
  return true
}

export function expectIanaTimeZone(
  context: ValidationContext,
  value: unknown,
  path: string,
): value is string {
  if (!expectString(context, value, path, { minimumLength: 1, maximumLength: 100 })) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0)
  } catch {
    context.add({ code: 'format', path, message: 'Expected a valid IANA time-zone identifier.' })
  }
  return true
}

export function validateHeader(
  context: ValidationContext,
  record: Record<string, unknown>,
  path: string,
  kind: string,
): void {
  expectString(context, record.kind, propertyPath(path, 'kind'), { allowed: [kind] })
  if (record.schemaVersion !== STUDY_ENGINE_SCHEMA_VERSION) {
    context.add({
      code: 'literal',
      path: propertyPath(path, 'schemaVersion'),
      message: `Expected schemaVersion ${STUDY_ENGINE_SCHEMA_VERSION}.`,
    })
  }
  expectId(context, record.id, propertyPath(path, 'id'))
  expectNumber(context, record.revision, propertyPath(path, 'revision'), {
    integer: true,
    minimum: 1,
  })
  const createdValid = expectISODateTime(context, record.createdAt, propertyPath(path, 'createdAt'))
  const updatedValid = expectISODateTime(context, record.updatedAt, propertyPath(path, 'updatedAt'))
  if (
    createdValid &&
    updatedValid &&
    Date.parse(record.updatedAt as string) < Date.parse(record.createdAt as string)
  ) {
    context.add({
      code: 'chronology',
      path: propertyPath(path, 'updatedAt'),
      message: 'updatedAt cannot be earlier than createdAt.',
    })
  }
  if (record.metadata !== undefined) {
    validateMetadata(context, record.metadata, propertyPath(path, 'metadata'))
  }
}

export function validateMetadata(
  context: ValidationContext,
  value: unknown,
  path: string,
): value is ContractMetadata {
  const record = expectRecord(context, value, path, ['source', 'tags', 'extensions'])
  if (!record) return false
  if (record.source !== undefined) {
    expectString(context, record.source, propertyPath(path, 'source'), {
      allowed: ['manual', 'adaptive-engine', 'migration', 'import'],
    })
  }
  if (record.tags !== undefined) {
    expectStringArray(context, record.tags, propertyPath(path, 'tags'), {
      unique: true,
      maximumLength: 50,
    })
  }
  if (record.extensions !== undefined) {
    const extensions = expectRecord(context, record.extensions, propertyPath(path, 'extensions'))
    if (extensions) {
      for (const key of Object.keys(extensions)) {
        if (!/^[a-z][a-z0-9-]*:[A-Za-z0-9._/-]+$/.test(key)) {
          context.add({
            code: 'format',
            path: propertyPath(propertyPath(path, 'extensions'), key),
            message: 'Extension keys must be namespaced, for example "vendor:feature".',
          })
        }
      }
    }
  }
  return context.issues.length === 0
}

export function validateEffectiveWorkBlockRange(
  context: ValidationContext,
  value: unknown,
  path: string,
): value is EffectiveWorkBlockRange {
  const record = expectRecord(context, value, path, [
    'minimumMinutes',
    'targetMinutes',
    'maximumMinutes',
  ])
  if (!record) return false
  const minimumValid = expectNumber(context, record.minimumMinutes, propertyPath(path, 'minimumMinutes'), {
    integer: true,
    minimum: 1,
    maximum: 240,
  })
  const targetValid = expectNumber(context, record.targetMinutes, propertyPath(path, 'targetMinutes'), {
    integer: true,
    minimum: 1,
    maximum: 240,
  })
  const maximumValid = expectNumber(context, record.maximumMinutes, propertyPath(path, 'maximumMinutes'), {
    integer: true,
    minimum: 1,
    maximum: 240,
  })
  if (
    minimumValid &&
    targetValid &&
    maximumValid &&
    !(
      (record.minimumMinutes as number) <= (record.targetMinutes as number) &&
      (record.targetMinutes as number) <= (record.maximumMinutes as number)
    )
  ) {
    context.add({
      code: 'invariant',
      path,
      message: 'Expected minimumMinutes <= targetMinutes <= maximumMinutes.',
    })
  }
  return context.issues.length === 0
}

export function validateMinuteRange(
  context: ValidationContext,
  value: unknown,
  path: string,
): value is MinuteRange {
  const record = expectRecord(context, value, path, [
    'minimumMinutes',
    'defaultMinutes',
    'maximumMinutes',
  ])
  if (!record) return false
  const minimumValid = expectNumber(context, record.minimumMinutes, propertyPath(path, 'minimumMinutes'), {
    integer: true,
    minimum: 1,
    maximum: 120,
  })
  const defaultValid = expectNumber(context, record.defaultMinutes, propertyPath(path, 'defaultMinutes'), {
    integer: true,
    minimum: 1,
    maximum: 120,
  })
  const maximumValid = expectNumber(context, record.maximumMinutes, propertyPath(path, 'maximumMinutes'), {
    integer: true,
    minimum: 1,
    maximum: 120,
  })
  if (
    minimumValid &&
    defaultValid &&
    maximumValid &&
    !(
      (record.minimumMinutes as number) <= (record.defaultMinutes as number) &&
      (record.defaultMinutes as number) <= (record.maximumMinutes as number)
    )
  ) {
    context.add({
      code: 'invariant',
      path,
      message: 'Expected minimumMinutes <= defaultMinutes <= maximumMinutes.',
    })
  }
  return context.issues.length === 0
}

export function compareDateTimes(
  context: ValidationContext,
  earlier: unknown,
  later: unknown,
  laterPath: string,
  message: string,
): void {
  if (
    typeof earlier === 'string' &&
    typeof later === 'string' &&
    !Number.isNaN(Date.parse(earlier)) &&
    !Number.isNaN(Date.parse(later)) &&
    Date.parse(later) < Date.parse(earlier)
  ) {
    context.add({ code: 'chronology', path: laterPath, message })
  }
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function inspectJsonBoundary(value: unknown): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const active = new WeakSet<object>()
  let nodes = 0

  const visit = (entry: unknown, path: string, depth: number): void => {
    nodes += 1
    if (nodes > VALIDATION_LIMITS.maximumPayloadNodes) {
      if (!issues.some((issue) => issue.code === 'limit' && issue.path === '$')) {
        issues.push({
          code: 'limit',
          path: '$',
          message: `Payload exceeds ${VALIDATION_LIMITS.maximumPayloadNodes} nodes.`,
        })
      }
      return
    }
    if (depth > VALIDATION_LIMITS.maximumDepth) {
      issues.push({
        code: 'limit',
        path,
        message: `Payload exceeds maximum depth ${VALIDATION_LIMITS.maximumDepth}.`,
      })
      return
    }

    if (
      entry === null ||
      typeof entry === 'boolean' ||
      (typeof entry === 'number' && Number.isFinite(entry))
    ) {
      return
    }
    if (typeof entry === 'string') {
      if (entry.length > VALIDATION_LIMITS.maximumStringLength) {
        issues.push({
          code: 'limit',
          path,
          message: `String exceeds ${VALIDATION_LIMITS.maximumStringLength} characters.`,
        })
      }
      return
    }
    if (typeof entry === 'number') {
      issues.push({ code: 'json-safety', path, message: 'Non-finite numbers are not JSON-safe.' })
      return
    }
    if (
      typeof entry === 'undefined' ||
      typeof entry === 'function' ||
      typeof entry === 'symbol' ||
      typeof entry === 'bigint'
    ) {
      issues.push({ code: 'json-safety', path, message: `Value of type ${typeof entry} is not JSON-safe.` })
      return
    }
    if (typeof entry !== 'object') return

    if (active.has(entry)) {
      issues.push({ code: 'json-safety', path, message: 'Cyclic references are not JSON-safe.' })
      return
    }
    active.add(entry)

    if (Array.isArray(entry)) {
      if (entry.length > VALIDATION_LIMITS.maximumArrayLength) {
        issues.push({
          code: 'limit',
          path,
          message: `Array exceeds ${VALIDATION_LIMITS.maximumArrayLength} items.`,
        })
      }
      for (let index = 0; index < entry.length; index += 1) {
        if (!Object.hasOwn(entry, index)) {
          issues.push({
            code: 'json-safety',
            path: indexPath(path, index),
            message: 'Sparse arrays are not accepted.',
          })
          continue
        }
        visit(entry[index], indexPath(path, index), depth + 1)
      }
      if (Object.getOwnPropertySymbols(entry).length > 0) {
        issues.push({ code: 'json-safety', path, message: 'Symbol keys are not JSON-safe.' })
      }
      active.delete(entry)
      return
    }

    if (!isPlainRecord(entry)) {
      issues.push({ code: 'json-safety', path, message: 'Expected a plain JSON object.' })
      active.delete(entry)
      return
    }

    const keys = Object.keys(entry)
    if (keys.length > VALIDATION_LIMITS.maximumObjectKeys) {
      issues.push({
        code: 'limit',
        path,
        message: `Object exceeds ${VALIDATION_LIMITS.maximumObjectKeys} properties.`,
      })
    }
    if (Object.getOwnPropertySymbols(entry).length > 0) {
      issues.push({ code: 'json-safety', path, message: 'Symbol keys are not JSON-safe.' })
    }
    for (const key of keys) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
        issues.push({
          code: 'json-safety',
          path: propertyPath(path, key),
          message: `Reserved key "${key}" is not accepted.`,
        })
        continue
      }
      const descriptor = Object.getOwnPropertyDescriptor(entry, key)
      if (!descriptor || descriptor.get || descriptor.set) {
        issues.push({
          code: 'json-safety',
          path: propertyPath(path, key),
          message: 'Accessor properties are not accepted.',
        })
        continue
      }
      visit(descriptor.value, propertyPath(path, key), depth + 1)
    }
    active.delete(entry)
  }

  visit(value, '$', 0)
  return issues
}
