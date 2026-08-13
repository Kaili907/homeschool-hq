import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadCombinedGrade4Corpus, loadOwnCorpus } from '../src/loadCorpus.ts'

interface InventoryLesson {
  readonly lessonId: string
  readonly grade: number
}

const ROOT = new URL('..', import.meta.url).pathname
const inventory: InventoryLesson[] = JSON.parse(readFileSync(`${ROOT}grade-04-inventory.json`, 'utf-8'))

/**
 * Re-derives exact 1:1 coverage of the grade-4 Ready for Life inventory: 36
 * lessons, re-derived from source (curriculum-content 1.0.0 via branch
 * mac/g34-rfl-finlit-r1), against the combined corpus this batch owns (34
 * new lessons) plus the two already-authored R3 reference lessons it reads
 * but does not modify.
 */
describe('grade-4 inventory coverage — exact 1:1', () => {
  it('the derived inventory is exactly 36 grade-4 lessons', () => {
    expect(inventory.length).toBe(36)
  })

  it('this batch owns exactly the 34 lessons not already covered by the R3 reference pair', () => {
    const own = loadOwnCorpus()
    expect(own.length).toBe(34)
    const ids = own.map((e) => e.pkg.lessonRef.lessonId)
    expect(new Set(ids).size).toBe(34)
  })

  it('the combined corpus (batch + R3 reference) covers every inventory lesson exactly once', () => {
    const combined = loadCombinedGrade4Corpus()
    expect(combined.length).toBe(36)
    const coveredIds = new Set(combined.map((e) => e.pkg.lessonRef.lessonId))
    const inventoryIds = new Set(inventory.map((l) => l.lessonId))
    expect(coveredIds).toEqual(inventoryIds)
    // No duplicate coverage of a single inventory lesson.
    const idList = combined.map((e) => e.pkg.lessonRef.lessonId)
    expect(new Set(idList).size).toBe(idList.length)
  })

  it('no authored package references a lesson ID outside the derived inventory', () => {
    const combined = loadCombinedGrade4Corpus()
    const inventoryIds = new Set(inventory.map((l) => l.lessonId))
    for (const { pkg } of combined) {
      expect(inventoryIds.has(pkg.lessonRef.lessonId), `${pkg.lessonRef.lessonId} is not in the derived inventory`).toBe(true)
    }
  })
})
