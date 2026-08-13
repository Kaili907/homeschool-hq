import { describe, expect, it } from 'vitest'
import { ALL_SPECS } from '../src/registry.ts'
import {
  EXPECTED_LESSON_COUNT, GRADE, SOURCE_SHA, loadSourceLessons, loadSourceUnits,
} from '../src/sourceIndex.ts'
import {
  checkAntiTemplate, checkNoPlaceholders, checkParameterVisibility, checkSafety, checkStructure,
} from '../src/validate.ts'

const source = loadSourceLessons()
const units = loadSourceUnits()
const sourceIds = source.map((l) => l.lessonId).sort()
const specIds = ALL_SPECS.map((s) => s.lessonId).sort()

describe('coverage against the pinned grade-11 source course', () => {
  it('re-derives the inventory from the source rather than assuming it', () => {
    expect(SOURCE_SHA).toHaveLength(40)
    expect(units).toHaveLength(7)
    expect(units.map((u) => u.unitNumber)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(units.flatMap((u) => u.standards.map((s) => s.split('.')[0]))).toEqual(
      ['PF1', 'PF2', 'PF3', 'PF4', 'PF4', 'PF5', 'PF6', 'PF7'],
    )
    expect(source).toHaveLength(EXPECTED_LESSON_COUNT)
    expect(units.reduce((n, u) => n + u.lessonIds.length, 0)).toBe(EXPECTED_LESSON_COUNT)
    expect(new Set(source.map((l) => l.grade))).toEqual(new Set([GRADE]))
  })

  it('authors all 72 source lessons, one package each, with none invented', () => {
    expect(new Set(specIds).size).toBe(specIds.length)
    const missing = sourceIds.filter((id) => !specIds.includes(id))
    const invented = specIds.filter((id) => !sourceIds.includes(id))
    expect({ invented }).toEqual({ invented: [] })
    expect({ missing: missing.length, firstMissing: missing.slice(0, 5) })
      .toEqual({ missing: 0, firstMissing: [] })
    expect(ALL_SPECS).toHaveLength(EXPECTED_LESSON_COUNT)
  })

  it('covers every unit completely, at the day the source assigns', () => {
    const byId = new Map(source.map((l) => [l.lessonId, l]))
    const misplaced = ALL_SPECS.filter((s) => {
      const src = byId.get(s.lessonId)
      return !src || src.grade !== s.grade || src.unitNumber !== s.unit || src.dayInUnit !== s.day
    }).map((s) => s.lessonId)
    expect(misplaced).toEqual([])
    for (const u of units) {
      const done = u.lessonIds.filter((id) => specIds.includes(id))
      expect({ unit: u.unitNumber, done: done.length }).toEqual({ unit: u.unitNumber, done: u.lessonIds.length })
    }
  })
})

describe('every authored lesson', () => {
  it('shows the learner every figure it is scored against', () => {
    expect(ALL_SPECS.flatMap(checkParameterVisibility).map((f) => `${f.lessonId} ${f.where}: ${f.message}`)).toEqual([])
  })

  it('never solicits real financial data and never individualises advice', () => {
    expect(ALL_SPECS.flatMap(checkSafety).map((f) => `${f.lessonId} ${f.where}: ${f.message}`)).toEqual([])
  })

  it('carries no placeholder standing in for authored content', () => {
    expect(ALL_SPECS.flatMap(checkNoPlaceholders).map((f) => `${f.lessonId} ${f.where}: ${f.message}`)).toEqual([])
  })

  it('meets the structural floor for a usable lesson', () => {
    expect(ALL_SPECS.flatMap(checkStructure).map((f) => `${f.lessonId} ${f.where}: ${f.message}`)).toEqual([])
  })
})

describe('no lesson is another lesson with the numbers changed', () => {
  it('has a distinct prompt shape, scenario, objective, and remediation per lesson', () => {
    expect(checkAntiTemplate(ALL_SPECS).map((f) => `${f.lessonId} ${f.where}: ${f.message}`)).toEqual([])
  })

  it('gives every lesson its own fictional actor', () => {
    const seen = new Map<string, string>()
    const collisions: string[] = []
    for (const spec of ALL_SPECS) {
      const key = spec.actor.trim().toLowerCase()
      const prior = seen.get(key)
      if (prior) collisions.push(`${spec.lessonId} reuses the actor of ${prior}`)
      else seen.set(key, spec.lessonId)
    }
    expect(collisions).toEqual([])
  })
})
