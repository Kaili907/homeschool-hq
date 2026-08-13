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
 * The derived-from-source inventory is the honesty backbone of this batch:
 * it pins the true, re-derived denominator (all 36 grade-5 Ready for Life
 * lessons, 6 units x 6 lessons) so authored-package coverage is verifiable
 * against the real source, not assumed.
 */
describe('derived grade-05 inventory integrity', () => {
  it('spans exactly 36 lessons across 6 units of 6 lessons each, re-derived from source', () => {
    expect(inventory.length).toBe(36)
    const units = [...new Set(inventory.map((l) => l.unitNumber))].sort((a, b) => a - b)
    expect(units).toEqual([1, 2, 3, 4, 5, 6])
    for (const u of units) {
      expect(inventory.filter((l) => l.unitNumber === u).length).toBe(6)
    }
  })

  it('every lesson is grade 5, released stage, with dayInUnit 1-6', () => {
    for (const l of inventory) {
      expect(l.grade).toBe(5)
      expect(l.stage).toBe('released')
      expect(l.dayInUnit).toBeGreaterThanOrEqual(1)
      expect(l.dayInUnit).toBeLessThanOrEqual(6)
    }
  })

  it('has no duplicate lessonId', () => {
    const ids = inventory.map((l) => l.lessonId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every authored package corresponds to a real inventory lesson (no fabricated lesson IDs)', () => {
    const entries = loadCorpus()
    const inventoryIds = new Set(inventory.map((l) => l.lessonId))
    for (const { pkg } of entries) {
      expect(inventoryIds.has(pkg.lessonRef.lessonId), `${pkg.lessonRef.lessonId} is not in the derived inventory`).toBe(true)
    }
  })

  it('this batch authors the FULL 36-lesson inventory — every inventory lesson has a package', () => {
    const entries = loadCorpus()
    const authoredIds = new Set(entries.map((e) => e.pkg.lessonRef.lessonId))
    for (const l of inventory) {
      expect(authoredIds.has(l.lessonId), `${l.lessonId} is in the inventory but has no authored package`).toBe(true)
    }
    expect(authoredIds.size).toBe(inventory.length)
  })
})
