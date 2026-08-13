import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ALL_SPECS } from '../src/registry.ts'
import { loadSourceLessons, SOURCE_SHA } from '../src/sourceIndex.ts'
import {
  checkAntiTemplate, checkNoPlaceholders, checkParameterVisibility, checkSafety, checkStructure, skeleton,
} from '../src/validate.ts'

/**
 * This lane owns grade 10 units 3 to 7. Units 1 and 2 were authored earlier and
 * live in the sibling `financial-literacy-hs` lane, which this lane does not
 * modify. Coverage here is therefore asserted against the units this lane owns,
 * and separately against the whole of grade 10 once the sibling's twenty
 * lessons are counted.
 */
const OWNED_UNITS = [3, 4, 5, 6, 7]
const SIBLING = fileURLToPath(new URL('../../../financial-literacy-hs/', import.meta.url))

const source = loadSourceLessons()
const g10 = source.filter((l) => l.grade === 10)
const owned = g10.filter((l) => OWNED_UNITS.includes(l.unitNumber))
const specIds = ALL_SPECS.map((s) => s.lessonId).sort()

describe('coverage against the pinned source corpus', () => {
  it('reads the source at the exact committed tip this lane was authored against', () => {
    expect(SOURCE_SHA).toHaveLength(40)
    expect(source).toHaveLength(288)
    expect(g10).toHaveLength(72)
    expect(owned).toHaveLength(52)
  })

  it('authors every lesson of grade 10 units 3-7 exactly once, with none invented', () => {
    const ownedIds = owned.map((l) => l.lessonId).sort()
    expect({
      authored: specIds.length,
      unique: new Set(specIds).size,
      missing: ownedIds.filter((id) => !specIds.includes(id)),
      invented: specIds.filter((id) => !ownedIds.includes(id)),
    }).toEqual({ authored: 52, unique: 52, missing: [], invented: [] })
  })

  it('authors nothing belonging to another grade or to units 1-2', () => {
    const strays = ALL_SPECS.filter((s) => s.grade !== 10 || !OWNED_UNITS.includes(s.unit))
    expect(strays.map((s) => s.lessonId)).toEqual([])
  })

  it('places every lesson at the unit and day the source assigns it', () => {
    const byId = new Map(source.map((l) => [l.lessonId, l]))
    const misplaced = ALL_SPECS.filter((s) => {
      const src = byId.get(s.lessonId)
      return !src || src.grade !== s.grade || src.unitNumber !== s.unit || src.dayInUnit !== s.day
    }).map((s) => s.lessonId)
    expect(misplaced).toEqual([])
  })

  it('completes grade 10 once the sibling lane’s units 1-2 are counted', () => {
    const siblingIds = readdirSync(join(SIBLING, 'packages/grade-10'))
      .filter((f) => f.endsWith('.package.json'))
      .map((f) => JSON.parse(readFileSync(join(SIBLING, 'packages/grade-10', f), 'utf-8')).lessonRef.lessonId as string)
    const combined = new Set([...specIds, ...siblingIds])
    expect({
      sibling: siblingIds.length,
      overlap: specIds.filter((id) => siblingIds.includes(id)),
      combined: combined.size,
      missing: g10.map((l) => l.lessonId).filter((id) => !combined.has(id)),
    }).toEqual({ sibling: 20, overlap: [], combined: 72, missing: [] })
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
  it('has a distinct prompt shape, scenario, objective, and remediation within this lane', () => {
    expect(checkAntiTemplate(ALL_SPECS).map((f) => `${f.lessonId} ${f.where}: ${f.message}`)).toEqual([])
  })

  /**
   * The anti-template check above only sees this lane. Template collapse across
   * the whole high-school corpus would be just as bad, so this reads the sibling
   * lane's already-emitted task sheets and requires no collision against them
   * either. It reads the sibling's shipped output and never writes to it.
   */
  it('does not restate a lesson the sibling lane already ships', () => {
    const siblingSheets = ['grade-09', 'grade-10'].flatMap((dir) =>
      readdirSync(join(SIBLING, 'packages', dir))
        .filter((f) => f.endsWith('.package.json'))
        .map((f) => JSON.parse(readFileSync(join(SIBLING, 'packages', dir, f), 'utf-8')) as {
          objective: string; scenario: string; remediation: string
          tasks: { directions: string; prompts: { text: string }[] }[]
        }))
    const norm = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase()
    const sheetSkeleton = (sheet: { tasks: { directions: string; prompts: { text: string }[] }[] }): string =>
      norm(sheet.tasks.flatMap((t) => [t.directions, ...t.prompts.map((p) => p.text)]).join(' | ').replace(/[\d]+(\.\d+)?/g, '#'))

    const siblingObjectives = new Set(siblingSheets.map((s) => norm(s.objective)))
    const siblingScenarios = new Set(siblingSheets.map((s) => norm(s.scenario)))
    const siblingRemediations = new Set(siblingSheets.map((s) => norm(s.remediation)))
    const siblingSkeletons = new Set(siblingSheets.map(sheetSkeleton))

    const collisions: string[] = []
    for (const spec of ALL_SPECS) {
      if (siblingObjectives.has(norm(spec.objective))) collisions.push(`${spec.lessonId}: objective`)
      if (siblingScenarios.has(norm(spec.scenario))) collisions.push(`${spec.lessonId}: scenario`)
      if (siblingRemediations.has(norm(spec.remediation))) collisions.push(`${spec.lessonId}: remediation`)
      if (siblingSkeletons.has(skeleton(spec))) collisions.push(`${spec.lessonId}: prompt shape`)
    }
    expect({ siblingSheetsRead: siblingSheets.length, collisions }).toEqual({ siblingSheetsRead: 92, collisions: [] })
  })
})

describe('no fixed answer is readable before the learner computes it', () => {
  it('keeps every numeric answer out of the sheet text that precedes its own item', () => {
    const readable: string[] = []
    for (const spec of ALL_SPECS) {
      let seen = `${spec.scenario} \n ${spec.objective}`
      for (const task of spec.tasks) {
        seen += ` \n ${task.directions}`
        for (const item of task.items) {
          seen += ` \n ${item.text}`
          if (item.kind === 'choice') seen += ` \n ${item.choices.join(' ')}`
          if (item.kind !== 'numeric') continue
          if (seen.includes(item.answer)) {
            readable.push(`${spec.lessonId} ${item.ref}: answer ${item.answer} is already on the sheet`)
          }
        }
      }
    }
    expect(readable).toEqual([])
  })

  it('keeps every fixed-choice answer among the offered choices', () => {
    const bad = ALL_SPECS.flatMap((spec) =>
      spec.tasks.flatMap((t) => t.items)
        .filter((i) => i.kind === 'choice' && !i.choices.includes(i.answer))
        .map((i) => `${spec.lessonId} ${i.ref}`))
    expect(bad).toEqual([])
  })
})
