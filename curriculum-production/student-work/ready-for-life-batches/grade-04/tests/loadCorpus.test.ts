import { describe, expect, it } from 'vitest'
import { loadCombinedGrade4Corpus } from '../src/loadCorpus.ts'

describe('loadCorpus', () => {
  const entries = loadCombinedGrade4Corpus()

  it('loads every authored package with a resolvable scoring record', () => {
    expect(entries.length).toBe(36)
    for (const entry of entries) {
      expect(entry.scoring.packageId).toBe(entry.pkg.packageId)
      expect(entry.scoring.lessonId).toBe(entry.pkg.lessonRef.lessonId)
    }
  })

  it('has no duplicate packageId across the corpus', () => {
    const ids = entries.map((e) => e.pkg.packageId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every entry is subject ready-for-life, grade 4, subjectFamily ARTS_RFL_PE_PROJECT', () => {
    for (const { pkg } of entries) {
      expect(pkg.lessonRef.subject).toBe('ready-for-life')
      expect(pkg.lessonRef.grade).toBe(4)
      expect(pkg.subjectFamily).toBe('ARTS_RFL_PE_PROJECT')
    }
  })
})
