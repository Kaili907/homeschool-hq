import { describe, expect, it } from 'vitest'
import { loadCorpus } from '../src/loadCorpus.ts'

describe('loadCorpus', () => {
  const entries = loadCorpus()

  it('loads every authored package with a resolvable scoring record', () => {
    expect(entries.length).toBeGreaterThan(0)
    for (const entry of entries) {
      expect(entry.scoring.packageId).toBe(entry.pkg.packageId)
      expect(entry.scoring.lessonId).toBe(entry.pkg.lessonRef.lessonId)
    }
  })

  it('covers both subjects across grades 3, 4, 5, 7, 8, and 9', () => {
    const gradesBySubject = new Map<string, Set<number>>()
    for (const { pkg } of entries) {
      const set = gradesBySubject.get(pkg.lessonRef.subject) ?? new Set<number>()
      set.add(pkg.lessonRef.grade)
      gradesBySubject.set(pkg.lessonRef.subject, set)
    }
    expect([...(gradesBySubject.get('ready-for-life') ?? [])].sort()).toEqual([3, 4, 5, 7, 8, 9])
    expect([...(gradesBySubject.get('financial-literacy') ?? [])].sort()).toEqual([3, 4, 5, 7, 8, 9])
  })

  it('has no duplicate packageId across the corpus', () => {
    const ids = entries.map((e) => e.pkg.packageId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
