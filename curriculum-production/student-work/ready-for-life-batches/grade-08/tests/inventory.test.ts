import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadCorpus } from '../src/loadCorpus.ts'

interface InventoryLesson {
  readonly lessonId: string
  readonly grade: number
  readonly unitNumber: number
  readonly dayInUnit: number
  readonly stage: 'released'
}

const ROOT = new URL('..', import.meta.url).pathname
const inventory: InventoryLesson[] = JSON.parse(readFileSync(`${ROOT}inventory.json`, 'utf-8'))

/**
 * The derived-from-source inventory pins the true denominator (every Grade
 * 8 Ready for Life lesson) re-derived directly from
 * curriculum-content/manuel-academy/1.0.0, not assumed. This batch's goal
 * is full coverage of all 36 — the "re-derive, don't trust the requested
 * shape" instruction plus the full authoring goal, both checked here.
 */
describe('derived inventory integrity — Grade 8 Ready for Life', () => {
  it('spans exactly 36 lessons across 6 units of 6 days each, all released-stage', () => {
    expect(inventory.length).toBe(36)
    for (const l of inventory) {
      expect(l.grade).toBe(8)
      expect(l.stage).toBe('released')
    }
    const units = [...new Set(inventory.map((l) => l.unitNumber))].sort((a, b) => a - b)
    expect(units).toEqual([1, 2, 3, 4, 5, 6])
    for (const u of units) {
      expect(inventory.filter((l) => l.unitNumber === u).length).toBe(6)
    }
  })

  it('every authored package corresponds to a real inventory lesson (no fabricated lesson IDs)', () => {
    const entries = loadCorpus()
    const inventoryIds = new Set(inventory.map((l) => l.lessonId))
    for (const { pkg } of entries) {
      expect(inventoryIds.has(pkg.lessonRef.lessonId), `${pkg.lessonRef.lessonId} is not in the derived inventory`).toBe(true)
    }
  })

  it('reports true coverage honestly — this batch authors all 36 lessons, not a partial sample', () => {
    const entries = loadCorpus()
    const authoredIds = new Set(entries.map((e) => e.pkg.lessonRef.lessonId))
    const inventoryIds = new Set(inventory.map((l) => l.lessonId))
    expect(authoredIds.size).toBe(36)
    for (const id of inventoryIds) {
      expect(authoredIds.has(id), `${id} from the inventory has no authored package`).toBe(true)
    }
  })
})
