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
 * the required key sets, the closed top-level object, every `const` the schema
 * pins, and the string patterns and minimum lengths that carry meaning. It
 * reads the constraints out of the schema files rather than restating them, so
 * a schema edit is felt here rather than silently diverging from what ships.
 */
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const source = sourceLessonMap()

interface Rule {
  const?: unknown
  pattern?: string
  minLength?: number
  type?: string
  enum?: unknown[]
}
interface Schema {
  required: string[]
  additionalProperties?: boolean
  properties: Record<string, Rule>
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
    if (!rule || !(key in doc)) continue
    const v = doc[key]
    if ('const' in rule && v !== rule.const) {
      problems.push(`${label}: "${key}" is ${JSON.stringify(v)}, schema pins ${JSON.stringify(rule.const)}`)
    }
    if (rule.pattern && typeof v === 'string' && !new RegExp(rule.pattern).test(v)) {
      problems.push(`${label}: "${key}" = ${JSON.stringify(v)} does not match ${rule.pattern}`)
    }
    if (rule.minLength !== undefined && typeof v === 'string' && v.length < rule.minLength) {
      problems.push(`${label}: "${key}" is shorter than the schema minimum of ${rule.minLength}`)
    }
    if (rule.enum && !rule.enum.includes(v as never)) {
      problems.push(`${label}: "${key}" = ${JSON.stringify(v)} is not one of ${JSON.stringify(rule.enum)}`)
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
    expect(schema.properties.signOff.type).toBe('null')
  })

  it('emits a grade-11 package id and scoring path for every lesson', () => {
    const bad = ALL_SPECS.filter((s) => !/^packages\/grade-11\/swk-flhs-g11-u\d{2}-l\d{2}\.package\.json$/.test(packagePath(s)))
    expect(bad.map((s) => s.lessonId)).toEqual([])
    const badScoring = ALL_SPECS.filter((s) => !/^scoring\/grade-11\/swk-flhs-g11-u\d{2}-l\d{2}\.scoring\.json$/.test(scoringPath(s)))
    expect(badScoring.map((s) => s.lessonId)).toEqual([])
  })
})
