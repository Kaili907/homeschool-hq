import { describe, expect, it } from 'vitest'
import {
  gradeBandFromLegacyGrade,
  skillIdFromLegacySkillId,
  studentIdFromLegacyProfileId,
  subjectIdFromLegacySubjectId,
} from '../contracts/index.ts'
import { migrateStudyEngineContractToCurrent } from './migrations.ts'
import { getStudyEngineSchema } from './registry.ts'
import { loadValidFixture, loadValidManifest } from './test-helpers.ts'

function collectIdentifierValues(value: unknown, path = '$', output = new Map<string, unknown>()) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectIdentifierValues(entry, `${path}[${index}]`, output))
    return output
  }
  if (typeof value !== 'object' || value === null) return output
  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}.${key}`
    if (
      key === 'id' ||
      key.endsWith('Id') ||
      key.endsWith('Ids') ||
      key.endsWith('Ref') ||
      key === 'segmentSequence'
    ) {
      output.set(entryPath, structuredClone(entry))
    }
    collectIdentifierValues(entry, entryPath, output)
  }
  return output
}

describe('identifier stability', () => {
  it.each(loadValidManifest())('$file preserves every identifier byte through validation and JSON', ({
    schemaId,
    file,
  }) => {
    const fixture = loadValidFixture(file)
    const before = collectIdentifierValues(fixture)
    const schema = getStudyEngineSchema(schemaId)!
    const parsed = schema.parse(fixture)
    const roundTripped = JSON.parse(JSON.stringify(parsed)) as unknown
    const after = collectIdentifierValues(roundTripped)
    expect(after).toEqual(before)
  })

  it('legacy adapters preserve opaque identifiers exactly', () => {
    expect(studentIdFromLegacyProfileId('p1')).toBe('p1')
    expect(skillIdFromLegacySkillId('fracUnit')).toBe('fracUnit')
    expect(subjectIdFromLegacySubjectId('personal-finance')).toBe('personal-finance')
  })

  it.each([
    ['3', 'elementary-3-5'],
    ['4', 'elementary-3-5'],
    ['6', 'middle-6-8'],
    ['10', 'high-9-12'],
    ['12', 'high-9-12'],
  ] as const)('maps legacy grade %s to %s without inferring placement', (grade, expected) => {
    expect(gradeBandFromLegacyGrade(grade)).toBe(expected)
  })

  it('the current-version migration gate is non-mutating and idempotent', () => {
    const fixture = loadValidFixture('study-plan.json')
    const first = migrateStudyEngineContractToCurrent(fixture)
    expect(first).toMatchObject({ ok: true, migrated: false })
    if (!first.ok) return
    expect(first.value).toBe(fixture)
    const second = migrateStudyEngineContractToCurrent(first.value)
    expect(second).toMatchObject({ ok: true, migrated: false })
    if (second.ok) expect(second.value).toBe(fixture)
  })
})

