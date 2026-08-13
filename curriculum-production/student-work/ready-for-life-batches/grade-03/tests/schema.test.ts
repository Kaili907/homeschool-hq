import { describe, expect, it } from 'vitest'
import { loadCorpus } from '../src/loadCorpus.ts'
import { validateCorpusSchema } from '../src/schemaValidate.ts'

/**
 * Explicit "schema tests" step: a hand-rolled structural validator mirroring
 * schema/task-sheet.schema.json and schema/scoring-record.schema.json (no
 * ajv dependency is installed anywhere in this repo — confirmed absent, so
 * this is a from-scratch runtime check rather than a TypeScript-cast-only
 * guarantee). Independent of gate.test.ts and validate.test.ts, which check
 * production-readiness and safety/privacy rules respectively, not raw
 * schema conformance.
 */
describe('schema conformance', () => {
  const entries = loadCorpus()

  it('every package and scoring record conforms to the JSON Schema files', () => {
    const issues = validateCorpusSchema(entries)
    if (issues.length > 0) {
      throw new Error(issues.map((i) => `${i.path}: ${i.detail}`).join('\n'))
    }
    expect(issues).toEqual([])
  })
})
