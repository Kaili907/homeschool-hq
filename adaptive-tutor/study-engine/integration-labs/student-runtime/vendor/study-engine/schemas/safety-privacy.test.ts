import { describe, expect, it } from 'vitest'
import {
  learningEvidenceSchema,
  parentTeacherControlsSchema,
  studentFocusProfileSchema,
  studySessionSchema,
} from './index.ts'
import { STUDY_ENGINE_SCHEMA_REGISTRY } from './registry.ts'
import { cloneFixture, loadValidFixture, loadValidManifest } from './test-helpers.ts'

const PRIVATE_SENTINEL = 'SYNTHETIC-PRIVATE-NOTE-7QX9'

function collectPropertyNames(value: unknown, names = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectPropertyNames(entry, names))
    return names
  }
  if (typeof value !== 'object' || value === null) return names
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'properties' && typeof entry === 'object' && entry !== null && !Array.isArray(entry)) {
      Object.keys(entry).forEach((property) => names.add(property))
    }
    collectPropertyNames(entry, names)
  }
  return names
}

describe('required child-safety language and inference rules', () => {
  it('accepts low accuracy with steady effort, ordinary latency, and no support concern', () => {
    const fixture = loadValidFixture('learning-evidence-low-accuracy.json')
    const result = learningEvidenceSchema.validate(fixture)
    expect(result, result.ok ? undefined : result.error).toMatchObject({ ok: true })
    if (!result.ok) return
    expect(result.value.accuracy?.accuracyPercent).toBe(20)
    expect(result.value.effort?.rating).toBe(5)
    expect(result.value.engagementSupport?.status).toBe('no-concern')
  })

  it('rejects an engagement-support concern based on accuracy alone', () => {
    const fixture = cloneFixture('learning-evidence-low-accuracy.json')
    fixture.engagementSupport = {
      status: 'support-may-help',
      supportingSignals: ['accuracy'],
      wording: 'contextual-and-revisable',
    }
    const result = learningEvidenceSchema.validate(fixture)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((issue) => issue.code === 'safety')).toBe(true)
  })

  it('exposes no fixed/permanent attention-span property in any JSON Schema', () => {
    const propertyNames = new Set<string>()
    STUDY_ENGINE_SCHEMA_REGISTRY.forEach((schema) =>
      collectPropertyNames(schema.jsonSchema, propertyNames),
    )
    expect([...propertyNames].filter((key) => /attention.?span|fixedattention/i.test(key))).toEqual([])
  })

  it('describes effective work-block guidance as contextual and revisable', () => {
    const schemaText = STUDY_ENGINE_SCHEMA_REGISTRY.map((schema) =>
      JSON.stringify(schema.jsonSchema),
    ).join('\n')
    expect(schemaText).toContain('effective work-block range')
    expect(schemaText).toMatch(/contextual.*revisable|revisable.*contextual/i)
  })
})

describe('adult-private boundary', () => {
  it('keeps the private sentinel out of every non-private valid fixture', () => {
    for (const entry of loadValidManifest()) {
      if (entry.schemaId === 'parent-teacher-private') continue
      expect(JSON.stringify(loadValidFixture(entry.file)), entry.file).not.toContain(PRIVATE_SENTINEL)
    }
  })

  it.each([
    ['parent-teacher-controls', parentTeacherControlsSchema, 'parent-teacher-controls.json'],
    ['study-session', studySessionSchema, 'session-completed.json'],
    ['learning-evidence', learningEvidenceSchema, 'learning-evidence-low-accuracy.json'],
    ['student-focus-profile', studentFocusProfileSchema, 'focus-profile-established.json'],
  ] as const)('%s rejects an embedded private-note body', (_name, schema, filename) => {
    const fixture = cloneFixture(filename)
    fixture.privateNote = PRIVATE_SENTINEL
    const result = schema.validate(fixture)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: 'unknown-key', path: '$.privateNote' }),
      )
    }
  })

  it('keeps session interruption fixtures free of shaming or diagnostic labels', () => {
    const sessionFiles = loadValidManifest().filter((entry) => entry.schemaId === 'study-session')
    const text = sessionFiles.map((entry) => JSON.stringify(loadValidFixture(entry.file))).join('\n')
    expect(text).not.toMatch(/poor attention|not paying attention|lazy|careless|disengag/i)
  })
})

