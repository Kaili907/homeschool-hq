import { describe, expect, it } from 'vitest'
import { buildCorpus, joinAuthoredToSource } from '../src/build.ts'
import { countsByGrade, loadSourceLessons } from '../src/inventory.ts'

/**
 * The inventory is re-derived from source on every run rather than trusted
 * from a stored number: grades 5, 7, and 8 are read from the worktree and
 * grades 3 and 4 through `git show` from the branch that released them.
 */
describe('source inventory', () => {
  const source = loadSourceLessons()

  it('derives exactly 216 Financial Literacy lessons across grades 3, 4, 5, 7, and 8', () => {
    expect(source).toHaveLength(216)
    expect(countsByGrade(source)).toEqual({
      'grade-03': 36,
      'grade-04': 36,
      'grade-05': 36,
      'grade-07': 36,
      'grade-08': 72,
    })
  })

  it('carries a distinct lesson id and focus phrase for every lesson', () => {
    expect(new Set(source.map((lesson) => lesson.lessonId)).size).toBe(216)
    expect(source.every((lesson) => lesson.focus.trim().length > 0)).toBe(true)
  })
})

describe('coverage', () => {
  it('pairs every source lesson with exactly one authored package and scoring record', () => {
    const joined = joinAuthoredToSource()
    expect(joined).toHaveLength(216)
    expect(new Set(joined.map((entry) => entry.authored.key)).size).toBe(216)
  })

  it('emits one package and one scoring record per lesson, with matching ids', () => {
    const entries = buildCorpus()
    expect(entries).toHaveLength(216)
    for (const entry of entries) {
      expect(entry.scoring.packageId).toBe(entry.pkg.packageId)
      expect(entry.scoring.lessonId).toBe(entry.pkg.lessonRef.lessonId)
      expect(entry.pkg.scoringRef).toBe(entry.scoringPath)
    }
  })
})
