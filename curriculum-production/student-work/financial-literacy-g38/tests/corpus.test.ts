import { describe, expect, it } from 'vitest'
import { buildCorpus, writeCorpus } from '../src/build.ts'
import { checkCorpus, checkDistinctness } from '../src/checks.ts'

describe('the committed corpus', () => {
  const entries = buildCorpus()

  it('satisfies every structural, safety, authority, and distinctness invariant', () => {
    expect(checkCorpus(entries)).toEqual([])
  })

  it('matches what the authored source rebuilds, byte for byte', () => {
    const report = writeCorpus(entries, 'check')
    expect(report.drift).toEqual([])
    expect(report.unchanged).toBe(432)
  })

  it('splits into 180 verified answer-key lessons and 36 rubric lessons', () => {
    const fixed = entries.filter((entry) => entry.scoring.scoringAuthority.kind === 'ANSWER_KEY')
    expect(fixed).toHaveLength(180)
    expect(entries).toHaveLength(216)
  })

  it('never repeats a scenario, task set, or scoring text across lessons', () => {
    expect(checkDistinctness(entries)).toEqual([])
  })

  it('would catch a duplicated scenario if one were introduced', () => {
    const [first, second] = entries
    const duplicated = [first, { ...second, pkg: { ...second.pkg, scenario: first.pkg.scenario } }]
    expect(checkDistinctness(duplicated).some((issue) => issue.detail.includes('scenario'))).toBe(true)
  })
})
