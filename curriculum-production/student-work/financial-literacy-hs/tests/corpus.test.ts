import { describe, expect, it } from 'vitest'
import { ALL_SPECS } from '../src/registry.ts'
import { loadSourceLessons, SOURCE_SHA } from '../src/sourceIndex.ts'
import {
  checkAntiTemplate, checkNoPlaceholders, checkParameterVisibility, checkSafety, checkStructure,
} from '../src/validate.ts'

const source = loadSourceLessons()
const sourceIds = source.map((l) => l.lessonId).sort()
const specIds = ALL_SPECS.map((s) => s.lessonId).sort()

describe('coverage against the pinned source corpus', () => {
  it('reads the source at the exact committed tip this lane was authored against', () => {
    expect(SOURCE_SHA).toHaveLength(40)
    expect(source).toHaveLength(288)
    for (const grade of [9, 10, 11, 12]) {
      expect(source.filter((l) => l.grade === grade)).toHaveLength(72)
    }
  })

  it('authors exactly one lesson package per source lesson, with none invented', () => {
    expect(new Set(specIds).size).toBe(specIds.length)
    const missing = sourceIds.filter((id) => !specIds.includes(id))
    const invented = specIds.filter((id) => !sourceIds.includes(id))
    expect({ invented }).toEqual({ invented: [] })
    expect({ missing: missing.length, firstMissing: missing.slice(0, 5) })
      .toEqual({ missing: 0, firstMissing: [] })
  })

  it('places every lesson at the grade, unit, and day the source assigns it', () => {
    const byId = new Map(source.map((l) => [l.lessonId, l]))
    const misplaced = ALL_SPECS.filter((s) => {
      const src = byId.get(s.lessonId)
      return !src || src.grade !== s.grade || src.unitNumber !== s.unit || src.dayInUnit !== s.day
    }).map((s) => s.lessonId)
    expect(misplaced).toEqual([])
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
})
