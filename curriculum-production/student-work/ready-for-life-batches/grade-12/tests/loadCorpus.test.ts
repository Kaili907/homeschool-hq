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

  it('has no duplicate packageId across the corpus', () => {
    const ids = entries.map((e) => e.pkg.packageId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every entry is grade 12 ready-for-life with subjectFamily ARTS_RFL_PE_PROJECT', () => {
    for (const { pkg } of entries) {
      expect(pkg.lessonRef.grade).toBe(12)
      expect(pkg.lessonRef.subject).toBe('ready-for-life')
      expect(pkg.subjectFamily).toBe('ARTS_RFL_PE_PROJECT')
    }
  })

  it('loads exactly the 36 lessons the source inventory requires', () => {
    expect(entries.length).toBe(36)
  })
})
