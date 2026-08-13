import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadCorpus } from '../src/loadCorpus.ts'

interface InventoryItem {
  readonly lessonId: string
  readonly courseId: string
  readonly grade: number
  readonly unitNumber: number
  readonly dayInUnit: number
}

describe('inventory.json — derived, not assumed, shape', () => {
  const inventory = JSON.parse(readFileSync(new URL('../inventory.json', import.meta.url), 'utf-8')) as InventoryItem[]

  it('is exactly 36 lessons (6 units of 6), matching the source units.json shape', () => {
    expect(inventory.length).toBe(36)
  })

  it('every lesson is grade 12 course ma-g12-ready-for-life', () => {
    for (const item of inventory) {
      expect(item.grade).toBe(12)
      expect(item.courseId).toBe('ma-g12-ready-for-life')
    }
  })

  it('spans exactly 6 units of 6 lessons each', () => {
    const byUnit = new Map<number, number>()
    for (const item of inventory) {
      byUnit.set(item.unitNumber, (byUnit.get(item.unitNumber) ?? 0) + 1)
    }
    expect(byUnit.size).toBe(6)
    for (const count of byUnit.values()) {
      expect(count).toBe(6)
    }
  })

  it('every inventory lessonId has a corresponding authored package (all 36 covered, none missing)', () => {
    const entries = loadCorpus()
    const authoredIds = new Set(entries.map((e) => e.pkg.lessonRef.lessonId))
    for (const item of inventory) {
      expect(authoredIds.has(item.lessonId), `missing authored package for ${item.lessonId}`).toBe(true)
    }
  })
})
