import type { JsonSchemaDocument } from './validation.ts'

export type JsonSchema = Readonly<Record<string, unknown>>

export const opaqueIdSchema: JsonSchema = {
  type: 'string',
  minLength: 1,
  maxLength: 128,
  pattern: '^[A-Za-z0-9][A-Za-z0-9._:/-]*$',
}

export const isoDateSchema: JsonSchema = {
  type: 'string',
  format: 'date',
}

export const isoDateTimeSchema: JsonSchema = {
  type: 'string',
  format: 'date-time',
}

export const nonNegativeIntegerSchema: JsonSchema = {
  type: 'integer',
  minimum: 0,
}

export const positiveIntegerSchema: JsonSchema = {
  type: 'integer',
  minimum: 1,
}

export const effectiveWorkBlockRangeSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['minimumMinutes', 'targetMinutes', 'maximumMinutes'],
  properties: {
    minimumMinutes: { type: 'integer', minimum: 1, maximum: 240 },
    targetMinutes: { type: 'integer', minimum: 1, maximum: 240 },
    maximumMinutes: { type: 'integer', minimum: 1, maximum: 240 },
  },
  description:
    'A contextual, revisable effective work-block range. Runtime validation enforces minimum <= target <= maximum.',
  'x-manuel-runtime-refinement': ['minimumMinutes <= targetMinutes <= maximumMinutes'],
}

export const metadataSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    source: { enum: ['manual', 'adaptive-engine', 'migration', 'import'] },
    tags: {
      type: 'array',
      uniqueItems: true,
      maxItems: 50,
      items: { type: 'string', minLength: 1, maxLength: 500 },
    },
    extensions: {
      type: 'object',
      maxProperties: 500,
      propertyNames: {
        pattern: '^[a-z][a-z0-9-]*:[A-Za-z0-9._/-]+$',
      },
      additionalProperties: true,
    },
  },
}

export const actorSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['role'],
  properties: {
    role: { enum: ['student', 'parent', 'teacher', 'tutor', 'system'] },
    actorId: opaqueIdSchema,
  },
}

export function createRootJsonSchema(configuration: {
  readonly id: string
  readonly title: string
  readonly kind: string
  readonly properties: Readonly<Record<string, unknown>>
  readonly required: readonly string[]
  readonly defs?: Readonly<Record<string, unknown>>
  readonly description?: string
  readonly runtimeRefinements?: readonly string[]
}): JsonSchemaDocument {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: configuration.id,
    title: configuration.title,
    type: 'object',
    additionalProperties: false,
    ...(configuration.description ? { description: configuration.description } : {}),
    required: [
      'kind',
      'schemaVersion',
      'id',
      'revision',
      'createdAt',
      'updatedAt',
      ...configuration.required,
    ],
    properties: {
      kind: { const: configuration.kind },
      schemaVersion: { const: 1 },
      id: opaqueIdSchema,
      revision: positiveIntegerSchema,
      createdAt: isoDateTimeSchema,
      updatedAt: isoDateTimeSchema,
      metadata: metadataSchema,
      ...configuration.properties,
    },
    ...(configuration.defs ? { $defs: configuration.defs } : {}),
    ...(configuration.runtimeRefinements
      ? { 'x-manuel-runtime-refinement': configuration.runtimeRefinements }
      : {}),
  }
}

export const idArraySchema = (options: { readonly minimum?: number } = {}): JsonSchema => ({
  type: 'array',
  uniqueItems: true,
  minItems: options.minimum ?? 0,
  maxItems: 2_000,
  items: opaqueIdSchema,
})

export const stringArraySchema = (options: {
  readonly minimum?: number
  readonly allowed?: readonly string[]
} = {}): JsonSchema => ({
  type: 'array',
  minItems: options.minimum ?? 0,
  maxItems: 2_000,
  items: options.allowed
    ? { type: 'string', enum: options.allowed }
    : { type: 'string', minLength: 1, maxLength: 500 },
})

