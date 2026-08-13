import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { composeScoringRecord, composeTaskSheet, packagePath, scoringPath } from '../src/compose.ts'
import { ALL_SPECS } from '../src/registry.ts'
import { sourceLessonMap } from '../src/sourceIndex.ts'

/**
 * Conformance of the emitted corpus to the two JSON Schemas in schema/.
 *
 * No JSON Schema validator is available to this lane without adding a
 * dependency to a repository it does not own, so this checks the schema's
 * load-bearing constraints directly against the schema documents themselves:
 * the required key sets, the closed top-level object, and every `const` the
 * schema pins. It is a subset of full validation, and deliberately reads the
 * constraints out of the schema files rather than restating them, so a schema
 * edit is felt here rather than silently diverging from what ships.
 */
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const source = sourceLessonMap()

interface Schema {
  required: string[]
  additionalProperties?: boolean
  properties: Record<string, { const?: unknown }>
}

const loadSchema = (name: string): Schema =>
  JSON.parse(readFileSync(join(ROOT, 'schema', name), 'utf-8')) as Schema

function conform(doc: Record<string, unknown>, schema: Schema, label: string): string[] {
  const problems: string[] = []
  for (const key of schema.required) {
    if (!(key in doc)) problems.push(`${label}: missing required key "${key}"`)
  }
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(doc)) {
      if (!(key in schema.properties)) problems.push(`${label}: unexpected key "${key}"`)
    }
  }
  for (const [key, rule] of Object.entries(schema.properties)) {
    if (rule && 'const' in rule && key in doc && doc[key] !== rule.const) {
      problems.push(`${label}: "${key}" is ${JSON.stringify(doc[key])}, schema pins ${JSON.stringify(rule.const)}`)
    }
  }
  return problems
}

describe('the emitted corpus conforms to the lane schemas', () => {
  it('every task sheet matches schema/task-sheet.schema.json', () => {
    const schema = loadSchema('task-sheet.schema.json')
    const problems = ALL_SPECS.flatMap((spec) =>
      conform(composeTaskSheet(spec, source.get(spec.lessonId)!), schema, packagePath(spec)),
    )
    expect(problems).toEqual([])
  })

  it('every scoring record matches schema/scoring-record.schema.json', () => {
    const schema = loadSchema('scoring-record.schema.json')
    const problems = ALL_SPECS.flatMap((spec) =>
      conform(composeScoringRecord(spec, source.get(spec.lessonId)!), schema, scoringPath(spec)),
    )
    expect(problems).toEqual([])
  })

  it('pins the safety-boundary constants in the task-sheet schema itself', () => {
    const schema = loadSchema('task-sheet.schema.json')
    expect(schema.properties.isFictionalSimulation.const).toBe(true)
    expect(schema.properties.realWorldAction.const).toBe(false)
    expect(schema.properties.completionAuthority.const).toBe('learner')
  })
})
