import { describe, expect, it } from 'vitest'
import {
  getStudyEngineSchema,
  STUDY_ENGINE_SCHEMA_REGISTRY,
} from './registry.ts'
import {
  applyMutations,
  loadInvalidManifest,
  loadValidFixture,
  loadValidManifest,
} from './test-helpers.ts'

const validFixtures = loadValidManifest()
const invalidFixtures = loadInvalidManifest()

describe('valid contract fixtures', () => {
  it('has a non-empty manifest and covers every root schema', () => {
    expect(validFixtures.length).toBeGreaterThan(0)
    const covered = new Set(validFixtures.map((entry) => entry.schemaId))
    expect(covered).toEqual(new Set(STUDY_ENGINE_SCHEMA_REGISTRY.map((schema) => schema.schemaId)))
  })

  it.each(validFixtures)('$schemaId accepts $file and round-trips it', ({ schemaId, file }) => {
    const schema = getStudyEngineSchema(schemaId)
    expect(schema, `Unknown schema ${schemaId}`).toBeDefined()
    const fixture = loadValidFixture(file)
    const result = schema!.validate(fixture)
    expect(result, result.ok ? undefined : result.error).toMatchObject({ ok: true })
    if (!result.ok) return
    const serialized = JSON.stringify(result.value)
    const reparsed = JSON.parse(serialized) as unknown
    const second = schema!.validate(reparsed)
    expect(second, second.ok ? undefined : second.error).toMatchObject({ ok: true })
    if (second.ok) expect(second.value).toEqual(fixture)
  })
})

describe('invalid contract fixtures', () => {
  it('has a non-empty focused mutation manifest', () => {
    expect(invalidFixtures.length).toBeGreaterThan(0)
  })

  it.each(invalidFixtures)('$id is rejected at the declared issue', (fixtureCase) => {
    const schema = getStudyEngineSchema(fixtureCase.schemaId)
    expect(schema, `Unknown schema ${fixtureCase.schemaId}`).toBeDefined()
    const baseline = loadValidFixture(fixtureCase.baseFile)
    const invalid = applyMutations(baseline, fixtureCase.operations)
    const result = schema!.validate(invalid)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: fixtureCase.expectedCode,
        path: fixtureCase.expectedPath,
      }),
    )
  })
})

