import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  GENERATED_SCHEMA_FILE_NAMES,
  STUDY_ENGINE_SCHEMA_REGISTRY,
} from './registry.ts'
import { generatedSchemaDirectory } from './test-helpers.ts'

describe('JSON Schema registry and generated artifacts', () => {
  it('registers seven unique root schemas', () => {
    expect(STUDY_ENGINE_SCHEMA_REGISTRY).toHaveLength(7)
    expect(new Set(STUDY_ENGINE_SCHEMA_REGISTRY.map((schema) => schema.schemaId)).size).toBe(7)
    expect(new Set(STUDY_ENGINE_SCHEMA_REGISTRY.map((schema) => schema.jsonSchema.$id)).size).toBe(7)
  })

  it.each(STUDY_ENGINE_SCHEMA_REGISTRY)(
    '$schemaId has a stable Draft 2020-12 root contract',
    (schema) => {
      expect(schema.schemaVersion).toBe(1)
      expect(schema.jsonSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
      expect(schema.jsonSchema.$id).toBe(`urn:manuel-academy:study-engine:${schema.schemaId}:1`)
      expect(schema.jsonSchema.additionalProperties).toBe(false)
      const properties = schema.jsonSchema.properties as Record<string, Record<string, unknown>>
      expect(properties.kind).toEqual({ const: schema.kind })
      expect(properties.schemaVersion).toEqual({ const: 1 })
    },
  )

  it.each(STUDY_ENGINE_SCHEMA_REGISTRY)(
    '$schemaId generated file exactly matches the runtime descriptor',
    (schema) => {
      const filename = GENERATED_SCHEMA_FILE_NAMES[schema.schemaId]
      expect(filename).toBeTruthy()
      const raw = readFileSync(resolve(generatedSchemaDirectory, filename!), 'utf8')
      expect(raw.endsWith('\n')).toBe(true)
      expect(JSON.parse(raw)).toEqual(schema.jsonSchema)
      expect(raw).toBe(`${JSON.stringify(schema.jsonSchema, null, 2)}\n`)
    },
  )
})

