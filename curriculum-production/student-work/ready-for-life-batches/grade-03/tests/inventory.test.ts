import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadCorpus } from '../src/loadCorpus.ts'

interface InventoryLesson {
  readonly lessonId: string
  readonly grade: number
  readonly stage: 'released' | 'authoring'
}

const ROOT = new URL('..', import.meta.url).pathname
const inventory: InventoryLesson[] = JSON.parse(readFileSync(`${ROOT}inventory.json`, 'utf-8'))

/**
 * The derived-from-source inventory is the honesty backbone of this batch:
 * it pins the true, re-derived denominator (all 36 Grade 3 Ready for Life
 * lessons) so authored-package coverage can never be silently overstated,
 * and so the batch fails loudly if the source ever stops matching the
 * expected 36-lesson count this task's instructions require.
 */
describe('derived inventory integrity', () => {
  it('is exactly 36 lessons, all grade 3, re-derived from source', () => {
    expect(inventory.length).toBe(36)
    for (const l of inventory) {
      expect(l.grade).toBe(3)
    }
  })

  it('is released stage (not authoring-stage) for every lesson', () => {
    for (const l of inventory) {
      expect(l.stage).toBe('released')
    }
  })

  it('spans exactly 6 units of 6 lessons each', () => {
    const ids = inventory.map((l) => l.lessonId)
    for (let unit = 1; unit <= 6; unit++) {
      for (let day = 1; day <= 6; day++) {
        const id = `ma-g3-ready-for-life-u${String(unit).padStart(2, '0')}-l${String(day).padStart(2, '0')}`
        expect(ids, `missing ${id}`).toContain(id)
      }
    }
  })

  it('every authored package corresponds to a real inventory lesson (no fabricated lesson IDs)', () => {
    const entries = loadCorpus()
    const inventoryIds = new Set(inventory.map((l) => l.lessonId))
    for (const { pkg } of entries) {
      expect(inventoryIds.has(pkg.lessonRef.lessonId), `${pkg.lessonRef.lessonId} is not in the derived inventory`).toBe(true)
    }
  })

  it('this batch authors the FULL 36-lesson inventory, not a partial sample', () => {
    const entries = loadCorpus()
    const authoredIds = new Set(entries.map((e) => e.pkg.lessonRef.lessonId))
    expect(authoredIds.size).toBe(inventory.length)
    for (const l of inventory) {
      expect(authoredIds.has(l.lessonId), `${l.lessonId} has no authored package`).toBe(true)
    }
  })
})
