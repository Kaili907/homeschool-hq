import { describe, expect, it } from 'vitest'
import {
  FLOORS, GRADE9_BASELINE, checkCorpusProgression, checkLessonProgression,
  checkNotReskinnedFromGrade9, grade9CorpusAvailable, metricsFor, refDepth,
} from '../src/progression.ts'
import { ALL_SPECS } from '../src/registry.ts'
import { loadSourceUnits } from '../src/sourceIndex.ts'

/**
 * Grade 11 must sit substantively above grade 9, and must not be grade 9
 * re-skinned with larger numbers. Both are checked, not asserted.
 */
describe('grade-11 progression', () => {
  it('meets the per-lesson analysis floor in every lesson', () => {
    expect(ALL_SPECS.flatMap(checkLessonProgression).map((f) => `${f.lessonId}: ${f.message}`)).toEqual([])
  })

  it('meets the corpus-wide floors and exceeds the measured grade-9 means', () => {
    const p = checkCorpusProgression(ALL_SPECS)
    expect(p.findings.map((f) => f.message)).toEqual([])
    expect(p.meanItems).toBeGreaterThan(GRADE9_BASELINE.meanPrompts)
    expect(p.meanFixed).toBeGreaterThan(GRADE9_BASELINE.meanFixed)
    expect(p.meanMaxDepth).toBeGreaterThan(GRADE9_BASELINE.meanMaxDepth)
    expect(p.lessonsAtDepth2).toBe(ALL_SPECS.length)
    expect(p.lessonsAtDepth3).toBeGreaterThanOrEqual(FLOORS.deepLessonsMin)
    expect(p.multiPeriodLessons).toBeGreaterThanOrEqual(FLOORS.multiPeriodLessonsMin)
  })

  it('is not the grade-9 corpus with the numbers changed', () => {
    expect(grade9CorpusAvailable()).toBe(true)
    expect(checkNotReskinnedFromGrade9(ALL_SPECS).map((f) => `${f.lessonId}: ${f.message}`)).toEqual([])
  })

  /**
   * `usesMultiPeriod` detects closed-form compounding (`pow`), which is the
   * right model where a quantity grows at a rate — units 1, 2, 3, 5, and 6.
   * Units 4 and 7 also work across many periods and many bands, but they do it
   * explicitly: unit 4 builds amortisation month by month from the outstanding
   * balance, and unit 7 computes tax band by band. Those are the correct models
   * for those topics and would be less rigorous, not more, expressed as a power.
   * So the claim tested here is that compounding is spread across most of the
   * course rather than confined to one unit — not that every unit uses it.
   */
  it('spreads multi-period modelling across most of the seven units', () => {
    const units = loadSourceUnits().map((u) => u.unitNumber)
    const withCompounding = units.filter(
      (u) => ALL_SPECS.some((s) => s.unit === u && metricsFor(s).usesMultiPeriod),
    )
    expect(withCompounding.length).toBeGreaterThanOrEqual(4)
  })

  it('gives every unit lessons that compose earlier results throughout', () => {
    const units = loadSourceUnits().map((u) => u.unitNumber)
    const thin = units.filter(
      (u) => ALL_SPECS.filter((s) => s.unit === u && metricsFor(s).maxDepth >= 2).length
        < ALL_SPECS.filter((s) => s.unit === u).length,
    )
    expect(thin).toEqual([])
  })

  it('scores tradeoff, assumption, uncertainty, transfer, or error work in every unit', () => {
    const units = loadSourceUnits().map((u) => u.unitNumber)
    const thin = units.filter(
      (u) => ALL_SPECS.filter((s) => s.unit === u && metricsFor(s).analysisDimensions.length > 0).length
        < ALL_SPECS.filter((s) => s.unit === u).length,
    )
    expect(thin).toEqual([])
  })

  it('measures composition depth the way the floors assume', () => {
    expect(refDepth('a * b')).toBe(0)
    expect(refDepth('#t1-p1 * rate')).toBe(1)
    expect(refDepth('#t1-p1 + #t1-p2 - #t2-p1')).toBe(3)
  })
})
