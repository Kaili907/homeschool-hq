export type JsonSchema = Readonly<Record<string, unknown>>

export interface ValidationIssue {
  readonly code:
    | 'invalid_type'
    | 'missing_field'
    | 'unknown_field'
    | 'invalid_value'
    | 'out_of_range'
    | 'duplicate_value'
  readonly path: string
  readonly message: string
}

export type ValidationResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly issues: readonly ValidationIssue[] }

const TYPE = Symbol('authoring-schema-type')

export interface AuthoringSchema<T> {
  readonly [TYPE]?: T
  readonly jsonSchema: JsonSchema
  validate(value: unknown, path: string, issues: ValidationIssue[]): void
}

export interface OptionalAuthoringSchema<T> extends AuthoringSchema<T | undefined> {
  readonly optional: true
  readonly inner: AuthoringSchema<T>
}

export type InferSchema<S> = S extends AuthoringSchema<infer T> ? T : never

type SchemaProperties = Readonly<Record<string, AuthoringSchema<unknown>>>
type OptionalKeys<P extends SchemaProperties> = {
  [K in keyof P]: P[K] extends OptionalAuthoringSchema<unknown> ? K : never
}[keyof P]
type RequiredKeys<P extends SchemaProperties> = Exclude<keyof P, OptionalKeys<P>>
type ObjectValue<P extends SchemaProperties> = {
  readonly [K in RequiredKeys<P>]: InferSchema<P[K]>
} & {
  readonly [K in OptionalKeys<P>]?: Exclude<InferSchema<P[K]>, undefined>
}

function issue(
  issues: ValidationIssue[],
  code: ValidationIssue['code'],
  path: string,
  message: string,
): void {
  issues.push({ code, path, message })
}

function childPath(path: string, key: string | number): string {
  return typeof key === 'number' ? `${path}[${key}]` : `${path}.${key}`
}

export function stringSchema(options: {
  readonly minLength?: number
  readonly maxLength?: number
  readonly pattern?: RegExp
} = {}): AuthoringSchema<string> {
  const jsonSchema: Record<string, unknown> = { type: 'string' }
  if (options.minLength !== undefined) jsonSchema.minLength = options.minLength
  if (options.maxLength !== undefined) jsonSchema.maxLength = options.maxLength
  if (options.pattern) jsonSchema.pattern = options.pattern.source
  return {
    jsonSchema,
    validate(value, path, issues) {
      if (typeof value !== 'string') {
        issue(issues, 'invalid_type', path, 'must be a string')
        return
      }
      if (options.minLength !== undefined && value.length < options.minLength) {
        issue(issues, 'out_of_range', path, `must contain at least ${options.minLength} characters`)
      }
      if (options.maxLength !== undefined && value.length > options.maxLength) {
        issue(issues, 'out_of_range', path, `must contain at most ${options.maxLength} characters`)
      }
      if (options.pattern && !options.pattern.test(value)) {
        issue(issues, 'invalid_value', path, `must match ${options.pattern.source}`)
      }
    },
  }
}

export function integerSchema(options: {
  readonly minimum?: number
  readonly maximum?: number
} = {}): AuthoringSchema<number> {
  const jsonSchema: Record<string, unknown> = { type: 'integer' }
  if (options.minimum !== undefined) jsonSchema.minimum = options.minimum
  if (options.maximum !== undefined) jsonSchema.maximum = options.maximum
  return {
    jsonSchema,
    validate(value, path, issues) {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        issue(issues, 'invalid_type', path, 'must be an integer')
        return
      }
      if (options.minimum !== undefined && value < options.minimum) {
        issue(issues, 'out_of_range', path, `must be at least ${options.minimum}`)
      }
      if (options.maximum !== undefined && value > options.maximum) {
        issue(issues, 'out_of_range', path, `must be at most ${options.maximum}`)
      }
    },
  }
}

export function numberSchema(options: {
  readonly minimum?: number
  readonly maximum?: number
} = {}): AuthoringSchema<number> {
  const jsonSchema: Record<string, unknown> = { type: 'number' }
  if (options.minimum !== undefined) jsonSchema.minimum = options.minimum
  if (options.maximum !== undefined) jsonSchema.maximum = options.maximum
  return {
    jsonSchema,
    validate(value, path, issues) {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        issue(issues, 'invalid_type', path, 'must be a finite number')
        return
      }
      if (options.minimum !== undefined && value < options.minimum) {
        issue(issues, 'out_of_range', path, `must be at least ${options.minimum}`)
      }
      if (options.maximum !== undefined && value > options.maximum) {
        issue(issues, 'out_of_range', path, `must be at most ${options.maximum}`)
      }
    },
  }
}

export function booleanSchema(): AuthoringSchema<boolean> {
  return {
    jsonSchema: { type: 'boolean' },
    validate(value, path, issues) {
      if (typeof value !== 'boolean') issue(issues, 'invalid_type', path, 'must be a boolean')
    },
  }
}

export function literalSchema<const T extends string | number | boolean>(value: T): AuthoringSchema<T> {
  return {
    jsonSchema: { const: value },
    validate(candidate, path, issues) {
      if (candidate !== value) issue(issues, 'invalid_value', path, `must equal ${JSON.stringify(value)}`)
    },
  }
}

export function enumSchema<const T extends readonly (string | number)[]>(values: T): AuthoringSchema<T[number]> {
  const allowed = new Set<string | number>(values)
  return {
    jsonSchema: { enum: values },
    validate(value, path, issues) {
      if (!allowed.has(value as string | number)) {
        issue(issues, 'invalid_value', path, `must be one of ${values.join(', ')}`)
      }
    },
  }
}

export function optionalSchema<T>(inner: AuthoringSchema<T>): OptionalAuthoringSchema<T> {
  return {
    optional: true,
    inner,
    jsonSchema: inner.jsonSchema,
    validate(value, path, issues) {
      if (value !== undefined) inner.validate(value, path, issues)
    },
  }
}

export function arraySchema<T>(
  item: AuthoringSchema<T>,
  options: { readonly minItems?: number; readonly maxItems?: number; readonly uniqueItems?: boolean } = {},
): AuthoringSchema<readonly T[]> {
  const jsonSchema: Record<string, unknown> = { type: 'array', items: item.jsonSchema }
  if (options.minItems !== undefined) jsonSchema.minItems = options.minItems
  if (options.maxItems !== undefined) jsonSchema.maxItems = options.maxItems
  if (options.uniqueItems) jsonSchema.uniqueItems = true
  return {
    jsonSchema,
    validate(value, path, issues) {
      if (!Array.isArray(value)) {
        issue(issues, 'invalid_type', path, 'must be an array')
        return
      }
      if (options.minItems !== undefined && value.length < options.minItems) {
        issue(issues, 'out_of_range', path, `must contain at least ${options.minItems} items`)
      }
      if (options.maxItems !== undefined && value.length > options.maxItems) {
        issue(issues, 'out_of_range', path, `must contain at most ${options.maxItems} items`)
      }
      value.forEach((candidate, index) => item.validate(candidate, childPath(path, index), issues))
      if (options.uniqueItems) {
        const seen = new Set<string>()
        value.forEach((candidate, index) => {
          const key = JSON.stringify(candidate)
          if (seen.has(key)) issue(issues, 'duplicate_value', childPath(path, index), 'must be unique')
          seen.add(key)
        })
      }
    },
  }
}

export function objectSchema<const P extends SchemaProperties>(properties: P): AuthoringSchema<ObjectValue<P>> {
  const entries = Object.entries(properties)
  const required = entries
    .filter(([, schema]) => !('optional' in schema && schema.optional === true))
    .map(([key]) => key)
  return {
    jsonSchema: {
      type: 'object',
      properties: Object.fromEntries(entries.map(([key, schema]) => [key, schema.jsonSchema])),
      required,
      additionalProperties: false,
    },
    validate(value, path, issues) {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        issue(issues, 'invalid_type', path, 'must be an object')
        return
      }
      const record = value as Record<string, unknown>
      for (const key of Object.keys(record)) {
        if (!(key in properties)) issue(issues, 'unknown_field', childPath(path, key), 'is not allowed')
      }
      for (const [key, schema] of entries) {
        if (!(key in record)) {
          if (!('optional' in schema && schema.optional === true)) {
            issue(issues, 'missing_field', childPath(path, key), 'is required')
          }
          continue
        }
        schema.validate(record[key], childPath(path, key), issues)
      }
    },
  }
}

export function oneOfSchema<const S extends readonly AuthoringSchema<unknown>[]>(
  schemas: S,
): AuthoringSchema<InferSchema<S[number]>> {
  return {
    jsonSchema: { oneOf: schemas.map((schema) => schema.jsonSchema) },
    validate(value, path, issues) {
      const candidates = schemas.map((schema) => {
        const candidateIssues: ValidationIssue[] = []
        schema.validate(value, path, candidateIssues)
        return candidateIssues
      })
      const passing = candidates.filter((candidate) => candidate.length === 0)
      if (passing.length !== 1) {
        issue(issues, 'invalid_value', path, 'must match exactly one allowed shape')
      }
    },
  }
}

export function validateWithSchema<T>(schema: AuthoringSchema<T>, value: unknown): ValidationResult<T> {
  const issues: ValidationIssue[] = []
  schema.validate(value, '$', issues)
  return issues.length === 0 ? { success: true, data: value as T } : { success: false, issues }
}
