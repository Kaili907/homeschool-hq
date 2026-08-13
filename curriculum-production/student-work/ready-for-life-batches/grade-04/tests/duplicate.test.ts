import { describe, expect, it } from 'vitest'
import { loadCombinedGrade4Corpus } from '../src/loadCorpus.ts'
import { findDuplicates } from '../src/duplicateCheck.ts'

/**
 * Detects exact and near-duplicate production packages within the grade-4
 * course: a pairwise token-overlap check over objective/scenario/tasks/
 * remediation/extension text (excluding titles and lessonRef metadata,
 * which legitimately share boilerplate). Guards against the exact defect
 * this task's inventory work found and rejected elsewhere in this fleet —
 * one boilerplate template with only the focus phrase swapped in.
 */
describe('duplicate detection across the combined grade-4 corpus', () => {
  const entries = loadCombinedGrade4Corpus()
  const duplicates = findDuplicates(entries)

  it('has zero exact-duplicate content pairs', () => {
    const exact = duplicates.filter((d) => d.kind === 'exact')
    if (exact.length > 0) {
      throw new Error(exact.map((d) => `${d.a} === ${d.b}`).join('\n'))
    }
    expect(exact).toEqual([])
  })

  it('has zero near-duplicate content pairs above the similarity threshold', () => {
    const near = duplicates.filter((d) => d.kind === 'near')
    if (near.length > 0) {
      throw new Error(near.map((d) => `${d.a} ~ ${d.b} (jaccard ${d.jaccard.toFixed(2)})`).join('\n'))
    }
    expect(near).toEqual([])
  })
})
