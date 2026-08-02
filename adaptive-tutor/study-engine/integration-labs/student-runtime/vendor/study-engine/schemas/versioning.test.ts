import { describe, expect, it } from 'vitest'
import { inspectContractVersion } from '../contracts/index.ts'
import { migrateStudyEngineContractToCurrent } from './migrations.ts'
import { cloneFixture, loadValidFixture } from './test-helpers.ts'

describe('contract versioning and migration gate', () => {
  it.each([
    [null, 'missing-version'],
    [{}, 'missing-version'],
    [{ schemaVersion: '1' }, 'invalid-version'],
    [{ schemaVersion: -1 }, 'invalid-version'],
    [{ schemaVersion: 0 }, 'unsupported-older-version'],
    [{ schemaVersion: 2 }, 'unsupported-future-version'],
  ] as const)('classifies %j as %s', (value, status) => {
    expect(inspectContractVersion(value).status).toBe(status)
  })

  it('accepts current schemaVersion 1', () => {
    expect(inspectContractVersion({ schemaVersion: 1 })).toEqual({
      status: 'current',
      schemaVersion: 1,
    })
  })

  it('quarantines a future version without modifying it', () => {
    const fixture = cloneFixture('study-plan.json')
    fixture.schemaVersion = 2
    const before = structuredClone(fixture)
    const result = migrateStudyEngineContractToCurrent(fixture)
    expect(result).toMatchObject({ ok: false, disposition: 'unsupported-future-version' })
    expect(fixture).toEqual(before)
  })

  it('rejects an unknown current-version kind', () => {
    const fixture = cloneFixture('study-plan.json')
    fixture.kind = 'unknown-contract'
    const result = migrateStudyEngineContractToCurrent(fixture)
    expect(result).toMatchObject({ ok: false, disposition: 'unknown-kind' })
  })

  it('keeps the current payload and identifiers by reference', () => {
    const fixture = loadValidFixture('parent-teacher-controls.json')
    const result = migrateStudyEngineContractToCurrent(fixture)
    expect(result).toMatchObject({ ok: true, migrated: false })
    if (result.ok) expect(result.value).toBe(fixture)
  })
})

