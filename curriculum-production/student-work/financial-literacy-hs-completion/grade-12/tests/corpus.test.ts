import { describe, expect, it } from 'vitest'
import { ALL_SPECS } from '../src/registry.ts'
import { loadSourceLessons, loadSourceUnits, SOURCE_SHA } from '../src/sourceIndex.ts'
import {
  checkAntiTemplate, checkIntegration, checkMixedScoring, checkNoPlaceholders,
  checkParameterVisibility, checkSafety, checkStructure,
} from '../src/validate.ts'

const source = loadSourceLessons()
const units = loadSourceUnits()
const sourceIds = source.map((l) => l.lessonId).sort()
const specIds = ALL_SPECS.map((s) => s.lessonId).sort()

describe('coverage against the pinned grade 12 source', () => {
  it('reads the source at the exact committed tip this lane was authored against', () => {
    expect(SOURCE_SHA).toHaveLength(40)
    expect(source).toHaveLength(72)
    expect(source.every((l) => l.grade === 12)).toBe(true)
  })

  it('derives the unit structure from the source rather than asserting it', () => {
    expect(units).toHaveLength(7)
    expect(units.map((u) => u.lessonIds.length)).toEqual([10, 10, 10, 11, 10, 10, 11])
    expect(units.reduce((n, u) => n + u.lessonIds.length, 0)).toBe(72)
    expect(units.filter((u) => u.isCapstoneUnit).map((u) => u.unitNumber)).toEqual([7])
  })

  it('authors exactly one lesson package per source lesson, with none invented and none orphaned', () => {
    expect(new Set(specIds).size).toBe(specIds.length)
    const missing = sourceIds.filter((id) => !specIds.includes(id))
    const invented = specIds.filter((id) => !sourceIds.includes(id))
    expect({ invented }).toEqual({ invented: [] })
    expect({ missing: missing.length, firstMissing: missing.slice(0, 5) })
      .toEqual({ missing: 0, firstMissing: [] })
    expect(specIds).toHaveLength(72)
  })

  it('places every lesson at the grade, unit, and day the source assigns it', () => {
    const byId = new Map(source.map((l) => [l.lessonId, l]))
    const misplaced = ALL_SPECS.filter((s) => {
      const src = byId.get(s.lessonId)
      return !src || src.grade !== s.grade || src.unitNumber !== s.unit || src.dayInUnit !== s.day
    }).map((s) => s.lessonId)
    expect(misplaced).toEqual([])
  })

  it('marks every source-flagged capstone lesson as a capstone, and confines capstones to the capstone unit', () => {
    const byId = new Map(ALL_SPECS.map((s) => [s.lessonId, s]))
    const sourceFlagged = source.filter((l) => l.isCapstoneLesson).map((l) => l.lessonId)
    expect(sourceFlagged.length).toBeGreaterThan(0)
    for (const id of sourceFlagged) expect(byId.get(id)?.isCapstone).toBe(true)
    const capstones = ALL_SPECS.filter((s) => s.isCapstone)
    expect(capstones.every((s) => s.unit === 7)).toBe(true)
    expect(capstones.length).toBeGreaterThanOrEqual(sourceFlagged.length)
  })
})

describe('every authored lesson', () => {
  const collect = (fn: (s: typeof ALL_SPECS[number]) => { lessonId: string; where: string; message: string }[]) =>
    ALL_SPECS.flatMap(fn).map((f) => `${f.lessonId} ${f.where}: ${f.message}`)

  it('shows the learner every figure it is scored against', () => {
    expect(collect(checkParameterVisibility)).toEqual([])
  })

  it('never solicits real financial data and never individualises advice', () => {
    expect(collect(checkSafety)).toEqual([])
  })

  it('carries no placeholder standing in for authored content', () => {
    expect(collect(checkNoPlaceholders)).toEqual([])
  })

  it('meets the structural floor for a usable lesson', () => {
    expect(collect(checkStructure)).toEqual([])
  })

  it('integrates at least two financial domains, as a senior lesson must', () => {
    expect(collect(checkIntegration)).toEqual([])
    expect(ALL_SPECS.every((s) => s.domains.length >= 2)).toBe(true)
  })

  it('carries both fixed and judgment scoring authority', () => {
    expect(collect(checkMixedScoring)).toEqual([])
  })
})

describe('rubric completeness', () => {
  it('gives every judgment item lesson-specific criteria, evidence, look-fors, and dimensions', () => {
    const thin: string[] = []
    for (const spec of ALL_SPECS) {
      for (const item of spec.tasks.flatMap((t) => t.items)) {
        if (item.kind !== 'judgment') continue
        if (item.acceptableAnswerCriteria.length < 2) thin.push(`${spec.lessonId} ${item.ref}: criteria`)
        if (item.evidenceRequirements.length < 1) thin.push(`${spec.lessonId} ${item.ref}: evidence`)
        if (item.lookFors.length < 1) thin.push(`${spec.lessonId} ${item.ref}: look-fors`)
        if (item.dimensions.length < 1) thin.push(`${spec.lessonId} ${item.ref}: dimensions`)
      }
    }
    expect(thin).toEqual([])
  })

  it('draws every declared rubric dimension from the shared spine', async () => {
    const { DIMENSIONS } = await import('../src/rubric.ts')
    const unknown = ALL_SPECS.flatMap((s) => s.tasks.flatMap((t) => t.items))
      .filter((i) => i.kind === 'judgment')
      .flatMap((i) => i.dimensions)
      .filter((d) => !(d in DIMENSIONS))
    expect([...new Set(unknown)]).toEqual([])
  })
})

describe('no lesson is another lesson with the numbers changed', () => {
  it('has a distinct prompt shape, scenario, objective, remediation, and fixed-answer set per lesson', () => {
    expect(checkAntiTemplate(ALL_SPECS).map((f) => `${f.lessonId} ${f.where}: ${f.message}`)).toEqual([])
  })
})
